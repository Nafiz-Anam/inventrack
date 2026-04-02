import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import config from './config/config';
import logger from './config/logger';

// add prisma to the NodeJS global type
interface CustomNodeJsGlobal {
  prisma: PrismaClient;
}

// Prevent multiple instances of Prisma Client in development
declare const global: CustomNodeJsGlobal;

let connectionString = process.env.DATABASE_URL;

// Fix SSL mode for external databases (skip for local/docker)
if (connectionString) {
  try {
    const url = new URL(connectionString);
    const host = url.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === 'postgres' || host === 'db';

    if (!isLocal) {
      const originalSslMode = url.searchParams.get('sslmode');
      url.searchParams.delete('sslmode');
      url.searchParams.set('sslmode', 'verify-full');
      connectionString = url.toString();

      if (originalSslMode !== 'verify-full') {
        logger.info('Fixed SSL mode from', { originalSSL: originalSslMode, newSSL: 'verify-full' });
      }
    }
  } catch {
    // If URL parsing fails, continue with original string
  }
}

const adapter = new PrismaPg({ connectionString });

const prisma = global.prisma || new PrismaClient({ adapter });

if (config.env === 'development') global.prisma = prisma;

export default prisma;
