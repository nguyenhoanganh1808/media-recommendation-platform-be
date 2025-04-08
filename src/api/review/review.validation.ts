import { body, param } from "express-validator";

export const createReviewValidation = [
  body("mediaId")
    .notEmpty()
    .withMessage("Media ID is required")
    .isUUID()
    .withMessage("Invalid media ID format"),
  body("content")
    .notEmpty()
    .withMessage("Review content is required")
    .isString()
    .withMessage("Review content must be a string")
    .isLength({ min: 10, max: 5000 })
    .withMessage("Review content must be between 10 and 5000 characters"),
  body("isVisible")
    .optional()
    .isBoolean()
    .withMessage("isVisible must be a boolean value"),
  body("containsSpoilers")
    .optional()
    .isBoolean()
    .withMessage("containsSpoilers must be a boolean value"),
];

export const updateReviewValidation = [
  param("id")
    .notEmpty()
    .withMessage("Review ID is required")
    .isUUID()
    .withMessage("Invalid review ID format"),
  body("content")
    .optional()
    .isString()
    .withMessage("Review content must be a string")
    .isLength({ min: 10, max: 5000 })
    .withMessage("Review content must be between 10 and 5000 characters"),
  body("isVisible")
    .optional()
    .isBoolean()
    .withMessage("isVisible must be a boolean value"),
  body("containsSpoilers")
    .optional()
    .isBoolean()
    .withMessage("containsSpoilers must be a boolean value"),
];

export const deleteReviewValidation = [
  param("id")
    .notEmpty()
    .withMessage("Review ID is required")
    .isUUID()
    .withMessage("Invalid review ID format"),
];

export const likeReviewValidation = [
  param("id")
    .notEmpty()
    .withMessage("Review ID is required")
    .isUUID()
    .withMessage("Invalid review ID format"),
];

export const getUserMediaReviewValidation = [
  param("mediaId")
    .notEmpty()
    .withMessage("Media ID is required")
    .isUUID()
    .withMessage("Invalid media ID format"),
];
