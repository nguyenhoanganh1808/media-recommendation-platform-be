import jwt from 'jsonwebtoken';
import { User } from '@prisma/client';
import { config } from '../config/env';
import { randomUUID } from 'crypto';

/**
 * Payload type for JWT tokens
 */
interface TokenPayload {
  userId: string;
  role: string;
  email: string;
}

interface RefreshTokenPayload extends TokenPayload {
  jti: string;
}
/**
 * Generates an access token for a user
 *
 * @param user The user object for which to generate a token
 * @returns The generated JWT token
 */
export const generateAccessToken = (user: User): string => {
  const payload: TokenPayload = {
    userId: user.id,
    role: user.role,
    email: user.email,
  };

  return jwt.sign(payload, config.JWT_SECRET!, {
    expiresIn: '1h',
  });
};

/**
 * Generates a refresh token for a user
 *
 * @param user The user object for which to generate a refresh token
 * @returns The generated refresh token
 */
export const generateRefreshToken = (user: User): string => {
  const payload: RefreshTokenPayload = {
    userId: user.id,
    role: user.role,
    email: user.email,
    jti: randomUUID(),
  };
  // Generate a random token
  return jwt.sign(payload, config.JWT_REFRESH_SECRET!, {
    expiresIn: '7d',
  });
};

/**
 * Verifies a JWT token
 *
 * @param token The token to verify
 * @returns The decoded token payload or null if invalid
 */
export const verifyToken = (token: string): TokenPayload | null => {
  try {
    return jwt.verify(token, config.JWT_SECRET!) as TokenPayload;
  } catch (error) {
    return null;
  }
};

/**
 * Calculate expiration date for a refresh token
 *
 * @returns Date when the refresh token will expire
 */
export const getRefreshTokenExpiryDate = (): Date => {
  const expiresInMilliseconds = parseTimeToMilliseconds(
    config.JWT_REFRESH_EXPIRES_IN
  );
  return new Date(Date.now() + expiresInMilliseconds);
};

/**
 * Parse time string like "7d" to milliseconds
 *
 * @param timeString Time string (e.g., "7d", "15m", "24h")
 * @returns Time in milliseconds
 */
const parseTimeToMilliseconds = (timeString: string): number => {
  const unit = timeString.slice(-1);
  const value = parseInt(timeString.slice(0, -1));

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return value;
  }
};

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  getRefreshTokenExpiryDate,
};
