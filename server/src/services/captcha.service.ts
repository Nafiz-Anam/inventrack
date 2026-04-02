import logger from '../config/logger';

interface CaptchaConfig {
  enable: boolean;
  provider: 'recaptcha' | 'hcaptcha' | 'custom';
  siteKey?: string;
  secretKey?: string;
  threshold: number;
}

interface CaptchaVerification {
  success: boolean;
  score?: number;
  challengeId?: string;
  error?: string;
}

class CaptchaService {
  private static instance: CaptchaService;
  private config: CaptchaConfig = {
    enable: process.env.CAPTCHA_ENABLE === 'true',
    provider: (process.env.CAPTCHA_PROVIDER as 'recaptcha' | 'hcaptcha' | 'custom') || 'recaptcha',
    siteKey: process.env.RECAPTCHA_SITE_KEY || process.env.HCAPTCHA_SITE_KEY,
    secretKey: process.env.RECAPTCHA_SECRET_KEY || process.env.HCAPTCHA_SECRET_KEY,
    threshold: parseFloat(process.env.CAPTCHA_THRESHOLD || '0.5'),
  };

  static getInstance(): CaptchaService {
    if (!CaptchaService.instance) {
      CaptchaService.instance = new CaptchaService();
    }
    return CaptchaService.instance;
  }

  private constructor() {
    // Initialize CAPTCHA provider
    if (this.config.enable) {
      logger.info('CAPTCHA protection enabled', {
        provider: this.config.provider,
        threshold: this.config.threshold,
      });
    } else {
      logger.info('CAPTCHA protection disabled');
    }
  }

  /**
   * Generate CAPTCHA challenge
   */
  async generateCaptcha(): Promise<{
    success: boolean;
    siteKey?: string;
    challengeId?: string;
    html?: string;
    error?: string;
  }> {
    if (!this.config.enable) {
      return {
        success: false,
        error: 'CAPTCHA is disabled',
      };
    }

    try {
      switch (this.config.provider) {
        case 'recaptcha':
          return this.generateRecaptcha();
        case 'hcaptcha':
          return this.generateHcaptcha();
        default:
          return {
            success: false,
            error: 'CAPTCHA provider not configured',
          };
      }
    } catch (error) {
      logger.error('CAPTCHA generation failed', { error });
      return {
        success: false,
        error: 'CAPTCHA service unavailable',
      };
    }
  }

  /**
   * Verify CAPTCHA response
   */
  async verifyCaptcha(token: string, remoteIp?: string): Promise<CaptchaVerification> {
    if (!this.config.enable) {
      return {
        success: true, // Allow if CAPTCHA is disabled
        score: 1.0,
      };
    }

    try {
      switch (this.config.provider) {
        case 'recaptcha':
          return this.verifyRecaptcha(token);
        case 'hcaptcha':
          return this.verifyHcaptcha(token);
        default:
          return {
            success: false,
            error: 'CAPTCHA provider not configured',
          };
      }
    } catch (error) {
      logger.error('CAPTCHA verification failed', { error, token });
      return {
        success: false,
        error: 'CAPTCHA verification failed',
      };
    }
  }

  /**
   * Generate reCAPTCHA challenge
   */
  private async generateRecaptcha(): Promise<{
    success: boolean;
    siteKey?: string;
    challengeId?: string;
    html?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(
        `https://www.google.com/recaptcha/api/siteverify?secret=${this.config.secretKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const data = (await response.json()) as any;

      if (data.success) {
        return {
          success: true,
          siteKey: this.config.siteKey,
          challengeId: Math.random().toString(36).substring(2, 15),
          html: `
            <script src="https://www.google.com/recaptcha/api.js" async defer></script>
            <div class="g-recaptcha" data-sitekey="${this.config.siteKey}" data-callback="recaptchaCallback"></div>
          `,
        };
      } else {
        return {
          success: false,
          error: 'reCAPTCHA configuration error',
        };
      }
    } catch (error) {
      logger.error('reCAPTCHA generation failed', { error });
      return {
        success: false,
        error: 'reCAPTCHA service unavailable',
      };
    }
  }

  /**
   * Verify reCAPTCHA response
   */
  private async verifyRecaptcha(token: string): Promise<CaptchaVerification> {
    try {
      const response = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          secret: this.config.secretKey || '',
          response: token,
          remoteip: '', // Google will detect this
        }),
      });

      const data = (await response.json()) as any;

      return {
        success: data.success,
        score: data.score,
        challengeId: data.challenge_ts,
      };
    } catch (error) {
      logger.error('reCAPTCHA verification failed', { error });
      return {
        success: false,
        error: 'CAPTCHA verification failed',
      };
    }
  }

  /**
   * Generate hCaptcha challenge
   */
  private async generateHcaptcha(): Promise<{
    success: boolean;
    siteKey?: string;
    challengeId?: string;
    html?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(`https://api.hcaptcha.com/siteverify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sitekey: this.config.siteKey,
        }),
      });

      const data = (await response.json()) as any;

      if (data.success) {
        return {
          success: true,
          siteKey: this.config.siteKey,
          challengeId: Math.random().toString(36).substring(2, 15),
          html: `
            <script src="https://js.hcaptcha.com/1/api.js" async defer></script>
            <div class="h-captcha" data-sitekey="${this.config.siteKey}" data-callback="hcaptchaCallback"></div>
          `,
        };
      } else {
        return {
          success: false,
          error: 'hCaptcha configuration error',
        };
      }
    } catch (error) {
      logger.error('hCaptcha generation failed', { error });
      return {
        success: false,
        error: 'hCaptcha service unavailable',
      };
    }
  }

  /**
   * Verify hCaptcha response
   */
  private async verifyHcaptcha(token: string): Promise<CaptchaVerification> {
    try {
      const response = await fetch(`https://api.hcaptcha.com/siteverify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret: this.config.secretKey || '',
          response: token,
          sitekey: this.config.siteKey,
        }),
      });

      const data = (await response.json()) as any;

      return {
        success: data.success,
        score: data.score,
        challengeId: data.challenge_id,
      };
    } catch (error) {
      logger.error('hCaptcha verification failed', { error });
      return {
        success: false,
        error: 'CAPTCHA verification failed',
      };
    }
  }

  /**
   * Check if CAPTCHA should be required based on risk factors
   */
  shouldRequireCaptcha(riskFactors: {
    ipReputation?: string;
    requestFrequency?: number;
    userAgent?: string;
    suspiciousPatterns?: string[];
  }): boolean {
    if (!this.config.enable) {
      return false;
    }

    let riskScore = 0;

    // IP reputation scoring
    if (riskFactors.ipReputation === 'low') riskScore += 3;
    if (riskFactors.ipReputation === 'medium') riskScore += 2;

    // Request frequency scoring
    if (riskFactors.requestFrequency && riskFactors.requestFrequency > 10) riskScore += 2;

    // User agent scoring
    if (riskFactors.userAgent) {
      const suspiciousAgents = [/bot/i, /crawler/i, /spider/i, /scraper/i];
      if (suspiciousAgents.some(agent => riskFactors.userAgent.match(agent))) {
        riskScore += 3;
      }
    }

    // Suspicious patterns
    if (riskFactors.suspiciousPatterns && riskFactors.suspiciousPatterns.length > 0) {
      riskScore += 2;
    }

    return riskScore >= this.config.threshold;
  }

  /**
   * Get CAPTCHA configuration
   */
  getConfig(): CaptchaConfig {
    return { ...this.config };
  }

  /**
   * Update CAPTCHA configuration
   */
  updateConfig(newConfig: Partial<CaptchaConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('CAPTCHA configuration updated', { config: this.config });
  }
}

export default CaptchaService.getInstance();
