import { Request, Response, NextFunction } from "express";
import reviewService from "./review.service";
import asyncHandler from "../../utils/asyncHandler";
import {
  sendSuccess,
  createPagination,
  sendError,
} from "../../utils/responseFormatter";
import { Role } from "@prisma/client";

export class ReviewController {
  /**
   * Create a new review
   */
  createReview = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const { mediaId, content, isVisible, containsSpoilers } = req.body;
      const userId = req.user!.id;

      const review = await reviewService.createReview({
        userId,
        mediaId,
        content,
        isVisible,
        containsSpoilers,
      });

      sendSuccess(res, review, "Review created successfully", 201);
    }
  );

  /**
   * Get reviews for a specific media
   */
  getMediaReviews = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      // TODO: Implement filter by time, containsSpoilers, etc.

      const mediaId = req.params.mediaId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      // Only moderators and admins can see hidden reviews
      const includeHidden =
        req.user &&
        (req.user.role === Role.ADMIN || req.user.role === Role.MODERATOR);

      const { reviews, total } = await reviewService.getMediaReviews(
        mediaId,
        page,
        limit,
        includeHidden
      );

      const pagination = createPagination(page, limit, total);

      sendSuccess(
        res,
        reviews,
        "Media reviews retrieved successfully",
        200,
        pagination
      );
    }
  );

  /**
   * Get reviews by a specific user
   */
  getUserReviews = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.params.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      // Pass the requesting user's ID to determine if hidden reviews should be included
      const requestingUserId = req.user?.id;

      const { reviews, total } = await reviewService.getUserReviews(
        userId,
        page,
        limit,
        requestingUserId
      );

      const pagination = createPagination(page, limit, total);

      sendSuccess(
        res,
        reviews,
        "User reviews retrieved successfully",
        200,
        pagination
      );
    }
  );

  /**
   * Get a single review by ID
   */
  getReviewById = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const reviewId = req.params.id;
      const review = await reviewService.getReviewById(reviewId);

      sendSuccess(res, review, "Review retrieved successfully");
    }
  );

  /**
   * Get a user's review for a specific media
   */
  getUserMediaReview = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const mediaId = req.params.mediaId;
      const userId = req.user!.id;
      const review = await reviewService.getUserMediaReview(userId, mediaId);

      sendSuccess(res, review, "User media review retrieved successfully");
    }
  );

  /**
   * Update a review
   */
  updateReview = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const reviewId = req.params.id;
      const { content, isVisible, containsSpoilers } = req.body;
      const userId = req.user!.id;
      const userRole = req.user!.role as Role;

      const updatedReview = await reviewService.updateReview(
        reviewId,
        userId,
        { content, isVisible, containsSpoilers },
        userRole
      );

      sendSuccess(res, updatedReview, "Review updated successfully");
    }
  );

  /**
   * Delete a review
   */
  deleteReview = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const reviewId = req.params.id;
      const userId = req.user!.id;
      const userRole = req.user!.role as Role;

      await reviewService.deleteReview(reviewId, userId, userRole);

      sendSuccess(res, null, "Review deleted successfully");
    }
  );

  /**
   * Like a review
   */
  likeReview = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const reviewId = req.params.id;
      const updatedReview = await reviewService.likeReview(reviewId);

      sendSuccess(res, updatedReview, "Review liked successfully");
    }
  );

  /**
   * Unlike a review
   */
  unlikeReview = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const reviewId = req.params.id;
      const updatedReview = await reviewService.unlikeReview(reviewId);

      sendSuccess(res, updatedReview, "Review liked successfully");
    }
  );
}

export default new ReviewController();
