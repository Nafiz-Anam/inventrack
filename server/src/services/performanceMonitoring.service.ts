import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

interface PerformanceMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: Date;
  userId?: string;
  ipAddress: string;
  userAgent: string;
  memoryUsage?: number;
  cpuUsage?: number;
  error?: string;
}

interface EndpointStats {
  endpoint: string;
  method: string;
  totalRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  errorRate: number;
  requestsPerMinute: number;
  lastAccessed: Date;
}

class PerformanceMonitoringService {
  private static instance: PerformanceMonitoringService;
  private metrics: PerformanceMetrics[] = [];
  private endpointStats: Map<string, EndpointStats> = new Map();
  private readonly MAX_METRICS = 10000; // Keep last 10k metrics
  private readonly STATS_UPDATE_INTERVAL = 60000; // Update stats every minute

  static getInstance(): PerformanceMonitoringService {
    if (!PerformanceMonitoringService.instance) {
      PerformanceMonitoringService.instance = new PerformanceMonitoringService();
    }
    return PerformanceMonitoringService.instance;
  }

  constructor() {
    // Start periodic stats update
    setInterval(() => {
      this.updateEndpointStats();
    }, this.STATS_UPDATE_INTERVAL);
  }

  /**
   * Middleware to track performance of requests
   */
  trackPerformance() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const startMemory = process.memoryUsage();

      // Override res.end to capture response time
      const originalEnd = res.end;
      res.end = function (this: Response, ...args: any[]) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        const endMemory = process.memoryUsage();

        // Get system resource usage
        const memoryUsage = endMemory.heapUsed;
        const cpuUsage = process.cpuUsage().user;

        const metric: PerformanceMetrics = {
          endpoint: req.path,
          method: req.method,
          responseTime,
          statusCode: res.statusCode,
          timestamp: new Date(),
          userId: (req as any).user?.id,
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.get('User-Agent') || 'Unknown',
          memoryUsage,
          cpuUsage,
          error: res.statusCode >= 400 ? res.statusMessage : undefined,
        };

        // Store metric
        PerformanceMonitoringService.getInstance().addMetric(metric);

        // Log slow requests
        if (responseTime > 1000) {
          logger.warn('Slow request detected', {
            endpoint: req.path,
            method: req.method,
            responseTime,
            statusCode: res.statusCode,
            userId: (req as any).user?.id,
          });
        }

        // Log errors
        if (res.statusCode >= 500) {
          logger.error('Server error', {
            endpoint: req.path,
            method: req.method,
            responseTime,
            statusCode: res.statusCode,
            error: res.statusMessage,
            userId: (req as any).user?.id,
          });
        }

        return originalEnd.apply(this, args);
      };

      next();
    };
  }

  /**
   * Add a performance metric
   */
  private addMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);

    // Keep only the latest metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }
  }

  /**
   * Update endpoint statistics
   */
  private updateEndpointStats(): void {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);

    // Group metrics by endpoint
    const endpointGroups = new Map<string, PerformanceMetrics[]>();

    this.metrics.forEach(metric => {
      if (metric.timestamp >= oneMinuteAgo) {
        const key = `${metric.method}:${metric.endpoint}`;
        const group = endpointGroups.get(key) || [];
        group.push(metric);
        endpointGroups.set(key, group);
      }
    });

    // Update stats for each endpoint
    endpointGroups.forEach((metrics, key) => {
      const [method, endpoint] = key.split(':');
      const totalRequests = metrics.length;
      const responseTimes = metrics.map(m => m.responseTime);
      const errors = metrics.filter(m => m.statusCode >= 400);
      const errorRate = (errors.length / totalRequests) * 100;

      const stats: EndpointStats = {
        endpoint,
        method,
        totalRequests,
        averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        minResponseTime: Math.min(...responseTimes),
        maxResponseTime: Math.max(...responseTimes),
        errorRate,
        requestsPerMinute: totalRequests,
        lastAccessed: new Date(Math.max(...metrics.map(m => m.timestamp.getTime()))),
      };

      this.endpointStats.set(key, stats);
    });

    // Clean up old stats
    this.cleanupOldStats();
  }

  /**
   * Clean up old endpoint statistics
   */
  private cleanupOldStats(): void {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000);

    for (const [key, stats] of this.endpointStats.entries()) {
      if (stats.lastAccessed < fiveMinutesAgo) {
        this.endpointStats.delete(key);
      }
    }
  }

  /**
   * Get performance statistics for all endpoints
   */
  getEndpointStats(): Map<string, EndpointStats> {
    return new Map(this.endpointStats);
  }

  /**
   * Get performance statistics for a specific endpoint
   */
  getSpecificEndpointStats(endpoint: string, method: string): EndpointStats | undefined {
    const key = `${method}:${endpoint}`;
    return this.endpointStats.get(key);
  }

  /**
   * Get recent performance metrics
   */
  getRecentMetrics(limit: number = 100): PerformanceMetrics[] {
    return this.metrics.slice(-limit);
  }

  /**
   * Get performance metrics for a specific endpoint
   */
  getEndpointMetrics(endpoint: string, method: string, limit: number = 100): PerformanceMetrics[] {
    return this.metrics.filter(m => m.endpoint === endpoint && m.method === method).slice(-limit);
  }

  /**
   * Get system performance overview
   */
  getSystemPerformance(): {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    uptime: number;
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    slowestEndpoints: Array<{
      endpoint: string;
      method: string;
      avgResponseTime: number;
    }>;
  } {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();

    const recentMetrics = this.getRecentMetrics(1000);
    const totalRequests = recentMetrics.length;
    const responseTimes = recentMetrics.map(m => m.responseTime);
    const errors = recentMetrics.filter(m => m.statusCode >= 400);

    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

    const errorRate = totalRequests > 0 ? (errors.length / totalRequests) * 100 : 0;

    // Get slowest endpoints
    const endpointAverages = new Map<string, { count: number; totalTime: number }>();
    recentMetrics.forEach(metric => {
      const key = `${metric.method}:${metric.endpoint}`;
      const current = endpointAverages.get(key) || { count: 0, totalTime: 0 };
      current.count++;
      current.totalTime += metric.responseTime;
      endpointAverages.set(key, current);
    });

    const slowestEndpoints = Array.from(endpointAverages.entries())
      .map(([key, data]) => ({
        endpoint: key.split(':')[1],
        method: key.split(':')[0],
        avgResponseTime: data.totalTime / data.count,
      }))
      .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
      .slice(0, 10);

    return {
      memoryUsage,
      cpuUsage,
      uptime,
      totalRequests,
      averageResponseTime,
      errorRate,
      slowestEndpoints,
    };
  }

  /**
   * Get performance alerts
   */
  getPerformanceAlerts(): Array<{
    type: 'slow_endpoint' | 'high_error_rate' | 'memory_usage' | 'response_time_spike';
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    details: any;
  }> {
    const alerts = [];
    const systemPerf = this.getSystemPerformance();

    // Memory usage alert
    const memoryUsagePercent =
      (systemPerf.memoryUsage.heapUsed / systemPerf.memoryUsage.heapTotal) * 100;
    if (memoryUsagePercent > 90) {
      alerts.push({
        type: 'memory_usage' as const,
        message: `High memory usage: ${memoryUsagePercent.toFixed(2)}%`,
        severity: 'critical' as const,
        details: { memoryUsage: systemPerf.memoryUsage },
      });
    } else if (memoryUsagePercent > 80) {
      alerts.push({
        type: 'memory_usage' as const,
        message: `Elevated memory usage: ${memoryUsagePercent.toFixed(2)}%`,
        severity: 'high' as const,
        details: { memoryUsage: systemPerf.memoryUsage },
      });
    }

    // Error rate alert
    if (systemPerf.errorRate > 10) {
      alerts.push({
        type: 'high_error_rate' as const,
        message: `High error rate: ${systemPerf.errorRate.toFixed(2)}%`,
        severity: 'critical' as const,
        details: { errorRate: systemPerf.errorRate },
      });
    } else if (systemPerf.errorRate > 5) {
      alerts.push({
        type: 'high_error_rate' as const,
        message: `Elevated error rate: ${systemPerf.errorRate.toFixed(2)}%`,
        severity: 'high' as const,
        details: { errorRate: systemPerf.errorRate },
      });
    }

    // Slow endpoints alert
    systemPerf.slowestEndpoints.forEach(endpoint => {
      if (endpoint.avgResponseTime > 5000) {
        alerts.push({
          type: 'slow_endpoint' as const,
          message: `Very slow endpoint: ${endpoint.method} ${endpoint.endpoint} (${endpoint.avgResponseTime.toFixed(0)}ms)`,
          severity: 'critical' as const,
          details: endpoint,
        });
      } else if (endpoint.avgResponseTime > 2000) {
        alerts.push({
          type: 'slow_endpoint' as const,
          message: `Slow endpoint: ${endpoint.method} ${endpoint.endpoint} (${endpoint.avgResponseTime.toFixed(0)}ms)`,
          severity: 'high' as const,
          details: endpoint,
        });
      }
    });

    return alerts;
  }

  /**
   * Clear all metrics and stats
   */
  clearAll(): void {
    this.metrics = [];
    this.endpointStats.clear();
  }
}

export default PerformanceMonitoringService.getInstance();
