import { z } from 'zod';

const notificationTypeEnum = z.enum([
  'LOGIN_ALERT',
  'PASSWORD_CHANGE',
  'EMAIL_VERIFICATION',
  'TWO_FACTOR_SETUP',
  'ACCOUNT_LOCKED',
  'SECURITY_ALERT',
  'SYSTEM_UPDATE',
  'WELCOME',
]);

const updatePreferences = z.object({
  enabled: z.boolean().optional(),
  types: z.record(z.string(), z.boolean()).optional(),
  quietHours: z
    .object({
      enabled: z.boolean().optional(),
      start: z
        .string()
        .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .optional(), // HH:mm format
      end: z
        .string()
        .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .optional(), // HH:mm format
    })
    .optional(),
});

const testNotification = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  type: notificationTypeEnum.optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const subscribeNotifications = z.object({
  types: z.array(notificationTypeEnum).min(1),
});

const unsubscribeNotifications = z.object({
  types: z.array(notificationTypeEnum).min(1),
});

export const pushNotificationValidation = {
  updatePreferences,
  testNotification,
  subscribeNotifications,
  unsubscribeNotifications,
};
