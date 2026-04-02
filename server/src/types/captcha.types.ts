// CAPTCHA Module Types

export enum CaptchaProvider {
  RECAPTCHA = 'recaptcha',
  HCAPTCHA = 'hcaptcha',
  CUSTOM = 'custom',
}

export interface CaptchaConfig {
  enable: boolean;
  provider: CaptchaProvider;
  siteKey?: string;
  secretKey?: string;
  threshold: number;
}

export interface CaptchaVerification {
  success: boolean;
  score?: number;
  challengeId?: string;
  error?: string;
}

export interface CaptchaChallenge {
  success: boolean;
  siteKey?: string;
  challengeId?: string;
  html?: string;
  error?: string;
}

export interface CaptchaRiskFactors {
  ipReputation?: string;
  requestFrequency?: number;
  userAgent?: string;
  suspiciousPatterns?: string[];
}
