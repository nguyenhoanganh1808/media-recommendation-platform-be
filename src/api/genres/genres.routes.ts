import { Router } from "express";
import genreController from "./genres.controller";
import genreValidation from "./genres.validation";
import { validate } from "../../middlewares/validation.middleware";
import { authenticate } from "../../middlewares/auth.middleware";
import { restrictTo } from "../../middlewares/auth.middleware";
import { Role } from "@prisma/client";
import { cacheMiddleware } from "../../middlewares/cache.middleware";
import { rateLimiter } from "../../middlewares/rateLimiter.middleware";

const router = Router();

// Public routes
router.get(
  "/",
  genreValidation.getGenres,
  validate(genreValidation.getGenres),
  cacheMiddleware({ ttl: 3600, keyPrefix: "genres:all:" }),
  genreController.getGenres
);

router.get(
  "/:id",
  genreValidation.getGenreById,
  validate(genreValidation.getGenreById),
  cacheMiddleware({ ttl: 3600, keyPrefix: "genres:id:" }),
  genreController.getGenreById
);

router.get(
  "/:id/media",
  genreValidation.getGenreWithMedia,
  validate(genreValidation.getGenreWithMedia),
  cacheMiddleware({ ttl: 3600, keyPrefix: "genres:media:" }),
  genreController.getGenreWithMedia
);

// Protected routes - only for admins and moderators
router.use(authenticate, rateLimiter);

router.post(
  "/",
  restrictTo(Role.ADMIN, Role.MODERATOR),
  genreValidation.createGenre,
  validate(genreValidation.createGenre),
  genreController.createGenre
);

router.put(
  "/:id",
  restrictTo(Role.ADMIN, Role.MODERATOR),
  genreValidation.updateGenre,
  validate(genreValidation.updateGenre),
  genreController.updateGenre
);

router.delete(
  "/:id",
  restrictTo(Role.ADMIN, Role.MODERATOR),
  genreValidation.deleteGenre,
  validate(genreValidation.deleteGenre),
  genreController.deleteGenre
);

// Genre-media association routes
router.post(
  "/:genreId/media/:mediaId",
  restrictTo(Role.ADMIN, Role.MODERATOR),
  genreValidation.addGenreToMedia,
  validate(genreValidation.addGenreToMedia),
  genreController.addGenreToMedia
);

router.delete(
  "/:genreId/media/:mediaId",
  restrictTo(Role.ADMIN, Role.MODERATOR),
  genreValidation.removeGenreFromMedia,
  validate(genreValidation.removeGenreFromMedia),
  genreController.removeGenreFromMedia
);

export default router;
