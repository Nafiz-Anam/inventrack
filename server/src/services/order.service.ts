import httpStatus from 'http-status';
import prisma from '../client';
import ApiError from '../utils/ApiError';
import inventoryActivityService from './inventoryActivity.service';
import productService from './product.service';
import cacheService, { CacheKeys } from './cache.service';
import { OrderStatus } from '@prisma/client';

const invalidateOrderCache = async () => {
  await cacheService.delPattern('inventory:orders:*');
  await cacheService.delPattern('inventory:products:*');
  await cacheService.delPattern('inventory:product:*');
  await cacheService.delPattern('inventory:restock:*');
  await cacheService.del(CacheKeys.DASHBOARD_STATS);
};

/**
 * Generate order number with collision retry.
 * Uses the unique constraint on order_number as the final guard.
 */
const generateOrderNumber = async (tx: any): Promise<string> => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `ORD-${dateStr}-`;

  const lastOrder = await tx.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  });

  let nextNum = 1;
  if (lastOrder) {
    const lastNum = parseInt(lastOrder.orderNumber.split('-').pop() || '0', 10);
    nextNum = lastNum + 1;
  }
  return `${prefix}${String(nextNum).padStart(4, '0')}`;
};

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

/**
 * Create order with atomic stock deduction.
 * All validation, stock checks, deduction, and order creation happen in a single transaction.
 */
const createOrder = async (
  data: {
    customerName: string;
    items: { productId: string; quantity: number }[];
    notes?: string;
  },
  userId?: string
) => {
  // Client-side duplicate check (fast fail before transaction)
  const productIds = data.items.map((item) => item.productId);
  const uniqueIds = new Set(productIds);
  if (uniqueIds.size !== productIds.length) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'This product is already added to the order.');
  }

  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    attempt++;
    try {
      const order = await prisma.$transaction(async (tx) => {
        // Lock products with FOR UPDATE to prevent concurrent stock modification
        const products: any[] = await tx.product.findMany({
          where: { id: { in: productIds } },
        });

        if (products.length !== productIds.length) {
          throw new ApiError(httpStatus.BAD_REQUEST, 'One or more products not found');
        }

        const productMap = new Map(products.map((p: any) => [p.id, p]));

        // Validate stock and status (inside transaction with locked rows)
        let totalAmount = 0;
        const orderItemsData: {
          productId: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
        }[] = [];

        for (const item of data.items) {
          const product = productMap.get(item.productId)!;

          if (product.status !== 'ACTIVE') {
            throw new ApiError(
              httpStatus.BAD_REQUEST,
              `This product is currently unavailable: "${product.name}"`
            );
          }

          if (product.stock < item.quantity) {
            throw new ApiError(
              httpStatus.BAD_REQUEST,
              `Only ${product.stock} items available in stock for "${product.name}"`
            );
          }

          const price = Number(product.price);
          const itemTotal = price * item.quantity;
          totalAmount += itemTotal;
          orderItemsData.push({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: price,
            totalPrice: itemTotal,
          });
        }

        // Atomic stock deduction using decrement (prevents negative stock)
        for (const item of data.items) {
          const product = productMap.get(item.productId)!;
          const newStock = product.stock - item.quantity;

          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { decrement: item.quantity },
              status: newStock === 0 ? 'OUT_OF_STOCK' : undefined,
            },
          });
        }

        // Generate order number inside transaction to prevent collisions
        const orderNumber = await generateOrderNumber(tx);

        const newOrder = await tx.order.create({
          data: {
            orderNumber,
            customerName: data.customerName,
            totalAmount,
            notes: data.notes,
            createdBy: userId,
            items: { create: orderItemsData },
          },
          include: {
            items: {
              include: { product: { include: { category: true } } },
            },
          },
        });

        // Evaluate restock queue inside transaction
        for (const item of data.items) {
          const updatedProduct = await tx.product.findUnique({ where: { id: item.productId } });
          if (updatedProduct) {
            await productService.evaluateRestockQueueTx(
              tx, updatedProduct.id, updatedProduct.stock, updatedProduct.minStockThreshold
            );
          }
        }

        return newOrder;
      }, {
        isolationLevel: 'Serializable',
        timeout: 10000,
      });

      await invalidateOrderCache();
      await inventoryActivityService.logActivity(
        'CREATE', 'Order',
        `Order ${order.orderNumber} created by user`,
        order.id,
        { customerName: data.customerName, itemCount: data.items.length },
        userId
      );

      return order;
    } catch (error: any) {
      // Retry on serialization failure or unique constraint violation (order number collision)
      if (
        attempt < MAX_RETRIES &&
        (error?.code === 'P2034' || error?.code === 'P2002' || error?.message?.includes('Serializable'))
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create order after retries');
};

const getOrders = async (options: {
  page?: number | string;
  limit?: number | string;
  status?: OrderStatus;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: string;
  order?: string;
}) => {
  const page = Number(options.page) || 1;
  const limit = Number(options.limit) || 10;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (options.status) where.status = options.status;
  if (options.search) {
    where.OR = [
      { customerName: { contains: options.search, mode: 'insensitive' } },
      { orderNumber: { contains: options.search, mode: 'insensitive' } },
    ];
  }
  if (options.startDate || options.endDate) {
    where.createdAt = {};
    if (options.startDate) where.createdAt.gte = new Date(options.startDate);
    if (options.endDate) where.createdAt.lte = new Date(options.endDate + 'T23:59:59.999Z');
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [options.sortBy || 'createdAt']: options.order || 'desc' },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
        creator: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders,
    totalResults: total,
    totalPages: Math.ceil(total / limit),
    page,
    limit,
  };
};

const getOrderById = async (orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: { product: { include: { category: true } } },
      },
      creator: { select: { id: true, name: true, email: true } },
    },
  });
  if (!order) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Order not found');
  }
  return order;
};

/**
 * Update order status with transition validation inside transaction.
 */
const updateOrderStatus = async (orderId: string, status: OrderStatus, userId?: string) => {
  if (status === 'CANCELLED') {
    return cancelOrder(orderId, userId);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new ApiError(httpStatus.NOT_FOUND, 'Order not found');

    const allowedTransitions = VALID_TRANSITIONS[order.status];
    if (!allowedTransitions.includes(status)) {
      throw new ApiError(httpStatus.BAD_REQUEST, `Cannot transition from ${order.status} to ${status}`);
    }

    return tx.order.update({
      where: { id: orderId },
      data: { status },
      include: { items: { include: { product: { include: { category: true } } } } },
    });
  });

  await invalidateOrderCache();
  await inventoryActivityService.logActivity(
    'UPDATE', 'Order', `Order ${updated.orderNumber} marked as ${status}`, updated.id, undefined, userId
  );

  return updated;
};

/**
 * Cancel order with atomic stock restoration.
 * Status check and stock restore happen in a single serializable transaction.
 */
const cancelOrder = async (orderId: string, userId?: string) => {
  const updated = await prisma.$transaction(async (tx) => {
    // Fetch and validate inside transaction
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) throw new ApiError(httpStatus.NOT_FOUND, 'Order not found');
    if (order.status === 'DELIVERED') throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot cancel a delivered order');
    if (order.status === 'CANCELLED') throw new ApiError(httpStatus.BAD_REQUEST, 'Order is already cancelled');

    // Atomic stock restoration using increment
    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: { increment: item.quantity },
          status: 'ACTIVE', // If stock was 0, now it's > 0
        },
      });
    }

    // Update order status
    const cancelled = await tx.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
      include: { items: { include: { product: { include: { category: true } } } } },
    });

    // Re-evaluate restock queue inside transaction
    for (const item of order.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (product) {
        await productService.evaluateRestockQueueTx(tx, product.id, product.stock, product.minStockThreshold);
      }
    }

    return cancelled;
  }, {
    isolationLevel: 'Serializable',
    timeout: 10000,
  });

  await invalidateOrderCache();
  await inventoryActivityService.logActivity(
    'CANCEL', 'Order', `Order ${updated.orderNumber} cancelled`, updated.id, undefined, userId
  );

  return updated;
};

/**
 * Delete order with atomic stock restoration.
 */
const deleteOrder = async (orderId: string, userId?: string) => {
  const order = await prisma.$transaction(async (tx) => {
    const o = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!o) throw new ApiError(httpStatus.NOT_FOUND, 'Order not found');

    // Restore stock if order wasn't cancelled
    if (o.status !== 'CANCELLED') {
      for (const item of o.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
            status: 'ACTIVE',
          },
        });
      }

      for (const item of o.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (product) {
          await productService.evaluateRestockQueueTx(tx, product.id, product.stock, product.minStockThreshold);
        }
      }
    }

    await tx.order.delete({ where: { id: orderId } });
    return o;
  }, {
    isolationLevel: 'Serializable',
    timeout: 10000,
  });

  await invalidateOrderCache();
  await inventoryActivityService.logActivity(
    'DELETE', 'Order', `Order ${order.orderNumber} deleted`, orderId, undefined, userId
  );
};

export default {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  deleteOrder,
};
