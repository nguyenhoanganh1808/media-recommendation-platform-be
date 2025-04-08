// tests/unit/ratings/ratings.controller.test.ts
import { NextFunction, Request, Response } from "express";
import * as ratingsService from "../../src/api/ratings/ratings.service";
import * as ratingsController from "../../src/api/ratings/ratings.controller";
import { sendSuccess } from "../../src/utils/responseFormatter";
import { mock } from "node:test";

// Mock dependencies
jest.mock("../../src/api/ratings/ratings.service");
jest.mock("../../src/utils/responseFormatter");

describe("Ratings Controller", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction = jest.fn();
  let mockRating: any;

  beforeEach(() => {
    mockRequest = {
      user: {
        id: "user-123",
        role: "USER",
        email: "Bx4iA@example.com",
        username: "testuser",
        isActive: true,
      },
      body: {},
      params: {},
      query: {},
    };
    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    mockRating = {
      id: "rating-123",
      userId: "user-123",
      mediaId: "media-123",
      rating: 8.5,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe("createRating", () => {
    it("should create a rating and return success response", async () => {
      // Arrange
      mockRequest.body = { mediaId: "media-123", rating: 8.5 };
      (ratingsService.createRating as jest.Mock).mockResolvedValue(mockRating);

      // Act
      await ratingsController.createRating(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(ratingsService.createRating).toHaveBeenCalledWith(
        "user-123",
        "media-123",
        8.5,
        undefined
      );
      expect(sendSuccess).toHaveBeenCalledWith(
        mockResponse,
        mockRating,
        "Rating created successfully",
        201
      );
    });
  });

  describe("updateRating", () => {
    it("should update a rating and return success response", async () => {
      // Arrange
      mockRequest.params = { id: "rating-123" };
      mockRequest.body = { rating: 9.0 };
      (ratingsService.updateRating as jest.Mock).mockResolvedValue({
        ...mockRating,
        rating: 9.0,
      });

      // Act
      await ratingsController.updateRating(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(ratingsService.updateRating).toHaveBeenCalledWith(
        "rating-123",
        "user-123",
        9.0
      );
      expect(sendSuccess).toHaveBeenCalledWith(
        mockResponse,
        { ...mockRating, rating: 9.0 },
        "Rating updated successfully"
      );
    });
  });

  describe("deleteRating", () => {
    it("should delete a rating and return success response", async () => {
      // Arrange
      mockRequest.params = { id: "rating-123" };
      (ratingsService.deleteRating as jest.Mock).mockResolvedValue(undefined);

      // Act
      await ratingsController.deleteRating(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(ratingsService.deleteRating).toHaveBeenCalledWith(
        "rating-123",
        "user-123"
      );
      expect(sendSuccess).toHaveBeenCalledWith(
        mockResponse,
        null,
        "Rating deleted successfully"
      );
    });
  });

  describe("getRating", () => {
    it("should get a rating by ID and return success response", async () => {
      // Arrange
      mockRequest.params = { id: "rating-123" };
      (ratingsService.getRatingById as jest.Mock).mockResolvedValue(mockRating);

      // Act
      await ratingsController.getRating(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(ratingsService.getRatingById).toHaveBeenCalledWith("rating-123");
      expect(sendSuccess).toHaveBeenCalledWith(
        mockResponse,
        mockRating,
        "Rating retrieved successfully"
      );
    });
  });

  describe("getUserRatings", () => {
    it("should get user ratings and return success response", async () => {
      // Arrange
      mockRequest.params = { userId: "user-123" };
      mockRequest.query = { page: "1", limit: "10" };
      const mockResult = {
        ratings: [mockRating],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          pages: 1,
        },
      };
      (ratingsService.getUserRatings as jest.Mock).mockResolvedValue(
        mockResult
      );

      // Act
      await ratingsController.getUserRatings(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(ratingsService.getUserRatings).toHaveBeenCalledWith(
        "user-123",
        1,
        10
      );
      expect(sendSuccess).toHaveBeenCalledWith(
        mockResponse,
        mockResult.ratings,
        "User ratings retrieved successfully",
        200,
        { pagination: mockResult.pagination }
      );
    });

    it("should get authenticated user ratings when no userId is provided", async () => {
      // Arrange
      mockRequest.params = {};
      mockRequest.query = { page: "1", limit: "10" };
      const mockResult = {
        ratings: [mockRating],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          pages: 1,
        },
      };
      (ratingsService.getUserRatings as jest.Mock).mockResolvedValue(
        mockResult
      );

      // Act
      await ratingsController.getUserRatings(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(ratingsService.getUserRatings).toHaveBeenCalledWith(
        "user-123",
        1,
        10
      );
    });
  });

  describe("getMediaRatings", () => {
    it("should get media ratings and return success response", async () => {
      // Arrange
      mockRequest.params = { mediaId: "media-123" };
      mockRequest.query = { page: "1", limit: "10" };
      const mockResult = {
        ratings: [mockRating],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          pages: 1,
        },
      };
      (ratingsService.getMediaRatings as jest.Mock).mockResolvedValue(
        mockResult
      );

      // Act
      await ratingsController.getMediaRatings(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(ratingsService.getMediaRatings).toHaveBeenCalledWith(
        "media-123",
        1,
        10
      );
      expect(sendSuccess).toHaveBeenCalledWith(
        mockResponse,
        mockResult.ratings,
        "Media ratings retrieved successfully",
        200,
        { pagination: mockResult.pagination }
      );
    });
  });
});
