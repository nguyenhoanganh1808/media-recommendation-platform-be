import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import asyncHandler from '../../utils/asyncHandler';
import { sendSuccess, createPagination } from '../../utils/responseFormatter';
import { AppError } from '../../middlewares/error.middleware';
import * as listService from './lists.service';

/**
 * Get all lists for the authenticated user
 */
export const getUserLists = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [lists, pagination] = await listService.getListByUser(
      userId,
      page,
      skip,
      limit
    );

    sendSuccess(res, lists, 'Lists retrieved successfully', 200, pagination);
  }
);

/**
 * Get a specific list by ID
 */
export const getListById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const list = await listService.getListById(id, userId);

  sendSuccess(res, list, 'List retrieved successfully');
});

/**
 * Create a new list
 */
export const createList = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { name, description, isPublic } = req.body;

  const newList = await listService.createList(
    userId,
    name,
    description,
    isPublic
  );

  sendSuccess(res, newList, 'List created successfully', 201);
});

/**
 * Update a list
 */
export const updateList = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, isPublic } = req.body;

  const updatedList = await listService.updateList(id, {
    name,
    description,
    isPublic,
  });

  sendSuccess(res, updatedList, 'List updated successfully');
});

/**
 * Delete a list
 */
export const deleteList = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  await prisma.mediaList.delete({
    where: { id },
  });

  sendSuccess(res, null, 'List deleted successfully');
});

/**
 * Add item to a list
 */
export const addItemToList = asyncHandler(
  async (req: Request, res: Response) => {
    const { listId } = req.params;
    const { mediaId, notes } = req.body;

    const listItem = await listService.addItemToList(listId, mediaId, notes);

    sendSuccess(res, listItem, 'Item added to list successfully', 201);
  }
);

/**
 * Update list item
 */
export const updateListItem = asyncHandler(
  async (req: Request, res: Response) => {
    const { itemId } = req.params;
    const { notes } = req.body;

    const updatedItem = await listService.updateListItem(
      itemId,
      notes,
      req.user!
    );

    sendSuccess(res, updatedItem, 'List item updated successfully');
  }
);

/**
 * Reorder list items
 */
export const reorderListItems = asyncHandler(
  async (req: Request, res: Response) => {
    const { listId } = req.params;
    const { items } = req.body;

    // Validate items format
    if (
      !Array.isArray(items) ||
      items.some((item) => !item.id || item.order === undefined)
    ) {
      throw new AppError(
        'Invalid items format. Each item must have id and order properties',
        400
      );
    }

    // Transaction to update all items at once
    const updates = await listService.reorderListItems(listId, items);

    sendSuccess(res, updates, 'List items reordered successfully');
  }
);

/**
 * Remove item from list
 */
export const removeItemFromList = asyncHandler(
  async (req: Request, res: Response) => {
    const { itemId } = req.params;

    await listService.removeItemFromList(itemId, req.user!.id);

    sendSuccess(res, null, 'Item removed from list successfully');
  }
);

/**
 * Get public lists from a specific user
 */
export const getUserPublicLists = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [lists, pagination] = await listService.getUserPublicLists(
      userId,
      page,
      skip,
      limit
    );

    sendSuccess(
      res,
      lists,
      'Public lists retrieved successfully',
      200,
      pagination
    );
  }
);
