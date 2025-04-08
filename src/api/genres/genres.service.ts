import { Genre, Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError } from "../../middlewares/error.middleware";
/**
 * Service for managing genres
 */
export class GenreService {
  /**
   * Create a new genre
   * @param data Genre data
   * @returns Created genre
   */
  async createGenre(data: Prisma.GenreCreateInput): Promise<Genre> {
    try {
      return await prisma.genre.create({ data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new AppError("A genre with this name already exists", 409);
        }
      }
      throw error;
    }
  }

  /**
   * Get all genres with optional filtering
   * @param filter Optional filter parameters
   * @param page Page number for pagination
   * @param limit Items per page
   * @returns Array of genres and count
   */
  async getGenres(
    filter: {
      name?: string;
      mediaType?: string;
    } = {},
    page = 1,
    limit = 20
  ): Promise<{ genres: Genre[]; count: number }> {
    const skip = (page - 1) * limit;

    // Build where clause based on filters
    const where: Prisma.GenreWhereInput = {};

    if (filter.name) {
      where.name = { contains: filter.name, mode: "insensitive" };
    }

    // If mediaType is provided, find genres that have media of that type
    if (filter.mediaType) {
      where.media = {
        some: {
          media: {
            mediaType: filter.mediaType as any,
          },
        },
      };
    }

    // Execute count and findMany in parallel for better performance
    const [genres, count] = await Promise.all([
      prisma.genre.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
      }),
      prisma.genre.count({ where }),
    ]);

    return { genres, count };
  }

  /**
   * Get a genre by ID
   * @param id Genre ID
   * @returns Genre data or null if not found
   */
  async getGenreById(id: string): Promise<Genre | null> {
    return prisma.genre.findUnique({
      where: { id },
    });
  }

  /**
   * Get a genre with related media
   * @param id Genre ID
   * @param page Page number for media pagination
   * @param limit Number of media items per page
   * @returns Genre with related media
   */
  async getGenreWithMedia(
    id: string,
    page = 1,
    limit = 20
  ): Promise<{ genre: Genre | null; media: any[]; totalMedia: number }> {
    const genre = await prisma.genre.findUnique({
      where: { id },
    });

    if (!genre) {
      return { genre: null, media: [], totalMedia: 0 };
    }

    const skip = (page - 1) * limit;

    // Get media items for this genre with pagination
    const [genreMedia, totalMedia] = await Promise.all([
      prisma.genreOnMedia.findMany({
        where: { genreId: id },
        skip,
        take: limit,
        include: {
          media: true,
        },
        orderBy: {
          media: {
            title: "asc",
          },
        },
      }),
      prisma.genreOnMedia.count({
        where: { genreId: id },
      }),
    ]);

    // Extract media from relationships
    const media = genreMedia.map((item) => item.media);

    return { genre, media, totalMedia };
  }

  /**
   * Update a genre
   * @param id Genre ID
   * @param data Updated genre data
   * @returns Updated genre
   */
  async updateGenre(id: string, data: Prisma.GenreUpdateInput): Promise<Genre> {
    try {
      return await prisma.genre.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          throw new AppError("Genre not found", 404);
        }
        if (error.code === "P2002") {
          throw new AppError("A genre with this name already exists", 409);
        }
      }
      throw error;
    }
  }

  /**
   * Delete a genre
   * @param id Genre ID
   * @returns Deleted genre
   */
  async deleteGenre(id: string): Promise<Genre> {
    try {
      return await prisma.genre.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          throw new AppError("Genre not found", 404);
        }
        // Check if there are media items using this genre
        if (error.code === "P2003") {
          throw new AppError(
            "Cannot delete genre because it is used by media items",
            400
          );
        }
      }
      throw error;
    }
  }

  /**
   * Associate a genre with a media item
   * @param genreId Genre ID
   * @param mediaId Media ID
   * @returns The created association
   */
  async addGenreToMedia(
    genreId: string,
    mediaId: string
  ): Promise<{ genreId: string; mediaId: string }> {
    try {
      await prisma.genreOnMedia.create({
        data: {
          genreId,
          mediaId,
        },
      });

      return { genreId, mediaId };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new AppError(
            "This genre is already associated with this media",
            409
          );
        }
        if (error.code === "P2003") {
          throw new AppError("Genre or media not found", 404);
        }
      }
      throw error;
    }
  }

  /**
   * Remove a genre from a media item
   * @param genreId Genre ID
   * @param mediaId Media ID
   * @returns Boolean indicating success
   */
  async removeGenreFromMedia(
    genreId: string,
    mediaId: string
  ): Promise<boolean> {
    try {
      await prisma.genreOnMedia.delete({
        where: {
          genreId_mediaId: {
            genreId,
            mediaId,
          },
        },
      });

      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          throw new AppError("Genre is not associated with this media", 404);
        }
      }
      throw error;
    }
  }
}

export default new GenreService();
