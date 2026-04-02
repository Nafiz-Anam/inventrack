import httpStatus from 'http-status';
import prisma from '../client';
import ApiError from '../utils/ApiError';
import { AuditLog } from '@prisma/client';
import { Request } from 'express';

interface CreateAuditLogData {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  severity?: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  category?: 'SECURITY' | 'AUTH' | 'DATA' | 'SYSTEM' | 'GENERAL';
}

interface AuditLogFilters {
  userId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  severity?: string;
  category?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

/**
 * Audit Logging Service
 * Manages comprehensive audit trails for compliance and security
 */
class AuditLogService {
  /**
   * Create audit log entry
   */
  async createLog(data: CreateAuditLogData): Promise<AuditLog> {
    return await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        oldValues: data.oldValues,
        newValues: data.newValues,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        sessionId: data.sessionId,
        requestId: data.requestId,
        severity: data.severity || 'INFO',
        category: data.category || 'GENERAL',
      },
    });
  }

  /**
   * Create audit log from request context
   */
  async createLogFromRequest(
    req: Request,
    action: string,
    resource: string,
    resourceId?: string,
    oldValues?: any,
    newValues?: any,
    severity?: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL',
    category?: 'SECURITY' | 'AUTH' | 'DATA' | 'SYSTEM' | 'GENERAL'
  ): Promise<AuditLog> {
    const user = req.user as any;

    return await this.createLog({
      userId: user?.id,
      action,
      resource,
      resourceId,
      oldValues,
      newValues,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: (req as any).session?.id,
      requestId: (req as any).id,
      severity,
      category,
    });
  }

  /**
   * Get audit logs with filtering
   */
  async getLogs(filters: AuditLogFilters): Promise<{
    logs: AuditLog[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const {
      userId,
      action,
      resource,
      resourceId,
      severity,
      category,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = filters;

    const where: any = {};

    if (userId) where.userId = userId;
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (resource) where.resource = { contains: resource, mode: 'insensitive' };
    if (resourceId) where.resourceId = resourceId;
    if (severity) where.severity = severity;
    if (category) where.category = category;

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get audit log by ID
   */
  async getLogById(id: string): Promise<AuditLog | null> {
    return await prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Export audit logs to CSV
   */
  async exportLogs(filters: AuditLogFilters): Promise<string> {
    const { logs } = await this.getLogs({
      ...filters,
      limit: 10000, // Limit for export
      page: 1,
    });

    const headers = [
      'ID',
      'User Email',
      'User Name',
      'Action',
      'Resource',
      'Resource ID',
      'IP Address',
      'User Agent',
      'Session ID',
      'Request ID',
      'Severity',
      'Category',
      'Timestamp',
      'Old Values',
      'New Values',
    ];

    const csvRows = [
      headers.join(','),
      ...logs.map((log: any) =>
        [
          log.id,
          log.user?.email || '',
          log.user?.name || '',
          log.action,
          log.resource,
          log.resourceId || '',
          log.ipAddress || '',
          log.userAgent || '',
          log.sessionId || '',
          log.requestId || '',
          log.severity,
          log.category,
          log.timestamp.toISOString(),
          JSON.stringify(log.oldValues || {}),
          JSON.stringify(log.newValues || {}),
        ]
          .map(field => `"${String(field).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ];

    return csvRows.join('\n');
  }

  /**
   * Get audit log statistics
   */
  async getStatistics(filters?: { startDate?: Date; endDate?: Date; userId?: string }): Promise<{
    totalLogs: number;
    logsBySeverity: Record<string, number>;
    logsByCategory: Record<string, number>;
    logsByAction: Record<string, number>;
    logsByResource: Record<string, number>;
    recentActivity: AuditLog[];
  }> {
    const where: any = {};

    if (filters?.startDate || filters?.endDate) {
      where.timestamp = {};
      if (filters?.startDate) where.timestamp.gte = filters.startDate;
      if (filters?.endDate) where.timestamp.lte = filters.endDate;
    }

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    const [
      totalLogs,
      logsBySeverity,
      logsByCategory,
      logsByAction,
      logsByResource,
      recentActivity,
    ] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.groupBy({
        by: ['severity'],
        where,
        _count: { severity: true },
      }),
      prisma.auditLog.groupBy({
        by: ['category'],
        where,
        _count: { category: true },
      }),
      prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      }),
      prisma.auditLog.groupBy({
        by: ['resource'],
        where,
        _count: { resource: true },
        orderBy: { _count: { resource: 'desc' } },
        take: 10,
      }),
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 10,
      }),
    ]);

    return {
      totalLogs,
      logsBySeverity: logsBySeverity.reduce(
        (acc, item) => {
          acc[item.severity] = item._count.severity;
          return acc;
        },
        {} as Record<string, number>
      ),
      logsByCategory: logsByCategory.reduce(
        (acc, item) => {
          acc[item.category] = item._count.category;
          return acc;
        },
        {} as Record<string, number>
      ),
      logsByAction: logsByAction.reduce(
        (acc, item) => {
          acc[item.action] = item._count.action;
          return acc;
        },
        {} as Record<string, number>
      ),
      logsByResource: logsByResource.reduce(
        (acc, item) => {
          acc[item.resource] = item._count.resource;
          return acc;
        },
        {} as Record<string, number>
      ),
      recentActivity,
    };
  }

  /**
   * Cleanup old audit logs
   */
  async cleanupOldLogs(daysToKeep: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.auditLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
        severity: {
          not: 'CRITICAL', // Keep critical logs
        },
      },
    });

    return result.count;
  }

  /**
   * Get user's audit history
   */
  async getUserAuditHistory(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      action?: string;
      resource?: string;
    } = {}
  ): Promise<{
    logs: AuditLog[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20, action, resource } = options;

    const where: any = { userId };

    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (resource) where.resource = { contains: resource, mode: 'insensitive' };

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Search audit logs
   */
  async searchLogs(
    query: string,
    filters?: AuditLogFilters
  ): Promise<{
    logs: AuditLog[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 50 } = filters || {};

    const where: any = {
      OR: [
        { action: { contains: query, mode: 'insensitive' } },
        { resource: { contains: query, mode: 'insensitive' } },
        { resourceId: { contains: query, mode: 'insensitive' } },
        { user: { email: { contains: query, mode: 'insensitive' } } },
        { user: { name: { contains: query, mode: 'insensitive' } } },
      ],
    };

    // Apply additional filters
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.severity) where.severity = filters.severity;
    if (filters?.category) where.category = filters.category;
    if (filters?.startDate || filters?.endDate) {
      where.timestamp = {};
      if (filters?.startDate) where.timestamp.gte = filters.startDate;
      if (filters?.endDate) where.timestamp.lte = filters.endDate;
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export default AuditLogService;
