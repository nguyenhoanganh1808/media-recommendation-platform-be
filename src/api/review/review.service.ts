// packages/backend/src/services/review.service.ts

import { prisma } from "../../config/database";
import { MediaReview, Role } from "@prisma/client";
import { AppError } from "../../middlewares/error.middleware";
import { clearCacheByPattern } from "../../middlewares/cache.middleware";

interface CreateReviewData {
  userId: string;
  mediaId: string;
  content: string;
  isVisible?: boolean;
  containsSpoilers?: boolean;
}

interface UpdateReviewData {
  content?: string;
  isVisible?: boolean;
  containsSpoilers?: boolean;
}

export class ReviewService {
  /**
   * Create a new media review
   */
  async createReview(data: CreateReviewData): Promise<MediaReview> {
    // Check if user has already reviewed this media
    const existingReview = await prisma.mediaReview.findFirst({
      where: {
        userId: data.userId,
        mediaId: data.mediaId,
      },
    });

    if (existingReview) {
      throw new AppError(
        "You have already reviewed this media",
        409,
        "REVIEW_EXISTS"
      );
    }

    // Check if media exists
    const media = await prisma.media.findUnique({
      where: { id: data.mediaId },
    });

    if (!media) {
      throw new AppError("Media not found", 404, "MEDIA_NOT_FOUND");
    }

    // Create the review
    const review = await prisma.mediaReview.create({
      data: {
        userId: data.userId,
        mediaId: data.mediaId,
        content: data.content,
        isVisible: data.isVisible !== undefined ? data.isVisible : true,
        containsSpoilers: data.containsSpoilers,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Clear cache for this media's reviews
    await clearCacheByPattern(`reviews:media:${data.mediaId}`);

    return review;
  }

  /**
   * Get reviews for a specific media
   */
  async getMediaReviews(
    mediaId: string,
    page: number = 1,
    limit: number = 10,
    includeHidden: boolean = false
  ): Promise<{ reviews: MediaReview[]; total: number }> {
    const skip = (page - 1) * limit;

    const whereClause = {
      mediaId,
      ...(includeHidden ? {} : { isVisible: true }),
    };

    const [reviews, total] = await Promise.all([
      prisma.mediaReview.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: [{ likesCount: "desc" }, { createdAt: "desc" }],
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              avatar: true,
            },
          },
        },
      }),
      prisma.mediaReview.count({
        where: whereClause,
      }),
    ]);

    return { reviews, total };
  }

  /**
   * Get reviews by a specific user
   */
  async getUserMediaReview(
    userId: string,
    mediaId: string
  ): Promise<MediaReview | null> {
    const review = await prisma.mediaReview.findFirst({
      where: {
        userId,
        mediaId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastLogin: true,
            username: true,
            avatar: true,
          },
        },
        media: {
          select: {
            id: true,
            title: true,
            mediaType: true,
            coverImage: true,
          },
        },
      },
    });
    if (!review) {
      throw new AppError("Review not found", 404, "REVIEW_NOT_FOUND");
    }
    return review;
  }

  /**
   * Get reviews by a specific user
   */
  async getUserReviews(
    userId: string,
    page: number = 1,
    limit: number = 10,
    requestingUserId?: string
  ): Promise<{ reviews: MediaReview[]; total: number }> {
    const skip = (page - 1) * limit;

    // Check if the requesting user is the same as the target user
    // or if the requesting user is a moderator/admin
    const includeHidden = requestingUserId === userId;

    const whereClause = {
      userId,
      ...(includeHidden ? {} : { isVisible: true }),
    };

    const [reviews, total] = await Promise.all([
      prisma.mediaReview.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          media: {
            select: {
              id: true,
              title: true,
              mediaType: true,
              coverImage: true,
            },
          },
        },
      }),
      prisma.mediaReview.count({
        where: whereClause,
      }),
    ]);

    return { reviews, total };
  }

  /**
   * Get a single review by ID
   */
  async getReviewById(reviewId: string): Promise<MediaReview | null> {
    const review = await prisma.mediaReview.findUnique({
      where: { id: reviewId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        media: {
          select: {
            id: true,
            title: true,
            mediaType: true,
            coverImage: true,
          },
        },
      },
    });

    if (!review) {
      throw new AppError("Review not found", 404, "REVIEW_NOT_FOUND");
    }

    return review;
  }

  /**
   * Update a review
   */
  async updateReview(
    reviewId: string,
    userId: string,
    data: UpdateReviewData,
    userRole: Role
  ): Promise<MediaReview> {
    // Get the review
    const review = await prisma.mediaReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new AppError("Review not found", 404, "REVIEW_NOT_FOUND");
    }

    // Check if user owns the review or is a moderator/admin
    if (
      review.userId !== userId &&
      userRole !== Role.ADMIN &&
      userRole !== Role.MODERATOR
    ) {
      throw new AppError(
        "You do not have permission to update this review",
        403,
        "PERMISSION_DENIED"
      );
    }

    // Update the review
    const updatedReview = await prisma.mediaReview.update({
      where: { id: reviewId },
      data,
    });

    // Clear cache for this media's reviews
    await clearCacheByPattern(`reviews:media:${review.mediaId}`);
    await clearCacheByPattern(`reviews:user:${review.userId}`);

    return updatedReview;
  }

  /**
   * Delete a review
   */
  async deleteReview(
    reviewId: string,
    userId: string,
    userRole: Role
  ): Promise<void> {
    // Get the review
    const review = await prisma.mediaReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new AppError("Review not found", 404, "REVIEW_NOT_FOUND");
    }

    // Delete the review
    await prisma.mediaReview.delete({
      where: { id: reviewId },
    });

    // Clear cache for this media's reviews
    await clearCacheByPattern(`reviews:media:${review.mediaId}`);
    await clearCacheByPattern(`reviews:user:${review.userId}`);
  }

  /**
   * Like a review (increment the likes count)
   */
  async likeReview(reviewId: string): Promise<MediaReview> {
    // Check if review exists
    const review = await prisma.mediaReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new AppError("Review not found", 404, "REVIEW_NOT_FOUND");
    }

    // Increment the likes count
    const updatedReview = await prisma.mediaReview.update({
      where: { id: reviewId },
      data: {
        likesCount: { increment: 1 },
      },
    });

    // Create notification for the review author
    await prisma.notification.create({
      data: {
        userId: review.userId,
        type: "NEW_RATING",
        title: "Your review received a like",
        message: "Someone liked your review!",
        data: { reviewId },
      },
    });

    return updatedReview;
  }

  /**
   * Like a review (increment the likes count)
   */
  async unlikeReview(reviewId: string): Promise<MediaReview> {
    // Check if review exists
    const review = await prisma.mediaReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new AppError("Review not found", 404, "REVIEW_NOT_FOUND");
    }

    // Increment the likes count
    const updatedReview = await prisma.mediaReview.update({
      where: { id: reviewId },
      data: {
        likesCount: { decrement: 1 },
      },
    });

    return updatedReview;
  }
}

export default new ReviewService();
