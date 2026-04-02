import logger from '../config/logger';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  endpoint?: string;
  [key: string]: any;
}

export interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  context?: LogContext;
  error?: Error;
  timestamp: string;
  service: string;
  version?: string;
}

class StructuredLogger {
  private serviceName: string;
  private version: string;

  constructor(serviceName = 'api-server', version = '1.0.0') {
    this.serviceName = serviceName;
    this.version = version;
  }

  private createLogEntry(
    level: LogEntry['level'],
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    return {
      level,
      message,
      context: {
        ...context,
        timestamp: new Date().toISOString(),
        service: this.serviceName,
        version: this.version,
      },
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      version: this.version,
    };
  }

  info(message: string, context?: LogContext): void {
    const entry = this.createLogEntry('info', message, context);
    logger.info(message, entry);
  }

  warn(message: string, context?: LogContext): void {
    const entry = this.createLogEntry('warn', message, context);
    logger.warn(message, entry);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const entry = this.createLogEntry('error', message, context, error);
    logger.error(message, entry);
  }

  debug(message: string, context?: LogContext): void {
    const entry = this.createLogEntry('debug', message, context);
    logger.debug(message, entry);
  }

  // Request logging
  logRequest(req: Request): void {
    const context: LogContext = {
      requestId: (req as any).requestId,
      userId: (req.user as any)?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      method: req.method,
      url: req.url,
      endpoint: `${req.method} ${req.url}`,
    };

    this.info('Request started', context);
  }

  logResponse(req: Request, res: Response, startTime: number): void {
    const responseTime = Date.now() - startTime;
    const context: LogContext = {
      requestId: (req as any).requestId,
      userId: (req.user as any)?.id,
      statusCode: res.statusCode,
      responseTime,
      method: req.method,
      url: req.url,
      endpoint: `${req.method} ${req.url}`,
    };

    const message = `Request completed (${res.statusCode}) - ${responseTime}ms`;

    if (res.statusCode >= 400) {
      this.warn(message, context);
    } else {
      this.info(message, context);
    }
  }

  // Authentication events
  logAuthEvent(event: string, userId: string, context?: Partial<LogContext>): void {
    this.info(`Auth: ${event}`, {
      userId,
      ...context,
    });
  }

  logSecurityEvent(event: string, context: LogContext): void {
    this.warn(`Security: ${event}`, context);
  }

  // Business events
  logBusinessEvent(event: string, context: LogContext): void {
    this.info(`Business: ${event}`, context);
  }

  // Performance events
  logPerformanceEvent(event: string, context: LogContext): void {
    this.info(`Performance: ${event}`, context);
  }

  // Database events
  logDatabaseEvent(event: string, context: LogContext): void {
    this.debug(`Database: ${event}`, context);
  }

  // Cache events
  logCacheEvent(event: string, context: LogContext): void {
    this.debug(`Cache: ${event}`, context);
  }

  // External service events
  logExternalServiceEvent(service: string, event: string, context: LogContext): void {
    this.info(`External[${service}]: ${event}`, context);
  }

  // Error events with context
  logErrorEvent(error: Error, context: LogContext): void {
    this.error(error.message, error, {
      ...context,
      errorName: error.name,
      errorStack: error.stack,
    });
  }
}

// Create singleton instance
const structuredLogger = new StructuredLogger();

export default structuredLogger;

// Middleware for automatic request/response logging
export const requestLogger = (req: Request, res: Response, next: Function) => {
  const startTime = Date.now();

  // Log request
  structuredLogger.logRequest(req);

  // Store original end function
  const originalEnd = res.end;

  // Override res.end to log response
  res.end = function (chunk?: any, encoding?: any, cb?: any) {
    structuredLogger.logResponse(req, res, startTime);
    return originalEnd.call(this, chunk, encoding, cb);
  } as any;

  next();
};

// Request context helper
export const createRequestContext = (req: Request): LogContext => {
  return {
    requestId: (req as any).requestId,
    userId: (req.user as any)?.id,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    method: req.method,
    url: req.url,
    endpoint: `${req.method} ${req.url}`,
  };
};

// Error context helper
export const createErrorContext = (req: Request, error: Error): LogContext => {
  return {
    ...createRequestContext(req),
    errorName: error.name,
    errorMessage: error.message,
    errorStack: error.stack,
  };
};
