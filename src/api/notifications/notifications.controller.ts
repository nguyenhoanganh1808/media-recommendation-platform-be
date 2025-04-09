import { Request, Response, NextFunction } from "express";
import asyncHandler from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/responseFormatter";
import * as notificationService from "./notifications.service";

/**
 * Get all notifications for the authenticated user
 */
export const getUserNotifications = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const includeRead = req.query.includeRead === "true";

    const { notifications, pagination, unreadCount } =
      await notificationService.getUserNotifications(userId, {
        page,
        limit,
        includeRead,
      });

    sendSuccess(
      res,
      notifications,
      "Notifications retrieved successfully",
      200,
      {
        ...pagination,
        unreadCount,
      },
    );
  },
);

/**
 * Mark a notification as read
 */
export const markAsRead = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user!.id;
    const notificationId = req.params.id;

    const notification = await notificationService.markNotificationAsRead(
      userId,
      notificationId,
    );

    sendSuccess(res, notification, "Notification marked as read", 200);
  },
);

/**
 * Mark all notifications as read
 */
export const markAllAsRead = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user!.id;

    const count = await notificationService.markAllNotificationsAsRead(userId);

    sendSuccess(res, { count }, `${count} notifications marked as read`, 200);
  },
);

/**
 * Delete a notification
 */
export const deleteNotification = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user!.id;
    const notificationId = req.params.id;

    await notificationService.deleteNotification(userId, notificationId);

    sendSuccess(res, null, "Notification deleted successfully", 204);
  },
);

/**
 * Delete all read notifications
 */
export const deleteAllReadNotifications = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user!.id;

    const count = await notificationService.deleteAllReadNotifications(userId);

    sendSuccess(res, { count }, `${count} read notifications deleted`, 200);
  },
);

/**
 * Get notification settings
 */
export const getNotificationSettings = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user!.id;

    const settings = await notificationService.getNotificationSettings(userId);

    sendSuccess(
      res,
      settings,
      "Notification settings retrieved successfully",
      200,
    );
  },
);

/**
 * Update notification settings
 */
export const updateNotificationSettings = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user!.id;
    const settings = req.body;

    const updatedSettings =
      await notificationService.updateNotificationSettings(userId, settings);

    sendSuccess(
      res,
      updatedSettings,
      "Notification settings updated successfully",
      200,
    );
  },
);
