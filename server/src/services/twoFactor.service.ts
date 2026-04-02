import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import ApiError from '../utils/ApiError';
import httpStatus from 'http-status';
import prisma from '../client';

/**
 * Generate a new secret for 2FA
 * @returns {string} The generated secret
 */
const generateSecret = (): string => {
  return speakeasy.generateSecret({
    name: 'Your App Name',
    issuer: 'Your Company',
    length: 32,
  }).base32;
};

/**
 * Generate QR code for 2FA setup
 * @param {string} secret - The 2FA secret
 * @param {string} email - User's email
 * @returns {Promise<string>} QR code as data URL
 */
const generateQRCode = async (secret: string, email: string): Promise<string> => {
  const otpauthUrl = speakeasy.otpauthURL({
    secret,
    label: email,
    issuer: 'Your Company',
    algorithm: 'sha1',
    digits: 6,
    period: 30,
  });

  return QRCode.toDataURL(otpauthUrl);
};

/**
 * Verify a 2FA token
 * @param {string} secret - The 2FA secret
 * @param {string} token - The token to verify
 * @returns {boolean} Whether the token is valid
 */
const verifyToken = (secret: string, token: string): boolean => {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2, // Allow 2 time steps in case of clock skew
  });
};

/**
 * Generate backup codes
 * @returns {string[]} Array of backup codes
 */
const generateBackupCodes = (): string[] => {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    codes.push(speakeasy.generateSecret({ length: 10 }).base32.slice(0, 8).toUpperCase());
  }
  return codes;
};

/**
 * Verify a backup code
 * @param {string} userId - User ID
 * @param {string} code - Backup code to verify
 * @returns {Promise<boolean>} Whether the backup code is valid
 */
const verifyBackupCode = async (userId: string, code: string): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorBackupCodes: true },
  });

  if (!user || !user.twoFactorBackupCodes) {
    return false;
  }

  const backupCodes = user.twoFactorBackupCodes;
  const codeIndex = backupCodes.indexOf(code);

  if (codeIndex === -1) {
    return false;
  }

  // Remove the used backup code
  backupCodes.splice(codeIndex, 1);
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorBackupCodes: backupCodes },
  });

  return true;
};

/**
 * Enable 2FA for a user
 * @param {string} userId - User ID
 * @param {string} token - Verification token
 * @returns {Promise<void>}
 */
const enableTwoFactor = async (userId: string, token: string): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true, twoFactorEnabled: true },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user.twoFactorEnabled) {
    throw new ApiError(httpStatus.BAD_REQUEST, '2FA is already enabled');
  }

  if (!user.twoFactorSecret) {
    throw new ApiError(httpStatus.BAD_REQUEST, '2FA not set up. Please set up 2FA first.');
  }

  // Verify the token
  const isValid = verifyToken(user.twoFactorSecret, token);
  if (!isValid) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid 2FA token');
  }

  // Enable 2FA
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: true,
      twoFactorVerified: true,
    },
  });
};

/**
 * Disable 2FA for a user
 * @param {string} userId - User ID
 * @param {string} token - Verification token
 * @returns {Promise<void>}
 */
const disableTwoFactor = async (userId: string, token: string): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true, twoFactorEnabled: true },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!user.twoFactorEnabled) {
    throw new ApiError(httpStatus.BAD_REQUEST, '2FA is not enabled');
  }

  // Verify the token
  const isValid = verifyToken(user.twoFactorSecret!, token);
  if (!isValid) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid 2FA token');
  }

  // Disable 2FA and clear secret
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: [],
      twoFactorVerified: false,
    },
  });
};

/**
 * Set up 2FA for a user (generate secret and QR code)
 * @param {string} userId - User ID
 * @returns {Promise<{secret: string, qrCode: string, backupCodes: string[]}>}
 */
const setupTwoFactor = async (
  userId: string
): Promise<{
  secret: string;
  qrCode: string;
  backupCodes: string[];
}> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, twoFactorEnabled: true },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user.twoFactorEnabled) {
    throw new ApiError(httpStatus.BAD_REQUEST, '2FA is already enabled');
  }

  // Generate new secret
  const secret = generateSecret();
  const qrCode = await generateQRCode(secret, user.email);
  const backupCodes = generateBackupCodes();

  // Save secret and backup codes (but don't enable yet)
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: secret,
      twoFactorBackupCodes: backupCodes,
    },
  });

  return { secret, qrCode, backupCodes };
};

/**
 * Verify 2FA token for login
 * @param {string} userId - User ID
 * @param {string} token - 2FA token
 * @returns {Promise<boolean>} Whether the token is valid
 */
const verifyTwoFactor = async (userId: string, token: string): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      twoFactorSecret: true,
      twoFactorEnabled: true,
      twoFactorBackupCodes: true,
    },
  });

  if (!user || !user.twoFactorEnabled) {
    return false;
  }

  if (!user.twoFactorSecret) {
    return false;
  }

  // First try to verify as a regular TOTP token
  const isValidToken = verifyToken(user.twoFactorSecret, token);
  if (isValidToken) {
    return true;
  }

  // If not a valid TOTP token, try as a backup code
  return await verifyBackupCode(userId, token);
};

/**
 * Regenerate backup codes
 * @param {string} userId - User ID
 * @param {string} token - Verification token
 * @returns {Promise<string[]>} New backup codes
 */
const regenerateBackupCodes = async (userId: string, token: string): Promise<string[]> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      twoFactorSecret: true,
      twoFactorEnabled: true,
    },
  });

  if (!user || !user.twoFactorEnabled) {
    throw new ApiError(httpStatus.BAD_REQUEST, '2FA is not enabled');
  }

  // Verify the token
  const isValid = verifyToken(user.twoFactorSecret!, token);
  if (!isValid) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid 2FA token');
  }

  // Generate new backup codes
  const backupCodes = generateBackupCodes();

  // Update user with new backup codes
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorBackupCodes: backupCodes },
  });

  return backupCodes;
};

/**
 * Get 2FA status for a user
 * @param {string} userId - User ID
 * @returns {Promise<{enabled: boolean, setup: boolean}>}
 */
const getTwoFactorStatus = async (
  userId: string
): Promise<{
  enabled: boolean;
  setup: boolean;
}> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true, twoFactorSecret: true },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  return {
    enabled: user.twoFactorEnabled,
    setup: !!user.twoFactorSecret,
  };
};

export default {
  generateSecret,
  generateQRCode,
  verifyToken,
  generateBackupCodes,
  verifyBackupCode,
  enableTwoFactor,
  disableTwoFactor,
  setupTwoFactor,
  verifyTwoFactor,
  regenerateBackupCodes,
  getTwoFactorStatus,
};
