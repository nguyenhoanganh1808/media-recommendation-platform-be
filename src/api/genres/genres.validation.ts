import { body, param, query } from "express-validator";

/**
 * Validation rules for genre-related routes
 */
export const genreValidation = {
  createGenre: [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Genre name is required")
      .isLength({ min: 2, max: 50 })
      .withMessage("Genre name must be between 2 and 50 characters"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Description must not exceed 500 characters"),
  ],

  updateGenre: [
    param("id").isUUID().withMessage("Invalid genre ID format"),
    body("name")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Genre name cannot be empty")
      .isLength({ min: 2, max: 50 })
      .withMessage("Genre name must be between 2 and 50 characters"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Description must not exceed 500 characters"),
  ],

  getGenres: [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer")
      .toInt(),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100")
      .toInt(),
    query("name")
      .optional()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Name filter cannot be empty"),
    query("mediaType")
      .optional()
      .trim()
      .isIn(["MOVIE", "GAME", "MANGA"])
      .withMessage("Media type must be MOVIE, GAME, or MANGA"),
  ],

  getGenreById: [param("id").isUUID().withMessage("Invalid genre ID format")],

  getGenreWithMedia: [
    param("id").isUUID().withMessage("Invalid genre ID format"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer")
      .toInt(),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100")
      .toInt(),
  ],

  deleteGenre: [param("id").isUUID().withMessage("Invalid genre ID format")],

  addGenreToMedia: [
    param("genreId").isUUID().withMessage("Invalid genre ID format"),
    param("mediaId").isUUID().withMessage("Invalid media ID format"),
  ],

  removeGenreFromMedia: [
    param("genreId").isUUID().withMessage("Invalid genre ID format"),
    param("mediaId").isUUID().withMessage("Invalid media ID format"),
  ],
};

export default genreValidation;
