import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import {
  getAuditLogs,
  getAuditLogById,
  getAuditLogStatistics,
  exportAuditLogs,
  getUserAuditHistory,
  searchAuditLogs,
  cleanupOldAuditLogs,
} from '../../controllers/auditLog.controller';

const router = express.Router();

// All routes require authentication
router.use(auth());

/**
 * @route GET /v1/audit-logs
 * @desc Get audit logs with filtering
 * @access Private (Admin only)
 */
router.get('/', getAuditLogs);

/**
 * @route GET /v1/audit-logs/:logId
 * @desc Get audit log by ID
 * @access Private (Admin only)
 */
router.get('/:logId', getAuditLogById);

/**
 * @route GET /v1/audit-logs/statistics
 * @desc Get audit log statistics
 * @access Private (Admin only)
 */
router.get('/statistics', getAuditLogStatistics);

/**
 * @route GET /v1/audit-logs/export
 * @desc Export audit logs to CSV
 * @access Private (Admin only)
 */
router.get('/export', exportAuditLogs);

/**
 * @route GET /v1/audit-logs/users/:userId
 * @desc Get user's audit history
 * @access Private (Admin or self)
 */
router.get('/users/:userId', getUserAuditHistory);

/**
 * @route GET /v1/audit-logs/search
 * @desc Search audit logs
 * @access Private (Admin only)
 */
router.get('/search', searchAuditLogs);

/**
 * @route DELETE /v1/audit-logs/cleanup
 * @desc Cleanup old audit logs
 * @access Private (Admin only)
 */
router.delete('/cleanup', cleanupOldAuditLogs);

export default router;
