import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler";
import * as ratingsService from "./ratings.service";
import { sendSuccess } from "../../utils/responseFormatter";

export const createRating = asyncHandler(
  async (req: Request, res: Response) => {
    const { mediaId, rating, review } = req.body;
    const userId = req.user!.id;

    const newRating = await ratingsService.createRating(
      userId,
      mediaId,
      rating,
      review
    );

    sendSuccess(res, newRating, "Rating created successfully", 201);
  }
);

export const updateRating = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { rating } = req.body;
    const userId = req.user!.id;

    const updatedRating = await ratingsService.updateRating(id, userId, rating);

    sendSuccess(res, updatedRating, "Rating updated successfully");
  }
);

export const deleteRating = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    await ratingsService.deleteRating(id, userId);

    sendSuccess(res, null, "Rating deleted successfully");
  }
);

export const getRating = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const rating = await ratingsService.getRatingById(id);

  sendSuccess(res, rating, "Rating retrieved successfully");
});

export const getUserRatings = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.params.userId || req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await ratingsService.getUserRatings(userId, page, limit);

    sendSuccess(
      res,
      result.ratings,
      "User ratings retrieved successfully",
      200,
      { pagination: result.pagination }
    );
  }
);

export const getMediaRatings = asyncHandler(
  async (req: Request, res: Response) => {
    const { mediaId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await ratingsService.getMediaRatings(mediaId, page, limit);

    sendSuccess(
      res,
      result.ratings,
      "Media ratings retrieved successfully",
      200,
      { pagination: result.pagination }
    );
  }
);

export const getUserMediaRating = asyncHandler(
  async (req: Request, res: Response) => {
    const { mediaId } = req.params;
    const userId = req.user!.id;

    const rating = await ratingsService.getUserMediaRating(userId, mediaId);

    sendSuccess(res, rating, "User media rating retrieved successfully");
  }
);
