import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PassportStatic } from 'passport';
import { Request } from 'express';
import SocialAuthService from '../services/socialAuth.service';
import tokenService from '../services/token.service';

const socialAuthService = new SocialAuthService();

interface GoogleProfile {
  id: string;
  displayName: string;
  name?: {
    familyName: string;
    givenName: string;
  };
  emails?: Array<{
    value: string;
    verified: boolean;
  }>;
  photos?: Array<{
    value: string;
  }>;
  provider: string;
}

/**
 * Google OAuth Strategy
 * Handles authentication with Google accounts
 */
const setupGoogleStrategy = (passport: PassportStatic): void => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/v1/auth/google/callback',
        scope: ['profile', 'email'],
        passReqToCallback: true,
      },
      async (
        req: Request,
        accessToken: string,
        refreshToken: string,
        params: any,
        profile: GoogleProfile,
        done: any
      ) => {
        try {
          // Extract user information from Google profile
          const socialProfile = {
            id: profile.id,
            email: profile.emails[0]?.value || '',
            name: profile.displayName,
            avatar: profile.photos[0]?.value,
            provider: 'google',
            providerId: profile.id,
            accessToken,
            refreshToken,
            scope: 'profile email',
          };

          // Find or create user
          const result = await socialAuthService.findOrCreateUser(socialProfile, req);

          // Generate tokens
          const tokens = await tokenService.generateAuthTokens(result.user, req);

          // Create audit log
          if (result.isNewUser) {
            // TODO: Add audit logging
            console.log(`New user registered via Google: ${result.user.email}`);
          } else {
            // TODO: Add audit logging
            console.log(`User logged in via Google: ${result.user.email}`);
          }

          // Return user with tokens
          return done(null, {
            user: result.user,
            tokens,
            isNewUser: result.isNewUser,
            socialAccount: result.socialAccount,
          });
        } catch (error) {
          console.error('Google OAuth error:', error);
          return done(error, undefined);
        }
      }
    )
  );
};

export default setupGoogleStrategy;
