import { prisma } from "../../config/database";
import { AppError } from "../../middlewares/error.middleware";
import { MediaList, MediaListItem, User } from "@prisma/client";
import { clearCacheByPattern } from "../../middlewares/cache.middleware";
import { createPagination } from "../../utils/responseFormatter";

/**
 * Service for handling list operations
 */

/**
 * Create a new list for a user
 */
export const createList = async (
  userId: string,
  name: string,
  description?: string,
  isPublic: boolean = false
): Promise<MediaList> => {
  const newList = await prisma.mediaList.create({
    data: {
      userId,
      name,
      description,
      isPublic,
    },
  });

  // Clear user lists cache
  await clearCacheByPattern(`user:${userId}:/api/lists`);

  return newList;
};

/**
 * Update a list
 */
export const updateList = async (
  listId: string,
  data: {
    name?: string;
    description?: string | null;
    isPublic?: boolean;
  }
): Promise<MediaList> => {
  const list = await prisma.mediaList.findUnique({
    where: { id: listId },
  });

  if (!list) {
    throw new AppError("List not found", 404);
  }

  const updatedList = await prisma.mediaList.update({
    where: { id: listId },
    data,
  });

  // Clear list caches
  await clearCacheByPattern(`user:${list.userId}:/api/lists`);
  if (updatedList.isPublic) {
    await clearCacheByPattern(`lists:public:${list.userId}`);
  }

  return updatedList;
};

/**
 * Add an item to a list
 */
export const addItemToList = async (
  listId: string,
  mediaId: string,
  notes?: string
): Promise<MediaListItem> => {
  // Check if the list exists
  const list = await prisma.mediaList.findUnique({
    where: { id: listId },
    include: {
      items: {
        orderBy: { order: "desc" },
        take: 1,
      },
    },
  });

  if (!list) {
    throw new AppError("List not found", 404);
  }

  // Check if the media exists
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
  });

  if (!media) {
    throw new AppError("Media not found", 404);
  }

  // Check if the item already exists in the list
  const existingItem = await prisma.mediaListItem.findFirst({
    where: {
      listId,
      mediaId,
    },
  });

  if (existingItem) {
    throw new AppError("Item already exists in this list", 409);
  }

  // Get the highest order value to place the new item at the end
  const nextOrder = list.items.length > 0 ? list.items[0].order + 1 : 0;

  // Add the item to the list
  const listItem = await prisma.mediaListItem.create({
    data: {
      listId,
      mediaId,
      notes,
      order: nextOrder,
    },
  });

  // Clear list caches

  await clearCacheByPattern(`user:${list.userId}:/api/lists`);
  if (list.isPublic) {
    await clearCacheByPattern(`lists:public:${list.userId}`);
  }

  return listItem;
};

/**
 * Remove an item from a list
 */
export const removeItemFromList = async (
  itemId: string,
  userId: string
): Promise<void> => {
  const item = await prisma.mediaListItem.findUnique({
    where: { id: itemId },
    include: {
      list: true,
    },
  });

  if (!item) {
    throw new AppError("List item not found", 404);
  }

  if (item.list.userId !== userId) {
    throw new AppError("Forbidden - User does not own this list", 403);
  }

  await prisma.mediaListItem.delete({
    where: { id: itemId },
  });

  // Clear list caches
  await clearCacheByPattern(`user:${item.list.userId}:/api/lists`);
  if (item.list.isPublic) {
    await clearCacheByPattern(`lists:public:${item.list.userId}`);
  }
};

/**
 * Reorder items in a list
 */
export const reorderListItems = async (
  listId: string,
  items: Array<{ id: string; order: number }>
): Promise<MediaListItem[]> => {
  const list = await prisma.mediaList.findUnique({
    where: { id: listId },
  });

  if (!list) {
    throw new AppError("List not found", 404);
  }

  // Transaction to update all items at once
  const updatedItems = await prisma.$transaction(
    items.map((item) =>
      prisma.mediaListItem.update({
        where: {
          id: item.id,
          listId: listId,
        },
        data: {
          order: item.order,
        },
      })
    )
  );

  // Clear list caches
  await clearCacheByPattern(`user:${list.userId}:/api/lists`);
  if (list.isPublic) {
    await clearCacheByPattern(`lists:public:${list.userId}`);
  }

  return updatedItems;
};

/**
 * Get popular public lists
 */
export const getPopularLists = async (limit: number = 10): Promise<any[]> => {
  const lists = await prisma.mediaList.findMany({
    where: {
      isPublic: true,
    },
    take: limit,
    include: {
      _count: {
        select: { items: true },
      },
      user: {
        select: {
          username: true,
          avatar: true,
        },
      },
    },
    orderBy: [
      {
        items: {
          _count: "desc",
        },
      },
      { updatedAt: "desc" },
    ],
  });

  return lists.map((list) => ({
    id: list.id,
    name: list.name,
    description: list.description,
    itemCount: list._count.items,
    user: list.user,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
  }));
};

/**
 * Share a list with another user (creates a notification)
 */
export const shareList = async (
  listId: string,
  sharedByUserId: string,
  sharedWithUserId: string
): Promise<void> => {
  // Check if the list exists and is public
  const list = await prisma.mediaList.findUnique({
    where: {
      id: listId,
      isPublic: true,
    },
    include: {
      user: {
        select: {
          username: true,
        },
      },
    },
  });

  if (!list) {
    throw new AppError("List not found or is not public", 404);
  }

  // Check if the user we're sharing with exists
  const targetUser = await prisma.user.findUnique({
    where: { id: sharedWithUserId },
  });

  if (!targetUser) {
    throw new AppError("User not found", 404);
  }

  // Create a notification for the shared user
  await prisma.notification.create({
    data: {
      userId: sharedWithUserId,
      type: "LIST_SHARE",
      title: "List Shared With You",
      message: `${list.user.username} shared their list "${list.name}" with you`,
      data: {
        listId: list.id,
        sharedByUserId,
      },
    },
  });
};

export const getListByUser = async (
  userId: string,
  page: number,
  skip: number,
  limit: number
): Promise<any> => {
  const [lists, total] = await Promise.all([
    prisma.mediaList.findMany({
      where: { userId },
      skip,
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { items: true },
        },
      },
    }),
    prisma.mediaList.count({
      where: { userId },
    }),
  ]);

  // Format the response
  const formattedLists = lists.map((list) => ({
    id: list.id,
    name: list.name,
    description: list.description,
    isPublic: list.isPublic,
    itemCount: list._count.items,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
  }));

  const pagination = createPagination(page, limit, total);

  return [formattedLists, pagination];
};

export const getListById = async (
  id: string,
  userId: string
): Promise<MediaList> => {
  const list = await prisma.mediaList.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          media: {
            include: {
              genres: {
                include: {
                  genre: true,
                },
              },
            },
          },
        },
        orderBy: { order: "asc" },
      },
      _count: {
        select: { items: true },
      },
    },
  });

  if (!list) {
    throw new AppError("List not found", 404);
  }

  // Check if user has permission to view this list
  if (!list.isPublic && list.userId !== userId) {
    throw new AppError("You do not have permission to view this list", 403);
  }

  // Format the response
  const formattedItems = list.items.map((item) => ({
    id: item.id,
    mediaId: item.mediaId,
    listId: item.listId,
    notes: item.notes,
    order: item.order,
    media: {
      id: item.media.id,
      title: item.media.title,
      mediaType: item.media.mediaType,
      coverImage: item.media.coverImage,
      releaseDate: item.media.releaseDate,
      averageRating: item.media.averageRating,
      genres: item.media.genres.map((g) => g.genre.name),
    },
  }));

  const formattedList = {
    id: list.id,
    name: list.name,
    description: list.description,
    isPublic: list.isPublic,
    userId: list.userId,
    itemCount: list._count.items,
    items: formattedItems,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
  };

  return formattedList;
};

export const updateListItem = async (
  itemId: string,
  notes: string,
  user: Express.User
) => {
  const item = await prisma.mediaListItem.findUnique({
    where: { id: itemId },
    include: {
      list: true,
    },
  });

  if (!item) {
    throw new AppError("List item not found", 404);
  }

  if (
    item.list.userId !== user.id &&
    user.role !== "ADMIN" &&
    user.role !== "MODERATOR"
  ) {
    throw new AppError("Forbidden - User does not own this list", 403);
  }

  // Update the item
  const updatedItem = await prisma.mediaListItem.update({
    where: { id: itemId },
    data: {
      notes,
    },
    include: {
      media: {
        select: {
          title: true,
        },
      },
    },
  });

  await clearCacheByPattern(`user:${item.list.userId}:/api/lists`);
  if (item.list.isPublic) {
    await clearCacheByPattern(`lists:public:${item.list.userId}`);
  }

  return updatedItem;
};

export const getUserPublicLists = async (
  userId: string,
  page: number,
  skip: number,
  limit: number
) => {
  const [lists, total] = await Promise.all([
    prisma.mediaList.findMany({
      where: {
        userId,
        isPublic: true,
      },
      skip,
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { items: true },
        },
        user: {
          select: {
            username: true,
            avatar: true,
          },
        },
      },
    }),
    prisma.mediaList.count({
      where: {
        userId,
        isPublic: true,
      },
    }),
  ]);

  const formattedLists = lists.map((list) => ({
    id: list.id,
    name: list.name,
    description: list.description,
    itemCount: list._count.items,
    user: list.user,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
  }));

  const pagination = createPagination(page, limit, total);

  return [formattedLists, pagination];
};

export default {
  getListByUser,
  getUserPublicLists,
  shareList,
  updateListItem,
  addItemToList,
  updateList,
  createList,
  removeItemFromList,
  reorderListItems,
  getPopularLists,
};
