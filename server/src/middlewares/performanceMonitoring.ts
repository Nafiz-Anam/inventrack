import { Request, Response, NextFunction } from 'express';
import performanceMonitoringService from '../services/performanceMonitoring.service';
import logger from '../config/logger';

/**
 * Performance monitoring middleware
 * Tracks response times, error rates, and system resource usage
 */
export const performanceTracker = performanceMonitoringService.trackPerformance();

/**
 * Middleware to add performance headers to responses
 */
export const addPerformanceHeaders = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // Add performance headers
  if (!res.headersSent) {
    res.setHeader('X-Response-Time-Ms', '0');
    res.setHeader('X-Server-Timestamp', new Date().toISOString());
  }

  // Override res.end to add final response time
  const originalEnd = res.end;
  res.end = function (this: Response, ...args: any[]) {
    const responseTime = Date.now() - startTime;
    if (!res.headersSent) {
      res.setHeader('X-Response-Time-Ms', responseTime.toString());
    }
    return originalEnd.apply(this, args);
  };

  next();
};

/**
 * Middleware to monitor authentication endpoints specifically
 */
export const authPerformanceMonitor = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const endpoint = `${req.method}:${req.path}`;

  // Log authentication attempts
  logger.info('Auth endpoint accessed', {
    endpoint,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
  });

  // Override res.end to track auth performance
  const originalEnd = res.end;
  res.end = function (this: Response, ...args: any[]) {
    const responseTime = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log auth performance
    logger.info('Auth endpoint completed', {
      endpoint,
      responseTime,
      statusCode,
      success: statusCode < 400,
      ip: req.ip,
      userId: (req as any).user?.id,
    });

    // Alert on slow auth operations
    if (responseTime > 2000) {
      logger.warn('Slow authentication operation', {
        endpoint,
        responseTime,
        statusCode,
        ip: req.ip,
      });
    }

    return originalEnd.apply(this, args);
  };

  next();
};
