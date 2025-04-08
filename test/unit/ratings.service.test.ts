// tests/unit/ratings/ratings.service.test.ts
import { prisma } from '../../src/config/database';
import * as ratingsService from '../../src/api/ratings/ratings.service';
import { AppError } from '../../src/middlewares/error.middleware';
import { clearCacheByPattern } from '../../src/middlewares/cache.middleware';

// Mock dependencies
jest.mock('../../src/config/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    media: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    mediaRating: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(prisma)),
  },
}));

jest.mock('../../src/middlewares/cache.middleware', () => ({
  clearCacheByPattern: jest.fn(),
}));

describe('Ratings Service', () => {
  const mockUserId = 'user-123';
  const mockMediaId = 'media-123';
  const mockRatingId = 'rating-123';
  const mockRating = 8.5;
  const mockUser = { id: mockUserId, name: 'John Doe' };
  const mockMediaRating = {
    id: mockRatingId,
    userId: mockUserId,
    mediaId: mockMediaId,
    rating: mockRating,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRating', () => {
    it('should create a new rating and update media statistics', async () => {
      // Arrange
      (prisma.media.findUnique as jest.Mock).mockResolvedValue({
        id: mockMediaId,
        title: 'Test Media',
      });
      (prisma.mediaRating.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.mediaRating.create as jest.Mock).mockResolvedValue(
        mockMediaRating
      );
      (prisma.mediaRating.findMany as jest.Mock).mockResolvedValue([
        { rating: 8.5 },
        { rating: 9.0 },
      ]);

      // Act
      const result = await ratingsService.createRating(
        mockUserId,
        mockMediaId,
        mockRating
      );

      // Assert
      expect(prisma.media.findUnique).toHaveBeenCalledWith({
        where: { id: mockMediaId },
      });
      expect(prisma.mediaRating.findUnique).toHaveBeenCalledWith({
        where: {
          userId_mediaId: {
            userId: mockUserId,
            mediaId: mockMediaId,
          },
        },
      });
      expect(prisma.mediaRating.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          mediaId: mockMediaId,
          rating: mockRating,
        },
      });
      expect(prisma.mediaRating.findMany).toHaveBeenCalledWith({
        where: { mediaId: mockMediaId },
        select: { rating: true },
      });
      expect(prisma.media.update).toHaveBeenCalledWith({
        where: { id: mockMediaId },
        data: {
          averageRating: 8.75, // (8.5 + 9.0) / 2
          ratingsCount: 2,
        },
      });
      expect(clearCacheByPattern).toHaveBeenCalledWith(`media:${mockMediaId}`);
      expect(clearCacheByPattern).toHaveBeenCalledWith(
        `user:${mockUserId}:/api/ratings`
      );
      expect(result).toEqual(mockMediaRating);
    });

    it('should throw an error if media does not exist', async () => {
      // Arrange
      (prisma.media.findUnique as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        ratingsService.createRating(mockUserId, mockMediaId, mockRating)
      ).rejects.toThrow(
        new AppError('Media not found', 404, 'MEDIA_NOT_FOUND')
      );
    });

    it('should throw an error if user has already rated the media', async () => {
      // Arrange
      (prisma.media.findUnique as jest.Mock).mockResolvedValue({
        id: mockMediaId,
        title: 'Test Media',
      });
      (prisma.mediaRating.findUnique as jest.Mock).mockResolvedValue(
        mockMediaRating
      );

      // Act & Assert
      await expect(
        ratingsService.createRating(mockUserId, mockMediaId, mockRating)
      ).rejects.toThrow(
        new AppError(
          'You have already rated this media. Please update your rating instead.',
          409,
          'RATING_EXISTS'
        )
      );
    });
  });

  describe('updateRating', () => {
    it('should update an existing rating and update media statistics', async () => {
      // Arrange
      (prisma.mediaRating.findUnique as jest.Mock).mockResolvedValue(
        mockMediaRating
      );
      (prisma.mediaRating.update as jest.Mock).mockResolvedValue({
        ...mockMediaRating,
        rating: 9.0,
      });
      (prisma.mediaRating.findMany as jest.Mock).mockResolvedValue([
        { rating: 9.0 },
        { rating: 7.0 },
      ]);

      // Act
      const result = await ratingsService.updateRating(
        mockRatingId,
        mockUserId,
        9.0
      );

      // Assert
      expect(prisma.mediaRating.findUnique).toHaveBeenCalledWith({
        where: { id: mockRatingId },
      });
      expect(prisma.mediaRating.update).toHaveBeenCalledWith({
        where: { id: mockRatingId },
        data: { rating: 9.0 },
      });
      expect(prisma.mediaRating.findMany).toHaveBeenCalledWith({
        where: { mediaId: mockMediaId },
        select: { rating: true },
      });
      expect(prisma.media.update).toHaveBeenCalledWith({
        where: { id: mockMediaId },
        data: {
          averageRating: 8.0, // (9.0 + 7.0) / 2
          ratingsCount: 2,
        },
      });
      expect(clearCacheByPattern).toHaveBeenCalledWith(`media:${mockMediaId}`);
      expect(clearCacheByPattern).toHaveBeenCalledWith(
        `user:${mockUserId}:/api/ratings`
      );
      expect(result).toEqual({
        ...mockMediaRating,
        rating: 9.0,
      });
    });

    it('should throw an error if rating does not exist', async () => {
      // Arrange
      (prisma.mediaRating.findUnique as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        ratingsService.updateRating(mockRatingId, mockUserId, 9.0)
      ).rejects.toThrow(
        new AppError('Rating not found', 404, 'RATING_NOT_FOUND')
      );
    });

    it('should throw an error if user does not own the rating', async () => {
      // Arrange
      (prisma.mediaRating.findUnique as jest.Mock).mockResolvedValue({
        ...mockMediaRating,
        userId: 'different-user',
      });

      // Act & Assert
      await expect(
        ratingsService.updateRating(mockRatingId, mockUserId, 9.0)
      ).rejects.toThrow(
        new AppError(
          'You can only update your own ratings',
          403,
          'UNAUTHORIZED'
        )
      );
    });

    describe('deleteRating', () => {
      it('should delete a rating and update media statistics', async () => {
        // Arrange
        (prisma.mediaRating.findUnique as jest.Mock).mockResolvedValue(
          mockMediaRating
        );
        (prisma.mediaRating.findMany as jest.Mock).mockResolvedValue([
          { rating: 7.0 },
        ]);

        // Act
        await ratingsService.deleteRating(mockRatingId, mockUserId);

        // Assert
        expect(prisma.mediaRating.findUnique).toHaveBeenCalledWith({
          where: { id: mockRatingId },
        });
        expect(prisma.mediaRating.delete).toHaveBeenCalledWith({
          where: { id: mockRatingId },
        });
        expect(prisma.mediaRating.findMany).toHaveBeenCalledWith({
          where: { mediaId: mockMediaId },
          select: { rating: true },
        });
        expect(prisma.media.update).toHaveBeenCalledWith({
          where: { id: mockMediaId },
          data: {
            averageRating: 7.0,
            ratingsCount: 1,
          },
        });
        expect(clearCacheByPattern).toHaveBeenCalledWith(
          `media:${mockMediaId}`
        );
        expect(clearCacheByPattern).toHaveBeenCalledWith(
          `user:${mockUserId}:/api/ratings`
        );
      });

      it('should set averageRating to 0 when last rating is deleted', async () => {
        // Arrange
        (prisma.mediaRating.findUnique as jest.Mock).mockResolvedValue(
          mockMediaRating
        );
        (prisma.mediaRating.findMany as jest.Mock).mockResolvedValue([]);

        // Act
        await ratingsService.deleteRating(mockRatingId, mockUserId);

        // Assert
        expect(prisma.media.update).toHaveBeenCalledWith({
          where: { id: mockMediaId },
          data: {
            averageRating: 0,
            ratingsCount: 0,
          },
        });
      });

      it('should throw an error if rating does not exist', async () => {
        // Arrange
        (prisma.mediaRating.findUnique as jest.Mock).mockResolvedValue(null);

        // Act & Assert
        await expect(
          ratingsService.deleteRating(mockRatingId, mockUserId)
        ).rejects.toThrow(
          new AppError('Rating not found', 404, 'RATING_NOT_FOUND')
        );
      });
    });

    describe('getRatingById', () => {
      it('should return a rating by ID', async () => {
        // Arrange
        (prisma.mediaRating.findUnique as jest.Mock).mockResolvedValue(
          mockMediaRating
        );

        // Act
        const result = await ratingsService.getRatingById(mockRatingId);

        // Assert
        expect(prisma.mediaRating.findUnique).toHaveBeenCalledWith({
          where: { id: mockRatingId },
        });
        expect(result).toEqual(mockMediaRating);
      });

      it('should throw an error if rating does not exist', async () => {
        // Arrange
        (prisma.mediaRating.findUnique as jest.Mock).mockResolvedValue(null);

        // Act & Assert
        await expect(
          ratingsService.getRatingById(mockRatingId)
        ).rejects.toThrow(
          new AppError('Rating not found', 404, 'RATING_NOT_FOUND')
        );
      });
    });

    describe('getUserMediaRating', () => {
      it("should return a user's rating for a specific media", async () => {
        // Arrange
        (prisma.mediaRating.findUnique as jest.Mock).mockResolvedValue(
          mockMediaRating
        );

        // Act
        const result = await ratingsService.getUserMediaRating(
          mockUserId,
          mockMediaId
        );

        // Assert
        expect(prisma.mediaRating.findUnique).toHaveBeenCalledWith({
          where: {
            userId_mediaId: {
              userId: mockUserId,
              mediaId: mockMediaId,
            },
          },
        });
        expect(result).toEqual(mockMediaRating);
      });

      it('should return null if user has not rated the media', async () => {
        // Arrange
        (prisma.mediaRating.findUnique as jest.Mock).mockResolvedValue(null);

        // Act
        const result = await ratingsService.getUserMediaRating(
          mockUserId,
          mockMediaId
        );

        // Assert
        expect(result).toBeNull();
      });
    });

    describe('getMediaRatings', () => {
      it('should return ratings for a specific media with pagination', async () => {
        // Arrange
        const mockRatings = [mockMediaRating];
        const mockTotal = 1;
        (prisma.mediaRating.findMany as jest.Mock).mockResolvedValue(
          mockRatings
        );
        (prisma.mediaRating.count as jest.Mock).mockResolvedValue(mockTotal);

        // Act
        const result = await ratingsService.getMediaRatings(mockMediaId, 1, 10);

        // Assert
        expect(prisma.mediaRating.findMany).toHaveBeenCalledWith({
          where: { mediaId: mockMediaId },
          skip: 0,
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        });
        expect(prisma.mediaRating.count).toHaveBeenCalledWith({
          where: { mediaId: mockMediaId },
        });
        expect(result).toHaveProperty('ratings');
        expect(result).toHaveProperty('pagination');
        expect(result.ratings).toEqual(mockRatings);
      });
    });

    describe('getUserRatings', () => {
      it('should return ratings by a specific user with pagination', async () => {
        // Arrange
        const mockRatings = [mockMediaRating];
        const mockTotal = 1;
        (prisma.mediaRating.findMany as jest.Mock).mockResolvedValue(
          mockRatings
        );
        (prisma.mediaRating.count as jest.Mock).mockResolvedValue(mockTotal);
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

        // Act
        const result = await ratingsService.getUserRatings(mockUserId, 1, 10);

        // Assert
        expect(prisma.mediaRating.findMany).toHaveBeenCalledWith({
          where: { userId: mockUserId },
          skip: 0,
          take: 10,
          orderBy: { createdAt: 'desc' },
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
        });
        expect(prisma.mediaRating.count).toHaveBeenCalledWith({
          where: { userId: mockUserId },
        });
        expect(result).toHaveProperty('ratings');
        expect(result).toHaveProperty('pagination');
        expect(result.ratings).toEqual(mockRatings);
      });
    });
  });
});
