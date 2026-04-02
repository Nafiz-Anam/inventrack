import { z } from 'zod';

const envVarsSchema = z.object({
  NODE_ENV: z.enum(['production', 'development', 'test']),
  PORT: z.number().default(8000),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  JWT_ACCESS_EXPIRATION_MINUTES: z.number().default(30),
  JWT_REFRESH_EXPIRATION_DAYS: z.number().default(30),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.number(),
  SMTP_USERNAME: z.string(),
  SMTP_PASSWORD: z.string(),
  EMAIL_FROM: z.string(),
  ALLOWED_ORIGINS: z.string(),
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
  database: {
    url: envVars.DATABASE_URL,
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
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
  cors: {
    origins: envVars.ALLOWED_ORIGINS?.split(',') || ['http://localhost:8000'],
  },
};

export default config;
