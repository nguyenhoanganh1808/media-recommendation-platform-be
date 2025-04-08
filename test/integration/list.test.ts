import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/config/database";
import { generateAccessToken } from "../../src/utils/jwt";
import * as cacheMiddleware from "../../src/middlewares/cache.middleware";
import { NextFunction } from "express";
import { Media, User } from "@prisma/client";

// Mock cache middleware to avoid Redis dependency in tests
jest.mock("../../src/middlewares/cache.middleware", () => ({
  clearCacheByPattern: jest.fn().mockResolvedValue(undefined),
  cacheMiddleware: jest
    .fn()
    .mockImplementation(
      () => (req: Request, res: Response, next: NextFunction) => next()
    ),
  userCacheMiddleware: jest
    .fn()
    .mockImplementation(
      () => (req: Request, res: Response, next: NextFunction) => next()
    ),
}));

describe("Lists API Integration Tests", () => {
  let authToken: string;
  let userId: string;
  let listId: string;
  let mediaId: string;
  let secondMediaId: string;
  let listItemId: string;

  // Test user data
  const testUser: User = {
    id: "12345",
    email: "testListUser@example.com",
    username: "testListUser",
    password: "securepassword",
    firstName: null,
    lastName: null,
    bio: null,
    avatar: null,
    isActive: true,
    role: "USER",
    lastLogin: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Test media data

  // Setup before all tests
  beforeAll(async () => {
    // Clear test data to ensure clean state
    await prisma.mediaListItem.deleteMany({
      where: { listId: { contains: "test" } },
    });
    await prisma.mediaList.deleteMany({ where: { userId: testUser.id } });
    await prisma.media.deleteMany({
      where: { OR: [{ id: mediaId }, { id: secondMediaId }] },
    });
    await prisma.user.deleteMany({ where: { id: testUser.id } });

    // Create test user
    await prisma.user.create({
      data: testUser,
    });

    // Create test media
    const newMedia = await prisma.media.create({
      data: {
        title: "The Dark Knight",
        originalTitle: "The Dark Knight",
        description: "A film about Batman facing off against the Joker.",
        releaseDate: new Date("2008-07-18"),
        mediaType: "MOVIE",
        status: "RELEASED",
        coverImage: "https://example.com/dark-knight-cover.jpg",
        backdropImage: "https://example.com/dark-knight-backdrop.jpg",
        popularity: 9.5,
        averageRating: 8.9,
        ratingsCount: 1000000,

        // Movie-specific attributes
        duration: 152,
        director: "Christopher Nolan",

        // Common relations (empty for now)
        genres: { create: [] },
        ratings: { create: [] },
        reviews: { create: [] },
        listItems: { create: [] },
        externalIds: { create: [] },

        // Optional attributes for other media types (set to null)
        developer: null,
        publisher: null,

        author: null,
        artist: null,
        volumeCount: null,
        isCompleted: null,
      },
    });
    const secondMedia = await prisma.media.create({
      data: {
        title: "interstellar",
        originalTitle: "interstellar",
        description: "A film about space and time travel.",
        releaseDate: new Date("2008-07-18"),
        mediaType: "MOVIE",
        status: "RELEASED",
        coverImage: "https://example.com/dark-knight-cover.jpg",
        backdropImage: "https://example.com/dark-knight-backdrop.jpg",
        popularity: 9.5,
        averageRating: 8.9,
        ratingsCount: 1000000,

        // Movie-specific attributes
        duration: 152,
        director: "Christopher Nolan",

        // Common relations (empty for now)
        genres: { create: [] },
        ratings: { create: [] },
        reviews: { create: [] },
        listItems: { create: [] },
        externalIds: { create: [] },

        // Optional attributes for other media types (set to null)
        developer: null,
        publisher: null,

        author: null,
        artist: null,
        volumeCount: null,
        isCompleted: null,
      },
    });

    // Generate auth token for test user
    userId = testUser.id;
    authToken = generateAccessToken(testUser);
    mediaId = newMedia.id;
    secondMediaId = secondMedia.id;
  });

  // Clean up after all tests
  afterAll(async () => {
    await prisma.mediaListItem.deleteMany({
      where: { listId: { contains: "test" } },
    });
    await prisma.mediaList.deleteMany({ where: { userId: testUser.id } });
    await prisma.media.deleteMany({
      where: { OR: [{ id: mediaId }, { id: secondMediaId }] },
    });
    await prisma.user.deleteMany({ where: { id: testUser.id } });
  });

  describe("Create list", () => {
    it("should create a new list", async () => {
      const response = await request(app)
        .post("/api/lists")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "My Test List",
          description: "A list for integration testing",
          isPublic: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("id");
      expect(response.body.data.name).toBe("My Test List");
      expect(response.body.data.description).toBe(
        "A list for integration testing"
      );
      expect(response.body.data.isPublic).toBe(true);

      // Store list ID for future tests
      listId = response.body.data.id;
    });

    it("should reject creation with invalid data", async () => {
      const response = await request(app)
        .post("/api/lists")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "", // Empty name should fail validation
          isPublic: true,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it("should reject unauthorized request", async () => {
      const response = await request(app).post("/api/lists").send({
        name: "Unauthorized List",
        isPublic: true,
      });

      expect(response.status).toBe(401);
    });
  });

  describe("Get user lists", () => {
    it("should get all lists for authenticated user", async () => {
      const response = await request(app)
        .get("/api/lists")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.meta.pagination).toBeDefined();
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get("/api/lists?page=1&limit=5")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.meta.pagination.currentPage).toBe(1);
      expect(response.body.meta.pagination.itemsPerPage).toBe(5);
    });
  });

  describe("Get list by ID", () => {
    it("should get a specific list by ID", async () => {
      const response = await request(app)
        .get(`/api/lists/${listId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(listId);
      expect(response.body.data.name).toBe("My Test List");
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it("should return 404 for non-existent list", async () => {
      const response = await request(app)
        .get("/api/lists/non-existent-id")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe("Add item to list", () => {
    it("should add an item to a list", async () => {
      const response = await request(app)
        .post(`/api/lists/${listId}/items`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          mediaId: mediaId,
          notes: "Great movie!",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("id");
      expect(response.body.data.listId).toBe(listId);
      expect(response.body.data.mediaId).toBe(mediaId);
      expect(response.body.data.notes).toBe("Great movie!");

      // Store item ID for future tests
      listItemId = response.body.data.id;
    });

    it("should reject adding duplicate item", async () => {
      const response = await request(app)
        .post(`/api/lists/${listId}/items`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          mediaId: mediaId,
          notes: "Duplicate item",
        });

      expect(response.status).toBe(409); // Conflict
    });

    it("should reject adding item with invalid media ID", async () => {
      const response = await request(app)
        .post(`/api/lists/${listId}/items`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          mediaId: "non-existent-media",
          notes: "Invalid media",
        });

      expect(response.status).toBe(404);
    });
  });

  describe("Update list", () => {
    it("should update a list with new details", async () => {
      const response = await request(app)
        .put(`/api/lists/${listId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Updated Test List",
          description: "This list has been updated",
          isPublic: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe("Updated Test List");
      expect(response.body.data.description).toBe("This list has been updated");
      expect(response.body.data.isPublic).toBe(false);
    });

    it("should allow partial updates", async () => {
      const response = await request(app)
        .put(`/api/lists/${listId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          description: "Only updating the description",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe("Updated Test List"); // Name unchanged
      expect(response.body.data.description).toBe(
        "Only updating the description"
      );
    });

    it("should reject updates to non-existent list", async () => {
      const response = await request(app)
        .put("/api/lists/non-existent-id")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Invalid List",
        });

      expect(response.status).toBe(404);
    });
  });

  describe("Update list item", () => {
    it("should update a list item with new notes", async () => {
      const response = await request(app)
        .put(`/api/lists/items/${listItemId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          notes: "Updated notes for this media",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(listItemId);
      expect(response.body.data.notes).toBe("Updated notes for this media");
    });

    it("should reject updates to non-existent item", async () => {
      const response = await request(app)
        .put("/api/lists/items/non-existent-id")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          notes: "Invalid item",
        });

      expect(response.status).toBe(404);
    });
  });

  describe("Reorder list items", () => {
    it("should reorder items in a list", async () => {
      const addResponse = await request(app)
        .post(`/api/lists/${listId}/items`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          mediaId: secondMediaId, // Using a different mediaId
          notes: "Second item",
        });

      const secondItemId = addResponse.body.data.id;

      // Then reorder the items
      const response = await request(app)
        .put(`/api/lists/${listId}/reorder`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          items: [
            { id: listItemId, order: 1 },
            { id: secondItemId, order: 0 },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      // Verify the order was updated
      const updatedList = await request(app)
        .get(`/api/lists/${listId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(updatedList.body.data.items[0].id).toBe(secondItemId);
      expect(updatedList.body.data.items[1].id).toBe(listItemId);
    });

    it("should reject invalid reorder data", async () => {
      const response = await request(app)
        .put(`/api/lists/${listId}/reorder`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          items: [
            { id: listItemId }, // Missing order property
          ],
        });

      expect(response.status).toBe(400);
    });
  });

  describe("Remove item from list", () => {
    it("should remove an item from a list", async () => {
      const response = await request(app)
        .delete(`/api/lists/items/${listItemId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify the item was removed
      const updatedList = await request(app)
        .get(`/api/lists/${listId}`)
        .set("Authorization", `Bearer ${authToken}`);

      const itemStillExists = updatedList.body.data.items.some(
        (item: any) => item.id === listItemId
      );
      expect(itemStillExists).toBe(false);
    });

    it("should return 404 for non-existent item", async () => {
      const response = await request(app)
        .delete("/api/lists/items/non-existent-id")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe("Delete list", () => {
    it("should delete a list", async () => {
      const response = await request(app)
        .delete(`/api/lists/${listId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify the list was deleted
      const getResponse = await request(app)
        .get(`/api/lists/${listId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(getResponse.status).toBe(404);
    });

    it("should return 404 for non-existent list", async () => {
      const response = await request(app)
        .delete("/api/lists/non-existent-id")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe("Get public lists from a user", () => {
    let publicListId: string;

    beforeAll(async () => {
      // Create a public list for testing
      const response = await request(app)
        .post("/api/lists")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Public Test List",
          description: "A public list for testing",
          isPublic: true,
        });

      publicListId = response.body.data.id;
    });

    it("should return public lists from a user", async () => {
      const response = await request(app)
        .get(`/api/lists/user/${userId}/public`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(
        response.body.data.some((list: any) => list.id === publicListId)
      ).toBe(true);
    });
  });
});
