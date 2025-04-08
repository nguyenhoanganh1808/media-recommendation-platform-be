import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/config/database";
import { generateAccessToken } from "../../src/utils/jwt";

describe("User API", () => {
  let userId: string;
  let adminId: string;
  let userToken: string;
  let adminToken: string;

  let createdUserIds: string[] = []; // Track created users

  beforeAll(async () => {
    // Create test users
    const user = await prisma.user.create({
      data: {
        email: "testUserUser@example.com",
        username: "testUserUser",
        password: "hashedpassword",
        isActive: true,
        role: "USER",
      },
    });
    userId = user.id;
    userToken = generateAccessToken(user);
    createdUserIds.push(userId);

    const admin = await prisma.user.create({
      data: {
        email: "adminUser@example.com",
        username: "adminTestUser",
        password: "hashedpassword",
        isActive: true,
        role: "ADMIN",
      },
    });
    adminId = admin.id;
    adminToken = generateAccessToken(admin);
    createdUserIds.push(adminId);
  });

  afterAll(async () => {
    // Only delete users created in this test
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
    await prisma.follow.deleteMany({
      where: {
        followerId: { in: createdUserIds },
        followingId: { in: createdUserIds },
      },
    });
  });

  describe("POST /api/users", () => {
    it("should create a new user", async () => {
      const response = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          email: "newuser@example.com",
          username: "newuser",
          password: "Password123",
          firstName: "New",
          lastName: "User",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("email", "newuser@example.com");
      expect(response.body.data).not.toHaveProperty("password");

      // Track the newly created user for cleanup
      createdUserIds.push(response.body.data.id);
    });

    it("should return validation error for invalid data", async () => {
      const response = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          email: "invalid-email",
          username: "a", // Too short
          password: "short", // Too short
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/users/:id", () => {
    it("should return user data", async () => {
      const response = await request(app)
        .get(`/api/users/${userId}`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("id", userId);
      expect(response.body.data).toHaveProperty(
        "email",
        "testUserUser@example.com"
      );
      expect(response.body.data).not.toHaveProperty("password");
    });

    it("should return 404 for non-existent user", async () => {
      const response = await request(app)
        .get("/api/users/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe("PATCH /api/users/:id", () => {
    it("should update user when authenticated as the same user", async () => {
      const response = await request(app)
        .patch(`/api/users/${userId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          bio: "Updated bio",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("bio", "Updated bio");
    });

    it("should deny update when not authenticated as the user", async () => {
      // Create a second user and track it
      const user2 = await prisma.user.create({
        data: {
          email: "userTest2@example.com",
          username: "userTest2",
          password: "hashedpassword",
          isActive: true,
          role: "USER",
        },
      });
      const user2Token = generateAccessToken(user2);
      createdUserIds.push(user2.id);

      const response = await request(app)
        .patch(`/api/users/${userId}`)
        .set("Authorization", `Bearer ${user2Token}`)
        .send({
          bio: "Unauthorized update",
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it("should allow admin to update any user", async () => {
      const response = await request(app)
        .patch(`/api/users/${userId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          bio: "Admin updated this",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("bio", "Admin updated this");
    });
  });
});
