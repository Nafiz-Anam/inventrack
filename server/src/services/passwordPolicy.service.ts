import httpStatus from 'http-status';
import prisma from '../client';
import ApiError from '../utils/ApiError';
import { PasswordPolicy } from '@prisma/client';

interface PasswordPolicyConfig {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventCommonPasswords: boolean;
  preventUserInfo: boolean;
  maxAge?: number;
  historyCount: number;
  breachCheckEnabled: boolean;
}

interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  score: number;
  strength: 'WEAK' | 'FAIR' | 'GOOD' | 'STRONG';
}

/**
 * Password Policy Service
 * Manages password policies and validation
 */
class PasswordPolicyService {
  /**
   * Get active password policy
   */
  async getActivePolicy(): Promise<PasswordPolicy | null> {
    return await prisma.passwordPolicy.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create password policy
   */
  async createPolicy(data: Partial<PasswordPolicyConfig>): Promise<PasswordPolicy> {
    const {
      minLength = 8,
      requireUppercase = true,
      requireLowercase = true,
      requireNumbers = true,
      requireSpecialChars = true,
      preventCommonPasswords = true,
      preventUserInfo = true,
      maxAge,
      historyCount = 5,
      breachCheckEnabled = true,
    } = data;

    return await prisma.passwordPolicy.create({
      data: {
        name: `Policy ${new Date().toISOString()}`,
        minLength,
        requireUppercase,
        requireLowercase,
        requireNumbers,
        requireSpecialChars,
        preventCommonPasswords,
        preventUserInfo,
        maxAge,
        historyCount,
        breachCheckEnabled,
      },
    });
  }

  /**
   * Update password policy
   */
  async updatePolicy(id: string, data: Partial<PasswordPolicyConfig>): Promise<PasswordPolicy> {
    const policy = await prisma.passwordPolicy.findUnique({
      where: { id },
    });

    if (!policy) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Password policy not found');
    }

    return await prisma.passwordPolicy.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete password policy
   */
  async deletePolicy(id: string): Promise<void> {
    const policy = await prisma.passwordPolicy.findUnique({
      where: { id },
    });

    if (!policy) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Password policy not found');
    }

    await prisma.passwordPolicy.delete({
      where: { id },
    });
  }

  /**
   * Get all password policies
   */
  async getAllPolicies(): Promise<PasswordPolicy[]> {
    return await prisma.passwordPolicy.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Validate password against policy
   */
  async validatePassword(
    password: string,
    userInfo?: { email?: string; name?: string }
  ): Promise<PasswordValidationResult> {
    const policy = await this.getActivePolicy();
    const errors: string[] = [];

    if (!policy) {
      // Default validation if no policy exists
      return this.validatePasswordDefaults(password, userInfo);
    }

    // Length validation
    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`);
    }

    // Uppercase validation
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // Lowercase validation
    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // Numbers validation
    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Special characters validation
    if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // User info validation
    if (policy.preventUserInfo && userInfo) {
      const email = userInfo.email?.toLowerCase() || '';
      const name = userInfo.name?.toLowerCase() || '';

      if (email && password.toLowerCase().includes(email.split('@')[0])) {
        errors.push('Password cannot contain your email username');
      }

      if (name && password.toLowerCase().includes(name)) {
        errors.push('Password cannot contain your name');
      }
    }

    // Common passwords validation
    if (policy.preventCommonPasswords) {
      const commonPasswords = [
        'password',
        '123456',
        '123456789',
        '12345678',
        '12345',
        '1234567',
        '1234567890',
        '1234',
        'qwerty',
        'abc123',
        'password123',
        'admin',
        'letmein',
        'welcome',
        'monkey',
        '1234567890',
        'password1',
      ];

      if (commonPasswords.includes(password.toLowerCase())) {
        errors.push('Password is too common and easily guessable');
      }
    }

    const isValid = errors.length === 0;
    const score = this.calculatePasswordScore(password);
    const strength = this.getPasswordStrength(score);

    return {
      isValid,
      errors,
      score,
      strength,
    };
  }

  /**
   * Default password validation (when no policy is set)
   */
  private validatePasswordDefaults(
    password: string,
    userInfo?: { email?: string; name?: string }
  ): PasswordValidationResult {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    const isValid = errors.length === 0;
    const score = this.calculatePasswordScore(password);
    const strength = this.getPasswordStrength(score);

    return {
      isValid,
      errors,
      score,
      strength,
    };
  }

  /**
   * Calculate password strength score (0-100)
   */
  private calculatePasswordScore(password: string): number {
    let score = 0;

    // Length contribution (0-30 points)
    score += Math.min(password.length * 2, 30);

    // Character variety contribution (0-40 points)
    if (/[a-z]/.test(password)) score += 10;
    if (/[A-Z]/.test(password)) score += 10;
    if (/\d/.test(password)) score += 10;
    if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) score += 10;

    // Pattern complexity (0-30 points)
    const uniqueChars = new Set(password).size;
    score += Math.min((uniqueChars / password.length) * 30, 30);

    return Math.min(score, 100);
  }

  /**
   * Get password strength label
   */
  private getPasswordStrength(score: number): 'WEAK' | 'FAIR' | 'GOOD' | 'STRONG' {
    if (score < 30) return 'WEAK';
    if (score < 50) return 'FAIR';
    if (score < 70) return 'GOOD';
    return 'STRONG';
  }

  /**
   * Check if password needs to be changed (age-based)
   */
  async shouldPasswordBeChanged(userId: string): Promise<boolean> {
    const policy = await this.getActivePolicy();

    if (!policy || !policy.maxAge) {
      return false;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        passwordChangedAt: true,
      },
    });

    if (!user || !user.passwordChangedAt) {
      return true; // Force change if no password change date
    }

    const daysSinceChange = Math.floor(
      (new Date().getTime() - user.passwordChangedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysSinceChange >= policy.maxAge;
  }

  /**
   * Get password expiry date for user
   */
  async getPasswordExpiryDate(userId: string): Promise<Date | null> {
    const policy = await this.getActivePolicy();

    if (!policy || !policy.maxAge) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        passwordChangedAt: true,
      },
    });

    if (!user || !user.passwordChangedAt) {
      return null;
    }

    const expiryDate = new Date(user.passwordChangedAt);
    expiryDate.setDate(expiryDate.getDate() + policy.maxAge);

    return expiryDate;
  }

  /**
   * Get password requirements for UI
   */
  async getPasswordRequirements(): Promise<{
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    preventCommonPasswords: boolean;
    preventUserInfo: boolean;
    maxAge?: number;
  }> {
    const policy = await this.getActivePolicy();

    if (!policy) {
      return {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        preventCommonPasswords: true,
        preventUserInfo: true,
      };
    }

    return {
      minLength: policy.minLength,
      requireUppercase: policy.requireUppercase,
      requireLowercase: policy.requireLowercase,
      requireNumbers: policy.requireNumbers,
      requireSpecialChars: policy.requireSpecialChars,
      preventCommonPasswords: policy.preventCommonPasswords,
      preventUserInfo: policy.preventUserInfo,
      maxAge: policy.maxAge || undefined,
    };
  }
}

export default PasswordPolicyService;
