import { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import httpStatus from 'http-status';
import config from '../config/config';
import logger from '../config/logger';
import ApiError from './ApiError';
import { ErrorCode, sendError } from './apiResponse';

// Error classification function
const classifyError = (error: Error): { code: ErrorCode; statusCode: number } => {
  // ApiError instances
  if (error instanceof ApiError) {
    return {
      code: mapHttpStatusCodeToErrorCode(error.statusCode),
      statusCode: error.statusCode,
    };
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return { code: ErrorCode.DUPLICATE_RESOURCE, statusCode: httpStatus.CONFLICT };
      case 'P2025':
        return { code: ErrorCode.NOT_FOUND, statusCode: httpStatus.NOT_FOUND };
      case 'P2003':
        return { code: ErrorCode.INVALID_INPUT, statusCode: httpStatus.BAD_REQUEST };
      default:
        return { code: ErrorCode.DATABASE_ERROR, statusCode: httpStatus.BAD_REQUEST };
    }
  }

  // Validation errors
  if (error.name === 'ValidationError' || error.message.includes('validation')) {
    return { code: ErrorCode.VALIDATION_ERROR, statusCode: httpStatus.BAD_REQUEST };
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return { code: ErrorCode.TOKEN_INVALID, statusCode: httpStatus.UNAUTHORIZED };
  }
  if (error.name === 'TokenExpiredError') {
    return { code: ErrorCode.TOKEN_EXPIRED, statusCode: httpStatus.UNAUTHORIZED };
  }

  // Default to internal server error
  return { code: ErrorCode.INTERNAL_SERVER_ERROR, statusCode: httpStatus.INTERNAL_SERVER_ERROR };
};

// Map HTTP status codes to error codes
const mapHttpStatusCodeToErrorCode = (statusCode: number): ErrorCode => {
  switch (statusCode) {
    case httpStatus.BAD_REQUEST:
      return ErrorCode.VALIDATION_ERROR;
    case httpStatus.UNAUTHORIZED:
      return ErrorCode.UNAUTHORIZED;
    case httpStatus.FORBIDDEN:
      return ErrorCode.FORBIDDEN;
    case httpStatus.NOT_FOUND:
      return ErrorCode.NOT_FOUND;
    case httpStatus.CONFLICT:
      return ErrorCode.CONFLICT;
    case httpStatus.TOO_MANY_REQUESTS:
      return ErrorCode.RATE_LIMIT_EXCEEDED;
    default:
      return ErrorCode.INTERNAL_SERVER_ERROR;
  }
};

// Extract meaningful error details
const extractErrorDetails = (error: Error): any => {
  if (error instanceof ApiError) {
    return error.details;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      prismaCode: error.code,
      target: error.meta?.target,
      constraint: error.meta?.constraint,
    };
  }

  // For validation errors, try to extract field information
  if (error.message.includes('validation')) {
    return {
      validationError: true,
      originalMessage: error.message,
    };
  }

  return null;
};

export const errorConverter: ErrorRequestHandler = (err, req, res, next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    const classification = classifyError(error);
    const statusCode = classification.statusCode;
    const message = error.message || httpStatus[statusCode];

    error = new ApiError(statusCode, message, false, err.stack);
  }

  // Log error with request context
  logger.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: (req as any).requestId,
    userId: (req.user as any)?.id,
  });

  next(error);
};

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const classification = classifyError(err);
  const details = extractErrorDetails(err);
  const requestId = (req as any).requestId;

  // Log error in development
  if (config.env === 'development') {
    logger.error('Error details:', {
      error: err.message,
      stack: err.stack,
      classification,
      details,
      requestId,
    });
  }

  // Send standardized error response
  sendError(
    res,
    classification.code,
    err.message,
    classification.statusCode as any,
    details,
    requestId,
    config.env === 'development' ? err.stack : undefined
  );
};
