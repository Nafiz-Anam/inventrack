import httpStatus from 'http-status';
import prisma from '../client';
import ApiError from '../utils/ApiError';
import { RoleModel, PermissionModel, UserRole, RolePermission } from '@prisma/client';

interface CreateRoleData {
  name: string;
  description?: string;
  permissionIds?: string[];
}

interface UpdateRoleData {
  name?: string;
  description?: string;
  isActive?: boolean;
  permissionIds?: string[];
}

interface AssignRoleData {
  userId: string;
  roleId: string;
  expiresAt?: Date;
}

/**
 * Role-Based Access Control (RBAC) Service
 * Manages roles, permissions, and user-role assignments
 */
class RbacService {
  /**
   * Create a new role
   */
  async createRole(data: CreateRoleData): Promise<RoleModel> {
    const { name, description, permissionIds } = data;

    // Check if role already exists
    const existingRole = await prisma.roleModel.findUnique({
      where: { name },
    });

    if (existingRole) {
      throw new ApiError(httpStatus.CONFLICT, 'Role with this name already exists');
    }

    const role = await prisma.roleModel.create({
      data: {
        name,
        description,
      },
    });

    // Assign permissions if provided
    if (permissionIds && permissionIds.length > 0) {
      await this.assignPermissionsToRole(role.id, permissionIds);
    }

    return role;
  }

  /**
   * Get all roles with their permissions
   */
  async getAllRoles(includeInactive = false): Promise<RoleModel[]> {
    return await prisma.roleModel.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get role by ID with permissions
   */
  async getRoleById(id: string): Promise<RoleModel | null> {
    return await prisma.roleModel.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  /**
   * Update role
   */
  async updateRole(id: string, data: UpdateRoleData): Promise<RoleModel> {
    const { name, description, isActive, permissionIds } = data;

    // Check if role exists
    const existingRole = await prisma.roleModel.findUnique({
      where: { id },
    });

    if (!existingRole) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Role not found');
    }

    // Check if name is being changed and if new name already exists
    if (name && name !== existingRole.name) {
      const nameExists = await prisma.roleModel.findUnique({
        where: { name },
      });

      if (nameExists) {
        throw new ApiError(httpStatus.CONFLICT, 'Role with this name already exists');
      }
    }

    const role = await prisma.roleModel.update({
      where: { id },
      data: {
        name,
        description,
        isActive,
      },
    });

    // Update permissions if provided
    if (permissionIds !== undefined) {
      // Remove existing permissions
      await prisma.rolePermission.deleteMany({
        where: { roleId: id },
      });

      // Assign new permissions
      if (permissionIds.length > 0) {
        await this.assignPermissionsToRole(id, permissionIds);
      }
    }

    return role;
  }

  /**
   * Delete role
   */
  async deleteRole(id: string): Promise<void> {
    const role = await prisma.roleModel.findUnique({
      where: { id },
      include: {
        userRoles: true,
      },
    });

    if (!role) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Role not found');
    }

    // Check if role is assigned to any users
    if (role.userRoles.length > 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot delete role that is assigned to users');
    }

    // Delete role permissions first
    await prisma.rolePermission.deleteMany({
      where: { roleId: id },
    });

    // Delete role
    await prisma.roleModel.delete({
      where: { id },
    });
  }

  /**
   * Assign permissions to role
   */
  async assignPermissionsToRole(roleId: string, permissionIds: string[]): Promise<void> {
    // Verify all permissions exist
    const permissions = await prisma.permissionModel.findMany({
      where: {
        id: {
          in: permissionIds,
        },
      },
    });

    if (permissions.length !== permissionIds.length) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'One or more permissions not found');
    }

    // Create role-permission relationships
    const rolePermissions = permissionIds.map(permissionId => ({
      roleId,
      permissionId,
    }));

    await prisma.rolePermission.createMany({
      data: rolePermissions,
      skipDuplicates: true,
    });
  }

  /**
   * Remove permission from role
   */
  async removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    const rolePermission = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
        },
      },
    });

    if (!rolePermission) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Permission not assigned to this role');
    }

    await prisma.rolePermission.delete({
      where: { id: rolePermission.id },
    });
  }

  /**
   * Assign role to user
   */
  async assignRoleToUser(data: AssignRoleData, assignedBy?: string): Promise<UserRole> {
    const { userId, roleId, expiresAt } = data;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Check if role exists
    const role = await prisma.roleModel.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Role not found');
    }

    if (!role.isActive) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot assign inactive role');
    }

    // Check if user already has this role
    const existingUserRole = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });

    if (existingUserRole) {
      throw new ApiError(httpStatus.CONFLICT, 'User already has this role');
    }

    return await prisma.userRole.create({
      data: {
        userId,
        roleId,
        assignedBy,
        expiresAt,
      },
    });
  }

  /**
   * Remove role from user
   */
  async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    const userRole = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });

    if (!userRole) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User does not have this role');
    }

    await prisma.userRole.delete({
      where: { id: userRole.id },
    });
  }

  /**
   * Get user's roles
   */
  async getUserRoles(userId: string): Promise<
    (UserRole & {
      role: RoleModel & { permissions: (RolePermission & { permission: PermissionModel })[] };
    })[]
  > {
    return await prisma.userRole.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get user's permissions
   */
  async getUserPermissions(userId: string): Promise<PermissionModel[]> {
    const userRoles = await this.getUserRoles(userId);

    const permissions = new Map<string, PermissionModel>();

    for (const userRole of userRoles) {
      if (userRole.role.isActive) {
        for (const rolePermission of userRole.role.permissions) {
          permissions.set(rolePermission.permission.id, rolePermission.permission);
        }
      }
    }

    return Array.from(permissions.values());
  }

  /**
   * Check if user has specific permission
   */
  async userHasPermission(userId: string, permission: string): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return userPermissions.some(p => p.name === permission);
  }

  /**
   * Check if user has any of the specified permissions
   */
  async userHasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    const userPermissionNames = new Set(userPermissions.map(p => p.name));
    return permissions.some(permission => userPermissionNames.has(permission));
  }

  /**
   * Check if user has all specified permissions
   */
  async userHasAllPermissions(userId: string, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    const userPermissionNames = new Set(userPermissions.map(p => p.name));
    return permissions.every(permission => userPermissionNames.has(permission));
  }

  /**
   * Get all permissions
   */
  async getAllPermissions(): Promise<PermissionModel[]> {
    return await prisma.permissionModel.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  /**
   * Get permissions by resource
   */
  async getPermissionsByResource(resource: string): Promise<PermissionModel[]> {
    return await prisma.permissionModel.findMany({
      where: { resource },
      orderBy: { action: 'asc' },
    });
  }

  /**
   * Create permission
   */
  async createPermission(
    name: string,
    resource: string,
    action: string,
    description?: string
  ): Promise<PermissionModel> {
    // Check if permission already exists
    const existingPermission = await prisma.permissionModel.findUnique({
      where: { name },
    });

    if (existingPermission) {
      throw new ApiError(httpStatus.CONFLICT, 'Permission with this name already exists');
    }

    // Check if resource-action combination already exists
    const existingResourceAction = await prisma.permissionModel.findUnique({
      where: {
        resource_action: {
          resource,
          action,
        },
      },
    });

    if (existingResourceAction) {
      throw new ApiError(
        httpStatus.CONFLICT,
        'Permission for this resource-action combination already exists'
      );
    }

    return await prisma.permissionModel.create({
      data: {
        name,
        resource,
        action,
        description,
      },
    });
  }

  /**
   * Delete permission
   */
  async deletePermission(id: string): Promise<void> {
    const permission = await prisma.permissionModel.findUnique({
      where: { id },
      include: {
        rolePermissions: true,
      },
    });

    if (!permission) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Permission not found');
    }

    // Check if permission is assigned to any roles
    if (permission.rolePermissions.length > 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Cannot delete permission that is assigned to roles'
      );
    }

    await prisma.permissionModel.delete({
      where: { id },
    });
  }

  /**
   * Cleanup expired user roles
   */
  async cleanupExpiredRoles(): Promise<number> {
    const result = await prisma.userRole.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }
}

export default RbacService;
