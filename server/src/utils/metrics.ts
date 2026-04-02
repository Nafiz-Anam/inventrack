import { Request, Response } from 'express';
import { collectDefaultMetrics, Counter, Histogram, Registry, Summary, Gauge } from 'prom-client';
import { performanceTracker } from '../middlewares/performanceMonitoring';

// Create a Registry for our metrics
const metricsRegistry = new Registry();

// Define custom metrics
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [metricsRegistry],
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [metricsRegistry],
});

const httpRequestSize = new Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 500, 1000, 5000, 10000, 50000],
  registers: [metricsRegistry],
});

const httpResponseSize = new Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 500, 1000, 5000, 10000, 50000],
  registers: [metricsRegistry],
});

const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  registers: [metricsRegistry],
});

const databaseConnections = new Gauge({
  name: 'database_connections',
  help: 'Number of database connections',
  labelNames: ['pool'],
  registers: [metricsRegistry],
});

const cacheOperations = new Counter({
  name: 'cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation', 'status'],
  registers: [metricsRegistry],
});

const authenticationOperations = new Counter({
  name: 'authentication_operations_total',
  help: 'Total number of authentication operations',
  labelNames: ['operation', 'status'],
  registers: [metricsRegistry],
});

const businessOperations = new Counter({
  name: 'business_operations_total',
  help: 'Total number of business operations',
  labelNames: ['operation', 'status'],
  registers: [metricsRegistry],
});

const errorRate = new Gauge({
  name: 'error_rate',
  help: 'Error rate percentage',
  labelNames: ['type'],
  registers: [metricsRegistry],
});

// Application-specific metrics
const userRegistrations = new Counter({
  name: 'user_registrations_total',
  help: 'Total number of user registrations',
  registers: [metricsRegistry],
});

const userLogins = new Counter({
  name: 'user_logins_total',
  help: 'Total number of user logins',
  labelNames: ['method'],
  registers: [metricsRegistry],
});

const passwordChanges = new Counter({
  name: 'password_changes_total',
  help: 'Total number of password changes',
  registers: [metricsRegistry],
});

const emailVerifications = new Counter({
  name: 'email_verifications_total',
  help: 'Total number of email verifications',
  registers: [metricsRegistry],
});

// Middleware to track HTTP requests
export const prometheusMiddleware = (req: Request, res: Response, next: Function) => {
  const start = Date.now();

  // Increment total requests counter
  httpRequestsTotal.inc({
    method: req.method,
    route: req.route?.path || req.path,
    status_code: res.statusCode,
  });

  // Track active connections
  activeConnections.inc();

  // Track request size
  const requestSize = JSON.stringify(req.body).length || 0;
  httpRequestSize.observe(
    {
      method: req.method,
      route: req.route?.path || req.path,
    },
    requestSize
  );

  // Override res.end to track response metrics
  const originalEnd = res.end;
  res.end = function (this: Response, ...args: any[]) {
    const duration = (Date.now() - start) / 1000;

    // Record request duration
    httpRequestDuration.observe(
      {
        method: req.method,
        route: req.route?.path || req.path,
        status_code: res.statusCode,
      },
      duration
    );

    // Track response size
    const responseSize = args.length ? Buffer.byteLength(args[0]) : 0;
    httpResponseSize.observe(
      {
        method: req.method,
        route: req.route?.path || req.path,
        status_code: res.statusCode,
      },
      responseSize
    );

    // Decrement active connections
    activeConnections.dec();

    return originalEnd.apply(this, args);
  };

  next();
};

// Helper functions to track custom metrics
export const trackDatabaseConnection = (pool: string, active: number) => {
  databaseConnections.set({ pool }, active);
};

export const trackCacheOperation = (operation: string, status: 'hit' | 'miss' | 'error') => {
  cacheOperations.inc({ operation, status });
};

export const trackAuthenticationOperation = (operation: string, status: 'success' | 'failure') => {
  authenticationOperations.inc({ operation, status });
};

export const trackBusinessOperation = (operation: string, status: 'success' | 'failure') => {
  businessOperations.inc({ operation, status });
};

export const trackUserRegistration = (status: 'success' | 'failure') => {
  userRegistrations.inc({ status });
};

export const trackUserLogin = (method: string) => {
  userLogins.inc({ method: method });
};

export const trackPasswordChange = () => {
  passwordChanges.inc();
};

export const trackEmailVerification = (status: 'success' | 'failure') => {
  emailVerifications.inc({ status });
};

export const updateErrorRate = (type: string, totalRequests: number, errorCount: number) => {
  const rate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
  errorRate.set({ type }, rate);
};

// Health check metrics
export const collectHealthMetrics = async () => {
  const metrics = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    activeConnections: activeConnections.get(),
    databaseConnections: databaseConnections.get(),
  };

  return metrics;
};

// Metrics endpoint
export const metricsEndpoint = async (req: Request, res: Response) => {
  try {
    const metrics = await metricsRegistry.metrics();
    res.setHeader('Content-Type', metricsRegistry.contentType);
    res.send(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
};

// Health check endpoint
export const healthCheck = async (req: Request, res: Response) => {
  try {
    // Simple health check - just check if server is responsive
    const isHealthy = true;

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Performance metrics collector - simplified version
export const collectPerformanceMetrics = () => {
  // Return empty metrics array for now - this is a placeholder
  return [];
};

export default {
  register: metricsRegistry,
  httpRequestsTotal,
  httpRequestDuration,
  httpRequestSize,
  httpResponseSize,
  activeConnections,
  databaseConnections,
  cacheOperations,
  authenticationOperations,
  businessOperations,
  errorRate,
  userRegistrations,
  userLogins,
  passwordChanges,
  emailVerifications,
  prometheusMiddleware,
  metricsEndpoint,
  healthCheck,
  trackDatabaseConnection,
  trackCacheOperation,
  trackAuthenticationOperation,
  trackBusinessOperation,
  trackUserRegistration,
  trackUserLogin,
  trackPasswordChange,
  trackEmailVerification,
  updateErrorRate,
  collectHealthMetrics,
  collectPerformanceMetrics,
};
