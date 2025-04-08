// src/api/recommendations/recommendations.routes.ts
import { Router } from "express";
import * as recommendationsController from "./recommendations.controller";
import { authenticate, restrictTo } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validation.middleware";
import {
  getRecommendationsValidation,
  getMediaBasedRecommendationsValidation,
  updateUserPreferencesValidation,
} from "./recommendations.validation";
import { Role } from "@prisma/client";
import { userCacheMiddleware } from "../../middlewares/cache.middleware";

const router = Router();

/**
 * @openapi
 * /api/recommendations:
 *   get:
 *     summary: Get personalized recommendations for authenticated user
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 100
 *         description: Number of recommendations to return
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: mediaType
 *         schema:
 *           type: string
 *           enum: [MOVIE, GAME, MANGA]
 *         description: Filter recommendations by media type
 *       - in: query
 *         name: includeRated
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include media that user has already rated
 *     responses:
 *       200:
 *         description: Successfully retrieved personalized recommendations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Media'
 *                 message:
 *                   type: string
 *                   example: Recommendations retrieved successfully
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  "/",
  authenticate,
  validate(getRecommendationsValidation),
  userCacheMiddleware({ ttl: 3600 }), // Cache for 1 hour
  recommendationsController.getRecommendations
);

/**
 * @openapi
 * /api/recommendations/trending:
 *   get:
 *     summary: Get trending media recommendations
 *     tags: [Recommendations]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 100
 *         description: Number of recommendations to return
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: mediaType
 *         schema:
 *           type: string
 *           enum: [MOVIE, GAME, MANGA]
 *         description: Filter trending recommendations by media type
 *     responses:
 *       200:
 *         description: Successfully retrieved trending recommendations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Media'
 *                 message:
 *                   type: string
 *                   example: Trending recommendations retrieved successfully
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 */
router.get(
  "/trending",
  validate(getRecommendationsValidation),
  userCacheMiddleware({
    ttl: 1800,
    cacheCondition: () => true, // Cache for both auth and non-auth users
  }),
  recommendationsController.getTrendingRecommendations
);

/**
 * @openapi
 * /api/recommendations/media/{mediaId}:
 *   get:
 *     summary: Get recommendations based on a specific media item
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the source media
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 100
 *         description: Number of recommendations to return
 *     responses:
 *       200:
 *         description: Successfully retrieved media-based recommendations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Media'
 *                 message:
 *                   type: string
 *                   example: Media-based recommendations retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  "/media/:mediaId",
  authenticate,
  validate(getMediaBasedRecommendationsValidation),
  userCacheMiddleware({ ttl: 3600 }),
  recommendationsController.getMediaBasedRecommendations
);

/**
 * @openapi
 * /api/recommendations/preferences/{userId}:
 *   put:
 *     summary: Update user recommendation preferences
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the user whose preferences are being updated
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               genreIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array of genre IDs to update preferences
 *               mediaTypePreferences:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [MOVIE, GAME, MANGA]
 *                     strength:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 1
 *                       description: Preference strength (0-1)
 *     responses:
 *       200:
 *         description: Successfully updated user preferences
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: string
 *                         format: uuid
 *                       genreId:
 *                         type: string
 *                         format: uuid
 *                       mediaTypePreference:
 *                         type: string
 *                         enum: [MOVIE, GAME, MANGA]
 *                       preferenceStrength:
 *                         type: number
 *                 message:
 *                   type: string
 *                   example: User preferences updated successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put(
  "/preferences/:userId",
  authenticate,
  restrictTo(Role.USER, Role.ADMIN),
  validate(updateUserPreferencesValidation),
  recommendationsController.updateUserPreferences
);

export default router;
