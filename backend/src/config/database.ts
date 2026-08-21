import { PrismaClient } from '@prisma/client';
import { Logger } from '../utils/logger';

let prismaInstance: PrismaClient | null = null;

export const getPrismaClient = (): PrismaClient => {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });

    prismaInstance.$connect()
      .then(() => Logger.info('PostgreSQL connected via Prisma Client.'))
      .catch((err: Error) => {
        Logger.warn('PostgreSQL database not yet running locally. Services will operate in memory-fallback mode:', err.message);
      });
  }
  return prismaInstance;
};
