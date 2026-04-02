import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import { deviceValidation } from '../../validations';
import { deviceController } from '../../controllers';

const router = express.Router();

// All device routes require authentication
router.use(auth());

/**
 * @route GET /v1/devices
 * @desc Get user devices
 * @access Private
 */
router.get('/', deviceController.getUserDevices);

/**
 * @route GET /v1/devices/sessions
 * @desc Get device sessions
 * @access Private
 */
router.get('/sessions', deviceController.getDeviceSessions);

/**
 * @route POST /v1/devices/:deviceId/trust
 * @desc Trust device
 * @access Private
 */
router.post(
  '/:deviceId/trust',
  validate(deviceValidation.trustDevice),
  deviceController.trustDevice
);

/**
 * @route DELETE /v1/devices/:deviceId
 * @desc Remove device
 * @access Private
 */
router.delete('/:deviceId', validate(deviceValidation.removeDevice), deviceController.removeDevice);

/**
 * @route DELETE /v1/devices
 * @desc Remove all other devices
 * @access Private
 */
router.delete(
  '/',
  validate(deviceValidation.removeAllOtherDevices),
  deviceController.removeAllOtherDevices
);

/**
 * @route GET /v1/devices/limit
 * @desc Check device limit
 * @access Private
 */
router.get('/limit', deviceController.checkDeviceLimit);

export default router;

/**
 * @swagger
 * tags:
 *   name: Device Management
 *   description: User device and session management
 */

/**
 * @swagger
 * /devices:
 *   get:
 *     summary: Get user's active devices
 *     description: Retrieve all active device sessions for the authenticated user
 *     tags: [Device Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Devices retrieved successfully
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
 *                   example: "Devices retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: Device ID
 *                       deviceId:
 *                         type: string
 *                         description: Unique device identifier
 *                       deviceName:
 *                         type: string
 *                         description: Human-readable device name
 *                       ipAddress:
 *                         type: string
 *                         description: IP address of the device
 *                       userAgent:
 *                         type: string
 *                         description: User agent string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         description: When the device was created
 *                       lastUsed:
 *                         type: string
 *                         format: date-time
 *                         description: When the device was last used
 *                       isTrusted:
 *                         type: boolean
 *                         description: Whether this device is trusted
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *   delete:
 *     summary: Logout from all other devices
 *     description: Revoke access for all devices except the current one
 *     tags: [Device Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentDeviceId
 *             properties:
 *               currentDeviceId:
 *                 type: string
 *                 description: ID of the current device to keep
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       "200":
 *         description: All other devices logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 removedCount:
 *                   type: integer
 *                   description: Number of devices removed
 *                   example: 2
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /devices/sessions:
 *   get:
 *     summary: Get device sessions
 *     description: Retrieve all active device sessions for the authenticated user
 *     tags: [Device Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Device sessions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   deviceId:
 *                     type: string
 *                     description: Unique device identifier
 *                   deviceName:
 *                     type: string
 *                     description: Human-readable device name
 *                   ipAddress:
 *                     type: string
 *                     description: IP address of the device
 *                   userAgent:
 *                     type: string
 *                     description: User agent string
 *                   isActive:
 *                     type: boolean
 *                     description: Whether the session is active
 *                   lastActivity:
 *                     type: string
 *                     format: date-time
 *                     description: Last activity timestamp
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /devices/limit:
 *   get:
 *     summary: Check device limit
 *     description: Check if user has reached the device limit
 *     tags: [Device Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 3
 *         description: Maximum number of devices allowed
 *     responses:
 *       "200":
 *         description: Device limit check completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 hasReachedLimit:
 *                   type: boolean
 *                   description: Whether user has reached device limit
 *                   example: false
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /devices/{deviceId}:
 *   delete:
 *     summary: Remove specific device
 *     description: Revoke access for a specific device session
 *     tags: [Device Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Device ID to remove
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       "204":
 *         description: Device removed successfully
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 * /devices/{deviceId}/trust:
 *   post:
 *     summary: Trust device
 *     description: Mark a device as trusted
 *     tags: [Device Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Device ID to trust
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       "200":
 *         description: Device trusted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: Device ID
 *                 isTrusted:
 *                   type: boolean
 *                   description: Trust status
 *                   example: true
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
