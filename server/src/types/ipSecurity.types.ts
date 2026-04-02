// IP Security Module Types

export enum IPSecurityRuleType {
  WHITELIST = 'WHITELIST',
  BLACKLIST = 'BLACKLIST',
  SUSPICIOUS = 'SUSPICIOUS',
}

export interface IPSecurityConfig {
  enableGeolocation: boolean;
  allowedCountries: string[];
  suspiciousCountries: string[];
  maxRequestsPerIP: number;
  timeWindowMs: number;
}

export interface IPAnalysis {
  ip: string;
  country?: string;
  isWhitelisted: boolean;
  isBlacklisted: boolean;
  isSuspicious: boolean;
  isBlocked: boolean;
  requestCount: number;
  firstSeen: Date;
  lastSeen: Date;
  reputation: 'high' | 'medium' | 'low' | 'unknown';
  riskScore: number;
}

export interface CreateIPRule {
  ipAddress: string;
  cidrRange?: string;
  ruleType: IPSecurityRuleType;
  reason?: string;
  createdBy?: string;
}

export interface UpdateIPRule {
  ipAddress?: string;
  cidrRange?: string;
  ruleType?: IPSecurityRuleType;
  reason?: string;
  isActive?: boolean;
  updatedBy?: string;
}

export interface IPStats {
  totalIPs: number;
  whitelistedIPs: number;
  blacklistedIPs: number;
  suspiciousIPs: number;
  topCountries: Array<{ country: string; count: number }>;
  recentBlocks: Array<{ ipAddress: string; blockReason: string; timestamp: Date }>;
}

export interface IPRuleFilters {
  ruleType?: IPSecurityRuleType;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface IPRuleListResponse {
  rules: any[];
  total: number;
  page: number;
  totalPages: number;
}
