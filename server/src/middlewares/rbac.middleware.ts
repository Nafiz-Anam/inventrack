import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import { sendError, ErrorCode } from '../utils/apiResponse';
import RbacService from '../services/rbac.service';

const rbacService = new RbacService();

/**
 * Middleware to check if user has required permission
 */
const requirePermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.user as any)?.id;

    if (!userId) {
      return sendError(res, ErrorCode.UNAUTHORIZED, 'Authentication required');
    }

    try {
      const hasPermission = await rbacService.userHasPermission(userId, permission);

      if (!hasPermission) {
        return sendError(res, ErrorCode.FORBIDDEN, 'Insufficient permissions');
      }

      next();
    } catch (error) {
      return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Permission check failed');
    }
  };
};

/**
 * Middleware to check if user has any of the required permissions
 */
const requireAnyPermission = (permissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.user as any)?.id;

    if (!userId) {
      return sendError(res, ErrorCode.UNAUTHORIZED, 'Authentication required');
    }

    try {
      const hasPermission = await rbacService.userHasAnyPermission(userId, permissions);

      if (!hasPermission) {
        return sendError(res, ErrorCode.FORBIDDEN, 'Insufficient permissions');
      }

      next();
    } catch (error) {
      return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Permission check failed');
    }
  };
};

/**
 * Middleware to check if user has all required permissions
 */
const requireAllPermissions = (permissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.user as any)?.id;

    if (!userId) {
      return sendError(res, ErrorCode.UNAUTHORIZED, 'Authentication required');
    }

    try {
      const hasAllPermissions = await rbacService.userHasAllPermissions(userId, permissions);

      if (!hasAllPermissions) {
        return sendError(res, ErrorCode.FORBIDDEN, 'Insufficient permissions');
      }

      next();
    } catch (error) {
      return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Permission check failed');
    }
  };
};

/**
 * Middleware to check if user has specific role
 */
const requireRole = (role: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.user as any)?.id;
    const currentUserRole = (req.user as any)?.role;

    if (!userId) {
      return sendError(res, ErrorCode.UNAUTHORIZED, 'Authentication required');
    }

    // Admin can access everything
    if (currentUserRole === 'ADMIN') {
      return next();
    }

    // Check if user has the required role
    try {
      const userRoles = await rbacService.getUserRoles(userId);
      const hasRole = userRoles.some(userRole => userRole.role.name === role);

      if (!hasRole) {
        return sendError(res, ErrorCode.FORBIDDEN, 'Insufficient permissions');
      }

      next();
    } catch (error) {
      return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Role check failed');
    }
  };
};

/**
 * Middleware to check if user is admin
 */
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const currentUserRole = (req.user as any)?.role;

  if (currentUserRole !== 'ADMIN') {
    return sendError(res, ErrorCode.FORBIDDEN, 'Admin access required');
  }

  next();
};

/**
 * Middleware to check if user can access their own resource or is admin
 */
const requireSelfOrAdmin = (resourceUserId?: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.user as any)?.id;
    const currentUserRole = (req.user as any)?.role;

    // Admin can access everything
    if (currentUserRole === 'ADMIN') {
      return next();
    }

    // Users can only access their own resources
    if (resourceUserId && userId !== resourceUserId) {
      return sendError(res, ErrorCode.FORBIDDEN, 'Access denied');
    }

    next();
  };
};

/**
 * Middleware to check if user can access resource or is admin
 */
const requireOwnershipOrAdmin = (resourceUserId?: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.user as any)?.id;
    const currentUserRole = (req.user as any)?.role;

    // Admin can access everything
    if (currentUserRole === 'ADMIN') {
      return next();
    }

    // Users can only access their own resources
    if (resourceUserId && userId !== resourceUserId) {
      return sendError(res, ErrorCode.FORBIDDEN, 'Access denied');
    }

    next();
  };
};

/**
 * Create RBAC middleware with multiple permission checks
 */
const createRbacMiddleware = (options: {
  permissions?: string[];
  roles?: string[];
  requireSelfOrAdmin?: boolean;
  resourceUserId?: string;
  requireOwnership?: boolean;
}) => {
  const middlewares = [];

  if (options.permissions && options.permissions.length > 0) {
    if (options.permissions.length === 1) {
      middlewares.push(requirePermission(options.permissions[0]));
    } else {
      middlewares.push(requireAnyPermission(options.permissions));
    }
  }

  if (options.roles && options.roles.length > 0) {
    if (options.roles.length === 1) {
      middlewares.push(requireRole(options.roles[0]));
    } else {
      // For multiple roles, check if user has any of the required roles
      middlewares.push(requireAnyPermission(options.roles.map(role => `ROLE_${role}`)));
    }
  }

  if (options.requireSelfOrAdmin) {
    middlewares.push(requireSelfOrAdmin(options.resourceUserId));
  }

  if (options.requireOwnership) {
    middlewares.push(requireOwnershipOrAdmin(options.resourceUserId));
  }

  // Apply middlewares in sequence
  return (req: Request, res: Response, next: NextFunction) => {
    let index = 0;
    const executeMiddleware = (index: number) => {
      if (index >= middlewares.length) {
        return next();
      }
      return middlewares[index](req, res, executeMiddleware(index + 1));
    };

    executeMiddleware(0);
  };
};

export {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireRole,
  requireAdmin,
  requireSelfOrAdmin,
  requireOwnershipOrAdmin,
  createRbacMiddleware,
};
