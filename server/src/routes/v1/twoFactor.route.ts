import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import { twoFactorValidation } from '../../validations';
import { twoFactorController } from '../../controllers';
import { sensitiveOperationLimiter } from '../../middlewares/rateLimiter';

const router = express.Router();

/**
 * @route POST /v1/2fa/setup
 * @desc Setup 2FA for user
 * @access Private
 */
router.post('/setup', auth(), twoFactorController.setupTwoFactor);

/**
 * @route POST /v1/2fa/enable
 * @desc Enable 2FA for user
 * @access Private
 */
router.post(
  '/enable',
  auth(),
  validate(twoFactorValidation.enableTwoFactor),
  twoFactorController.enableTwoFactor
);

/**
 * @route POST /v1/2fa/disable
 * @desc Disable 2FA for user
 * @access Private
 */
router.post(
  '/disable',
  auth(),
  validate(twoFactorValidation.disableTwoFactor),
  twoFactorController.disableTwoFactor
);

/**
 * @route GET /v1/2fa/status
 * @desc Get 2FA status for user
 * @access Private
 */
router.get('/status', auth(), twoFactorController.getTwoFactorStatus);

/**
 * @route POST /v1/2fa/regenerate-backup-codes
 * @desc Regenerate backup codes for user
 * @access Private
 */
router.post(
  '/regenerate-backup-codes',
  auth(),
  validate(twoFactorValidation.regenerateBackupCodes),
  twoFactorController.regenerateBackupCodes
);

/**
 * @route POST /v1/2fa/verify
 * @desc Verify 2FA token
 * @access Public
 */
router.post('/verify', validate(twoFactorValidation.verifyToken), twoFactorController.verifyToken);

export default router;

/**
 * @swagger
 * tags:
 *   name: Two-Factor Authentication
 *   description: 2FA/MFA management endpoints
 */

/**
 * @swagger
 * /two-factor/setup:
 *   post:
 *     summary: Setup 2FA
 *     description: Generate a new TOTP secret and QR code for 2FA setup
 *     tags: [Two-Factor Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: 2FA setup initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: "2FA setup initiated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     secret:
 *                       type: string
 *                       description: TOTP secret key
 *                     qrCode:
 *                       type: string
 *                       description: QR code data URL
 *                     backupCodes:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Backup codes for account recovery
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /two-factor/enable:
 *   post:
 *     summary: Enable 2FA
 *     description: Enable 2FA for the authenticated user
 *     tags: [Two-Factor Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: 6-digit TOTP token from authenticator app
 *                 example: "123456"
 *     responses:
 *       "200":
 *         description: 2FA enabled successfully
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /two-factor/disable:
 *   post:
 *     summary: Disable 2FA
 *     description: Disable 2FA for the authenticated user
 *     tags: [Two-Factor Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: 6-digit TOTP token from authenticator app
 *                 example: "123456"
 *     responses:
 *       "200":
 *         description: 2FA disabled successfully
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /two-factor/regenerate-backup-codes:
 *   post:
 *     summary: Regenerate backup codes
 *     description: Generate new backup codes for account recovery
 *     tags: [Two-Factor Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: 6-digit TOTP token from authenticator app
 *                 example: "123456"
 *     responses:
 *       "200":
 *         description: Backup codes regenerated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: "Backup codes regenerated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     backupCodes:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: New backup codes
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /two-factor/status:
 *   get:
 *     summary: Get 2FA status
 *     description: Get the current 2FA status for the authenticated user
 *     tags: [Two-Factor Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: 2FA status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: "2FA status retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     enabled:
 *                       type: boolean
 *                       description: Whether 2FA is enabled
 *                     verified:
 *                       type: boolean
 *                       description: Whether 2FA setup is completed
 *                     hasBackupCodes:
 *                       type: boolean
 *                       description: Whether backup codes are available
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
