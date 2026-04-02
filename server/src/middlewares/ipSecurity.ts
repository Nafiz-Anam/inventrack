import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import ipSecurityService from '../services/ipSecurity.service';
import logger from '../config/logger';

/**
 * IP Security Middleware
 * Blocks suspicious IPs and tracks IP-based security threats
 */
export const ipSecurityMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';

  try {
    const result = await ipSecurityService.shouldBlockIP(ip, req);

    if (result.shouldBlock) {
      logger.warn('IP blocked by security middleware', {
        ip,
        reason: result.reason,
        userAgent: req.get('User-Agent'),
        path: req.path,
      });

      // Track the request for analysis
      ipSecurityService.trackRequest(ip);

      return res.status(httpStatus.FORBIDDEN).json({
        error: 'Access denied',
        message: result.reason || 'Access blocked by security policy',
        code: 'IP_BLOCKED',
      });
    }

    // Track the request for analysis
    ipSecurityService.trackRequest(ip);

    next();
  } catch (error) {
    logger.error('IP security middleware error', { error, ip });
    next();
  }
};

/**
 * Admin IP Security Middleware
 * Provides IP security statistics and management
 */
export const adminIPSecurity = async (req: Request, res: Response, next: NextFunction) => {
  // Only allow admin users
  if ((req.user as any)?.role !== 'ADMIN') {
    return res.status(httpStatus.FORBIDDEN).json({
      error: 'Access denied',
      message: 'Admin access required',
    });
  }

  try {
    const stats = ipSecurityService.getIPStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Admin IP security error', { error });
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      error: 'Internal server error',
      message: 'Failed to get IP statistics',
    });
  }
};

/**
 * Reset IP Security Cache
 */
export const resetIPSecurity = async (req: Request, res: Response, next: NextFunction) => {
  // Only allow admin users
  if ((req.user as any)?.role !== 'ADMIN') {
    return res.status(httpStatus.FORBIDDEN).json({
      error: 'Access denied',
      message: 'Admin access required',
    });
  }

  try {
    ipSecurityService.clearCache();

    logger.info('IP security cache cleared by admin', {
      adminId: (req.user as any)?.id,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: 'IP security cache cleared successfully',
    });
  } catch (error) {
    logger.error('Reset IP security error', { error });
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      error: 'Internal server error',
      message: 'Failed to clear IP security cache',
    });
  }
};
