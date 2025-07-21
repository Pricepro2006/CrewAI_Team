import { router, publicProcedure } from "../trpc/router";
import { z } from "zod";
import { RateLimiter } from "../../core/middleware/RateLimiter";

// Get the rate limiter instance
const rateLimiter = RateLimiter.getInstance();

export const metricsRouter: any = router({
  getRateLimitMetrics: publicProcedure.query(async () => {
    return rateLimiter.getMetrics();
  }),

  resetRateLimitMetrics: publicProcedure
    .input(
      z.object({
        identifier: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.identifier) {
        rateLimiter.reset(input.identifier);
      } else {
        // Reset all metrics
        rateLimiter.resetAll();
      }
      return { success: true };
    }),

  getRateLimitStatus: publicProcedure
    .input(
      z.object({
        identifier: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { allowed, remaining, reset } = rateLimiter.checkLimit(
        input.identifier,
      );
      return {
        identifier: input.identifier,
        allowed,
        remaining,
        resetTime: reset,
      };
    }),
});
