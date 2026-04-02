import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import passport from 'passport';
import httpStatus from 'http-status';
import config from './config/config';
import morgan from './config/morgan';
import xss from './middlewares/xss';
import { jwtStrategy } from './config/passport';
import {
  apiLimiter,
  authLimiter,
  passwordResetLimiter,
  registrationLimiter,
} from './middlewares/rateLimiter';
import { performanceTracker, addPerformanceHeaders } from './middlewares/performanceMonitoring';
import { addRequestId } from './middlewares/requestId';
import { sanitizeInput } from './middlewares/sanitize';
import routes from './routes/v1';
import { healthController } from './controllers';
import { errorConverter, errorHandler } from './utils/errorHandler';
import ApiError from './utils/ApiError';
import { requestLogger } from './utils/structuredLogger';

const app = express();

if (config.env !== 'test') {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

// set security HTTP headers
app.use(helmet());

// parse json request body
app.use(express.json());

// parse urlencoded request body
app.use(express.urlencoded({ extended: true }));

// add request ID for tracking
app.use(addRequestId);

// add structured logging
app.use(requestLogger);

// sanitize request data
app.use(sanitizeInput);
app.use(xss());

// gzip compression
app.use(compression());

// enable cors
app.use(
  cors({
    origin: config.clientUrl
      ? [config.clientUrl, 'http://localhost:3001', 'http://localhost:3000']
      : '*',
    credentials: true,
  })
);
app.options('{*path}', cors());

// jwt authentication
app.use(passport.initialize());
passport.use('jwt', jwtStrategy);

// Performance monitoring
app.use(performanceTracker);
app.use(addPerformanceHeaders);

// Health check routes (no rate limiting)
app.get('/v1/health', healthController.healthCheck);
app.get('/v1/health/database', healthController.databaseHealthCheck);
app.get('/v1/health/email', healthController.emailHealthCheck);
app.get('/v1/health/cache', healthController.cacheHealthCheck);
app.get('/v1/health/detailed', healthController.detailedHealthCheck);
app.get('/v1/health/ready', healthController.readinessCheck);
app.get('/v1/health/live', healthController.livenessCheck);

// Rate limiting disabled for development
// To re-enable, uncomment the lines below:
// app.use('/v1', apiLimiter);
// app.use('/v1/auth/login', authLimiter);
// app.use('/v1/auth/register', registrationLimiter);

// v1 api routes
app.use('/v1', routes);

// Welcome endpoint for root URL
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Welcome to the REST API Boilerplate!',
    data: {
      name: 'Prisma Express TypeScript Boilerplate',
      version: '1.0.0',
      environment: config.env || 'development',
      endpoints: {
        health: '/v1/health',
        documentation: '/v1/docs',
        api: '/v1',
      },
      links: {
        health_check: `${req.protocol}://${req.get('host')}/v1/health`,
        api_docs: `${req.protocol}://${req.get('host')}/v1/docs`,
        github: 'https://github.com/antonio-lazaro/prisma-express-typescript-boilerplate',
      },
    },
  });
});

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);

export default app;
