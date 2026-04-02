import { Response } from 'express';
import httpStatus from 'http-status';
import { v4 as uuidv4 } from 'uuid';

export interface ApiResponseMeta {
  timestamp: string;
  requestId: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalPages: number;
  totalResults: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  stack?: string; // Only in development
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: ApiError;
  meta: ApiResponseMeta;
}

export enum ErrorCode {
  // Validation Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Authentication Errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',

  // Authorization Errors
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Not Found Errors
  NOT_FOUND = 'NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',

  // Conflict Errors
  CONFLICT = 'CONFLICT',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  // Security Errors
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_INACTIVE = 'ACCOUNT_INACTIVE',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',

  // Server Errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',

  // Business Logic Errors
  INVALID_OPERATION = 'INVALID_OPERATION',
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
}

export class ApiResponseBuilder {
  private static createMeta(requestId?: string, pagination?: PaginationMeta): ApiResponseMeta {
    return {
      timestamp: new Date().toISOString(),
      requestId: requestId || uuidv4(),
      pagination,
    };
  }

  static success<T>(
    data: T,
    message?: string,
    requestId?: string,
    pagination?: PaginationMeta
  ): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
      meta: this.createMeta(requestId, pagination),
    };
  }

  static error(
    code: ErrorCode,
    message: string,
    details?: any,
    requestId?: string,
    stack?: string
  ): ApiResponse {
    const error: ApiError = {
      code,
      message,
      details,
    };

    // Include stack trace only in development
    if (process.env.NODE_ENV === 'development' && stack) {
      error.stack = stack;
    }

    return {
      success: false,
      error,
      meta: this.createMeta(requestId),
    };
  }

  static created<T>(
    data: T,
    message = 'Resource created successfully',
    requestId?: string
  ): ApiResponse<T> {
    return this.success(data, message, requestId);
  }

  static updated<T>(
    data: T,
    message = 'Resource updated successfully',
    requestId?: string
  ): ApiResponse<T> {
    return this.success(data, message, requestId);
  }

  static deleted(message = 'Resource deleted successfully', requestId?: string): ApiResponse {
    return this.success(null, message, requestId);
  }

  static paginated<T>(
    data: T[],
    pagination: PaginationMeta,
    message?: string,
    requestId?: string
  ): ApiResponse<T[]> {
    return this.success(data, message, requestId, pagination);
  }
}

// Express response helpers
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = httpStatus.OK,
  requestId?: string,
  pagination?: PaginationMeta
): Response => {
  const response = ApiResponseBuilder.success(data, message, requestId, pagination);
  return res.status(statusCode).json(response);
};

export const sendCreated = <T>(
  res: Response,
  data: T,
  message?: string,
  requestId?: string
): Response => {
  const response = ApiResponseBuilder.created(data, message, requestId);
  return res.status(httpStatus.CREATED).json(response);
};

export const sendUpdated = <T>(
  res: Response,
  data: T,
  message?: string,
  requestId?: string
): Response => {
  const response = ApiResponseBuilder.updated(data, message, requestId);
  return res.status(httpStatus.OK).json(response);
};

export const sendDeleted = (res: Response, message?: string, requestId?: string): Response => {
  const response = ApiResponseBuilder.deleted(message, requestId);
  return res.status(httpStatus.NO_CONTENT).json(response);
};

export const sendPaginated = <T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
  message?: string,
  requestId?: string
): Response => {
  const response = ApiResponseBuilder.paginated(data, pagination, message, requestId);
  return res.status(httpStatus.OK).json(response);
};

export const sendError = (
  res: Response,
  code: ErrorCode,
  message: string,
  statusCode = httpStatus.INTERNAL_SERVER_ERROR,
  details?: any,
  requestId?: string,
  stack?: string
): Response => {
  const response = ApiResponseBuilder.error(code, message, details, requestId, stack);
  return res.status(statusCode).json(response);
};
