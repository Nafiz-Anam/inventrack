import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import { sendSuccess, sendError, ErrorCode } from '../utils/apiResponse';
import { Request, Response } from 'express';
import SessionManagementService from '../services/sessionManagement.service';

const sessionManagementService = new SessionManagementService();

/**
 * Get user's sessions
 * @route GET /v1/sessions
 * @access Private
 */
const getUserSessions = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const filters = {
    isActive: req.query.isActive === 'true',
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    page: req.query.page ? parseInt(req.query.page as string) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
  };

  try {
    const result = await sessionManagementService.getUserSessions(userId, filters);

    return sendSuccess(res, result, 'User sessions retrieved successfully');
  } catch (error) {
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to retrieve user sessions');
  }
});

/**
 * Get session by session ID
 * @route GET /v1/sessions/:sessionId
 * @access Private
 */
const getSessionBySessionId = catchAsync(async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  try {
    const session = await sessionManagementService.getSessionBySessionId(sessionId as string);

    if (!session) {
      return sendError(res, ErrorCode.NOT_FOUND, 'Session not found');
    }

    // Users can only view their own sessions unless they're admin
    const currentUserId = (req.user as any)?.id;
    const currentUserRole = (req.user as any)?.role;

    if (session.userId !== currentUserId && currentUserRole !== 'ADMIN') {
      return sendError(res, ErrorCode.FORBIDDEN, 'Insufficient permissions');
    }

    return sendSuccess(res, { session }, 'Session retrieved successfully');
  } catch (error) {
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to retrieve session');
  }
});

/**
 * Revoke session
 * @route DELETE /v1/sessions/:sessionId
 * @access Private
 */
const revokeSession = catchAsync(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const currentUserId = (req.user as any)?.id;

  try {
    // First get the session to check ownership
    const session = await sessionManagementService.getSessionBySessionId(sessionId as string);

    if (!session) {
      return sendError(res, ErrorCode.NOT_FOUND, 'Session not found');
    }

    // Users can only revoke their own sessions unless they're admin
    const currentUserRole = (req.user as any)?.role;

    if (session.userId !== currentUserId && currentUserRole !== 'ADMIN') {
      return sendError(res, ErrorCode.FORBIDDEN, 'Insufficient permissions');
    }

    await sessionManagementService.revokeSession(sessionId as string);

    return sendSuccess(res, null, 'Session revoked successfully');
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return sendError(res, ErrorCode.NOT_FOUND, error.message);
    }
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to revoke session');
  }
});

/**
 * Revoke all user sessions except current
 * @route DELETE /v1/sessions/revoke-others
 * @access Private
 */
const revokeOtherSessions = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const currentSessionId = req.body.currentSessionId;

  if (!currentSessionId) {
    return sendError(res, ErrorCode.INVALID_INPUT, 'Current session ID is required');
  }

  try {
    const count = await sessionManagementService.revokeOtherSessions(userId, currentSessionId);

    return sendSuccess(res, { revokedCount: count }, 'Other sessions revoked successfully');
  } catch (error) {
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to revoke other sessions');
  }
});

/**
 * Revoke all user sessions
 * @route DELETE /v1/sessions/revoke-all
 * @access Private
 */
const revokeAllUserSessions = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const { targetUserId } = req.body;

  // Users can only revoke their own sessions unless they're admin
  const currentUserRole = (req.user as any)?.role;

  if (targetUserId && targetUserId !== userId && currentUserRole !== 'ADMIN') {
    return sendError(res, ErrorCode.FORBIDDEN, 'Insufficient permissions');
  }

  try {
    const count = await sessionManagementService.revokeAllUserSessions(targetUserId || userId);

    return sendSuccess(res, { revokedCount: count }, 'All sessions revoked successfully');
  } catch (error) {
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to revoke all sessions');
  }
});

/**
 * Get session analytics
 * @route GET /v1/sessions/analytics
 * @access Private (Admin only)
 */
const getSessionAnalytics = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.query;
  const currentUserRole = (req.user as any)?.role;

  // Non-admin users can only get their own analytics
  if (currentUserRole !== 'ADMIN' && userId && userId !== (req.user as any)?.id) {
    return sendError(res, ErrorCode.FORBIDDEN, 'Insufficient permissions');
  }

  try {
    const analytics = await sessionManagementService.getSessionAnalytics(userId as string);

    return sendSuccess(res, analytics, 'Session analytics retrieved successfully');
  } catch (error) {
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to retrieve session analytics');
  }
});

/**
 * Get session security events
 * @route GET /v1/sessions/:sessionId/security-events
 * @access Private
 */
const getSessionSecurityEvents = catchAsync(async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  try {
    const securityEvents = await sessionManagementService.getSessionSecurityEvents(
      sessionId as string
    );

    return sendSuccess(res, { securityEvents }, 'Session security events retrieved successfully');
  } catch (error) {
    return sendError(
      res,
      ErrorCode.INTERNAL_SERVER_ERROR,
      'Failed to retrieve session security events'
    );
  }
});

/**
 * Get user's security events
 * @route GET /v1/sessions/security-events
 * @access Private
 */
const getUserSecurityEvents = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const { targetUserId } = req.query;
  const currentUserRole = (req.user as any)?.role;

  // Users can only view their own security events unless they're admin
  if (targetUserId && targetUserId !== userId && currentUserRole !== 'ADMIN') {
    return sendError(res, ErrorCode.FORBIDDEN, 'Insufficient permissions');
  }

  try {
    const securityEvents = await sessionManagementService.getUserSecurityEvents(
      (targetUserId as string) || userId
    );

    return sendSuccess(res, { securityEvents }, 'User security events retrieved successfully');
  } catch (error) {
    return sendError(
      res,
      ErrorCode.INTERNAL_SERVER_ERROR,
      'Failed to retrieve user security events'
    );
  }
});

/**
 * Resolve security event
 * @route PUT /v1/sessions/security-events/:eventId/resolve
 * @access Private (Admin only)
 */
const resolveSecurityEvent = catchAsync(async (req: Request, res: Response) => {
  const { eventId } = req.params;
  const resolvedBy = (req.user as any)?.id;

  try {
    const event = await sessionManagementService.resolveSecurityEvent(
      eventId as string,
      resolvedBy
    );

    return sendSuccess(res, { event }, 'Security event resolved successfully');
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return sendError(res, ErrorCode.NOT_FOUND, error.message);
    }
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to resolve security event');
  }
});

/**
 * Check for suspicious activity
 * @route GET /v1/sessions/check-suspicious/:userId
 * @access Private (Admin only)
 */
const checkSuspiciousActivity = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const result = await sessionManagementService.checkSuspiciousActivity(userId as string);

    return sendSuccess(res, result, 'Suspicious activity check completed');
  } catch (error) {
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to check suspicious activity');
  }
});

/**
 * Get session security score
 * @route GET /v1/sessions/:sessionId/security-score
 * @access Private
 */
const getSessionSecurityScore = catchAsync(async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  try {
    const score = await sessionManagementService.getSessionSecurityScore(sessionId as string);

    return sendSuccess(res, { score }, 'Session security score retrieved successfully');
  } catch (error) {
    return sendError(
      res,
      ErrorCode.INTERNAL_SERVER_ERROR,
      'Failed to retrieve session security score'
    );
  }
});

/**
 * Cleanup expired sessions
 * @route DELETE /v1/sessions/cleanup-expired
 * @access Private (Admin only)
 */
const cleanupExpiredSessions = catchAsync(async (req: Request, res: Response) => {
  try {
    const count = await sessionManagementService.cleanupExpiredSessions();

    return sendSuccess(res, { cleanedCount: count }, 'Expired sessions cleaned up successfully');
  } catch (error) {
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to cleanup expired sessions');
  }
});

export {
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
};
