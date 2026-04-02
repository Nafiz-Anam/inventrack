import httpStatus from 'http-status';
import prisma from '../client';
import ApiError from '../utils/ApiError';
import { SocialAccount } from '@prisma/client';
import { Request } from 'express';

interface SocialProfile {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  provider: string;
  providerId: string;
  accessToken?: string;
  refreshToken?: string;
  scope?: string;
}

interface SocialAuthResult {
  user: any;
  isNewUser: boolean;
  socialAccount: SocialAccount;
}

/**
 * Social Authentication Service
 * Handles OAuth authentication and account linking
 */
class SocialAuthService {
  /**
   * Find or create user from social profile
   */
  async findOrCreateUser(profile: SocialProfile, req: Request): Promise<SocialAuthResult> {
    const { email, provider, providerId, name, avatar } = profile;

    // Check if social account already exists
    const existingSocialAccount = await prisma.socialAccount.findUnique({
      where: {
        provider_providerId: {
          provider,
          providerId,
        },
      },
      include: {
        user: true,
      },
    });

    if (existingSocialAccount) {
      // Update social account tokens if provided
      if (profile.accessToken || profile.refreshToken) {
        await prisma.socialAccount.update({
          where: { id: existingSocialAccount.id },
          data: {
            accessToken: profile.accessToken || existingSocialAccount.accessToken,
            refreshToken: profile.refreshToken || existingSocialAccount.refreshToken,
            scope: profile.scope || existingSocialAccount.scope,
          },
        });
      }

      return {
        user: existingSocialAccount.user,
        isNewUser: false,
        socialAccount: existingSocialAccount,
      };
    }

    // Check if user exists with same email
    let user = await prisma.user.findUnique({
      where: { email },
    });

    const isNewUser = !user;

    if (!user) {
      // Create new user
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          password: '', // Social auth users don't have passwords
          isEmailVerified: true, // Social auth emails are pre-verified
          role: 'USER', // Default role for social auth users
        },
      });
    }

    // Create social account link
    const socialAccount = await prisma.socialAccount.create({
      data: {
        userId: user.id,
        provider,
        providerId,
        accessToken: profile.accessToken,
        refreshToken: profile.refreshToken,
        scope: profile.scope,
      },
    });

    // Update user avatar if provided and user doesn't have one
    if (avatar && !user.profilePicture) {
      await prisma.user.update({
        where: { id: user.id },
        data: { profilePicture: avatar },
      });
    }

    return {
      user,
      isNewUser,
      socialAccount,
    };
  }

  /**
   * Link social account to existing user
   */
  async linkSocialAccount(userId: string, profile: SocialProfile): Promise<SocialAccount> {
    const { provider, providerId, accessToken, refreshToken, scope } = profile;

    // Check if social account already exists
    const existingAccount = await prisma.socialAccount.findUnique({
      where: {
        provider_providerId: {
          provider,
          providerId,
        },
      },
    });

    if (existingAccount) {
      throw new ApiError(httpStatus.CONFLICT, 'Social account already linked to another user');
    }

    // Check if user already has this provider linked
    const userAccount = await prisma.socialAccount.findFirst({
      where: {
        userId,
        provider,
      },
    });

    if (userAccount) {
      throw new ApiError(
        httpStatus.CONFLICT,
        'This social provider is already linked to your account'
      );
    }

    // Create the social account link
    return await prisma.socialAccount.create({
      data: {
        userId,
        provider,
        providerId,
        accessToken,
        refreshToken,
        scope,
      },
    });
  }

  /**
   * Unlink social account from user
   */
  async unlinkSocialAccount(userId: string, provider: string): Promise<void> {
    const socialAccount = await prisma.socialAccount.findFirst({
      where: {
        userId,
        provider,
      },
    });

    if (!socialAccount) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Social account not found');
    }

    // Check if user has password (required for unlinking last social account)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        password: true,
        socialAccounts: true,
      },
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    // If this is the only social account and user has no password, prevent unlinking
    if (user.socialAccounts.length === 1 && !user.password) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Cannot unlink the only social account without setting a password first'
      );
    }

    await prisma.socialAccount.delete({
      where: { id: socialAccount.id },
    });
  }

  /**
   * Get user's social accounts
   */
  async getUserSocialAccounts(userId: string): Promise<SocialAccount[]> {
    return await prisma.socialAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update social account tokens
   */
  async updateSocialTokens(
    userId: string,
    provider: string,
    accessToken?: string,
    refreshToken?: string,
    scope?: string
  ): Promise<SocialAccount> {
    const socialAccount = await prisma.socialAccount.findFirst({
      where: {
        userId,
        provider,
      },
    });

    if (!socialAccount) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Social account not found');
    }

    return await prisma.socialAccount.update({
      where: { id: socialAccount.id },
      data: {
        accessToken: accessToken || socialAccount.accessToken,
        refreshToken: refreshToken || socialAccount.refreshToken,
        scope: scope || socialAccount.scope,
      },
    });
  }

  /**
   * Check if user can authenticate with social provider
   */
  async canUserAuthenticateWithProvider(userId: string, provider: string): Promise<boolean> {
    const socialAccount = await prisma.socialAccount.findFirst({
      where: {
        userId,
        provider,
      },
    });

    return !!socialAccount;
  }

  /**
   * Get social account by provider and provider ID
   */
  async getSocialAccountByProvider(
    provider: string,
    providerId: string
  ): Promise<SocialAccount | null> {
    return await prisma.socialAccount.findUnique({
      where: {
        provider_providerId: {
          provider,
          providerId,
        },
      },
      include: {
        user: true,
      },
    });
  }
}

export default SocialAuthService;
