import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import {
  getUserSessions,
  getSessionBySessionId,
  revokeSession,
  revokeOtherSessions,
  revokeAllUserSessions,
  getSessionAnalytics,
  getSessionSecurityEvents,
  getUserSecurityEvents,
  resolveSecurityEvent,
  checkSuspiciousActivity,
  getSessionSecurityScore,
  cleanupExpiredSessions,
} from '../../controllers/sessionManagement.controller';

const router = express.Router();

// All routes require authentication
router.use(auth());

/**
 * @route GET /v1/sessions
 * @desc Get user's sessions
 * @access Private
 */
router.get('/', getUserSessions);

/**
 * @route GET /v1/sessions/:sessionId
 * @desc Get session by session ID
 * @access Private
 */
router.get('/:sessionId', getSessionBySessionId);

/**
 * @route DELETE /v1/sessions/:sessionId
 * @desc Revoke session
 * @access Private
 */
router.delete('/:sessionId', revokeSession);

/**
 * @route DELETE /v1/sessions/revoke-others
 * @desc Revoke all user sessions except current
 * @access Private
 */
router.delete('/revoke-others', revokeOtherSessions);

/**
 * @route DELETE /v1/sessions/revoke-all
 * @desc Revoke all user sessions
 * @access Private
 */
router.delete('/revoke-all', revokeAllUserSessions);

/**
 * @route GET /v1/sessions/analytics
 * @desc Get session analytics
 * @access Private (Admin only)
 */
router.get('/analytics', getSessionAnalytics);

/**
 * @route GET /v1/sessions/:sessionId/security-events
 * @desc Get session security events
 * @access Private
 */
router.get('/:sessionId/security-events', getSessionSecurityEvents);

/**
 * @route GET /v1/sessions/security-events
 * @desc Get user's security events
 * @access Private
 */
router.get('/security-events', getUserSecurityEvents);

/**
 * @route PUT /v1/sessions/security-events/:eventId/resolve
 * @desc Resolve security event
 * @access Private (Admin only)
 */
router.put('/security-events/:eventId/resolve', resolveSecurityEvent);

/**
 * @route GET /v1/sessions/check-suspicious/:userId
 * @desc Check for suspicious activity
 * @access Private (Admin only)
 */
router.get('/check-suspicious/:userId', checkSuspiciousActivity);

/**
 * @route GET /v1/sessions/:sessionId/security-score
 * @desc Get session security score
 * @access Private
 */
router.get('/:sessionId/security-score', getSessionSecurityScore);

/**
 * @route DELETE /v1/sessions/cleanup-expired
 * @desc Cleanup expired sessions
 * @access Private (Admin only)
 */
router.delete('/cleanup-expired', cleanupExpiredSessions);

export default router;
