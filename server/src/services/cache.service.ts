import Redis from 'ioredis';
import config from '../config/config';
import logger from '../config/logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyPrefix?: string;
}

class CacheService {
  private redis: Redis;
  private isConnected: boolean = false;

  constructor() {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      db: config.redis.db,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    this.redis.on('connect', () => {
      this.isConnected = true;
      logger.info('Redis connected successfully');
    });

    this.redis.on('error', error => {
      this.isConnected = false;
      logger.error('Redis connection error:', error);
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');
    });
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      return null;
    }

    try {
      const value = await this.redis.get(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache get error:', { key, error });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const serializedValue = JSON.stringify(value);
      const finalKey = options.keyPrefix ? `${options.keyPrefix}:${key}` : key;

      if (options.ttl) {
        await this.redis.setex(finalKey, options.ttl, serializedValue);
      } else {
        await this.redis.set(finalKey, serializedValue);
      }

      return true;
    } catch (error) {
      logger.error('Cache set error:', { key, error });
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      logger.error('Cache delete error:', { key, error });
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error:', { key, error });
      return false;
    }
  }

  /**
   * Increment counter
   */
  async incr(key: string, increment = 1): Promise<number | null> {
    if (!this.isConnected) {
      return null;
    }

    try {
      return await this.redis.incrby(key, increment);
    } catch (error) {
      logger.error('Cache increment error:', { key, error });
      return null;
    }
  }

  /**
   * Set with expiration if not exists
   */
  async setnx<T>(key: string, value: T, ttl: number): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const serializedValue = JSON.stringify(value);
      const result = await this.redis.set(key, serializedValue, 'EX', ttl, 'NX');
      return result === 'OK';
    } catch (error) {
      logger.error('Cache setnx error:', { key, error });
      return false;
    }
  }

  /**
   * Get multiple keys
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (!this.isConnected) {
      return keys.map(() => null);
    }

    try {
      const values = await this.redis.mget(...keys);
      return values.map(value => {
        if (value === null) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      logger.error('Cache mget error:', { keys, error });
      return keys.map(() => null);
    }
  }

  /**
   * Delete multiple keys
   */
  async mdel(keys: string[]): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.redis.del(...keys);
      return result > 0;
    } catch (error) {
      logger.error('Cache mdel error:', { keys, error });
      return false;
    }
  }

  /**
   * Clear all cache
   */
  async flush(): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.redis.flushdb();
      return true;
    } catch (error) {
      logger.error('Cache flush error:', error);
      return false;
    }
  }

  /**
   * Cache wrapper function with automatic TTL
   */
  async wrap<T>(key: string, fetcher: () => Promise<T>, options: CacheOptions = {}): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const data = await fetcher();

    // Cache the result
    await this.set(key, data, options);

    return data;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    if (!this.isConnected) {
      return null;
    }

    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');

      return {
        memory: info,
        keyspace: keyspace,
        connected: this.isConnected,
      };
    } catch (error) {
      logger.error('Cache stats error:', error);
      return null;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number }> {
    if (!this.isConnected) {
      return { status: 'unhealthy' };
    }

    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;

      return { status: 'healthy', latency };
    } catch (error) {
      logger.error('Cache health check error:', error);
      return { status: 'unhealthy' };
    }
  }

  /**
   * Close connection
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      this.isConnected = false;
      logger.info('Redis disconnected');
    } catch (error) {
      logger.error('Redis disconnect error:', error);
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

export default cacheService;

// Cache key constants
export const CacheKeys = {
  USER_PROFILE: (userId: string) => `user:profile:${userId}`,
  USER_PREFERENCES: (userId: string) => `user:preferences:${userId}`,
  USER_SESSIONS: (userId: string) => `user:sessions:${userId}`,
  RATE_LIMIT: (identifier: string, operation: string) => `rate_limit:${identifier}:${operation}`,
  OTP: (userId: string, type: string) => `otp:${userId}:${type}`,
  PASSWORD_RESET_TOKEN: (token: string) => `password_reset:${token}`,
  EMAIL_VERIFICATION_TOKEN: (token: string) => `email_verification:${token}`,
  API_RESPONSE: (endpoint: string, params: string) => `api:response:${endpoint}:${params}`,
  USER_SEARCH: (query: string) => `search:users:${query}`,
  ADMIN_STATS: 'admin:stats',
  SYSTEM_CONFIG: 'system:config',
} as const;

// Default TTL values (in seconds)
export const CacheTTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 900, // 15 minutes
  HOUR: 3600, // 1 hour
  DAY: 86400, // 1 day
  WEEK: 604800, // 1 week
  MONTH: 2592000, // 1 month
} as const;
