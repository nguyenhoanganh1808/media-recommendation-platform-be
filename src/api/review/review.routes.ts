import { Router } from "express";
import reviewController from "./review.controller";
import { validate } from "../../middlewares/validation.middleware";
import {
  authenticate,
  checkOwnership,
  restrictTo,
} from "../../middlewares/auth.middleware";
import { Role } from "@prisma/client";
import {
  createReviewValidation,
  updateReviewValidation,
  deleteReviewValidation,
  likeReviewValidation,
  getUserMediaReviewValidation,
} from "./review.validation";
import {
  cacheMiddleware,
  userCacheMiddleware,
} from "../../middlewares/cache.middleware";

const router = Router();

// Create a new review (authenticated)
router.post(
  "/",
  authenticate,
  validate(createReviewValidation),
  reviewController.createReview
);

// Get reviews for a specific media (paginated, cached)
router.get(
  "/media/:mediaId",
  cacheMiddleware({
    keyPrefix: "reviews:media:",
    ttl: 300, // 5 minutes cache
    keyGenerator: (req) =>
      `${req.params.mediaId}:page:${req.query.page || 1}:limit:${req.query.limit || 10}`,
  }),
  reviewController.getMediaReviews
);

// Get reviews by a specific user (paginated, cached)
router.get(
  "/user/:userId",
  cacheMiddleware({
    keyPrefix: "reviews:user:",
    ttl: 300, // 5 minutes cache
    keyGenerator: (req) =>
      `${req.params.userId}:page:${req.query.page || 1}:limit:${req.query.limit || 10}`,
  }),
  reviewController.getUserReviews
);

// Get review by media ID and user ID (cached)
router.get(
  "/user/media/:mediaId",
  authenticate,
  validate(getUserMediaReviewValidation),
  userCacheMiddleware({ ttl: 300 }),
  reviewController.getUserMediaReview
);

// Get a single review by ID
router.get("/:id", reviewController.getReviewById);

// Update a review (authenticated)
router.put(
  "/:id",
  authenticate,
  validate(updateReviewValidation),
  reviewController.updateReview
);

// Delete a review (authenticated)
router.delete(
  "/:id",
  authenticate,
  checkOwnership("mediaReview"),
  validate(deleteReviewValidation),
  reviewController.deleteReview
);

// Like a review (authenticated)
router.post(
  "/:id/like",
  authenticate,
  validate(likeReviewValidation),
  reviewController.likeReview
);

// UnLike a review (authenticated)
router.delete(
  "/:id/like",
  authenticate,
  validate(likeReviewValidation),
  reviewController.likeReview
);

// Admin route to get all reviews (including hidden)
router.get(
  "/admin/all",
  authenticate,
  restrictTo(Role.ADMIN, Role.MODERATOR),
  reviewController.getMediaReviews
);

export default router;
