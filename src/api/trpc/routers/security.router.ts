import { z } from "zod";
import {
  router,
  publicProcedure,
  csrfTokenProcedure,
} from "../enhanced-router.js";
import type { Context } from "../context.js";
import { logger } from "../../utils/logger.js";
import { getCSRFStats } from "../../middleware/security/index.js";

/**
 * Security router for CSRF token management and security-related operations
 */
export const securityRouter = router({
  /**
   * Get CSRF token for the current session
   * This endpoint ensures a token exists and returns it to the client
   */
  getCSRFToken: csrfTokenProcedure.query(async ({ ctx }: { ctx: Context }) => {
    logger.debug("CSRF token requested", "SECURITY", {
      userId: ctx.user?.id,
      requestId: ctx.requestId,
    });

    return {
      token: ctx.csrfToken,
      expiresIn: 24 * 60 * 60 * 1000, // 24 hours
    };
  }),

  /**
   * Get CSRF token statistics (admin only)
   */
  getCSRFStats: publicProcedure.query(async ({ ctx }: { ctx: Context }) => {
    // Only allow admins to view stats
    if (ctx.user?.role !== "admin") {
      logger.warn("Unauthorized CSRF stats access attempt", "SECURITY", {
        userId: ctx.user?.id,
        requestId: ctx.requestId,
      });
      return null;
    }

    const stats = getCSRFStats();

    return {
      totalTokens: stats.totalTokens,
      activeTokens: stats.activeTokens,
      expiredTokens: stats.expiredTokens,
      averageRotationCount: stats.averageRotationCount,
      userTokenCounts: Array.from(stats?.tokensByUser?.entries()).map(
        ([userId, count]) => ({
          userId,
          count,
        }),
      ),
    };
  }),

  /**
   * Test endpoint to verify CSRF protection is working
   * This should fail without a valid CSRF token
   */
  testCSRFProtection: publicProcedure
    .input(
      z.object({
        message: z.string(),
      }),
    )
    .mutation(
      async ({ input, ctx }: { input: { message: string }; ctx: Context }) => {
        logger.info("CSRF test mutation executed", "SECURITY", {
          userId: ctx.user?.id,
          requestId: ctx.requestId,
          message: input.message,
        });

        return {
          success: true,
          message: `CSRF protection test passed: ${input.message}`,
          timestamp: new Date().toISOString(),
        };
      },
    ),
});
