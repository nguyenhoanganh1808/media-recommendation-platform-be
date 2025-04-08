// media.routes.ts
import { Router } from "express";
import { authenticate, restrictTo } from "../../middlewares/auth.middleware";
import {
  validate,
  validateQueryParams,
} from "../../middlewares/validation.middleware";
import { cacheMiddleware } from "../../middlewares/cache.middleware";
import { rateLimiter } from "../../middlewares/rateLimiter.middleware";
import * as mediaController from "./media.controller";
import * as mediaValidation from "./media.validation";
import { Role } from "@prisma/client";

const router = Router();

/**
 * @openapi
 * /api/media:
 *   get:
 *     summary: Retrieve a list of media with optional filtering
 *     description: Fetch media with pagination, filtering by type, genre, and search
 *     tags:
 *       - Media
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
 *           maximum: 50
 *         description: Number of items per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: ['MOVIE', 'GAME', 'MANGA']
 *         description: Filter media by type
 *       - in: query
 *         name: genre
 *         schema:
 *           type: string
 *         description: Filter media by genre
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search media by title
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: ['popularity', 'releaseDate', 'averageRating', 'title']
 *           default: popularity
 *         description: Sort media by specified field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: ['asc', 'desc']
 *           default: desc
 *         description: Sort order for media list
 *     responses:
 *       200:
 *         description: Successful media retrieval
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
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get(
  "/",
  validateQueryParams([
    "page",
    "limit",
    "type",
    "genre",
    "search",
    "sortBy",
    "sortOrder",
  ]),
  cacheMiddleware({ ttl: 300 }), // Cache for 5 minutes
  rateLimiter,
  validate(mediaValidation.getAllMediaValidation),
  mediaController.getAllMedia
);

/**
 * @openapi
 * /api/media/{id}:
 *   get:
 *     summary: Retrieve a specific media item by ID
 *     description: Fetch detailed information about a specific media item
 *     tags:
 *       - Media
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique identifier of the media item
 *     responses:
 *       200:
 *         description: Successful media retrieval
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Media'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  "/:id",
  cacheMiddleware({ ttl: 300 }),
  rateLimiter,
  validate(mediaValidation.getMediaByIdValidation),
  mediaController.getMediaById
);

/**
 * @openapi
 * /api/media:
 *   post:
 *     summary: Create a new media item
 *     description: Add a new media item (movies, games, manga)
 *     tags:
 *       - Media
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - mediaType
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               releaseDate:
 *                 type: string
 *                 format: date
 *               mediaType:
 *                 type: string
 *                 enum: ['MOVIE', 'GAME', 'MANGA']
 *               status:
 *                 type: string
 *               coverImage:
 *                 type: string
 *                 format: url
 *               genres:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Media item created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Media'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  "/",
  authenticate,
  restrictTo(Role.ADMIN, Role.MODERATOR),
  validate(mediaValidation.createMediaValidation),
  mediaController.createMedia
);

/**
 * @openapi
 * /api/media/{id}:
 *   put:
 *     summary: Update an existing media item
 *     description: Update details of a specific media item
 *     tags:
 *       - Media
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique identifier of the media item to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               releaseDate:
 *                 type: string
 *                 format: date
 *               mediaType:
 *                 type: string
 *                 enum: ['MOVIE', 'GAME', 'MANGA']
 *               status:
 *                 type: string
 *               coverImage:
 *                 type: string
 *                 format: url
 *               genres:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Media item updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Media'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put(
  "/:id",
  authenticate,
  restrictTo(Role.ADMIN, Role.MODERATOR),
  validate(mediaValidation.updateMediaValidation),
  mediaController.updateMedia
);

/**
 * @openapi
 * /api/media/{id}:
 *   delete:
 *     summary: Delete a media item
 *     description: Remove a specific media item from the system
 *     tags:
 *       - Media
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique identifier of the media item to delete
 *     responses:
 *       200:
 *         description: Media item deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Media deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.delete(
  "/:id",
  authenticate,
  restrictTo(Role.ADMIN),
  validate(mediaValidation.deleteMediaValidation),
  mediaController.deleteMedia
);

export default router;
