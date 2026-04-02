import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import prisma from '../client';
import cacheService from '../services/cache.service';
import emailService from '../services/email.service';
import structuredLogger from '../utils/structuredLogger';
import { sendSuccess } from '../utils/apiResponse';
import { Request, Response } from 'express';

/**
 * Basic health check endpoint
 * @route GET /v1/health
 * @access Public
 */
const healthCheck = catchAsync(async (req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  };

  structuredLogger.info('Health check requested', {
    requestId: (req as any).requestId,
    endpoint: 'GET /v1/health',
  });

  return sendSuccess(res, health, 'Service is healthy');
});

/**
 * Database health check
 * @route GET /v1/health/database
 * @access Public
 */
const databaseHealthCheck = catchAsync(async (req: Request, res: Response) => {
  const startTime = Date.now();
  let error: string | null = null;
  let connectionTime: number;
  let isHealthy: boolean;

  try {
    // Test database connection with a simple query
    await prisma.$queryRaw`SELECT 1`;
    connectionTime = Date.now() - startTime;
    isHealthy = true;

    structuredLogger.info('Database health check passed', {
      requestId: (req as any).requestId,
      connectionTime,
    });
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown database error';
    connectionTime = Date.now() - startTime;
    isHealthy = false;

    structuredLogger.error('Database health check failed', err as Error, {
      requestId: (req as any).requestId,
      connectionTime,
    });
  }

  const status = isHealthy ? 'healthy' : 'unhealthy';
  const health = {
    status,
    database: {
      connection: isHealthy ? 'connected' : 'disconnected',
      connectionTime: `${connectionTime}ms`,
      error: error,
    },
    timestamp: new Date().toISOString(),
  };

  const statusCode = isHealthy ? httpStatus.OK : httpStatus.SERVICE_UNAVAILABLE;
  return sendSuccess(res, health, `Database is ${status}`, statusCode as any);
});

/**
 * Email health check
 * @route GET /v1/health/email
 * @access Public
 */
const emailHealthCheck = catchAsync(async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const emailHealth = await emailService.checkEmailServiceHealth();
    const connectionTime = Date.now() - startTime;

    const health = {
      status: emailHealth.status === 'connected' ? 'healthy' : 'unhealthy',
      email: {
        ...emailHealth,
        connectionTime: `${connectionTime}ms`,
      },
      timestamp: new Date().toISOString(),
    };

    structuredLogger.info('Email health check', {
      requestId: (req as any).requestId,
      ...health.email,
    });

    const statusCode = health.status === 'healthy' ? httpStatus.OK : httpStatus.SERVICE_UNAVAILABLE;
    return res.status(statusCode).json({
      success: true,
      data: health,
      message: `Email service is ${health.status}`,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req as any).requestId,
      },
    });
  } catch (error) {
    const health = {
      status: 'unhealthy',
      email: {
        status: 'error',
        message: error.message,
        connectionTime: `${Date.now() - startTime}ms`,
      },
      timestamp: new Date().toISOString(),
    };

    structuredLogger.error('Email health check failed', {
      requestId: (req as any).requestId,
      error: (error as Error).message,
    } as any);

    return res.status(httpStatus.SERVICE_UNAVAILABLE).json({
      success: false,
      data: health,
      message: 'Email service check failed',
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req as any).requestId,
      },
    });
  }
});

/**
 * Cache health check
 * @route GET /v1/health/cache
 * @access Public
 */
const cacheHealthCheck = catchAsync(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const cacheHealth = await cacheService.healthCheck();
  const responseTime = Date.now() - startTime;

  const health = {
    cache: {
      status: cacheHealth.status,
      latency: `${responseTime}ms`,
    },
    timestamp: new Date().toISOString(),
  };

  structuredLogger.info('Cache health check', {
    requestId: (req as any).requestId,
    ...health.cache,
  });

  const statusCode =
    cacheHealth.status === 'healthy' ? httpStatus.OK : httpStatus.SERVICE_UNAVAILABLE;
  return sendSuccess(res, health, `Cache is ${cacheHealth.status}`, statusCode as any);
});

/**
 * Detailed system health check
 * @route GET /v1/health/detailed
 * @access Private (Admin only)
 */
const detailedHealthCheck = catchAsync(async (req: Request, res: Response) => {
  const startTime = Date.now();

  const health = {
    status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
    database: {
      status: 'unknown' as 'connected' | 'disconnected' | 'error',
      connectionTime: 0,
      error: null as string | null,
    },
    cache: {
      status: 'unknown' as 'healthy' | 'unhealthy',
      latency: '0ms',
    },
    services: {
      email: 'unknown' as 'configured' | 'not_configured' | 'error',
      notifications: 'unknown' as 'configured' | 'not_configured' | 'error',
    },
    metrics: {
      activeConnections: 0,
      requestsPerMinute: 0,
      averageResponseTime: 0,
    },
  };

  // Test database connection
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.database.status = 'connected';
    health.database.connectionTime = Date.now() - dbStart;
  } catch (error) {
    health.database.status = 'error';
    health.database.error = error instanceof Error ? error.message : 'Unknown database error';
    health.status = 'degraded';
  }

  // Test cache connection
  const cacheHealth = await cacheService.healthCheck();
  health.cache.status = cacheHealth.status;
  health.cache.latency = `${Date.now() - startTime}ms`;

  // Check service configurations
  if (process.env.SMTP_HOST && process.env.SMTP_USERNAME) {
    health.services.email = 'configured';
  } else {
    health.services.email = 'not_configured';
  }

  // Check if notification service is available
  try {
    // This would check if your notification service is properly configured
    health.services.notifications = 'configured';
  } catch {
    health.services.notifications = 'not_configured';
  }

  // Calculate basic metrics (in a real implementation, you'd track these)
  health.metrics.activeConnections = 1; // Current connection
  health.metrics.requestsPerMinute = Math.floor(Math.random() * 100); // Mock data
  health.metrics.averageResponseTime = Math.floor(Math.random() * 500) + 50; // Mock data

  // Determine overall status
  const hasIssues = [
    health.database.status !== 'connected',
    health.cache.status !== 'healthy',
  ].some(Boolean);

  if (hasIssues) {
    health.status = health.database.status === 'error' ? 'unhealthy' : 'degraded';
  }

  structuredLogger.info('Detailed health check completed', {
    requestId: (req as any).requestId,
    status: health.status,
    databaseStatus: health.database.status,
    cacheStatus: health.cache.status,
  });

  const statusCode = health.status === 'healthy' ? httpStatus.OK : httpStatus.SERVICE_UNAVAILABLE;
  return res.status(statusCode).json({
    success: true,
    data: health,
    message: `System is ${health.status}`,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId,
    },
  });
});

/**
 * Readiness probe (for Kubernetes)
 * @route GET /v1/health/ready
 * @access Public
 */
const readinessCheck = catchAsync(async (req: Request, res: Response) => {
  const checks = {
    database: false,
    cache: false,
  };

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (error) {
    structuredLogger.error('Database readiness check failed', error as Error, {
      requestId: (req as any).requestId,
    });
  }

  // Check cache
  const cacheHealth = await cacheService.healthCheck();
  checks.cache = cacheHealth.status === 'healthy';

  const isReady = Object.values(checks).every(Boolean);
  const status = isReady ? 'ready' : 'not_ready';

  const readiness = {
    status,
    checks,
    timestamp: new Date().toISOString(),
  };

  structuredLogger.info('Readiness check', {
    requestId: (req as any).requestId,
    status,
    checks,
  });

  const statusCode = isReady ? httpStatus.OK : httpStatus.SERVICE_UNAVAILABLE;
  return res.status(statusCode).json({
    success: true,
    data: readiness,
    message: `Service is ${status}`,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId,
    },
  });
});

/**
 * Liveness probe (for Kubernetes)
 * @route GET /v1/health/live
 * @access Public
 */
const livenessCheck = catchAsync(async (req: Request, res: Response) => {
  // Basic liveness check - just check if the process is responsive
  const liveness = {
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  structuredLogger.debug('Liveness check', {
    requestId: (req as any).requestId,
  });

  return sendSuccess(res, liveness, 'Service is alive');
});

export default {
  healthCheck,
  databaseHealthCheck,
  emailHealthCheck,
  cacheHealthCheck,
  detailedHealthCheck,
  readinessCheck,
  livenessCheck,
};
