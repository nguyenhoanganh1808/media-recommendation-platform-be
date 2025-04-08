import { PrismaClient, MediaType, Prisma } from "@prisma/client";
import { AppError } from "../middlewares/error.middleware";

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

interface UserPreferenceUpdate {
  genreIds?: string[];
  mediaTypePreferences?: Array<{
    type: MediaType;
    strength: number;
  }>;
}

export class RecommendationService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  /**
   * Generate personalized recommendations for a user
   */
  async generateRecommendationsForUser({
    userId,
    limit = 10,
    page = 1,
    mediaType,
    includeRated = false,
  }: RecommendationOptions) {
    // Validate user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Get user's ratings and preferences
    const [userRatings, userPreferences] = await Promise.all([
      this.prisma.mediaRating.findMany({
        where: { userId },
        include: {
          media: {
            include: { genres: { include: { genre: true } } },
          },
        },
      }),
      this.prisma.userPreference.findMany({ where: { userId } }),
    ]);

    // Calculate preference scores
    const genreScores = this.calculateGenreScores(userRatings, userPreferences);
    const mediaTypePreferences = this.getMediaTypePreferences(userPreferences);

    // Exclude already rated media if not including rated
    const ratedMediaIds = includeRated
      ? []
      : userRatings.map((rating) => rating.mediaId);

    // Construct query conditions
    const whereClause: Prisma.MediaWhereInput = {
      id: { notIn: ratedMediaIds },
      mediaType: mediaType || undefined,
    };

    // Fetch recommendations with pagination
    const [totalCount, recommendations] = await Promise.all([
      this.prisma.media.count({ where: whereClause }),
      this.prisma.media.findMany({
        where: whereClause,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: [{ popularity: "desc" }, { averageRating: "desc" }],
        include: {
          genres: { include: { genre: true } },
        },
      }),
    ]);

    // Score and rank recommendations
    const scoredRecommendations = recommendations
      .map((media) => ({
        media,
        score: this.calculateRecommendationScore(
          media,
          genreScores,
          mediaTypePreferences
        ),
      }))
      .sort((a, b) => b.score - a.score);

    return {
      recommendations: scoredRecommendations.map((item) => item.media),
      totalCount,
      page,
      limit,
    };
  }

  /**
   * Get media recommendations based on a specific media item
   */
  async getMediaBasedRecommendations({
    userId,
    mediaId,
    limit = 10,
  }: MediaBasedRecommendationOptions) {
    // Validate source media exists
    const sourceMedia = await this.prisma.media.findUnique({
      where: { id: mediaId },
      include: {
        genres: { include: { genre: true } },
      },
    });

    if (!sourceMedia) {
      throw new AppError("Media not found", 404);
    }

    // Get user's rated media to exclude
    const userRatings = await this.prisma.mediaRating.findMany({
      where: { userId },
      select: { mediaId: true },
    });
    const ratedMediaIds = userRatings.map((rating) => rating.mediaId);

    // Find similar media by genre
    const sourceGenreIds = sourceMedia.genres.map((g) => g.genreId);
    const recommendations = await this.prisma.media.findMany({
      where: {
        id: {
          not: mediaId,
          notIn: ratedMediaIds,
        },
        mediaType: sourceMedia.mediaType,
        genres: {
          some: { genreId: { in: sourceGenreIds } },
        },
      },
      take: limit,
      orderBy: [{ popularity: "desc" }, { averageRating: "desc" }],
      include: {
        genres: { include: { genre: true } },
      },
    });

    // Score recommendations by genre similarity
    return recommendations
      .map((media) => ({
        media,
        score: this.calculateGenreSimilarity(
          sourceMedia.genres.map((g) => g.genreId),
          media.genres.map((g) => g.genreId)
        ),
      }))
      .sort((a, b) => b.score - a.score)
      .map((item) => item.media);
  }

  /**
   * Update user's recommendation preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: UserPreferenceUpdate
  ) {
    // Validate user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Transaction to update preferences
    return this.prisma.$transaction(async (tx) => {
      // Remove existing preferences
      await tx.userPreference.deleteMany({ where: { userId } });

      // Prepare genre preferences
      const genrePreferences = (preferences.genreIds || []).map((genreId) => ({
        userId,
        genreId,
        preferenceStrength: 1.0,
      }));

      // Prepare media type preferences
      const typePreferences = (preferences.mediaTypePreferences || []).map(
        (pref) => ({
          userId,
          mediaTypePreference: pref.type,
          preferenceStrength: pref.strength,
        })
      );

      // Create new preferences
      await tx.userPreference.createMany({
        data: [...genrePreferences, ...typePreferences],
      });

      // Return updated preferences
      return tx.userPreference.findMany({ where: { userId } });
    });
  }

  /**
   * Get trending recommendations
   */
  async getTrendingRecommendations(
    mediaType?: MediaType,
    limit = 10,
    page = 1
  ) {
    const whereClause: Prisma.MediaWhereInput = {
      mediaType: mediaType || undefined,
    };

    const [totalCount, trending] = await Promise.all([
      this.prisma.media.count({ where: whereClause }),
      this.prisma.media.findMany({
        where: whereClause,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: [{ popularity: "desc" }, { averageRating: "desc" }],
        include: {
          genres: { include: { genre: true } },
        },
      }),
    ]);

    return {
      recommendations: trending,
      totalCount,
      page,
      limit,
    };
  }

  // Private helper methods (implementation similar to previous code)
  private calculateGenreScores(userRatings: any[], userPreferences: any[]) {
    const genreScores: Record<string, number> = {};

    // Score genres from user ratings
    userRatings.forEach((rating) => {
      rating.media.genres.forEach((genreItem: any) => {
        const genreId = genreItem.genre.id;
        genreScores[genreId] = (genreScores[genreId] || 0) + rating.rating / 10;
      });
    });

    // Boost scores from explicit preferences
    userPreferences
      .filter((pref) => pref.genreId)
      .forEach((pref) => {
        genreScores[pref.genreId] =
          (genreScores[pref.genreId] || 0) + pref.preferenceStrength * 2;
      });

    return genreScores;
  }

  private getMediaTypePreferences(userPreferences: any[]) {
    return userPreferences
      .filter((pref) => pref.mediaTypePreference)
      .reduce(
        (acc, pref) => {
          acc[pref.mediaTypePreference] = pref.preferenceStrength;
          return acc;
        },
        {} as Record<string, number>
      );
  }

  private calculateRecommendationScore(
    media: any,
    genreScores: Record<string, number>,
    mediaTypePreferences: Record<string, number>
  ) {
    let score = 0;

    // Base score from popularity and rating
    score += media.popularity * 0.3 + media.averageRating * 0.3;

    // Genre preference score
    media.genres.forEach((genreItem: any) => {
      const genreId = genreItem.genre.id;
      score += (genreScores[genreId] || 0) * 0.3;
    });

    // Media type preference score
    score += (mediaTypePreferences[media.mediaType] || 0) * 0.2;

    return score;
  }

  private calculateGenreSimilarity(
    sourceGenres: string[],
    targetGenres: string[]
  ) {
    const matchingGenres = sourceGenres.filter((g) => targetGenres.includes(g));
    const union = new Set([...sourceGenres, ...targetGenres]);
    return matchingGenres.length / union.size;
  }
}

export default new RecommendationService();
