// tests/integration/media.routes.test.ts
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/config/database";
import { MediaType, MediaStatus, Role, Genre } from "@prisma/client";
import { generateAccessToken } from "../../src/utils/jwt";
import { logger } from "../../src/config/logger";

// Mock Redis client
jest.mock("../../src/config/redis", () => ({
  redisClient: {
    isReady: false,
  },
  getCache: jest.fn(),
  setCache: jest.fn(),
}));

describe("Media API Routes", () => {
  // Test data
  let adminUser: any;
  let moderatorUser: any;
  let regularUser: any;
  let adminToken: string;
  let moderatorToken: string;
  let userToken: string;
  let testMedia: any;
  let testGenre: Genre;
  let createdUserIds: string[] = [];
  let createdGenreIds: string[] = [];
  let createdMediaIds: string[] = [];

  // Setup before tests
  beforeAll(async () => {
    // Create test users with different roles
    const admin = await prisma.user.create({
      data: {
        email: "admin@test.com",
        username: "admin_test",
        password: "hashed_password",
        role: Role.ADMIN,
      },
    });
    adminUser = admin;
    createdUserIds.push(admin.id);

    const moderator = await prisma.user.create({
      data: {
        email: "moderator@test.com",
        username: "moderator_test",
        password: "hashed_password",
        role: Role.MODERATOR,
      },
    });
    moderatorUser = moderator;
    createdUserIds.push(moderator.id);

    const user = await prisma.user.create({
      data: {
        email: "user@test.com",
        username: "user_test",
        password: "hashed_password",
        role: Role.USER,
      },
    });
    regularUser = user;
    createdUserIds.push(user.id);

    // Create JWT tokens
    adminToken = generateAccessToken(adminUser);
    moderatorToken = generateAccessToken(moderatorUser);
    userToken = generateAccessToken(regularUser);

    // Create a test genre
    const genre = await prisma.genre.create({
      data: {
        name: "Test Genre",
        description: "A genre for testing",
      },
    });
    testGenre = genre;
    createdGenreIds.push(genre.id);

    // Create test media
    const media = await prisma.media.create({
      data: {
        title: "Test Media",
        description: "A test media item",
        mediaType: MediaType.MOVIE,
        status: MediaStatus.RELEASED,
        director: "Test Director",
        duration: 120,
        genres: {
          create: [
            {
              genre: {
                connect: { id: genre.id },
              },
            },
          ],
        },
      },
    });
    testMedia = media;
    createdMediaIds.push(media.id);
  });

  // Cleanup after tests
  afterAll(async () => {
    // Clean up all test data
    try {
      // Delete only the test media created
      if (createdMediaIds.length) {
        await prisma.media.deleteMany({
          where: { id: { in: createdMediaIds } },
        });
      }

      // Delete test genres
      if (createdGenreIds.length) {
        await prisma.genre.deleteMany({
          where: { id: { in: createdGenreIds } },
        });
      }

      // Delete test users
      if (createdUserIds.length) {
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        });
      }
    } catch (error) {
      logger.error("Error during cleanup:", error);
    }
  });

  describe("GET /api/media", () => {
    it("should return a list of media with pagination", async () => {
      const response = await request(app).get("/api/media").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.meta.pagination).toHaveProperty("currentPage");
      expect(response.body.meta.pagination).toHaveProperty("itemsPerPage");
      expect(response.body.meta.pagination).toHaveProperty("totalItems");
      expect(response.body.meta.pagination).toHaveProperty("totalPages");
    });

    it("should filter media by type", async () => {
      const response = await request(app)
        .get("/api/media?type=MOVIE")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(
        response.body.data.every((item: any) => item.mediaType === "MOVIE")
      ).toBe(true);
    });

    it("should filter media by genre", async () => {
      const response = await request(app)
        .get(`/api/media?genre=Test Genre`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // Note: The actual filtering logic is tested in service tests
    });

    it("should search media by title", async () => {
      const response = await request(app)
        .get("/api/media?search=Test")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(
        response.body.data.some((item: any) => item.title.includes("Test"))
      ).toBe(true);
    });

    it("should sort media by specified field", async () => {
      const response = await request(app)
        .get("/api/media?sortBy=title&sortOrder=asc")
        .expect(200);

      expect(response.body.success).toBe(true);
      // Note: The actual sorting logic is tested in service tests
    });

    it("should reject invalid query parameters", async () => {
      const response = await request(app)
        .get("/api/media?invalidParam=value")
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should limit results based on limit parameter", async () => {
      const response = await request(app).get("/api/media?limit=1").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(1);
    });
  });

  describe("GET /api/media/:id", () => {
    it("should return a specific media by ID", async () => {
      const response = await request(app)
        .get(`/api/media/${testMedia.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testMedia.id);
      expect(response.body.data.title).toBe(testMedia.title);
    });

    it("should include related data like genres and reviews", async () => {
      const response = await request(app)
        .get(`/api/media/${testMedia.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.genres).toBeInstanceOf(Array);
      expect(response.body.data.reviews).toBeInstanceOf(Array);
    });

    it("should return 404 for non-existent media ID", async () => {
      const response = await request(app)
        .get("/api/media/00000000-0000-0000-0000-000000000000")
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("not found");
    });

    it("should return 400 for invalid UUID format", async () => {
      const response = await request(app)
        .get("/api/media/invalid-uuid")
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/media", () => {
    const newMediaMovie = {
      title: "New Test Movie",
      description: "A new test movie",
      mediaType: "MOVIE",
      status: "RELEASED",
      director: "New Director",
      duration: 150,
      // genres: [testGenre.id],
    };

    const newMediaGame = {
      title: "New Test Game",
      description: "A new test game",
      mediaType: "GAME",
      status: "RELEASED",
      developer: "Test Developer",
      publisher: "Test Publisher",
      platforms: [],
      // genres: [testGenre.id],
    };

    it("should allow admins to create new media", async () => {
      const response = await request(app)
        .post("/api/media")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(newMediaMovie)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(newMediaMovie.title);
      expect(response.body.data.mediaType).toBe(newMediaMovie.mediaType);

      // Clean up
      await prisma.genreOnMedia.deleteMany({
        where: { mediaId: response.body.data.id },
      });
      await prisma.media.delete({
        where: { id: response.body.data.id },
      });
    });

    it("should allow moderators to create new media", async () => {
      const response = await request(app)
        .post("/api/media")
        .set("Authorization", `Bearer ${moderatorToken}`)
        .send(newMediaGame)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(newMediaGame.title);
      expect(response.body.data.mediaType).toBe(newMediaGame.mediaType);

      // Clean up
      await prisma.genreOnMedia.deleteMany({
        where: { mediaId: response.body.data.id },
      });
      await prisma.media.delete({
        where: { id: response.body.data.id },
      });
    });

    it("should not allow regular users to create media", async () => {
      const response = await request(app)
        .post("/api/media")
        .set("Authorization", `Bearer ${userToken}`)
        .send(newMediaMovie)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it("should require authentication to create media", async () => {
      const response = await request(app)
        .post("/api/media")
        .send(newMediaMovie)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should validate required fields", async () => {
      const invalidMedia = {
        description: "Missing required fields",
      };

      const response = await request(app)
        .post("/api/media")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(invalidMedia)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should validate mediaType-specific fields", async () => {
      const invalidMovie = {
        title: "Invalid Movie",
        mediaType: "MOVIE",
        duration: "not a number", // Should be a number
      };

      const response = await request(app)
        .post("/api/media")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(invalidMovie)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("PUT /api/media/:id", () => {
    let mediaToUpdate: any;

    beforeEach(async () => {
      // Create a media item for update tests
      mediaToUpdate = await prisma.media.create({
        data: {
          title: "Media To Update",
          description: "This will be updated",
          mediaType: MediaType.MOVIE,
          status: MediaStatus.RELEASED,
          director: "Director Name",
          duration: 120,
        },
      });
    });

    afterEach(async () => {
      if (mediaToUpdate) {
        await prisma.media
          .delete({
            where: { id: mediaToUpdate.id },
          })
          .catch(() => {
            // Ignore errors if already deleted
          });
      }
    });

    it("should allow admins to update media", async () => {
      const updateData = {
        title: "Updated Title",
        description: "Updated description",
      };

      const response = await request(app)
        .put(`/api/media/${mediaToUpdate.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.description).toBe(updateData.description);
    });

    it("should allow moderators to update media", async () => {
      const updateData = {
        title: "Moderator Updated",
        status: "UPCOMING",
      };

      const response = await request(app)
        .put(`/api/media/${mediaToUpdate.id}`)
        .set("Authorization", `Bearer ${moderatorToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.status).toBe(updateData.status);
    });

    it("should not allow regular users to update media", async () => {
      const updateData = {
        title: "User Trying To Update",
      };

      const response = await request(app)
        .put(`/api/media/${mediaToUpdate.id}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it("should validate media type specific fields on update", async () => {
      const invalidUpdate = {
        mediaType: "MANGA",
        volumeCount: "not a number", // Should be a number
      };

      const response = await request(app)
        .put(`/api/media/${mediaToUpdate.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(invalidUpdate)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should return 404 for updating non-existent media", async () => {
      const response = await request(app)
        .put("/api/media/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ title: "Update Non-existent" })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe("DELETE /api/media/:id", () => {
    let mediaToDelete: any;

    beforeEach(async () => {
      // Create a media item for delete tests
      mediaToDelete = await prisma.media.create({
        data: {
          title: "Media To Delete",
          description: "This will be deleted",
          mediaType: MediaType.MOVIE,
          status: MediaStatus.RELEASED,
        },
      });
    });

    afterEach(async () => {
      // Ensure cleanup even if test fails
      if (mediaToDelete) {
        await prisma.media
          .deleteMany({
            where: { title: "Media To Delete" },
          })
          .catch(() => {
            // Ignore errors if already deleted
          });
      }
    });

    it("should allow admins to delete media", async () => {
      const response = await request(app)
        .delete(`/api/media/${mediaToDelete.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("deleted successfully");

      // Verify it's deleted
      const deleted = await prisma.media.findUnique({
        where: { id: mediaToDelete.id },
      });
      expect(deleted).toBeNull();

      // Set to null so afterEach doesn't try to delete again
      mediaToDelete = null;
    });

    it("should not allow moderators to delete media", async () => {
      const response = await request(app)
        .delete(`/api/media/${mediaToDelete.id}`)
        .set("Authorization", `Bearer ${moderatorToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it("should not allow regular users to delete media", async () => {
      const response = await request(app)
        .delete(`/api/media/${mediaToDelete.id}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it("should return 404 for deleting non-existent media", async () => {
      const response = await request(app)
        .delete("/api/media/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe("Rate limiting and caching", () => {
    it("should apply rate limiting on GET requests", async () => {
      // This is a simple test to ensure the middleware is applied
      // A full test would require making many requests in succession
      const response = await request(app)
        .get("/api/media")
        .expect(200)
        .expect("RateLimit-Limit", /^\d+$/); // Check rate limit header exists

      expect(response.headers["ratelimit-limit"]).toBeDefined();
      expect(response.headers["ratelimit-remaining"]).toBeDefined();
    });

    // Testing caching would require mocking Redis functions
    // which is usually done at the unit test level
  });
});
