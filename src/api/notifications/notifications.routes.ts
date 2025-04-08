import { Router } from "express";
import * as notificationController from "./notifications.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validation.middleware";
import { userCacheMiddleware } from "../../middlewares/cache.middleware";
import { rateLimiter } from "../../middlewares/rateLimiter.middleware";
import {
  deleteNotificationValidation,
  getNotificationsValidation,
  markAsReadValidation,
  updateNotificationSettingsValidation,
} from "./notifications.validation";

const router = Router();

router.use(authenticate);
router.use(rateLimiter);

/**
 * @openapi
 * /api/notifications:
 *   get:
 *     summary: Get all notifications for the logged-in user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of notifications per page
 *       - in: query
 *         name: includeRead
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include read notifications in the response
 *     responses:
 *       200:
 *         description: Successfully retrieved notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       type:
 *                         type: string
 *                         enum: ['NEW_RECOMMENDATION', 'NEW_FOLLOWER', 'NEW_RATING', 'NEW_REVIEW', 'LIST_SHARE', 'SYSTEM_NOTIFICATION']
 *                       title:
 *                         type: string
 *                       message:
 *                         type: string
 *                       isRead:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  "/",
  validate(getNotificationsValidation),
  userCacheMiddleware({ ttl: 300 }), // Cache for 5 minutes
  notificationController.getUserNotifications
);

/**
 * @openapi
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: Mark a specific notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique identifier of the notification
 *     responses:
 *       200:
 *         description: Notification marked as read successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     isRead:
 *                       type: boolean
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.patch(
  "/:id/read",
  validate(markAsReadValidation),
  notificationController.markAsRead
);

/**
 * @openapi
 * /api/notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                       description: Number of notifications marked as read
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.patch("/read-all", notificationController.markAllAsRead);

/**
 * @openapi
 * /api/notifications/read:
 *   delete:
 *     summary: Delete all read notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Read notifications deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                       description: Number of read notifications deleted
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete("/read", notificationController.deleteAllReadNotifications);

/**
 * @openapi
 * /api/notifications/{id}:
 *   delete:
 *     summary: Delete a specific notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique identifier of the notification
 *     responses:
 *       204:
 *         description: Notification deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete(
  "/:id",
  validate(deleteNotificationValidation),
  notificationController.deleteNotification
);

/**
 * @openapi
 * /api/notifications/settings:
 *   get:
 *     summary: Get notification settings
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved notification settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     newRecommendation:
 *                       type: boolean
 *                     newFollower:
 *                       type: boolean
 *                     newRating:
 *                       type: boolean
 *                     newReview:
 *                       type: boolean
 *                     listShare:
 *                       type: boolean
 *                     systemNotification:
 *                       type: boolean
 *                     emailNotifications:
 *                       type: boolean
 *                     pushNotifications:
 *                       type: boolean
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/settings", notificationController.getNotificationSettings);

/**
 * @openapi
 * /api/notifications/settings:
 *   put:
 *     summary: Update notification settings
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newRecommendation:
 *                 type: boolean
 *               newFollower:
 *                 type: boolean
 *               newRating:
 *                 type: boolean
 *               newReview:
 *                 type: boolean
 *               listShare:
 *                 type: boolean
 *               systemNotification:
 *                 type: boolean
 *               emailNotifications:
 *                 type: boolean
 *               pushNotifications:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Notification settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     newRecommendation:
 *                       type: boolean
 *                     newFollower:
 *                       type: boolean
 *                     newRating:
 *                       type: boolean
 *                     newReview:
 *                       type: boolean
 *                     listShare:
 *                       type: boolean
 *                     systemNotification:
 *                       type: boolean
 *                     emailNotifications:
 *                       type: boolean
 *                     pushNotifications:
 *                       type: boolean
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put(
  "/settings",
  validate(updateNotificationSettingsValidation),
  notificationController.updateNotificationSettings
);

export default router;
