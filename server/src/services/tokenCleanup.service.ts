import prisma from '../client';
import logger from '../config/logger';
import { TokenType } from '@prisma/client';
import moment from 'moment';

/**
 * Token Cleanup Service
 * Automatically removes expired tokens from the database
 */

interface CleanupStats {
  deletedTokens: number;
  deletedSessions: number;
  deletedOtps: number;
  duration: number;
}

/**
 * Clean up expired tokens
 * @returns {Promise<CleanupStats>} Statistics about the cleanup process
 */
const cleanupExpiredTokens = async (): Promise<CleanupStats> => {
  const startTime = Date.now();
  const stats: CleanupStats = {
    deletedTokens: 0,
    deletedSessions: 0,
    deletedOtps: 0,
    duration: 0,
  };

  try {
    logger.info('Starting token cleanup process...');

    // Check if database is connected
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (dbError) {
      logger.warn('Database not available for token cleanup, skipping...', { error: dbError });
      return {
        deletedTokens: 0,
        deletedSessions: 0,
        deletedOtps: 0,
        duration: Date.now() - startTime,
      };
    }

    // Clean up expired auth tokens (access, refresh, reset password, verify email)
    const expiredTokens = await prisma.token.deleteMany({
      where: {
        expires: {
          lt: new Date(),
        },
        type: {
          in: [
            TokenType.ACCESS,
            TokenType.REFRESH,
            TokenType.RESET_PASSWORD,
            TokenType.VERIFY_EMAIL,
          ],
        },
      },
    });

    stats.deletedTokens = expiredTokens.count;

    // Clean up expired user sessions
    const expiredSessions = await prisma.userSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    stats.deletedSessions = expiredSessions.count;

    // Clean up expired OTPs (older than 15 minutes) - handle gracefully if table doesn't exist
    try {
      const otpExpiryTime = moment().subtract(15, 'minutes').toDate();
      const expiredOtps = await prisma.otp.deleteMany({
        where: {
          expiresAt: {
            lt: otpExpiryTime,
          },
        },
      });

      stats.deletedOtps = expiredOtps.count;
    } catch (otpError) {
      logger.debug('OTP cleanup failed (table may not exist)', { error: otpError });
      stats.deletedOtps = 0;
    }

    stats.duration = Date.now() - startTime;

    logger.info('Token cleanup completed', {
      deletedTokens: stats.deletedTokens,
      deletedSessions: stats.deletedSessions,
      deletedOtps: stats.deletedOtps,
      duration: `${stats.duration}ms`,
    });

    return stats;
  } catch (error) {
    stats.duration = Date.now() - startTime;
    logger.error('Token cleanup failed', { error, stats });
    // Don't throw error, just return stats with failure info
    return stats;
  }
};

/**
 * Get statistics about current token usage
 * @returns {Promise<Object>} Current token statistics
 */
const getTokenStatistics = async () => {
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [
    totalTokens,
    expiredTokens,
    tokensExpiringSoon,
    activeTokens,
    totalSessions,
    activeSessions,
    totalOtps,
  ] = await Promise.all([
    // Total tokens
    prisma.token.count(),
    // Expired tokens
    prisma.token.count({
      where: {
        expires: {
          lt: now,
        },
      },
    }),
    // Tokens expiring in next hour
    prisma.token.count({
      where: {
        expires: {
          gte: now,
          lte: oneHourFromNow,
        },
      },
    }),
    // Active tokens
    prisma.token.count({
      where: {
        expires: {
          gt: now,
        },
        blacklisted: false,
      },
    }),
    // Total sessions
    prisma.userSession.count(),
    // Active sessions
    prisma.userSession.count({
      where: {
        isActive: true,
        expiresAt: {
          gt: now,
        },
      },
    }),
    // Total OTPs
    prisma.otp.count(),
  ]);

  return {
    tokens: {
      total: totalTokens,
      expired: expiredTokens,
      expiringSoon: tokensExpiringSoon,
      active: activeTokens,
    },
    sessions: {
      total: totalSessions,
      active: activeSessions,
    },
    otps: {
      total: totalOtps,
    },
  };
};

/**
 * Schedule token cleanup to run periodically
 * @param {number} intervalMinutes - Interval in minutes between cleanups
 */
const scheduleTokenCleanup = (intervalMinutes: number = 15) => {
  logger.info(`Scheduling token cleanup every ${intervalMinutes} minutes`);

  // Run cleanup immediately on startup
  cleanupExpiredTokens().catch(error => {
    logger.error('Initial token cleanup failed (non-critical)', { error });
  });

  // Schedule periodic cleanup
  setInterval(
    async () => {
      try {
        await cleanupExpiredTokens();
      } catch (error) {
        logger.error('Scheduled token cleanup failed (non-critical)', { error });
        // Continue running even if cleanup fails
      }
    },
    intervalMinutes * 60 * 1000
  );
};

export default {
  cleanupExpiredTokens,
  getTokenStatistics,
  scheduleTokenCleanup,
};
