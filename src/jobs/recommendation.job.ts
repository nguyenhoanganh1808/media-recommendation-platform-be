// src/jobs/recommendation.job.ts
import { PrismaClient, MediaType, User } from "@prisma/client";
import { logger } from "../config/logger";
import { RecommendationService } from "../api/recommendations/recommendations.service";
import { CacheService } from "../services/cache.service";
import * as NotificationService from "../api/notifications/notifications.service";

export class RecommendationJob {
  private prisma: PrismaClient;
  private recommendationService: RecommendationService;
  private cacheService: CacheService;
  private notificationService;

  constructor() {
    this.prisma = new PrismaClient();
    this.recommendationService = new RecommendationService();
    this.cacheService = new CacheService();
    this.notificationService = NotificationService;
  }

  /**
   * Generate recommendations for all active users
   */
  public async generateRecommendationsForAllUsers(): Promise<void> {
    try {
      logger.info("Starting recommendation generation for all users");

      // Get all active users
      const users = await this.prisma.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          username: true,
        },
      });

      logger.info(
        `Found ${users.length} active users for recommendation processing`
      );

      // Process users in batches to avoid memory issues
      const batchSize = 50;
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        await Promise.all(
          batch.map((user) => this.processUserRecommendations(user))
        );
        logger.info(`Processed recommendations batch ${i / batchSize + 1}`);
      }

      logger.info("Completed recommendation generation for all users");
    } catch (error) {
      logger.error("Error generating recommendations:", error);
      throw error;
    }
  }

  /**
   * Process recommendations for a single user
   */
  private async processUserRecommendations(user: {
    id: string;
    username: string;
  }): Promise<void> {
    try {
      logger.debug(`Generating recommendations for user: ${user.username}`);

      // Get user preferences
      const preferences = await this.prisma.userPreference.findMany({
        where: { userId: user.id },
      });

      // Generate recommendations for each media type if the user has preferences
      const mediaTypes = [MediaType.MOVIE, MediaType.GAME, MediaType.MANGA];
      let newRecommendations = false;

      for (const mediaType of mediaTypes) {
        // Check if the user has preferences for this media type
        const hasTypePreference = preferences.some(
          (p) => p.mediaTypePreference === mediaType
        );

        // Skip if user has explicitly shown no interest in this type
        if (preferences.length > 0 && !hasTypePreference) {
          continue;
        }

        const data = await this.recommendationService.getRecommendationsForUser(
          { userId: user.id, mediaType }
        );

        if (data.recommendations.length > 0) {
          // Cache recommendations
          await this.cacheService.setRecommendations(
            user.id,
            mediaType,
            data.recommendations
          );

          newRecommendations = true;
        }
      }

      // Notify user about new recommendations if any were generated
      if (newRecommendations) {
        await this.notificationService.createNotification(
          user.id,
          "NEW_RECOMMENDATION",
          "New Recommendations Available",
          "We have new recommendations for you based on your preferences and ratings!",
          { timestamp: new Date().toISOString() }
        );
      }
    } catch (error) {
      logger.error(
        `Error generating recommendations for user ${user.username}:`,
        error
      );
      // Continue with other users even if one fails
    }
  }

  /**
   * Update media popularity scores based on recent activity
   */
  public async updateMediaPopularityScores(): Promise<void> {
    try {
      logger.info("Starting update of media popularity scores");

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get all media with their recent ratings and reviews
      const mediaItems = await this.prisma.media.findMany({
        include: {
          _count: {
            select: {
              ratings: {
                where: {
                  createdAt: { gte: thirtyDaysAgo },
                },
              },
              reviews: {
                where: {
                  createdAt: { gte: thirtyDaysAgo },
                },
              },
              listItems: {
                where: {
                  createdAt: { gte: thirtyDaysAgo },
                },
              },
            },
          },
        },
      });

      // Update popularity scores
      for (const media of mediaItems) {
        // Calculate popularity based on recent ratings, reviews, and list additions
        // with different weights for each activity
        const popularityScore =
          media._count.ratings * 1.0 + // Each rating is worth 1 point
          media._count.reviews * 2.0 + // Each review is worth 2 points
          media._count.listItems * 0.5; // Each list addition is worth 0.5 points

        // Update media with new popularity score
        await this.prisma.media.update({
          where: { id: media.id },
          data: { popularity: popularityScore },
        });
      }

      logger.info(
        `Updated popularity scores for ${mediaItems.length} media items`
      );
    } catch (error) {
      logger.error("Error updating media popularity scores:", error);
      throw error;
    }
  }

  /**
   * Clean up the job resources
   */
  public async cleanup(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
