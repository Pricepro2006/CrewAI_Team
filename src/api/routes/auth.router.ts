import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  router,
  publicProcedure,
  protectedProcedure,
  csrfTokenProcedure,
  createCustomErrorHandler,
} from "../trpc/enhanced-router.js";
import { UserService } from "../services/UserService.js";
import { jwtManager } from "../utils/jwt.js";
import { passwordManager } from "../utils/password.js";
import { randomUUID } from "crypto";
import { logger } from "../../utils/logger.js";

/**
 * Authentication Router
 * Handles user authentication endpoints including login, register, logout, refresh tokens
 */

// Input validation schemas
const registerSchema = z.object({
  email: z.string().email("Invalid email format").max(255),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be less than 50 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, hyphens, and underscores",
    ),
  password: z.string().min(8, "Password must be at least 8 characters"),
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional().default(false),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

const updateProfileSchema = z.object({
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
  avatar_url: z.string().url().optional(),
});

// Custom error handler for auth operations
const authErrorHandler = createCustomErrorHandler("auth");

export const authRouter = router({
  /**
   * Get CSRF token for authentication requests
   */
  getCsrfToken: csrfTokenProcedure.use(authErrorHandler).query(({ ctx }) => {
    return {
      csrfToken: ctx.csrfToken,
      message: "CSRF token generated successfully",
    };
  }),

  /**
   * Register a new user
   */
  register: publicProcedure
    .use(authErrorHandler)
    .input(registerSchema)
    .mutation(async ({ input }) => {
      const userService = new UserService();

      try {
        // Validate password strength
        const passwordValidation = passwordManager.validatePasswordStrength(
          input.password,
        );
        if (!passwordValidation.isValid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Password does not meet security requirements",
            cause: {
              errors: passwordValidation.errors,
              strength: passwordValidation.strength,
            },
          });
        }

        // Create user
        const user = await userService.createUser(input);

        logger.info("User registered successfully", "AUTH", {
          userId: user.id,
          email: user.email,
          username: user.username,
        });

        return {
          user,
          message:
            "User registered successfully. Please check your email to verify your account.",
        };
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("already exists")
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "User with this email or username already exists",
          });
        }
        throw error;
      } finally {
        userService.close();
      }
    }),

  /**
   * Login user with email and password
   */
  login: publicProcedure
    .use(authErrorHandler)
    .input(loginSchema)
    .mutation(async ({ input }) => {
      const userService = new UserService();

      try {
        // Authenticate user
        const user = await userService.authenticateUser(
          input.email,
          input.password,
        );

        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }

        // Generate refresh token
        const refreshTokenId = randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (input.rememberMe ? 30 : 7)); // 30 days if remember me, 7 days otherwise

        // Create token pair
        const tokens = jwtManager.generateTokenPair(
          {
            userId: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
          },
          refreshTokenId,
        );

        // Store refresh token in database
        userService.createRefreshToken(user.id, tokens.refreshToken, expiresAt);

        // Remove sensitive data from user object
        const { password_hash, ...publicUser } = user;

        logger.info("User logged in successfully", "AUTH", {
          userId: user.id,
          email: user.email,
          rememberMe: input.rememberMe,
        });

        return {
          user: publicUser,
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
            tokenType: "Bearer" as const,
          },
          message: "Login successful",
        };
      } finally {
        userService.close();
      }
    }),

  /**
   * Refresh access token using refresh token
   */
  refreshToken: publicProcedure
    .use(authErrorHandler)
    .input(refreshTokenSchema)
    .mutation(async ({ input }) => {
      const userService = new UserService();

      try {
        // Verify refresh token
        const payload = jwtManager.verifyRefreshToken(input.refreshToken);

        // Get refresh token from database
        const refreshToken = userService.getRefreshToken(payload.tokenId);
        if (!refreshToken || refreshToken.revoked) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid or revoked refresh token",
          });
        }

        // Check if token is expired
        if (new Date(refreshToken.expires_at) <= new Date()) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Refresh token has expired",
          });
        }

        // Get user
        const user = userService.getUserById(payload.sub);
        if (!user || !user.is_active) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User not found or inactive",
          });
        }

        // Generate new token pair
        const newRefreshTokenId = randomUUID();
        const newTokens = jwtManager.generateTokenPair(
          {
            userId: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
          },
          newRefreshTokenId,
        );

        // Revoke old refresh token and create new one
        userService.revokeRefreshToken(payload.tokenId);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

        userService.createRefreshToken(
          user.id,
          newTokens.refreshToken,
          expiresAt,
        );

        logger.info("Token refreshed successfully", "AUTH", {
          userId: user.id,
          oldTokenId: payload.tokenId,
          newTokenId: newRefreshTokenId,
        });

        return {
          tokens: {
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken,
            expiresIn: newTokens.expiresIn,
            tokenType: "Bearer" as const,
          },
          message: "Token refreshed successfully",
        };
      } finally {
        userService.close();
      }
    }),

  /**
   * Logout user (revoke refresh token)
   */
  logout: protectedProcedure
    .use(authErrorHandler)
    .input(refreshTokenSchema)
    .mutation(async ({ input, ctx }) => {
      const userService = new UserService();

      try {
        // Verify and revoke refresh token
        const payload = jwtManager.verifyRefreshToken(input.refreshToken);
        userService.revokeRefreshToken(payload.tokenId);

        // Also revoke all user sessions for security
        userService.revokeAllUserSessions(ctx.user.id);

        logger.info("User logged out successfully", "AUTH", {
          userId: ctx.user.id,
          tokenId: payload.tokenId,
        });

        return {
          message: "Logout successful",
        };
      } catch (error) {
        // Even if token verification fails, we should still log the logout attempt
        logger.info("Logout attempted with invalid token", "AUTH", {
          userId: ctx.user.id,
        });

        return {
          message: "Logout successful",
        };
      } finally {
        userService.close();
      }
    }),

  /**
   * Logout from all devices (revoke all refresh tokens)
   */
  logoutAll: protectedProcedure
    .use(authErrorHandler)
    .mutation(async ({ ctx }) => {
      const userService = new UserService();

      try {
        // Revoke all refresh tokens and sessions
        userService.revokeAllUserRefreshTokens(ctx.user.id);
        userService.revokeAllUserSessions(ctx.user.id);

        logger.info("User logged out from all devices", "AUTH", {
          userId: ctx.user.id,
        });

        return {
          message: "Logged out from all devices successfully",
        };
      } finally {
        userService.close();
      }
    }),

  /**
   * Get current user profile
   */
  me: protectedProcedure.use(authErrorHandler).query(({ ctx }) => {
    return {
      user: ctx.user,
      message: "User profile retrieved successfully",
    };
  }),

  /**
   * Update user profile
   */
  updateProfile: protectedProcedure
    .use(authErrorHandler)
    .input(updateProfileSchema)
    .mutation(async ({ input, ctx }) => {
      const userService = new UserService();

      try {
        const updatedUser = await userService.updateUser(ctx.user.id, input);

        logger.info("User profile updated", "AUTH", {
          userId: ctx.user.id,
          updatedFields: Object.keys(input),
        });

        return {
          user: updatedUser,
          message: "Profile updated successfully",
        };
      } finally {
        userService.close();
      }
    }),

  /**
   * Change password
   */
  changePassword: protectedProcedure
    .use(authErrorHandler)
    .input(changePasswordSchema)
    .mutation(async ({ input, ctx }) => {
      const userService = new UserService();

      try {
        await userService.changePassword(ctx.user.id, input);

        logger.info("Password changed successfully", "AUTH", {
          userId: ctx.user.id,
        });

        return {
          message:
            "Password changed successfully. Please log in again with your new password.",
        };
      } finally {
        userService.close();
      }
    }),

  /**
   * Check password strength
   */
  checkPasswordStrength: publicProcedure
    .use(authErrorHandler)
    .input(z.object({ password: z.string() }))
    .query(({ input }) => {
      const validation = passwordManager.validatePasswordStrength(
        input.password,
      );
      const entropy = passwordManager.calculatePasswordEntropy(input.password);
      const isCompromised = passwordManager.isPasswordCompromised(
        input.password,
      );

      return {
        ...validation,
        entropy,
        isCompromised,
        recommendations:
          validation.errors.length > 0
            ? validation.errors
            : ["Your password meets all security requirements!"],
      };
    }),

  /**
   * Verify email (placeholder for email verification)
   */
  verifyEmail: publicProcedure
    .use(authErrorHandler)
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      // This would implement email verification logic
      // For now, return a placeholder response
      logger.info("Email verification attempted", "AUTH", {
        token: input.token.substring(0, 10) + "...",
      });

      return {
        message: "Email verification feature coming soon",
      };
    }),

  /**
   * Request password reset (placeholder)
   */
  requestPasswordReset: publicProcedure
    .use(authErrorHandler)
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      // This would implement password reset logic
      logger.info("Password reset requested", "AUTH", {
        email: input.email,
      });

      return {
        message:
          "If an account with this email exists, you will receive password reset instructions.",
      };
    }),

  /**
   * Clean up expired tokens (admin only)
   */
  cleanupExpiredTokens: protectedProcedure
    .use(authErrorHandler)
    .mutation(async ({ ctx }) => {
      // Check if user is admin
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin access required",
        });
      }

      const userService = new UserService();

      try {
        userService.cleanupExpiredTokens();

        logger.info("Expired tokens cleaned up", "AUTH", {
          adminUserId: ctx.user.id,
        });

        return {
          message: "Expired tokens cleaned up successfully",
        };
      } finally {
        userService.close();
      }
    }),
});
