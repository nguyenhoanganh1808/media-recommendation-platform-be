// src/api/ratings/ratings.routes.ts
import { Router } from "express";
import * as ratingsController from "./ratings.controller";
import {
  authenticate,
  checkOwnership,
  restrictTo,
} from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validation.middleware";
import {
  createRatingValidation,
  deleteRatingValidation,
  getMediaRatingsValidation,
  getRatingValidation,
  getUserMediaRatingValidation,
  getUserRatingsValidation,
  updateRatingValidation,
  userRatingsQueryValidation,
} from "./ratings.validation";
import { userCacheMiddleware } from "../../middlewares/cache.middleware";
import { Role } from "@prisma/client";

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @openapi
 * /api/ratings:
 *   post:
 *     summary: Create a new rating for a media item
 *     tags: [Ratings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mediaId
 *               - rating
 *             properties:
 *               mediaId:
 *                 type: string
 *                 format: uuid
 *                 description: Unique identifier of the media being rated
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 10
 *                 description: Rating value between 1 and 10
 *     responses:
 *       201:
 *         description: Rating created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Rating'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post(
  "/",
  validate(createRatingValidation),
  ratingsController.createRating
);

/**
 * @openapi
 * /api/ratings/me:
 *   get:
 *     summary: Get ratings for the authenticated user
 *     tags: [Ratings]
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
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Successfully retrieved user ratings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ratings:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Rating'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  "/me",
  validate(userRatingsQueryValidation),
  userCacheMiddleware({ ttl: 300 }),
  ratingsController.getUserRatings
);

/**
 * @openapi
 * /api/ratings/user/{userId}:
 *   get:
 *     summary: Get ratings for a specific user
 *     tags: [Ratings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique identifier of the user
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
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Successfully retrieved user ratings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ratings:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Rating'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  "/user/:userId",
  validate(userRatingsQueryValidation),
  validate(getUserRatingsValidation),
  userCacheMiddleware({ ttl: 300 }),
  ratingsController.getUserRatings
);

/**
 * @openapi
 * /api/ratings/media/{mediaId}:
 *   get:
 *     summary: Get ratings for a specific media
 *     tags: [Ratings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique identifier of the media
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
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Successfully retrieved media ratings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ratings:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Rating'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  "/media/:mediaId",
  validate(getMediaRatingsValidation),
  userCacheMiddleware({ ttl: 300 }),
  ratingsController.getMediaRatings
);

/**
 * @openapi
 * /api/ratings/{id}:
 *   get:
 *     summary: Get a specific rating by ID
 *     tags: [Ratings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique identifier of the rating
 *     responses:
 *       200:
 *         description: Successfully retrieved rating
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Rating'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  "/:id",
  validate(getRatingValidation),
  userCacheMiddleware({ ttl: 300 }),
  ratingsController.getRating
);

/**
 * @openapi
 * /api/ratings/user/media/{mediaId}:
 *   get:
 *     summary: Get a user's rating for a specific media
 *     tags: [Ratings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique identifier of the media
 *     responses:
 *       200:
 *         description: Successfully retrieved user rating for media
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Rating'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  "/user/media/:mediaId",
  validate(getUserMediaRatingValidation),
  userCacheMiddleware({ ttl: 300 }),
  ratingsController.getUserMediaRating
);

/**
 * @openapi
 * /api/ratings/{id}:
 *   put:
 *     summary: Update a rating
 *     tags: [Ratings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique identifier of the rating to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *             properties:
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 10
 *                 description: Updated rating value between 1 and 10
 *     responses:
 *       200:
 *         description: Rating updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Rating'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Unauthorized to update this rating
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
  "/:id",
  validate(updateRatingValidation),
  ratingsController.updateRating
);

/**
 * @openapi
 * /api/ratings/{id}:
 *   delete:
 *     summary: Delete a rating
 *     tags: [Ratings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique identifier of the rating to delete
 *     responses:
 *       200:
 *         description: Rating deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Unauthorized to delete this rating
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete(
  "/:id",
  validate(deleteRatingValidation),
  checkOwnership("mediaRating", "id"),
  ratingsController.deleteRating
);

/**
 * @openapi
 * /api/ratings/admin/{id}:
 *   delete:
 *     summary: Force delete a rating (Admin only)
 *     tags: [Ratings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique identifier of the rating to delete
 *     responses:
 *       200:
 *         description: Rating deleted successfully by admin
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Insufficient privileges
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete(
  "/admin/:id",
  validate(deleteRatingValidation),
  restrictTo(Role.ADMIN, Role.MODERATOR),
  ratingsController.deleteRating
);

export default router;
