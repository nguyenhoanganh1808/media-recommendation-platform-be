// tests/integration/ratings.api.test.ts
import request from 'supertest';
import { prisma } from '../../src/config/database';
import app from '../../src/app';
import { generateAccessToken } from '../../src/utils/jwt';
import { MediaType, MediaStatus, Role } from '@prisma/client';
import { logger } from '../../src/config/logger';

describe('Ratings API Integration Tests', () => {
  // Test data
  let testUser: any;
  let testAdmin: any;
  let testMedia: any;
  let testRating: any;
  let userToken: string;
  let adminToken: string;
  const nonexistUUID = '607b6ea6-7b53-478f-9d5b-7f103f30b3a9';

  // Helper to create tokens

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'test-user@example.com',
        username: 'testuser',
        password: 'hashedpassword',
        role: Role.USER,
      },
    });

    // Create test admin
    testAdmin = await prisma.user.create({
      data: {
        email: 'test-admin@example.com',
        username: 'testadmin',
        password: 'hashedpassword',
        role: Role.ADMIN,
      },
    });

    // Create test media
    testMedia = await prisma.media.create({
      data: {
        title: 'Test Movie',
        description: 'A test movie for integration tests',
        mediaType: MediaType.MOVIE,
        status: MediaStatus.RELEASED,
      },
    });

    // Generate tokens
    userToken = generateAccessToken(testUser);
    adminToken = generateAccessToken(testAdmin);
  });

  afterAll(async () => {
    // Clean up all test data
    await prisma.mediaRating.deleteMany({
      where: {
        OR: [{ userId: testUser.id }, { userId: testAdmin.id }],
      },
    });
    await prisma.media.delete({ where: { id: testMedia.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.user.delete({ where: { id: testAdmin.id } });
  });

  describe('POST /api/ratings', () => {
    it('should create a new rating', async () => {
      // Act
      const response = await request(app)
        .post('/api/ratings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          mediaId: testMedia.id,
          rating: 8.5,
        });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.userId).toBe(testUser.id);
      expect(response.body.data.mediaId).toBe(testMedia.id);
      expect(response.body.data.rating).toBe(8.5);

      // Store for later tests
      testRating = response.body.data;
    });

    it('should return 400 for invalid rating value', async () => {
      // Act
      const response = await request(app)
        .post('/api/ratings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          mediaId: testMedia.id,
          rating: 11, // Invalid: greater than 10
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 409 when trying to rate the same media twice', async () => {
      // Act
      const response = await request(app)
        .post('/api/ratings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          mediaId: testMedia.id,
          rating: 7.5,
        });

      // Assert
      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RATING_EXISTS');
    });

    it('should return 401 when not authenticated', async () => {
      // Act
      const response = await request(app).post('/api/ratings').send({
        mediaId: testMedia.id,
        rating: 7.5,
      });

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/ratings/:id', () => {
    it('should retrieve a rating by ID', async () => {
      // Act
      const response = await request(app)
        .get(`/api/ratings/${testRating.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testRating.id);
      expect(response.body.data.rating).toBe(testRating.rating);
    });

    it('should return 404 for non-existent rating', async () => {
      // Act
      const response = await request(app)
        .get(`/api/ratings/${nonexistUUID}`)
        .set('Authorization', `Bearer ${userToken}`);

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/ratings/:id', () => {
    it('should update a rating', async () => {
      // Act
      const newRating = 9.0;
      const response = await request(app)
        .put(`/api/ratings/${testRating.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: newRating,
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.rating).toBe(newRating);

      // Update stored rating
      testRating = response.body.data;
    });

    it("should return 403 when trying to update someone else's rating", async () => {
      // Create an admin rating first
      const adminRating = await prisma.mediaRating.create({
        data: {
          userId: testAdmin.id,
          mediaId: testMedia.id,
          rating: 7.0,
        },
      });

      // Act
      const response = await request(app)
        .put(`/api/ratings/${adminRating.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 6.0,
        });

      // Assert
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);

      // Clean up admin rating after this test
      await prisma.mediaRating.delete({
        where: { id: adminRating.id },
      });
    });
  });

  describe('GET /api/ratings/me', () => {
    it('should retrieve authenticated user ratings', async () => {
      // Act// Act
      const response = await request(app)
        .get('/api/ratings/me')
        .set('Authorization', `Bearer ${userToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].userId).toBe(testUser.id);
      expect(response.body.meta).toHaveProperty('pagination');
    });

    it('should return 401 when not authenticated', async () => {
      // Act
      const response = await request(app).get('/api/ratings/me');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/ratings/user/:userId', () => {
    it('should retrieve ratings for a specific user', async () => {
      // Act
      const response = await request(app)
        .get(`/api/ratings/user/${testUser.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].userId).toBe(testUser.id);
    });

    it('should return 404 for non-existent user', async () => {
      // Act
      const response = await request(app)
        .get(`/api/ratings/user/${nonexistUUID}`)
        .set('Authorization', `Bearer ${userToken}`);

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/ratings/media/:mediaId', () => {
    it('should retrieve ratings for a specific media', async () => {
      // Act
      const response = await request(app)
        .get(`/api/ratings/media/${testMedia.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].mediaId).toBe(testMedia.id);
    });

    it('should return empty array for media with no ratings', async () => {
      // Create a media with no ratings
      const emptyMedia = await prisma.media.create({
        data: {
          title: 'Empty Media',
          mediaType: MediaType.MOVIE,
          status: MediaStatus.RELEASED,
        },
      });

      // Act
      const response = await request(app)
        .get(`/api/ratings/media/${emptyMedia.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(0);

      // Clean up
      await prisma.media.delete({ where: { id: emptyMedia.id } });
    });
  });

  describe('DELETE /api/ratings/:id', () => {
    it('should delete a rating', async () => {
      // Act
      const response = await request(app)
        .delete(`/api/ratings/${testRating.id}`)
        .set('Authorization', `Bearer ${userToken}`);
      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify rating is deleted
      const verifyResponse = await request(app)
        .get(`/api/ratings/${testRating.id}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(verifyResponse.status).toBe(404);
    });

    it('should return 404 for non-existent rating', async () => {
      // Act
      const response = await request(app)
        .delete(`/api/ratings/${nonexistUUID}`)
        .set('Authorization', `Bearer ${userToken}`);

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/ratings/admin/:id (admin route)', () => {
    it('should allow admin to delete any rating', async () => {
      // Create a new rating by the user
      const newRating = await prisma.mediaRating.create({
        data: {
          userId: testUser.id,
          mediaId: testMedia.id,
          rating: 7.5,
        },
      });

      // Act (admin deletes user's rating)
      const response = await request(app)
        .delete(`/api/ratings/admin/${newRating.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify rating is deleted
      const verifyResponse = await request(app)
        .get(`/api/ratings/${newRating.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(verifyResponse.status).toBe(404);
    });

    it('should return 403 for non-admin users', async () => {
      // Create a new rating to delete
      const newRating = await prisma.mediaRating.create({
        data: {
          userId: testAdmin.id,
          mediaId: testMedia.id,
          rating: 8.0,
        },
      });

      // Act (regular user tries to use admin route)
      const response = await request(app)
        .delete(`/api/ratings/admin/${newRating.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      // Assert
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);

      // Clean up
      await prisma.mediaRating.delete({
        where: { id: newRating.id },
      });
    });
  });
});
