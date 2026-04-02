import httpStatus from 'http-status';
import ApiError from '../utils/ApiError';
import { NextFunction, Request, Response } from 'express';
import pick from '../utils/pick';
import { z } from 'zod';

const validate =
  (schema: Record<string, z.ZodSchema>) => (req: Request, res: Response, next: NextFunction) => {
    const validSchema = pick(schema, ['params', 'query', 'body']);

    // Ensure req.query and req.body are at least empty objects
    const obj: Record<string, any> = {};
    for (const key of Object.keys(validSchema)) {
      obj[key] = (req as any)[key] ?? {};
    }

    try {
      // Validate each schema individually for better error messages
      const validated: Record<string, any> = {};
      for (const [key, schemaItem] of Object.entries(validSchema)) {
        validated[key] = (schemaItem as z.ZodSchema).parse(obj[key]);
      }

      // In Express 5, req.query is read-only, so assign validated values individually
      if (validated.body) (req as any).body = validated.body;
      if (validated.params) (req as any).params = validated.params;
      // For query, we can't overwrite it in Express 5, but the original values are already there
      return next();
    } catch (error) {
      let errorMessage = 'Validation error';
      if (error instanceof z.ZodError) {
        errorMessage = error.issues.map(err => err.message).join(', ');
      } else if (error && typeof error === 'object' && 'issues' in error) {
        // Zod v4 compatibility
        errorMessage = (error as any).issues.map((err: any) => err.message).join(', ');
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      return next(new ApiError(httpStatus.BAD_REQUEST, errorMessage));
    }
  };

export default validate;
