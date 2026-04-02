import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Extend Request interface to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export const addRequestId = (req: Request, res: Response, next: NextFunction): void => {
  req.requestId = uuidv4();

  // Add requestId to response headers for debugging
  res.setHeader('X-Request-ID', req.requestId);

  next();
};
