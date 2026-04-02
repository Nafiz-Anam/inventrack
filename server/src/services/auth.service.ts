import httpStatus from 'http-status';
import { TokenType } from '@prisma/client';
import tokenService from './token.service';
import userService from './user.service';
import twoFactorService from './twoFactor.service';
import ApiError from '../utils/ApiError';
import { encryptPassword, isPasswordMatch } from '../utils/encryption';
import { Request } from 'express';
import moment from 'moment';
import config from '../config/config';
import userActivityService from './userActivity.service';
import deviceService from './device.service';
import { passwordSecurityService } from './index';
import securityService from './security.service';
import { SecurityEventType } from '@prisma/client';
import catchAsync from '../utils/catchAsync';
import { createEmailVerificationOtp } from './otp.service';
import { sendEmailVerificationOtp } from '../services/email.service';

/**
 * Login with username and password
 * @param {string} email
 * @param {string} password
 * @param {Request} req
 * @returns {Promise<Object>}
 */
const loginUserWithEmailAndPassword = async (email: string, password: string, req: Request) => {
  const user = await userService.getUserByEmail(email);
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect email or password');
  }

  // Ensure user has required properties
  if (!user.id || !user.password) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Invalid user data');
  }

  if (!(await isPasswordMatch(password, user.password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect email or password');
  }

  // Check if account is locked
  if (user.isLocked) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Account is locked. Please contact support.');
  }

  // Check if account is active
  if (!user.isActive) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Account is deactivated. Please contact support.');
  }

  // Email verification check disabled
  // if (!user.isEmailVerified) {
  //   throw new ApiError(httpStatus.UNAUTHORIZED, 'Email not verified.');
  // }

  // Device limit check disabled for development
  // const hasReachedDeviceLimit = await deviceService.hasReachedDeviceLimit(user.id, 3);
  // if (hasReachedDeviceLimit) {
  //   throw new ApiError(httpStatus.FORBIDDEN, 'Device limit reached.');
  // }

  // Reset failed login attempts on successful login
  if (user.failedLoginAttempts > 0) {
    await userService.updateUserById(user.id, { failedLoginAttempts: 0, lockoutUntil: null });
  }

  // Update last login
  await userService.updateUserById(user.id, { lastLoginAt: new Date() });

  // Generate tokens and persist device/session
  const tokens = await tokenService.generateAuthTokens(user, req);

  // Log login activity
  await userActivityService.logLoginActivity(user.id, req);

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    tokens,
  };
};

/**
 * Logout
 * @param {string} refreshToken
 * @param {Request} req
 * @param {string} userId
 * @returns {Promise}
 */
const logout = async (refreshToken: string, req: Request, userId: string) => {
  const refreshTokenDoc = await tokenService.verifyToken(refreshToken, TokenType.REFRESH);
  await tokenService.blacklistToken(refreshTokenDoc.id);
  // Log logout activity
  await userActivityService.logLogoutActivity(userId, req);
  // End user session for this device
  const deviceId = (req.headers['x-device-id'] as string) || undefined;
  if (deviceId) {
    await tokenService.endUserSession(userId, deviceId);
  }
};

/**
 * Refresh auth tokens
 * @param {string} refreshToken
 * @param {Request} req
 * @returns {Promise<Object>}
 */
const refreshAuth = async (refreshToken: string, req: Request) => {
  try {
    const refreshTokenDoc = await tokenService.verifyToken(refreshToken, TokenType.REFRESH);
    const user = await userService.getUserById(refreshTokenDoc.userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }
    const tokens = await tokenService.generateAuthTokens(user as any, req);
    await tokenService.blacklistToken(refreshTokenDoc.id);
    return tokens;
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate');
  }
};

/**
 * Reset password
 * @param {string} resetPasswordToken
 * @param {string} newPassword
 * @param {Request} req
 * @returns {Promise}
 */
const resetPassword = async (resetPasswordToken: string, newPassword: string, req: Request) => {
  try {
    const resetPasswordTokenDoc = await tokenService.verifyToken(
      resetPasswordToken,
      TokenType.RESET_PASSWORD
    );
    const user = (await userService.getUserById(resetPasswordTokenDoc.userId)) as any;
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    await passwordSecurityService.updatePassword(user.id, newPassword);
    await securityService.logSecurityEvent({
      userId: user.id,
      ipAddress: req.ip || '',
      userAgent: req.get('User-Agent') || 'Unknown',
      eventType: SecurityEventType.PASSWORD_RESET_COMPLETED,
      success: true,
      details: { timestamp: new Date().toISOString() },
    });

    await tokenService.blacklistToken(resetPasswordTokenDoc.id);
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Password reset failed');
  }
};

/**
 * Reset password with OTP verification
 * @param {string} email
 * @param {string} newPassword
 * @param {Request} req
 * @returns {Promise}
 */
const resetPasswordByOtp = async (email: string, newPassword: string, req: Request) => {
  const user = await userService.getUserByEmail(email);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  await passwordSecurityService.updatePassword(user.id, newPassword);
  await securityService.logSecurityEvent({
    userId: user.id,
    ipAddress: req.ip || '',
    userAgent: req.get('User-Agent') || 'Unknown',
    eventType: SecurityEventType.PASSWORD_RESET_COMPLETED,
    success: true,
    details: {
      timestamp: new Date().toISOString(),
      method: 'OTP',
    },
  });
};

/**
 * Verify email
 * @param {string} verifyEmailToken
 * @returns {Promise}
 */
const verifyEmail = async (verifyEmailToken: string) => {
  try {
    const verifyEmailTokenDoc = await tokenService.verifyToken(
      verifyEmailToken,
      TokenType.VERIFY_EMAIL
    );
    const user = await userService.getUserById(verifyEmailTokenDoc.userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }
    await userService.updateUserById((user as any).id, { isEmailVerified: true });
    await tokenService.blacklistToken(verifyEmailTokenDoc.id);
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Email verification failed');
  }
};

/**
 * Change password
 * @param {string} userId
 * @param {string} oldPassword
 * @param {string} newPassword
 * @param {Request} req
 * @returns {Promise}
 */
const changePassword = async (
  userId: string,
  oldPassword: string,
  newPassword: string,
  req: Request
) => {
  const user = (await userService.getUserById(userId)) as any;
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!(await isPasswordMatch(oldPassword, (user as any).password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect password');
  }

  await passwordSecurityService.updatePassword(userId, newPassword);
  await securityService.logSecurityEvent({
    userId: userId,
    ipAddress: req.ip || '',
    userAgent: req.get('User-Agent') || 'Unknown',
    eventType: SecurityEventType.PASSWORD_CHANGE,
    success: true,
    details: { timestamp: new Date().toISOString() },
  });
};

/**
 * Setup two-factor authentication
 * @param {string} userId
 * @returns {Promise<Object>}
 */
const setupTwoFactor = async (userId: string) => {
  return twoFactorService.setupTwoFactor(userId);
};

/**
 * Enable two-factor authentication
 * @param {string} userId
 * @param {string} token
 * @param {Request} req
 * @returns {Promise}
 */
const enableTwoFactor = async (userId: string, token: string, req: Request) => {
  return twoFactorService.enableTwoFactor(userId, token);
};

/**
 * Disable two-factor authentication
 * @param {string} userId
 * @param {string} token
 * @param {Request} req
 * @returns {Promise}
 */
const disableTwoFactor = async (userId: string, token: string, req: Request) => {
  return twoFactorService.disableTwoFactor(userId, token);
};

/**
 * Get two-factor authentication status
 * @param {string} userId
 * @returns {Promise<Object>}
 */
const getTwoFactorStatus = async (userId: string) => {
  return twoFactorService.getTwoFactorStatus(userId);
};

/**
 * Regenerate backup codes
 * @param {string} userId
 * @param {string} token
 * @returns {Promise<Object>}
 */
const regenerateBackupCodes = async (userId: string, token: string) => {
  return twoFactorService.regenerateBackupCodes(userId, token);
};

/**
 * Check account lockout status
 * @param {string} email
 * @returns {Promise<Object>}
 */
const checkAccountLockout = async (email: string) => {
  const user = await userService.getUserByEmail(email);
  if (!user) {
    return { isLocked: false, lockoutUntil: null, failedAttempts: 0 };
  }

  return {
    isLocked: user.isLocked,
    lockoutUntil: user.lockoutUntil,
    failedAttempts: user.failedLoginAttempts,
  };
};

/**
 * Verify two-factor authentication token
 * @param {string} userId
 * @param {string} token
 * @returns {Promise<boolean>}
 */
const verifyTwoFactorToken = async (userId: string, token: string) => {
  return twoFactorService.verifyToken(userId, token);
};

/**
 * Get user by ID
 * @param {string} userId
 * @returns {Promise<User>}
 */
const getUserById = async (userId: string) => {
  return userService.getUserById(userId);
};

export default {
  loginUserWithEmailAndPassword,
  logout,
  refreshAuth,
  resetPassword,
  resetPasswordByOtp,
  verifyEmail,
  changePassword,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  getTwoFactorStatus,
  regenerateBackupCodes,
  checkAccountLockout,
  verifyTwoFactorToken,
  getUserById,
};
