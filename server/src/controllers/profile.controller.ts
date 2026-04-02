import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import { ProfileService } from '../services/profile.service';
import ApiError from '../utils/ApiError';
import { Request, Response } from 'express';
import { User } from '@prisma/client';

/**
 * Get user profile
 * @route GET /v1/profile
 * @access Private
 */
const getUserProfile = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as User;
  const profile = await ProfileService.getUserProfile(user.id);
  res.status(httpStatus.OK).send(profile);
});

/**
 * Update user profile
 * @route PATCH /v1/profile
 * @access Private
 */
const updateUserProfile = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as User;
  const profile = await ProfileService.updateProfile(user.id, req.body, req.ip);
  res.status(httpStatus.OK).send(profile);
});

/**
 * Get user preferences
 * @route GET /v1/profile/preferences
 * @access Private
 */
const getUserPreferences = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as User;
  const preferences = await ProfileService.getUserPreferences(user.id);
  res.status(httpStatus.OK).send(preferences);
});

/**
 * Update user preferences
 * @route PATCH /v1/profile/preferences
 * @access Private
 */
const updateUserPreferences = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as User;
  const preferences = await ProfileService.updatePreferences(user.id, req.body, req.ip);
  res.status(httpStatus.OK).send(preferences);
});

/**
 * Get privacy settings
 * @route GET /v1/profile/privacy
 * @access Private
 */
const getPrivacySettings = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as User;
  // For now, return empty object since we don't have a getPrivacySettings method
  res.status(httpStatus.OK).send({});
});

/**
 * Update privacy settings
 * @route PATCH /v1/profile/privacy
 * @access Private
 */
const updatePrivacySettings = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as User;
  const privacy = await ProfileService.updatePrivacySettings(user.id, req.body, req.ip);
  res.status(httpStatus.OK).send(privacy);
});

/**
 * Get account status
 * @route GET /v1/profile/account-status
 * @access Private
 */
const getAccountStatus = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as User;
  // For now, return basic status since we don't have a getAccountStatus method
  res.status(httpStatus.OK).send({
    isActive: user.isActive,
    isLocked: user.isLocked,
    isEmailVerified: user.isEmailVerified,
    twoFactorEnabled: user.twoFactorEnabled,
  });
});

/**
 * Get user statistics
 * @route GET /v1/profile/stats
 * @access Private
 */
const getUserStats = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as User;
  // For now, return basic stats since we don't have a getUserStats method
  res.status(httpStatus.OK).send({
    userId: user.id,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  });
});

/**
 * Export user data
 * @route GET /v1/profile/export
 * @access Private
 */
const exportUserData = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as User;
  // For now, return basic user data since we don't have an exportUserData method
  res.status(httpStatus.OK).send({
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
});

/**
 * Delete user account
 * @route DELETE /v1/profile/account
 * @access Private
 */
const deleteAccount = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as User;
  const { password } = req.body;

  if (!password) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Password is required to delete account');
  }

  await ProfileService.deleteAccount(user.id, password, req.ip);
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Upload profile picture
 * @route POST /v1/profile/profile-picture
 * @access Private
 */
const uploadProfilePicture = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as User;
  if (!req.file) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Profile picture file is required');
  }

  // For now, just update the profilePicture field since we don't have an uploadProfilePicture method
  const profilePicture = await ProfileService.updateAvatar(user.id, req.file.path, req.ip);
  res.status(httpStatus.OK).send(profilePicture);
});

/**
 * Remove profile picture
 * @route DELETE /v1/profile/profile-picture
 * @access Private
 */
const removeProfilePicture = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as User;
  // For now, just update profilePicture to null since we don't have a removeProfilePicture method
  const profilePicture = await ProfileService.updateAvatar(user.id, '', req.ip);
  res.status(httpStatus.NO_CONTENT).send();
});

export default {
  getUserProfile,
  updateUserProfile,
  getUserPreferences,
  updateUserPreferences,
  getPrivacySettings,
  updatePrivacySettings,
  getAccountStatus,
  getUserStats,
  exportUserData,
  deleteAccount,
  uploadProfilePicture,
  removeProfilePicture,
};
