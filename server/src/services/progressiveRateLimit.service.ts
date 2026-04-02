import { Request, Response } from 'express';
import Redis from 'ioredis';
import logger from '../config/logger';
import config from '../config/config';

interface RateLimitConfig {
  baseWindowMs: number;
  baseMaxRequests: number;
  maxPenaltyMultiplier: number;
  penaltyIncrementMs: number;
  resetAfterMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
  penaltyLevel: number;
  totalRequests: number;
}

class ProgressiveRateLimitService {
  private redis: Redis;
  private configs: Map<string, RateLimitConfig> = new Map();

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.redis.on('error', error => {
      logger.error('Redis connection error in rate limiter', { error });
    });

    this.redis.on('connect', () => {
      logger.info('Connected to Redis for rate limiting');
    });

    this.initializeConfigs();
  }

  private initializeConfigs() {
    // Authentication endpoints - very strict
    this.configs.set('auth', {
      baseWindowMs: 15 * 60 * 1000, // 15 minutes
      baseMaxRequests: config.env === 'production' ? 5 : 10,
      maxPenaltyMultiplier: 8, // Max 8x penalty
      penaltyIncrementMs: 5 * 60 * 1000, // 5 minutes penalty per violation
      resetAfterMs: 60 * 60 * 1000, // Reset after 1 hour of no attempts
    });

    // Password reset - extremely strict
    this.configs.set('password-reset', {
      baseWindowMs: 60 * 60 * 1000, // 1 hour
      baseMaxRequests: config.env === 'production' ? 3 : 5,
      maxPenaltyMultiplier: 16, // Max 16x penalty
      penaltyIncrementMs: 30 * 60 * 1000, // 30 minutes penalty per violation
      resetAfterMs: 4 * 60 * 60 * 1000, // Reset after 4 hours
    });

    // Registration - strict
    this.configs.set('registration', {
      baseWindowMs: 60 * 60 * 1000, // 1 hour
      baseMaxRequests: config.env === 'production' ? 3 : 5,
      maxPenaltyMultiplier: 6, // Max 6x penalty
      penaltyIncrementMs: 15 * 60 * 1000, // 15 minutes penalty per violation
      resetAfterMs: 2 * 60 * 60 * 1000, // Reset after 2 hours
    });

    // General API - lenient
    this.configs.set('api', {
      baseWindowMs: 15 * 60 * 1000, // 15 minutes
      baseMaxRequests: config.env === 'production' ? 100 : 200,
      maxPenaltyMultiplier: 4, // Max 4x penalty
      penaltyIncrementMs: 2 * 60 * 1000, // 2 minutes penalty per violation
      resetAfterMs: 30 * 60 * 1000, // Reset after 30 minutes
    });
  }

  /**
   * Generate a unique key for rate limiting
   */
  private generateKey(req: Request, type: string): string {
    const ip = req.ip || '127.0.0.1';
    const userAgent = req.get('User-Agent') || 'Unknown';
    const userId = (req as any).user?.id;

    // Use user ID for authenticated requests, IP + user agent for anonymous
    const identifier = userId ? `user:${userId}` : `ip:${ip}:ua:${userAgent}`;

    return `rate_limit:${type}:${identifier}`;
  }

  /**
   * Check if rate limit is exceeded with progressive penalties
   */
  async checkRateLimit(req: Request, type: string): Promise<RateLimitResult> {
    const config = this.configs.get(type);
    if (!config) {
      throw new Error(`Unknown rate limit type: ${type}`);
    }

    const key = this.generateKey(req, type);
    const now = Date.now();

    try {
      const pipeline = this.redis.pipeline();

      // Get current rate limit data
      pipeline.hgetall(key);

      // Update last access time
      pipeline.hset(key, 'lastAccess', now.toString());

      const results = await pipeline.exec();
      const currentData = (results?.[0]?.[1] as any) || {};

      const {
        requests = 0,
        violations = 0,
        penaltyLevel = 0,
        windowStart = now,
        lastViolation = 0,
      } = currentData;

      // Calculate penalty multiplier
      const penaltyMultiplier = Math.min(config.maxPenaltyMultiplier, 1 + penaltyLevel);

      // Calculate effective limits
      const effectiveWindowMs = config.baseWindowMs * penaltyMultiplier;
      const effectiveMaxRequests = Math.max(
        1,
        Math.floor(config.baseMaxRequests / penaltyMultiplier)
      );

      // Check if we need to reset the window
      const timeSinceWindowStart = now - parseInt(windowStart);
      const shouldReset = timeSinceWindowStart >= effectiveWindowMs;

      let newRequests = parseInt(requests);
      let newViolations = parseInt(violations);
      let newPenaltyLevel = parseInt(penaltyLevel);

      if (shouldReset) {
        // Reset window
        newRequests = 1;
        newPenaltyLevel = Math.max(0, newPenaltyLevel - 1); // Decay penalty
      } else {
        newRequests += 1;
      }

      const allowed = newRequests <= effectiveMaxRequests;

      if (!allowed) {
        // Increase violation and penalty
        newViolations += 1;
        newPenaltyLevel = Math.min(config.maxPenaltyMultiplier, newPenaltyLevel + 1);
      }

      // Calculate reset time
      const resetTime = new Date(windowStart + effectiveWindowMs);

      // Update Redis with new values
      await this.redis.hset(key, {
        requests: newRequests.toString(),
        violations: newViolations.toString(),
        penaltyLevel: newPenaltyLevel.toString(),
        windowStart: shouldReset ? now.toString() : windowStart,
        lastViolation: (!allowed ? now : lastViolation).toString(),
      });

      // Set expiration for cleanup
      await this.redis.expire(key, Math.ceil(config.resetAfterMs / 1000));

      const result: RateLimitResult = {
        allowed,
        remaining: Math.max(0, effectiveMaxRequests - newRequests),
        resetTime,
        penaltyLevel: newPenaltyLevel,
        totalRequests: newRequests,
      };

      if (!allowed) {
        result.retryAfter = Math.ceil(effectiveWindowMs / 1000);
      }

      // Log rate limit events
      if (!allowed || newPenaltyLevel > 2) {
        logger.warn('Rate limit event', {
          type,
          key,
          allowed,
          penaltyLevel: newPenaltyLevel,
          requests: newRequests,
          effectiveMaxRequests,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });
      }

      return result;
    } catch (error) {
      logger.error('Rate limit check failed', { error, type, key });
      // Fail open - allow request if rate limiting fails
      return {
        allowed: true,
        remaining: 999,
        resetTime: new Date(Date.now() + 15 * 60 * 1000),
        penaltyLevel: 0,
        totalRequests: 0,
      };
    }
  }

  /**
   * Reset rate limit for a specific key
   */
  async resetRateLimit(req: Request, type: string): Promise<void> {
    const key = this.generateKey(req, type);
    await this.redis.del(key);
    logger.info('Rate limit reset', { type, key });
  }

  /**
   * Get rate limit statistics
   */
  async getStats(type: string): Promise<any> {
    const pattern = `rate_limit:${type}:*`;
    const keys = await this.redis.keys(pattern);

    if (keys.length === 0) {
      return { totalKeys: 0, averagePenaltyLevel: 0, totalViolations: 0 };
    }

    const pipeline = this.redis.pipeline();
    keys.forEach(key => pipeline.hgetall(key));
    const results = await pipeline.exec();

    let totalPenaltyLevel = 0;
    let totalViolations = 0;

    results?.forEach(([error, data]) => {
      if (data && typeof data === 'object') {
        const dataObj = data as any;
        totalPenaltyLevel += parseInt(dataObj.penaltyLevel || '0');
        totalViolations += parseInt(dataObj.violations || '0');
      }
    });

    return {
      totalKeys: keys.length,
      averagePenaltyLevel: totalPenaltyLevel / keys.length,
      totalViolations,
    };
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

// Singleton instance
const progressiveRateLimitService = new ProgressiveRateLimitService();

export default progressiveRateLimitService;
