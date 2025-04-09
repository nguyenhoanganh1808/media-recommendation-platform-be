// media.service.ts
import { MediaStatus, MediaType, Prisma } from "@prisma/client";

import { prisma } from "../../config/database";
import { createPagination } from "../../utils/responseFormatter";

interface MediaQueryParams {
  page: number;
  limit: number;
  type?: MediaType;
  genre?: string;
  search?: string;
  sortBy: string;
  sortOrder: string;
}

interface CreateMediaInput {
  title: string;
  description?: string | null;
  releaseDate?: Date | string | null;
  mediaType: MediaType; // adjust based on your enum
  status?: MediaStatus;
  coverImage?: string | null;
  backdropImage?: string | null;
  // Media-specific fields
  duration?: number | null; // Movies
  director?: string | null; // Movies
  developer?: string | null; // Games
  publisher?: string | null; // Games
  platforms?: string[]; // Games - platform IDs
  author?: string | null; // Manga
  artist?: string | null; // Manga
  volumeCount?: number | null; // Manga
  isCompleted?: boolean | null; // Manga
  genres?: string[]; // genre IDs
}

// Get all media with filtering and pagination
export const getAllMedia = async ({
  page,
  limit,
  type,
  genre,
  search,
  sortBy,
  sortOrder,
}: MediaQueryParams) => {
  // Build filters
  const filters: Prisma.MediaWhereInput = {};
  if (type) filters.mediaType = type;

  // Handle search
  const searchFilter: Prisma.MediaWhereInput = search
    ? { title: { contains: search, mode: "insensitive" } }
    : {};

  // Handle genre filter
  const genreFilter = genre
    ? { genres: { some: { genre: { name: genre } } } }
    : {};

  // Get total count
  const total = await prisma.media.count({
    where: { ...filters, ...searchFilter, ...genreFilter },
  });

  // Get paginated results
  const media = await prisma.media.findMany({
    where: { ...filters, ...searchFilter, ...genreFilter },
    include: {
      genres: { include: { genre: true } },
      ratings: { select: { rating: true } },
    },
    orderBy: { [sortBy]: sortOrder },
    skip: (page - 1) * limit,
    take: limit,
  });
  const pagination = createPagination(page, limit, total);
  return {
    media,
    pagination,
  };
};

// Get media by ID
export const getMediaById = async (id: string) => {
  return prisma.media.findUnique({
    where: { id },
    include: {
      genres: { include: { genre: true } },
      ratings: true,
      reviews: {
        where: { isVisible: true },
        include: {
          user: { select: { id: true, username: true, avatar: true } },
        },
      },
    },
  });
};

// Create new media
export const createMedia = async (mediaData: CreateMediaInput) => {
  const {
    title,
    description,
    releaseDate,
    mediaType,
    genres,
    status,
    coverImage,
    backdropImage,
    // Media-specific fields
    duration,
    director, // Movies
    developer,
    publisher,
    platforms, // Games
    author,
    artist,
    volumeCount,
    isCompleted, // Manga
  } = mediaData;

  // Create media with appropriate fields based on type
  return prisma.media.create({
    data: {
      title,
      description,
      releaseDate: releaseDate ? new Date(releaseDate) : undefined,
      mediaType,
      status,
      coverImage,
      backdropImage,
      // Conditional fields based on media type
      ...(mediaType === "MOVIE" ? { duration, director } : {}),
      ...(mediaType === "GAME" ? { developer, publisher } : {}),
      ...(mediaType === "MANGA"
        ? { author, artist, volumeCount, isCompleted }
        : {}),
      // Connect genres if provided
      ...(genres && genres.length > 0
        ? {
            genres: {
              create: genres.map((genreId) => ({
                genre: { connect: { id: genreId } },
              })),
            },
          }
        : {}),
      // If platforms are provided for games
      ...(mediaType === "GAME" && platforms && platforms.length > 0
        ? { platforms: { connect: platforms.map((id) => ({ id })) } }
        : {}),
    },
  });
};

// Update media
export const updateMedia = async (id: string, mediaData: CreateMediaInput) => {
  const {
    title,
    description,
    releaseDate,
    mediaType,
    genres,
    status,
    coverImage,
    backdropImage,
    // Media-specific fields
    duration,
    director, // Movies
    developer,
    publisher,
    platforms, // Games
    author,
    artist,
    volumeCount,
    isCompleted, // Manga
  } = mediaData;

  // Update media with appropriate fields based on type
  return prisma.media.update({
    where: { id },
    data: {
      title,
      description,
      releaseDate: releaseDate ? new Date(releaseDate) : undefined,
      mediaType,
      status,
      coverImage,
      backdropImage,
      // Conditional fields based on media type
      ...(mediaType === "MOVIE" ? { duration, director } : {}),
      ...(mediaType === "GAME" ? { developer, publisher } : {}),
      ...(mediaType === "MANGA"
        ? { author, artist, volumeCount, isCompleted }
        : {}),
      // Connect genres if provided
      ...(genres && genres.length > 0
        ? {
            genres: {
              create: genres.map((genreId: string) => ({
                genre: { connect: { id: genreId } },
              })),
            },
          }
        : {}),
      // If platforms are provided for games
      ...(mediaType === "GAME" && platforms && platforms.length > 0
        ? { platforms: { connect: platforms.map((id: string) => ({ id })) } }
        : {}),
    },
  });
};

// Delete media
export const deleteMedia = async (id: string) => {
  return prisma.media.delete({ where: { id } });
};

export default {
  getAllMedia,
  getMediaById,
  createMedia,
  updateMedia,
  deleteMedia,
};
