import prisma from '../client';
import { Strategy as JwtStrategy, ExtractJwt, VerifyCallback } from 'passport-jwt';
import config from './config';
import setupGoogleStrategy from '../strategies/google.strategy';
import setupGitHubStrategy from '../strategies/github.strategy';

// Use string literal for TokenType to avoid Prisma import issues
const TokenType = {
  ACCESS: 'ACCESS',
  REFRESH: 'REFRESH',
  RESET_PASSWORD: 'RESET_PASSWORD',
  VERIFY_EMAIL: 'VERIFY_EMAIL',
  TWO_FACTOR: 'TWO_FACTOR',
} as const;

const jwtOptions = {
  secretOrKey: config.jwt.secret,
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
};

const jwtVerify: VerifyCallback = async (payload, done) => {
  try {
    if (payload.type !== TokenType.ACCESS) {
      throw new Error('Invalid token type');
    }
    const user = await prisma.user.findUnique({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
      where: { id: payload.sub },
    });
    if (!user) {
      return done(null, false);
    }
    done(null, user);
  } catch (error) {
    done(error, false);
  }
};

export const jwtStrategy = new JwtStrategy(jwtOptions, jwtVerify);

/**
 * Setup all passport strategies
 */
export const setupPassportStrategies = (passport: any): void => {
  // Setup JWT strategy
  passport.use(jwtStrategy);

  // Setup OAuth strategies
  setupGoogleStrategy(passport);
  setupGitHubStrategy(passport);
};
