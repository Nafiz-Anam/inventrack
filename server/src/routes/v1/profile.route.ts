import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import { profileValidation } from '../../validations';
import { profileController } from '../../controllers';
import upload from '../../middlewares/upload';

const router = express.Router();

// All profile routes require authentication
router.use(auth());

/**
 * @route GET /v1/profile
 * @desc Get user profile
 * @access Private
 */
router.get('/', profileController.getUserProfile);

/**
 * @route PATCH /v1/profile
 * @desc Update user profile
 * @access Private
 */
router.patch('/', validate(profileValidation.updateProfile), profileController.updateUserProfile);

/**
 * @route GET /v1/profile/preferences
 * @desc Get user preferences
 * @access Private
 */
router.get('/preferences', profileController.getUserPreferences);

/**
 * @route PATCH /v1/profile/preferences
 * @desc Update user preferences
 * @access Private
 */
router.patch(
  '/preferences',
  validate(profileValidation.updatePreferences),
  profileController.updateUserPreferences
);

/**
 * @route GET /v1/profile/privacy
 * @desc Get privacy settings
 * @access Private
 */
router.get('/privacy', profileController.getPrivacySettings);

/**
 * @route PATCH /v1/profile/privacy
 * @desc Update privacy settings
 * @access Private
 */
router.patch(
  '/privacy',
  validate(profileValidation.updatePrivacySettings),
  profileController.updatePrivacySettings
);

/**
 * @route GET /v1/profile/account-status
 * @desc Get account status
 * @access Private
 */
router.get('/account-status', profileController.getAccountStatus);

/**
 * @route GET /v1/profile/stats
 * @desc Get user statistics
 * @access Private
 */
router.get('/stats', profileController.getUserStats);

/**
 * @route GET /v1/profile/export
 * @desc Export user data
 * @access Private
 */
router.get('/export', profileController.exportUserData);

/**
 * @route DELETE /v1/profile/account
 * @desc Delete user account
 * @access Private
 */
router.delete(
  '/account',
  validate(profileValidation.deleteAccount),
  profileController.deleteAccount
);

/**
 * @route POST /v1/profile/profile-picture
 * @desc Upload profile picture
 * @access Private
 */
router.post(
  '/profile-picture',
  upload.single('profilePicture'),
  validate(profileValidation.uploadProfilePicture),
  profileController.uploadProfilePicture
);

/**
 * @route DELETE /v1/profile/profile-picture
 * @desc Remove profile picture
 * @access Private
 */
router.delete('/profile-picture', profileController.removeProfilePicture);

export default router;
