import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import { sendSuccess, sendError, ErrorCode } from '../utils/apiResponse';
import { Request, Response } from 'express';
import RbacService from '../services/rbac.service';
import { RoleModel, PermissionModel } from '@prisma/client';

const rbacService = new RbacService();

/**
 * Create a new role
 * @route POST /v1/roles
 * @access Private (Admin only)
 */
const createRole = catchAsync(async (req: Request, res: Response) => {
  const { name, description, permissionIds } = req.body;

  try {
    const role = await rbacService.createRole({
      name,
      description,
      permissionIds,
    });

    return sendSuccess(res, { role }, 'Role created successfully');
  } catch (error: any) {
    return sendError(res, ErrorCode.CONFLICT, error.message);
  }
});

/**
 * Get all roles
 * @route GET /v1/roles
 * @access Private (Admin only)
 */
const getRoles = catchAsync(async (req: Request, res: Response) => {
  const { includeInactive } = req.query;

  try {
    const roles = await rbacService.getAllRoles(includeInactive === 'true');

    return sendSuccess(res, { roles }, 'Roles retrieved successfully');
  } catch (error) {
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to retrieve roles');
  }
});

/**
 * Get role by ID
 * @route GET /v1/roles/:roleId
 * @access Private (Admin only)
 */
const getRoleById = catchAsync(async (req: Request, res: Response) => {
  const { roleId } = req.params;

  try {
    const role = await rbacService.getRoleById(req.params.roleId as string);

    if (!role) {
      return sendError(res, ErrorCode.NOT_FOUND, 'Role not found');
    }

    return sendSuccess(res, { role }, 'Role retrieved successfully');
  } catch (error) {
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to retrieve role');
  }
});

/**
 * Update role
 * @route PUT /v1/roles/:roleId
 * @access Private (Admin only)
 */
const updateRole = catchAsync(async (req: Request, res: Response) => {
  const { roleId } = req.params;
  const { name, description, isActive, permissionIds } = req.body;

  try {
    const role = await rbacService.updateRole(req.params.roleId as string, {
      name,
      description,
      isActive,
      permissionIds,
    });

    return sendSuccess(res, { role }, 'Role updated successfully');
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return sendError(res, ErrorCode.NOT_FOUND, error.message);
    }
    return sendError(res, ErrorCode.CONFLICT, error.message);
  }
});

/**
 * Delete role
 * @route DELETE /v1/roles/:roleId
 * @access Private (Admin only)
 */
const deleteRole = catchAsync(async (req: Request, res: Response) => {
  const roleId = req.params.roleId as string;

  try {
    await rbacService.deleteRole(roleId);

    return sendSuccess(res, null, 'Role deleted successfully');
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return sendError(res, ErrorCode.NOT_FOUND, error.message);
    }
    return sendError(res, ErrorCode.CONFLICT, error.message);
  }
});

/**
 * Assign permissions to role
 * @route POST /v1/roles/:roleId/permissions
 * @access Private (Admin only)
 */
const assignPermissionsToRole = catchAsync(async (req: Request, res: Response) => {
  const { roleId } = req.params;
  const { permissionIds } = req.body;

  try {
    await rbacService.assignPermissionsToRole(req.params.roleId as string, permissionIds);

    return sendSuccess(res, null, 'Permissions assigned to role successfully');
  } catch (error: any) {
    return sendError(res, ErrorCode.INVALID_INPUT, error.message);
  }
});

/**
 * Remove permission from role
 * @route DELETE /v1/roles/:roleId/permissions/:permissionId
 * @access Private (Admin only)
 */
const removePermissionFromRole = catchAsync(async (req: Request, res: Response) => {
  const roleId = req.params.roleId as string;
  const permissionId = req.params.permissionId as string;

  try {
    await rbacService.removePermissionFromRole(roleId, permissionId);

    return sendSuccess(res, null, 'Permission removed from role successfully');
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return sendError(res, ErrorCode.NOT_FOUND, error.message);
    }
    return sendError(res, ErrorCode.INVALID_INPUT, error.message);
  }
});

/**
 * Assign role to user
 * @route POST /v1/users/:userId/roles
 * @access Private (Admin only)
 */
const assignRoleToUser = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { roleId, expiresAt } = req.body;
  const assignedBy = (req.user as any)?.id;

  try {
    const userRole = await rbacService.assignRoleToUser(
      { userId: req.params.userId as string, roleId, expiresAt },
      assignedBy
    );

    return sendSuccess(res, { userRole }, 'Role assigned to user successfully');
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return sendError(res, ErrorCode.NOT_FOUND, error.message);
    }
    return sendError(res, ErrorCode.CONFLICT, error.message);
  }
});

/**
 * Remove role from user
 * @route DELETE /v1/users/:userId/roles/:roleId
 * @access Private (Admin only)
 */
const removeRoleFromUser = catchAsync(async (req: Request, res: Response) => {
  const { userId, roleId } = req.params;

  try {
    await rbacService.removeRoleFromUser(req.params.userId as string, req.params.roleId as string);

    return sendSuccess(res, null, 'Role removed from user successfully');
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return sendError(res, ErrorCode.NOT_FOUND, error.message);
    }
    return sendError(res, ErrorCode.INVALID_INPUT, error.message);
  }
});

/**
 * Get user's roles
 * @route GET /v1/users/:userId/roles
 * @access Private (Admin or self)
 */
const getUserRoles = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const currentUserId = (req.user as any)?.id;
  const currentUserRole = (req.user as any)?.role;

  // Users can only view their own roles unless they're admin
  if (userId !== currentUserId && currentUserRole !== 'ADMIN') {
    return sendError(res, ErrorCode.FORBIDDEN, 'Insufficient permissions');
  }

  try {
    const userRoles = await rbacService.getUserRoles(req.params.userId as string);

    return sendSuccess(res, { userRoles }, 'User roles retrieved successfully');
  } catch (error) {
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to retrieve user roles');
  }
});

/**
 * Get user's permissions
 * @route GET /v1/users/:userId/permissions
 * @access Private (Admin or self)
 */
const getUserPermissions = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const currentUserId = (req.user as any)?.id;
  const currentUserRole = (req.user as any)?.role;

  // Users can only view their own permissions unless they're admin
  if (userId !== currentUserId && currentUserRole !== 'ADMIN') {
    return sendError(res, ErrorCode.FORBIDDEN, 'Insufficient permissions');
  }

  try {
    const permissions = await rbacService.getUserPermissions(req.params.userId as string);

    return sendSuccess(res, { permissions }, 'User permissions retrieved successfully');
  } catch (error) {
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to retrieve user permissions');
  }
});

/**
 * Check if user has specific permission
 * @route GET /v1/users/:userId/permissions/check
 * @access Private (Admin or self)
 */
const checkUserPermission = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { permission } = req.query;
  const currentUserId = (req.user as any)?.id;
  const currentUserRole = (req.user as any)?.role;

  // Users can only check their own permissions unless they're admin
  if (userId !== currentUserId && currentUserRole !== 'ADMIN') {
    return sendError(res, ErrorCode.FORBIDDEN, 'Insufficient permissions');
  }

  if (!permission || typeof permission !== 'string') {
    return sendError(res, ErrorCode.INVALID_INPUT, 'Permission parameter is required');
  }

  try {
    const hasPermission = await rbacService.userHasPermission(
      req.params.userId as string,
      permission as string
    );

    return sendSuccess(res, { hasPermission }, 'Permission check completed');
  } catch (error) {
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to check permission');
  }
});

export {
  createRole,
  getRoles,
  getRoleById,
  updateRole,
  deleteRole,
  assignPermissionsToRole,
  removePermissionFromRole,
  assignRoleToUser,
  removeRoleFromUser,
  getUserRoles,
  getUserPermissions,
  checkUserPermission,
};
