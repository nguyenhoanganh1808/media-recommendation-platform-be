import { body, param, query } from "express-validator";

export const createRatingValidation = [
  body("mediaId").isUUID().withMessage("Valid media ID is required"),
  body("rating")
    .isFloat({ min: 1, max: 10 })
    .withMessage("Rating must be a number between 1 and 10"),
];

export const updateRatingValidation = [
  param("id").isUUID().withMessage("Valid rating ID is required"),
  body("rating")
    .isFloat({ min: 1, max: 10 })
    .withMessage("Rating must be a number between 1 and 10"),
];

export const deleteRatingValidation = [
  param("id").isUUID().withMessage("Valid rating ID is required"),
];

export const getRatingValidation = [
  param("id").isUUID().withMessage("Valid rating ID is required"),
];

export const getMediaRatingsValidation = [
  param("mediaId").isUUID().withMessage("Valid media ID is required"),
];

export const getUserRatingsValidation = [
  param("userId").isUUID().withMessage("Valid user ID is required"),
];

export const userRatingsQueryValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

// Add this to ratings.validation.ts
export const getUserMediaRatingValidation = [
  param("mediaId").isUUID().withMessage("Valid media ID is required"),
];
