import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import {
  googleAuth,
  googleCallback,
  githubAuth,
  githubCallback,
  linkSocialAccount,
  unlinkSocialAccount,
  getSocialAccounts,
  updateSocialTokens,
  canAuthenticateWithProvider,
} from '../../controllers/socialAuth.controller';

const router = express.Router();

// Public routes for OAuth initiation and callbacks
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);
router.get('/github', githubAuth);
router.get('/github/callback', githubCallback);

// Protected routes for social account management
router.use(auth());

/**
 * @route POST /v1/auth/link-social
 * @desc Link social account to existing user
 * @access Private
 */
router.post('/link-social', linkSocialAccount);

/**
 * @route DELETE /v1/auth/unlink-social/:provider
 * @desc Unlink social account from user
 * @access Private
 */
router.delete('/unlink-social/:provider', unlinkSocialAccount);

/**
 * @route GET /v1/auth/social-accounts
 * @desc Get user's social accounts
 * @access Private
 */
router.get('/social-accounts', getSocialAccounts);

/**
 * @route PUT /v1/auth/social-accounts/:provider/tokens
 * @desc Update social account tokens
 * @access Private
 */
router.put('/social-accounts/:provider/tokens', updateSocialTokens);

/**
 * @route GET /v1/auth/can-authenticate/:provider
 * @desc Check if user can authenticate with provider
 * @access Private
 */
router.get('/can-authenticate/:provider', canAuthenticateWithProvider);

export default router;
