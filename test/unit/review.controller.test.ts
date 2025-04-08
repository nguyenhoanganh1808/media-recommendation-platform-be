// packages/backend/tests/unit/review/review.controller.test.ts

import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { ReviewController } from "../../src/api/review/review.controller";
import reviewService from "../../src/api/review/review.service";
import * as responseFormatter from "../../src/utils/responseFormatter";

// Mock dependencies
jest.mock("../../src/api/review/review.service");
jest.mock("../../src/utils/responseFormatter");

describe("ReviewController", () => {
  let reviewController: ReviewController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    reviewController = new ReviewController();
    mockRequest = {
      user: {
        id: "user-123",
        role: Role.USER,
        email: "",
        isActive: true,
        username: "",
      },
      body: {},
      params: {},
      query: {},
    };
    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();

    // Reset mocks
    jest.clearAllMocks();
  });

  describe("createReview", () => {
    it("should create a review and return 201 status", async () => {
      // Arrange
      const reviewData = {
        userId: "user-123",
        mediaId: "media-123",
        content: "This is a test review",
        isVisible: true,
      };

      mockRequest.body = {
        mediaId: reviewData.mediaId,
        content: reviewData.content,
        isVisible: reviewData.isVisible,
      };

      const mockReview = { id: "review-123", ...reviewData };
      jest
        .spyOn(reviewService, "createReview")
        .mockResolvedValue(mockReview as any);
      jest.spyOn(responseFormatter, "sendSuccess");

      // Act
      await reviewController.createReview(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(reviewService.createReview).toHaveBeenCalledWith(reviewData);
      expect(responseFormatter.sendSuccess).toHaveBeenCalledWith(
        mockResponse,
        mockReview,
        "Review created successfully",
        201
      );
    });
  });

  describe("getMediaReviews", () => {
    it("should return reviews for a specific media with pagination", async () => {
      // Arrange
      const mediaId = "media-123";
      const page = 2;
      const limit = 5;

      mockRequest.params = { mediaId };
      mockRequest.query = { page: page.toString(), limit: limit.toString() };

      const mockReviews = [{ id: "review-1" }, { id: "review-2" }];
      const mockTotal = 10;
      const mockPagination = { page, limit, total: mockTotal, totalPages: 2 };

      jest.spyOn(reviewService, "getMediaReviews").mockResolvedValue({
        reviews: mockReviews as any,
        total: mockTotal,
      });

      jest
        .spyOn(responseFormatter, "createPagination")
        .mockReturnValue(mockPagination);
      jest.spyOn(responseFormatter, "sendSuccess");

      // Act
      await reviewController.getMediaReviews(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(reviewService.getMediaReviews).toHaveBeenCalledWith(
        mediaId,
        page,
        limit,
        false // includeHidden should be false for regular users
      );

      expect(responseFormatter.createPagination).toHaveBeenCalledWith(
        page,
        limit,
        mockTotal
      );
      expect(responseFormatter.sendSuccess).toHaveBeenCalledWith(
        mockResponse,
        mockReviews,
        "Media reviews retrieved successfully",
        200,
        mockPagination
      );
    });

    it("should include hidden reviews for admin role", async () => {
      // Arrange
      mockRequest.user = {
        id: "admin-123",
        role: Role.ADMIN,
        email: "",
        isActive: true,
        username: "",
      };
      mockRequest.params = { mediaId: "media-123" };

      jest.spyOn(reviewService, "getMediaReviews").mockResolvedValue({
        reviews: [] as any,
        total: 0,
      });
      jest
        .spyOn(responseFormatter, "createPagination")
        .mockReturnValue({} as any);

      // Act
      await reviewController.getMediaReviews(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(reviewService.getMediaReviews).toHaveBeenCalledWith(
        "media-123",
        1, // default page
        10, // default limit
        true // includeHidden should be true for admin
      );
    });
  });

  describe("getUserReviews", () => {
    it("should return reviews for a specific user with pagination", async () => {
      // Arrange
      const userId = "user-123";
      const page = 1;
      const limit = 10;

      mockRequest.params = { userId };
      mockRequest.query = { page: page.toString(), limit: limit.toString() };

      const mockReviews = [{ id: "review-1" }, { id: "review-2" }];
      const mockTotal = 2;
      const mockPagination = { page, limit, total: mockTotal, totalPages: 1 };

      jest.spyOn(reviewService, "getUserReviews").mockResolvedValue({
        reviews: mockReviews as any,
        total: mockTotal,
      });

      jest
        .spyOn(responseFormatter, "createPagination")
        .mockReturnValue(mockPagination);
      jest.spyOn(responseFormatter, "sendSuccess");

      // Act
      await reviewController.getUserReviews(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(reviewService.getUserReviews).toHaveBeenCalledWith(
        userId,
        page,
        limit,
        "user-123" // requestingUserId should be the current user's ID
      );

      expect(responseFormatter.createPagination).toHaveBeenCalledWith(
        page,
        limit,
        mockTotal
      );
      expect(responseFormatter.sendSuccess).toHaveBeenCalledWith(
        mockResponse,
        mockReviews,
        "User reviews retrieved successfully",
        200,
        mockPagination
      );
    });
  });

  describe("getReviewById", () => {
    it("should return a single review by ID", async () => {
      // Arrange
      const reviewId = "review-123";
      mockRequest.params = { id: reviewId };

      const mockReview = { id: reviewId, content: "Great media!" };
      jest
        .spyOn(reviewService, "getReviewById")
        .mockResolvedValue(mockReview as any);
      jest.spyOn(responseFormatter, "sendSuccess");

      // Act
      await reviewController.getReviewById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(reviewService.getReviewById).toHaveBeenCalledWith(reviewId);
      expect(responseFormatter.sendSuccess).toHaveBeenCalledWith(
        mockResponse,
        mockReview,
        "Review retrieved successfully"
      );
    });
  });

  describe("updateReview", () => {
    it("should update a review and return the updated data", async () => {
      // Arrange
      const reviewId = "review-123";
      const userId = "user-123";
      const userRole = Role.USER;
      const updateData = {
        content: "Updated review content",
        isVisible: false,
      };

      mockRequest.params = { id: reviewId };
      mockRequest.body = updateData;
      mockRequest.user = {
        id: userId,
        role: userRole,
        email: "",
        isActive: true,
        username: "",
      };

      const mockUpdatedReview = {
        id: reviewId,
        userId,
        ...updateData,
      };

      jest
        .spyOn(reviewService, "updateReview")
        .mockResolvedValue(mockUpdatedReview as any);
      jest.spyOn(responseFormatter, "sendSuccess");

      // Act
      await reviewController.updateReview(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(reviewService.updateReview).toHaveBeenCalledWith(
        reviewId,
        userId,
        updateData,
        userRole
      );

      expect(responseFormatter.sendSuccess).toHaveBeenCalledWith(
        mockResponse,
        mockUpdatedReview,
        "Review updated successfully"
      );
    });
  });

  describe("deleteReview", () => {
    it("should delete a review and return success message", async () => {
      // Arrange
      const reviewId = "review-123";
      const userId = "user-123";
      const userRole = Role.USER;

      mockRequest.params = { id: reviewId };
      mockRequest.user = {
        id: userId,
        role: userRole,
        email: "",
        isActive: true,
        username: "",
      };

      jest.spyOn(reviewService, "deleteReview").mockResolvedValue();
      jest.spyOn(responseFormatter, "sendSuccess");

      // Act
      await reviewController.deleteReview(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(reviewService.deleteReview).toHaveBeenCalledWith(
        reviewId,
        userId,
        userRole
      );

      expect(responseFormatter.sendSuccess).toHaveBeenCalledWith(
        mockResponse,
        null,
        "Review deleted successfully"
      );
    });
  });

  describe("likeReview", () => {
    it("should like a review and return the updated review", async () => {
      // Arrange
      const reviewId = "review-123";
      mockRequest.params = { id: reviewId };

      const mockUpdatedReview = {
        id: reviewId,
        likesCount: 42,
      };

      jest
        .spyOn(reviewService, "likeReview")
        .mockResolvedValue(mockUpdatedReview as any);
      jest.spyOn(responseFormatter, "sendSuccess");

      // Act
      await reviewController.likeReview(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(reviewService.likeReview).toHaveBeenCalledWith(reviewId);
      expect(responseFormatter.sendSuccess).toHaveBeenCalledWith(
        mockResponse,
        mockUpdatedReview,
        "Review liked successfully"
      );
    });
  });
});
