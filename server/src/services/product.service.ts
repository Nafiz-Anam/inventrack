import httpStatus from 'http-status';
import prisma from '../client';
import ApiError from '../utils/ApiError';
import inventoryActivityService from './inventoryActivity.service';
import { ProductStatus, RestockPriority, RestockStatus } from '@prisma/client';

const calculatePriority = (stock: number, threshold: number): RestockPriority => {
  if (stock === 0) return 'HIGH';
  if (stock <= Math.floor(threshold * 0.3)) return 'HIGH';
  if (stock <= Math.floor(threshold * 0.6)) return 'MEDIUM';
  return 'LOW';
};

/**
 * Evaluate restock queue - works with any Prisma client (root or transaction).
 */
const _evaluateRestock = async (db: any, productId: string, stock: number, threshold: number) => {
  if (stock <= threshold) {
    const existing = await db.restockQueue.findFirst({
      where: { productId, status: 'PENDING' },
    });

    const priority = calculatePriority(stock, threshold);

    if (existing) {
      await db.restockQueue.update({
        where: { id: existing.id },
        data: { currentStock: stock, priority },
      });
    } else {
      await db.restockQueue.deleteMany({
        where: { productId, status: 'COMPLETED' },
      });
      await db.restockQueue.create({
        data: { productId, currentStock: stock, threshold, priority },
      });
    }
  } else {
    await db.restockQueue.deleteMany({
      where: { productId, status: { in: ['PENDING', 'COMPLETED'] } },
    });
  }
};

/** Use with root prisma client */
const evaluateRestockQueue = (productId: string, stock: number, threshold: number) =>
  _evaluateRestock(prisma, productId, stock, threshold);

/** Use inside a Prisma transaction */
const evaluateRestockQueueTx = (tx: any, productId: string, stock: number, threshold: number) =>
  _evaluateRestock(tx, productId, stock, threshold);

const createProduct = async (
  data: {
    name: string;
    sku: string;
    categoryId: string;
    price: number;
    stock: number;
    minStockThreshold?: number;
    description?: string;
  },
  userId?: string
) => {
  // Verify category exists
  const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!category) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Category not found');
  }

  // Check SKU uniqueness
  const existingSku = await prisma.product.findUnique({ where: { sku: data.sku } });
  if (existingSku) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Product with this SKU already exists');
  }

  const status: ProductStatus = data.stock === 0 ? 'OUT_OF_STOCK' : 'ACTIVE';
  const threshold = data.minStockThreshold ?? 5;

  const product = await prisma.product.create({
    data: {
      name: data.name,
      sku: data.sku,
      categoryId: data.categoryId,
      price: data.price,
      stock: data.stock,
      minStockThreshold: threshold,
      status,
      description: data.description,
      createdBy: userId,
    },
    include: { category: true },
  });

  // Evaluate restock queue
  await evaluateRestockQueue(product.id, data.stock, threshold);

  await inventoryActivityService.logActivity(
    'CREATE',
    'Product',
    `Product "${product.name}" added with ${data.stock} units`,
    product.id,
    undefined,
    userId
  );

  return product;
};

const getProducts = async (options: {
  page?: number | string;
  limit?: number | string;
  search?: string;
  categoryId?: string;
  status?: ProductStatus;
  sortBy?: string;
  order?: 'asc' | 'desc';
}) => {
  const page = Number(options.page) || 1;
  const limit = Number(options.limit) || 10;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (options.search) {
    where.OR = [
      { name: { contains: options.search, mode: 'insensitive' } },
      { sku: { contains: options.search, mode: 'insensitive' } },
    ];
  }
  if (options.categoryId) where.categoryId = options.categoryId;
  if (options.status) where.status = options.status;

  const orderBy: any = {};
  const sortField = options.sortBy || 'createdAt';
  orderBy[sortField] = options.order || 'desc';

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: { category: true },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products,
    totalResults: total,
    totalPages: Math.ceil(total / limit),
    page,
    limit,
  };
};

const getProductById = async (productId: string) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { category: true },
  });
  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
  }
  return product;
};

const updateProduct = async (
  productId: string,
  data: {
    name?: string;
    sku?: string;
    categoryId?: string;
    price?: number;
    stock?: number;
    minStockThreshold?: number;
    description?: string;
    status?: ProductStatus;
  },
  userId?: string
) => {
  const product = await getProductById(productId);

  if (data.sku && data.sku !== product.sku) {
    const existingSku = await prisma.product.findUnique({ where: { sku: data.sku } });
    if (existingSku) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Product with this SKU already exists');
    }
  }

  if (data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Category not found');
    }
  }

  // Auto-compute status based on stock
  const newStock = data.stock !== undefined ? data.stock : product.stock;
  if (data.stock !== undefined) {
    if (newStock === 0) {
      data.status = 'OUT_OF_STOCK';
    } else if (product.status === 'OUT_OF_STOCK' && newStock > 0) {
      data.status = 'ACTIVE';
    }
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data,
    include: { category: true },
  });

  // Re-evaluate restock queue
  const threshold = data.minStockThreshold ?? product.minStockThreshold;
  await evaluateRestockQueue(productId, newStock, threshold);

  await inventoryActivityService.logActivity(
    'UPDATE',
    'Product',
    `Stock updated for "${updated.name}"`,
    updated.id,
    undefined,
    userId
  );

  return updated;
};

const deleteProduct = async (productId: string, userId?: string) => {
  const product = await getProductById(productId);

  await prisma.$transaction(async (tx: any) => {
    const pendingOrders = await tx.orderItem.count({
      where: {
        productId,
        order: { status: { in: ['PENDING', 'CONFIRMED', 'SHIPPED'] } },
      },
    });

    if (pendingOrders > 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Cannot delete product with active orders. Wait for orders to complete or cancel them.'
      );
    }

    await tx.restockQueue.deleteMany({ where: { productId } });
    await tx.product.delete({ where: { id: productId } });
  });

  await inventoryActivityService.logActivity(
    'DELETE', 'Product', `Product "${product.name}" deleted`, productId, undefined, userId
  );
};

export default {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  evaluateRestockQueue,
  evaluateRestockQueueTx,
  calculatePriority,
};
