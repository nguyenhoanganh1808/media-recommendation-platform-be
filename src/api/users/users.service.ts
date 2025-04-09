import { User, Role } from "@prisma/client";
import { hashPassword } from "../../utils/password";
import { AppError } from "../../middlewares/error.middleware";
import { prisma } from "../../config/database";
import * as notificationService from "../notifications/notifications.service";
import { logger } from "../../config/logger";
import { clearCacheByPattern } from "../../middlewares/cache.middleware";

export interface CreateUserDTO {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  role?: Role;
}

export interface UpdateUserDTO {
  firstName?: string;
  lastName?: string;
  bio?: string;
  avatar?: string;
  email?: string;
  username?: string;
}

export const createUser = async (userData: CreateUserDTO): Promise<User> => {
  // Check if user with email or username already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: userData.email }, { username: userData.username }],
    },
  });

  if (existingUser) {
    throw new AppError("User with this email or username already exists", 409);
  }

  // Hash password before storing
  const hashedPassword = await hashPassword(userData.password);

  // Create the user
  return prisma.user.create({
    data: {
      ...userData,
      password: hashedPassword,
    },
  });
};

export const getUserById = async (
  id: string,
  currentUserId?: string,
): Promise<
  User & {
    stats: {
      followersCount: number;
      followingCount: number;
      listsCount: number;
      ratingsCount: number;
    };

    isFollowing: boolean;
  }
> => {
  const [
    user,
    followersCount,
    followingCount,
    listsCount,
    ratingsCount,
    followRelation,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
    }),
    prisma.follow.count({
      where: { followingId: id },
    }),
    prisma.follow.count({
      where: { followerId: id },
    }),
    prisma.mediaList.count({
      where: { userId: id },
    }),

    prisma.mediaRating.count({
      where: { userId: id },
    }),
    currentUserId
      ? prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: currentUserId,
              followingId: id,
            },
          },
        })
      : null,
  ]);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return {
    ...user,
    stats: {
      followersCount,
      followingCount,
      listsCount,
      ratingsCount,
    },
    isFollowing: !!followRelation,
  };
};

export const updateUser = async (
  id: string,
  userData: UpdateUserDTO,
): Promise<User> => {
  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Update user
  return prisma.user.update({
    where: { id },
    data: userData,
  });
};

export const followUser = async (
  followerId: string,
  followingId: string,
): Promise<void> => {
  // Prevent self-following
  if (followerId === followingId) {
    throw new AppError("You cannot follow yourself", 400);
  }

  // Check if both users exist
  const users = await prisma.$transaction([
    prisma.user.findUnique({ where: { id: followerId } }),
    prisma.user.findUnique({ where: { id: followingId } }),
  ]);

  if (!users[0] || !users[1]) {
    throw new AppError("One or both users not found", 404);
  }

  // Check if already following
  const existingFollow = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId,
        followingId,
      },
    },
  });

  if (existingFollow) {
    throw new AppError("Already following this user", 409);
  }

  // Create follow relationship
  await prisma.follow.create({
    data: {
      followerId,
      followingId,
    },
  });

  // Create notification for the followed user
  await notificationService.createNotification(
    followingId,
    "NEW_FOLLOWER",
    "New Follower",
    `User ${users[0].username} started following you`,
    {
      followerId,
      followerUsername: users[0].username,
    },
  );

  // Delete cache
  await clearCacheByPattern(`user:${followingId}:/api/followers`);
  await clearCacheByPattern(`user:${followingId}:/api/following`);
};

export const unfollowUser = async (
  followerId: string,
  followingId: string,
): Promise<void> => {
  // Check if follow relationship exists
  const follow = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId,
        followingId,
      },
    },
  });

  if (!follow) {
    throw new AppError("Not following this user", 404);
  }

  // Remove follow relationship
  await prisma.follow.delete({
    where: {
      followerId_followingId: {
        followerId,
        followingId,
      },
    },
  });
  // Delete cache
  await clearCacheByPattern(`user:${followingId}:/api/followers`);
  await clearCacheByPattern(`user:${followingId}:/api/following`);
};

export const getUserFollowers = async (
  userId: string,
  currentUserId?: string,
): Promise<(User & { isFollowing: boolean })[]> => {
  const followers = await prisma.follow.findMany({
    where: { followingId: userId },
    include: {
      follower: true,
    },
  });

  return followers.map((follow) => ({
    ...follow.follower,
    isFollowing: currentUserId ? follow.followerId === currentUserId : false,
  }));
};

export const getUserFollowing = async (
  userId: string,
  currentUserId?: string,
): Promise<(User & { isFollowing: boolean })[]> => {
  const following = await prisma.follow.findMany({
    where: { followerId: userId },
    include: {
      following: true,
    },
  });

  return following.map((follow) => ({
    ...follow.following,
    isFollowing: currentUserId ? follow.followerId === currentUserId : false,
  }));
};

export default {
  createUser,
  getUserById,
  updateUser,
  followUser,
  unfollowUser,
  getUserFollowers,
  getUserFollowing,
};
