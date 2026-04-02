import { Request } from 'express';
import logger from '../config/logger';
import prisma from '../client';

interface IPSecurityConfig {
  whitelistedIPs: string[];
  blacklistedIPs: string[];
  enableGeolocation: boolean;
  allowedCountries: string[];
  suspiciousCountries: string[];
  maxRequestsPerIP: number;
  timeWindowMs: number;
}

interface IPAnalysis {
  ip: string;
  country?: string;
  isWhitelisted: boolean;
  isBlacklisted: boolean;
  isSuspicious: boolean;
  requestCount: number;
  firstSeen: Date;
  lastSeen: Date;
  reputation: 'high' | 'medium' | 'low' | 'unknown';
}

class IPSecurityService {
  private static instance: IPSecurityService;
  private ipCache: Map<string, IPAnalysis> = new Map();
  private requestCounts: Map<string, { count: number; windowStart: number }> = new Map();

  private config: IPSecurityConfig = {
    whitelistedIPs: process.env.WHITELISTED_IPS?.split(',') || [],
    blacklistedIPs: process.env.BLACKLISTED_IPS?.split(',') || [],
    enableGeolocation: process.env.ENABLE_GEOLOCATION === 'true',
    allowedCountries: process.env.ALLOWED_COUNTRIES?.split(',') || [],
    suspiciousCountries: process.env.SUSPICIOUS_COUNTRIES?.split(',') || [],
    maxRequestsPerIP: 100,
    timeWindowMs: 15 * 60 * 1000, // 15 minutes
  };

  static getInstance(): IPSecurityService {
    if (!IPSecurityService.instance) {
      IPSecurityService.instance = new IPSecurityService();
    }
    return IPSecurityService.instance;
  }

  private constructor() {
    // Clean up old request counts periodically
    setInterval(() => {
      this.cleanupRequestCounts();
    }, this.config.timeWindowMs);
  }

  /**
   * Analyze IP address for security threats
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
      isWhitelisted: this.isWhitelisted(ip),
      isBlacklisted: this.isBlacklisted(ip),
      isSuspicious: false,
      requestCount: 0,
      firstSeen: new Date(),
      lastSeen: new Date(),
      reputation: 'unknown',
    };

    // Check if blacklisted first
    if (analysis.isBlacklisted) {
      analysis.isSuspicious = true;
      analysis.reputation = 'low';
      logger.warn('Blacklisted IP detected', { ip, userAgent: req?.get('User-Agent') });
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
          logger.warn('Suspicious country detected', { ip, country: geoData.country });
        }

        if (
          this.config.allowedCountries.length > 0 &&
          analysis.country &&
          !this.config.allowedCountries.includes(analysis.country)
        ) {
          analysis.isSuspicious = true;
          analysis.reputation = 'medium';
          logger.warn('Disallowed country detected', { ip, country: analysis.country });
        }
      } catch (error) {
        logger.debug('Geolocation lookup failed', { ip, error });
      }
    }

    // Check request patterns
    const requestPattern = this.requestCounts.get(ip);
    if (requestPattern && requestPattern.count > this.config.maxRequestsPerIP) {
      analysis.isSuspicious = true;
      analysis.reputation = 'medium';
      analysis.requestCount = requestPattern.count;
      logger.warn('High request rate from IP', { ip, count: requestPattern.count });
    }

    // Cache the result
    this.ipCache.set(ip, analysis);

    return analysis;
  }

  /**
   * Check if IP is whitelisted
   */
  private isWhitelisted(ip: string): boolean {
    return this.config.whitelistedIPs.some(whitelistedIP => {
      // Support CIDR notation
      if (whitelistedIP.includes('/')) {
        return this.isIPInCIDR(ip, whitelistedIP);
      }
      return ip === whitelistedIP;
    });
  }

  /**
   * Check if IP is blacklisted
   */
  private isBlacklisted(ip: string): boolean {
    return this.config.blacklistedIPs.some(blacklistedIP => {
      if (blacklistedIP.includes('/')) {
        return this.isIPInCIDR(ip, blacklistedIP);
      }
      return ip === blacklistedIP;
    });
  }

  /**
   * Check if IP is in CIDR range
   */
  private isIPInCIDR(ip: string, cidr: string): boolean {
    // Simple implementation for common cases
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
    // Simple implementation - in production, use a real geolocation service
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
   * Track request from IP
   */
  trackRequest(ip: string): void {
    const now = Date.now();
    const current = this.requestCounts.get(ip);

    if (!current || now - current.windowStart > this.config.timeWindowMs) {
      this.requestCounts.set(ip, { count: 1, windowStart: now });
    } else {
      this.requestCounts.set(ip, { count: current.count + 1, windowStart: current.windowStart });
    }
  }

  /**
   * Clean up old request counts
   */
  private cleanupRequestCounts(): void {
    const now = Date.now();
    const cutoff = now - this.config.timeWindowMs;

    for (const [ip, data] of this.requestCounts.entries()) {
      if (data.windowStart < cutoff) {
        this.requestCounts.delete(ip);
      }
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

    if (
      this.config.enableGeolocation &&
      this.config.allowedCountries.length > 0 &&
      analysis.country &&
      !this.config.allowedCountries.includes(analysis.country)
    ) {
      return {
        shouldBlock: true,
        reason: `Country ${analysis.country} not allowed`,
        analysis,
      };
    }

    return { shouldBlock: false, analysis };
  }

  /**
   * Get IP statistics
   */
  getIPStats(): {
    totalIPs: number;
    whitelistedIPs: number;
    blacklistedIPs: number;
    suspiciousIPs: number;
    topCountries: Array<{ country: string; count: number }>;
  } {
    const stats = {
      totalIPs: this.ipCache.size,
      whitelistedIPs: 0,
      blacklistedIPs: 0,
      suspiciousIPs: 0,
      topCountries: [] as Array<{ country: string; count: number }>,
    };

    const countryCounts = new Map<string, number>();

    for (const analysis of this.ipCache.values()) {
      if (analysis.isWhitelisted) stats.whitelistedIPs++;
      if (analysis.isBlacklisted) stats.blacklistedIPs++;
      if (analysis.isSuspicious) stats.suspiciousIPs++;

      if (analysis.country) {
        countryCounts.set(analysis.country, (countryCounts.get(analysis.country) || 0) + 1);
      }
    }

    stats.topCountries = Array.from(countryCounts.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return stats;
  }

  /**
   * Clear IP cache
   */
  clearCache(): void {
    this.ipCache.clear();
    this.requestCounts.clear();
    logger.info('IP security cache cleared');
  }
}

export default IPSecurityService.getInstance();
