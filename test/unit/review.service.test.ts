import { Role } from "@prisma/client";

import { ReviewService } from "../../src/api/review/review.service";
import { prisma } from "../../src/config/database";
import { AppError } from "../../src/middlewares/error.middleware";
import { clearCacheByPattern } from "../../src/middlewares/cache.middleware";

// Mock dependencies
jest.mock("../../src/config/database", () => ({
  prisma: {
    mediaReview: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    media: {
      findUnique: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  },
}));

jest.mock("../../src/middlewares/cache.middleware", () => ({
  clearCacheByPattern: jest.fn(),
}));

describe("ReviewService", () => {
  let reviewService: ReviewService;

  beforeEach(() => {
    reviewService = new ReviewService();
    jest.clearAllMocks();
  });

  describe("createReview", () => {
    const createReviewData = {
      userId: "user-123",
      mediaId: "media-123",
      content: "This is a great movie!",
      isVisible: true,
      containsSpoilers: false,
    };

    it("should create a review successfully", async () => {
      // Mock database responses
      (prisma.mediaReview.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.media.findUnique as jest.Mock).mockResolvedValue({
        id: "media-123",
      });
      (prisma.mediaReview.create as jest.Mock).mockResolvedValue({
        id: "review-123",
        ...createReviewData,
        likesCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await reviewService.createReview(createReviewData);

      // Verify function calls
      expect(prisma.mediaReview.findFirst).toHaveBeenCalledWith({
        where: {
          userId: createReviewData.userId,
          mediaId: createReviewData.mediaId,
        },
      });
      expect(prisma.media.findUnique).toHaveBeenCalledWith({
        where: { id: createReviewData.mediaId },
      });
      expect(prisma.mediaReview.create).toHaveBeenCalledWith({
        data: createReviewData,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatar: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
      expect(clearCacheByPattern).toHaveBeenCalledWith(
        `reviews:media:${createReviewData.mediaId}`,
      );

      // Verify result
      expect(result).toHaveProperty("id", "review-123");
      expect(result).toHaveProperty("content", createReviewData.content);
    });

    it("should throw an error if user has already reviewed the media", async () => {
      (prisma.mediaReview.findFirst as jest.Mock).mockResolvedValue({
        id: "existing-review",
        userId: createReviewData.userId,
        mediaId: createReviewData.mediaId,
      });

      await expect(
        reviewService.createReview(createReviewData),
      ).rejects.toThrow(
        new AppError(
          "You have already reviewed this media",
          409,
          "REVIEW_EXISTS",
        ),
      );

      expect(prisma.mediaReview.create).not.toHaveBeenCalled();
    });

    it("should throw an error if media does not exist", async () => {
      (prisma.mediaReview.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.media.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        reviewService.createReview(createReviewData),
      ).rejects.toThrow(
        new AppError("Media not found", 404, "MEDIA_NOT_FOUND"),
      );

      expect(prisma.mediaReview.create).not.toHaveBeenCalled();
    });
  });

  describe("getMediaReviews", () => {
    const mediaId = "media-123";
    const mockReviews = [
      {
        id: "review-1",
        mediaId,
        userId: "user-1",
        content: "Great movie!",
        isVisible: true,
        likesCount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: "user-1",
          username: "user1",
          avatar: "avatar.jpg",
        },
      },
    ];

    it("should return reviews for a media with pagination", async () => {
      (prisma.mediaReview.findMany as jest.Mock).mockResolvedValue(mockReviews);
      (prisma.mediaReview.count as jest.Mock).mockResolvedValue(1);

      const result = await reviewService.getMediaReviews(mediaId, 1, 10, false);

      expect(prisma.mediaReview.findMany).toHaveBeenCalledWith({
        where: { mediaId, isVisible: true },
        skip: 0,
        take: 10,
        orderBy: [{ likesCount: "desc" }, { createdAt: "desc" }],
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatar: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
      expect(prisma.mediaReview.count).toHaveBeenCalledWith({
        where: { mediaId, isVisible: true },
      });

      expect(result).toEqual({ reviews: mockReviews, total: 1 });
    });

    it("should include hidden reviews when includeHidden is true", async () => {
      (prisma.mediaReview.findMany as jest.Mock).mockResolvedValue(mockReviews);
      (prisma.mediaReview.count as jest.Mock).mockResolvedValue(1);

      await reviewService.getMediaReviews(mediaId, 1, 10, true);

      expect(prisma.mediaReview.findMany).toHaveBeenCalledWith({
        where: { mediaId },
        skip: 0,
        take: 10,
        orderBy: [{ likesCount: "desc" }, { createdAt: "desc" }],
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      });
    });
  });

  describe("getUserReviews", () => {
    const userId = "user-123";
    const requestingUserId = "user-123";
    const mockReviews = [
      {
        id: "review-1",
        mediaId: "media-1",
        userId,
        content: "Great movie!",
        isVisible: true,
        likesCount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        media: {
          id: "media-1",
          title: "Test Movie",
          mediaType: "MOVIE",
          coverImage: "cover.jpg",
        },
      },
    ];

    it("should return reviews by a user with pagination", async () => {
      (prisma.mediaReview.findMany as jest.Mock).mockResolvedValue(mockReviews);
      (prisma.mediaReview.count as jest.Mock).mockResolvedValue(1);

      const result = await reviewService.getUserReviews(
        userId,
        1,
        10,
        requestingUserId,
      );

      expect(prisma.mediaReview.findMany).toHaveBeenCalledWith({
        where: { userId },
        skip: 0,
        take: 10,
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
      });
      expect(prisma.mediaReview.count).toHaveBeenCalledWith({
        where: { userId },
      });

      expect(result).toEqual({ reviews: mockReviews, total: 1 });
    });

    it("should filter out hidden reviews when requesting user is different", async () => {
      (prisma.mediaReview.findMany as jest.Mock).mockResolvedValue(mockReviews);
      (prisma.mediaReview.count as jest.Mock).mockResolvedValue(1);

      await reviewService.getUserReviews(userId, 1, 10, "different-user");

      expect(prisma.mediaReview.findMany).toHaveBeenCalledWith({
        where: { userId, isVisible: true },
        skip: 0,
        take: 10,
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
      });
    });
  });

  describe("getReviewById", () => {
    const reviewId = "review-123";
    const mockReview = {
      id: reviewId,
      mediaId: "media-1",
      userId: "user-1",
      content: "Great movie!",
      isVisible: true,
      likesCount: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: "user-1",
        username: "user1",
        avatar: "avatar.jpg",
      },
      media: {
        id: "media-1",
        title: "Test Movie",
        mediaType: "MOVIE",
        coverImage: "cover.jpg",
      },
    };

    it("should return a review by ID", async () => {
      (prisma.mediaReview.findUnique as jest.Mock).mockResolvedValue(
        mockReview,
      );

      const result = await reviewService.getReviewById(reviewId);

      expect(prisma.mediaReview.findUnique).toHaveBeenCalledWith({
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

      expect(result).toEqual(mockReview);
    });

    it("should throw an error if review does not exist", async () => {
      (prisma.mediaReview.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(reviewService.getReviewById(reviewId)).rejects.toThrow(
        new AppError("Review not found", 404, "REVIEW_NOT_FOUND"),
      );
    });
  });

  describe("updateReview", () => {
    const reviewId = "review-123";
    const userId = "user-123";
    const updateData = {
      content: "Updated content",
      isVisible: false,
    };
    const mockReview = {
      id: reviewId,
      mediaId: "media-1",
      userId,
      content: "Original content",
      isVisible: true,
      likesCount: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const updatedReview = {
      ...mockReview,
      content: updateData.content,
      isVisible: updateData.isVisible,
    };

    it("should update a review when user is the owner", async () => {
      (prisma.mediaReview.findUnique as jest.Mock).mockResolvedValue(
        mockReview,
      );
      (prisma.mediaReview.update as jest.Mock).mockResolvedValue(updatedReview);

      const result = await reviewService.updateReview(
        reviewId,
        userId,
        updateData,
        Role.USER,
      );

      expect(prisma.mediaReview.findUnique).toHaveBeenCalledWith({
        where: { id: reviewId },
      });
      expect(prisma.mediaReview.update).toHaveBeenCalledWith({
        where: { id: reviewId },
        data: updateData,
      });
      expect(clearCacheByPattern).toHaveBeenCalledWith(
        `reviews:media:${mockReview.mediaId}`,
      );
      expect(clearCacheByPattern).toHaveBeenCalledWith(
        `reviews:user:${mockReview.userId}`,
      );

      expect(result).toEqual(updatedReview);
    });

    it("should update a review when user is an admin", async () => {
      const differentUserId = "different-user";
      (prisma.mediaReview.findUnique as jest.Mock).mockResolvedValue({
        ...mockReview,
        userId: differentUserId,
      });
      (prisma.mediaReview.update as jest.Mock).mockResolvedValue(updatedReview);

      const result = await reviewService.updateReview(
        reviewId,
        userId,
        updateData,
        Role.ADMIN,
      );

      expect(prisma.mediaReview.update).toHaveBeenCalled();
      expect(result).toEqual(updatedReview);
    });

    it("should throw an error if review does not exist", async () => {
      (prisma.mediaReview.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        reviewService.updateReview(reviewId, userId, updateData, Role.USER),
      ).rejects.toThrow(
        new AppError("Review not found", 404, "REVIEW_NOT_FOUND"),
      );

      expect(prisma.mediaReview.update).not.toHaveBeenCalled();
    });

    it("should throw an error if user is not authorized", async () => {
      (prisma.mediaReview.findUnique as jest.Mock).mockResolvedValue({
        ...mockReview,
        userId: "different-user",
      });

      await expect(
        reviewService.updateReview(reviewId, userId, updateData, Role.USER),
      ).rejects.toThrow(
        new AppError(
          "You do not have permission to update this review",
          403,
          "PERMISSION_DENIED",
        ),
      );

      expect(prisma.mediaReview.update).not.toHaveBeenCalled();
    });
  });

  describe("deleteReview", () => {
    const reviewId = "review-123";
    const userId = "user-123";
    const mockReview = {
      id: reviewId,
      mediaId: "media-1",
      userId,
      content: "Original content",
      isVisible: true,
      likesCount: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should delete a review when user is the owner", async () => {
      (prisma.mediaReview.findUnique as jest.Mock).mockResolvedValue(
        mockReview,
      );
      (prisma.mediaReview.delete as jest.Mock).mockResolvedValue(mockReview);

      await reviewService.deleteReview(reviewId);

      expect(prisma.mediaReview.findUnique).toHaveBeenCalledWith({
        where: { id: reviewId },
      });
      expect(prisma.mediaReview.delete).toHaveBeenCalledWith({
        where: { id: reviewId },
      });
      expect(clearCacheByPattern).toHaveBeenCalledWith(
        `reviews:media:${mockReview.mediaId}`,
      );
      expect(clearCacheByPattern).toHaveBeenCalledWith(
        `reviews:user:${mockReview.userId}`,
      );
    });

    it("should delete a review when user is a moderator", async () => {
      const differentUserId = "different-user";
      (prisma.mediaReview.findUnique as jest.Mock).mockResolvedValue({
        ...mockReview,
        userId: differentUserId,
      });
      (prisma.mediaReview.delete as jest.Mock).mockResolvedValue(mockReview);

      await reviewService.deleteReview(reviewId);

      expect(prisma.mediaReview.delete).toHaveBeenCalled();
    });

    it("should throw an error if review does not exist", async () => {
      (prisma.mediaReview.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(reviewService.deleteReview(reviewId)).rejects.toThrow(
        new AppError("Review not found", 404, "REVIEW_NOT_FOUND"),
      );

      expect(prisma.mediaReview.delete).not.toHaveBeenCalled();
    });
  });

  describe("likeReview", () => {
    const reviewId = "review-123";
    const mockReview = {
      id: reviewId,
      mediaId: "media-1",
      userId: "user-1",
      content: "Great movie!",
      isVisible: true,
      likesCount: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const updatedReview = {
      ...mockReview,
      likesCount: 6,
    };

    it("should increment the likes count of a review", async () => {
      (prisma.mediaReview.findUnique as jest.Mock).mockResolvedValue(
        mockReview,
      );
      (prisma.mediaReview.update as jest.Mock).mockResolvedValue(updatedReview);
      (prisma.notification.create as jest.Mock).mockResolvedValue({});

      const result = await reviewService.likeReview(reviewId);

      expect(prisma.mediaReview.findUnique).toHaveBeenCalledWith({
        where: { id: reviewId },
      });
      expect(prisma.mediaReview.update).toHaveBeenCalledWith({
        where: { id: reviewId },
        data: {
          likesCount: { increment: 1 },
        },
      });
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: mockReview.userId,
          type: "NEW_RATING",
          title: "Your review received a like",
          message: "Someone liked your review!",
          data: { reviewId },
        },
      });

      expect(result).toEqual(updatedReview);
    });

    it("should throw an error if review does not exist", async () => {
      (prisma.mediaReview.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(reviewService.likeReview(reviewId)).rejects.toThrow(
        new AppError("Review not found", 404, "REVIEW_NOT_FOUND"),
      );

      expect(prisma.mediaReview.update).not.toHaveBeenCalled();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });
});
