import { z } from 'zod';

const createRole = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  permissionIds: z.array(z.string()).optional(),
});

const updateRole = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
  permissionIds: z.array(z.string()).optional(),
});

const assignPermissions = z.object({
  permissionIds: z.array(z.string()).min(1),
});

const assignRoleToUser = z.object({
  roleId: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
});

export const rbacValidation = {
  createRole,
  updateRole,
  assignPermissions,
  assignRoleToUser,
};
