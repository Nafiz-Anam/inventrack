import { ActivityType } from '@prisma/client';
import { Request } from 'express';
import prisma from '../client';

export interface ActivityData {
  userId: string;
  activityType: ActivityType;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * Log user activity
 * @param {ActivityData} activityData - Activity data
 * @returns {Promise<any>}
 */
const logActivity = async (activityData: ActivityData): Promise<any> => {
  return prisma.userActivity.create({
    data: {
      userId: activityData.userId,
      activityType: activityData.activityType,
      description: activityData.description,
      ipAddress: activityData.ipAddress,
      userAgent: activityData.userAgent,
      metadata: activityData.metadata,
    },
  });
};

/**
 * Log login activity
 * @param {string} userId - User ID
 * @param {Request} req - Express request object
 * @param {object} [metadata] - Additional metadata
 * @returns {Promise<void>}
 */
const logLoginActivity = async (
  userId: string,
  req: Request,
  metadata: Record<string, any> = {}
): Promise<void> => {
  const activityData: ActivityData = {
    userId,
    activityType: ActivityType.LOGIN,
    description: 'User logged in',
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    metadata: {
      ...metadata,
      timestamp: new Date(),
    },
  };

  await logActivity(activityData);
};

/**
 * Log logout activity
 * @param {string} userId - User ID
 * @param {Request} req - Express request object
 * @returns {Promise<void>}
 */
const logLogoutActivity = async (userId: string, req: Request): Promise<void> => {
  const activityData: ActivityData = {
    userId,
    activityType: ActivityType.LOGOUT,
    description: 'User logged out',
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    metadata: {
      timestamp: new Date(),
    },
  };

  await logActivity(activityData);
};

/**
 * Log profile update activity
 * @param {string} userId - User ID
 * @param {Request} req - Express request object
 * @param {string} field - Field that was updated
 * @returns {Promise<void>}
 */
const logProfileUpdateActivity = async (
  userId: string,
  req: Request,
  field: string
): Promise<void> => {
  const activityData: ActivityData = {
    userId,
    activityType: ActivityType.PROFILE_UPDATE,
    description: `Profile ${field} updated`,
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    metadata: {
      field,
      timestamp: new Date(),
    },
  };

  await logActivity(activityData);
};

/**
 * Log password change activity
 * @param {string} userId - User ID
 * @param {Request} req - Express request object
 * @returns {Promise<void>}
 */
const logPasswordChangeActivity = async (userId: string, req: Request): Promise<void> => {
  const activityData: ActivityData = {
    userId,
    activityType: ActivityType.PASSWORD_CHANGE,
    description: 'Password changed',
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    metadata: {
      timestamp: new Date(),
    },
  };

  await logActivity(activityData);
};

/**
 * Log 2FA activity
 * @param {string} userId - User ID
 * @param {ActivityType} type - Type of 2FA activity
 * @param {Request} req - Express request object
 * @param {object} [metadata] - Additional metadata
 * @returns {Promise<void>}
 */
const logTwoFactorActivity = async (
  userId: string,
  type: ActivityType,
  req: Request,
  metadata: Record<string, any> = {}
): Promise<void> => {
  const activityData: ActivityData = {
    userId,
    activityType: type,
    description: `Two-factor authentication: ${type}`,
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    metadata: {
      ...metadata,
      timestamp: new Date(),
    },
  };

  await logActivity(activityData);
};

/**
 * Log device management activity
 * @param {string} userId - User ID
 * @param {ActivityType} type - Type of device activity
 * @param {Request} req - Express request object
 * @param {object} deviceInfo - Device information
 * @returns {Promise<void>}
 */
const logDeviceActivity = async (
  userId: string,
  type: ActivityType,
  req: Request,
  deviceInfo: {
    deviceId: string;
    deviceName: string;
    browser?: string;
    os?: string;
  }
): Promise<void> => {
  const activityData: ActivityData = {
    userId,
    activityType: type,
    description: `Device management: ${type}`,
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    metadata: {
      deviceInfo,
      timestamp: new Date(),
    },
  };

  await logActivity(activityData);
};

/**
 * Get user activity logs
 * @param {string} userId - User ID
 * @param {object} options - Query options
 * @returns {Promise<{activities: any[], total: number}>}
 */
const getUserActivities = async (
  userId: string,
  options: {
    page?: number;
    limit?: number;
    type?: ActivityType;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{
  activities: any[];
  total: number;
}> => {
  const { page = 1, limit = 20, type, startDate, endDate } = options;
  const skip = (page - 1) * limit;

  const where: any = { userId };
  if (type) where.activityType = type;
  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) where.timestamp.gte = startDate;
    if (endDate) where.timestamp.lte = endDate;
  }

  const [activities, total] = await Promise.all([
    prisma.userActivity.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
    }),
    prisma.userActivity.count({ where }),
  ]);

  return { activities, total };
};

/**
 * Get activity statistics
 * @param {string} userId - User ID
 * @param {number} days - Number of days to look back
 * @returns {Promise<{
 *   totalActivities: number,
 *   byType: Record<string, number>,
 *   recentActivity: any[],
 *   activityTrend: any[]
 * }>}
 */
const getActivityStats = async (
  userId: string,
  days: number = 30
): Promise<{
  totalActivities: number;
  byType: Record<string, number>;
  recentActivity: any[];
  activityTrend: any[];
}> => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const where = {
    userId,
    timestamp: {
      gte: startDate,
    },
  };

  const [totalActivities, byType, recentActivity] = await Promise.all([
    prisma.userActivity.count({ where }),
    prisma.userActivity.groupBy({
      by: ['activityType'],
      where,
      _count: { activityType: true },
    }),
    prisma.userActivity.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 10,
    }),
  ]);

  // Get activity trend (daily counts)
  const activityTrend = await prisma.userActivity.groupBy({
    by: ['timestamp'],
    where,
    _count: { timestamp: true },
  });

  const byTypeMap: Record<string, number> = {};
  byType.forEach(item => {
    byTypeMap[item.activityType] = item._count.activityType;
  });

  return {
    totalActivities,
    byType: byTypeMap,
    recentActivity,
    activityTrend: activityTrend.map(item => ({
      date: item.timestamp,
      count: item._count.timestamp,
    })),
  };
};

/**
 * Get user session history
 * @param {string} userId - User ID
 * @param {object} options - Query options
 * @returns {Promise<{sessions: any[], total: number}>}
 */
const getSessionHistory = async (
  userId: string,
  options: {
    page?: number;
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{
  sessions: any[];
  total: number;
}> => {
  const { page = 1, limit = 20, startDate, endDate } = options;
  const skip = (page - 1) * limit;

  const where: any = { userId };
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [sessions, total] = await Promise.all([
    prisma.userSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.userSession.count({ where }),
  ]);

  return { sessions, total };
};

/**
 * Clean old activity logs
 * @param {number} daysToKeep - Number of days to keep logs
 * @returns {Promise<number>} Number of logs deleted
 */
const cleanOldActivities = async (daysToKeep: number = 90): Promise<number> => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await prisma.userActivity.deleteMany({
    where: {
      timestamp: {
        lt: cutoffDate,
      },
    },
  });

  return result.count;
};

/**
 * Create activity with simplified interface
 * @param {object} data - Activity data
 * @returns {Promise<any>}
 */
const createActivity = async (data: {
  userId: string;
  activityType: ActivityType;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}): Promise<any> => {
  return prisma.userActivity.create({
    data: {
      userId: data.userId,
      activityType: data.activityType,
      description: data.description,
      metadata: data.metadata,
      ipAddress: data.ipAddress,
    },
  });
};

export default {
  logActivity,
  logLoginActivity,
  logLogoutActivity,
  logProfileUpdateActivity,
  logPasswordChangeActivity,
  logTwoFactorActivity,
  logDeviceActivity,
  getUserActivities,
  getActivityStats,
  getSessionHistory,
  cleanOldActivities,
  createActivity,
};
