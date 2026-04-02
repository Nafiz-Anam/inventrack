import { z } from 'zod';

const enableTwoFactor = {
  body: z.object({
    token: z
      .string()
      .min(6, { message: 'Token must be at least 6 characters' })
      .max(8, { message: 'Token cannot exceed 8 characters' }),
  }),
};

const disableTwoFactor = {
  body: z.object({
    token: z
      .string()
      .min(6, { message: 'Token must be at least 6 characters' })
      .max(8, { message: 'Token cannot exceed 8 characters' }),
  }),
};

const regenerateBackupCodes = {
  body: z.object({
    token: z
      .string()
      .min(6, { message: 'Token must be at least 6 characters' })
      .max(8, { message: 'Token cannot exceed 8 characters' }),
  }),
};

const verifyToken = {
  body: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
    token: z
      .string()
      .min(6, { message: 'Token must be at least 6 characters' })
      .max(8, { message: 'Token cannot exceed 8 characters' }),
  }),
};

export default {
  enableTwoFactor,
  disableTwoFactor,
  regenerateBackupCodes,
  verifyToken,
};
