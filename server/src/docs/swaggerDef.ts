import { name, version, repository, description } from '../../package.json';
import config from '../config/config';

const swaggerDef = {
  openapi: '3.0.0',
  info: {
    title: `${name} API Documentation`,
    version,
    description: description || 'RESTful API with Node.js, TypeScript, Express, and Prisma',
    contact: {
      name: 'API Support',
      email: 'support@example.com',
    },
    license: {
      name: 'MIT',
      url: repository,
    },
  },
  servers: [
    {
      url: `http://localhost:${config.port}/v1`,
      description: 'Development server',
    },
    {
      url: `https://api.example.com/v1`,
      description: 'Production server',
    },
  ],
  tags: [
    {
      name: 'Auth',
      description: 'Authentication endpoints',
    },
    {
      name: 'Users',
      description: 'User management endpoints',
    },
    {
      name: 'Health',
      description: 'Health check endpoints',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token in the format: Bearer <token>',
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  paths: {
    '/auth/verify-email-otp': {
      post: {
        tags: ['Auth'],
        summary: 'Verify email using OTP',
        description:
          "Verify a user's email address using a 6-digit OTP sent to their email after registration.",
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/VerifyEmailOtpRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Email verified successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/VerifyEmailOtpResponse' },
              },
            },
          },
          401: {
            description: 'Invalid or expired OTP',
          },
        },
      },
    },
    '/auth/sessions': {
      get: {
        tags: ['Auth'],
        summary: 'List active device sessions',
        description: 'Get all active device sessions for the authenticated user.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'List of active sessions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SessionListResponse' },
              },
            },
          },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/auth/sessions/end': {
      post: {
        tags: ['Auth'],
        summary: 'End (logout) a device session',
        description: 'End (logout) a session for the authenticated user by deviceId.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/EndSessionRequest' },
            },
          },
        },
        responses: {
          204: { description: 'Session ended successfully' },
          400: { description: 'Missing userId or deviceId' },
          401: { description: 'Unauthorized' },
        },
      },
    },
  },
};

export default swaggerDef;
