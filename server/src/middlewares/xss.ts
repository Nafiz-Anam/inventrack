import { NextFunction, Request, Response } from 'express';
import { inHTMLData } from 'xss-filters';

/**
 * Clean for xss.
 * @param {string/object} data - The value to sanitize
 * @return {string/object} The sanitized value
 */
export const clean = <T>(data: T | string = ''): T => {
  let isObject = false;
  if (typeof data === 'object') {
    data = JSON.stringify(data);
    isObject = true;
  }

  data = inHTMLData(data as string).trim();
  if (isObject) data = JSON.parse(data);

  return data as T;
};

const middleware = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.body) req.body = clean(req.body);
    if (req.query) {
      Object.keys(req.query).forEach(key => {
        // @ts-ignore
        req.query[key] = clean(req.query[key]);
      });
    }
    if (req.params) {
      Object.keys(req.params).forEach(key => {
        // @ts-ignore
        req.params[key] = clean(req.params[key]);
      });
    }
    next();
  };
};

export default middleware;
