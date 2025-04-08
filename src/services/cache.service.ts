// src/services/cache.service.ts
import { createClient, RedisClientType } from "redis";
import { MediaType, Media } from "@prisma/client";
import { logger } from "../config/logger";
import { config } from "../config/env";

interface CacheOptions {
  ttl?: number; // Time to live in seconds
}

export class CacheService {
  private client: RedisClientType;
  private readonly DEFAULT_TTL = 60 * 60 * 24; // 24 hours
  private readonly RECOMMENDATION_PREFIX = "recommendations:";
  private readonly USER_PREFERENCES_PREFIX = "user_preferences:";
  private readonly MEDIA_DETAILS_PREFIX = "media_details:";

  constructor() {
    try {
      this.client = createClient({
        url: config.REDIS_URL,

        socket: {
          connectTimeout: 5000,
          reconnectStrategy: (retries) => {
            // Exponential backoff strategy
            return Math.min(retries * 50, 5000);
          },
        },
      });

      // Handle connection events
      this.client.on("error", (err) => {
        logger.error("Redis Client Error", err);
      });

      this.client.on("connect", () => {
        logger.info("Connected to Redis");
      });

      // Connect to Redis
      this.connect();
    } catch (error) {
      logger.error("Failed to create Redis client", error);
      throw error;
    }
  }

  /**
   * Establish connection to Redis
   */
  private async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  /**
   * Set recommendations for a user
   * @param userId User ID
   * @param mediaType Media type
   * @param recommendations Array of recommended media
   * @param options Cache options
   */
  public async setRecommendations(
    userId: string,
    mediaType: MediaType,
    recommendations: Media[],
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      await this.connect();

      const key = `${this.RECOMMENDATION_PREFIX}${userId}:${mediaType}`;
      const ttl = options.ttl || this.DEFAULT_TTL;

      // Serialize recommendations (convert to JSON)
      const serializedRecs = recommendations.map((rec) => JSON.stringify(rec));

      // Store as a Redis list
      await this.client.del(key); // Clear existing recommendations
      await this.client.rPush(key, serializedRecs);
      await this.client.expire(key, ttl);

      logger.debug(
        `Cached ${recommendations.length} recommendations for user ${userId}`
      );
    } catch (error) {
      logger.error("Error setting recommendations in cache", error);
    }
  }

  /**
   * Get recommendations for a user
   * @param userId User ID
   * @param mediaType Media type
   * @returns Array of recommended media or null
   */
  public async getRecommendations(
    userId: string,
    mediaType: MediaType
  ): Promise<Media[] | null> {
    try {
      await this.connect();

      const key = `${this.RECOMMENDATION_PREFIX}${userId}:${mediaType}`;

      // Get all items from the list
      const cachedRecs = await this.client.lRange(key, 0, -1);

      if (!cachedRecs || cachedRecs.length === 0) {
        return null;
      }

      // Deserialize recommendations
      return cachedRecs.map((rec) => JSON.parse(rec));
    } catch (error) {
      logger.error("Error getting recommendations from cache", error);
      return null;
    }
  }

  /**
   * Cache user preferences
   * @param userId User ID
   * @param preferences User preferences object
   * @param options Cache options
   */
  public async setUserPreferences(
    userId: string,
    preferences: any,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      await this.connect();

      const key = `${this.USER_PREFERENCES_PREFIX}${userId}`;
      const ttl = options.ttl || this.DEFAULT_TTL;

      await this.client.set(key, JSON.stringify(preferences), { EX: ttl });

      logger.debug(`Cached preferences for user ${userId}`);
    } catch (error) {
      logger.error("Error setting user preferences in cache", error);
    }
  }

  /**
   * Get cached user preferences
   * @param userId User ID
   * @returns User preferences or null
   */
  public async getUserPreferences(userId: string): Promise<any | null> {
    try {
      await this.connect();

      const key = `${this.USER_PREFERENCES_PREFIX}${userId}`;
      const cachedPref = await this.client.get(key);

      return cachedPref ? JSON.parse(cachedPref) : null;
    } catch (error) {
      logger.error("Error getting user preferences from cache", error);
      return null;
    }
  }

  /**
   * Cache media details
   * @param mediaId Media ID
   * @param mediaDetails Media details object
   * @param options Cache options
   */
  public async setMediaDetails(
    mediaId: string,
    mediaDetails: any,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      await this.connect();

      const key = `${this.MEDIA_DETAILS_PREFIX}${mediaId}`;
      const ttl = options.ttl || this.DEFAULT_TTL;

      await this.client.set(key, JSON.stringify(mediaDetails), { EX: ttl });

      logger.debug(`Cached details for media ${mediaId}`);
    } catch (error) {
      logger.error("Error setting media details in cache", error);
    }
  }

  /**
   * Get cached media details
   * @param mediaId Media ID
   * @returns Media details or null
   */
  public async getMediaDetails(mediaId: string): Promise<any | null> {
    try {
      await this.connect();

      const key = `${this.MEDIA_DETAILS_PREFIX}${mediaId}`;
      const cachedDetails = await this.client.get(key);

      return cachedDetails ? JSON.parse(cachedDetails) : null;
    } catch (error) {
      logger.error("Error getting media details from cache", error);
      return null;
    }
  }

  /**
   * Increment a counter in Redis
   * @param key Unique key for the counter
   * @param incrementBy Amount to increment
   * @param options Cache options
   */
  public async incrementCounter(
    key: string,
    incrementBy: number = 1,
    options: CacheOptions = {}
  ): Promise<number> {
    try {
      await this.connect();

      const ttl = options.ttl || this.DEFAULT_TTL;

      // Increment and set expiry
      const newValue = await this.client.incrBy(key, incrementBy);
      await this.client.expire(key, ttl);

      return newValue;
    } catch (error) {
      logger.error("Error incrementing counter", error);
      return 0;
    }
  }

  /**
   * Delete a specific cache entry
   * @param key Cache key to delete
   */
  public async deleteEntry(key: string): Promise<void> {
    try {
      await this.connect();
      await this.client.del(key);

      logger.debug(`Deleted cache entry: ${key}`);
    } catch (error) {
      logger.error("Error deleting cache entry", error);
    }
  }

  /**
   * Clear all cached recommendations for a user
   * @param userId User ID
   * @param mediaType Optional media type to clear
   */
  public async clearUserRecommendations(
    userId: string,
    mediaType?: MediaType
  ): Promise<void> {
    try {
      await this.connect();

      if (mediaType) {
        const key = `${this.RECOMMENDATION_PREFIX}${userId}:${mediaType}`;
        await this.client.del(key);
      } else {
        // Clear all media type recommendations for the user
        const keys = await this.client.keys(
          `${this.RECOMMENDATION_PREFIX}${userId}:*`
        );
        if (keys.length > 0) {
          await this.client.del(keys);
        }
      }

      logger.debug(`Cleared recommendations for user ${userId}`);
    } catch (error) {
      logger.error("Error clearing user recommendations", error);
    }
  }

  /**
   * Cleanup and close Redis connection
   */
  public async cleanup(): Promise<void> {
    try {
      if (this.client.isOpen) {
        await this.client.quit();
        logger.info("Redis client disconnected");
      }
    } catch (error) {
      logger.error("Error during Redis client cleanup", error);
    }
  }
}

// Utility function to get Redis client (can be used elsewhere in the application)
export const getRedisClient = (): RedisClientType => {
  return createClient({
    url: config.REDIS_URL,
  });
};
