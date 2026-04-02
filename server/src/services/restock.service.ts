import httpStatus from 'http-status';
import prisma from '../client';
import ApiError from '../utils/ApiError';
import inventoryActivityService from './inventoryActivity.service';
import cacheService, { CacheKeys } from './cache.service';
import { RestockPriority, RestockStatus } from '@prisma/client';

const invalidateRestockCache = async () => {
  await cacheService.delPattern('inventory:restock:*');
  await cacheService.delPattern('inventory:products:*');
  await cacheService.delPattern('inventory:product:*');
  await cacheService.del(CacheKeys.DASHBOARD_STATS);
};

const getRestockQueue = async (options: {
  page?: number | string;
  limit?: number | string;
  priority?: RestockPriority;
  status?: RestockStatus;
}) => {
  const page = Number(options.page) || 1;
  const limit = Number(options.limit) || 10;
  const cacheKey = CacheKeys.RESTOCK_QUEUE(JSON.stringify({ ...options, page, limit }));
  const cached = await cacheService.get(cacheKey);
  if (cached) return cached;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (options.priority) where.priority = options.priority;
  where.status = options.status || 'PENDING';

  const [items, total] = await Promise.all([
    prisma.restockQueue.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ currentStock: 'asc' }, { priority: 'asc' }],
      include: { product: { include: { category: true } } },
    }),
    prisma.restockQueue.count({ where }),
  ]);

  const result = { items, totalResults: total, totalPages: Math.ceil(total / limit), page, limit };
  await cacheService.set(cacheKey, result, { ttl: 60 });
  return result;
};

/**
 * Restock a product atomically.
 * Status check + stock increment + queue update all inside one transaction.
 */
const restockProduct = async (restockId: string, quantity: number, userId?: string) => {
  const result = await prisma.$transaction(async (tx: any) => {
    // Fetch and validate inside transaction
    const entry = await tx.restockQueue.findUnique({
      where: { id: restockId },
      include: { product: true },
    });

    if (!entry) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Restock entry not found');
    }

    if (entry.status === 'COMPLETED') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'This item has already been restocked');
    }

    // Atomic stock increment
    await tx.product.update({
      where: { id: entry.productId },
      data: {
        stock: { increment: quantity },
        status: 'ACTIVE',
      },
    });

    // Get updated stock for the response
    const updatedProduct = await tx.product.findUnique({ where: { id: entry.productId } });
    const newStock = updatedProduct?.stock || entry.product.stock + quantity;

    // Mark restock entry as completed
    const updated = await tx.restockQueue.update({
      where: { id: restockId },
      data: {
        status: 'COMPLETED',
        restockedBy: userId,
        restockedAt: new Date(),
        restockQuantity: quantity,
        currentStock: newStock,
      },
      include: { product: { include: { category: true } } },
    });

    return updated;
  });

  await invalidateRestockCache();
  await inventoryActivityService.logActivity(
    'RESTOCK', 'Product',
    `Stock updated for "${result.product.name}" (+${quantity} units)`,
    result.productId,
    { quantity, newStock: result.currentStock },
    userId
  );

  return result;
};

const deleteRestockEntry = async (restockId: string, userId?: string) => {
  const entry = await prisma.restockQueue.findUnique({
    where: { id: restockId },
    include: { product: true },
  });

  if (!entry) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Restock entry not found');
  }

  await prisma.restockQueue.delete({ where: { id: restockId } });
  await invalidateRestockCache();

  await inventoryActivityService.logActivity(
    'DELETE', 'RestockQueue',
    `"${entry.product.name}" removed from Restock Queue`,
    restockId, undefined, userId
  );
};

export default { getRestockQueue, restockProduct, deleteRestockEntry };
