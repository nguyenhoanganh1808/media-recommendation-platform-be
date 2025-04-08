// src/api/recommendations/recommendations.service.ts
import { MediaType, Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError } from "../../middlewares/error.middleware";

interface RecommendationOptions {
  userId: string;
  limit?: number;
  page?: number;
  mediaType?: MediaType;
  includeRated?: boolean;
}

interface MediaBasedRecommendationOptions {
  userId: string;
  mediaId: string;
  limit?: number;
}

interface UserPreference {
  genreId?: string;
  mediaTypePreference?: MediaType;
  preferenceStrength: number;
}

export class RecommendationService {
  /**
   * Get personalized recommendations for a user
   */
  async getRecommendationsForUser({
    userId,
    limit = 10,
    page = 1,
    mediaType,
    includeRated = false,
  }: RecommendationOptions) {
    // Calculate offset for pagination
    const skip = (page - 1) * limit;

    // Get user's ratings to understand preferences
    const userRatings = await prisma.mediaRating.findMany({
      where: { userId },
      include: {
        media: {
          include: {
            genres: {
              include: {
                genre: true,
              },
            },
          },
        },
      },
    });

    // Get user's explicit preferences
    const userPreferences = await prisma.userPreference.findMany({
      where: { userId },
    });

    // Build preference profile (favorite genres, media types)
    const genreScores = this.calculateGenreScores(userRatings, userPreferences);
    const mediaTypePreferences = this.getMediaTypePreferences(userPreferences);

    // Skip media that user has already rated
    const ratedMediaIds = includeRated
      ? []
      : userRatings.map((rating) => rating.mediaId);

    // Build the where clause for the query
    const whereClause: Prisma.MediaWhereInput = {
      id: includeRated ? undefined : { notIn: ratedMediaIds },
      mediaType: mediaType ? mediaType : undefined,
    };

    // Get total count for pagination
    const totalCount = await prisma.media.count({ where: whereClause });

    // Get media recommendations
    const recommendations = await prisma.media.findMany({
      where: whereClause,
      take: limit,
      skip,
      orderBy: [{ popularity: "desc" }, { averageRating: "desc" }],
      include: {
        genres: {
          include: {
            genre: true,
          },
        },
      },
    });

    // Score and rank recommendations based on user preferences
    const scoredRecommendations = recommendations.map((media) => {
      const score = this.calculateRecommendationScore(
        media,
        genreScores,
        mediaTypePreferences
      );

      return {
        media,
        score,
      };
    });

    // Sort by recommendation score
    scoredRecommendations.sort((a, b) => b.score - a.score);

    return {
      recommendations: scoredRecommendations.map((item) => item.media),
      totalCount,
      page,
      limit,
    };
  }

  /**
   * Get recommendations based on a specific media item
   */
  async getMediaBasedRecommendations({
    userId,
    mediaId,
    limit = 10,
  }: MediaBasedRecommendationOptions) {
    // Get the source media
    const sourceMedia = await prisma.media.findUnique({
      where: { id: mediaId },
      include: {
        genres: {
          include: {
            genre: true,
          },
        },
      },
    });

    if (!sourceMedia) {
      throw new AppError("Media not found", 404);
    }

    // Get user's ratings to exclude already rated media
    const userRatings = await prisma.mediaRating.findMany({
      where: { userId },
      select: { mediaId: true },
    });

    const ratedMediaIds = userRatings.map((rating) => rating.mediaId);

    // Find media with similar genres
    const sourceGenreIds = sourceMedia.genres.map((g) => g.genreId);

    // Get recommendations
    const recommendations = await prisma.media.findMany({
      where: {
        id: { not: mediaId, notIn: ratedMediaIds },
        mediaType: sourceMedia.mediaType,
        genres: {
          some: {
            genreId: { in: sourceGenreIds },
          },
        },
      },
      take: limit,
      orderBy: [{ popularity: "desc" }, { averageRating: "desc" }],
      include: {
        genres: {
          include: {
            genre: true,
          },
        },
      },
    });

    // Score recommendations by genre similarity
    const scoredRecommendations = recommendations.map((media) => {
      const genreSimilarity = this.calculateGenreSimilarity(
        sourceMedia.genres.map((g) => g.genreId),
        media.genres.map((g) => g.genreId)
      );

      return {
        media,
        score: genreSimilarity,
      };
    });

    // Sort by similarity score
    scoredRecommendations.sort((a, b) => b.score - a.score);

    return scoredRecommendations.map((item) => item.media);
  }

  /**
   * Update user's recommendation preferences
   */
  async updateUserPreferences(
    userId: string,
    genreIds: string[] = [],
    mediaTypePreferences: { type: MediaType; strength: number }[] = []
  ) {
    // First, delete existing preferences
    await prisma.userPreference.deleteMany({
      where: { userId },
    });

    // Create genre preferences
    const genrePreferences = genreIds.map((genreId) => ({
      userId,
      genreId,
      preferenceStrength: 1.0, // Default strength
    }));

    // Create media type preferences
    const typePreferences = mediaTypePreferences.map((pref) => ({
      userId,
      mediaTypePreference: pref.type,
      preferenceStrength: pref.strength,
    }));

    // Create all preferences
    await prisma.userPreference.createMany({
      data: [...genrePreferences, ...typePreferences],
    });

    // Return updated preferences
    return prisma.userPreference.findMany({
      where: { userId },
    });
  }

  /**
   * Get trending media recommendations
   */
  async getTrendingRecommendations(
    mediaType?: MediaType,
    limit: number = 10,
    page: number = 1
  ) {
    const skip = (page - 1) * limit;

    const whereClause: Prisma.MediaWhereInput = {
      mediaType: mediaType ? mediaType : undefined,
    };

    const totalCount = await prisma.media.count({ where: whereClause });

    const trending = await prisma.media.findMany({
      where: whereClause,
      take: limit,
      skip,
      orderBy: [{ popularity: "desc" }, { averageRating: "desc" }],
      include: {
        genres: {
          include: {
            genre: true,
          },
        },
      },
    });

    return {
      recommendations: trending,
      totalCount,
      page,
      limit,
    };
  }

  // Helper methods for recommendation algorithm
  private calculateGenreScores(userRatings: any[], userPreferences: any[]) {
    const genreScores: Record<string, number> = {};

    // Consider user's ratings
    userRatings.forEach((rating) => {
      rating.media.genres.forEach((genreItem: any) => {
        const genreId = genreItem.genre.id;

        if (!genreScores[genreId]) {
          genreScores[genreId] = 0;
        }

        // Higher ratings give more weight to genres
        genreScores[genreId] += rating.rating / 10;
      });
    });

    // Consider explicit user preferences
    userPreferences
      .filter((pref) => pref.genreId)
      .forEach((pref) => {
        if (!genreScores[pref.genreId!]) {
          genreScores[pref.genreId!] = 0;
        }

        // Explicit preferences have higher weight
        genreScores[pref.genreId!] += pref.preferenceStrength * 2;
      });

    return genreScores;
  }

  private getMediaTypePreferences(userPreferences: any[]) {
    const mediaTypePrefs: Record<string, number> = {};

    userPreferences
      .filter((pref) => pref.mediaTypePreference)
      .forEach((pref) => {
        mediaTypePrefs[pref.mediaTypePreference as string] =
          pref.preferenceStrength;
      });

    return mediaTypePrefs;
  }

  private calculateRecommendationScore(
    media: any,
    genreScores: Record<string, number>,
    mediaTypePreferences: Record<string, number>
  ) {
    let score = 0;

    // Base score from media popularity and rating
    score += media.popularity * 0.3 + media.averageRating * 0.3;

    // Add genre preference score
    media.genres.forEach((genreItem: any) => {
      const genreId = genreItem.genre.id;
      if (genreScores[genreId]) {
        score += genreScores[genreId] * 0.3;
      }
    });

    // Add media type preference score
    if (mediaTypePreferences[media.mediaType]) {
      score += mediaTypePreferences[media.mediaType] * 0.2;
    }

    return score;
  }

  private calculateGenreSimilarity(
    sourceGenres: string[],
    targetGenres: string[]
  ) {
    // Count matching genres
    const matchingGenres = sourceGenres.filter((g) => targetGenres.includes(g));

    // Calculate Jacquard similarity (intersection over union)
    const union = new Set([...sourceGenres, ...targetGenres]);
    return matchingGenres.length / union.size;
  }
}

export default new RecommendationService();
