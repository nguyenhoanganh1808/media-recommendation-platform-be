// src/api/ratings/ratings.service.ts
import { prisma } from "../../config/database";
import { MediaRating } from "@prisma/client";
import { AppError } from "../../middlewares/error.middleware";
import { clearCacheByPattern } from "../../middlewares/cache.middleware";
import { createPagination } from "../../utils/responseFormatter";
import { logger } from "../../config/logger";

/**
 * Create a new media rating
 */
export const createRating = async (
  userId: string,
  mediaId: string,
  rating: number,
  review?: string
): Promise<MediaRating> => {
  // Check if media exists
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
  });

  if (!media) {
    throw new AppError("Media not found", 404, "MEDIA_NOT_FOUND");
  }

  // Check if user has already rated this media
  const existingRating = await prisma.mediaRating.findUnique({
    where: {
      userId_mediaId: {
        userId,
        mediaId,
      },
    },
  });

  if (existingRating) {
    throw new AppError(
      "You have already rated this media. Please update your rating instead.",
      409,
      "RATING_EXISTS"
    );
  }

  // Create the rating in a transaction to ensure atomicity
  const newRating = await prisma.$transaction(async (tx) => {
    // Create the rating
    const mediaRating = await tx.mediaRating.create({
      data: {
        userId,
        mediaId,
        rating,
      },
    });

    // Update media average rating and count
    const allRatings = await tx.mediaRating.findMany({
      where: { mediaId },
      select: { rating: true },
    });

    const ratingsCount = allRatings.length;
    const averageRating =
      allRatings.reduce((sum, r) => sum + r.rating, 0) / ratingsCount;

    // Update media with new statistics
    await tx.media.update({
      where: { id: mediaId },
      data: {
        averageRating,
        ratingsCount,
      },
    });

    return mediaRating;
  });

  // Clear cache for this media and user ratings
  await clearCacheByPattern(`media:${mediaId}`);
  await clearCacheByPattern(`user:${userId}:/api/ratings`);

  return newRating;
};

/**
 * Update an existing rating
 */
export const updateRating = async (
  ratingId: string,
  userId: string,
  rating: number
): Promise<MediaRating> => {
  // Check if rating exists and belongs to user
  const existingRating = await prisma.mediaRating.findUnique({
    where: { id: ratingId },
  });

  if (!existingRating) {
    throw new AppError("Rating not found", 404, "RATING_NOT_FOUND");
  }

  if (existingRating.userId !== userId) {
    throw new AppError(
      "You can only update your own ratings",
      403,
      "UNAUTHORIZED"
    );
  }

  // Update the rating in a transaction to ensure atomicity
  const updatedRating = await prisma.$transaction(async (tx) => {
    // Update the rating
    const mediaRating = await tx.mediaRating.update({
      where: { id: ratingId },
      data: { rating },
    });

    const { mediaId } = mediaRating;

    // Update media average rating
    const allRatings = await tx.mediaRating.findMany({
      where: { mediaId },
      select: { rating: true },
    });

    const ratingsCount = allRatings.length;
    const averageRating =
      allRatings.reduce((sum, r) => sum + r.rating, 0) / ratingsCount;

    // Update media with new statistics
    await tx.media.update({
      where: { id: mediaId },
      data: {
        averageRating,
        ratingsCount,
      },
    });

    return mediaRating;
  });

  // Clear cache for this media and user ratings
  await clearCacheByPattern(`media:${updatedRating.mediaId}`);
  await clearCacheByPattern(`user:${userId}:/api/ratings`);

  return updatedRating;
};

/**
 * Delete a rating
 */
export const deleteRating = async (
  ratingId: string,
  userId: string
): Promise<void> => {
  // Check if rating exists and belongs to user
  const existingRating = await prisma.mediaRating.findUnique({
    where: { id: ratingId },
  });

  if (!existingRating) {
    throw new AppError("Rating not found", 404, "RATING_NOT_FOUND");
  }

  // Delete the rating in a transaction to maintain consistency
  await prisma.$transaction(async (tx) => {
    const { mediaId } = existingRating;

    // Delete the rating
    await tx.mediaRating.delete({
      where: { id: ratingId },
    });

    // Get all remaining ratings for this media
    const allRatings = await tx.mediaRating.findMany({
      where: { mediaId },
      select: { rating: true },
    });

    const ratingsCount = allRatings.length;
    const averageRating = ratingsCount
      ? allRatings.reduce((sum, r) => sum + r.rating, 0) / ratingsCount
      : 0;

    // Update media with new statistics
    await tx.media.update({
      where: { id: mediaId },
      data: {
        averageRating,
        ratingsCount,
      },
    });
  });

  // Clear cache for this media and user ratings
  await clearCacheByPattern(`media:${existingRating.mediaId}`);
  await clearCacheByPattern(`user:${userId}:/api/ratings`);
};

/**
 * Get a specific rating by ID
 */
export const getRatingById = async (ratingId: string): Promise<MediaRating> => {
  const rating = await prisma.mediaRating.findUnique({
    where: { id: ratingId },
  });

  if (!rating) {
    throw new AppError("Rating not found", 404, "RATING_NOT_FOUND");
  }

  return rating;
};

/**
 * Get a user's rating for a specific media
 */
export const getUserMediaRating = async (
  userId: string,
  mediaId: string
): Promise<MediaRating | null> => {
  // Check if media exists
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
  });
  if (!media) {
    throw new AppError("Media not found", 404, "MEDIA_NOT_FOUND");
  }

  const rating = await prisma.mediaRating.findUnique({
    where: {
      userId_mediaId: {
        userId,
        mediaId,
      },
    },
  });

  return rating;
};

/**
 * Get all ratings for a specific media with pagination
 */
export const getMediaRatings = async (
  mediaId: string,
  page: number = 1,
  limit: number = 10
): Promise<{ ratings: MediaRating[]; pagination: any }> => {
  const skip = (page - 1) * limit;

  const [ratings, total] = await Promise.all([
    prisma.mediaRating.findMany({
      where: { mediaId },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    }),
    prisma.mediaRating.count({
      where: { mediaId },
    }),
  ]);

  const pagination = createPagination(page, limit, total);

  return { ratings, pagination };
};

/**
 * Get all ratings by a specific user with pagination
 */
export const getUserRatings = async (
  userId: string,
  page: number = 1,
  limit: number = 10,
  mediaId?: string
): Promise<{ ratings: MediaRating[]; pagination: any }> => {
  const skip = (page - 1) * limit;

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  const whereClause: any = { userId };
  if (mediaId) {
    whereClause.mediaId = mediaId;
  }

  const [ratings, total] = await Promise.all([
    prisma.mediaRating.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        media: {
          select: {
            id: true,
            title: true,
            coverImage: true,
            mediaType: true,
            averageRating: true,
          },
        },
      },
    }),
    prisma.mediaRating.count({
      where: whereClause,
    }),
  ]);

  const pagination = createPagination(page, limit, total);

  return { ratings, pagination };
};
