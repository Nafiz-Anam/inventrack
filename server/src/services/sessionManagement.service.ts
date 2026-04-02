import httpStatus from 'http-status';
import prisma from '../client';
import ApiError from '../utils/ApiError';
import { UserSession, SessionSecurityEvent } from '@prisma/client';

interface SessionData {
  userId: string;
  sessionId: string;
  deviceId?: string;
  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
}

interface SessionFilters {
  userId?: string;
  isActive?: boolean;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

/**
 * Session Management Service
 * Handles user sessions, security monitoring, and analytics
 */
class SessionManagementService {
  /**
   * Create new session
   */
  async createSession(data: SessionData): Promise<UserSession> {
    const { userId, sessionId, deviceId, deviceName, ipAddress, userAgent, expiresAt } = data;

    return await prisma.userSession.create({
      data: {
        userId,
        sessionId,
        deviceId,
        deviceName,
        ipAddress,
        userAgent,
        expiresAt,
        isActive: true,
        lastActivity: new Date(),
      },
    });
  }

  /**
   * Get session by session ID
   */
  async getSessionBySessionId(sessionId: string): Promise<UserSession | null> {
    return await prisma.userSession.findUnique({
      where: { sessionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get user's sessions
   */
  async getUserSessions(
    userId: string,
    filters: Partial<SessionFilters> = {}
  ): Promise<{
    sessions: UserSession[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { isActive, startDate, endDate, page = 1, limit = 20 } = filters;

    const where: any = { userId };

    if (isActive !== undefined) where.isActive = isActive;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      prisma.userSession.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: { lastActivity: 'desc' },
        skip,
        take: limit,
      }),
      prisma.userSession.count({ where }),
    ]);

    return {
      sessions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    await prisma.userSession.update({
      where: { sessionId },
      data: {
        lastActivity: new Date(),
      },
    });
  }

  /**
   * Revoke session
   */
  async revokeSession(sessionId: string): Promise<void> {
    const session = await prisma.userSession.findUnique({
      where: { sessionId },
    });

    if (!session) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Session not found');
    }

    await prisma.userSession.update({
      where: { sessionId },
      data: {
        isActive: false,
      },
    });

    // Create security event
    await this.createSecurityEvent(sessionId, 'SESSION_REVOKED', 0.5, {
      revokedAt: new Date(),
    });
  }

  /**
   * Revoke all user sessions except current
   */
  async revokeOtherSessions(userId: string, currentSessionId: string): Promise<number> {
    const result = await prisma.userSession.updateMany({
      where: {
        userId,
        sessionId: {
          not: currentSessionId,
        },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Create security events for revoked sessions
    const revokedSessions = await prisma.userSession.findMany({
      where: {
        userId,
        sessionId: {
          not: currentSessionId,
        },
        isActive: false,
      },
    });

    for (const session of revokedSessions) {
      await this.createSecurityEvent(session.sessionId, 'BULK_SESSION_REVOKED', 0.3, {
        revokedAt: new Date(),
      });
    }

    return result.count;
  }

  /**
   * Revoke all user sessions
   */
  async revokeAllUserSessions(userId: string): Promise<number> {
    const result = await prisma.userSession.updateMany({
      where: {
        userId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Create security events
    const revokedSessions = await prisma.userSession.findMany({
      where: {
        userId,
        isActive: false,
      },
    });

    for (const session of revokedSessions) {
      await this.createSecurityEvent(session.sessionId, 'ALL_SESSIONS_REVOKED', 0.7, {
        revokedAt: new Date(),
      });
    }

    return result.count;
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await prisma.userSession.updateMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    return result.count;
  }

  /**
   * Create security event
   */
  async createSecurityEvent(
    sessionId: string,
    eventType: string,
    riskScore: number,
    details?: any
  ): Promise<SessionSecurityEvent> {
    return await prisma.sessionSecurityEvent.create({
      data: {
        sessionId,
        eventType,
        riskScore,
        details,
      },
    });
  }

  /**
   * Get security events for session
   */
  async getSessionSecurityEvents(sessionId: string): Promise<SessionSecurityEvent[]> {
    return await prisma.sessionSecurityEvent.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Get user's security events
   */
  async getUserSecurityEvents(userId: string): Promise<SessionSecurityEvent[]> {
    // Get user's sessions first
    const userSessions = await prisma.userSession.findMany({
      where: { userId },
      select: { sessionId: true },
    });

    const sessionIds = userSessions.map(s => s.sessionId);

    return await prisma.sessionSecurityEvent.findMany({
      where: {
        sessionId: {
          in: sessionIds,
        },
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Resolve security event
   */
  async resolveSecurityEvent(eventId: string, resolvedBy: string): Promise<SessionSecurityEvent> {
    const event = await prisma.sessionSecurityEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Security event not found');
    }

    return await prisma.sessionSecurityEvent.update({
      where: { id: eventId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy,
      },
    });
  }

  /**
   * Check for suspicious activity
   */
  async checkSuspiciousActivity(userId: string): Promise<{
    isSuspicious: boolean;
    riskScore: number;
    reasons: string[];
  }> {
    const sessions = await prisma.userSession.findMany({
      where: {
        userId,
        isActive: true,
        lastActivity: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      orderBy: { lastActivity: 'desc' },
    });

    const reasons: string[] = [];
    let riskScore = 0;

    // Check for multiple concurrent sessions
    if (sessions.length > 3) {
      reasons.push('Multiple concurrent sessions detected');
      riskScore += 0.3;
    }

    // Check for sessions from different IP addresses
    const ipAddresses = new Set(sessions.map(s => s.ipAddress));
    if (ipAddresses.size > 2) {
      reasons.push('Sessions from multiple IP addresses');
      riskScore += 0.4;
    }

    // Check for recent security events
    const userSessions = await prisma.userSession.findMany({
      where: { userId },
      select: { sessionId: true },
    });

    const sessionIds = userSessions.map(s => s.sessionId);

    const recentEvents = await prisma.sessionSecurityEvent.findMany({
      where: {
        sessionId: {
          in: sessionIds,
        },
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
        resolved: false,
      },
    });

    if (recentEvents.length > 0) {
      reasons.push('Recent unresolved security events');
      riskScore += recentEvents.length * 0.2;
    }

    return {
      isSuspicious: riskScore > 0.5,
      riskScore: Math.min(riskScore, 1.0),
      reasons,
    };
  }

  /**
   * Get session analytics
   */
  async getSessionAnalytics(userId?: string): Promise<{
    totalSessions: number;
    activeSessions: number;
    recentLogins: UserSession[];
    analyticsSecurityEvents: SessionSecurityEvent[];
  }> {
    const where = userId ? { userId } : {};

    const [totalSessions, activeSessions, recentLogins] = await Promise.all([
      prisma.userSession.count({ where }),
      prisma.userSession.count({
        where: {
          ...where,
          isActive: true,
        },
      }),
      prisma.userSession.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: { lastActivity: 'desc' },
        take: 10,
      }),
    ]);

    const securityEvents = await (async () => {
      if (userId) {
        const userSessions = await prisma.userSession.findMany({
          where: { userId },
          select: { sessionId: true },
        });

        const sessionIds = userSessions.map(s => s.sessionId);

        return await prisma.sessionSecurityEvent.findMany({
          where: {
            sessionId: {
              in: sessionIds,
            },
            resolved: false,
          },
          orderBy: { timestamp: 'desc' },
          take: 10,
        });
      } else {
        return await prisma.sessionSecurityEvent.findMany({
          where: {
            resolved: false,
          },
          orderBy: { timestamp: 'desc' },
          take: 10,
        });
      }
    })();

    return {
      totalSessions,
      activeSessions,
      recentLogins,
      analyticsSecurityEvents: securityEvents,
    };
  }

  /**
   * Get session security score
   */
  async getSessionSecurityScore(sessionId: string): Promise<number> {
    const session = await prisma.userSession.findUnique({
      where: { sessionId },
    });

    if (!session) {
      return 0;
    }

    const securityEvents = await prisma.sessionSecurityEvent.findMany({
      where: { sessionId },
    });

    let score = 1.0; // Start with perfect score

    // Subtract points for security events
    for (const event of securityEvents) {
      if (!event.resolved) {
        score -= event.riskScore;
      }
    }

    // Add points for trusted device
    const trustedEvents = securityEvents.filter(e => e.eventType === 'DEVICE_TRUSTED');
    score += trustedEvents.length * 0.1;

    return Math.max(0, Math.min(1, score));
  }
}

export default SessionManagementService;
