import { Response } from 'express';
import { sendSuccess, sendCreated, sendUpdated, sendDeleted, sendPaginated } from './apiResponse';

// Helper functions for common response patterns
export const respondWithCreated = (res: Response, data: any, message?: string) => {
  return sendCreated(res, data, message, (res.req as any).requestId);
};

export const respondWithSuccess = (res: Response, data: any, message?: string) => {
  return sendSuccess(res, data, message, undefined, (res.req as any).requestId);
};

export const respondWithUpdated = (res: Response, data: any, message?: string) => {
  return sendUpdated(res, data, message, (res.req as any).requestId);
};

export const respondWithDeleted = (res: Response, message?: string) => {
  return sendDeleted(res, message, (res.req as any).requestId);
};

export const respondWithPaginated = (
  res: Response,
  data: any[],
  pagination: any,
  message?: string
) => {
  return sendPaginated(res, data, pagination, message, (res.req as any).requestId);
};

// Quick migration helpers for existing controllers
export const migrateResponse = (oldResponse: any, res: Response) => {
  // This function helps migrate existing responses to the new format
  // It analyzes the old response and converts it to the new standardized format

  if (oldResponse && typeof oldResponse === 'object') {
    // Check if it's already in the new format
    if (oldResponse.success !== undefined) {
      return res.json(oldResponse);
    }

    // Convert old format to new format
    if (oldResponse.data || oldResponse.user || oldResponse.tokens) {
      return respondWithSuccess(res, oldResponse);
    }

    if (oldResponse.results && oldResponse.page) {
      // It's a paginated response
      const pagination = {
        page: oldResponse.page,
        limit: oldResponse.limit,
        totalPages: oldResponse.totalPages,
        totalResults: oldResponse.totalResults,
        hasNext: oldResponse.page < oldResponse.totalPages,
        hasPrev: oldResponse.page > 1,
      };
      return respondWithPaginated(res, oldResponse.results, pagination);
    }
  }

  // Default fallback
  return respondWithSuccess(res, oldResponse);
};
