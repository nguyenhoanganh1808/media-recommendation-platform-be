import { createClient } from 'redis';
import { config } from './env';
import { logger } from './logger';

// Create Redis client
const redisClient = createClient({
  url: config.REDIS_URL,
});

// Connect to Redis
redisClient.on('connect', () => {
  logger.info('Redis client connected');
});

// Error handling
redisClient.on('error', (err) => {
  logger.error('Redis client error:', err);
});

// Connect to Redis
const connectRedis = async (): Promise<void> => {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.error('Error connecting to Redis:', error);
    process.exit(1);
  }
};

// Disconnect from Redis
const disconnectRedis = async (): Promise<void> => {
  try {
    await redisClient.disconnect();
    logger.info('Redis client disconnected');
  } catch (error) {
    logger.error('Error disconnecting from Redis:', error);
  }
};

// Cache middleware
const getCache = async (key: string): Promise<string | null> => {
  try {
    return await redisClient.get(key);
  } catch (error) {
    logger.error('Redis get error:', error);
    return null;
  }
};

const setCache = async (
  key: string,
  value: string,
  expireInSeconds = config.REDIS_TTL
): Promise<void> => {
  try {
    await redisClient.set(key, value, { EX: expireInSeconds });
  } catch (error) {
    logger.error('Redis set error:', error);
  }
};

const deleteCache = async (key: string): Promise<void> => {
  try {
    await redisClient.del(key);
  } catch (error) {
    logger.error('Redis delete error:', error);
  }
};

const flushCache = async (): Promise<void> => {
  try {
    await redisClient.flushAll();
    logger.info('Redis cache flushed');
  } catch (error) {
    logger.error('Redis flush error:', error);
  }
};

export {
  redisClient,
  connectRedis,
  disconnectRedis,
  getCache,
  setCache,
  deleteCache,
  flushCache,
};
