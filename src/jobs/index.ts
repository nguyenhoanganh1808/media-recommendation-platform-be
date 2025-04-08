// src/jobs/index.ts
import { CronJob } from "cron";
import { logger } from "../config/logger";
import { RecommendationJob } from "./recommendation.job";
import { NotificationJob } from "./notification.job";
import { config } from "../config/env";

/**
 * Initialize and schedule all background jobs
 */
export const initializeJobs = (): void => {
  logger.info("Initializing background jobs");

  // Schedule recommendation generation - runs every 6 hours
  const recommendationJob = new CronJob(
    config.RECOMMENDATION_UPDATE_INTERVAL, // Every 6 hours
    async () => {
      logger.info("Starting scheduled recommendation job");
      const job = new RecommendationJob();

      try {
        await job.generateRecommendationsForAllUsers();
        await job.updateMediaPopularityScores();
      } catch (error) {
        logger.error("Error in recommendation job:", error);
      } finally {
        await job.cleanup();
      }

      logger.info("Finished scheduled recommendation job");
    },
    null, // onComplete
    false, // start
    config.TZ
  );

  // Schedule notification delivery - runs every 15 minutes
  const notificationDeliveryJob = new CronJob(
    "*/15 * * * *", // Every 15 minutes
    async () => {
      logger.info("Starting scheduled notification delivery job");
      const job = new NotificationJob();

      try {
        await job.deliverPendingNotifications();
      } catch (error) {
        logger.error("Error in notification delivery job:", error);
      } finally {
        await job.cleanup();
      }

      logger.info("Finished scheduled notification delivery job");
    },
    null, // onComplete
    false, // start
    config.TZ || "UTC"
  );

  // Schedule weekly digest - runs Sunday at 8:00 AM
  const weeklyDigestJob = new CronJob(
    "0 8 * * 0", // Sunday at 8:00 AM
    async () => {
      logger.info("Starting weekly digest job");
      const job = new NotificationJob();

      try {
        await job.sendWeeklyDigests();
      } catch (error) {
        logger.error("Error in weekly digest job:", error);
      } finally {
        await job.cleanup();
      }

      logger.info("Finished weekly digest job");
    },
    null, // onComplete
    false, // start
    config.TZ
  );

  // Schedule notification cleanup - runs at 3:00 AM every Monday
  const notificationCleanupJob = new CronJob(
    "0 3 * * 1", // Monday at 3:00 AM
    async () => {
      logger.info("Starting notification cleanup job");
      const job = new NotificationJob();

      try {
        await job.cleanupOldNotifications();
      } catch (error) {
        logger.error("Error in notification cleanup job:", error);
      } finally {
        await job.cleanup();
      }

      logger.info("Finished notification cleanup job");
    },
    null, // onComplete
    false, // start
    config.TZ
  );

  // Start all jobs
  recommendationJob.start();
  notificationDeliveryJob.start();
  weeklyDigestJob.start();
  notificationCleanupJob.start();

  logger.info("All background jobs initialized and scheduled");
};

/**
 * Manual job triggers for testing or one-off operations
 */
export const jobTriggers = {
  async triggerRecommendations(): Promise<void> {
    logger.info("Manually triggering recommendation generation");
    const job = new RecommendationJob();

    try {
      await job.generateRecommendationsForAllUsers();
      await job.updateMediaPopularityScores();
    } finally {
      await job.cleanup();
    }
  },

  async triggerNotificationDelivery(): Promise<void> {
    logger.info("Manually triggering notification delivery");
    const job = new NotificationJob();

    try {
      await job.deliverPendingNotifications();
    } finally {
      await job.cleanup();
    }
  },

  async triggerWeeklyDigest(): Promise<void> {
    logger.info("Manually triggering weekly digest");
    const job = new NotificationJob();

    try {
      await job.sendWeeklyDigests();
    } finally {
      await job.cleanup();
    }
  },

  async triggerNotificationCleanup(): Promise<void> {
    logger.info("Manually triggering notification cleanup");
    const job = new NotificationJob();

    try {
      await job.cleanupOldNotifications();
    } finally {
      await job.cleanup();
    }
  },
};
