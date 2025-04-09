import { Prisma, NotificationType } from "@prisma/client";
import { AppError } from "../../middlewares/error.middleware";
import { clearCacheByPattern } from "../../middlewares/cache.middleware";
import { logger } from "../../config/logger";
import { prisma } from "../../config/database";
import { createPagination } from "../../utils/responseFormatter";
import {
  sendBulkReadStatus,
  sendNotificationReadStatus,
  sendUnreadCount,
  sendUserNotification,
} from "../../services/socket.service";

interface PaginationOptions {
  page: number;
  limit: number;
  includeRead?: boolean;
}

interface NotificationSettings {
  newRecommendation: boolean;
  newFollower: boolean;
  newRating: boolean;
  newReview: boolean;
  listShare: boolean;
  systemNotification: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
}

/**
 * Get notifications for a user with pagination
 */
export async function getUserNotifications(
  userId: string,
  options: PaginationOptions,
) {
  const { page, limit, includeRead = false } = options;
  const skip = (page - 1) * limit;

  // Build filter condition based on whether to include read notifications
  const whereCondition: Prisma.NotificationWhereInput = {
    userId,
    ...(includeRead ? {} : { isRead: false }),
  };

  // Get notifications
  const notifications = await prisma.notification.findMany({
    where: whereCondition,
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take: limit,
  });

  // Get total count for pagination
  const total = await prisma.notification.count({
    where: whereCondition,
  });

  // Get unread count
  const unreadCount = await prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });

  // Create pagination metadata
  const pagination = createPagination(page, limit, total);

  await sendUnreadCount(userId);

  return { notifications, pagination, unreadCount };
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(
  userId: string,
  notificationId: string,
) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  if (notification.userId !== userId) {
    throw new AppError("Unauthorized access to notification", 403);
  }

  const updatedNotification = await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  // Clear user-specific notification cache
  await clearCacheByPattern(`user:${userId}:/api/notifications`);

  // Send notification read update via socket
  await sendNotificationReadStatus(userId, notificationId);

  return updatedNotification;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string) {
  // First, get all unread notification IDs to send socket updates
  const unreadNotifications = await prisma.notification.findMany({
    where: {
      userId,
      isRead: false,
    },
    select: {
      id: true,
    },
  });

  const unreadIds = unreadNotifications.map((notification) => notification.id);

  // Update all notifications to read
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });

  // Clear user-specific notification cache
  await clearCacheByPattern(`user:${userId}:/api/notifications`);

  // Send bulk read status updates via socket
  if (unreadIds.length > 0) {
    await sendBulkReadStatus(userId, unreadIds);
  }

  return result.count;
}

/**
 * Delete a notification
 */
export async function deleteNotification(
  userId: string,
  notificationId: string,
) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  if (notification.userId !== userId) {
    throw new AppError("Unauthorized access to notification", 403);
  }

  await prisma.notification.delete({
    where: { id: notificationId },
  });

  // Clear user-specific notification cache
  await clearCacheByPattern(`user:${userId}:/api/notifications`);

  await sendUnreadCount(userId);

  return true;
}

/**
 * Delete all read notifications for a user
 */
export async function deleteAllReadNotifications(userId: string) {
  const result = await prisma.notification.deleteMany({
    where: {
      userId,
      isRead: true,
    },
  });

  // Clear user-specific notification cache
  await clearCacheByPattern(`user:${userId}:/api/notifications`);

  await sendUnreadCount(userId);

  return result.count;
}

/**
 * Create a new notification
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, any>,
) {
  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    logger.warn(
      `Attempted to create notification for non-existent user: ${userId}`,
    );
    return null;
  }

  // Get user's notification settings (if implemented)
  const settings = await getNotificationSettings(userId);

  // Check if user wants this type of notification
  if (!shouldSendNotification(type, settings)) {
    logger.info(`User ${userId} has disabled notifications of type: ${type}`);
    return null;
  }
  // Create notification
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      data: data ? (data as Prisma.JsonObject) : undefined,
    },
  });

  // TODO: Send push notification or email if enabled in settings

  // Send real-time notification via Socket.IO

  sendUserNotification(userId, {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    data: notification.data,
    createdAt: notification.createdAt,
  });

  // Clear user-specific notification cache
  await clearCacheByPattern(`user:${userId}:/api/notifications`);
  return notification;
}

/**
 * Create notifications for multiple users
 */
export async function createBulkNotifications(
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, any>,
) {
  const notifications = [];

  for (const userId of userIds) {
    try {
      const notification = await createNotification(
        userId,
        type,
        title,
        message,
        data,
      );
      if (notification) {
        notifications.push(notification);
      }
    } catch (error) {
      logger.error(
        `Failed to create notification for user ${userId}: ${error}`,
      );
    }
  }

  return notifications;
}

/**
 * Create a system notification for all users
 */
export async function createSystemNotification(
  title: string,
  message: string,
  data?: Record<string, any>,
) {
  // Get all active users
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  const userIds = users.map((user) => user.id);

  return createBulkNotifications(
    userIds,
    "SYSTEM_NOTIFICATION",
    title,
    message,
    data,
  );
}

/**
 * Retrieve notification settings for a user
 */
export async function getNotificationSettings(
  userId: string,
): Promise<NotificationSettings> {
  // In a real implementation, fetch from database
  return {
    newRecommendation: true,
    newFollower: true,
    newRating: true,
    newReview: true,
    listShare: true,
    systemNotification: true,
    emailNotifications: false,
    pushNotifications: false,
  };
}

export async function updateNotificationSettings(
  userId: string,
  settings: Partial<NotificationSettings>,
): Promise<NotificationSettings> {
  const currentSettings = await getNotificationSettings(userId);
  const updatedSettings = { ...currentSettings, ...settings };

  // TODO: Save to database in a real implementation

  return updatedSettings;
}

/**
 * Helper function to check if notification should be sent based on user settings
 */
function shouldSendNotification(
  type: NotificationType,
  settings: NotificationSettings,
): boolean {
  switch (type) {
    case "NEW_RECOMMENDATION":
      return settings.newRecommendation;
    case "NEW_FOLLOWER":
      return settings.newFollower;
    case "NEW_RATING":
      return settings.newRating;
    case "NEW_REVIEW":
      return settings.newReview;
    case "LIST_SHARE":
      return settings.listShare;
    case "SYSTEM_NOTIFICATION":
      return settings.systemNotification;
    default:
      return true;
  }
}
