import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

// Create Prisma Client instance
const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
});

// Add logging for Prisma events
prisma.$on('query', (e) => {
  logger.debug('Query: ' + e.query);
  logger.debug('Duration: ' + e.duration + 'ms');
});

prisma.$on('error', (e) => {
  logger.error('Prisma Error: ' + e.message);
});

prisma.$on('info', (e) => {
  logger.info('Prisma Info: ' + e.message);
});

prisma.$on('warn', (e) => {
  logger.warn('Prisma Warning: ' + e.message);
});

// Connect to the database
const connectDB = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Error connecting to database:', error);
    process.exit(1);
  }
};

// Disconnect from the database
const disconnectDB = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting from database:', error);
    process.exit(1);
  }
};

export { prisma, connectDB, disconnectDB };
