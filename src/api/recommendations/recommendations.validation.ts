// src/api/recommendations/recommendations.validation.ts
import { body, query, param } from "express-validator";
import { MediaType } from "@prisma/client";

export const getRecommendationsValidation = [
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be at least 1")
    .toInt(),
  query("mediaType")
    .optional()
    .isIn(Object.values(MediaType))
    .withMessage("Invalid media type"),
  query("includeRated")
    .optional()
    .isBoolean()
    .withMessage("includeRated must be a boolean")
    .toBoolean(),
];

export const getMediaBasedRecommendationsValidation = [
  param("mediaId").isUUID().withMessage("Invalid media ID"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),
];

export const updateUserPreferencesValidation = [
  body("genreIds")
    .optional()
    .isArray()
    .withMessage("genreIds must be an array"),
  body("genreIds.*")
    .optional()
    .isUUID()
    .withMessage("Each genre ID must be a valid UUID"),
  body("mediaTypePreferences")
    .optional()
    .isArray()
    .withMessage("mediaTypePreferences must be an array"),
  body("mediaTypePreferences.*.type")
    .optional()
    .isIn(Object.values(MediaType))
    .withMessage("Each media type preference must be valid"),
  body("mediaTypePreferences.*.strength")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("Preference strength must be between 0 and 1"),
];
