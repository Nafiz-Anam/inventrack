import { Device, Token, DeviceType } from '@prisma/client';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import ApiError from '../utils/ApiError';
import httpStatus from 'http-status';
import prisma from '../client';

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: DeviceType;
  ipAddress?: string;
  userAgent?: string;
}

export interface DeviceSession {
  deviceId: string;
  deviceName: string;
  deviceType: DeviceType;
  ipAddress?: string;
  userAgent?: string;
  isTrusted: boolean;
  lastUsed: Date;
}

/**
 * Get user devices
 * @param {string} userId - User ID
 * @returns {Promise<Device[]>}
 */
const getUserDevices = async (userId: string): Promise<Device[]> => {
  return prisma.device.findMany({
    where: { userId },
    orderBy: { lastUsed: 'desc' },
  });
};

/**
 * Get device by ID
 * @param {string} deviceId - Device ID
 * @param {string} userId - User ID
 * @returns {Promise<Device | null>}
 */
const getDeviceById = async (deviceId: string, userId: string): Promise<Device | null> => {
  return prisma.device.findFirst({
    where: {
      deviceId,
      userId,
    },
  });
};

/**
 * Create or update device session
 * @param {string} userId - User ID
 * @param {string} refreshToken - Refresh token
 * @param {Request} req - Express request object
 * @returns {Promise<DeviceSession>}
 */
const createDeviceSession = async (
  userId: string,
  refreshToken: string,
  req: Request
): Promise<DeviceSession> => {
  const deviceInfo = extractDeviceInfo(req);
  console.log(
    '[DEVICE] Creating/updating device session for user:',
    userId,
    'Device info:',
    deviceInfo
  );

  // Check if device already exists
  let device = await getDeviceById(deviceInfo.deviceId, userId);

  if (device) {
    // Update existing device
    device = await prisma.device.update({
      where: { id: device.id },
      data: {
        lastUsed: new Date(),
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
      },
    });
  } else {
    // Create new device
    device = await prisma.device.create({
      data: {
        userId,
        deviceId: deviceInfo.deviceId,
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        isTrusted: false,
        lastUsed: new Date(),
      },
    });
  }

  // Update token with device info
  await prisma.token.updateMany({
    where: {
      token: refreshToken,
      userId,
    },
    data: {
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
    },
  });

  return {
    deviceId: device.deviceId,
    deviceName: device.deviceName,
    deviceType: device.deviceType,
    ipAddress: device.ipAddress || undefined,
    userAgent: device.userAgent || undefined,
    isTrusted: device.isTrusted,
    lastUsed: device.lastUsed,
  };
};

/**
 * Mark device as trusted
 * @param {string} userId - User ID
 * @param {string} deviceId - Device ID
 * @returns {Promise<Device>}
 */
const trustDevice = async (userId: string, deviceId: string): Promise<Device> => {
  const device = await getDeviceById(deviceId, userId);

  if (!device) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Device not found');
  }

  return prisma.device.update({
    where: { id: device.id },
    data: { isTrusted: true },
  });
};

/**
 * Remove device
 * @param {string} userId - User ID
 * @param {string} deviceId - Device ID
 * @returns {Promise<void>}
 */
const removeDevice = async (userId: string, deviceId: string): Promise<void> => {
  const device = await getDeviceById(deviceId, userId);

  if (!device) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Device not found');
  }

  // Remove all tokens associated with this device
  await prisma.token.deleteMany({
    where: {
      userId,
      deviceId,
    },
  });

  // Remove the device
  await prisma.device.delete({
    where: { id: device.id },
  });
};

/**
 * Remove all devices except the current one
 * @param {string} userId - User ID
 * @param {string} currentDeviceId - Current device ID to keep
 * @returns {Promise<number>} Number of devices removed
 */
const removeAllOtherDevices = async (userId: string, currentDeviceId: string): Promise<number> => {
  // Remove all tokens from other devices
  const tokensRemoved = await prisma.token.deleteMany({
    where: {
      userId,
      deviceId: {
        not: currentDeviceId,
      },
    },
  });

  // Remove all other devices
  const devicesRemoved = await prisma.device.deleteMany({
    where: {
      userId,
      deviceId: {
        not: currentDeviceId,
      },
    },
  });

  return devicesRemoved.count;
};

/**
 * Get device sessions (active tokens)
 * @param {string} userId - User ID
 * @returns {Promise<DeviceSession[]>}
 */
const getDeviceSessions = async (userId: string): Promise<DeviceSession[]> => {
  const devices = await getUserDevices(userId);

  return devices.map(device => ({
    deviceId: device.deviceId,
    deviceName: device.deviceName,
    deviceType: device.deviceType,
    ipAddress: device.ipAddress || undefined,
    userAgent: device.userAgent || undefined,
    isTrusted: device.isTrusted,
    lastUsed: device.lastUsed,
  }));
};

/**
 * Extract device information from request
 * @param {Request} req - Express request object
 * @returns {DeviceInfo}
 */
const extractDeviceInfo = (req: Request): DeviceInfo => {
  const userAgent = req.get('User-Agent') || '';
  let deviceName = (req.headers['x-device-name'] as string) || '';
  if (!deviceName) {
    // Simple user-agent parsing for common browsers/devices
    if (/iPhone/i.test(userAgent)) deviceName = 'iPhone';
    else if (/iPad/i.test(userAgent)) deviceName = 'iPad';
    else if (/Android/i.test(userAgent)) deviceName = 'Android';
    else if (/Windows/i.test(userAgent)) deviceName = 'Windows PC';
    else if (/Macintosh/i.test(userAgent)) deviceName = 'Mac';
    else if (/Chrome/i.test(userAgent)) deviceName = 'Chrome Browser';
    else if (/Firefox/i.test(userAgent)) deviceName = 'Firefox Browser';
    else if (/Safari/i.test(userAgent)) deviceName = 'Safari Browser';
    else deviceName = userAgent.split(' ')[0] || 'Unknown Device';
  }
  return {
    deviceId: (req.headers['x-device-id'] as string) || uuidv4(),
    deviceName,
    deviceType: (req.headers['x-device-type'] as DeviceType) || DeviceType.UNKNOWN,
    ipAddress: req.ip,
    userAgent: userAgent || undefined,
  };
};

/**
 * Check if user has reached device limit
 * @param {string} userId - User ID
 * @param {number} limit - Maximum number of devices allowed
 * @returns {Promise<boolean>}
 */
const hasReachedDeviceLimit = async (userId: string, limit: number = 3): Promise<boolean> => {
  const deviceCount = await prisma.device.count({
    where: { userId },
  });

  return deviceCount >= limit;
};

const listActiveDeviceSessions = async (userId: string) => {
  return prisma.userSession.findMany({
    where: { userId, isActive: true },
    orderBy: { lastActivity: 'desc' },
  });
};

export default {
  getUserDevices,
  getDeviceById,
  createDeviceSession,
  trustDevice,
  removeDevice,
  removeAllOtherDevices,
  getDeviceSessions,
  extractDeviceInfo,
  hasReachedDeviceLimit,
  listActiveDeviceSessions,
};
