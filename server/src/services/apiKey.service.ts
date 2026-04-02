import { PrismaClient, User } from '@prisma/client';
import crypto from 'crypto';
import ApiError from '../utils/ApiError';
import httpStatus from 'http-status';
import { Request } from 'express';
import AuditLogService from './auditLog.service';
import { SecurityEventType } from '@prisma/client';

// Define ApiKey type locally since it's not exported from Prisma
type ApiKey = {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  hashedKey: string;
  permissions: any;
  expiresAt?: Date | null;
  rateLimitPerHour: number;
  allowedIPs: any;
  allowedOrigins: any;
  isActive: boolean;
  lastUsedAt?: Date | null;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
};

// Public ApiKey type (without sensitive data)
type PublicApiKey = Omit<ApiKey, 'hashedKey'>;

interface CreateApiKeyData {
  name: string;
  description?: string;
  permissions: string[];
  expiresAt?: Date;
  rateLimitPerHour?: number;
  allowedIPs?: string[];
  allowedOrigins?: string[];
}

interface ApiKeyUsage {
  apiKeyId: string;
  userId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  ipAddress: string;
  userAgent?: string;
}

class ApiKeyService {
  private prisma: PrismaClient;
  private keyCache: Map<string, ApiKey> = new Map();
  private usageCache: Map<string, ApiKeyUsage[]> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private auditLogService: AuditLogService;

  constructor() {
    this.prisma = new PrismaClient();
    this.auditLogService = new AuditLogService();
  }

  /**
   * Generate a new API key
   */
  private generateApiKey(): string {
    return `ak_${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Hash API key for storage
   */
  private hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Create a new API key
   */
  async createApiKey(userId: string, data: CreateApiKeyData, req: Request): Promise<ApiKey> {
    const apiKey = this.generateApiKey();
    const hashedKey = this.hashApiKey(apiKey);

    try {
      const createdApiKey = await this.prisma.apiKey.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          name: data.name,
          description: data.description,
          hashedKey,
          permissions: data.permissions,
          expiresAt: data.expiresAt,
          rateLimitPerHour: data.rateLimitPerHour || 1000,
          allowedIPs: data.allowedIPs || [],
          allowedOrigins: data.allowedOrigins || [],
          isActive: true,
          lastUsedAt: null,
          usageCount: 0,
        },
      });

      // Log the creation
      await this.auditLogService.createLog({
        userId,
        action: 'API_KEY_CREATED',
        resource: 'ApiKey',
        resourceId: createdApiKey.id,
        newValues: {
          name: data.name,
          permissions: data.permissions,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // Return the key with the actual key (only shown once)
      return { ...createdApiKey, key: apiKey } as any;
    } catch (error) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create API key');
    }
  }

  /**
   * Validate API key
   */
  async validateApiKey(apiKey: string, req: Request): Promise<ApiKey | null> {
    const hashedKey = this.hashApiKey(apiKey);

    // Check cache first
    const cachedKey = this.keyCache.get(apiKey);
    if (cachedKey && this.isKeyValid(cachedKey, req)) {
      await this.updateKeyUsage(cachedKey.id, req);
      return cachedKey;
    }

    // Check database
    const dbKey = await this.prisma.apiKey.findFirst({
      where: {
        hashedKey,
        isActive: true,
      },
    });

    if (!dbKey) {
      return null;
    }

    if (!this.isKeyValid(dbKey, req)) {
      return null;
    }

    // Cache the key
    this.keyCache.set(apiKey, dbKey);
    setTimeout(() => this.keyCache.delete(apiKey), this.cacheTimeout);

    await this.updateKeyUsage(dbKey.id, req);
    return dbKey;
  }

  /**
   * Check if API key is valid
   */
  private isKeyValid(apiKey: ApiKey, req: Request): boolean {
    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return false;
    }

    // Check IP restrictions
    if (apiKey.allowedIPs.length > 0) {
      const clientIP = req.ip || req.connection.remoteAddress;
      if (!apiKey.allowedIPs.includes(clientIP as string)) {
        return false;
      }
    }

    // Check origin restrictions
    if (apiKey.allowedOrigins.length > 0) {
      const origin = req.get('Origin');
      if (!origin || !apiKey.allowedOrigins.includes(origin)) {
        return false;
      }
    }

    // Check rate limit
    return this.checkRateLimit(apiKey);
  }

  /**
   * Check rate limit for API key
   */
  private checkRateLimit(apiKey: ApiKey): boolean {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const usage = this.usageCache.get(apiKey.id) || [];
    const recentUsage = usage.filter(u => u.timestamp.getTime() > oneHourAgo);

    return recentUsage.length < apiKey.rateLimitPerHour;
  }

  /**
   * Update API key usage
   */
  private async updateKeyUsage(apiKeyId: string, req: Request): Promise<void> {
    const usage: ApiKeyUsage = {
      apiKeyId,
      userId: '', // We'll get this from the key
      endpoint: req.path,
      method: req.method,
      statusCode: 200, // This will be updated after response
      responseTime: 0, // This will be updated after response
      timestamp: new Date(),
      ipAddress: req.ip || '',
      userAgent: req.get('User-Agent'),
    };

    // Update usage cache
    const existingUsage = this.usageCache.get(apiKeyId) || [];
    existingUsage.push(usage);
    this.usageCache.set(apiKeyId, existingUsage);

    // Update database
    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: {
        lastUsedAt: new Date(),
        usageCount: {
          increment: 1,
        },
      },
    });
  }

  /**
   * Get API keys for a user
   */
  async getUserApiKeys(userId: string): Promise<PublicApiKey[]> {
    return this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        name: true,
        description: true,
        permissions: true,
        expiresAt: true,
        rateLimitPerHour: true,
        allowedIPs: true,
        allowedOrigins: true,
        isActive: true,
        lastUsedAt: true,
        usageCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Get API key by ID
   */
  async getApiKeyById(userId: string, apiKeyId: string): Promise<PublicApiKey | null> {
    return this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, userId },
      select: {
        id: true,
        userId: true,
        name: true,
        description: true,
        permissions: true,
        expiresAt: true,
        rateLimitPerHour: true,
        allowedIPs: true,
        allowedOrigins: true,
        isActive: true,
        lastUsedAt: true,
        usageCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Update API key
   */
  async updateApiKey(
    userId: string,
    apiKeyId: string,
    data: Partial<CreateApiKeyData>,
    req: Request
  ): Promise<ApiKey> {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, userId },
    });

    if (!apiKey) {
      throw new ApiError(httpStatus.NOT_FOUND, 'API key not found');
    }

    const updatedApiKey = await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: {
        name: data.name,
        description: data.description,
        permissions: data.permissions,
        expiresAt: data.expiresAt,
        rateLimitPerHour: data.rateLimitPerHour,
        allowedIPs: data.allowedIPs,
        allowedOrigins: data.allowedOrigins,
      },
    });

    // Log the update
    await this.auditLogService.createLog({
      userId,
      action: 'API_KEY_UPDATED',
      resource: 'ApiKey',
      resourceId: apiKeyId,
      newValues: {
        name: data.name,
        permissions: data.permissions,
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    return updatedApiKey;
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(userId: string, apiKeyId: string, req: Request): Promise<void> {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, userId },
    });

    if (!apiKey) {
      throw new ApiError(httpStatus.NOT_FOUND, 'API key not found');
    }

    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { isActive: false },
    });

    // Remove from cache
    this.keyCache.forEach((key, cacheKey) => {
      if (key.id === apiKeyId) {
        this.keyCache.delete(cacheKey);
      }
    });

    // Log the revocation
    await this.auditLogService.createLog({
      userId,
      action: 'API_KEY_REVOKED',
      resource: 'ApiKey',
      resourceId: apiKeyId,
      oldValues: {
        name: apiKey.name,
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });
  }

  /**
   * Get API key usage statistics
   */
  async getApiKeyUsageStats(userId: string, apiKeyId: string): Promise<any> {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, userId },
    });

    if (!apiKey) {
      throw new ApiError(httpStatus.NOT_FOUND, 'API key not found');
    }

    const usage = this.usageCache.get(apiKeyId) || [];
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const dailyUsage = usage.filter(u => u.timestamp.getTime() > oneDayAgo);
    const weeklyUsage = usage.filter(u => u.timestamp.getTime() > oneWeekAgo);

    return {
      totalUsage: apiKey.usageCount,
      lastUsedAt: apiKey.lastUsedAt,
      dailyUsage: dailyUsage.length,
      weeklyUsage: weeklyUsage.length,
      rateLimitPerHour: apiKey.rateLimitPerHour,
      currentHourUsage: usage.filter(u => u.timestamp.getTime() > Date.now() - 60 * 60 * 1000)
        .length,
    };
  }

  /**
   * Regenerate API key
   */
  async regenerateApiKey(userId: string, apiKeyId: string, req: Request): Promise<string> {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, userId },
    });

    if (!apiKey) {
      throw new ApiError(httpStatus.NOT_FOUND, 'API key not found');
    }

    const newApiKey = this.generateApiKey();
    const hashedKey = this.hashApiKey(newApiKey);

    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { hashedKey },
    });

    // Remove old key from cache
    this.keyCache.forEach((key, cacheKey) => {
      if (key.id === apiKeyId) {
        this.keyCache.delete(cacheKey);
      }
    });

    // Log the regeneration
    await this.auditLogService.createLog({
      userId,
      action: 'API_KEY_REGENERATED',
      resource: 'ApiKey',
      resourceId: apiKeyId,
      oldValues: {
        name: apiKey.name,
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    return newApiKey;
  }

  /**
   * Clean up expired keys
   */
  async cleanupExpiredKeys(): Promise<number> {
    const expiredKeys = await this.prisma.apiKey.findMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
        isActive: true,
      },
    });

    for (const key of expiredKeys) {
      await this.prisma.apiKey.update({
        where: { id: key.id },
        data: { isActive: false },
      });

      // Remove from cache
      this.keyCache.forEach((cachedKey, cacheKey) => {
        if (cachedKey.id === key.id) {
          this.keyCache.delete(cacheKey);
        }
      });
    }

    return expiredKeys.length;
  }

  /**
   * Check if API key has permission
   */
  hasPermission(apiKey: ApiKey, permission: string): boolean {
    return apiKey.permissions.includes(permission) || apiKey.permissions.includes('*');
  }

  /**
   * Get all API keys (admin only)
   */
  async getAllApiKeys(): Promise<ApiKey[]> {
    return this.prisma.apiKey.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export default new ApiKeyService();
