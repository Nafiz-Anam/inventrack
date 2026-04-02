import express from 'express';
import httpStatus from 'http-status';
import validate from '../../middlewares/validate';
import { authValidation } from '../../validations';
import { authController } from '../../controllers';
import auth from '../../middlewares/auth';
import {
  progressiveAuthLimiter,
  progressivePasswordResetLimiter,
  progressiveRegistrationLimiter,
  resetRateLimit,
  getRateLimitStats,
} from '../../middlewares/progressiveRateLimiter';
import { ipSecurityMiddleware, adminIPSecurity } from '../../middlewares/ipSecurity';
import { requireCaptcha, generateCaptcha } from '../../middlewares/captcha';
import logger from '../../config/logger';

const router = express.Router();

/**
 * @route POST /v1/auth/register
 * @desc Register user
 * @access Public
 */
router.post(
  '/register',
  validate(authValidation.register),
  authController.register
);

/**
 * @route POST /v1/auth/login
 * @desc Login user
 * @access Public
 */
router.post(
  '/login',
  validate(authValidation.login),
  authController.login
);

/**
 * @route POST /v1/auth/verify-2fa
 * @desc Verify 2FA and complete login
 * @access Public
 */
router.post(
  '/verify-2fa',
  validate(authValidation.verifyTwoFactor),
  authController.verifyTwoFactor
);

/**
 * @route POST /v1/auth/logout
 * @desc Logout user
 * @access Private
 */
router.post(
  '/logout',
  auth(),
  validate(authValidation.logout),
  authController.logout
);

/**
 * @route POST /v1/auth/refresh-tokens
 * @desc Refresh auth tokens
 * @access Public
 */
router.post(
  '/refresh-tokens',
  validate(authValidation.refreshTokens),
  authController.refreshTokens
);

/**
 * @route POST /v1/auth/forgot-password
 * @desc Forgot password
 * @access Public
 */
router.post(
  '/forgot-password',
  validate(authValidation.forgotPassword),
  authController.forgotPassword
);

/**
 * @route POST /v1/auth/reset-password
 * @desc Reset password
 * @access Public
 */
router.post(
  '/reset-password',
  validate(authValidation.resetPassword),
  authController.resetPassword
);

/**
 * @route POST /v1/auth/reset-password-otp
 * @desc Reset password with OTP
 * @access Public
 */
router.post(
  '/reset-password-otp',
  validate(authValidation.resetPasswordWithOtp),
  authController.resetPasswordWithOtp
);

/**
 * @route POST /v1/auth/verify-reset-otp
 * @desc Verify password reset OTP
 * @access Public
 */
router.post(
  '/verify-reset-otp',
  validate(authValidation.verifyResetOtp),
  authController.verifyResetOtp
);

/**
 * @route POST /v1/auth/send-verification-email
 * @desc Send verification email
 * @access Private
 */
router.post('/send-verification-email', auth(), authController.sendVerificationEmail);

/**
 * @route POST /v1/auth/verify-email
 * @desc Verify email
 * @access Public
 */
router.post('/verify-email', validate(authValidation.verifyEmail), authController.verifyEmail);

/**
 * @route POST /v1/auth/verify-email-otp
 * @desc Verify email using OTP
 * @access Public
 */
router.post(
  '/verify-email-otp',
  validate(authValidation.verifyEmailOtpWithValidation),
  authController.verifyEmailOtp
);

/**
 * @route POST /v1/auth/resend-email-verification
 * @desc Resend email verification OTP
 * @access Public
 */
router.post(
  '/resend-email-verification',
  validate(authValidation.resendEmailVerificationOtp),
  authController.resendEmailVerification
);

/**
 * @route POST /v1/auth/resend-password-reset
 * @desc Resend password reset OTP
 * @access Public
 */
router.post(
  '/resend-password-reset',
  validate(authValidation.resendPasswordResetOtp),
  authController.resendPasswordReset
);

/**
 * @route POST /v1/auth/change-password
 * @desc Change password
 * @access Private
 */
router.post(
  '/change-password',
  auth(),
  validate(authValidation.changePassword),
  authController.changePassword
);

/**
 * @route POST /v1/auth/2fa/setup
 * @desc Setup 2FA
 * @access Private
 */
router.post('/2fa/setup', auth(), authController.setupTwoFactor);

/**
 * @route POST /v1/auth/2fa/enable
 * @desc Enable 2FA
 * @access Private
 */
router.post(
  '/2fa/enable',
  auth(),
  validate(authValidation.enableTwoFactor),
  authController.enableTwoFactor
);

/**
 * @route POST /v1/auth/2fa/disable
 * @desc Disable 2FA
 * @access Private
 */
router.post(
  '/2fa/disable',
  auth(),
  validate(authValidation.disableTwoFactor),
  authController.disableTwoFactor
);

/**
 * @route GET /v1/auth/2fa/status
 * @desc Get 2FA status
 * @access Private
 */
router.get('/2fa/status', auth(), authController.getTwoFactorStatus);

/**
 * @route POST /v1/auth/2fa/regenerate-backup-codes
 * @desc Regenerate 2FA backup codes
 * @access Private
 */
router.post(
  '/2fa/regenerate-backup-codes',
  auth(),
  validate(authValidation.regenerateBackupCodes),
  authController.regenerateBackupCodes
);

/**
 * @route GET /v1/auth/account-lockout-status
 * @desc Check account lockout status
 * @access Public
 */
router.get(
  '/account-lockout-status',
  validate(authValidation.checkAccountLockout),
  authController.checkAccountLockoutStatus
);

router.get('/sessions', auth(), authController.listActiveSessions);
router.post('/sessions/end', auth(), authController.endSession);

/**
 * @route POST /v1/auth/admin/cleanup-tokens
 * @desc Manually trigger token cleanup (admin only)
 * @access Private (Admin)
 */
router.post('/admin/cleanup-tokens', auth('manageUsers'), authController.cleanupTokens);

/**
 * @route POST /v1/auth/admin/reset-rate-limit
 * @desc Reset rate limit for user (admin only)
 * @access Private (Admin)
 */
router.post('/admin/reset-rate-limit', auth('manageUsers'), resetRateLimit('auth'));

/**
 * @route GET /v1/auth/admin/rate-limit-stats
 * @desc Get rate limit statistics (admin only)
 * @access Private (Admin)
 */
router.get('/admin/rate-limit-stats', auth('manageUsers'), getRateLimitStats('auth'));

/**
 * @route GET /v1/auth/admin/performance-stats
 * @desc Get performance statistics (admin only)
 * @access Private (Admin)
 */
router.get('/admin/performance-stats', auth('manageUsers'), authController.getPerformanceStats);

/**
 * @route GET /v1/auth/admin/system-performance
 * @desc Get system performance overview (admin only)
 * @access Private (Admin)
 */
router.get('/admin/system-performance', auth('manageUsers'), authController.getSystemPerformance);

/**
 * @route GET /v1/auth/admin/performance-alerts
 * @desc Get performance alerts (admin only)
 * @access Private (Admin)
 */
router.get('/admin/performance-alerts', auth('manageUsers'), authController.getPerformanceAlerts);

/**
 * @route POST /v1/auth/admin/clear-ip-cache
 * @desc Clear IP security cache (admin only)
 * @access Private (Admin)
 */
router.post('/admin/clear-ip-cache', auth('manageUsers'), adminIPSecurity);

/**
 * @route GET /v1/auth/admin/ip-stats
 * @desc Get IP security statistics (admin only)
 * @access Private (Admin)
 */
router.get('/admin/ip-stats', auth('manageUsers'), adminIPSecurity);

/**
 * @route POST /v1/auth/admin/captcha-config
 * @desc Update CAPTCHA configuration (admin only)
 * @access Private (Admin)
 */
router.post('/admin/captcha-config', auth('manageUsers'), async (req, res) => {
  // Only allow admin users
  if ((req.user as any)?.role !== 'ADMIN') {
    return res.status(httpStatus.FORBIDDEN).json({
      error: 'Access denied',
      message: 'Admin access required',
    });
  }

  try {
    const captchaService = (await import('../../services/captcha.service')).default;
    captchaService.updateConfig(req.body);

    res.json({
      success: true,
      message: 'CAPTCHA configuration updated successfully',
    });
  } catch (error) {
    logger.error('Update CAPTCHA config error', { error });
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      error: 'Internal server error',
      message: 'Failed to update CAPTCHA configuration',
    });
  }
});

/**
 * @route GET /v1/auth/captcha/generate
 * @desc Generate CAPTCHA challenge
 * @access Public
 */
router.get('/captcha/generate', generateCaptcha);

export default router;

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication and authorization endpoints
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Create a new user account with email, name, and password. The user will be created with USER role by default.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *           example:
 *             email: "newuser@example.com"
 *             name: "John Doe"
 *             password: "password123"
 *     responses:
 *       "201":
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 tokens:
 *                   $ref: '#/components/schemas/AuthTokens'
 *                 message:
 *                   type: string
 *                   example: "User registered successfully"
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     description: Authenticate user with email and password to receive access and refresh tokens.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           example:
 *             email: "user@example.com"
 *             password: "password123"
 *     responses:
 *       "200":
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 tokens:
 *                   $ref: '#/components/schemas/AuthTokens'
 *                 message:
 *                   type: string
 *                   example: "Login successful"
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               code: 401
 *               message: "Invalid email or password"
 */

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     description: Invalidate the refresh token to log out the user.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *           example:
 *             refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       "204":
 *         description: Logout successful
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /auth/refresh-tokens:
 *   post:
 *     summary: Refresh authentication tokens
 *     description: Get new access and refresh tokens using a valid refresh token.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *           example:
 *             refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       "200":
 *         description: Tokens refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthTokens'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     description: Send a password reset email to the user's email address.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordRequest'
 *           example:
 *             email: "user@example.com"
 *     responses:
 *       "200":
 *         description: Password reset email sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Password reset email sent"
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password
 *     description: Reset user password using the token received via email.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordRequest'
 *           example:
 *             token: "reset-token-here"
 *             password: "newpassword123"
 *     responses:
 *       "200":
 *         description: Password reset successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Password reset successful"
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */

/**
 * @swagger
 * /auth/send-verification-email:
 *   post:
 *     summary: Send email verification
 *     description: Send a verification email to the authenticated user's email address.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Verification email sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Verification email sent"
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "409":
 *         description: Email already verified
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               code: 409
 *               message: "Email already verified"
 */

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: Verify email address
 *     description: Verify user's email address using the token received via email.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyEmailRequest'
 *           example:
 *             token: "verification-token-here"
 *     responses:
 *       "200":
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Email verified successfully"
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
