import { NotificationJob } from "../../src/jobs/notification.job";
import { PrismaClient } from "@prisma/client";
import { logger } from "../../src/config/logger";
import * as NotificationService from "../../src/api/notifications/notifications.service";
import { createTransport } from "nodemailer";
import { redisClient } from "../../src/config/redis";

// Mock dependencies
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    notification: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    media: {
      findMany: jest.fn(),
    },
    follow: {
      findMany: jest.fn(),
    },
    $disconnect: jest.fn(),
  })),
  NotificationType: {
    NEW_RECOMMENDATION: "NEW_RECOMMENDATION",
    SYSTEM_NOTIFICATION: "SYSTEM_NOTIFICATION",
    NEW_FOLLOWER: "NEW_FOLLOWER",
    NEW_RATING: "NEW_RATING",
    NEW_REVIEW: "NEW_REVIEW",
    LIST_SHARE: "LIST_SHARE",
  },
}));

jest.mock("../../src/config/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn(),
  })),
}));

jest.mock("../../src/config/redis", () => ({
  redisClient: {
    get: jest.fn(),
    set: jest.fn(),
    disconnect: jest.fn(),
  },
}));

jest.mock("../../src/api/notifications/notifications.service", () => ({
  createNotification: jest.fn(),
}));

describe("NotificationJob", () => {
  let notificationJob: NotificationJob;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockRedis: any;
  let mockEmailTransporter: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create a new NotificationJob instance
    notificationJob = new NotificationJob();

    // Get references to mocked instances
    mockPrisma = notificationJob["prisma"] as jest.Mocked<PrismaClient>;
    mockRedis = notificationJob["redisClient"];
    mockEmailTransporter = notificationJob["emailTransporter"];
  });

  describe("deliverPendingNotifications", () => {
    it("should process pending notifications", async () => {
      // Mock pending notifications
      const mockNotifications = [
        {
          id: "notification1",
          type: "NEW_FOLLOWER",
          title: "New Follower",
          message: "Someone followed you",
          user: {
            id: "user1",
            email: "user1@example.com",
            username: "testuser",
          },
        },
      ];

      // Setup mocks
      (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue(
        mockNotifications
      );
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue(true);

      // Call the method
      await notificationJob.deliverPendingNotifications();

      // Assertions
      expect(mockPrisma.notification.findMany).toHaveBeenCalled();
      expect(mockRedis.get).toHaveBeenCalledWith(
        "notification:delivered:notification1"
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        "notification:delivered:notification1",
        "1",
        { EX: 60 * 60 * 24 * 7 }
      );
    });

    it("should skip already delivered notifications", async () => {
      // Mock already delivered notification
      const mockNotifications = [
        {
          id: "notification1",
          type: "NEW_FOLLOWER",
          title: "New Follower",
          message: "Someone followed you",
          user: {
            id: "user1",
            email: "user1@example.com",
            username: "testuser",
          },
        },
      ];

      // Setup mocks
      (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue(
        mockNotifications
      );
      mockRedis.get.mockResolvedValue("1"); // Already delivered

      // Call the method
      await notificationJob.deliverPendingNotifications();

      // Assertions
      expect(mockPrisma.notification.findMany).toHaveBeenCalled();
      expect(mockRedis.get).toHaveBeenCalledWith(
        "notification:delivered:notification1"
      );
      // Ensure no further processing occurs
      expect(mockRedis.set).not.toHaveBeenCalled();
    });
  });

  describe("cleanupOldNotifications", () => {
    it("should delete old read notifications", async () => {
      // Mock delete result
      const mockDeleteResult = { count: 10 };
      (mockPrisma.notification.deleteMany as jest.Mock).mockResolvedValue(
        mockDeleteResult
      );

      // Call the method
      await notificationJob.cleanupOldNotifications();

      // Assertions
      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          isRead: true,
          createdAt: { lt: expect.any(Date) },
        },
      });
      expect(logger.info).toHaveBeenCalledWith("Deleted 10 old notifications");
    });
  });

  describe("sendWeeklyDigests", () => {
    it("should send weekly digests to active users", async () => {
      // Mock active users
      const mockUsers = [
        {
          id: "user1",
          email: "user1@example.com",
          username: "testuser1",
        },
      ];

      // Mock recommendations and following activity
      const mockRecommendations = [
        {
          title: "Test Movie",
          description: "A great movie",
        },
      ];
      const mockFollowingActivity = [
        {
          following: {
            username: "testuser2",
            mediaRatings: [
              {
                media: { title: "Another Movie" },
                rating: 8,
              },
            ],
          },
        },
      ];

      // Setup mocks
      (mockPrisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (mockPrisma.media.findMany as jest.Mock).mockResolvedValue(
        mockRecommendations
      );
      (mockPrisma.follow.findMany as jest.Mock).mockResolvedValue(
        mockFollowingActivity
      );
      (NotificationService.createNotification as jest.Mock).mockResolvedValue(
        {}
      );

      // Call the method
      await notificationJob.sendWeeklyDigests();

      // Assertions
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: { id: true, email: true, username: true },
      });
      expect(NotificationService.createNotification).toHaveBeenCalledWith(
        "user1",
        "SYSTEM_NOTIFICATION",
        "Your Weekly Digest",
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe("cleanup", () => {
    it("should disconnect prisma and redis", async () => {
      await notificationJob.cleanup();

      expect(mockPrisma.$disconnect).toHaveBeenCalled();
    });
  });
});
