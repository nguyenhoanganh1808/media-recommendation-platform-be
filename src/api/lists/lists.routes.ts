import { Router } from "express";
import * as listsController from "./lists.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { checkOwnership } from "../../middlewares/auth.middleware";
import {
  validate,
  validateQueryParams,
} from "../../middlewares/validation.middleware";
import * as listsValidation from "./lists.validation";
import {
  cacheMiddleware,
  userCacheMiddleware,
} from "../../middlewares/cache.middleware";

const router = Router();

/**
 * @openapi
 * /api/lists:
 *   get:
 *     summary: Get all lists for the authenticated user
 *     tags: [Lists]
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
 *         description: Successfully retrieved user lists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       isPublic:
 *                         type: boolean
 *                       itemCount:
 *                         type: integer
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
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
 */
router.use(authenticate);
router.get(
  "/",
  validateQueryParams(["page", "limit"]),
  userCacheMiddleware({ ttl: 300 }),
  listsController.getUserLists
);

/**
 * @openapi
 * /api/lists/{id}:
 *   get:
 *     summary: Get a specific list by ID
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the list to retrieve
 *     responses:
 *       200:
 *         description: Successfully retrieved list details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 description:
 *                   type: string
 *                 isPublic:
 *                   type: boolean
 *                 userId:
 *                   type: string
 *                 itemCount:
 *                   type: integer
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       mediaId:
 *                         type: string
 *                       notes:
 *                         type: string
 *                       order:
 *                         type: integer
 *                       media:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           title:
 *                             type: string
 *                           mediaType:
 *                             type: string
 *                           coverImage:
 *                             type: string
 *                           releaseDate:
 *                             type: string
 *                           averageRating:
 *                             type: number
 *                           genres:
 *                             type: array
 *                             items:
 *                               type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: List not found
 *       403:
 *         description: Unauthorized to view this list
 */
router.get(
  "/:id",
  userCacheMiddleware({ ttl: 300 }),
  listsController.getListById
);

/**
 * @openapi
 * /api/lists:
 *   post:
 *     summary: Create a new list
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the list
 *               description:
 *                 type: string
 *                 description: Optional description of the list
 *               isPublic:
 *                 type: boolean
 *                 description: Whether the list is public or not
 *             required:
 *               - name
 *     responses:
 *       201:
 *         description: List created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 description:
 *                   type: string
 *                 isPublic:
 *                   type: boolean
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Validation error
 */
router.post(
  "/",
  validate(listsValidation.createListValidation),
  listsController.createList
);

/**
 * @openapi
 * /api/lists/{id}:
 *   put:
 *     summary: Update a list
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the list to update
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: New name for the list
 *               description:
 *                 type: string
 *                 description: New description for the list
 *               isPublic:
 *                 type: boolean
 *                 description: Whether the list should be public or not
 *     responses:
 *       200:
 *         description: List updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 description:
 *                   type: string
 *                 isPublic:
 *                   type: boolean
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: List not found
 *       400:
 *         description: Validation error
 */
router.put(
  "/:id",
  validate(listsValidation.updateListValidation),
  checkOwnership("mediaList"),
  listsController.updateList
);

/**
 * @openapi
 * /api/lists/{id}:
 *   delete:
 *     summary: Delete a list
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the list to delete
 *     responses:
 *       200:
 *         description: List deleted successfully
 *       404:
 *         description: List not found
 */
router.delete("/:id", checkOwnership("mediaList"), listsController.deleteList);

/**
 * @openapi
 * /api/lists/{listId}/items:
 *   post:
 *     summary: Add an item to a list
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the list to add an item to
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mediaId:
 *                 type: string
 *                 description: ID of the media to add to the list
 *               notes:
 *                 type: string
 *                 description: Optional notes for the list item
 *             required:
 *               - mediaId
 *     responses:
 *       201:
 *         description: Item added to list successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 listId:
 *                   type: string
 *                 mediaId:
 *                   type: string
 *                 notes:
 *                   type: string
 *                 order:
 *                   type: integer
 *       404:
 *         description: List or media not found
 *       409:
 *         description: Item already exists in the list
 */
router.post(
  "/:listId/items",
  validate(listsValidation.addItemValidation),
  checkOwnership("mediaList", "listId"),
  listsController.addItemToList
);

/**
 * @openapi
 * /api/lists/items/{itemId}:
 *   put:
 *     summary: Update a list item
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the list item to update
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: New notes for the list item
 *     responses:
 *       200:
 *         description: List item updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 listId:
 *                   type: string
 *                 mediaId:
 *                   type: string
 *                 notes:
 *                   type: string
 *                 order:
 *                   type: integer
 *                 media:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *       404:
 *         description: List item not found
 *       403:
 *         description: Unauthorized to update this list item
 */
router.put(
  "/items/:itemId",
  validate(listsValidation.updateItemValidation),
  listsController.updateListItem
);

/**
 * @openapi
 * /api/lists/{listId}/reorder:
 *   put:
 *     summary: Reorder list items
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the list to reorder items
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     order:
 *                       type: integer
 *             required:
 *               - items
 *     responses:
 *       200:
 *         description: List items reordered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   listId:
 *                     type: string
 *                   mediaId:
 *                     type: string
 *                   notes:
 *                     type: string
 *                   order:
 *                     type: integer
 *       400:
 *         description: Invalid reorder request
 *       403:
 *         description: Unauthorized to reorder list items
 */
router.put(
  "/:listId/reorder",
  validate(listsValidation.reorderItemsValidation),
  checkOwnership("mediaList", "listId"),
  listsController.reorderListItems
);

/**
 * @openapi
 * /api/lists/items/{itemId}:
 *   delete:
 *     summary: Remove an item from a list
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the list item to remove
 *     responses:
 *       200:
 *         description: Item removed from list successfully
 *       404:
 *         description: List item not found
 *       403:
 *         description: Unauthorized to remove this list item
 */
router.delete("/items/:itemId", listsController.removeItemFromList);

/**
 * @openapi
 * /api/lists/user/{userId}/public:
 *   get:
 *     summary: Get public lists from a specific user
 *     tags: [Lists]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user whose public lists to retrieve
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
 *         description: Successfully retrieved public lists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       itemCount:
 *                         type: integer
 *                       user:
 *                         type: object
 *                         properties:
 *                           username:
 *                             type: string
 *                           avatar:
 *                             type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
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
 */
router.get(
  "/user/:userId/public",
  cacheMiddleware({ ttl: 600, keyPrefix: "lists:public:" }),
  listsController.getUserPublicLists
);

export default router;
