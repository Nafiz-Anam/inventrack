import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import captchaService from '../services/captcha.service';
import logger from '../config/logger';

/**
 * CAPTCHA Middleware
 * Provides bot protection and verification challenges
 */
export const requireCaptcha = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if CAPTCHA is enabled
    const config = captchaService.getConfig();
    if (!config.enable) {
      return next();
    }

    // Get client IP for risk assessment
    const clientIP = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const userAgent = req.get('User-Agent') || '';

    // Analyze risk factors
    const riskFactors = {
      ipReputation: 'unknown', // Could be enhanced with IP security service
      userAgent,
      suspiciousPatterns: [], // Could be enhanced with pattern detection
    };

    // Check if CAPTCHA should be required
    const shouldRequireCaptcha = captchaService.shouldRequireCaptcha(riskFactors);

    if (!shouldRequireCaptcha) {
      return next();
    }

    // For GET requests, just return next (CAPTCHA will be validated on form submission)
    if (req.method === 'GET') {
      return next();
    }

    // Check for existing CAPTCHA token in request
    const captchaToken = req.body?.['g-recaptcha-response'] || req.body?.['h-captcha-response'];

    if (!captchaToken) {
      return res.status(httpStatus.BAD_REQUEST).json({
        error: 'CAPTCHA required',
        message: 'Please complete the CAPTCHA challenge',
        code: 'CAPTCHA_REQUIRED',
      });
    }

    // Verify CAPTCHA
    const verification = await captchaService.verifyCaptcha(captchaToken, clientIP);

    if (!verification.success) {
      logger.warn('CAPTCHA verification failed', {
        ip: clientIP,
        score: verification.score,
        error: verification.error,
      });

      return res.status(httpStatus.BAD_REQUEST).json({
        error: 'CAPTCHA verification failed',
        message: verification.error || 'Invalid CAPTCHA response',
        code: 'CAPTCHA_INVALID',
      });
    }

    // Log successful verification
    logger.info('CAPTCHA verified successfully', {
      ip: clientIP,
      score: verification.score,
    });

    next();
  } catch (error) {
    logger.error('CAPTCHA middleware error', { error });
    next();
  }
};

/**
 * Generate CAPTCHA endpoint
 */
export const generateCaptcha = async (req: Request, res: Response) => {
  try {
    const result = await captchaService.generateCaptcha();

    if (!result.success) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'CAPTCHA generation failed',
        message: result.error || 'Failed to generate CAPTCHA challenge',
      });
    }

    res.json({
      success: true,
      data: {
        siteKey: result.siteKey,
        challengeId: result.challengeId,
        html: result.html,
      },
    });
  } catch (error) {
    logger.error('Generate CAPTCHA error', { error });
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      error: 'Internal server error',
      message: 'Failed to generate CAPTCHA challenge',
    });
  }
};
