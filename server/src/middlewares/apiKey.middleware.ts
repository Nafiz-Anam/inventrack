import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import { sendError, ErrorCode } from '../utils/apiResponse';
import apiKeyService from '../services/apiKey.service';
import { trackAuthenticationOperation } from '../utils/metrics';

interface AuthenticatedRequest extends Request {
  apiKey?: any;
  user?: any;
}

/**
 * Middleware to authenticate using API key
 */
const authenticateApiKey = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const apiKeyHeader = req.header('X-API-Key');
    const apiKeyQuery = req.query.api_key as string;
    const apiKey = apiKeyHeader || apiKeyQuery;

    if (!apiKey) {
      return sendError(res, ErrorCode.UNAUTHORIZED, 'API key is required');
    }

    const keyData = await apiKeyService.validateApiKey(apiKey, req);

    if (!keyData) {
      trackAuthenticationOperation('api_key', 'failure');
      return sendError(res, ErrorCode.UNAUTHORIZED, 'Invalid or expired API key');
    }

    // Attach API key data to request
    req.apiKey = keyData;

    trackAuthenticationOperation('api_key', 'success');
    next();
  } catch (error) {
    trackAuthenticationOperation('api_key', 'failure');
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'API key authentication failed');
  }
};

/**
 * Middleware to check API key permissions
 */
const requireApiKeyPermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return sendError(res, ErrorCode.UNAUTHORIZED, 'API key authentication required');
    }

    if (!apiKeyService.hasPermission(req.apiKey, permission)) {
      return sendError(res, ErrorCode.FORBIDDEN, 'Insufficient permissions');
    }

    next();
  };
};

/**
 * Middleware to check multiple API key permissions (any)
 */
const requireAnyApiKeyPermission = (permissions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return sendError(res, ErrorCode.UNAUTHORIZED, 'API key authentication required');
    }

    const hasPermission = permissions.some(permission =>
      apiKeyService.hasPermission(req.apiKey, permission)
    );

    if (!hasPermission) {
      return sendError(res, ErrorCode.FORBIDDEN, 'Insufficient permissions');
    }

    next();
  };
};

/**
 * Middleware to check multiple API key permissions (all)
 */
const requireAllApiKeyPermissions = (permissions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return sendError(res, ErrorCode.UNAUTHORIZED, 'API key authentication required');
    }

    const hasAllPermissions = permissions.every(permission => {
      const permissionResult = apiKeyService.hasPermission(req.apiKey, permission);
      if (!permissionResult) {
        console.log(`Permission ${permission} is missing`);
      }
      return permissionResult;
    });

    if (!hasAllPermissions) {
      return sendError(res, ErrorCode.FORBIDDEN, 'Insufficient permissions');
    }

    next();
  };
};

/**
 * Middleware to check if API key is active
 */
const requireActiveApiKey = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.apiKey) {
    return sendError(res, ErrorCode.UNAUTHORIZED, 'API key authentication required');
  }

  if (!req.apiKey.isActive) {
    return sendError(res, ErrorCode.FORBIDDEN, 'API key is inactive');
  }

  next();
};

/**
 * Middleware to check API key expiration
 */
const requireNonExpiredApiKey = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.apiKey) {
    return sendError(res, ErrorCode.UNAUTHORIZED, 'API key authentication required');
  }

  if (req.apiKey.expiresAt && req.apiKey.expiresAt < new Date()) {
    return sendError(res, ErrorCode.FORBIDDEN, 'API key has expired');
  }

  next();
};

/**
 * Middleware to check API key rate limit
 */
const checkApiKeyRateLimit = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.apiKey) {
    return sendError(res, ErrorCode.UNAUTHORIZED, 'API key authentication required');
  }

  // Rate limiting is already checked in the validation process
  // This middleware is for additional checks if needed
  next();
};

/**
 * Middleware to validate API key origin
 */
const validateApiKeyOrigin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.apiKey) {
    return sendError(res, ErrorCode.UNAUTHORIZED, 'API key authentication required');
  }

  if (req.apiKey.allowedOrigins.length > 0) {
    const origin = req.get('Origin') || req.get('Referer');
    if (!origin || !req.apiKey.allowedOrigins.includes(origin)) {
      return sendError(res, ErrorCode.FORBIDDEN, 'Origin not allowed for this API key');
    }
  }

  next();
};

/**
 * Middleware to validate API key IP
 */
const validateApiKeyIP = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.apiKey) {
    return sendError(res, ErrorCode.UNAUTHORIZED, 'API key authentication required');
  }

  if (req.apiKey.allowedIPs.length > 0) {
    const clientIP = req.ip || req.connection.remoteAddress;
    if (!clientIP || !req.apiKey.allowedIPs.includes(clientIP)) {
      return sendError(res, ErrorCode.FORBIDDEN, 'IP address not allowed for this API key');
    }
  }

  next();
};

/**
 * Middleware to log API key usage
 */
const logApiKeyUsage = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.apiKey) {
    return next();
  }

  const originalSend = res.send;
  res.send = function (this: Response, ...args: any[]) {
    // Log the usage after response is sent
    setImmediate(() => {
      // This would be handled by the apiKeyService.updateKeyUsage method
      // which is called during validation
    });
    return originalSend.apply(this, args);
  };

  next();
};

/**
 * Combined middleware for API key authentication with validation
 */
const authenticateAndValidateApiKey = [
  authenticateApiKey,
  requireActiveApiKey,
  requireNonExpiredApiKey,
  validateApiKeyOrigin,
  validateApiKeyIP,
  checkApiKeyRateLimit,
  logApiKeyUsage,
];

/**
 * Middleware to check if user can access their own resources or API key
 */
const requireSelfOrAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.params.userId;
  const currentUserId = req.user?.id;
  const currentUserRole = req.user?.role;

  // Admin can access everything
  if (currentUserRole === 'ADMIN') {
    return next();
  }

  // Users can only access their own resources
  if (userId !== currentUserId) {
    return sendError(res, ErrorCode.FORBIDDEN, 'Access denied');
  }

  next();
};

/**
 * Middleware to check if API key owner can access their own keys
 */
const requireApiKeyOwner = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const apiKeyId = req.params.apiKeyId;
  const currentUserId = req.user?.id;

  if (!req.apiKey) {
    return sendError(res, ErrorCode.UNAUTHORIZED, 'API key authentication required');
  }

  // API key can access its own data
  if (req.apiKey.id === apiKeyId) {
    return next();
  }

  // User can access their own API keys
  if (req.apiKey.userId === currentUserId) {
    return next();
  }

  return sendError(res, ErrorCode.FORBIDDEN, 'Access denied');
};

export {
  authenticateApiKey,
  requireApiKeyPermission,
  requireAnyApiKeyPermission,
  requireAllApiKeyPermissions,
  requireActiveApiKey,
  requireNonExpiredApiKey,
  checkApiKeyRateLimit,
  validateApiKeyOrigin,
  validateApiKeyIP,
  logApiKeyUsage,
  authenticateAndValidateApiKey,
  requireSelfOrAdmin,
  requireApiKeyOwner,
};
