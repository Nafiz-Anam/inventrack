import { Strategy as GitHubStrategy } from 'passport-github2';
import { PassportStatic } from 'passport';
import { Request } from 'express';
import SocialAuthService from '../services/socialAuth.service';
import tokenService from '../services/token.service';

const socialAuthService = new SocialAuthService();

interface GitHubProfile {
  id: string;
  username: string;
  displayName?: string;
  profileUrl: string;
  emails?: Array<{
    email: string;
    verified: boolean;
    primary: boolean;
  }>;
  photos?: Array<{
    value: string;
  }>;
  provider: string;
  _json: {
    login: string;
    id: number;
    avatar_url: string;
    gravatar_id: string;
    url: string;
    html_url: string;
    followers_url: string;
    following_url: string;
    gists_url: string;
    starred_url: string;
    subscriptions_url: string;
    organizations_url: string;
    repos_url: string;
    events_url: string;
    received_events_url: string;
    type: string;
    site_admin: boolean;
    name?: string;
    company?: string;
    blog?: string;
    location?: string;
    email?: string;
    hireable?: boolean;
    bio?: string;
    twitter_username?: string;
    public_repos: number;
    public_gists: number;
    followers: number;
    following: number;
    created_at: string;
    updated_at: string;
  };
}

/**
 * GitHub OAuth Strategy
 * Handles authentication with GitHub accounts
 */
const setupGitHubStrategy = (passport: PassportStatic): void => {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID || '',
        clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
        callbackURL: process.env.GITHUB_CALLBACK_URL || '/api/v1/auth/github/callback',
        scope: ['user:email'],
        passReqToCallback: true,
      },
      async (
        req: Request,
        accessToken: string,
        refreshToken: string,
        profile: GitHubProfile,
        done: any
      ) => {
        try {
          // Extract user information from GitHub profile
          const email = profile.emails?.[0]?.email || profile._json.email || '';
          const name = profile.displayName || profile._json.name || profile.username;

          const socialProfile = {
            id: profile.id.toString(),
            email,
            name,
            avatar: profile.photos?.[0]?.value || profile._json.avatar_url,
            provider: 'github',
            providerId: profile.id.toString(),
            accessToken,
            refreshToken,
            scope: 'user:email',
          };

          // Find or create user
          const result = await socialAuthService.findOrCreateUser(socialProfile, req);

          // Generate tokens
          const tokens = await tokenService.generateAuthTokens(result.user, req);

          // Create audit log
          if (result.isNewUser) {
            // TODO: Add audit logging
            console.log(`New user registered via GitHub: ${result.user.email}`);
          } else {
            // TODO: Add audit logging
            console.log(`User logged in via GitHub: ${result.user.email}`);
          }

          // Return user with tokens
          return done(null, {
            user: result.user,
            tokens,
            isNewUser: result.isNewUser,
            socialAccount: result.socialAccount,
          });
        } catch (error) {
          console.error('GitHub OAuth error:', error);
          return done(error, undefined);
        }
      }
    )
  );
};

export default setupGitHubStrategy;
