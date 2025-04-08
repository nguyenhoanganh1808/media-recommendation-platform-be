// media.controller.ts
import { Request, Response } from 'express';
import asyncHandler from '../../utils/asyncHandler';
import { sendSuccess, sendError } from '../../utils/responseFormatter';
import * as mediaService from './media.service';

// Get all media with filtering and pagination
export const getAllMedia = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 10,
    type,
    genre,
    search,
    sortBy = 'popularity',
    sortOrder = 'desc',
  } = req.query as any;

  const { media, pagination } = await mediaService.getAllMedia({
    page: Number(page),
    limit: Number(limit),
    type,
    genre,
    search,
    sortBy,
    sortOrder,
  });

  sendSuccess(res, media, 'Media fetched successfully', 200, pagination);
});

// Get media by ID
export const getMediaById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const media = await mediaService.getMediaById(id);

    if (!media) {
      return sendError(res, 'Media not found', 404, 'NOT_FOUND');
    }

    sendSuccess(res, media, 'Media fetched successfully');
  }
);

// Create new media (admin/moderator only)
export const createMedia = asyncHandler(async (req: Request, res: Response) => {
  const media = await mediaService.createMedia(req.body);
  sendSuccess(res, media, 'Media created successfully', 201);
});

// Update media (admin/moderator only)
export const updateMedia = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const media = await mediaService.updateMedia(id, req.body);
  sendSuccess(res, media, 'Media updated successfully');
});

// Delete media (admin only)
export const deleteMedia = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await mediaService.deleteMedia(id);
  sendSuccess(res, null, 'Media deleted successfully');
});
