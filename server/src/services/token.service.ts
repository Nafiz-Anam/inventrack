import jwt from 'jsonwebtoken';
import moment, { Moment } from 'moment';
import httpStatus from 'http-status';
import config from '../config/config';
import userService from './user.service';
import deviceService from './device.service';
import notificationService from './notification.service';
import ApiError from '../utils/ApiError';
import { Token, TokenType } from '@prisma/client';
import prisma from '../client';
import { AuthTokensResponse } from '../types/response';
import { Request } from 'express';

/**
 * Generate token
 * @param {string} userId
 * @param {Moment} expires
 * @param {string} type
 * @param {string} [secret]
 * @returns {string}
 */
const generateToken = (
  userId: string,
  expires: Moment,
  type: TokenType,
  secret = config.jwt.secret
): string => {
  const payload = {
    sub: userId,
    iat: moment().unix(),
    exp: expires.unix(),
    type,
  };
  return jwt.sign(payload, secret);
};

/**
 * Save a token
 * @param {string} token
 * @param {string} userId
 * @param {Moment} expires
 * @param {string} type
 * @param {boolean} [blacklisted]
 * @returns {Promise<Token>}
 */
const saveToken = async (
  token: string,
  userId: string,
  expires: Moment,
  type: TokenType,
  blacklisted = false
): Promise<Token> => {
  console.log('[TOKEN] Saving token:', { token, userId, type, expires: expires.toISOString() });
  const tokenDoc = await prisma.token.create({
    data: {
      token,
      userId: userId,
      expires: expires.toDate(),
      type,
      blacklisted,
    },
  });
  return tokenDoc;
};

/**
 * Verify token and return token doc (or throw an error if it is not valid)
 * @param {string} token
 * @param {string} type
 * @returns {Promise<Token>}
 */
const verifyToken = async (token: string, type: TokenType): Promise<Token> => {
  const payload = jwt.verify(token, config.jwt.secret) as any;
  const tokenDoc = await prisma.token.findFirst({
    where: { token, type, userId: payload.sub as string, blacklisted: false },
  });
  if (!tokenDoc) {
    throw new Error('Token not found');
  }
  return tokenDoc;
};

/**
 * Generate auth tokens with device management
 * @param {User} user
 * @param {Request} req - Express request object for device info
 * @returns {Promise<AuthTokensResponse>}
 */
const generateAuthTokens = async (
  user: { id: string },
  req: Request
): Promise<AuthTokensResponse> => {
  const accessTokenExpires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
  const accessToken = generateToken(user.id, accessTokenExpires, TokenType.ACCESS);
  await saveToken(accessToken, user.id, accessTokenExpires, TokenType.ACCESS);

  const refreshTokenExpires = moment().add(config.jwt.refreshExpirationDays, 'days');
  const refreshToken = generateToken(user.id, refreshTokenExpires, TokenType.REFRESH);
  await saveToken(refreshToken, user.id, refreshTokenExpires, TokenType.REFRESH);

  // Create device session
  const deviceSession = await deviceService.createDeviceSession(user.id, refreshToken, req);

  // Create user session
  const sessionId = deviceSession.deviceId + '-' + refreshToken.slice(0, 8);
  const session = await prisma.userSession.create({
    data: {
      userId: user.id,
      sessionId,
      deviceId: deviceSession.deviceId,
      deviceName: deviceSession.deviceName,
      ipAddress: deviceSession.ipAddress,
      userAgent: deviceSession.userAgent,
      isActive: true,
      lastActivity: new Date(),
      expiresAt: refreshTokenExpires.toDate(),
    },
  });

  // Get full user data for notifications
  const fullUser = await userService.getUserById(user.id);

  // Send login alert notification
  if (fullUser) {
    await notificationService.sendLoginAlert(fullUser, req, deviceSession);
  }

  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires.toDate(),
    },
    refresh: {
      token: refreshToken,
      expires: refreshTokenExpires.toDate(),
    },
    device: {
      id: deviceSession.deviceId,
      name: deviceSession.deviceName,
    },
    session: {
      id: session.sessionId,
      expires: session.expiresAt,
    },
  };
};

/**
 * Generate reset password token
 * @param {string} email
 * @returns {Promise<string>}
 */
const generateResetPasswordToken = async (email: string): Promise<string> => {
  const user = await userService.getUserByEmail(email);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No users found with this email');
  }
  const expires = moment().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
  const resetPasswordToken = generateToken(user.id, expires, TokenType.RESET_PASSWORD);
  await saveToken(resetPasswordToken, user.id, expires, TokenType.RESET_PASSWORD);
  return resetPasswordToken;
};

/**
 * Generate verify email token
 * @param {User} user
 * @returns {Promise<string>}
 */
const generateVerifyEmailToken = async (user: { id: string }): Promise<string> => {
  const expires = moment().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
  const verifyEmailToken = generateToken(user.id, expires, TokenType.VERIFY_EMAIL);
  await saveToken(verifyEmailToken, user.id, expires, TokenType.VERIFY_EMAIL);
  return verifyEmailToken;
};

/**
 * Blacklist a token
 * @param {string} tokenId
 * @returns {Promise<void>}
 */
const blacklistToken = async (tokenId: string): Promise<void> => {
  await prisma.token.update({
    where: { id: tokenId },
    data: { blacklisted: true },
  });
};

/**
 * Remove expired tokens
 * @returns {Promise<void>}
 */
const removeExpiredTokens = async (): Promise<void> => {
  await prisma.token.deleteMany({
    where: {
      expires: {
        lt: new Date(),
      },
    },
  });
};

/**
 * Get user tokens
 * @param {string} userId
 * @returns {Promise<Token[]>}
 */
const getUserTokens = async (userId: string) => {
  return prisma.token.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
};

/**
 * Revoke all user tokens
 * @param {string} userId
 * @returns {Promise<void>}
 */
const revokeAllUserTokens = async (userId: string): Promise<void> => {
  await prisma.token.updateMany({
    where: { userId },
    data: { blacklisted: true },
  });
};

const endUserSession = async (userId: string, deviceId: string) => {
  await prisma.userSession.updateMany({
    where: { userId, deviceId, isActive: true },
    data: { isActive: false, lastActivity: new Date() },
  });
};

export default {
  generateToken,
  saveToken,
  verifyToken,
  generateAuthTokens,
  generateResetPasswordToken,
  generateVerifyEmailToken,
  blacklistToken,
  removeExpiredTokens,
  getUserTokens,
  revokeAllUserTokens,
  endUserSession,
};
