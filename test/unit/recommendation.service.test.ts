// tests/unit/api/recommendations/recommendations.service.test.ts
import { MediaType } from '@prisma/client';
import { RecommendationService } from '../../src/api/recommendations/recommendations.service';
import { prisma } from '../../src/config/database';
import { AppError } from '../../src/middlewares/error.middleware';

// Mock Prisma client
jest.mock('../../src/config/database', () => ({
  prisma: {
    media: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    mediaRating: {
      findMany: jest.fn(),
    },
    userPreference: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
  },
}));

describe('RecommendationService', () => {
  let recommendationService: RecommendationService;

  beforeEach(() => {
    recommendationService = new RecommendationService();
    jest.clearAllMocks();
  });

  describe('getRecommendationsForUser', () => {
    it('should return recommendations based on user preferences', async () => {
      // Mock user ratings
      const mockRatings = [
        {
          mediaId: 'media1',
          rating: 9,
          media: {
            genres: [
              { genreId: 'genre1', genre: { id: 'genre1', name: 'Action' } },
              { genreId: 'genre2', genre: { id: 'genre2', name: 'Adventure' } },
            ],
          },
        },
      ];

      // Mock user preferences
      const mockPreferences = [
        { userId: 'user1', genreId: 'genre1', preferenceStrength: 0.8 },
        {
          userId: 'user1',
          mediaTypePreference: 'MOVIE',
          preferenceStrength: 0.9,
        },
      ];

      // Mock recommendations
      const mockRecommendations = [
        {
          id: 'rec1',
          title: 'Recommendation 1',
          mediaType: 'MOVIE',
          popularity: 0.9,
          averageRating: 8.5,
          genres: [
            { genreId: 'genre1', genre: { id: 'genre1', name: 'Action' } },
          ],
        },
        {
          id: 'rec2',
          title: 'Recommendation 2',
          mediaType: 'GAME',
          popularity: 0.8,
          averageRating: 9.0,
          genres: [
            { genreId: 'genre2', genre: { id: 'genre2', name: 'Adventure' } },
          ],
        },
      ];

      // Setup mocks
      (prisma.mediaRating.findMany as jest.Mock).mockResolvedValue(mockRatings);
      (prisma.userPreference.findMany as jest.Mock).mockResolvedValue(
        mockPreferences
      );
      (prisma.media.count as jest.Mock).mockResolvedValue(2);
      (prisma.media.findMany as jest.Mock).mockResolvedValue(
        mockRecommendations
      );

      // Call the function
      const result = await recommendationService.getRecommendationsForUser({
        userId: 'user1',
        limit: 10,
        page: 1,
        mediaType: MediaType.MOVIE,
        includeRated: false,
      });

      // Verify the result
      expect(result).toHaveProperty('recommendations');
      expect(result.recommendations).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);

      // Verify the order (should be sorted by score, which depends on genre match and media type preference)
      // Action movie should rank higher due to user preferences
      expect(result.recommendations[0].id).toBe('rec1');
    });

    it('should handle pagination correctly', async () => {
      // Setup mocks with minimal data
      (prisma.mediaRating.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.userPreference.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.media.count as jest.Mock).mockResolvedValue(30);
      (prisma.media.findMany as jest.Mock).mockResolvedValue([]);

      // Test with page 2, limit 10
      const result = await recommendationService.getRecommendationsForUser({
        userId: 'user1',
        limit: 10,
        page: 2,
      });

      // Verify pagination params
      expect(prisma.media.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (page - 1) * limit
          take: 10,
        })
      );

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalCount).toBe(30);
    });

    it('should respect includeRated parameter', async () => {
      // Mock user has rated media1
      const mockRatings = [
        { mediaId: 'media1', rating: 8, media: { genres: [] } },
      ];

      (prisma.mediaRating.findMany as jest.Mock).mockResolvedValue(mockRatings);
      (prisma.userPreference.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.media.count as jest.Mock).mockResolvedValue(5);
      (prisma.media.findMany as jest.Mock).mockResolvedValue([]);

      // Test with includeRated = false (default)
      await recommendationService.getRecommendationsForUser({
        userId: 'user1',
        includeRated: false,
      });

      // Should exclude rated media
      expect(prisma.media.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { notIn: ['media1'] },
          }),
        })
      );

      // Reset mocks
      jest.clearAllMocks();
      (prisma.mediaRating.findMany as jest.Mock).mockResolvedValue(mockRatings);
      (prisma.userPreference.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.media.count as jest.Mock).mockResolvedValue(5);
      (prisma.media.findMany as jest.Mock).mockResolvedValue([]);

      // Test with includeRated = true
      await recommendationService.getRecommendationsForUser({
        userId: 'user1',
        includeRated: true,
      });

      // Should not exclude rated media
      expect(prisma.media.findMany).toHaveBeenCalledWith(
        expect.not.objectContaining({
          where: expect.objectContaining({
            id: { notIn: ['media1'] },
          }),
        })
      );
    });
  });

  describe('getMediaBasedRecommendations', () => {
    it('should return similar media recommendations', async () => {
      // Mock source media
      const mockSourceMedia = {
        id: 'media1',
        title: 'Source Media',
        mediaType: MediaType.MOVIE,
        genres: [
          { genreId: 'genre1', genre: { id: 'genre1', name: 'Action' } },
          { genreId: 'genre2', genre: { id: 'genre2', name: 'Adventure' } },
        ],
      };

      // Mock user ratings (to exclude)
      const mockRatings = [{ mediaId: 'rated1' }];

      // Mock similar media
      const mockSimilarMedia = [
        {
          id: 'similar1',
          title: 'Similar Movie 1',
          mediaType: MediaType.MOVIE,
          genres: [
            { genreId: 'genre1', genre: { id: 'genre1', name: 'Action' } },
          ],
        },
        {
          id: 'similar2',
          title: 'Similar Movie 2',
          mediaType: MediaType.MOVIE,
          genres: [
            { genreId: 'genre1', genre: { id: 'genre1', name: 'Action' } },
            { genreId: 'genre2', genre: { id: 'genre2', name: 'Adventure' } },
          ],
        },
      ];

      // Setup mocks
      (prisma.media.findUnique as jest.Mock).mockResolvedValue(mockSourceMedia);
      (prisma.mediaRating.findMany as jest.Mock).mockResolvedValue(mockRatings);
      (prisma.media.findMany as jest.Mock).mockResolvedValue(mockSimilarMedia);

      // Call the function
      const result = await recommendationService.getMediaBasedRecommendations({
        userId: 'user1',
        mediaId: 'media1',
        limit: 5,
      });

      // Verify the result
      expect(result).toHaveLength(2);

      // Second item should rank higher due to more matching genres
      expect(result[0].id).toBe('similar2');
      expect(result[1].id).toBe('similar1');

      // Verify that source media and rated media are excluded
      expect(prisma.media.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: 'media1', notIn: ['rated1'] },
          }),
        })
      );
    });

    it('should throw error if source media not found', async () => {
      // Mock source media not found
      (prisma.media.findUnique as jest.Mock).mockResolvedValue(null);

      // Call the function and expect error
      await expect(
        recommendationService.getMediaBasedRecommendations({
          userId: 'user1',
          mediaId: 'nonexistent',
          limit: 5,
        })
      ).rejects.toThrow(AppError);
    });
  });

  describe('updateUserPreferences', () => {
    it('should update user preferences correctly', async () => {
      const userId = 'user1';
      const genreIds = ['genre1', 'genre2'];
      const mediaTypePreferences = [
        { type: MediaType.MOVIE, strength: 0.8 },
        { type: MediaType.GAME, strength: 0.5 },
      ];

      // Mock updated preferences
      const mockUpdatedPreferences = [
        { userId, genreId: 'genre1', preferenceStrength: 1.0 },
        { userId, genreId: 'genre2', preferenceStrength: 1.0 },
        {
          userId,
          mediaTypePreference: MediaType.MOVIE,
          preferenceStrength: 0.8,
        },
        {
          userId,
          mediaTypePreference: MediaType.GAME,
          preferenceStrength: 0.5,
        },
      ];

      // Setup mocks
      (prisma.userPreference.findMany as jest.Mock).mockResolvedValue(
        mockUpdatedPreferences
      );

      // Call the function
      const result = await recommendationService.updateUserPreferences(
        userId,
        genreIds,
        mediaTypePreferences
      );

      // Verify mocks were called correctly
      expect(prisma.userPreference.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });

      expect(prisma.userPreference.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          { userId, genreId: 'genre1', preferenceStrength: 1.0 },
          { userId, genreId: 'genre2', preferenceStrength: 1.0 },
          {
            userId,
            mediaTypePreference: MediaType.MOVIE,
            preferenceStrength: 0.8,
          },
          {
            userId,
            mediaTypePreference: MediaType.GAME,
            preferenceStrength: 0.5,
          },
        ]),
      });

      // Verify the result
      expect(result).toEqual(mockUpdatedPreferences);
    });
  });

  describe('getTrendingRecommendations', () => {
    it('should return trending media with correct pagination', async () => {
      // Mock trending media
      const mockTrending = [
        {
          id: 'trend1',
          title: 'Trending 1',
          popularity: 0.95,
          averageRating: 9.0,
          genres: [],
        },
        {
          id: 'trend2',
          title: 'Trending 2',
          popularity: 0.9,
          averageRating: 8.5,
          genres: [],
        },
      ];

      // Setup mocks
      (prisma.media.count as jest.Mock).mockResolvedValue(20);
      (prisma.media.findMany as jest.Mock).mockResolvedValue(mockTrending);

      // Call with mediaType filter
      const result = await recommendationService.getTrendingRecommendations(
        MediaType.MOVIE,
        5,
        2
      );

      // Verify the query
      expect(prisma.media.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { mediaType: MediaType.MOVIE },
          take: 5,
          skip: 5, // (page - 1) * limit
          orderBy: [{ popularity: 'desc' }, { averageRating: 'desc' }],
        })
      );

      // Verify the result
      expect(result).toHaveProperty('recommendations', mockTrending);
      expect(result.totalCount).toBe(20);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
    });

    it('should work without mediaType filter', async () => {
      // Setup mocks
      (prisma.media.count as jest.Mock).mockResolvedValue(50);
      (prisma.media.findMany as jest.Mock).mockResolvedValue([]);

      // Call without mediaType
      await recommendationService.getTrendingRecommendations(undefined, 10, 1);

      // Verify no mediaType filter was applied
      expect(prisma.media.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
    });
  });
});
