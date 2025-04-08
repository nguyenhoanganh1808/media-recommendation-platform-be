import { Request, Response } from 'express';
import { MediaType } from '@prisma/client';
import {
  getRecommendations,
  getMediaBasedRecommendations,
  getTrendingRecommendations,
  updateUserPreferences,
} from '../../src/api/recommendations/recommendations.controller';
import recommendationService from '../../src/api/recommendations/recommendations.service';
import { AppError } from '../../src/middlewares/error.middleware';

// Mock the service
jest.mock('../../src/api/recommendations/recommendations.service', () => ({
  __esModule: true,
  default: {
    getRecommendationsForUser: jest.fn(),
    getMediaBasedRecommendations: jest.fn(),
    getTrendingRecommendations: jest.fn(),
    updateUserPreferences: jest.fn(),
  },
}));

describe('Recommendation Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      user: {
        id: 'user-123',
        email: 'Qv5t5@example.com',
        role: 'USER',
        username: 'testuser',
        isActive: true,
      },
      query: {},
      params: {},
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('getRecommendations', () => {
    it('should return recommendations successfully', async () => {
      // Mock data
      const mockRecommendationResult = {
        recommendations: [
          { id: 'media-1', title: 'Test Media 1' },
          { id: 'media-2', title: 'Test Media 2' },
        ],
        totalCount: 2,
        page: 1,
        limit: 10,
      };

      // Setup mock service
      (
        recommendationService.getRecommendationsForUser as jest.Mock
      ).mockResolvedValue(mockRecommendationResult);

      // Call controller
      await getRecommendations(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assertions
      expect(
        recommendationService.getRecommendationsForUser
      ).toHaveBeenCalledWith({
        userId: 'user-123',
        limit: 10,
        page: 1,
        mediaType: undefined,
        includeRated: false,
      });

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockRecommendationResult.recommendations,
          message: 'Recommendations retrieved successfully',
          meta: expect.any(Object),
        })
      );
    });

    it('should handle query parameters correctly', async () => {
      // Setup request with query params
      mockRequest.query = {
        limit: '20',
        page: '2',
        mediaType: MediaType.GAME,
        includeRated: 'true',
      };

      // Mock service result
      (
        recommendationService.getRecommendationsForUser as jest.Mock
      ).mockResolvedValue({
        recommendations: [],
        totalCount: 0,
        page: 2,
        limit: 20,
      });

      // Call controller
      await getRecommendations(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify service called with correct params
      expect(
        recommendationService.getRecommendationsForUser
      ).toHaveBeenCalledWith({
        userId: 'user-123',
        limit: 20,
        page: 2,
        mediaType: MediaType.GAME,
        includeRated: true,
      });
    });

    it('should return 401 if user is not authenticated', async () => {
      // Setup request without user
      mockRequest.user = undefined;

      // Call controller
      await getRecommendations(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assertions
      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));

      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('Authentication required');
      expect(error.statusCode).toBe(401);
    });
  });

  describe('getMediaBasedRecommendations', () => {
    it('should return media-based recommendations successfully', async () => {
      // Setup request with params
      mockRequest.params = { mediaId: 'media-123' };
      mockRequest.query = { limit: '5' };

      // Mock service result
      const mockRecommendations = [
        { id: 'media-1', title: 'Similar Media 1' },
        { id: 'media-2', title: 'Similar Media 2' },
      ];

      (
        recommendationService.getMediaBasedRecommendations as jest.Mock
      ).mockResolvedValue(mockRecommendations);

      // Call controller
      await getMediaBasedRecommendations(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assertions
      expect(
        recommendationService.getMediaBasedRecommendations
      ).toHaveBeenCalledWith({
        userId: 'user-123',
        mediaId: 'media-123',
        limit: 5,
      });

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockRecommendations,
          message: 'Media-based recommendations retrieved successfully',
        })
      );
    });

    it('should return 401 if user is not authenticated', async () => {
      // Setup request without user
      mockRequest.user = undefined;
      mockRequest.params = { mediaId: 'media-123' };

      // Call controller
      await getMediaBasedRecommendations(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assertions
      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));

      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('Authentication required');
      expect(error.statusCode).toBe(401);
    });
  });

  describe('getTrendingRecommendations', () => {
    it('should return trending recommendations successfully', async () => {
      // Setup request with query params
      mockRequest.query = {
        limit: '10',
        page: '1',
        mediaType: MediaType.MOVIE,
      };

      // Mock service result
      const mockTrendingResult = {
        recommendations: [
          { id: 'media-1', title: 'Trending Media 1' },
          { id: 'media-2', title: 'Trending Media 2' },
        ],
        totalCount: 2,
        page: 1,
        limit: 10,
      };

      (
        recommendationService.getTrendingRecommendations as jest.Mock
      ).mockResolvedValue(mockTrendingResult);

      // Call controller
      await getTrendingRecommendations(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assertions
      expect(
        recommendationService.getTrendingRecommendations
      ).toHaveBeenCalledWith(MediaType.MOVIE, 10, 1);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockTrendingResult.recommendations,
          message: 'Trending recommendations retrieved successfully',
          meta: expect.any(Object),
        })
      );
    });

    it('should work without user authentication', async () => {
      // Setup request without user
      mockRequest.user = undefined;

      // Mock service result
      (
        recommendationService.getTrendingRecommendations as jest.Mock
      ).mockResolvedValue({
        recommendations: [],
        totalCount: 0,
        page: 1,
        limit: 10,
      });

      // Call controller
      await getTrendingRecommendations(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assertions
      expect(mockNext).not.toHaveBeenCalled(); // No error
      expect(
        recommendationService.getTrendingRecommendations
      ).toHaveBeenCalled();
    });
  });

  describe('updateUserPreferences', () => {
    it('should update user preferences successfully', async () => {
      // Setup request
      mockRequest.params = { userId: 'user-123' };
      mockRequest.body = {
        genreIds: ['genre-1', 'genre-2'],
        mediaTypePreferences: [
          { type: MediaType.MOVIE, strength: 0.8 },
          { type: MediaType.GAME, strength: 0.5 },
        ],
      };

      // Mock service result
      const mockUpdatedPreferences = [
        { userId: 'user-123', genreId: 'genre-1', preferenceStrength: 1.0 },
        { userId: 'user-123', genreId: 'genre-2', preferenceStrength: 1.0 },
        {
          userId: 'user-123',
          mediaTypePreference: MediaType.MOVIE,
          preferenceStrength: 0.8,
        },
        {
          userId: 'user-123',
          mediaTypePreference: MediaType.GAME,
          preferenceStrength: 0.5,
        },
      ];

      (
        recommendationService.updateUserPreferences as jest.Mock
      ).mockResolvedValue(mockUpdatedPreferences);

      // Call controller
      await updateUserPreferences(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assertions
      expect(recommendationService.updateUserPreferences).toHaveBeenCalledWith(
        'user-123',
        ['genre-1', 'genre-2'],
        [
          { type: MediaType.MOVIE, strength: 0.8 },
          { type: MediaType.GAME, strength: 0.5 },
        ]
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockUpdatedPreferences,
          message: 'User preferences updated successfully',
        })
      );
    });

    it('should handle empty inputs', async () => {
      // Setup request with empty arrays
      mockRequest.params = { userId: 'user-123' };
      mockRequest.body = {};

      // Mock service result
      (
        recommendationService.updateUserPreferences as jest.Mock
      ).mockResolvedValue([]);

      // Call controller
      await updateUserPreferences(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assertions
      expect(recommendationService.updateUserPreferences).toHaveBeenCalledWith(
        'user-123',
        [],
        []
      );
    });
  });
});
