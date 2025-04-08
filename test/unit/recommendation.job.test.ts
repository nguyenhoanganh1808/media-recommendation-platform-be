import { RecommendationJob } from "../../src/jobs/recommendation.job";
import { PrismaClient, MediaType } from "@prisma/client";
import { RecommendationService } from "../../src/api/recommendations/recommendations.service";
import { CacheService } from "../../src/services/cache.service";
import * as NotificationService from "../../src/api/notifications/notifications.service";
import { logger } from "../../src/config/logger";

// Mock dependencies
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      findMany: jest.fn(),
    },
    userPreference: {
      findMany: jest.fn(),
    },
    media: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $disconnect: jest.fn(),
    $on: jest.fn(),
  })),
  MediaType: {
    MOVIE: "MOVIE",
    GAME: "GAME",
    MANGA: "MANGA",
  },
}));

jest.mock("../../src/api/recommendations/recommendations.service");
jest.mock("../../src/services/cache.service");
jest.mock("../../src/api/notifications/notifications.service");
jest.mock("../../src/config/logger");

describe("RecommendationJob", () => {
  let recommendationJob: RecommendationJob;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockRecommendationService: jest.Mocked<RecommendationService>;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    // Reset mocks and create a new instance before each test
    jest.clearAllMocks();
    recommendationJob = new RecommendationJob();

    // Type cast the private properties to allow mocking
    mockPrisma = recommendationJob["prisma"] as jest.Mocked<PrismaClient>;
    mockRecommendationService = recommendationJob[
      "recommendationService"
    ] as jest.Mocked<RecommendationService>;
    mockCacheService = recommendationJob[
      "cacheService"
    ] as jest.Mocked<CacheService>;
  });

  describe("generateRecommendationsForAllUsers", () => {
    it("should process recommendations for active users in batches", async () => {
      // Prepare mock data
      const mockUsers = Array.from({ length: 100 }, (_, i) => ({
        id: `user-${i}`,
        username: `user${i}`,
      }));

      // Mock user findMany
      (mockPrisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      // Mock processUserRecommendations to track calls
      const processUserSpy = jest
        .spyOn(recommendationJob as any, "processUserRecommendations")
        .mockImplementation(() => Promise.resolve());

      // Run the method
      await recommendationJob.generateRecommendationsForAllUsers();

      // Assertions
      expect(logger.info).toHaveBeenCalledWith(
        `Found ${mockUsers.length} active users for recommendation processing`
      );

      // Check batch processing
      expect(processUserSpy).toHaveBeenCalledTimes(100); // 100 users in batches of 50
      expect(processUserSpy).toHaveBeenCalledWith(mockUsers[0]);
      expect(processUserSpy).toHaveBeenCalledWith(mockUsers[50]);
    });

    it("should handle errors during recommendation generation", async () => {
      // Simulate an error
      (mockPrisma.user.findMany as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      // Expect the error to be thrown and logged
      await expect(
        recommendationJob.generateRecommendationsForAllUsers()
      ).rejects.toThrow("Database error");

      expect(logger.error).toHaveBeenCalledWith(
        "Error generating recommendations:",
        expect.any(Error)
      );
    });
  });

  describe("processUserRecommendations", () => {
    const mockUser = { id: "user-1", username: "testRecJobUser" };

    // it("should generate recommendations and create notification for new recommendations", async () => {
    //   // Mock user preferences
    //   (mockPrisma.userPreference.findMany as jest.Mock).mockResolvedValue([
    //     { userId: mockUser.id, mediaTypePreference: MediaType.MOVIE },
    //   ]);

    //   // Mock recommendations service
    //   (
    //     mockRecommendationService.getRecommendationsForUser as jest.Mock
    //   ).mockResolvedValue({
    //     recommendations: [{ id: "media-1" }],
    //   });

    //   // Mock notification service
    //   const createNotificationSpy = jest
    //     .spyOn(NotificationService, "createNotification")
    //     .mockResolvedValue(null);

    //   // Use reflection to call private method
    //   const processMethod = (recommendationJob as any)
    //     .processUserRecommendations;
    //   await processMethod(mockUser);

    //   // Assertions
    //   expect(
    //     mockRecommendationService.getRecommendationsForUser
    //   ).toHaveBeenCalledWith({
    //     userId: mockUser.id,
    //     mediaType: MediaType.MOVIE,
    //   });

    //   expect(createNotificationSpy).toHaveBeenCalledWith(
    //     mockUser.id,
    //     "NEW_RECOMMENDATION",
    //     "New Recommendations Available",
    //     "We have new recommendations for you based on your preferences and ratings!",
    //     expect.objectContaining({ timestamp: expect.any(String) })
    //   );
    // });
  });

  describe("updateMediaPopularityScores", () => {
    // it("should update popularity scores based on recent activity", async () => {
    //   // Mock media items with activity
    //   const mockMediaItems = [
    //     {
    //       id: "media-1",
    //       _count: {
    //         ratings: 5,
    //         reviews: 3,
    //         listItems: 2,
    //       },
    //     },
    //   ];
    //   // Mock prisma methods
    //   (mockPrisma.media.findMany as jest.Mock).mockResolvedValue(
    //     mockMediaItems
    //   );
    //   (mockPrisma.media.update as jest.Mock).mockResolvedValue(null);
    //   await recommendationJob.updateMediaPopularityScores();
    //   // Assertions
    //   expect(mockPrisma.media.update).toHaveBeenCalledWith({
    //     where: { id: "media-1" },
    //     data: { popularity: 5 * 1.0 + 3 * 2.0 + 2 * 0.5 },
    //   });
    //   expect(logger.info).toHaveBeenCalledWith(
    //     `Updated popularity scores for ${mockMediaItems.length} media items`
    //   );
    // });
  });

  describe("cleanup", () => {
    it("should disconnect from prisma", async () => {
      await recommendationJob.cleanup();
      expect(mockPrisma.$disconnect).toHaveBeenCalled();
    });
  });
});
