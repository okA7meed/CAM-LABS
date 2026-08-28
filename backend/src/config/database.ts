import { PrismaClient } from '@prisma/client';
import { Logger } from '../utils/logger';

let prismaInstance: PrismaClient | null = null;

export const getPrismaClient = (): PrismaClient => {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return prismaInstance;
};

/**
 * Establishes the database connection at server startup.
 *
 * Production fails fast and clearly: the server refuses to start when the
 * database is unavailable, so business data is never silently switched to an
 * in-memory stand-in.
 *
 * Development may continue without PostgreSQL so local-only flows can be
 * explored, but the situation is always logged as a warning.
 */
export const verifyDatabaseConnection = async (): Promise<void> => {
  const prisma = getPrismaClient();
  try {
    await prisma.$connect();
    Logger.info('PostgreSQL connected via Prisma Client.');
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      Logger.error('FATAL: PostgreSQL is unavailable. Refusing to start in production with business data at risk.');
      throw error;
    }
    Logger.warn(`PostgreSQL is unavailable (${error instanceof Error ? error.message : String(error)}). Running in development mode without database persistence.`);
  }
};
