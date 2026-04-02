import { PrismaClient, OtpType } from '@prisma/client';
import moment from 'moment';
import jwt from 'jsonwebtoken';
import config from '../config/config';
import prisma from '../client';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const OTP_VERIFICATION_TOKEN_EXPIRY = '15m'; // 15 minutes for verification token

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
}

/**
 * Generate JWT token for OTP verification
 * @param {string} userId
 * @returns {string} JWT token
 */
function generateOtpVerificationJwt(userId: string): string {
  return jwt.sign(
    {
      userId,
      type: 'otp_verification',
      iat: Math.floor(Date.now() / 1000),
    },
    config.jwt.secret,
    { expiresIn: OTP_VERIFICATION_TOKEN_EXPIRY }
  );
}

/**
 * Verify and decode OTP verification JWT
 * @param {string} token
 * @returns {object} Decoded payload
 */
function verifyOtpVerificationJwt(token: string): { userId: string; type: string } {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    if (decoded.type !== 'otp_verification') {
      const typeError = new Error('Invalid token type');
      typeError.cause = new Error('Token type mismatch');
      throw typeError;
    }
    return { userId: decoded.userId, type: decoded.type };
  } catch (error) {
    const tokenError = new Error('Invalid or expired token');
    tokenError.cause = error;
    throw tokenError;
  }
}

export async function createEmailVerificationOtp(userId: string) {
  const otp = generateOtp();
  const expiresAt = moment().add(OTP_EXPIRY_MINUTES, 'minutes').toDate();
  await prisma.otp.create({
    data: {
      userId,
      otp,
      type: OtpType.EMAIL_VERIFICATION,
      expiresAt,
      consumed: false,
    },
  });
  return otp;
}

export async function verifyEmailOtp(userId: string, otp: string) {
  const otpRecord = await prisma.otp.findFirst({
    where: {
      userId,
      otp,
      type: OtpType.EMAIL_VERIFICATION,
      consumed: false,
      expiresAt: { gt: new Date() },
    },
  });
  if (!otpRecord) return false;
  await prisma.otp.update({ where: { id: otpRecord.id }, data: { consumed: true } });
  return true;
}

export async function resendEmailVerificationOtp(userId: string) {
  // Check if there's an existing unexpired OTP
  const existingOtp = await prisma.otp.findFirst({
    where: {
      userId,
      type: OtpType.EMAIL_VERIFICATION,
      consumed: false,
      expiresAt: { gt: new Date() },
    },
  });

  // If there's an unexpired OTP, throw error - cannot resend until expired
  if (existingOtp) {
    throw new Error(
      'Cannot resend OTP. Current OTP is still valid. Please wait for it to expire or use the existing OTP.'
    );
  }

  // Create new OTP
  return await createEmailVerificationOtp(userId);
}

export async function createPasswordResetOtp(userId: string) {
  const otp = generateOtp();
  const expiresAt = moment().add(OTP_EXPIRY_MINUTES, 'minutes').toDate();
  await prisma.otp.create({
    data: {
      userId,
      otp,
      type: OtpType.PASSWORD_RESET,
      expiresAt,
      consumed: false,
    },
  });
  return otp;
}

export async function verifyPasswordResetOtp(userId: string, otp: string) {
  const otpRecord = await prisma.otp.findFirst({
    where: {
      userId,
      otp,
      type: OtpType.PASSWORD_RESET,
      consumed: false,
      expiresAt: { gt: new Date() },
    },
  });
  if (!otpRecord) return false;
  await prisma.otp.update({ where: { id: otpRecord.id }, data: { consumed: true } });
  return true;
}

export async function resendPasswordResetOtp(userId: string) {
  // Check if there's an existing unexpired OTP
  const existingOtp = await prisma.otp.findFirst({
    where: {
      userId,
      type: OtpType.PASSWORD_RESET,
      consumed: false,
      expiresAt: { gt: new Date() },
    },
  });

  // If there's an unexpired OTP, throw error - cannot resend until expired
  if (existingOtp) {
    throw new Error(
      'Cannot resend OTP. Current OTP is still valid. Please wait for it to expire or use the existing OTP.'
    );
  }

  // Create new OTP
  return await createPasswordResetOtp(userId);
}

export async function createPasswordResetOtpByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });

  if (!user) {
    // For security, don't reveal if email exists or not
    // But still return a fake OTP to prevent timing attacks
    return generateOtp();
  }

  return await createPasswordResetOtp(user.id);
}

export async function resendPasswordResetOtpByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });

  if (!user) {
    // For security, don't reveal if email exists or not
    // But still return a fake OTP to prevent timing attacks
    return generateOtp();
  }

  return await resendPasswordResetOtp(user.id);
}

export async function verifyPasswordResetOtpByEmail(email: string, otp: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) return false;

  return await verifyPasswordResetOtp(user.id, otp);
}

/**
 * Generate OTP verification token
 * @param {string} userId
 * @returns {Promise<string>} JWT token for OTP verification
 */
export async function generateOtpVerificationToken(userId: string) {
  const otp = generateOtp();
  const expiresAt = moment().add(OTP_EXPIRY_MINUTES, 'minutes').toDate();

  // Store OTP in database
  await prisma.otp.create({
    data: {
      userId,
      otp,
      type: OtpType.EMAIL_VERIFICATION,
      expiresAt,
      consumed: false,
    },
  });

  // Generate JWT token
  return generateOtpVerificationJwt(userId);
}

/**
 * Verify OTP using JWT token
 * @param {string} token
 * @param {string} otp
 * @returns {Promise<boolean>}
 */
export async function verifyOtpWithToken(token: string, otp: string) {
  try {
    // Verify JWT token and get userId
    const { userId } = verifyOtpVerificationJwt(token);

    // Find valid OTP for user
    const otpRecord = await prisma.otp.findFirst({
      where: {
        userId,
        otp,
        type: OtpType.EMAIL_VERIFICATION,
        consumed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otpRecord) {
      return false;
    }

    // Mark OTP as consumed
    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: { consumed: true },
    });

    // Mark user email as verified
    await prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: true },
    });

    return true;
  } catch (error) {
    return false;
  }
}
