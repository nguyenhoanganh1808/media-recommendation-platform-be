import { Request, Response, NextFunction } from 'express';
import { getCache, redisClient, setCache } from '../config/redis';
import { config } from '../config/env';
import { logger } from '../config/logger';

// Interface for cache options
interface CacheOptions {
  ttl?: number;
  keyPrefix?: string;
  keyGenerator?: (req: Request) => string;
  cacheCondition?: (req: Request) => boolean;
}

/**
 * Middleware to cache API responses
 * @param options Cache options
 */
export const cacheMiddleware = (options: CacheOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip cache for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Check if caching should be applied based on condition
    if (options.cacheCondition && !options.cacheCondition(req)) {
      return next();
    }

    // Generate cache key
    const keyPrefix = options.keyPrefix || 'api:';
    const keyGenerator =
      options.keyGenerator ||
      ((req: Request) => {
        // Default key generation based on URL and query parameters
        const queryParams = new URLSearchParams(
          req.query as Record<string, string>
        ).toString();
        return `${req.originalUrl}${queryParams ? `?${queryParams}` : ''}`;
      });

    const cacheKey = `${keyPrefix}${keyGenerator(req)}`;

    try {
      // Try to get data from cache
      const cachedData = await getCache(cacheKey);

      if (cachedData) {
        // Parse cached data
        const data = JSON.parse(cachedData);
        logger.debug(`Cache hit for: ${cacheKey}`);
        res.status(200).json(data);
        return;
      }

      // If not in cache, store the original json function
      const originalJson = res.json;

      // Override res.json to cache the response
      res.json = function (body: any): Response {
        // Restore original json function
        res.json = originalJson;

        // Cache the response
        const ttl = options.ttl || config.REDIS_TTL;
        setCache(cacheKey, JSON.stringify(body), ttl);
        logger.debug(`Cache set for: ${cacheKey}, TTL: ${ttl}s`);

        // Call the original json function
        return originalJson.call(this, body);
      };

      logger.debug(`Cache miss for: ${cacheKey}`);
      next();
    } catch (error) {
      logger.error(`Cache error: ${error}`);
      // Continue without caching if there's an error
      next();
    }
  };
};

/**
 * Middleware to cache responses based on authenticated user
 * @param options Cache options
 */
export const userCacheMiddleware = (options: CacheOptions = {}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Default key generator that includes user ID
    const defaultKeyGenerator = (req: Request) => {
      const userId = req.user?.id || 'anonymous';
      const queryParams = new URLSearchParams(
        req.query as Record<string, string>
      ).toString();
      return `user:${userId}:${req.originalUrl}${queryParams ? `?${queryParams}` : ''}`;
    };

    // Use custom key generator if provided, otherwise use default
    const keyGenerator = options.keyGenerator || defaultKeyGenerator;

    // Apply the standard cache middleware with user-specific key
    return cacheMiddleware({
      ...options,
      keyPrefix: options.keyPrefix || 'user:',
      keyGenerator,
      // Only cache for authenticated users unless overridden
      cacheCondition: options.cacheCondition || ((req: Request) => !!req.user),
    })(req, res, next);
  };
};

/**
 * Clear cache for a specific prefix pattern
 * @param keyPrefix The prefix pattern to clear
 */
export const clearCacheByPattern = async (
  keyPattern: string
): Promise<void> => {
  try {
    // Find all keys matching the pattern
    const keys = await redisClient.keys(`*${keyPattern}*`);

    if (keys.length > 0) {
      // Delete all found keys
      await redisClient.del(keys);
      logger.info(
        `Cleared ${keys.length} cache entries matching pattern: ${keyPattern}`
      );
    }
  } catch (error) {
    logger.error(`Error clearing cache: ${error}`);
    throw error;
  }
};
