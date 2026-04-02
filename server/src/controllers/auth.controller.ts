import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import { sendSuccess, sendCreated, ErrorCode } from '../utils/apiResponse';
import ApiError from '../utils/ApiError';
import authService from '../services/auth.service';
import tokenService from '../services/token.service';
import emailService from '../services/email.service';
import userService from '../services/user.service';
import {
  createEmailVerificationOtp,
  createPasswordResetOtpByEmail,
  verifyPasswordResetOtpByEmail,
  resendEmailVerificationOtp as resendEmailOtp,
  resendPasswordResetOtpByEmail as resendPasswordOtp,
  generateOtpVerificationToken,
  verifyOtpWithToken,
} from '../services/otp.service';
import { sendEmailVerificationOtp, sendPasswordResetOtp } from '../services/email.service';
import deviceService from '../services/device.service';
import { passwordSecurityService } from '../services';
import { Request, Response } from 'express';

/**
 * Register user
 * @route POST /v1/auth/register
 * @access Public
 */
const register = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.createUser(req.body);
  // Fetch user from DB to get hashed password
  const dbUser = (await userService.getUserById(user.id)) as any;
  if (dbUser && dbUser.password) {
    await passwordSecurityService.addPasswordToHistory(user.id, dbUser.password);
  }
  // Generate OTP verification token
  const token = await generateOtpVerificationToken(user.id);
  const otp = await createEmailVerificationOtp(user.id);

  // Try to send email, but don't fail if email service is down
  try {
    await sendEmailVerificationOtp(user.email, otp, user.name || 'User');
  } catch (emailError) {
    // Log the error but continue with user creation
    console.warn('Email service unavailable, user created without email verification:', emailError);
  }

  return sendCreated(
    res,
    { user, verificationToken: token },
    'User registered successfully. Please check your email for verification.',
    req.requestId
  );
});

/**
 * Login user
 * @route POST /v1/auth/login
 * @access Public
 */
const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { user, tokens } = await authService.loginUserWithEmailAndPassword(email, password, req);
  return sendSuccess(res, { user, tokens }, 'Login successful', httpStatus.OK, req.requestId);
});

/**
 * Logout
 * @route POST /v1/auth/logout
 * @access Private
 */
const logout = catchAsync(async (req: Request, res: Response) => {
  // Use req.user.id if available, otherwise extract from token if needed
  const userId = (req.user as any)?.id;
  await authService.logout(req.body.refreshToken, req, userId);
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Refresh tokens
 * @route POST /v1/auth/refresh-tokens
 * @access Public
 */
const refreshTokens = catchAsync(async (req: Request, res: Response) => {
  const tokens = await authService.refreshAuth(req.body.refreshToken, req);
  res.send({ tokens });
});

/**
 * Forgot password
 * @route POST /v1/auth/forgot-password
 * @access Public
 */
const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;

  // Generate token for link-based reset (primary method)
  const resetPasswordToken = await tokenService.generateResetPasswordToken(email);

  // Generate OTP for OTP-based reset (secondary method)
  const resetPasswordOtp = await createPasswordResetOtpByEmail(email);

  // Get user details for email
  const user = await userService.getUserByEmail(email);
  const userName = user?.name || 'User';

  // Send both email types
  await Promise.all([
    emailService.sendResetPasswordEmail(email, resetPasswordToken, userName),
    emailService.sendPasswordResetOtp(email, resetPasswordOtp, userName),
  ]);

  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Reset password
 * @route POST /v1/auth/reset-password
 * @access Public
 */
const resetPassword = catchAsync(async (req: Request, res: Response) => {
  await authService.resetPassword(req.query.token as string, req.body.password, req);
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Reset password with OTP
 * @route POST /v1/auth/reset-password-otp
 * @access Public
 */
const resetPasswordWithOtp = catchAsync(async (req: Request, res: Response) => {
  const { email, otp, password } = req.body;

  // Verify OTP first
  const isValidOtp = await verifyPasswordResetOtpByEmail(email, otp);
  if (!isValidOtp) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid or expired OTP');
  }

  // Reset password using auth service
  await authService.resetPasswordByOtp(email, password, req);

  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Verify password reset OTP (before showing reset form)
 * @route POST /v1/auth/verify-reset-otp
 * @access Public
 */
const verifyResetOtp = catchAsync(async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  const isValidOtp = await verifyPasswordResetOtpByEmail(email, otp);
  if (!isValidOtp) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid or expired OTP');
  }

  res.status(httpStatus.OK).send({ message: 'OTP verified successfully' });
});

/**
 * Send verification email
 * @route POST /v1/auth/send-verification-email
 * @access Private
 */
const sendVerificationEmail = catchAsync(async (req: Request, res: Response) => {
  const verifyEmailToken = await tokenService.generateVerifyEmailToken(req.user as any);
  await emailService.sendVerificationEmail(
    (req.user as any).email,
    verifyEmailToken,
    (req.user as any).name || 'User'
  );
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Verify email
 * @route POST /v1/auth/verify-email
 * @access Public
 */
const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  await authService.verifyEmail(req.query.token as string);
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Change password
 * @route POST /v1/auth/change-password
 * @access Private
 */
const changePassword = catchAsync(async (req: Request, res: Response) => {
  await authService.changePassword(
    (req.user as any).id,
    req.body.oldPassword,
    req.body.newPassword,
    req
  );
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Verify 2FA and complete login
 * @route POST /v1/auth/verify-2fa
 * @access Public
 */
const verifyTwoFactor = catchAsync(async (req: Request, res: Response) => {
  const { userId, token } = req.body;

  const isValid = await authService.verifyTwoFactorToken(userId, token);

  if (!isValid) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid 2FA token');
  }

  const user = await authService.getUserById(userId);
  const tokens = await tokenService.generateAuthTokens(user as any, req);

  res.send({
    user: tokens.user,
    tokens: tokens.access,
    device: tokens.device,
  });
});

/**
 * Setup 2FA
 * @route POST /v1/auth/2fa/setup
 * @access Private
 */
const setupTwoFactor = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.setupTwoFactor((req.user as any).id);
  res.send(result);
});

/**
 * Enable 2FA
 * @route POST /v1/auth/2fa/enable
 * @access Private
 */
const enableTwoFactor = catchAsync(async (req: Request, res: Response) => {
  await authService.enableTwoFactor((req.user as any).id, req.body.token, req);
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Disable 2FA
 * @route POST /v1/auth/2fa/disable
 * @access Private
 */
const disableTwoFactor = catchAsync(async (req: Request, res: Response) => {
  await authService.disableTwoFactor((req.user as any).id, req.body.token, req);
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Get 2FA status
 * @route GET /v1/auth/2fa/status
 * @access Private
 */
const getTwoFactorStatus = catchAsync(async (req: Request, res: Response) => {
  const status = await authService.getTwoFactorStatus((req.user as any).id);
  res.send(status);
});

/**
 * Regenerate 2FA backup codes
 * @route POST /v1/auth/2fa/regenerate-backup-codes
 * @access Private
 */
const regenerateBackupCodes = catchAsync(async (req: Request, res: Response) => {
  const backupCodes = await authService.regenerateBackupCodes((req.user as any).id, req.body.token);
  res.send({ backupCodes });
});

/**
 * Check account lockout status
 * @route GET /v1/auth/account-lockout-status
 * @access Public
 */
const checkAccountLockoutStatus = catchAsync(async (req: Request, res: Response) => {
  const status = await authService.checkAccountLockout(req.query.email as string);
  res.send(status);
});

/**
 * Verify email OTP
 * @route POST /v1/auth/verify-email-otp
 * @access Public
 */
/**
 * Resend email verification OTP
 * @route POST /v1/auth/resend-email-verification
 * @access Public
 */
const resendEmailVerification = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;

  // Find user by email
  const user = await userService.getUserByEmail(email);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Check if email is already verified
  if (user.isEmailVerified) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email is already verified');
  }

  // Generate and send new OTP (will throw error if existing OTP is still valid)
  try {
    const otp = await resendEmailOtp(user.id);

    // Try to send email, but don't fail if email service is down
    try {
      await sendEmailVerificationOtp(user.email, otp, user.name || 'User');
    } catch (emailError) {
      // Log the error but continue with OTP generation
      console.warn('Email service unavailable, OTP generated but not sent:', emailError);
    }

    return sendSuccess(
      res,
      { message: 'Verification OTP sent successfully' },
      'Please check your email for the verification code.',
      httpStatus.OK,
      req.requestId
    );
  } catch (otpError) {
    throw new ApiError(httpStatus.TOO_MANY_REQUESTS, otpError.message);
  }
});

/**
 * Resend password reset OTP
 * @route POST /v1/auth/resend-password-reset
 * @access Public
 */
const resendPasswordReset = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;

  // Find user by email
  const user = await userService.getUserByEmail(email);
  if (!user) {
    // For security, don't reveal if email exists or not
    return sendSuccess(
      res,
      { message: 'If the email exists, a reset code will be sent' },
      'Please check your email for the password reset code.',
      httpStatus.OK,
      req.requestId
    );
  }

  // Generate and send new OTP (will throw error if existing OTP is still valid)
  try {
    const otp = await resendPasswordOtp(user.id);

    // Try to send email, but don't fail if email service is down
    try {
      await sendPasswordResetOtp(email, otp, user.name || 'User');
    } catch (emailError) {
      // Log the error but continue with OTP generation
      console.warn('Email service unavailable, OTP generated but not sent:', emailError);
    }

    return sendSuccess(
      res,
      { message: 'Password reset OTP sent successfully' },
      'Please check your email for the password reset code.',
      httpStatus.OK,
      req.requestId
    );
  } catch (otpError) {
    throw new ApiError(httpStatus.TOO_MANY_REQUESTS, otpError.message);
  }
});

/**
 * Verify email OTP
 * @route POST /v1/auth/verify-email-otp
 * @access Public
 */
const verifyEmailOtp = catchAsync(async (req: Request, res: Response) => {
  const { token, otp } = req.body;

  // Enhanced validation
  if (!token || !otp) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Token and OTP are required');
  }

  // Validate OTP format (6 digits)
  if (!/^\d{6}$/.test(otp)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'OTP must be exactly 6 digits');
  }

  // Validate JWT token format
  if (!/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(token)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid token format');
  }

  const valid = await verifyOtpWithToken(token, otp);
  if (!valid) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired token/OTP combination');
  }

  return sendSuccess(
    res,
    { verified: true },
    'Email verified successfully',
    httpStatus.OK,
    req.requestId
  );
});

const listActiveSessions = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  if (!userId) throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  const sessions = await deviceService.listActiveDeviceSessions(userId);
  res.send({ sessions });
});

const endSession = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const { deviceId } = req.body;
  if (!userId || !deviceId)
    throw new ApiError(httpStatus.BAD_REQUEST, 'Missing userId or deviceId');
  await require('../services/token.service').endUserSession(userId, deviceId);
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Manually trigger token cleanup (admin only)
 * @route POST /v1/auth/admin/cleanup-tokens
 * @access Private (Admin)
 */
const cleanupTokens = catchAsync(async (req: Request, res: Response) => {
  const stats = await require('../services/tokenCleanup.service').cleanupExpiredTokens();
  res.send({
    message: 'Token cleanup completed successfully',
    stats,
  });
});

/**
 * Get token statistics (admin only)
 * @route GET /v1/auth/admin/token-stats
 * @access Private (Admin)
 */
const getTokenStats = catchAsync(async (req: Request, res: Response) => {
  const stats = await require('../services/tokenCleanup.service').getTokenStatistics();
  res.send(stats);
});

/**
 * Get performance statistics (admin only)
 * @route GET /v1/auth/admin/performance-stats
 * @access Private (Admin)
 */
const getPerformanceStats = catchAsync(async (req: Request, res: Response) => {
  const stats = require('../services/performanceMonitoring.service').getEndpointStats();
  res.send(Object.fromEntries(stats));
});

/**
 * Get system performance overview (admin only)
 * @route GET /v1/auth/admin/system-performance
 * @access Private (Admin)
 */
const getSystemPerformance = catchAsync(async (req: Request, res: Response) => {
  const performance = require('../services/performanceMonitoring.service').getSystemPerformance();
  res.send(performance);
});

/**
 * Get performance alerts (admin only)
 * @route GET /v1/auth/admin/performance-alerts
 * @access Private (Admin)
 */
const getPerformanceAlerts = catchAsync(async (req: Request, res: Response) => {
  const alerts = require('../services/performanceMonitoring.service').getPerformanceAlerts();
  res.send(alerts);
});

export default {
  register,
  login,
  verifyTwoFactor,
  logout,
  refreshTokens,
  forgotPassword,
  resetPassword,
  resetPasswordWithOtp,
  verifyResetOtp,
  sendVerificationEmail,
  verifyEmail,
  changePassword,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  getTwoFactorStatus,
  regenerateBackupCodes,
  checkAccountLockoutStatus,
  verifyEmailOtp,
  resendEmailVerification,
  resendPasswordReset,
  listActiveSessions,
  endSession,
  cleanupTokens,
  getTokenStats,
  getPerformanceStats,
  getSystemPerformance,
  getPerformanceAlerts,
};
