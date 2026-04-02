import { Request, Response, NextFunction } from 'express';

interface CacheOptions {
  duration: number; // in seconds
  key?: string;
}

const cache = new Map<string, { data: any; timestamp: number }>();

export const cacheMiddleware = (options: CacheOptions) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = options.key || `${req.method}:${req.originalUrl}`;
    const cached = cache.get(key);

    if (cached && Date.now() - cached.timestamp < options.duration * 1000) {
      return res.json(cached.data);
    }

    // Store original send method
    const originalSend = res.json;

    // Override send method to cache response
    res.json = function (data) {
      cache.set(key, {
        data,
        timestamp: Date.now(),
      });

      // Call original send method
      return originalSend.call(this, data);
    };

    next();
  };
};

export const clearCache = (pattern?: string) => {
  if (pattern) {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
};

// Clear cache every hour to prevent memory leaks
setInterval(
  () => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [key, value] of cache.entries()) {
      if (value.timestamp < oneHourAgo) {
        cache.delete(key);
      }
    }
  },
  60 * 60 * 1000
); // Run every hour
