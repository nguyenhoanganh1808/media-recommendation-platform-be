import { Request, Response, NextFunction } from "express";
import genreService from "./genres.service";
import asyncHandler from "../../utils/asyncHandler";
import { sendSuccess, createPagination } from "../../utils/responseFormatter";
import { clearCacheByPattern } from "../../middlewares/cache.middleware";

/**
 * Controller for genre-related routes
 */
export class GenreController {
  /**
   * Create a new genre
   * @route POST /api/genres
   */
  createGenre = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const { name, description } = req.body;
      const genre = await genreService.createGenre({ name, description });

      // Clear cache for genres
      await clearCacheByPattern("genres");

      sendSuccess(res, genre, "Genre created successfully", 201);
    }
  );

  /**
   * Get all genres with optional filtering
   * @route GET /api/genres
   */
  getGenres = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const name = req.query.name as string;
      const mediaType = req.query.mediaType as string;

      const { genres, count } = await genreService.getGenres(
        { name, mediaType },
        page,
        limit
      );

      const meta = createPagination(page, limit, count);
      sendSuccess(res, genres, "Genres retrieved successfully", 200, meta);
    }
  );

  /**
   * Get a genre by ID
   * @route GET /api/genres/:id
   */
  getGenreById = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const { id } = req.params;
      const genre = await genreService.getGenreById(id);

      if (!genre) {
        return sendSuccess(res, null, "Genre not found", 404);
      }

      sendSuccess(res, genre, "Genre retrieved successfully");
    }
  );

  /**
   * Get a genre with its related media
   * @route GET /api/genres/:id/media
   */
  getGenreWithMedia = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const { id } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const { genre, media, totalMedia } = await genreService.getGenreWithMedia(
        id,
        page,
        limit
      );

      if (!genre) {
        return sendSuccess(res, null, "Genre not found", 404);
      }

      const meta = createPagination(page, limit, totalMedia);
      sendSuccess(
        res,
        { genre, media },
        "Genre with media retrieved successfully",
        200,
        meta
      );
    }
  );

  /**
   * Update a genre
   * @route PUT /api/genres/:id
   */
  updateGenre = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const { id } = req.params;
      const { name, description } = req.body;

      const genre = await genreService.updateGenre(id, { name, description });

      // Clear cache for genres
      await clearCacheByPattern("genres");

      sendSuccess(res, genre, "Genre updated successfully");
    }
  );

  /**
   * Delete a genre
   * @route DELETE /api/genres/:id
   */
  deleteGenre = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const { id } = req.params;

      await genreService.deleteGenre(id);

      // Clear cache for genres
      await clearCacheByPattern("genres");

      sendSuccess(res, null, "Genre deleted successfully");
    }
  );

  /**
   * Add a genre to a media item
   * @route POST /api/genres/:genreId/media/:mediaId
   */
  addGenreToMedia = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const { genreId, mediaId } = req.params;

      const result = await genreService.addGenreToMedia(genreId, mediaId);

      // Clear cache for both genres and media
      await Promise.all([
        clearCacheByPattern("genres"),
        clearCacheByPattern("media"),
      ]);

      sendSuccess(res, result, "Genre added to media successfully");
    }
  );

  /**
   * Remove a genre from a media item
   * @route DELETE /api/genres/:genreId/media/:mediaId
   */
  removeGenreFromMedia = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const { genreId, mediaId } = req.params;

      await genreService.removeGenreFromMedia(genreId, mediaId);

      // Clear cache for both genres and media
      await Promise.all([
        clearCacheByPattern("genres"),
        clearCacheByPattern("media"),
      ]);

      sendSuccess(res, null, "Genre removed from media successfully");
    }
  );
}

export default new GenreController();
