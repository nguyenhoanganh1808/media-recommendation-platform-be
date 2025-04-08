import * as notificationService from '../api/notifications/notifications.service';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

/**
 * Create a follow notification when a user follows another user
 */
export async function createFollowNotification(
  followerId: string,
  followingId: string
) {
  try {
    // Get user details to personalize notification
    const follower = await prisma.user.findUnique({
      where: { id: followerId },
      select: { username: true },
    });

    if (!follower) {
      return null;
    }

    return await notificationService.createNotification(
      followingId,
      'NEW_FOLLOWER',
      'New Follower',
      `${follower.username} is now following you`,
      { followerId }
    );
  } catch (error) {
    logger.error(`Failed to create follow notification: ${error}`);
    return null;
  }
}

/**
 * Create a rating notification when a user rates media
 */
export async function createRatingNotification(
  userId: string,
  mediaId: string,
  rating: number
) {
  try {
    // Get media details
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
      select: { title: true },
    });

    if (!media) {
      return null;
    }

    // Get user's followers
    const followers = await prisma.follow.findMany({
      where: { followingId: userId },
      select: { followerId: true },
    });

    const followerIds = followers.map((f) => f.followerId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    // Create notifications for all followers
    return await notificationService.createBulkNotifications(
      followerIds,
      'NEW_RATING',
      'New Rating',
      `${user?.username} rated ${media.title} ${rating}/10`,
      { userId, mediaId, rating }
    );
  } catch (error) {
    logger.error(`Failed to create rating notification: ${error}`);
    return null;
  }
}

/**
 * Create a review notification when a user reviews media
 */
export async function createReviewNotification(
  userId: string,
  mediaId: string,
  reviewId: string
) {
  try {
    // Get media details
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
      select: { title: true },
    });

    if (!media) {
      return null;
    }

    // Get user's followers
    const followers = await prisma.follow.findMany({
      where: { followingId: userId },
      select: { followerId: true },
    });

    const followerIds = followers.map((f) => f.followerId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    // Create notifications for all followers
    return await notificationService.createBulkNotifications(
      followerIds,
      'NEW_REVIEW',
      'New Review',
      `${user?.username} posted a review for ${media.title}`,
      { userId, mediaId, reviewId }
    );
  } catch (error) {
    logger.error(`Failed to create review notification: ${error}`);
    return null;
  }
}

/**
 * Create a list share notification when a user shares a list with another user
 */
export async function createListShareNotification(
  listId: string,
  sharedByUserId: string,
  sharedWithUserId: string
) {
  try {
    // Get list details
    const list = await prisma.mediaList.findUnique({
      where: { id: listId },
      select: { name: true },
    });

    if (!list) {
      return null;
    }

    // Get user details
    const sharedByUser = await prisma.user.findUnique({
      where: { id: sharedByUserId },
      select: { username: true },
    });

    return await notificationService.createNotification(
      sharedWithUserId,
      'LIST_SHARE',
      'List Shared With You',
      `${sharedByUser?.username} shared their list "${list.name}" with you`,
      { listId, sharedByUserId }
    );
  } catch (error) {
    logger.error(`Failed to create list share notification: ${error}`);
    return null;
  }
}

/**
 * Create a recommendation notification when new recommendations are generated
 */
export async function createRecommendationNotification(
  userId: string,
  recommendationCount: number
) {
  try {
    return await notificationService.createNotification(
      userId,
      'NEW_RECOMMENDATION',
      'New Recommendations',
      `We have ${recommendationCount} new recommendations for you`,
      { count: recommendationCount }
    );
  } catch (error) {
    logger.error(`Failed to create recommendation notification: ${error}`);
    return null;
  }
}

/**
 * Create a system notification for all users
 */
export async function createGlobalSystemNotification(
  title: string,
  message: string,
  data?: Record<string, any>
) {
  return await notificationService.createSystemNotification(
    title,
    message,
    data
  );
}
