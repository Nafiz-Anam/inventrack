import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import { sendSuccess, sendError, ErrorCode } from '../utils/apiResponse';
import ApiError from '../utils/ApiError';
import { Request, Response } from 'express';
import SocialAuthService from '../services/socialAuth.service';

const socialAuthServiceInstance = new SocialAuthService();

/**
 * Initiate Google OAuth
 * @route GET /v1/auth/google
 * @access Public
 */
const googleAuth = catchAsync(async (req: Request, res: Response) => {
  // This will be handled by passport middleware
  // The actual redirect will be handled by passport
  res.redirect('/api/v1/auth/google');
});

/**
 * Google OAuth callback
 * @route GET /v1/auth/google/callback
 * @access Public
 */
const googleCallback = catchAsync(async (req: Request, res: Response) => {
  // This will be handled by passport middleware
  // The actual processing will be done in the passport strategy
  res.redirect('/api/v1/auth/google/callback');
});

/**
 * Initiate GitHub OAuth
 * @route GET /v1/auth/github
 * @access Public
 */
const githubAuth = catchAsync(async (req: Request, res: Response) => {
  // This will be handled by passport middleware
  // The actual redirect will be handled by passport
  res.redirect('/api/v1/auth/github');
});

/**
 * GitHub OAuth callback
 * @route GET /v1/auth/github/callback
 * @access Public
 */
const githubCallback = catchAsync(async (req: Request, res: Response) => {
  // This will be handled by passport middleware
  // The actual processing will be done in the passport strategy
  res.redirect('/api/v1/auth/github/callback');
});

/**
 * Link social account to existing user
 * @route POST /v1/auth/link-social
 * @access Private
 */
const linkSocialAccount = catchAsync(async (req: Request, res: Response) => {
  const { provider, accessToken, refreshToken, scope } = req.body;
  const userId = (req.user as any)?.id;

  if (!userId) {
    return sendError(res, ErrorCode.UNAUTHORIZED, 'User not authenticated');
  }

  try {
    // This would typically involve validating the access token with the provider
    // and getting the user profile from the provider
    // For now, we'll use the provided data directly
    const socialProfile = {
      id: req.body.providerId,
      email: req.body.email,
      name: req.body.name,
      provider,
      providerId: req.body.providerId,
      accessToken,
      refreshToken,
      scope,
    };

    const socialAccount = await socialAuthServiceInstance.linkSocialAccount(userId, socialProfile);

    return sendSuccess(res, { socialAccount }, 'Social account linked successfully');
  } catch (error) {
    if (error instanceof ApiError) {
      return sendError(res, ErrorCode.CONFLICT, error.message);
    }
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to link social account');
  }
});

/**
 * Unlink social account from user
 * @route DELETE /v1/auth/unlink-social/:provider
 * @access Private
 */
const unlinkSocialAccount = catchAsync(async (req: Request, res: Response) => {
  const provider = req.params.provider as string;
  const userId = (req.user as any)?.id;

  if (!userId) {
    return sendError(res, ErrorCode.UNAUTHORIZED, 'User not authenticated');
  }

  try {
    await socialAuthServiceInstance.unlinkSocialAccount(userId, provider);

    return sendSuccess(res, null, 'Social account unlinked successfully');
  } catch (error) {
    if (error instanceof ApiError) {
      return sendError(res, ErrorCode.CONFLICT, error.message);
    }
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to unlink social account');
  }
});

/**
 * Get user's social accounts
 * @route GET /v1/auth/social-accounts
 * @access Private
 */
const getSocialAccounts = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;

  if (!userId) {
    return sendError(res, ErrorCode.UNAUTHORIZED, 'User not authenticated');
  }

  try {
    const socialAccounts = await socialAuthServiceInstance.getUserSocialAccounts(userId);

    return sendSuccess(res, { socialAccounts }, 'Social accounts retrieved successfully');
  } catch (error) {
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to retrieve social accounts');
  }
});

/**
 * Update social account tokens
 * @route PUT /v1/auth/social-accounts/:provider/tokens
 * @access Private
 */
const updateSocialTokens = catchAsync(async (req: Request, res: Response) => {
  const provider = req.params.provider as string;
  const { accessToken, refreshToken, scope } = req.body;
  const userId = (req.user as any)?.id;

  if (!userId) {
    return sendError(res, ErrorCode.UNAUTHORIZED, 'User not authenticated');
  }

  try {
    const socialAccount = await socialAuthServiceInstance.updateSocialTokens(
      userId,
      provider,
      accessToken,
      refreshToken,
      scope
    );

    return sendSuccess(res, { socialAccount }, 'Social account tokens updated successfully');
  } catch (error) {
    if (error instanceof ApiError) {
      return sendError(res, ErrorCode.CONFLICT, error.message);
    }
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to update social tokens');
  }
});

/**
 * Check if user can authenticate with provider
 * @route GET /v1/auth/can-authenticate/:provider
 * @access Private
 */
const canAuthenticateWithProvider = catchAsync(async (req: Request, res: Response) => {
  const provider = req.params.provider as string;
  const userId = (req.user as any)?.id;

  if (!userId) {
    return sendError(res, ErrorCode.UNAUTHORIZED, 'User not authenticated');
  }

  try {
    const canAuthenticate = await socialAuthServiceInstance.canUserAuthenticateWithProvider(
      userId,
      provider
    );

    return sendSuccess(res, { canAuthenticate }, 'Authentication capability checked successfully');
  } catch (error) {
    return sendError(
      res,
      ErrorCode.INTERNAL_SERVER_ERROR,
      'Failed to check authentication capability'
    );
  }
});

export {
  googleAuth,
  googleCallback,
  githubAuth,
  githubCallback,
  linkSocialAccount,
  unlinkSocialAccount,
  getSocialAccounts,
  updateSocialTokens,
  canAuthenticateWithProvider,
};
