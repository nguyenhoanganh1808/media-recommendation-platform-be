import request from "supertest";
import { Express } from "express";
import { prisma } from "../../src/config/database";
import { hashPassword } from "../../src/utils/password";
import app from "../../src/app";

let server: Express;
let testAuthUser = {
  email: "testauth@example.com",
  username: "testAuthUser",
  password: "TestPassword123",
  hashedPassword: "",
};
let accessToken = "";
let refreshToken = "";

let testAuthUserId: string | null = null;

beforeAll(async () => {
  server = app;
  await prisma.refreshToken.deleteMany({});
  await prisma.follow.deleteMany({});
  await prisma.user.deleteMany({ where: { email: testAuthUser.email } });

  testAuthUser.hashedPassword = await hashPassword(testAuthUser.password);

  // Create test user and store their ID
});

afterAll(async () => {
  if (testAuthUserId) {
    await prisma.refreshToken.deleteMany({ where: { userId: testAuthUserId } });
    await prisma.user.deleteMany({ where: { id: testAuthUserId } });
  }
});

describe("Auth API", () => {
  describe("POST /api/auth/register", () => {
    it("should register a new user", async () => {
      const res = await request(server).post("/api/auth/register").send({
        email: testAuthUser.email,
        username: testAuthUser.username,
        password: testAuthUser.password,
        firstName: "Test",
        lastName: "User",
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBeDefined();
      expect(res.body.data.user).toHaveProperty("id");
      expect(res.body.data.user.email).toBe(testAuthUser.email);
      expect(res.body.data).toHaveProperty("accessToken");
      expect(res.body.data).toHaveProperty("refreshToken");
      testAuthUserId = res.body.data.user.id;
    });

    it("should not register a user with existing email", async () => {
      const res = await request(server).post("/api/auth/register").send({
        email: testAuthUser.email,
        username: "anotheruser",
        password: "AnotherPassword123",
        firstName: "Test",
        lastName: "User",
      });

      expect(res.status).toBe(409);
      expect(res.body.message).toBeDefined();
      expect(res.body.success).toBeFalsy();
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login a user with valid credentials", async () => {
      const res = await request(server).post("/api/auth/login").send({
        email: testAuthUser.email,
        password: testAuthUser.password,
      });

      console.log("Response: ", res.status, res.body);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toHaveProperty("id");
      expect(res.body.data).toHaveProperty("accessToken");
      expect(res.body.data).toHaveProperty("refreshToken");

      // Save tokens for later tests
      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it("should not login with invalid credentials", async () => {
      const res = await request(server).post("/api/auth/login").send({
        email: testAuthUser.email,
        password: "WrongPassword123",
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/auth/profile", () => {
    it("should get user profile with valid token", async () => {
      const res = await request(server)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data.email).toBe(testAuthUser.email);
    });

    it("should not get profile without token", async () => {
      const res = await request(server).get("/api/auth/profile");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/auth/refresh-token", () => {
    it("should refresh token with valid refresh token", async () => {
      const res = await request(server).post("/api/auth/refresh-token").send({
        refreshToken: refreshToken,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("accessToken");
      expect(res.body.data).toHaveProperty("refreshToken");

      // Update tokens for later tests
      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });
  });

  describe("POST /api/auth/change-password", () => {
    it("should change password with valid credentials", async () => {
      const res = await request(server)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          currentPassword: testAuthUser.password,
          newPassword: "NewTestPassword123",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Update test user password
      testAuthUser.password = "NewTestPassword123";
    });

    it("should not change password with incorrect current password", async () => {
      const res = await request(server)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          currentPassword: "WrongPassword123",
          newPassword: "AnotherNewPassword123",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should logout a user", async () => {
      const res = await request(server)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          refreshToken: refreshToken,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
