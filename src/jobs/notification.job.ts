// src/jobs/notification.job.ts
import { Media, Notification, PrismaClient, User } from "@prisma/client";
import { createTransport, Transporter } from "nodemailer";

import { logger } from "../config/logger";
import * as NotificationService from "../api/notifications/notifications.service";
import * as SocketService from "../services/socket.service";
import { redisClient } from "../config/redis";
import { config } from "../config/env";

export class NotificationJob {
  private prisma: PrismaClient;
  private notificationService;
  private emailTransporter: Transporter;
  private redisClient;

  constructor() {
    this.prisma = new PrismaClient();
    this.notificationService = NotificationService;

    // Initialize email transporter
    this.emailTransporter = createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: true,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASSWORD,
      },
    });

    // Initialize Redis client for processing queue
    this.redisClient = redisClient;
  }

  /**
   * Process pending notifications and deliver them via appropriate channels
   */
  public async deliverPendingNotifications(): Promise<void> {
    try {
      logger.info("Starting delivery of pending notifications");

      // Get unprocessed notifications (those that haven't been sent yet)
      // Use Redis to track which notifications have been processed
      const notifications = await this.prisma.notification.findMany({
        where: {
          isRead: false,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        take: 100, // Process in batches
      });

      logger.info(
        `Found ${notifications.length} pending notifications to process`,
      );

      for (const notification of notifications) {
        const deliveryKey = `notification:delivered:${notification.id}`;
        const hasBeenDelivered = await this.redisClient.get(deliveryKey);

        if (hasBeenDelivered) {
          continue; // Skip if already delivered
        }

        // Deliver based on notification type
        switch (notification.type) {
          case "NEW_RECOMMENDATION":
          case "SYSTEM_NOTIFICATION":
            // Process in-app only
            await this.processInAppNotification(notification);
            break;

          case "NEW_FOLLOWER":
          case "NEW_RATING":
          case "NEW_REVIEW":
          case "LIST_SHARE":
            // Process in-app and email
            await this.processInAppNotification(notification);
            await this.sendEmailNotification(notification);
            break;

          default:
            logger.warn(`Unknown notification type: ${notification.type}`);
        }

        // Mark as delivered in Redis with 7-day expiry
        await this.redisClient.set(deliveryKey, "1", { EX: 60 * 60 * 24 * 7 });
      }

      logger.info("Completed delivery of pending notifications");
    } catch (error) {
      logger.error("Error delivering notifications:", error);
      throw error;
    }
  }

  /**
   * Process weekly digest notifications with content summaries
   */
  public async sendWeeklyDigests(): Promise<void> {
    try {
      logger.info("Starting generation of weekly digests");

      // Get active users who have opted into digests
      const users = await this.prisma.user.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          username: true,
        },
      });

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      for (const user of users) {
        // Get new recommendations from the past week
        const recommendations = await this.prisma.media.findMany({
          where: {
            // This would reference a recommendations table or come from cached recommendations
            ratings: {
              some: {
                createdAt: { gte: oneWeekAgo },
              },
            },
          },
          take: 5, // Top 5 new recommendations
        });

        // Get activity from users they follow
        const followingActivity = await this.prisma.follow.findMany({
          where: {
            followerId: user.id,
            following: {
              mediaRatings: {
                some: {
                  createdAt: { gte: oneWeekAgo },
                },
              },
            },
          },
          select: {
            following: {
              select: {
                username: true,
                mediaRatings: {
                  where: {
                    createdAt: { gte: oneWeekAgo },
                  },
                  include: {
                    media: true,
                  },
                  take: 3, // Limit to 3 ratings per user
                },
              },
            },
          },
        });

        // If there's new content, send a digest
        if (recommendations.length > 0 || followingActivity.length > 0) {
          await this.sendDigestEmail(user, recommendations, followingActivity);

          // Create an in-app notification about the digest
          await this.notificationService.createNotification(
            user.id,
            "SYSTEM_NOTIFICATION",
            "Your Weekly Digest",
            "Check your email for your weekly content digest!",
            { timestamp: new Date().toISOString() },
          );
        }
      }

      logger.info("Completed generation of weekly digests");
    } catch (error) {
      logger.error("Error sending weekly digests:", error);
      throw error;
    }
  }

  /**
   * Clean up old notifications to prevent database bloat
   */
  public async cleanupOldNotifications(): Promise<void> {
    try {
      logger.info("Starting cleanup of old notifications");

      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      // Delete read notifications older than 3 months
      const result = await this.prisma.notification.deleteMany({
        where: {
          isRead: true,
          createdAt: { lt: threeMonthsAgo },
        },
      });

      logger.info(`Deleted ${result.count} old notifications`);
    } catch (error) {
      logger.error("Error cleaning up old notifications:", error);
      throw error;
    }
  }

  /**
   * Process in-app notification (mark as ready for client retrieval)
   */
  private async processInAppNotification(
    notification: Notification & {
      user: {
        id: string;
        username: string;
        email: string;
      };
    },
  ): Promise<void> {
    logger.debug(
      `Processing in-app notification ${notification.id} for user ${notification.user.username}`,
    );

    await this.sendSocketNotification(notification);
  }

  /**
   * Send notification via socket.io
   */
  private async sendSocketNotification(
    notification: Notification & {
      user: {
        id: string;
        username: string;
        email: string;
      };
    },
  ): Promise<void> {
    try {
      // Extract notification data for socket emission
      const socketNotification = {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        createdAt: notification.createdAt,
      };

      // Use the socket service to send the notification
      SocketService.sendUserNotification(
        notification.user.id,
        socketNotification,
      );

      logger.debug(`Socket notification sent to user ${notification.user.id}`);
    } catch (error) {
      logger.error(`Error sending socket notification: ${error}`);
      // Continue with other delivery methods even if socket fails
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    notification: Notification & {
      user: {
        id: string;
        username: string;
        email: string;
      };
    },
  ): Promise<void> {
    try {
      logger.debug(`Sending email notification to ${notification.user.email}`);

      // Prepare email content based on notification type
      let subject = "New Activity on Media Recommendation Platform";
      let html = `<h1>${notification.title}</h1><p>${notification.message}</p>`;

      // Customize email based on notification type
      switch (notification.type) {
        case "NEW_FOLLOWER":
          subject = "You have a new follower!";
          // Extract follower info from notification data if available
          break;
        case "NEW_RATING":
          subject = "New rating on your review";
          break;
        case "NEW_REVIEW":
          subject = "New review on media you might be interested in";
          break;
        case "LIST_SHARE":
          subject = "Someone shared a media list with you";
          break;
      }

      // Add footer with unsubscribe link
      html += `<br><hr><p>You received this email because you're subscribed to notifications. 
               <a href="${process.env.APP_URL}/settings/notifications">Manage your notification preferences</a>.</p>`;

      await this.emailTransporter.sendMail({
        from: `"Media Platform" <${process.env.EMAIL_FROM}>`,
        to: notification.user.email,
        subject: subject,
        html: html,
      });

      logger.debug(`Email sent successfully to ${notification.user.email}`);
    } catch (error) {
      logger.error(`Error sending email to ${notification.user.email}:`, error);
      // Continue with other notifications even if email fails
    }
  }

  /**
   * Send weekly digest email
   */
  private async sendDigestEmail(
    user: Partial<User>,
    recommendations: Media[],
    followingActivity: {
      following: {
        username: string;
        mediaRatings: {
          rating: number;
          media: Media;
        }[];
      };
    }[],
  ): Promise<void> {
    try {
      logger.debug(`Sending weekly digest to ${user.email}`);

      // Build HTML content for the digest email
      let html = `
        <h1>Your Weekly Digest</h1>
        <p>Hello ${user.username}, here's what you might have missed this week:</p>
      `;

      // Add recommendations section if any exist
      if (recommendations.length > 0) {
        html += `<h2>Recommended for You</h2><ul>`;
        recommendations.forEach((rec) => {
          html += `<li><strong>${rec.title}</strong> - ${rec.description?.substring(0, 100)}...</li>`;
        });
        html += `</ul>`;
      }

      // Add following activity if any exists
      if (followingActivity.length > 0) {
        html += `<h2>Recent Activity from People You Follow</h2>`;
        followingActivity.forEach((activity) => {
          html += `<h3>${activity.following.username}'s Recent Ratings</h3><ul>`;
          activity.following.mediaRatings.forEach((rating) => {
            html += `<li><strong>${rating.media.title}</strong> - Rated ${rating.rating}/10</li>`;
          });
          html += `</ul>`;
        });
      }

      // Add footer with unsubscribe link
      html += `<br><hr><p>You received this email because you're subscribed to weekly digests. 
               <a href="${process.env.APP_URL}/settings/notifications">Manage your email preferences</a>.</p>`;

      await this.emailTransporter.sendMail({
        from: `"Media Platform Digest" <${process.env.EMAIL_FROM}>`,
        to: user.email,
        subject: "Your Weekly Media Digest",
        html: html,
      });

      logger.debug(`Weekly digest sent successfully to ${user.email}`);
    } catch (error) {
      logger.error(`Error sending weekly digest to ${user.email}:`, error);
      // Continue with other users even if email fails
    }
  }

  /**
   * Clean up job resources
   */
  public async cleanup(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
