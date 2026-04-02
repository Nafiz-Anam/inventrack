import { z } from 'zod';

const createOrder = {
  body: z.object({
    customerName: z.string().min(1, 'Customer name is required').max(200),
    items: z
      .array(
        z.object({
          productId: z.string().min(1, 'Product ID is required'),
          quantity: z.coerce.number().int().positive('Quantity must be at least 1'),
        })
      )
      .min(1, 'At least one item is required'),
    notes: z.string().max(500).optional(),
  }),
};

const updateOrderStatus = {
  params: z.object({
    orderId: z.string().min(1),
  }),
  body: z.object({
    status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  }),
};

const cancelOrder = {
  params: z.object({
    orderId: z.string().min(1),
  }),
};

const getOrders = {
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    search: z.string().optional(),
    sortBy: z.enum(['createdAt', 'totalAmount', 'customerName', 'orderNumber']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
  }).default({}),
};

const getOrder = {
  params: z.object({
    orderId: z.string().min(1),
  }),
};

export default { createOrder, updateOrderStatus, cancelOrder, getOrders, getOrder };
