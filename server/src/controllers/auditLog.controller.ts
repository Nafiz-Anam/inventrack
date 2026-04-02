import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import { sendSuccess, sendError, ErrorCode } from '../utils/apiResponse';
import { Request, Response } from 'express';
import AuditLogService from '../services/auditLog.service';

const auditLogService = new AuditLogService();

/**
 * Get audit logs with filtering
 * @route GET /v1/audit-logs
 * @access Private (Admin only)
 */
const getAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const filters = {
    userId: req.query.userId as string,
    action: req.query.action as string,
    resource: req.query.resource as string,
    resourceId: req.query.resourceId as string,
    severity: req.query.severity as string,
    category: req.query.category as string,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    page: req.query.page ? parseInt(req.query.page as string) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
  };

  try {
    const result = await auditLogService.getLogs(filters);

    return sendSuccess(res, result, 'Audit logs retrieved successfully');
  } catch (error) {
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to retrieve audit logs');
  }
});

/**
 * Get audit log by ID
 * @route GET /v1/audit-logs/:logId
 * @access Private (Admin only)
 */
const getAuditLogById = catchAsync(async (req: Request, res: Response) => {
  const { logId } = req.params;

  try {
    const log = await auditLogService.getLogById(logId as string);

    if (!log) {
      return sendError(res, ErrorCode.NOT_FOUND, 'Audit log not found');
    }

    return sendSuccess(res, { log }, 'Audit log retrieved successfully');
  } catch (error) {
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to retrieve audit log');
  }
});

/**
 * Get audit log statistics
 * @route GET /v1/audit-logs/statistics
 * @access Private (Admin only)
 */
const getAuditLogStatistics = catchAsync(async (req: Request, res: Response) => {
  const filters = {
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    userId: req.query.userId as string,
  };

  try {
    const statistics = await auditLogService.getStatistics(filters);

    return sendSuccess(res, statistics, 'Audit log statistics retrieved successfully');
  } catch (error) {
    return sendError(
      res,
      ErrorCode.INTERNAL_SERVER_ERROR,
      'Failed to retrieve audit log statistics'
    );
  }
});

/**
 * Export audit logs to CSV
 * @route GET /v1/audit-logs/export
 * @access Private (Admin only)
 */
const exportAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const filters = {
    userId: req.query.userId as string,
    action: req.query.action as string,
    resource: req.query.resource as string,
    resourceId: req.query.resourceId as string,
    severity: req.query.severity as string,
    category: req.query.category as string,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
  };

  try {
    const csvData = await auditLogService.exportLogs(filters);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
    res.send(csvData);
  } catch (error) {
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to export audit logs');
  }
});

/**
 * Get user's audit history
 * @route GET /v1/audit-logs/users/:userId
 * @access Private (Admin or self)
 */
const getUserAuditHistory = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const currentUserId = (req.user as any)?.id;
  const currentUserRole = (req.user as any)?.role;

  // Users can only view their own audit history unless they're admin
  if (userId !== currentUserId && currentUserRole !== 'ADMIN') {
    return sendError(res, ErrorCode.FORBIDDEN, 'Insufficient permissions');
  }

  const options = {
    page: req.query.page ? parseInt(req.query.page as string) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    action: req.query.action as string,
    resource: req.query.resource as string,
  };

  try {
    const result = await auditLogService.getUserAuditHistory(userId as string, options);

    return sendSuccess(res, result, 'User audit history retrieved successfully');
  } catch (error) {
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to retrieve user audit history');
  }
});

/**
 * Search audit logs
 * @route GET /v1/audit-logs/search
 * @access Private (Admin only)
 */
const searchAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const { query } = req.query;

  if (!query || typeof query !== 'string') {
    return sendError(res, ErrorCode.INVALID_INPUT, 'Search query is required');
  }

  const filters = {
    userId: req.query.userId as string,
    action: req.query.action as string,
    resource: req.query.resource as string,
    resourceId: req.query.resourceId as string,
    severity: req.query.severity as string,
    category: req.query.category as string,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    page: req.query.page ? parseInt(req.query.page as string) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
  };

  try {
    const result = await auditLogService.searchLogs(query as string, filters);

    return sendSuccess(res, result, 'Audit logs search completed');
  } catch (error) {
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to search audit logs');
  }
});

/**
 * Cleanup old audit logs
 * @route DELETE /v1/audit-logs/cleanup
 * @access Private (Admin only)
 */
const cleanupOldAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const { daysToKeep } = req.body;

  try {
    const count = await auditLogService.cleanupOldLogs(daysToKeep || 365);

    return sendSuccess(res, { deletedCount: count }, 'Old audit logs cleaned up successfully');
  } catch (error) {
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to cleanup old audit logs');
  }
});

export {
  getAuditLogs,
  getAuditLogById,
  getAuditLogStatistics,
  exportAuditLogs,
  getUserAuditHistory,
  searchAuditLogs,
  cleanupOldAuditLogs,
};
