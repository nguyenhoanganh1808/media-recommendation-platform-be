// src/api/recommendations/recommendations.controller.ts
import { Request, Response, NextFunction } from 'express';
import asyncHandler from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseFormatter';
import recommendationService from './recommendations.service';
import { AppError } from '../../middlewares/error.middleware';
import { MediaType } from '@prisma/client';
import { createPagination } from '../../utils/responseFormatter';

export const getRecommendations = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const mediaType = req.query.mediaType as MediaType | undefined;
    const includeRated = req.query.includeRated === 'true';

    const result = await recommendationService.getRecommendationsForUser({
      userId: req.user.id,
      limit,
      page,
      mediaType,
      includeRated,
    });

    const meta = createPagination(result.page, result.limit, result.totalCount);

    return sendSuccess(
      res,
      result.recommendations,
      'Recommendations retrieved successfully',
      200,
      meta
    );
  }
);

export const getMediaBasedRecommendations = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const { mediaId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    const recommendations =
      await recommendationService.getMediaBasedRecommendations({
        userId: req.user.id,
        mediaId,
        limit,
      });

    return sendSuccess(
      res,
      recommendations,
      'Media-based recommendations retrieved successfully'
    );
  }
);

export const getTrendingRecommendations = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const mediaType = req.query.mediaType as MediaType | undefined;

    const result = await recommendationService.getTrendingRecommendations(
      mediaType,
      limit,
      page
    );

    const meta = createPagination(result.page, result.limit, result.totalCount);

    return sendSuccess(
      res,
      result.recommendations,
      'Trending recommendations retrieved successfully',
      200,
      meta
    );
  }
);

export const updateUserPreferences = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.params;
    const { genreIds, mediaTypePreferences } = req.body;

    // Call service to update preferences
    const updatedPreferences =
      await recommendationService.updateUserPreferences(
        userId,
        genreIds || [],
        mediaTypePreferences || []
      );

    sendSuccess(
      res,
      updatedPreferences,
      'User preferences updated successfully',
      200
    );
  }
);
