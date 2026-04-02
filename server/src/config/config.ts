import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({
  path: path.join(process.cwd(), '.env'),
  quiet: true,
});

const envVarsSchema = z.object({
  NODE_ENV: z.enum(['production', 'development', 'test']),
  PORT: z.string().transform(Number).pipe(z.number().default(8000)),
  CLIENT_URL: z.string().default('http://localhost:8000'),
  JWT_SECRET: z.string(),
  JWT_ACCESS_EXPIRATION_MINUTES: z.string().transform(Number).pipe(z.number().default(30)),
  JWT_REFRESH_EXPIRATION_DAYS: z.string().transform(Number).pipe(z.number().default(30)),
  JWT_RESET_PASSWORD_EXPIRATION_MINUTES: z.string().transform(Number).pipe(z.number().default(10)),
  JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: z.string().transform(Number).pipe(z.number().default(10)),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.string().transform(Number).pipe(z.number()),
  SMTP_USERNAME: z.string(),
  SMTP_PASSWORD: z.string(),
  EMAIL_FROM: z.string(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).pipe(z.number().default(6379)),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().transform(Number).pipe(z.number().default(0)),
});

let envVars: z.infer<typeof envVarsSchema>;

try {
  envVars = envVarsSchema.parse(process.env);
} catch (error) {
  const configError = new Error(
    `Config validation error: ${error instanceof z.ZodError ? error.issues[0]?.message : error.message}`
  );
  configError.cause = error;
  throw configError;
}

const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
    resetPasswordExpirationMinutes: envVars.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
    verifyEmailExpirationMinutes: envVars.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES,
  },
  email: {
    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      auth: {
        user: envVars.SMTP_USERNAME,
        pass: envVars.SMTP_PASSWORD,
      },
    },
    from: envVars.EMAIL_FROM,
  },
  redis: {
    host: envVars.REDIS_HOST,
    port: envVars.REDIS_PORT,
    password: envVars.REDIS_PASSWORD,
    db: envVars.REDIS_DB,
  },
  clientUrl: envVars.CLIENT_URL,
};

export default config;
