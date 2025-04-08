import { Request, Response, NextFunction } from "express";
import passport from "passport";
import { AppError } from "./error.middleware";
import { prisma } from "../config/database";
import { Role } from "@prisma/client";
import asyncHandler from "../utils/asyncHandler";

// Define a custom type to extend Express Request
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      username: string;
      role: Role;
      isActive: boolean;
    }
  }
}

// Middleware to authenticate user via JWT
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  passport.authenticate(
    "jwt",
    { session: false },
    (err: Error, user: Express.User, info: any) => {
      if (err) {
        return next(err);
      }

      if (!user) {
        return next(
          new AppError("Authentication required. Please log in.", 401)
        );
      }

      // Check if user is active
      if (!user.isActive) {
        return next(new AppError("User account is not active", 403));
      }

      req.user = user!;
      next();
    }
  )(req, res, next);
};

// Middleware to authenticate refresh token
export const authenticateRefreshToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  passport.authenticate(
    "jwt-refresh",
    { session: false },
    (err: Error, user: Express.User, info: any) => {
      if (err) {
        return next(err);
      }

      if (!user) {
        return next(new AppError("Invalid refresh token", 401));
      }

      req.user = user;
      next();
    }
  )(req, res, next);
};

// Middleware to restrict access based on user roles
export const restrictTo = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError("Authentication required. Please log in.", 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403)
      );
    }

    next();
  };
};

// Middleware to check if user owns a resource
export const checkOwnership = (
  resourceModel: string,
  paramIdField: string = "id"
) => {
  return asyncHandler(
    async (req: Request, _res: Response, next: NextFunction) => {
      if (!req.user) {
        return next(
          new AppError("Authentication required. Please log in.", 401)
        );
      }

      // Skip for admin and moderator roles
      if (req.user.role === Role.ADMIN || req.user.role === Role.MODERATOR) {
        return next();
      }

      const resourceId = req.params[paramIdField];

      // Dynamically get the model from Prisma
      const model = prisma[resourceModel as keyof typeof prisma] as any;
      if (!model) {
        return next(new AppError("Invalid resource model", 500));
      }

      const resource = await model.findUnique({
        where: { id: resourceId },
        select: { userId: true },
      });

      if (!resource) {
        return next(new AppError("Resource not found", 404));
      }

      if (resource.userId !== req.user.id) {
        return next(
          new AppError(
            "You do not have permission to perform this action on this resource",
            403
          )
        );
      }

      next();
    }
  );
};

// Middleware to update last login timestamp
export const updateLastLogin = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (req.user) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { lastLogin: new Date() },
      });
    }
    next();
  }
);
