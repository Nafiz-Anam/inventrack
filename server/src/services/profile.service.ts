import ApiError from '../utils/ApiError';
import httpStatus from 'http-status';
import pick from '../utils/pick';
import userActivityService from './userActivity.service';
import prisma from '../client';
import { ActivityType } from '@prisma/client';

export interface ProfileUpdateData {
  name?: string;
  phone?: string;
  phoneCode?: string;
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  profilePicture?: string;
  dateOfBirth?: Date;
  gender?: string;
}

export interface PreferencesUpdateData {
  emailNotifications?: boolean;
  smsNotifications?: boolean;
  marketingEmails?: boolean;
  loginAlerts?: boolean;
  securityUpdates?: boolean;
}

export interface PrivacySettingsData {
  profileVisibility?: 'public' | 'private' | 'friends_only';
  showEmail?: boolean;
  showPhone?: boolean;
  showLocation?: boolean;
  allowSearch?: boolean;
  allowContact?: boolean;
}

export class ProfileService {
  /**
   * Get user profile with sensitive data excluded
   */
  static async getUserProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        profilePicture: true,
        phone: true,
        dateOfBirth: true,
        gender: true,
        country: true,
        state: true,
        city: true,
        address: true,
        isEmailVerified: true,
        twoFactorEnabled: true,
        twoFactorVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    return user;
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId: string, data: ProfileUpdateData, ipAddress?: string) {
    const allowedFields = [
      'name',
      'phone',
      'profilePicture',
      'dateOfBirth',
      'gender',
      'country',
      'state',
      'city',
      'address',
    ];

    const updateData = pick(data, allowedFields);

    // Validate phone number format
    if (updateData.phone) {
      const phoneRegex = /^\+?[\d\s\-()]+$/;
      if (!phoneRegex.test(updateData.phone as string)) {
        throw new Error('Invalid phone number format');
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        profilePicture: true,
        dateOfBirth: true,
        gender: true,
        country: true,
        state: true,
        city: true,
        address: true,
        updatedAt: true,
      },
    });

    // Log profile update activity
    await userActivityService.createActivity({
      userId,
      activityType: 'PROFILE_UPDATE',
      description: 'Profile updated',
      metadata: { changes: updateData },
      ipAddress,
    });

    return user;
  }

  /**
   * Update user preferences
   */
  static async updatePreferences(userId: string, data: PreferencesUpdateData, ipAddress?: string) {
    // For now, we'll store preferences in a simple way
    // In a real implementation, you might want to create a separate preferences table
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Log preference update activity
    await userActivityService.createActivity({
      userId,
      activityType: 'PROFILE_UPDATE',
      description: 'Preferences updated',
      metadata: { changes: data },
      ipAddress,
    });

    return { id: user.id, updatedAt: user.updatedAt };
  }

  /**
   * Update privacy settings
   */
  static async updatePrivacySettings(
    userId: string,
    data: PrivacySettingsData,
    ipAddress?: string
  ) {
    // For now, we'll handle privacy settings in a simple way
    // In a real implementation, you might want to create a separate privacy settings table
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Log privacy settings update activity
    await userActivityService.createActivity({
      userId,
      activityType: 'PROFILE_UPDATE',
      description: 'Privacy settings updated',
      metadata: { changes: data },
      ipAddress,
    });

    return { id: user.id, updatedAt: user.updatedAt };
  }

  /**
   * Get user preferences
   */
  static async getUserPreferences(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        emailNotifications: true,
        preferences: true,
      },
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    return user;
  }

  /**
   * Update avatar
   */
  static async updateAvatar(userId: string, avatarUrl: string, ipAddress?: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { profilePicture: avatarUrl },
      select: {
        id: true,
        email: true,
        name: true,
        profilePicture: true,
        phone: true,
        dateOfBirth: true,
        gender: true,
        country: true,
        state: true,
        city: true,
        address: true,
        isEmailVerified: true,
        twoFactorEnabled: true,
        twoFactorVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Log avatar update activity
    await userActivityService.createActivity({
      userId,
      activityType: 'PROFILE_UPDATE',
      description: 'Avatar updated',
      metadata: { avatarUrl },
      ipAddress,
    });

    return user;
  }

  /**
   * Delete user account (soft delete)
   */
  static async deleteAccount(userId: string, reason?: string, ipAddress?: string) {
    // For now, we'll just mark the user as inactive
    // In a real implementation, you might want to implement soft delete
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        isLocked: true,
      },
      select: {
        id: true,
        email: true,
        updatedAt: true,
      },
    });

    // Log account deletion activity
    await userActivityService.createActivity({
      userId,
      activityType: ActivityType.ACCOUNT_LOCKED,
      description: 'Account deleted',
      metadata: { reason },
      ipAddress,
    });

    return { id: user.id, email: user.email, deletedAt: new Date() };
  }

  /**
   * Get public profile (for other users to view)
   */
  static async getPublicProfile(userId: string, requestingUserId?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        profilePicture: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    const isOwnProfile = requestingUserId === userId;

    // If it's the user's own profile, return all data
    if (isOwnProfile) {
      return user;
    }

    // Apply privacy settings for public view
    const publicProfile: any = {
      id: user.id,
      name: user.name,
      profilePicture: user.profilePicture,
      createdAt: user.createdAt,
    };

    return publicProfile;
  }

  /**
   * Search users (respecting privacy settings)
   */
  static async searchUsers(query: string, limit: number = 20, offset: number = 0) {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        profilePicture: true,
      },
      take: limit,
      skip: offset,
    });

    return users.map(user => ({
      id: user.id,
      name: user.name,
      profilePicture: user.profilePicture,
    }));
  }
}
