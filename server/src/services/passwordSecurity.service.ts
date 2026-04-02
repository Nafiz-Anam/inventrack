import { PrismaClient } from '@prisma/client';
import prisma from '../client';
import bcrypt from 'bcryptjs';
import ApiError from '../utils/ApiError';
import httpStatus from 'http-status';

const PASSWORD_HISTORY_LIMIT = 5;
const PASSWORD_EXPIRY_DAYS = 90;
const MIN_PASSWORD_LENGTH = 8;
const REQUIRE_UPPERCASE = true;
const REQUIRE_LOWERCASE = true;
const REQUIRE_NUMBERS = true;
const REQUIRE_SPECIAL_CHARS = true;

/**
 * Check password strength
 * @param {string} password - Password to check
 * @returns {Promise<{isValid: boolean, errors: string[]}>}
 */
const checkPasswordStrength = async (
  password: string
): Promise<{
  isValid: boolean;
  errors: string[];
}> => {
  const errors: string[] = [];

  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }

  if (REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (REQUIRE_NUMBERS && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (REQUIRE_SPECIAL_CHARS && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Check if password is in history
 * @param {string} userId - User ID
 * @param {string} newPassword - New password to check
 * @returns {Promise<boolean>}
 */
const isPasswordInHistory = async (userId: string, newPassword: string): Promise<boolean> => {
  const passwordHistory = await prisma.passwordHistory.findMany({
    where: { userId },
    orderBy: { changedAt: 'desc' },
    take: PASSWORD_HISTORY_LIMIT,
  });

  if (!passwordHistory || passwordHistory.length === 0) {
    return false;
  }

  // Check current password and password history
  for (const passwordRecord of passwordHistory) {
    const isMatch = await bcrypt.compare(newPassword, passwordRecord.password);
    if (isMatch) {
      return true;
    }
  }

  return false;
};

/**
 * Add password to history
 * @param {string} userId - User ID
 * @param {string} hashedPassword - Hashed password to add
 * @returns {Promise<void>}
 */
const addPasswordToHistory = async (userId: string, hashedPassword: string): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHistory: true },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Get current password history count
  const currentHistoryCount = await prisma.passwordHistory.count({
    where: { userId },
  });

  // Create new password history record
  await prisma.passwordHistory.create({
    data: {
      userId,
      password: hashedPassword,
      changedAt: new Date(),
    },
  });

  // Remove old records if we exceed the limit
  if (currentHistoryCount >= PASSWORD_HISTORY_LIMIT) {
    const oldestRecords = await prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { changedAt: 'asc' },
      take: currentHistoryCount - PASSWORD_HISTORY_LIMIT + 1,
    });

    await prisma.passwordHistory.deleteMany({
      where: {
        id: { in: oldestRecords.map(record => record.id) },
      },
    });
  }

  // Update user's password changed timestamp
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordChangedAt: new Date(),
    },
  });
};

/**
 * Check if password is expired
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
const isPasswordExpired = async (userId: string): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordChangedAt: true },
  });

  if (!user || !user.passwordChangedAt) {
    return false; // New user, password not expired
  }

  const expiryDate = new Date(user.passwordChangedAt);
  expiryDate.setDate(expiryDate.getDate() + PASSWORD_EXPIRY_DAYS);

  return new Date() > expiryDate;
};

/**
 * Get password expiry info
 * @param {string} userId - User ID
 * @returns {Promise<{isExpired: boolean, daysUntilExpiry: number, expiryDate: Date}>}
 */
const getPasswordExpiryInfo = async (
  userId: string
): Promise<{
  isExpired: boolean;
  daysUntilExpiry: number;
  expiryDate: Date;
}> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordChangedAt: true },
  });

  if (!user || !user.passwordChangedAt) {
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + PASSWORD_EXPIRY_DAYS);

    return {
      isExpired: false,
      daysUntilExpiry: PASSWORD_EXPIRY_DAYS,
      expiryDate: defaultExpiry,
    };
  }

  const expiryDate = new Date(user.passwordChangedAt);
  expiryDate.setDate(expiryDate.getDate() + PASSWORD_EXPIRY_DAYS);

  const now = new Date();
  const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return {
    isExpired: daysUntilExpiry < 0,
    daysUntilExpiry: Math.max(0, daysUntilExpiry),
    expiryDate,
  };
};

/**
 * Validate new password
 * @param {string} userId - User ID
 * @param {string} newPassword - New password to validate
 * @returns {Promise<{isValid: boolean, errors: string[]}>}
 */
const validateNewPassword = async (
  userId: string,
  newPassword: string
): Promise<{
  isValid: boolean;
  errors: string[];
}> => {
  const errors: string[] = [];

  // Check password strength
  const strengthCheck = await checkPasswordStrength(newPassword);
  if (!strengthCheck.isValid) {
    errors.push(...strengthCheck.errors);
  }

  // Check if password is in history
  const inHistory = await isPasswordInHistory(userId, newPassword);
  if (inHistory) {
    errors.push('Password has been used recently. Please choose a different password.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Update password with security checks
 * @param {string} userId - User ID
 * @param {string} newPassword - New password
 * @returns {Promise<void>}
 */
const updatePassword = async (userId: string, newPassword: string): Promise<void> => {
  // Validate new password
  const validation = await validateNewPassword(userId, newPassword);
  if (!validation.isValid) {
    throw new ApiError(httpStatus.BAD_REQUEST, validation.errors.join(', '));
  }

  // Hash the new password
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // Add to password history
  await addPasswordToHistory(userId, hashedPassword);

  // Update user password
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      passwordChangedAt: new Date(),
    },
  });
};

/**
 * Force password change (for admin or security reasons)
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
const forcePasswordChange = async (userId: string): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      forcePasswordChange: true,
    },
  });
};

/**
 * Check if user needs to change password
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
const needsPasswordChange = async (userId: string): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { forcePasswordChange: true },
  });

  if (!user) {
    return false;
  }

  if (user.forcePasswordChange) {
    return true;
  }

  return await isPasswordExpired(userId);
};

/**
 * Get password security status
 * @param {string} userId - User ID
 * @returns {Promise<{
 *   needsChange: boolean,
 *   isExpired: boolean,
 *   daysUntilExpiry: number,
 *   expiryDate: Date,
 *   forceChange: boolean
 * }>}
 */
const getPasswordSecurityStatus = async (
  userId: string
): Promise<{
  needsChange: boolean;
  isExpired: boolean;
  daysUntilExpiry: number;
  expiryDate: Date;
  forceChange: boolean;
}> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { forcePasswordChange: true },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const expiryInfo = await getPasswordExpiryInfo(userId);
  const needsChange = user.forcePasswordChange || expiryInfo.isExpired;

  return {
    needsChange,
    isExpired: expiryInfo.isExpired,
    daysUntilExpiry: expiryInfo.daysUntilExpiry,
    expiryDate: expiryInfo.expiryDate,
    forceChange: user.forcePasswordChange,
  };
};

export default {
  checkPasswordStrength,
  isPasswordInHistory,
  addPasswordToHistory,
  isPasswordExpired,
  getPasswordExpiryInfo,
  validateNewPassword,
  updatePassword,
  forcePasswordChange,
  needsPasswordChange,
  getPasswordSecurityStatus,
};
