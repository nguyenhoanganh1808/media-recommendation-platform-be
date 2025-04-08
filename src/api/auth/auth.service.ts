import { User, Role } from '@prisma/client';
import { prisma } from '../../config/database';
import { comparePasswords, hashPassword } from '../../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiryDate,
} from '../../utils/jwt';
import { AppError } from '../../middlewares/error.middleware';
import { clearCacheByPattern } from '../../middlewares/cache.middleware';

interface CreateUserInput {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Create a new user
 */
export const createUser = async (userData: CreateUserInput): Promise<User> => {
  // Check if user with email or username already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: userData.email }, { username: userData.username }],
    },
  });

  if (existingUser) {
    if (existingUser.email === userData.email) {
      throw new AppError('Email already in use', 409);
    }
    throw new AppError('Username already in use', 409);
  }

  // Hash the password
  const hashedPassword = await hashPassword(userData.password);

  // Create the user
  const user = await prisma.user.create({
    data: {
      email: userData.email,
      username: userData.username,
      password: hashedPassword,
      firstName: userData.firstName,
      lastName: userData.lastName,
      lastLogin: new Date(),
    },
  });

  return user;
};

/**
 * Generate authentication tokens
 */
export const generateAuthTokens = async (user: User) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  const expiresAt = getRefreshTokenExpiryDate();

  // Store refresh token in the database
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt,
    },
  });

  return {
    accessToken,
    refreshToken,
  };
};

/**
 * Login with email and password
 */
export const loginWithEmailAndPassword = async (
  email: string,
  password: string
) => {
  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  // Check if the account is active
  if (!user.isActive) {
    throw new AppError('Account is deactivated. Please contact support.', 403);
  }

  // Verify password
  const isPasswordMatch = await comparePasswords(password, user.password);
  if (!isPasswordMatch) {
    throw new AppError('Invalid email or password', 401);
  }

  // Generate tokens
  const { accessToken, refreshToken } = await generateAuthTokens(user);

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  return {
    user,
    accessToken,
    refreshToken,
  };
};

/**
 * Logout user - invalidate refresh token
 */
export const logout = async (userId: string, refreshToken: string) => {
  // Delete the refresh token
  await prisma.refreshToken.deleteMany({
    where: {
      userId,
      token: refreshToken,
    },
  });

  // Clear user-specific cache
  await clearCacheByPattern(`user:${userId}`);
};

/**
 * Refresh authentication
 */
export const refreshAuth = async (userId: string, refreshToken: string) => {
  // Find the refresh token in the database
  const tokenRecord = await prisma.refreshToken.findFirst({
    where: {
      userId,
      token: refreshToken,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: true,
    },
  });

  if (!tokenRecord) {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  // Generate new tokens
  const accessToken = generateAccessToken(tokenRecord.user);
  const newRefreshToken = generateRefreshToken(tokenRecord.user);
  const expiresAt = getRefreshTokenExpiryDate();

  // Update refresh token in the database
  await prisma.refreshToken.update({
    where: { id: tokenRecord.id },
    data: {
      token: newRefreshToken,
      expiresAt,
    },
  });

  return {
    accessToken,
    newRefreshToken,
  };
};

/**
 * Get user by ID
 */
export const getUserById = async (userId: string): Promise<User | null> => {
  return prisma.user.findUnique({
    where: { id: userId },
  });
};

/**
 * Change user password
 */
export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
) => {
  // Get user
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Verify current password
  const isPasswordMatch = await comparePasswords(
    currentPassword,
    user.password
  );
  if (!isPasswordMatch) {
    throw new AppError('Current password is incorrect', 401);
  }

  // Hash new password
  const hashedPassword = await hashPassword(newPassword);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  // Invalidate all refresh tokens for security
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });
};

export default {
  createUser,
  generateAuthTokens,
  loginWithEmailAndPassword,
  logout,
  refreshAuth,
  getUserById,
  changePassword,
};
