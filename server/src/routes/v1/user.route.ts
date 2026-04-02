import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import { userValidation } from '../../validations';
import { userController } from '../../controllers';
import { Role } from '../../config/roles';

const router = express.Router();

/**
 * @route POST /v1/users
 * @desc Create user (Admin only)
 * @access Private (Admin only)
 */
router.post('/', auth('manageUsers'), validate(userValidation.createUser), userController.createUser);

/**
 * @route GET /v1/users
 * @desc Get users (Admin only)
 * @access Private (Admin only)
 */
router.get('/', auth('manageUsers'), validate(userValidation.getUsers), userController.getUsers);

/**
 * @route GET /v1/users/:userId
 * @desc Get user
 * @access Private
 */
router.get('/:userId', auth(), validate(userValidation.getUser), userController.getUser);

/**
 * @route PATCH /v1/users/:userId
 * @desc Update user
 * @access Private
 */
router.patch('/:userId', auth('manageUsers'), validate(userValidation.updateUser), userController.updateUser);

/**
 * @route DELETE /v1/users/:userId
 * @desc Delete user (Admin only)
 * @access Private (Admin only)
 */
router.delete(
  '/:userId',
  auth('manageUsers'),
  validate(userValidation.deleteUser),
  userController.deleteUser
);

/**
 * @route GET /v1/users/:userId/profile
 * @desc Get user profile
 * @access Private
 */
router.get(
  '/:userId/profile',
  auth(),
  validate(userValidation.getUserProfile),
  userController.getUserProfile
);

/**
 * @route PATCH /v1/users/:userId/profile
 * @desc Update user profile
 * @access Private
 */
router.patch(
  '/:userId/profile',
  auth(),
  validate(userValidation.updateUserProfile),
  userController.updateUserProfile
);

/**
 * @route GET /v1/users/:userId/preferences
 * @desc Get user preferences
 * @access Private
 */
router.get(
  '/:userId/preferences',
  auth(),
  validate(userValidation.getUserPreferences),
  userController.getUserPreferences
);

/**
 * @route PATCH /v1/users/:userId/preferences
 * @desc Update user preferences
 * @access Private
 */
router.patch(
  '/:userId/preferences',
  auth(),
  validate(userValidation.updateUserPreferences),
  userController.updateUserPreferences
);

/**
 * @route GET /v1/users/:userId/privacy
 * @desc Get user privacy settings
 * @access Private
 */
router.get(
  '/:userId/privacy',
  auth(),
  validate(userValidation.getPrivacySettings),
  userController.getPrivacySettings
);

/**
 * @route PATCH /v1/users/:userId/privacy
 * @desc Update user privacy settings
 * @access Private
 */
router.patch(
  '/:userId/privacy',
  auth(),
  validate(userValidation.updatePrivacySettings),
  userController.updatePrivacySettings
);

/**
 * @route GET /v1/users/:userId/account-status
 * @desc Get user account status
 * @access Private
 */
router.get(
  '/:userId/account-status',
  auth(),
  validate(userValidation.getAccountStatus),
  userController.getAccountStatus
);

/**
 * @route GET /v1/users/:userId/stats
 * @desc Get user statistics
 * @access Private
 */
router.get(
  '/:userId/stats',
  auth(),
  validate(userValidation.getUserStats),
  userController.getUserStats
);

/**
 * @route GET /v1/users/:userId/activity
 * @desc Get user activity
 * @access Private
 */
router.get(
  '/:userId/activity',
  auth(),
  validate(userValidation.getUserActivity),
  userController.getUserActivity
);

/**
 * @route GET /v1/users/:userId/activity/stats
 * @desc Get user activity statistics
 * @access Private
 */
router.get(
  '/:userId/activity/stats',
  auth(),
  validate(userValidation.getActivityStats),
  userController.getActivityStats
);

/**
 * @route GET /v1/users/:userId/devices
 * @desc Get user devices
 * @access Private
 */
router.get(
  '/:userId/devices',
  auth(),
  validate(userValidation.getUserDevices),
  userController.getUserDevices
);

/**
 * @route GET /v1/users/:userId/devices/sessions
 * @desc Get user device sessions
 * @access Private
 */
router.get(
  '/:userId/devices/sessions',
  auth(),
  validate(userValidation.getDeviceSessions),
  userController.getDeviceSessions
);

/**
 * @route POST /v1/users/:userId/devices/:deviceId/trust
 * @desc Trust device
 * @access Private
 */
router.post(
  '/:userId/devices/:deviceId/trust',
  auth(),
  validate(userValidation.trustDevice),
  userController.trustDevice
);

/**
 * @route DELETE /v1/users/:userId/devices/:deviceId
 * @desc Remove device
 * @access Private
 */
router.delete(
  '/:userId/devices/:deviceId',
  auth(),
  validate(userValidation.removeDevice),
  userController.removeDevice
);

/**
 * @route DELETE /v1/users/:userId/devices
 * @desc Remove all other devices
 * @access Private
 */
router.delete(
  '/:userId/devices',
  auth(),
  validate(userValidation.removeAllOtherDevices),
  userController.removeAllOtherDevices
);

/**
 * @route GET /v1/users/:userId/notifications
 * @desc Get user notifications
 * @access Private
 */
router.get(
  '/:userId/notifications',
  auth(),
  validate(userValidation.getUserNotifications),
  userController.getUserNotifications
);

/**
 * @route PATCH /v1/users/:userId/notifications/:notificationId/read
 * @desc Mark notification as read
 * @access Private
 */
router.patch(
  '/:userId/notifications/:notificationId/read',
  auth(),
  validate(userValidation.markNotificationAsRead),
  userController.markNotificationAsRead
);

/**
 * @route PATCH /v1/users/:userId/notifications/read-all
 * @desc Mark all notifications as read
 * @access Private
 */
router.patch('/:userId/notifications/read-all', auth(), userController.markAllNotificationsAsRead);

/**
 * @route DELETE /v1/users/:userId/notifications/:notificationId
 * @desc Delete notification
 * @access Private
 */
router.delete(
  '/:userId/notifications/:notificationId',
  auth(),
  validate(userValidation.deleteNotification),
  userController.deleteNotification
);

/**
 * @route DELETE /v1/users/:userId/notifications/read
 * @desc Delete read notifications
 * @access Private
 */
router.delete('/:userId/notifications/read', auth(), userController.deleteReadNotifications);

/**
 * @route GET /v1/users/:userId/notifications/stats
 * @desc Get notification statistics
 * @access Private
 */
router.get('/:userId/notifications/stats', auth(), userController.getNotificationStats);

/**
 * @route GET /v1/users/:userId/security-logs
 * @desc Get user security logs
 * @access Private
 */
router.get(
  '/:userId/security-logs',
  auth(),
  validate(userValidation.getSecurityLogs),
  userController.getSecurityLogs
);

/**
 * @route GET /v1/users/:userId/security-logs/stats
 * @desc Get security statistics
 * @access Private
 */
router.get(
  '/:userId/security-logs/stats',
  auth(),
  validate(userValidation.getSecurityStats),
  userController.getSecurityStats
);

/**
 * @route GET /v1/users/:userId/public
 * @desc Get public profile
 * @access Public
 */
router.get(
  '/:userId/public',
  validate(userValidation.getPublicProfile),
  userController.getPublicProfile
);

/**
 * @route GET /v1/users/:userId/export
 * @desc Export user data
 * @access Private
 */
router.get(
  '/:userId/export',
  auth(),
  validate(userValidation.exportUserData),
  userController.exportUserData
);

/**
 * @route DELETE /v1/users/:userId/account
 * @desc Delete user account
 * @access Private
 */
router.delete(
  '/:userId/account',
  auth(),
  validate(userValidation.deleteAccount),
  userController.deleteAccount
);

// Admin-only routes
/**
 * @route GET /v1/users/expiring-passwords
 * @desc Get users with expiring passwords (Admin only)
 * @access Private (Admin only)
 */
router.get(
  '/expiring-passwords',
  auth(Role.ADMIN),
  validate(userValidation.getUsersWithExpiringPasswords),
  userController.getUsersWithExpiringPasswords
);

/**
 * @route GET /v1/users/locked
 * @desc Get locked users (Admin only)
 * @access Private (Admin only)
 */
router.get('/locked', auth(Role.ADMIN), userController.getLockedUsers);

/**
 * @route PATCH /v1/users/:userId/unlock
 * @desc Unlock user account (Admin only)
 * @access Private (Admin only)
 */
router.patch(
  '/:userId/unlock',
  auth(Role.ADMIN),
  validate(userValidation.unlockUserAccount),
  userController.unlockUserAccount
);

/**
 * @route PATCH /v1/users/:userId/force-password-change
 * @desc Force password change (Admin only)
 * @access Private (Admin only)
 */
router.patch(
  '/:userId/force-password-change',
  auth(Role.ADMIN),
  validate(userValidation.forcePasswordChange),
  userController.forcePasswordChange
);

/**
 * @route GET /v1/users/export
 * @desc Export users list (Admin only)
 * @access Private (Admin only)
 */
router.get(
  '/export',
  auth(Role.ADMIN),
  validate(userValidation.exportUsers),
  userController.exportUsers
);

export default router;

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management and retrieval operations
 */

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create a new user
 *     description: Only administrators can create new users. This endpoint creates a user with the specified role and details.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserCreate'
 *           example:
 *             email: "newuser@example.com"
 *             name: "New User"
 *             password: "password123"
 *             role: "USER"
 *     responses:
 *       "201":
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 message:
 *                   type: string
 *                   example: "User created successfully"
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *
 *   get:
 *     summary: Get all users with pagination
 *     description: Retrieve a paginated list of users. Only administrators can access this endpoint.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter users by name (partial match)
 *         example: "john"
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *         description: Filter users by email (partial match)
 *         example: "user@example.com"
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [USER, ADMIN]
 *         description: Filter users by role
 *         example: "USER"
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Sort by field in format field:direction (e.g., name:asc, createdAt:desc)
 *         example: "createdAt:desc"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         default: 10
 *         description: Maximum number of users per page
 *         example: 20
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         default: 1
 *         description: Page number
 *         example: 1
 *     responses:
 *       "200":
 *         description: List of users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /users/{userId}:
 *   get:
 *     summary: Get a specific user by ID
 *     description: Retrieve user details by ID. Users can only access their own information unless they are administrators.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *         example: 1
 *     responses:
 *       "200":
 *         description: User details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 *   patch:
 *     summary: Update a user
 *     description: Update user information. Users can only update their own information unless they are administrators.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserUpdate'
 *           example:
 *             name: "Updated Name"
 *             email: "updated@example.com"
 *             role: "ADMIN"
 *     responses:
 *       "200":
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *
 *   delete:
 *     summary: Delete a user
 *     description: Permanently delete a user. Only administrators can delete users.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *         example: 1
 *     responses:
 *       "204":
 *         description: User deleted successfully
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
