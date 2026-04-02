import { z } from 'zod';

const createProduct = {
  body: z.object({
    name: z.string().min(1, 'Product name is required').max(200),
    sku: z.string().min(1, 'SKU is required').max(50),
    categoryId: z.string().min(1, 'Category is required'),
    price: z.coerce.number().positive('Price must be positive'),
    stock: z.coerce.number().int().min(0, 'Stock cannot be negative'),
    minStockThreshold: z.coerce.number().int().min(0).optional().default(5),
    description: z.string().max(1000).optional(),
  }),
};

const updateProduct = {
  params: z.object({
    productId: z.string().min(1),
  }),
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    sku: z.string().min(1).max(50).optional(),
    categoryId: z.string().min(1).optional(),
    price: z.coerce.number().positive().optional(),
    stock: z.coerce.number().int().min(0).optional(),
    minStockThreshold: z.coerce.number().int().min(0).optional(),
    description: z.string().max(1000).optional(),
    status: z.enum(['ACTIVE', 'OUT_OF_STOCK']).optional(),
  }),
};

const getProducts = {
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    search: z.string().optional(),
    categoryId: z.string().optional(),
    status: z.enum(['ACTIVE', 'OUT_OF_STOCK']).optional(),
    sortBy: z.enum(['name', 'price', 'stock', 'createdAt']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
  }).default({}),
};

const getProduct = {
  params: z.object({
    productId: z.string().min(1),
  }),
};

const deleteProduct = {
  params: z.object({
    productId: z.string().min(1),
  }),
};

export default { createProduct, updateProduct, getProducts, getProduct, deleteProduct };
