import { z } from 'zod';

const getRestockQueue = {
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
    status: z.enum(['PENDING', 'COMPLETED']).optional(),
  }).default({}),
};

const restockProduct = {
  params: z.object({
    restockId: z.string().min(1),
  }),
  body: z.object({
    quantity: z.coerce.number().int().positive('Restock quantity must be at least 1'),
  }),
};

const deleteRestockEntry = {
  params: z.object({
    restockId: z.string().min(1),
  }),
};

export default { getRestockQueue, restockProduct, deleteRestockEntry };
