import { Request } from 'express';
import { User, SecurityEventType } from '@prisma/client';
import prisma from '../client';
import logger from '../config/logger';

export enum SecurityCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  ACCOUNT_MANAGEMENT = 'account_management',
  PASSWORD_SECURITY = 'password_security',
  DEVICE_MANAGEMENT = 'device_management',
  RATE_LIMITING = 'rate_limiting',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  DATA_ACCESS = 'data_access',
  SYSTEM_SECURITY = 'system_security',
}

export enum SecuritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

interface EnhancedSecurityEventData {
  userId?: string;
  email?: string;
  ipAddress: string;
  userAgent: string;
  category: SecurityCategory;
  severity: SecuritySeverity;
  eventType: SecurityEventType;
  details?: Record<string, any>;
  success: boolean;
  sessionId?: string;
  deviceId?: string;
  requestId?: string;
  timestamp?: Date;
  riskScore?: number;
  relatedEntityId?: string;
  relatedEntityType?: string;
}

interface SecurityMetrics {
  totalEvents: number;
  eventsByCategory: Record<SecurityCategory, number>;
  eventsBySeverity: Record<SecuritySeverity, number>;
  eventsByType: Record<SecurityEventType, number>;
  failedAttempts: number;
  suspiciousActivities: number;
  averageRiskScore: number;
  topRiskFactors: Array<{ factor: string; count: number }>;
}

class EnhancedSecurityLoggingService {
  private static instance: EnhancedSecurityLoggingService;
  private metricsCache: Map<string, SecurityMetrics> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  static getInstance(): EnhancedSecurityLoggingService {
    if (!EnhancedSecurityLoggingService.instance) {
      EnhancedSecurityLoggingService.instance = new EnhancedSecurityLoggingService();
    }
    return EnhancedSecurityLoggingService.instance;
  }

  /**
   * Get security category and severity based on event type and context
   */
  private categorizeEvent(
    eventType: SecurityEventType,
    details: Record<string, any> = {},
    success: boolean
  ): { category: SecurityCategory; severity: SecuritySeverity; riskScore: number } {
    // Default categorization
    let category: SecurityCategory;
    let severity: SecuritySeverity;
    let riskScore: number;

    switch (eventType) {
      case SecurityEventType.LOGIN_SUCCESS:
        category = SecurityCategory.AUTHENTICATION;
        severity = SecuritySeverity.LOW;
        riskScore = success ? 1 : 0;
        break;

      case SecurityEventType.LOGIN_FAILED:
        category = SecurityCategory.AUTHENTICATION;
        severity = SecuritySeverity.MEDIUM;
        riskScore = 3;
        break;

      case SecurityEventType.ACCOUNT_LOCKED:
        category = SecurityCategory.AUTHENTICATION;
        severity = SecuritySeverity.HIGH;
        riskScore = 7;
        break;

      case SecurityEventType.PASSWORD_CHANGE:
        category = SecurityCategory.PASSWORD_SECURITY;
        severity = SecuritySeverity.MEDIUM;
        riskScore = success ? 2 : 5;
        break;

      case SecurityEventType.PASSWORD_RESET_COMPLETED:
        category = SecurityCategory.PASSWORD_SECURITY;
        severity = SecuritySeverity.MEDIUM;
        riskScore = 3;
        break;

      case SecurityEventType.TWO_FACTOR_ENABLED:
      case SecurityEventType.TWO_FACTOR_DISABLED:
        category = SecurityCategory.ACCOUNT_MANAGEMENT;
        severity = SecuritySeverity.MEDIUM;
        riskScore = 4;
        break;

      case SecurityEventType.TWO_FACTOR_VERIFIED:
        category = SecurityCategory.AUTHENTICATION;
        severity = SecuritySeverity.HIGH;
        riskScore = 6;
        break;

      case SecurityEventType.SUSPICIOUS_ACTIVITY:
        category = SecurityCategory.SUSPICIOUS_ACTIVITY;
        severity = SecuritySeverity.HIGH;
        riskScore = 9;
        break;

      case SecurityEventType.SESSION_CREATED:
        category = SecurityCategory.DEVICE_MANAGEMENT;
        severity = SecuritySeverity.MEDIUM;
        riskScore = 4;
        break;

      case SecurityEventType.RATE_LIMIT_EXCEEDED:
        category = SecurityCategory.RATE_LIMITING;
        severity = SecuritySeverity.MEDIUM;
        riskScore = 5;
        break;

      default:
        category = SecurityCategory.SYSTEM_SECURITY;
        severity = SecuritySeverity.LOW;
        riskScore = 1;
    }

    // Adjust risk score based on additional context
    if (details.failedAttempts && details.failedAttempts > 5) {
      riskScore += 2;
      severity = SecuritySeverity.HIGH;
    }

    if (details.unusualLocation || details.unusualDevice) {
      riskScore += 3;
      severity = SecuritySeverity.HIGH;
    }

    if (details.penaltyLevel && details.penaltyLevel > 3) {
      riskScore += details.penaltyLevel;
      severity = SecuritySeverity.CRITICAL;
    }

    return { category, severity, riskScore };
  }

  /**
   * Log enhanced security event
   */
  async logSecurityEvent(data: EnhancedSecurityEventData): Promise<void> {
    try {
      const { category, severity, riskScore } = this.categorizeEvent(
        data.eventType,
        data.details || {},
        data.success
      );

      const enhancedData = {
        ...data,
        category,
        severity,
        riskScore,
        timestamp: data.timestamp || new Date(),
        requestId: data.requestId || this.generateRequestId(),
      };

      // Log to database with enhanced fields
      await prisma.securityLog.create({
        data: {
          userId: enhancedData.userId,
          email: enhancedData.email,
          ipAddress: enhancedData.ipAddress,
          userAgent: enhancedData.userAgent,
          eventType: enhancedData.eventType,
          details: {
            ...enhancedData.details,
            category: enhancedData.category,
            severity: enhancedData.severity,
            riskScore: enhancedData.riskScore,
            sessionId: enhancedData.sessionId,
            deviceId: enhancedData.deviceId,
            requestId: enhancedData.requestId,
            relatedEntityId: enhancedData.relatedEntityId,
            relatedEntityType: enhancedData.relatedEntityType,
          },
          success: enhancedData.success,
        },
      });

      // Enhanced application logging
      this.logToApplication(enhancedData);

      // Update metrics cache
      this.updateMetricsCache(enhancedData);

      // Trigger alerts for high-risk events
      if (enhancedData.riskScore >= 7) {
        await this.triggerSecurityAlert(enhancedData);
      }
    } catch (error) {
      logger.error('Enhanced security logging failed', { error, data });
    }
  }

  /**
   * Log to application with structured format
   */
  private logToApplication(data: EnhancedSecurityEventData): void {
    const logLevel = this.getLogLevel(data.severity);

    logger[logLevel]('Security Event', {
      category: data.category,
      severity: data.severity,
      eventType: data.eventType,
      riskScore: data.riskScore,
      userId: data.userId,
      email: data.email,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      success: data.success,
      requestId: data.requestId,
      details: data.details,
    });
  }

  /**
   * Get appropriate log level based on severity
   */
  private getLogLevel(severity: SecuritySeverity): 'info' | 'warn' | 'error' {
    switch (severity) {
      case SecuritySeverity.CRITICAL:
      case SecuritySeverity.HIGH:
        return 'error';
      case SecuritySeverity.MEDIUM:
        return 'warn';
      case SecuritySeverity.LOW:
      default:
        return 'info';
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update metrics cache
   */
  private updateMetricsCache(data: EnhancedSecurityEventData): void {
    const cacheKey = 'security_metrics';
    const cached = this.metricsCache.get(cacheKey) || {
      totalEvents: 0,
      eventsByCategory: {} as Record<SecurityCategory, number>,
      eventsBySeverity: {} as Record<SecuritySeverity, number>,
      eventsByType: {} as Record<SecurityEventType, number>,
      failedAttempts: 0,
      suspiciousActivities: 0,
      averageRiskScore: 0,
      topRiskFactors: [],
    };

    // Update counters
    cached.totalEvents += 1;
    cached.eventsByCategory[data.category] = (cached.eventsByCategory[data.category] || 0) + 1;
    cached.eventsBySeverity[data.severity] = (cached.eventsBySeverity[data.severity] || 0) + 1;
    cached.eventsByType[data.eventType] = (cached.eventsByType[data.eventType] || 0) + 1;

    if (!data.success) {
      cached.failedAttempts += 1;
    }

    if (data.category === SecurityCategory.SUSPICIOUS_ACTIVITY) {
      cached.suspiciousActivities += 1;
    }

    // Update average risk score
    const totalRiskScore = cached.averageRiskScore * (cached.totalEvents - 1) + data.riskScore;
    cached.averageRiskScore = totalRiskScore / cached.totalEvents;

    this.metricsCache.set(cacheKey, cached);
  }

  /**
   * Trigger security alert for high-risk events
   */
  private async triggerSecurityAlert(data: EnhancedSecurityEventData): Promise<void> {
    logger.error('SECURITY ALERT', {
      alert: 'High-risk security event detected',
      category: data.category,
      severity: data.severity,
      riskScore: data.riskScore,
      eventType: data.eventType,
      userId: data.userId,
      email: data.email,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      timestamp: data.timestamp,
      requestId: data.requestId,
      details: data.details,
    });

    // Here you could integrate with external alerting systems
    // - Send email/SMS notifications
    // - Push to Slack/Discord
    // - Create incident in monitoring system
    // - Trigger automated responses
  }

  /**
   * Get security metrics
   */
  async getSecurityMetrics(timeRange?: { start: Date; end: Date }): Promise<SecurityMetrics> {
    const cacheKey = timeRange
      ? `security_metrics_${timeRange.start.getTime()}_${timeRange.end.getTime()}`
      : 'security_metrics';

    // Check cache first
    const cached = this.metricsCache.get(cacheKey);
    if (cached && !timeRange) {
      return cached;
    }

    try {
      const whereClause = timeRange
        ? {
            timestamp: {
              gte: timeRange.start,
              lte: timeRange.end,
            },
          }
        : {};

      const events = await prisma.securityLog.findMany({
        where: whereClause,
        select: {
          eventType: true,
          details: true,
          success: true,
        },
      });

      const metrics: SecurityMetrics = {
        totalEvents: events.length,
        eventsByCategory: {} as Record<SecurityCategory, number>,
        eventsBySeverity: {} as Record<SecuritySeverity, number>,
        eventsByType: {} as Record<SecurityEventType, number>,
        failedAttempts: 0,
        suspiciousActivities: 0,
        averageRiskScore: 0,
        topRiskFactors: [],
      };

      let totalRiskScore = 0;
      const riskFactors: Record<string, number> = {};

      events.forEach(event => {
        const details = event.details as any;
        const category = details.category as SecurityCategory;
        const severity = details.severity as SecuritySeverity;
        const riskScore = details.riskScore || 1;

        // Count by category
        metrics.eventsByCategory[category] = (metrics.eventsByCategory[category] || 0) + 1;
        // Count by severity
        metrics.eventsBySeverity[severity] = (metrics.eventsBySeverity[severity] || 0) + 1;
        // Count by type
        metrics.eventsByType[event.eventType] = (metrics.eventsByType[event.eventType] || 0) + 1;

        // Count failures
        if (!event.success) {
          metrics.failedAttempts += 1;
        }

        // Count suspicious activities
        if (category === SecurityCategory.SUSPICIOUS_ACTIVITY) {
          metrics.suspiciousActivities += 1;
        }

        // Accumulate risk score
        totalRiskScore += riskScore;

        // Track risk factors
        if (details.penaltyLevel) {
          riskFactors[`penalty_level_${details.penaltyLevel}`] =
            (riskFactors[`penalty_level_${details.penaltyLevel}`] || 0) + 1;
        }
        if (details.failedAttempts) {
          riskFactors[`failed_attempts_${details.failedAttempts}`] =
            (riskFactors[`failed_attempts_${details.failedAttempts}`] || 0) + 1;
        }
      });

      metrics.averageRiskScore = events.length > 0 ? totalRiskScore / events.length : 0;

      // Get top risk factors
      metrics.topRiskFactors = Object.entries(riskFactors)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([factor, count]) => ({ factor, count }));

      // Cache if not time-range specific
      if (!timeRange) {
        this.metricsCache.set(cacheKey, metrics);
      }

      return metrics;
    } catch (error) {
      logger.error('Failed to get security metrics', { error });
      throw error;
    }
  }

  /**
   * Get security events for a specific user
   */
  async getUserSecurityEvents(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    return prisma.securityLog.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Clear metrics cache
   */
  clearMetricsCache(): void {
    this.metricsCache.clear();
  }
}

export default EnhancedSecurityLoggingService.getInstance();
