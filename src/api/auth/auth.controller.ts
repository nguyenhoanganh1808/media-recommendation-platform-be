import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../../utils/responseFormatter';
import authService from './auth.service';
import asyncHandler from '../../utils/asyncHandler';
import { AppError } from '../../middlewares/error.middleware';

/**
 * Register a new user
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, username, password, firstName, lastName } = req.body;

  const user = await authService.createUser({
    email,
    username,
    password,
    firstName,
    lastName,
  });

  // Generate tokens
  const { accessToken, refreshToken } =
    await authService.generateAuthTokens(user);

  sendSuccess(
    res,
    {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      accessToken,
      refreshToken,
    },
    'User registered successfully',
    201
  );
});

/**
 * Login user
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const { user, accessToken, refreshToken } =
    await authService.loginWithEmailAndPassword(email, password);

  sendSuccess(
    res,
    {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      accessToken,
      refreshToken,
    },
    'Login successful'
  );
});

/**
 * Logout user
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('User not authenticated', 401);
  }

  await authService.logout(req.user.id, req.body.refreshToken);

  sendSuccess(res, null, 'Logout successful');
});

/**
 * Refresh access token
 */
export const refreshToken = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }

    const { refreshToken } = req.body;

    const { accessToken, newRefreshToken } = await authService.refreshAuth(
      req.user.id,
      refreshToken
    );

    sendSuccess(
      res,
      {
        accessToken,
        refreshToken: newRefreshToken,
      },
      'Token refreshed successfully'
    );
  }
);

/**
 * Get current user profile
 */
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('User not authenticated', 401);
  }

  const user = await authService.getUserById(req.user.id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  sendSuccess(
    res,
    {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      bio: user.bio,
      avatar: user.avatar,
      role: user.role,
      createdAt: user.createdAt,
    },
    'User profile retrieved successfully'
  );
});

/**
 * Change password
 */
export const changePassword = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }

    const { currentPassword, newPassword } = req.body;

    await authService.changePassword(req.user.id, currentPassword, newPassword);

    sendSuccess(res, null, 'Password changed successfully');
  }
);

export default {
  register,
  login,
  logout,
  refreshToken,
  getProfile,
  changePassword,
};
