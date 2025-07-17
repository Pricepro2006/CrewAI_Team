import { z } from "zod";
import {
  router,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
} from "../trpc";
import { TRPCError } from "@trpc/server";
import { UserService, UserRole } from "../services/UserService";
import { logger } from "../../utils/logger";

const userService = new UserService();

// Validation schemas
const emailSchema = z.string().email("Invalid email format");
const usernameSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Username can only contain letters, numbers, underscores, and hyphens",
  );
const passwordSchema = z
  .string()
  .min(8)
  .max(100)
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    "Password must contain at least one uppercase letter, one lowercase letter, and one number",
  );

export const authRouter = router({
  // Register a new user
  register: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        username: usernameSchema,
        password: passwordSchema,
        role: z.nativeEnum(UserRole).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const user = await userService.create({
          email: input.email,
          username: input.username,
          password: input.password,
          role: input.role,
        });

        logger.info("User registered", "AUTH", {
          userId: user.id,
          email: user.email,
        });

        return {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
          },
        };
      } catch (error) {
        logger.error("Registration failed", "AUTH", {
          error: String(error),
          email: input.email,
        });

        if (error instanceof Error) {
          if (error.message.includes("already exists")) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "User with this email or username already exists",
            });
          }
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to register user",
        });
      }
    }),

  // Login user
  login: publicProcedure
    .input(
      z.object({
        emailOrUsername: z.string().min(1),
        password: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const { user, tokens } = await userService.login({
          emailOrUsername: input.emailOrUsername,
          password: input.password,
        });

        return {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
          },
          tokens,
        };
      } catch (error) {
        logger.error("Login failed", "AUTH", {
          error: String(error),
          emailOrUsername: input.emailOrUsername,
        });

        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }
    }),

  // Refresh access token
  refresh: publicProcedure
    .input(
      z.object({
        refreshToken: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const tokens = await userService.refreshTokens(input.refreshToken);

        return {
          success: true,
          tokens,
        };
      } catch (error) {
        logger.error("Token refresh failed", "AUTH", { error: String(error) });

        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid or expired refresh token",
        });
      }
    }),

  // Logout user (protected - user must be authenticated)
  logout: protectedProcedure
    .input(
      z.object({
        refreshToken: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        await userService.logout(ctx.user.id, input.refreshToken);

        return {
          success: true,
          message: "Logged out successfully",
        };
      } catch (error) {
        logger.error("Logout failed", "AUTH", {
          error: String(error),
          userId: ctx.user.id,
        });

        // Don't throw error on logout, just log it
        return {
          success: true,
          message: "Logged out",
        };
      }
    }),

  // Get current user
  me: protectedProcedure.query(async ({ ctx }) => {
    try {
      const user = await userService.getById(ctx.user.id);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      logger.error("Failed to get user", "AUTH", {
        error: String(error),
        userId: ctx.user.id,
      });

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get user information",
      });
    }
  }),

  // List users (admin only)
  listUsers: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      try {
        const users = await userService.list(input.limit, input.offset);

        return {
          users: users.map((user) => ({
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt,
          })),
          total: users.length,
        };
      } catch (error) {
        logger.error("Failed to list users", "AUTH", { error: String(error) });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list users",
        });
      }
    }),

  // Get user statistics (admin only)
  stats: adminProcedure.query(async () => {
    try {
      const stats = await userService.getUserStats();

      return stats;
    } catch (error) {
      logger.error("Failed to get user stats", "AUTH", {
        error: String(error),
      });

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get user statistics",
      });
    }
  }),

  // Update user role (admin only)
  updateRole: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.nativeEnum(UserRole),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        await userService.updateRole(input.userId, input.role);

        return {
          success: true,
          message: "User role updated successfully",
        };
      } catch (error) {
        logger.error("Failed to update user role", "AUTH", {
          error: String(error),
          userId: input.userId,
        });

        if (error instanceof Error && error.message.includes("not found")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update user role",
        });
      }
    }),

  // Deactivate user (admin only)
  deactivateUser: adminProcedure
    .input(
      z.object({
        userId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        await userService.deactivate(input.userId);

        return {
          success: true,
          message: "User deactivated successfully",
        };
      } catch (error) {
        logger.error("Failed to deactivate user", "AUTH", {
          error: String(error),
          userId: input.userId,
        });

        if (error instanceof Error && error.message.includes("not found")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to deactivate user",
        });
      }
    }),

  // Reactivate user (admin only)
  reactivateUser: adminProcedure
    .input(
      z.object({
        userId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        await userService.reactivate(input.userId);

        return {
          success: true,
          message: "User reactivated successfully",
        };
      } catch (error) {
        logger.error("Failed to reactivate user", "AUTH", {
          error: String(error),
          userId: input.userId,
        });

        if (error instanceof Error && error.message.includes("not found")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to reactivate user",
        });
      }
    }),
});
