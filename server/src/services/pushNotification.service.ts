import { Request } from 'express';
import { NotificationType } from '@prisma/client';
import jwt from 'jsonwebtoken';
import config from '../config/config';
import ApiError from '../utils/ApiError';
import httpStatus from 'http-status';

interface PushNotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

interface PushNotificationPreferences {
  enabled: boolean;
  types: {
    [key in NotificationType]?: boolean;
  };
  quietHours?: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string; // HH:mm format
  };
}

class PushNotificationService {
  // This service is now a placeholder for future enhancements
  // The actual WebSocket functionality is handled in websocket.controller.ts

  /**
   * Validate push notification preferences
   */
  static validatePreferences(preferences: any): PushNotificationPreferences {
    const defaultPrefs: PushNotificationPreferences = {
      enabled: true,
      types: {},
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
      },
    };

    return {
      ...defaultPrefs,
      ...preferences,
      types: { ...defaultPrefs.types, ...preferences.types },
      quietHours: { ...defaultPrefs.quietHours, ...preferences.quietHours },
    };
  }

  /**
   * Check if quiet hours are currently active
   */
  static isInQuietHours(preferences: PushNotificationPreferences): boolean {
    if (!preferences.quietHours?.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [startHour, startMin] = preferences.quietHours.start.split(':').map(Number);
    const [endHour, endMin] = preferences.quietHours.end.split(':').map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      // Same day range (e.g., 22:00 to 08:00)
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Overnight range (e.g., 22:00 to 08:00 next day)
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  /**
   * Check if a notification type is enabled for a user
   */
  static isNotificationTypeEnabled(
    preferences: PushNotificationPreferences,
    type: NotificationType
  ): boolean {
    return preferences.enabled && preferences.types?.[type] !== false;
  }
}

export { PushNotificationService, type PushNotificationData, type PushNotificationPreferences };
export default PushNotificationService;
