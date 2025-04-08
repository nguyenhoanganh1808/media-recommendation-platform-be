import passport from "passport";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import { Strategy as LocalStrategy } from "passport-local";
import { prisma } from "./database";
import { config } from "./env";
import { comparePasswords } from "../utils/password";
// import { comparePassword } from '../utils/password';

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

// Configure local strategy for username/password authentication
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        // Find the user
        const user = await prisma.user.findUnique({
          where: { email },
        });

        // Check if user exists
        if (!user) {
          return done(null, false, { message: "Incorrect email or password" });
        }

        // Check if user is active
        if (!user.isActive) {
          return done(null, false, { message: "User account is disabled" });
        }

        // Validate password
        const isPasswordValid = await comparePasswords(password, user.password);

        if (!isPasswordValid) {
          return done(null, false, { message: "Incorrect email or password" });
        }

        // Return user without password
        const { password: _, ...userWithoutPassword } = user;
        return done(null, userWithoutPassword);
      } catch (error) {
        return done(error);
      }
    }
  )
);

const cookieExtractor = (req: any) => {
  if (req && req.body && req.body.refreshToken) {
    return req.body.refreshToken;
  }
  return null;
};

// Configure JWT strategy for token-based authentication
passport.use(
  "jwt",
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.JWT_SECRET!,
    },
    async (jwtPayload: JwtPayload, done) => {
      try {
        // Find the user by ID from JWT payload
        const user = await prisma.user.findUnique({
          where: { id: jwtPayload.userId },
        });

        // Check if user exists and is active
        if (!user || !user.isActive) {
          return done(null, false);
        }

        // Return user without password
        const { password, ...userWithoutPassword } = user;
        return done(null, userWithoutPassword);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

// Configure JWT Refresh Token strategy
passport.use(
  "jwt-refresh",
  new JwtStrategy(
    {
      jwtFromRequest: cookieExtractor,
      secretOrKey: config.JWT_REFRESH_SECRET!,
      passReqToCallback: true,
    },
    async (req, jwtPayload: JwtPayload, done) => {
      try {
        // Validate the refresh token exists in the database

        const refreshToken = await prisma.refreshToken.findFirst({
          where: {
            userId: jwtPayload.userId,
            token: req.body.refreshToken,
            expiresAt: {
              gt: new Date(),
            },
          },
        });
        console.log("refreshToken: ", req.body.refreshToken);
        console.log("refreshToken: ", refreshToken);
        console.log("userId: ", jwtPayload);

        if (!refreshToken) {
          return done(null, false, { message: "Invalid refresh token" });
        }

        // Find the user
        const user = await prisma.user.findUnique({
          where: { id: jwtPayload.userId },
        });
        console.log("user: ", user);

        // Check if user exists and is active
        if (!user || !user.isActive) {
          return done(null, false, { message: "User not found or inactive" });
        }

        // Return user without password
        const { password, ...userWithoutPassword } = user;
        return done(null, userWithoutPassword);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

export default passport;
