import { Request } from 'express';
import logger from '../config/logger';
import prisma from '../client';
import {
  IPSecurityRuleType,
  IPSecurityConfig,
  IPAnalysis,
  CreateIPRule,
  UpdateIPRule,
  IPStats,
  IPRuleFilters,
  IPRuleListResponse,
} from '../types/ipSecurity.types';

class IPSecurityManagementService {
  private static instance: IPSecurityManagementService;
  private ipCache: Map<string, IPAnalysis> = new Map();
  private config: IPSecurityConfig = {
    enableGeolocation: process.env.ENABLE_GEOLOCATION === 'true',
    allowedCountries: process.env.ALLOWED_COUNTRIES?.split(',') || [],
    suspiciousCountries: process.env.SUSPICIOUS_COUNTRIES?.split(',') || [],
    maxRequestsPerIP: 100,
    timeWindowMs: 15 * 60 * 1000, // 15 minutes
  };

  static getInstance(): IPSecurityManagementService {
    if (!IPSecurityManagementService.instance) {
      IPSecurityManagementService.instance = new IPSecurityManagementService();
    }
    return IPSecurityManagementService.instance;
  }

  private constructor() {
    // Load existing rules from database on startup
    this.loadIPRulesFromDatabase();
  }

  /**
   * Load IP rules from database into cache
   */
  private async loadIPRulesFromDatabase(): Promise<void> {
    try {
      const rules = await prisma.iPSecurityRule.findMany({
        where: { isActive: true },
      });

      logger.info(`Loaded ${rules.length} IP security rules from database`);
    } catch (error) {
      logger.error('Failed to load IP rules from database', { error });
    }
  }

  /**
   * Create new IP security rule
   */
  async createIPRule(data: CreateIPRule): Promise<any> {
    try {
      const rule = await prisma.iPSecurityRule.create({
        data: {
          ipAddress: data.ipAddress,
          cidrRange: data.cidrRange,
          ruleType: data.ruleType,
          reason: data.reason,
          createdBy: data.createdBy,
        },
      });

      // Clear cache to force reload
      this.ipCache.clear();

      logger.info('IP security rule created', {
        ruleId: rule.id,
        ipAddress: data.ipAddress,
        ruleType: data.ruleType,
        createdBy: data.createdBy,
      });

      return rule;
    } catch (error) {
      logger.error('Failed to create IP rule', { error, data });
      throw error;
    }
  }

  /**
   * Get all IP security rules
   */
  async getIPRules(filters?: IPRuleFilters): Promise<IPRuleListResponse> {
    try {
      const where: any = {};

      if (filters?.ruleType) {
        where.ruleType = filters.ruleType;
      }

      if (filters?.isActive !== undefined) {
        where.isActive = filters.isActive;
      }

      const page = filters?.page || 1;
      const limit = filters?.limit || 50;
      const skip = (page - 1) * limit;

      const [rules, total] = await Promise.all([
        prisma.iPSecurityRule.findMany({
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
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.iPSecurityRule.count({ where }),
      ]);

      return {
        rules,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Failed to get IP rules', { error });
      throw error;
    }
  }

  /**
   * Update IP security rule
   */
  async updateIPRule(id: string, data: UpdateIPRule): Promise<any> {
    try {
      const rule = await prisma.iPSecurityRule.update({
        where: { id },
        data: {
          ...(data.ipAddress && { ipAddress: data.ipAddress }),
          ...(data.cidrRange !== undefined && { cidrRange: data.cidrRange }),
          ...(data.ruleType && { ruleType: data.ruleType }),
          ...(data.reason !== undefined && { reason: data.reason }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.updatedBy && { updatedBy: data.updatedBy }),
        },
      });

      // Clear cache to force reload
      this.ipCache.clear();

      logger.info('IP security rule updated', {
        ruleId: id,
        updatedBy: data.updatedBy,
      });

      return rule;
    } catch (error) {
      logger.error('Failed to update IP rule', { error, id, data });
      throw error;
    }
  }

  /**
   * Delete IP security rule
   */
  async deleteIPRule(id: string, deletedBy?: string): Promise<void> {
    try {
      await prisma.iPSecurityRule.delete({
        where: { id },
      });

      // Clear cache to force reload
      this.ipCache.clear();

      logger.info('IP security rule deleted', {
        ruleId: id,
        deletedBy,
      });
    } catch (error) {
      logger.error('Failed to delete IP rule', { error, id });
      throw error;
    }
  }

  /**
   * Analyze IP address with database rules
   */
  async analyzeIP(ip: string, req?: Request): Promise<IPAnalysis> {
    // Check cache first
    if (this.ipCache.has(ip)) {
      const cached = this.ipCache.get(ip)!;
      cached.lastSeen = new Date();
      return cached;
    }

    const analysis: IPAnalysis = {
      ip,
      isWhitelisted: false,
      isBlacklisted: false,
      isSuspicious: false,
      isBlocked: false,
      requestCount: 0,
      firstSeen: new Date(),
      lastSeen: new Date(),
      reputation: 'unknown',
      riskScore: 0,
    };

    try {
      // Check database rules
      const rules = await prisma.iPSecurityRule.findMany({
        where: { isActive: true },
      });

      for (const rule of rules) {
        if (this.isIPInRule(ip, rule)) {
          if (rule.ruleType === 'WHITELIST') {
            analysis.isWhitelisted = true;
            analysis.reputation = 'high';
            analysis.riskScore = 0;
          } else if (rule.ruleType === 'BLACKLIST') {
            analysis.isBlacklisted = true;
            analysis.isSuspicious = true;
            analysis.reputation = 'low';
            analysis.riskScore = 10;
          } else if (rule.ruleType === 'SUSPICIOUS') {
            analysis.isSuspicious = true;
            analysis.reputation = 'medium';
            analysis.riskScore = 5;
          }

          logger.warn('IP matched security rule', {
            ip,
            ruleType: rule.ruleType,
            reason: rule.reason,
          });
          break;
        }
      }

      // Get geolocation info if enabled
      if (this.config.enableGeolocation) {
        try {
          const geoData = await this.getGeolocation(ip);
          analysis.country = geoData.country;

          // Check country restrictions
          if (this.config.suspiciousCountries.includes(geoData.country)) {
            analysis.isSuspicious = true;
            analysis.reputation = 'low';
            analysis.riskScore = Math.max(analysis.riskScore, 7);
          }

          if (
            this.config.allowedCountries.length > 0 &&
            analysis.country &&
            !this.config.allowedCountries.includes(analysis.country)
          ) {
            analysis.isSuspicious = true;
            analysis.reputation = 'medium';
            analysis.riskScore = Math.max(analysis.riskScore, 4);
          }
        } catch (error) {
          logger.debug('Geolocation lookup failed', { ip, error });
        }
      }

      // Update analytics
      await this.updateIPAnalytics(analysis);

      // Cache result
      this.ipCache.set(ip, analysis);

      return analysis;
    } catch (error) {
      logger.error('IP analysis failed', { error, ip });
      return analysis;
    }
  }

  /**
   * Check if IP matches a security rule
   */
  private isIPInRule(ip: string, rule: any): boolean {
    // Check exact IP match
    if (ip === rule.ipAddress) {
      return true;
    }

    // Check CIDR range match
    if (rule.cidrRange) {
      return this.isIPInCIDR(ip, rule.cidrRange);
    }

    return false;
  }

  /**
   * Check if IP is in CIDR range
   */
  private isIPInCIDR(ip: string, cidr: string): boolean {
    if (!cidr.includes('/')) return ip === cidr;

    const [network, prefixLength] = cidr.split('/');
    const prefix = parseInt(prefixLength);

    if (prefix === 32) return ip === network;

    // Basic IPv4 CIDR check (simplified)
    const ipParts = ip.split('.').map(Number);
    const networkParts = network.split('.').map(Number);

    if (prefix >= 24) {
      return (
        ipParts[0] === networkParts[0] &&
        ipParts[1] === networkParts[1] &&
        ipParts[2] === networkParts[2]
      );
    }

    return false;
  }

  /**
   * Get geolocation data for IP
   */
  private async getGeolocation(ip: string): Promise<{ country: string; city?: string }> {
    try {
      const response = await fetch(`http://ip-api.com/json/${ip}`);
      const data = (await response.json()) as any;
      return {
        country: data.countryCode || 'Unknown',
        city: data.city,
      };
    } catch (error) {
      logger.debug('Geolocation service error', { ip, error });
      return { country: 'Unknown' };
    }
  }

  /**
   * Update IP analytics
   */
  private async updateIPAnalytics(analysis: IPAnalysis): Promise<void> {
    try {
      const existing = await prisma.iPSecurityAnalytics.findFirst({
        where: { ipAddress: analysis.ip },
      });

      if (existing) {
        await prisma.iPSecurityAnalytics.update({
          where: { id: existing.id },
          data: {
            requestCount: { increment: 1 },
            lastSeen: new Date(),
            isBlocked: analysis.isBlocked || analysis.isBlacklisted,
            blockReason: analysis.isBlacklisted ? 'Blacklisted' : undefined,
            riskScore: analysis.riskScore,
            ...(analysis.country && { countryCode: analysis.country }),
          },
        });
      } else {
        await prisma.iPSecurityAnalytics.create({
          data: {
            ipAddress: analysis.ip,
            countryCode: analysis.country,
            reputation: analysis.reputation,
            requestCount: 1,
            firstSeen: analysis.firstSeen,
            lastSeen: analysis.lastSeen,
            isBlocked: analysis.isBlocked || analysis.isBlacklisted,
            blockReason: analysis.isBlacklisted ? 'Blacklisted' : undefined,
            riskScore: analysis.riskScore,
          },
        });
      }
    } catch (error) {
      logger.error('Failed to update IP analytics', { error, ip: analysis.ip });
    }
  }

  /**
   * Check if IP should be blocked
   */
  async shouldBlockIP(
    ip: string,
    req?: Request
  ): Promise<{
    shouldBlock: boolean;
    reason?: string;
    analysis: IPAnalysis;
  }> {
    const analysis = await this.analyzeIP(ip, req);

    if (analysis.isBlacklisted) {
      return {
        shouldBlock: true,
        reason: 'IP is blacklisted',
        analysis,
      };
    }

    if (analysis.isSuspicious && !analysis.isWhitelisted) {
      return {
        shouldBlock: true,
        reason: 'Suspicious activity detected',
        analysis,
      };
    }

    return { shouldBlock: false, analysis };
  }

  /**
   * Get IP statistics
   */
  async getIPStats(): Promise<IPStats> {
    try {
      const [rules, analytics] = await Promise.all([
        prisma.iPSecurityRule.groupBy({
          by: ['ruleType'],
          _count: { ruleType: true },
        }),
        prisma.iPSecurityAnalytics.groupBy({
          by: ['countryCode'],
          _count: { countryCode: true },
          orderBy: { _count: { countryCode: 'desc' } },
          take: 10,
        }),
      ]);

      const stats: IPStats = {
        totalIPs: 0,
        whitelistedIPs: 0,
        blacklistedIPs: 0,
        suspiciousIPs: 0,
        topCountries: [],
        recentBlocks: [],
      };

      // Count rules by type
      for (const group of rules) {
        switch (group.ruleType) {
          case 'WHITELIST':
            stats.whitelistedIPs += group._count.ruleType;
            break;
          case 'BLACKLIST':
            stats.blacklistedIPs += group._count.ruleType;
            break;
          case 'SUSPICIOUS':
            stats.suspiciousIPs += group._count.ruleType;
            break;
        }
        stats.totalIPs += group._count.ruleType;
      }

      // Format country data
      stats.topCountries = analytics.map((group: any) => ({
        country: group.countryCode || 'Unknown',
        count: group._count.countryCode,
      }));

      // Get recent blocks
      const recentBlocks = await prisma.iPSecurityAnalytics.findMany({
        where: { isBlocked: true },
        orderBy: { lastSeen: 'desc' },
        take: 10,
        select: {
          ipAddress: true,
          blockReason: true,
          lastSeen: true,
        },
      });

      stats.recentBlocks = recentBlocks.map((block: any) => ({
        ipAddress: block.ipAddress,
        blockReason: block.blockReason,
        timestamp: block.lastSeen,
      }));

      return stats;
    } catch (error) {
      logger.error('Failed to get IP stats', { error });
      throw error;
    }
  }

  /**
   * Clear IP cache
   */
  clearCache(): void {
    this.ipCache.clear();
    logger.info('IP security cache cleared');
  }
}

export default IPSecurityManagementService.getInstance();
