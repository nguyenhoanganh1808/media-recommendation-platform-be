import request from 'supertest';
import { Express } from 'express';
import { disconnectDB, prisma } from '../../src/config/database';
import { hashPassword, comparePasswords } from '../../src/utils/password';
import { generateAccessToken, generateRefreshToken } from '../../src/utils/jwt';
import app from '../../src/app';

let server: Express;
let testUser = {
  email: 'test@example.com',
  username: 'testuser',
  password: 'TestPassword123',
  hashedPassword: '',
};
let accessToken = '';
let refreshToken = '';

beforeAll(async () => {
  server = app;
  testUser.hashedPassword = await hashPassword(testUser.password);
});

afterAll(async () => {
  await prisma.refreshToken.deleteMany({
    where: { user: { email: testUser.email } },
  });
  await prisma.user.deleteMany({ where: { email: testUser.email } });
  disconnectDB();
});

describe('Auth Service Unit Tests', () => {
  test('should hash password correctly', async () => {
    const hashed = await hashPassword(testUser.password);
    expect(hashed).not.toBe(testUser.password);
  });

  test('should compare password correctly', async () => {
    const isMatch = await comparePasswords(
      testUser.password,
      testUser.hashedPassword
    );
    expect(isMatch).toBe(true);
  });

  test('should generate access token', () => {
    const token = generateAccessToken({
      id: '1',
      email: testUser.email,
      role: 'ADMIN',
      password: '',
      isActive: true,
      avatar: '',
      bio: '',
      createdAt: new Date(),
      firstName: '',
      lastLogin: new Date(),
      lastName: '',
      updatedAt: new Date(),
      username: '',
    });
    expect(token).toBeDefined();
  });

  test('should generate refresh token', () => {
    const token = generateRefreshToken({
      id: '1',
      email: testUser.email,
      role: 'ADMIN',
      password: '',
      isActive: true,
      avatar: '',
      bio: '',
      createdAt: new Date(),
      firstName: '',
      lastLogin: new Date(),
      lastName: '',
      updatedAt: new Date(),
      username: '',
    });
    expect(token).toBeDefined();
  });
});
