import { Role } from '@prisma/client';
import { z } from 'zod';

const createUser = {
  body: z.object({
    email: z.string().email({ message: 'Invalid email format' }),
    password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
    name: z
      .string()
      .min(1, { message: 'Name is required' })
      .max(100, { message: 'Name cannot exceed 100 characters' }),
    role: z.enum([Role.USER, Role.ADMIN]).optional(),
  }),
};

const getUsers = {
  query: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    role: z.enum([Role.USER, Role.ADMIN]).optional(),
    isActive: z.boolean().optional(),
    isEmailVerified: z.boolean().optional(),
    country: z.string().optional(),
    state: z.string().optional(),
    city: z.string().optional(),
    phone: z.string().optional(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    limit: z.coerce.number().min(1).max(100).default(10),
    page: z.coerce.number().min(1).default(1),
    search: z.string().optional(),
  }).optional(),
};

const getUser = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
  }),
};

const updateUser = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
  }),
  body: z.object({
    email: z.string().email({ message: 'Invalid email format' }).optional(),
    password: z.string().min(8, { message: 'Password must be at least 8 characters' }).optional(),
    name: z
      .string()
      .min(1, { message: 'Name is required' })
      .max(100, { message: 'Name cannot exceed 100 characters' })
      .optional(),
    role: z.enum([Role.USER, Role.ADMIN]).optional(),
    isActive: z.boolean().optional(),
    isEmailVerified: z.boolean().optional(),
  }),
};

const deleteUser = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
  }),
};

// Profile management
const getUserProfile = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
  }),
};

const updateUserProfile = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    phone: z
      .string()
      .regex(/^\+?[\d\s\-()]+$/)
      .optional(),
    phoneCode: z.string().optional(),
    country: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    city: z.string().max(100).optional(),
    address: z.string().max(500).optional(),
    profilePicture: z.string().url().optional(),
    dateOfBirth: z.date().max(new Date()).optional(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  }),
};

const getUserPreferences = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
  }),
  body: z.object({
    emailNotifications: z
      .object({
        loginAlerts: z.boolean().optional(),
        passwordChanges: z.boolean().optional(),
        twoFactorChanges: z.boolean().optional(),
        deviceLogins: z.boolean().optional(),
      })
      .optional(),
    pushNotifications: z
      .object({
        loginAlerts: z.boolean().optional(),
        securityUpdates: z.boolean().optional(),
      })
      .optional(),
    privacySettings: z
      .object({
        profileVisibility: z.enum(['public', 'private', 'friends_only']).optional(),
        showEmail: z.boolean().optional(),
        showLastSeen: z.boolean().optional(),
      })
      .optional(),
    theme: z.enum(['light', 'dark', 'auto']).optional(),
    language: z.enum(['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko']).optional(),
    timezone: z.string().optional(),
  }),
};

const getPrivacySettings = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
  }),
};

const updatePrivacySettings = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
  }),
  body: z.object({
    profileVisibility: z.enum(['public', 'private', 'friends_only'], {
      message: 'Profile visibility is required',
    }),
    showEmail: z.boolean().optional(),
    showLastSeen: z.boolean().optional(),
  }),
};

const getAccountStatus = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
  }),
};

const getUserStats = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
  }),
};

// Activity management
const getUserActivity = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
  }),
  query: z.object({
    page: z.coerce.number().min(1, { message: 'Page must be at least 1' }).optional(),
    limit: z.coerce
      .number()
      .min(1, { message: 'Limit must be at least 1' })
      .max(100, { message: 'Limit cannot exceed 100' })
      .optional(),
    type: z.string().optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
  }),
};

const getActivityStats = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
  }),
  query: z.object({
    days: z.coerce
      .number()
      .min(1, { message: 'Days must be at least 1' })
      .max(365, { message: 'Days cannot exceed 365' })
      .optional(),
  }),
};

// Device management
const getUserDevices = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
  }),
};

const getDeviceSessions = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
  }),
};

const trustDevice = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
    deviceId: z.string().min(1, { message: 'Device ID is required' }),
  }),
};

const removeDevice = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
    deviceId: z.string().min(1, { message: 'Device ID is required' }),
  }),
};

const removeAllOtherDevices = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
  }),
  body: z.object({
    currentDeviceId: z.string().min(1, { message: 'Current device ID is required' }),
  }),
};

// Notification management
const getUserNotifications = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
  }),
  query: z.object({
    page: z.coerce.number().min(1, { message: 'Page must be at least 1' }).optional(),
    limit: z.coerce
      .number()
      .min(1, { message: 'Limit must be at least 1' })
      .max(100, { message: 'Limit cannot exceed 100' })
      .optional(),
    type: z.string().optional(),
    isRead: z.boolean().optional(),
  }),
};

const markNotificationAsRead = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
    notificationId: z.string().min(1, { message: 'Notification ID is required' }),
  }),
};

const deleteNotification = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
    notificationId: z.string().min(1, { message: 'Notification ID is required' }),
  }),
};

// Security logs
const getSecurityLogs = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
  }),
  query: z.object({
    page: z.coerce.number().min(1, { message: 'Page must be at least 1' }).optional(),
    limit: z.coerce
      .number()
      .min(1, { message: 'Limit must be at least 1' })
      .max(100, { message: 'Limit cannot exceed 100' })
      .optional(),
    eventType: z.string().optional(),
    level: z.enum(['info', 'warning', 'error']).optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
  }),
};

const getSecurityStats = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
  }),
  query: z.object({
    days: z.coerce
      .number()
      .min(1, { message: 'Days must be at least 1' })
      .max(365, { message: 'Days cannot exceed 365' })
      .optional(),
  }),
};

// Public profile
const getPublicProfile = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
  }),
};

// Data export and account management
const exportUserData = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
  }),
};

const deleteAccount = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
  }),
  body: z.object({
    password: z.string().min(1, { message: 'Password is required' }),
  }),
};

// Admin-only endpoints
const getUsersWithExpiringPasswords = {
  query: z.object({
    days: z.coerce
      .number()
      .min(1, { message: 'Days must be at least 1' })
      .max(30, { message: 'Days cannot exceed 30' })
      .optional(),
  }),
};

const unlockUserAccount = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
  }),
};

const forcePasswordChange = {
  params: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
  }),
};

// Export functionality
const exportUsers = {
  query: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    role: z.enum([Role.USER, Role.ADMIN]).optional(),
    isActive: z.boolean().optional(),
    isEmailVerified: z.boolean().optional(),
    country: z.string().optional(),
    state: z.string().optional(),
    city: z.string().optional(),
    phone: z.string().optional(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    search: z.string().optional(),
    format: z.enum(['pdf', 'excel']),
    limit: z.coerce.number().min(1).max(1000).default(100),
  }),
};

export default {
  createUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  getUserProfile,
  updateUserProfile,
  getUserPreferences,
  updateUserPreferences: getUserPreferences,
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
  deleteNotification,
  getSecurityLogs,
  getSecurityStats,
  getPublicProfile,
  exportUserData,
  deleteAccount,
  getUsersWithExpiringPasswords,
  unlockUserAccount,
  forcePasswordChange,
  exportUsers,
};
