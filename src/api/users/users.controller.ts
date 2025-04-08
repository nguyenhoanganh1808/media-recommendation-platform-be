import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/responseFormatter";
import * as userService from "./users.service";
import { AppError } from "../../middlewares/error.middleware";

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const userData = req.body;

  // Remove sensitive fields

  const user = await userService.createUser(userData);

  // Don't return the password in the response
  const { password, ...userWithoutPassword } = user;

  sendSuccess(res, userWithoutPassword, "User created successfully", 201);
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.id;
  const currentUserId = req.user?.id;
  const user = await userService.getUserById(userId, currentUserId);

  // Don't return the password
  const { password, ...userWithoutPassword } = user;

  sendSuccess(res, userWithoutPassword, "User retrieved successfully");
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.id;
  const authUser = req.user!;

  // Check if the user is updating their own profile or is an admin
  if (userId !== authUser.id && authUser.role !== "ADMIN") {
    throw new AppError("You do not have permission to update this user", 403);
  }

  const updatedUser = await userService.updateUser(userId, req.body);

  // Don't return the password
  const { password, ...userWithoutPassword } = updatedUser;

  sendSuccess(res, userWithoutPassword, "User updated successfully");
});

export const followUser = asyncHandler(async (req: Request, res: Response) => {
  const followerId = req.user!.id;
  const followingId = req.params.id;

  await userService.followUser(followerId, followingId);

  sendSuccess(res, null, "User followed successfully");
});

export const unfollowUser = asyncHandler(
  async (req: Request, res: Response) => {
    const followerId = req.user!.id;
    const followingId = req.params.id;

    await userService.unfollowUser(followerId, followingId);

    sendSuccess(res, null, "User unfollowed successfully");
  }
);

export const getUserFollowers = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.params.id;
    const currentUserId = req.user?.id;
    const followers = await userService.getUserFollowers(userId, currentUserId);

    // Don't return passwords
    const followersWithoutPasswords = followers.map((follower) => {
      const { password, ...userWithoutPassword } = follower;
      return userWithoutPassword;
    });

    sendSuccess(
      res,
      followersWithoutPasswords,
      "User followers retrieved successfully"
    );
  }
);

export const getUserFollowing = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.params.id;
    const currentUserId = req.user?.id;

    const following = await userService.getUserFollowing(userId, currentUserId);

    // Don't return passwords
    const followingWithoutPasswords = following.map((user) => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    sendSuccess(
      res,
      followingWithoutPasswords,
      "User following retrieved successfully"
    );
  }
);

export default {
  createUser,
  getUser,
  updateUser,
  followUser,
  unfollowUser,
  getUserFollowers,
  getUserFollowing,
};
