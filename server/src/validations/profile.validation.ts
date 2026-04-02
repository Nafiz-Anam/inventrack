import { z } from 'zod';

const updateProfile = {
  body: z.object({
    name: z
      .string()
      .min(1, { message: 'Name must be at least 1 character' })
      .max(100, { message: 'Name cannot exceed 100 characters' })
      .optional(),
    profilePicture: z.string().url({ message: 'Profile picture must be a valid URL' }).optional(),
    phoneCode: z.string().optional(),
    country: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    city: z.string().max(100).optional(),
    address: z.string().max(500).optional(),
    phone: z
      .string()
      .regex(/^\+?[\d\s\-()]+$/, { message: 'Invalid phone number format' })
      .optional(),
    dateOfBirth: z
      .date()
      .max(new Date(), { message: 'Date of birth cannot be in the future' })
      .optional(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  }),
};

const updatePreferences = {
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

const updatePrivacySettings = {
  body: z.object({
    profileVisibility: z.enum(['public', 'private', 'friends_only'], {
      message: 'Profile visibility is required',
    }),
    showEmail: z.boolean().optional(),
    showLastSeen: z.boolean().optional(),
  }),
};

const deleteAccount = {
  body: z.object({
    password: z.string().min(1, { message: 'Password is required' }),
  }),
};

const uploadProfilePicture = {
  file: z.object({
    mimetype: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp'], {
      message: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed',
    }),
    size: z.number().max(5 * 1024 * 1024, { message: 'File size cannot exceed 5MB' }),
  }),
};

export default {
  updateProfile,
  updatePreferences,
  updatePrivacySettings,
  deleteAccount,
  uploadProfilePicture,
};
