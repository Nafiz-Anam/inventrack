import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import {
  userService,
  profileService,
  userActivityService,
  deviceService,
  notificationService,
  securityLoggingService,
} from '../services';
import exportService from '../services/export.service';
import ApiError from '../utils/ApiError';
import { Request, Response } from 'express';
import pick from '../utils/pick';

/**
 * Create user
 * @route POST /v1/users
 * @access Private (Admin only)
 */
const createUser = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.createUser(req.body);
  res.status(httpStatus.CREATED).send(user);
});

/**
 * Get users
 * @route GET /v1/users
 * @access Private (Admin only)
 */
const getUsers = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['name', 'role', 'isActive', 'isEmailVerified']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await userService.queryUsers(filter, options);
  res.send(result);
});

/**
 * Get user
 * @route GET /v1/users/:userId
 * @access Private
 */
const getUser = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.getUserById(req.params.userId as string);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  res.send(user);
});

/**
 * Update user
 * @route PATCH /v1/users/:userId
 * @access Private
 */
const updateUser = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.updateUserById(req.params.userId as string, req.body);
  res.send(user);
});

/**
 * Delete user
 * @route DELETE /v1/users/:userId
 * @access Private (Admin only)
 */
const deleteUser = catchAsync(async (req: Request, res: Response) => {
  await userService.deleteUserById(req.params.userId as string);
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Get user profile
 * @route GET /v1/users/:userId/profile
 * @access Private
 */
const getUserProfile = catchAsync(async (req: Request, res: Response) => {
  const profile = await userService.getUserProfile(req.params.userId as string);
  res.status(httpStatus.OK).send(profile);
});

/**
 * Update user profile
 * @route PATCH /v1/users/:userId/profile
 * @access Private
 */
const updateUserProfile = catchAsync(async (req: Request, res: Response) => {
  const profile = await profileService.updateProfile(req.params.userId as string, req.body);
  res.send(profile);
});

/**
 * Get user preferences
 * @route GET /v1/users/:userId/preferences
 * @access Private
 */
const getUserPreferences = catchAsync(async (req: Request, res: Response) => {
  const preferences = await profileService.getUserPreferences(req.params.userId as string);
  res.send(preferences);
});

/**
 * Update user preferences
 * @route PATCH /v1/users/:userId/preferences
 * @access Private
 */
const updateUserPreferences = catchAsync(async (req: Request, res: Response) => {
  const preferences = await profileService.updatePreferences(req.params.userId as string, req.body);
  res.send(preferences);
});

/**
 * Get user privacy settings
 * @route GET /v1/users/:userId/privacy
 * @access Private
 */
const getPrivacySettings = catchAsync(async (req: Request, res: Response) => {
  const privacy = await profileService.getUserPreferences(req.params.userId as string);
  res.send(privacy);
});

/**
 * Update user privacy settings
 * @route PATCH /v1/users/:userId/privacy
 * @access Private
 */
const updatePrivacySettings = catchAsync(async (req: Request, res: Response) => {
  const privacy = await profileService.updatePrivacySettings(req.params.userId as string, req.body);
  res.send(privacy);
});

/**
 * Get user account status
 * @route GET /v1/users/:userId/account-status
 * @access Private
 */
const getAccountStatus = catchAsync(async (req: Request, res: Response) => {
  const status = await profileService.getUserProfile(req.params.userId as string);
  res.send(status);
});

/**
 * Get user statistics
 * @route GET /v1/users/:userId/stats
 * @access Private
 */
const getUserStats = catchAsync(async (req: Request, res: Response) => {
  // For now, return basic user info as stats
  const user = await profileService.getUserProfile(req.params.userId as string);
  const stats = {
    id: user.id,
    email: user.email,
    name: user.name,
    isEmailVerified: user.isEmailVerified,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
  res.send(stats);
});

/**
 * Get user activity
 * @route GET /v1/users/:userId/activity
 * @access Private
 */
const getUserActivity = catchAsync(async (req: Request, res: Response) => {
  const options = pick(req.query, ['page', 'limit', 'type', 'startDate', 'endDate']);
  const activity = await userActivityService.getUserActivities(
    req.params.userId as string,
    options
  );
  res.send(activity);
});

/**
 * Get user activity statistics
 * @route GET /v1/users/:userId/activity/stats
 * @access Private
 */
const getActivityStats = catchAsync(async (req: Request, res: Response) => {
  const days = req.query.days ? parseInt(req.query.days as string) : 30;
  const stats = await userActivityService.getActivityStats(req.params.userId as string, days);
  res.send(stats);
});

/**
 * Get user devices
 * @route GET /v1/users/:userId/devices
 * @access Private
 */
const getUserDevices = catchAsync(async (req: Request, res: Response) => {
  const devices = await deviceService.getUserDevices(req.params.userId as string);
  res.send(devices);
});

/**
 * Get user device sessions
 * @route GET /v1/users/:userId/devices/sessions
 * @access Private
 */
const getDeviceSessions = catchAsync(async (req: Request, res: Response) => {
  const sessions = await deviceService.getDeviceSessions(req.params.userId as string);
  res.send(sessions);
});

/**
 * Trust device
 * @route POST /v1/users/:userId/devices/:deviceId/trust
 * @access Private
 */
const trustDevice = catchAsync(async (req: Request, res: Response) => {
  const device = await deviceService.trustDevice(
    req.params.userId as string,
    req.params.deviceId as string
  );
  res.send(device);
});

/**
 * Remove device
 * @route DELETE /v1/users/:userId/devices/:deviceId
 * @access Private
 */
const removeDevice = catchAsync(async (req: Request, res: Response) => {
  await deviceService.removeDevice(req.params.userId as string, req.params.deviceId as string);
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Remove all other devices
 * @route DELETE /v1/users/:userId/devices
 * @access Private
 */
const removeAllOtherDevices = catchAsync(async (req: Request, res: Response) => {
  const { currentDeviceId } = req.body;
  const removedCount = await deviceService.removeAllOtherDevices(
    req.params.userId as string,
    currentDeviceId
  );
  res.send({ removedCount });
});

/**
 * Get user notifications
 * @route GET /v1/users/:userId/notifications
 * @access Private
 */
const getUserNotifications = catchAsync(async (req: Request, res: Response) => {
  const options = pick(req.query, ['page', 'limit', 'type', 'isRead']);
  const notifications = await notificationService.getUserNotifications(
    req.params.userId as string,
    options
  );
  res.send(notifications);
});

/**
 * Mark notification as read
 * @route PATCH /v1/users/:userId/notifications/:notificationId/read
 * @access Private
 */
const markNotificationAsRead = catchAsync(async (req: Request, res: Response) => {
  const notification = await notificationService.markAsRead(
    req.params.userId as string,
    req.params.notificationId as string
  );
  res.send(notification);
});

/**
 * Mark all notifications as read
 * @route PATCH /v1/users/:userId/notifications/read-all
 * @access Private
 */
const markAllNotificationsAsRead = catchAsync(async (req: Request, res: Response) => {
  const count = await notificationService.markAllAsRead(req.params.userId as string);
  res.send({ count });
});

/**
 * Delete notification
 * @route DELETE /v1/users/:userId/notifications/:notificationId
 * @access Private
 */
const deleteNotification = catchAsync(async (req: Request, res: Response) => {
  await notificationService.deleteNotification(
    req.params.userId as string,
    req.params.notificationId as string
  );
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Delete read notifications
 * @route DELETE /v1/users/:userId/notifications/read
 * @access Private
 */
const deleteReadNotifications = catchAsync(async (req: Request, res: Response) => {
  const count = await notificationService.deleteReadNotifications(req.params.userId as string);
  res.send({ count });
});

/**
 * Get notification statistics
 * @route GET /v1/users/:userId/notifications/stats
 * @access Private
 */
const getNotificationStats = catchAsync(async (req: Request, res: Response) => {
  const stats = await notificationService.getNotificationStats(req.params.userId as string);
  res.send(stats);
});

/**
 * Get user security logs
 * @route GET /v1/users/:userId/security-logs
 * @access Private
 */
const getSecurityLogs = catchAsync(async (req: Request, res: Response) => {
  const options = pick(req.query, ['page', 'limit', 'eventType', 'level', 'startDate', 'endDate']);
  const logs = await securityLoggingService.getUserSecurityLogs(
    req.params.userId as string,
    options
  );
  res.send(logs);
});

/**
 * Get security statistics
 * @route GET /v1/users/:userId/security-logs/stats
 * @access Private
 */
const getSecurityStats = catchAsync(async (req: Request, res: Response) => {
  const days = req.query.days ? parseInt(req.query.days as string) : 30;
  const stats = await securityLoggingService.getSecurityStats(req.params.userId as string, days);
  res.send(stats);
});

/**
 * Get public profile
 * @route GET /v1/users/:userId/public
 * @access Public
 */
const getPublicProfile = catchAsync(async (req: Request, res: Response) => {
  const profile = await userService.getUserById(req.params.userId as string);
  res.send(profile);
});

/**
 * Export user data
 * @route GET /v1/users/:userId/export
 * @access Private
 */
const exportUserData = catchAsync(async (req: Request, res: Response) => {
  // For now, return user profile as exported data
  const data = await profileService.getUserProfile(req.params.userId as string);
  res.send(data);
});

/**
 * Delete user account
 * @route DELETE /v1/users/:userId/account
 * @access Private
 */
const deleteAccount = catchAsync(async (req: Request, res: Response) => {
  await profileService.deleteAccount(req.params.userId as string, req.body.password);
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Get users with expiring passwords (Admin only)
 * @route GET /v1/users/expiring-passwords
 * @access Private (Admin only)
 */
const getUsersWithExpiringPasswords = catchAsync(async (req: Request, res: Response) => {
  const { daysThreshold = 90, page = 1, limit = 10 } = req.query;
  const filter = {};
  const options = {
    page: Number(page),
    limit: Number(limit),
    sortBy: 'passwordChangedAt',
    sortOrder: 'asc',
  };
  const users = await userService.getUsersWithExpiringPasswords(filter, options);
  res.status(httpStatus.OK).send(users);
});

/**
 * Get locked users (Admin only)
 * @route GET /v1/users/locked
 * @access Private (Admin only)
 */
const getLockedUsers = catchAsync(async (req: Request, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const filter = {};
  const options = {
    page: Number(page),
    limit: Number(limit),
    sortBy: 'lastLoginAt',
    sortOrder: 'desc',
  };
  const users = await userService.getLockedUsers(filter, options);
  res.status(httpStatus.OK).send(users);
});

/**
 * Unlock user account (Admin only)
 * @route PATCH /v1/users/:userId/unlock
 * @access Private (Admin only)
 */
const unlockUserAccount = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.unlockUserAccount(req.params.userId as string);
  res.send(user);
});

/**
 * Force password change (Admin only)
 * @route PATCH /v1/users/:userId/force-password-change
 * @access Private (Admin only)
 */
const forcePasswordChange = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.forcePasswordChange(req.params.userId as string);
  res.send(user);
});

/**
 * Export users list
 * @route GET /v1/users/export
 * @access Private (Admin only)
 */
const exportUsers = catchAsync(async (req: Request, res: Response) => {
  const { format } = req.query as { format: 'pdf' | 'excel' };

  // Build filter and options from query params
  const filter = pick(req.query, [
    'name',
    'email',
    'role',
    'isActive',
    'isEmailVerified',
    'country',
    'state',
    'city',
    'phone',
    'gender',
  ]);
  const options = pick(req.query, ['sortBy', 'sortOrder', 'search', 'limit']);

  // Set default limit for export
  options.limit = Math.min(Number(options.limit) || 100, 1000);

  // Get users with filters
  const result = await userService.queryUsers(filter, options);

  // Export based on format
  if (format === 'pdf') {
    await exportService.exportUsersToPDF(result.results, res);
  } else if (format === 'excel') {
    await exportService.exportUsersToExcel(result.results, res);
  } else {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid export format');
  }
});

export default {
  createUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  getUserProfile,
  updateUserProfile,
  getUserPreferences,
  updateUserPreferences,
  getPrivacySettings,
  updatePrivacySettings,
  getAccountStatus,
  getUserStats,
  getUserActivity,
  getActivityStats,
  getUserDevices,
  getDeviceSessions,
  trustDevice,
  removeDevice,
  removeAllOtherDevices,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteReadNotifications,
  getNotificationStats,
  getSecurityLogs,
  getSecurityStats,
  getPublicProfile,
  exportUserData,
  deleteAccount,
  getUsersWithExpiringPasswords,
  getLockedUsers,
  unlockUserAccount,
  forcePasswordChange,
  exportUsers,
};
