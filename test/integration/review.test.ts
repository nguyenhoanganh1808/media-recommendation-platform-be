// packages/backend/tests/integration/review/review.routes.test.ts

import request from "supertest";
import { Role } from "@prisma/client";
import { prisma } from "../../src/config/database";
import app from "../../src/app";
import { generateAccessToken } from "../../src/utils/jwt";

let testUsers: any = {};
let testMedia: any;
let testReview: any;
let regularUserToken: string;
let adminUserToken: string;

describe("Review Routes", () => {
  beforeAll(async () => {
    // Create test users with different roles
    const users = await Promise.all([
      prisma.user.create({
        data: {
          email: "user@test.com",
          username: "testuser",
          password: "hashedpassword",
          role: Role.USER,
        },
      }),
      prisma.user.create({
        data: {
          email: "admin@test.com",
          username: "testament",
          password: "hashedpassword",
          role: Role.ADMIN,
        },
      }),
    ]);

    testUsers.regular = users[0];
    testUsers.admin = users[1];

    // Create test media
    testMedia = await prisma.media.create({
      data: {
        title: "Test Media",
        description: "A test media item",
        mediaType: "MOVIE",
      },
    });
    regularUserToken = generateAccessToken(testUsers.regular);
    adminUserToken = generateAccessToken(testUsers.admin);
  });

  afterAll(async () => {
    // Clean up
    await prisma.mediaReview.deleteMany({ where: { mediaId: testMedia.id } });
    await prisma.media.deleteMany({ where: { id: testMedia.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [testUsers.regular.id, testUsers.admin.id] } },
    });
    await prisma.user.deleteMany({
      where: { username: "anotheruser" },
    });
  });

  describe("POST /", () => {
    it("should create a new review when authenticated", async () => {
      // Generate token for regular user

      const reviewData = {
        mediaId: testMedia.id,
        content: "This is an integration test review.",
        isVisible: true,
      };

      const response = await request(app)
        .post("/api/reviews")
        .set("Authorization", `Bearer ${regularUserToken}`)
        .send(reviewData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("id");
      expect(response.body.data.userId).toBe(testUsers.regular.id);
      expect(response.body.data.mediaId).toBe(testMedia.id);
      expect(response.body.data.content).toBe(reviewData.content);

      // Save for later tests
      testReview = response.body.data;
    });

    it("should return 401 when not authenticated", async () => {
      const reviewData = {
        mediaId: testMedia.id,
        content: "This will fail.",
      };

      const response = await request(app).post("/api/reviews").send(reviewData);

      expect(response.status).toBe(401);
    });

    it("should return 400 when validation fails", async () => {
      const invalidReviewData = {
        mediaId: testMedia.id,
        content: "Too short", // Less than 10 characters
      };

      const response = await request(app)
        .post("/api/reviews")
        .set("Authorization", `Bearer ${regularUserToken}`)
        .send(invalidReviewData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it("should return 409 when user already reviewed the media", async () => {
      const reviewData = {
        mediaId: testMedia.id,
        content: "This is a duplicate review attempt.",
      };

      const response = await request(app)
        .post("/api/reviews")
        .set("Authorization", `Bearer ${regularUserToken}`)
        .send(reviewData);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("REVIEW_EXISTS");
    });
  });

  describe("GET /media/:mediaId", () => {
    it("should return reviews for a specific media", async () => {
      const response = await request(app).get(
        `/api/reviews/media/${testMedia.id}`
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.meta.pagination).toBeDefined();
    });

    it("should respect pagination parameters", async () => {
      const response = await request(app).get(
        `/api/reviews/media/${testMedia.id}?page=1&limit=5`
      );

      expect(response.status).toBe(200);
      expect(response.body.meta.pagination.currentPage).toBe(1);
      expect(response.body.meta.pagination.itemsPerPage).toBe(5);
    });
  });

  describe("GET /user/:userId", () => {
    it("should return reviews by a specific user", async () => {
      const response = await request(app).get(
        `/api/reviews/user/${testUsers.regular.id}`
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe("GET /:id", () => {
    it("should return a single review by ID", async () => {
      const response = await request(app).get(`/api/reviews/${testReview.id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testReview.id);
    });

    it("should return 404 for non-existent review", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const response = await request(app).get(`/api/reviews/${fakeId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe("PUT /:id", () => {
    it("should update a review when user is the author", async () => {
      const updateData = {
        content: "Updated review content for integration test",
      };

      const response = await request(app)
        .put(`/api/reviews/${testReview.id}`)
        .set("Authorization", `Bearer ${regularUserToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe(updateData.content);
    });

    it("should return 403 when user is not the author", async () => {
      // Create another user
      const anotherUser = await prisma.user.create({
        data: {
          email: "another@test.com",
          username: "anotheruser",
          password: "hashedpassword",
          role: Role.USER,
        },
      });
      testUsers.another = anotherUser;

      const token = generateAccessToken(anotherUser);
      testUsers.another.token = token;

      const updateData = {
        content: "This update should fail",
      };

      const response = await request(app)
        .put(`/api/reviews/${testReview.id}`)
        .set("Authorization", `Bearer ${testUsers.another.token}`)
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("PERMISSION_DENIED");
    });

    it("should allow admin to update any review", async () => {
      const updateData = {
        content: "Admin updated this review",
        isVisible: false,
      };

      const response = await request(app)
        .put(`/api/reviews/${testReview.id}`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe(updateData.content);
      expect(response.body.data.isVisible).toBe(updateData.isVisible);
    });
  });

  describe("POST /:id/like", () => {
    it("should increment the like count of a review", async () => {
      const initialReview = await prisma.mediaReview.findUnique({
        where: { id: testReview.id },
      });

      const initialLikesCount = initialReview!.likesCount;

      const response = await request(app)
        .post(`/api/reviews/${testReview.id}/like`)
        .set("Authorization", `Bearer ${regularUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.likesCount).toBe(initialLikesCount + 1);
    });

    it("should return 401 when not authenticated", async () => {
      const response = await request(app).post(
        `/api/reviews/${testReview.id}/like`
      );

      expect(response.status).toBe(401);
    });
  });

  describe("DELETE /:id", () => {
    it("should not allow non-authors to delete a review", async () => {
      const response = await request(app)
        .delete(`/api/reviews/${testReview.id}`)
        .set("Authorization", `Bearer ${testUsers.another.token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it("should allow the author to delete their review", async () => {
      // First create a new review

      // Create a review to delete
      const newReview = await prisma.mediaReview.create({
        data: {
          userId: testUsers.another.id,
          mediaId: testMedia.id,
          content: "This review will be deleted",
        },
      });

      // Delete it
      const response = await request(app)
        .delete(`/api/reviews/${newReview.id}`)
        .set("Authorization", `Bearer ${testUsers.another.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify it's gone
      const deletedReview = await prisma.mediaReview.findUnique({
        where: { id: newReview.id },
      });

      expect(deletedReview).toBeNull();
    });

    it("should allow admins to delete any review", async () => {
      const response = await request(app)
        .delete(`/api/reviews/${testReview.id}`)
        .set("Authorization", `Bearer ${adminUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("GET /admin/all", () => {
    beforeEach(async () => {
      // Create some reviews including hidden ones
      await prisma.mediaReview.createMany({
        data: [
          {
            userId: testUsers.regular.id,
            mediaId: testMedia.id,
            content: "Visible review",
            isVisible: true,
          },
          {
            userId: testUsers.regular.id,
            mediaId: testMedia.id,
            content: "Hidden review",
            isVisible: false,
          },
        ],
      });
    });

    it("should return all reviews including hidden ones for admins", async () => {
      // Create a new review to test

      const response = await request(app)
        .get("/api/reviews/admin/all?limit=100000")
        .set("Authorization", `Bearer ${adminUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Check if hidden reviews are included
      const hasHiddenReview = response.body.data.some(
        (review: any) => review.isVisible === false
      );

      expect(hasHiddenReview).toBe(true);
    });

    it("should deny access to regular users", async () => {
      const response = await request(app)
        .get("/api/reviews/admin/all")
        .set("Authorization", `Bearer ${regularUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });
});
