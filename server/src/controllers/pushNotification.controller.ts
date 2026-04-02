import { Request, Response } from 'express';
import httpStatus from 'http-status';
import pick from '../utils/pick';
import catchAsync from '../utils/catchAsync';
import { sendSuccess, sendError } from '../utils/apiResponse';
import { ErrorCode } from '../utils/apiResponse';
import ApiError from '../utils/ApiError';
import prisma from '../client';
import { getWebSocketController } from '../controllers/websocket.controller';

/**
 * Get push notification preferences
 * @route GET /v1/users/:userId/push-preferences
 * @access Private
 */
const getPushPreferences = catchAsync(async (req: Request, res: Response) => {
  const userId = req.params.userId as string;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushNotifications: true },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const preferences = user.pushNotifications
    ? typeof user.pushNotifications === 'string'
      ? JSON.parse(user.pushNotifications)
      : user.pushNotifications
    : {
        enabled: true,
        types: {},
        quietHours: { enabled: false, start: '22:00', end: '08:00' },
      };

  sendSuccess(res, preferences, 'Push notification preferences retrieved');
});

/**
 * Update push notification preferences
 * @route PUT /v1/users/:userId/push-preferences
 * @access Private
 */
const updatePushPreferences = catchAsync(async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  const preferences = req.body;

  // Validate preferences structure
  const validPreferences = {
    enabled: preferences.enabled !== false,
    types: preferences.types || {},
    quietHours: {
      enabled: Boolean(preferences.quietHours?.enabled),
      start: preferences.quietHours?.start || '22:00',
      end: preferences.quietHours?.end || '08:00',
    },
  };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushNotifications: true },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      pushNotifications: validPreferences,
    },
  });

  sendSuccess(res, validPreferences, 'Push notification preferences updated');
});

/**
 * Test push notification
 * @route POST /v1/users/:userId/test-push-notification
 * @access Private
 */
const testPushNotification = catchAsync(async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  const { title, message, type, metadata } = req.body;

  if (!title || !message) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Title and message are required');
  }

  try {
    // Import notification service dynamically to avoid circular dependency
    const { default: notificationService } = await import('../services/notification.service');

    await notificationService.createNotification(
      userId,
      type || 'SYSTEM_UPDATE',
      title,
      message,
      metadata
    );

    sendSuccess(
      res,
      { message: 'Test push notification sent' },
      'Test notification sent successfully'
    );
  } catch (error) {
    console.error('Error sending test push notification:', error);
    sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to send test notification');
  }
});

/**
 * Get WebSocket connection status
 * @route GET /v1/users/:userId/ws-status
 * @access Private
 */
const getWebSocketStatus = catchAsync(async (req: Request, res: Response) => {
  const userId = req.params.userId as string;

  try {
    const wsController = getWebSocketController();
    const connections = wsController?.getUserConnections(userId) || 0;
    const isConnected = connections > 0;

    sendSuccess(
      res,
      {
        userId,
        isConnected,
        connections,
        serverInfo: {
          connectedUsers: wsController?.getConnectedUsersCount() || 0,
          wsPort: process.env.WS_PORT || '8080',
        },
      },
      'WebSocket status retrieved'
    );
  } catch (error) {
    console.error('Error getting WebSocket status:', error);
    sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to get WebSocket status');
  }
});

/**
 * Subscribe to notification types
 * @route POST /v1/users/:userId/subscribe-notifications
 * @access Private
 */
const subscribeToNotifications = catchAsync(async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  const { types } = req.body;

  if (!Array.isArray(types)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Types must be an array');
  }

  try {
    // Update user preferences with subscriptions
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushNotifications: true },
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    const currentPrefs = user.pushNotifications
      ? typeof user.pushNotifications === 'string'
        ? JSON.parse(user.pushNotifications)
        : user.pushNotifications
      : {
          enabled: true,
          types: {},
          quietHours: { enabled: false, start: '22:00', end: '08:00' },
        };

    const updatedPrefs = {
      ...currentPrefs,
      types: {
        ...currentPrefs.types,
        // Add or update subscription types
        ...types.reduce((acc, type) => {
          acc[type] = true;
          return acc;
        }, {}),
      },
    };

    await prisma.user.update({
      where: { id: userId },
      data: {
        pushNotifications: updatedPrefs,
      },
    });

    sendSuccess(
      res,
      {
        subscribedTypes: types,
        allTypes: Object.keys(updatedPrefs.types),
      },
      'Subscribed to notification types'
    );
  } catch (error) {
    console.error('Error subscribing to notifications:', error);
    sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to subscribe to notifications');
  }
});

/**
 * Unsubscribe from notification types
 * @route DELETE /v1/users/:userId/unsubscribe-notifications
 * @access Private
 */
const unsubscribeFromNotifications = catchAsync(async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  const { types } = req.body;

  if (!Array.isArray(types)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Types must be an array');
  }

  try {
    // Update user preferences to remove subscriptions
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushNotifications: true },
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    const currentPrefs = user.pushNotifications
      ? typeof user.pushNotifications === 'string'
        ? JSON.parse(user.pushNotifications)
        : user.pushNotifications
      : {
          enabled: true,
          types: {},
          quietHours: { enabled: false, start: '22:00', end: '08:00' },
        };

    const updatedPrefs = {
      ...currentPrefs,
      types: {
        ...currentPrefs.types,
        // Remove subscription types
        ...types.reduce(
          (acc, type) => {
            delete acc[type];
            return acc;
          },
          { ...currentPrefs.types }
        ),
      },
    };

    await prisma.user.update({
      where: { id: userId },
      data: {
        pushNotifications: updatedPrefs,
      },
    });

    sendSuccess(
      res,
      {
        unsubscribedTypes: types,
        remainingTypes: Object.keys(updatedPrefs.types),
      },
      'Unsubscribed from notification types'
    );
  } catch (error) {
    console.error('Error unsubscribing from notifications:', error);
    sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to unsubscribe from notifications');
  }
});

export {
  getPushPreferences,
  updatePushPreferences,
  testPushNotification,
  getWebSocketStatus,
  subscribeToNotifications,
  unsubscribeFromNotifications,
};
