import { z } from 'zod';

const createCategory = {
  body: z.object({
    name: z.string().min(1, 'Category name is required').max(100, 'Category name cannot exceed 100 characters'),
    description: z.string().max(500).optional(),
  }),
};

const updateCategory = {
  params: z.object({
    categoryId: z.string().min(1),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    isActive: z.boolean().optional(),
  }),
};

const getCategories = {
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    search: z.string().optional(),
    isActive: z.enum(['true', 'false']).optional(),
    sortBy: z.enum(['name', 'createdAt']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
  }).default({}),
};

const getCategory = {
  params: z.object({
    categoryId: z.string().min(1),
  }),
};

const deleteCategory = {
  params: z.object({
    categoryId: z.string().min(1),
  }),
};

export default { createCategory, updateCategory, getCategories, getCategory, deleteCategory };
