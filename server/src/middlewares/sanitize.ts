import { Request, Response, NextFunction } from 'express';
import xss from 'xss-filters';

// Sanitize string inputs to prevent XSS attacks
const sanitizeString = (value: string): string => {
  return xss.inHTMLData(value.trim());
};

// Sanitize object recursively
const sanitizeObject = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
};

// Main sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters (create a copy)
  if (req.query) {
    (req as any).sanitizedQuery = sanitizeObject(req.query);
  }

  // Sanitize URL parameters
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

// Specific sanitization for different data types
export const sanitizeHtml = (html: string): string => {
  return xss.inHTMLData(html);
};

export const sanitizeStrict = (input: string): string => {
  return xss.inHTMLData(input);
};

// Validation helpers
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s\-()]+$/;
  return phoneRegex.test(phone);
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Rate limiting helper for sensitive operations
export const createRateLimitKey = (identifier: string, operation: string): string => {
  return `rate_limit:${identifier}:${operation}`;
};

// Input length validation
export const validateLength = (
  value: string,
  minLength?: number,
  maxLength?: number
): { valid: boolean; error?: string } => {
  if (minLength && value.length < minLength) {
    return {
      valid: false,
      error: `Minimum length is ${minLength} characters`,
    };
  }

  if (maxLength && value.length > maxLength) {
    return {
      valid: false,
      error: `Maximum length is ${maxLength} characters`,
    };
  }

  return { valid: true };
};

// Password strength validation
export const validatePasswordStrength = (
  password: string
): {
  valid: boolean;
  errors: string[];
} => {
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

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// File upload validation
export const validateFileUpload = (
  file: Express.Multer.File,
  allowedTypes: string[],
  maxSize: number
): { valid: boolean; error?: string } => {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (!allowedTypes.includes(file.mimetype)) {
    return {
      valid: false,
      error: `File type ${file.mimetype} is not allowed`,
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds maximum limit of ${maxSize} bytes`,
    };
  }

  return { valid: true };
};

// SQL injection prevention for raw queries
export const sanitizeSqlIdentifier = (identifier: string): string => {
  // Only allow alphanumeric characters, underscores, and dots
  return identifier.replace(/[^a-zA-Z0-9_.]/g, '');
};

export const sanitizeSqlValue = (value: any): any => {
  if (typeof value === 'string') {
    // Escape single quotes and other dangerous characters
    return value.replace(/['"\\]/g, '\\$&');
  }
  return value;
};
