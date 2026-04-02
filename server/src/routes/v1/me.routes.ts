import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import { userValidation } from '../../validations';
import { userController } from '../../controllers';

const router = express.Router();

// All routes require authentication
router.use(auth());

/**
 * @route GET /v1/me/profile
 * @desc Get current user's profile
 * @access Private
 */
router.get('/profile', (req, res, next) => {
  // Set userId from authenticated user
  (req.params as any).userId = (req.user as any)?.id;
  userController.getUserProfile(req, res, next);
});

/**
 * @route PATCH /v1/me/profile
 * @desc Update current user's profile
 * @access Private
 */
router.patch('/profile', validate(userValidation.updateUserProfile), (req, res, next) => {
  // Set userId from authenticated user
  (req.params as any).userId = (req.user as any)?.id;
  userController.updateUserProfile(req, res, next);
});

/**
 * @route GET /v1/me/preferences
 * @desc Get current user's preferences
 * @access Private
 */
router.get('/preferences', (req, res, next) => {
  // Set userId from authenticated user
  (req.params as any).userId = (req.user as any)?.id;
  userController.getUserPreferences(req, res, next);
});

/**
 * @route PATCH /v1/me/preferences
 * @desc Update current user's preferences
 * @access Private
 */
router.patch('/preferences', validate(userValidation.updateUserPreferences), (req, res, next) => {
  // Set userId from authenticated user
  (req.params as any).userId = (req.user as any)?.id;
  userController.updateUserPreferences(req, res, next);
});

/**
 * @route GET /v1/me/privacy
 * @desc Get current user's privacy settings
 * @access Private
 */
router.get('/privacy', (req, res, next) => {
  // Set userId from authenticated user
  (req.params as any).userId = (req.user as any)?.id;
  userController.getPrivacySettings(req, res, next);
});

/**
 * @route PATCH /v1/me/privacy
 * @desc Update current user's privacy settings
 * @access Private
 */
router.patch('/privacy', validate(userValidation.updatePrivacySettings), (req, res, next) => {
  // Set userId from authenticated user
  (req.params as any).userId = (req.user as any)?.id;
  userController.updatePrivacySettings(req, res, next);
});

/**
 * @route GET /v1/me/account-status
 * @desc Get current user's account status
 * @access Private
 */
router.get('/account-status', (req, res, next) => {
  // Set userId from authenticated user
  (req.params as any).userId = (req.user as any)?.id;
  userController.getAccountStatus(req, res, next);
});

/**
 * @route GET /v1/me/stats
 * @desc Get current user's statistics
 * @access Private
 */
router.get('/stats', (req, res, next) => {
  // Set userId from authenticated user
  (req.params as any).userId = (req.user as any)?.id;
  userController.getUserStats(req, res, next);
});

/**
 * @route GET /v1/me/activity
 * @desc Get current user's activity
 * @access Private
 */
router.get('/activity', validate(userValidation.getUserActivity), (req, res, next) => {
  // Set userId from authenticated user
  (req.params as any).userId = (req.user as any)?.id;
  userController.getUserActivity(req, res, next);
});

/**
 * @route GET /v1/me/activity/stats
 * @desc Get current user's activity statistics
 * @access Private
 */
router.get('/activity/stats', validate(userValidation.getActivityStats), (req, res, next) => {
  // Set userId from authenticated user
  (req.params as any).userId = (req.user as any)?.id;
  userController.getActivityStats(req, res, next);
});

/**
 * @route GET /v1/me/devices
 * @desc Get current user's devices
 * @access Private
 */
router.get('/devices', (req, res, next) => {
  // Set userId from authenticated user
  (req.params as any).userId = (req.user as any)?.id;
  userController.getUserDevices(req, res, next);
});

/**
 * @route GET /v1/me/devices/sessions
 * @desc Get current user's device sessions
 * @access Private
 */
router.get('/devices/sessions', (req, res, next) => {
  // Set userId from authenticated user
  (req.params as any).userId = (req.user as any)?.id;
  userController.getDeviceSessions(req, res, next);
});

/**
 * @route POST /v1/me/devices/:deviceId/trust
 * @desc Trust device
 * @access Private
 */
router.post('/devices/:deviceId/trust', validate(userValidation.trustDevice), (req, res, next) => {
  // Set userId from authenticated user
  (req.params as any).userId = (req.user as any)?.id;
  userController.trustDevice(req, res, next);
});

/**
 * @route DELETE /v1/me/devices/:deviceId
 * @desc Remove device
 * @access Private
 */
router.delete('/devices/:deviceId', validate(userValidation.removeDevice), (req, res, next) => {
  // Set userId from authenticated user
  (req.params as any).userId = (req.user as any)?.id;
  userController.removeDevice(req, res, next);
});

/**
 * @route DELETE /v1/me/devices
 * @desc Remove all other devices
 * @access Private
 */
router.delete('/devices', validate(userValidation.removeAllOtherDevices), (req, res, next) => {
  // Set userId from authenticated user
  (req.params as any).userId = (req.user as any)?.id;
  userController.removeAllOtherDevices(req, res, next);
});

/**
 * @route GET /v1/me/notifications
 * @desc Get current user's notifications
 * @access Private
 */
router.get('/notifications', validate(userValidation.getUserNotifications), (req, res, next) => {
  // Set userId from authenticated user
  (req.params as any).userId = (req.user as any)?.id;
  userController.getUserNotifications(req, res, next);
});

/**
 * @route PATCH /v1/me/notifications/:notificationId/read
 * @desc Mark notification as read
 * @access Private
 */
router.patch(
  '/notifications/:notificationId/read',
  validate(userValidation.markNotificationAsRead),
  (req, res, next) => {
    // Set userId from authenticated user
    (req.params as any).userId = (req.user as any)?.id;
    userController.markNotificationAsRead(req, res, next);
  }
);

/**
 * @route PATCH /v1/me/notifications/read-all
 * @desc Mark all notifications as read
 * @access Private
 */
router.patch('/notifications/read-all', (req, res, next) => {
  // Set userId from authenticated user
  (req.params as any).userId = (req.user as any)?.id;
  userController.markAllNotificationsAsRead(req, res, next);
});

/**
 * @route DELETE /v1/me/notifications/:notificationId
 * @desc Delete notification
 * @access Private
 */
router.delete(
  '/notifications/:notificationId',
  validate(userValidation.deleteNotification),
  (req, res, next) => {
    // Set userId from authenticated user
    (req.params as any).userId = (req.user as any)?.id;
    userController.deleteNotification(req, res, next);
  }
);

/**
 * @route DELETE /v1/me/notifications/read
 * @desc Delete read notifications
 * @access Private
 */
router.delete('/notifications/read', (req, res, next) => {
  // Set userId from authenticated user
  (req.params as any).userId = (req.user as any)?.id;
  userController.deleteReadNotifications(req, res, next);
});

/**
 * @route GET /v1/me/notifications/stats
 * @desc Get notification statistics
 * @access Private
 */
router.get('/notifications/stats', (req, res, next) => {
  // Set userId from authenticated user
  (req.params as any).userId = (req.user as any)?.id;
  userController.getNotificationStats(req, res, next);
});

/**
 * @route GET /v1/me/security-logs
 * @desc Get current user's security logs
 * @access Private
 */
router.get('/security-logs', validate(userValidation.getSecurityLogs), (req, res, next) => {
  // Set userId from authenticated user
  (req.params as any).userId = (req.user as any)?.id;
  userController.getSecurityLogs(req, res, next);
});

/**
 * @route GET /v1/me/security-logs/stats
 * @desc Get security statistics
 * @access Private
 */
router.get('/security-logs/stats', validate(userValidation.getSecurityStats), (req, res, next) => {
  // Set userId from authenticated user
  (req.params as any).userId = (req.user as any)?.id;
  userController.getSecurityStats(req, res, next);
});

/**
 * @route GET /v1/me/export
 * @desc Export current user's data
 * @access Private
 */
router.get('/export', validate(userValidation.exportUserData), (req, res, next) => {
  // Set userId from authenticated user
  (req.params as any).userId = (req.user as any)?.id;
  userController.exportUserData(req, res, next);
});

/**
 * @route DELETE /v1/me/account
 * @desc Delete current user's account
 * @access Private
 */
router.delete('/account', validate(userValidation.deleteAccount), (req, res, next) => {
  // Set userId from authenticated user
  (req.params as any).userId = (req.user as any)?.id;
  userController.deleteAccount(req, res, next);
});

export default router;
