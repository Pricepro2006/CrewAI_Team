import { z } from "zod";
import { 
  router, 
  adminProcedure, 
  protectedProcedure,
  createPermissionMiddleware 
} from "../trpc/enhanced-router.js";
import { securityMonitor } from "../services/SecurityMonitoringService.js";
import { guestUserService } from "../services/GuestUserService.js";
import { TRPCError } from "@trpc/server";

// Permission middleware for security endpoints
const requireSecurityRead = createPermissionMiddleware(["security.read", "admin"]);
const requireSecurityWrite = createPermissionMiddleware(["security.write", "admin"]);

export const securityRouter = router({
  /**
   * Get security statistics
   */
  getStats: protectedProcedure
    .use(requireSecurityRead)
    .input(
      z.object({
        timeWindowMinutes: z.number().min(1).max(1440).default(60), // Max 24 hours
      })
    )
    .query(async ({ input }) => {
      const timeWindowMs = input.timeWindowMinutes * 60 * 1000;
      return securityMonitor.getStats(timeWindowMs);
    }),

  /**
   * Get guest user statistics
   */
  getGuestStats: protectedProcedure
    .use(requireSecurityRead)
    .query(async () => {
      return guestUserService.getStats();
    }),

  /**
   * Check if a user is suspicious
   */
  checkUserSuspicious: protectedProcedure
    .use(requireSecurityRead)
    .input(
      z.object({
        userId: z.string(),
        timeWindowMinutes: z.number().min(1).max(60).default(10),
      })
    )
    .query(async ({ input }) => {
      const timeWindowMs = input.timeWindowMinutes * 60 * 1000;
      return {
        userId: input.userId,
        isSuspicious: securityMonitor.isUserSuspicious(input.userId, timeWindowMs),
        timeWindow: `${input.timeWindowMinutes} minutes`,
      };
    }),

  /**
   * Generate security report (admin only)
   */
  generateReport: adminProcedure
    .input(
      z.object({
        timeWindowHours: z.number().min(1).max(168).default(24), // Max 1 week
      })
    )
    .query(async ({ input }) => {
      const timeWindowMs = input.timeWindowHours * 60 * 60 * 1000;
      return {
        report: securityMonitor.generateReport(timeWindowMs),
        generatedAt: new Date().toISOString(),
      };
    }),

  /**
   * Revoke guest session (admin only)
   */
  revokeGuestSession: adminProcedure
    .input(
      z.object({
        guestId: z.string().regex(/^guest-[a-f0-9]{16}$/),
        reason: z.string().min(5).max(500),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify it's actually a guest ID
      if (!input.guestId.startsWith("guest-")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid guest ID format",
        });
      }

      // Revoke the session
      guestUserService.revokeGuestSession(input.guestId, input.reason);

      // Log admin action
      ctx.logger?.info("Admin revoked guest session", "ADMIN_ACTION", {
        adminId: ctx.user.id,
        guestId: input.guestId,
        reason: input.reason,
      });

      return {
        success: true,
        message: `Guest session ${input.guestId} has been revoked`,
      };
    }),

  /**
   * Get real-time security events via subscription (admin only)
   */
  subscribeToEvents: adminProcedure.subscription(async function* ({ ctx }) {
    // Initial yield
    yield {
      type: "connected",
      timestamp: new Date().toISOString(),
    };

    // Create event handler
    const handler = (event: any) => {
      return {
        type: "event",
        data: event,
        timestamp: new Date().toISOString(),
      };
    };

    // Subscribe to security events
    securityMonitor.on("security-event", handler);

    try {
      // Keep connection alive with heartbeat
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 30000)); // 30s heartbeat
        yield {
          type: "heartbeat",
          timestamp: new Date().toISOString(),
        };
      }
    } finally {
      // Clean up subscription
      securityMonitor.off("security-event", handler);
    }
  }),

  /**
   * Get security alerts (admin only)
   */
  getAlerts: adminProcedure.subscription(async function* ({ ctx }) {
    // Initial yield
    yield {
      type: "connected",
      timestamp: new Date().toISOString(),
    };

    // Create alert handler
    const handler = (alert: any) => {
      return {
        type: "alert",
        data: alert,
        timestamp: new Date().toISOString(),
      };
    };

    // Subscribe to security alerts
    securityMonitor.on("security-alert", handler);

    try {
      // Keep connection alive
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 30000)); // 30s heartbeat
        yield {
          type: "heartbeat",
          timestamp: new Date().toISOString(),
        };
      }
    } finally {
      // Clean up subscription
      securityMonitor.off("security-alert", handler);
    }
  }),

  /**
   * Cleanup old guest sessions (admin only)
   */
  cleanupGuestSessions: adminProcedure.mutation(async ({ ctx }) => {
    // Run cleanup
    guestUserService.cleanup();

    // Log admin action
    ctx.logger?.info("Admin triggered guest session cleanup", "ADMIN_ACTION", {
      adminId: ctx.user.id,
    });

    return {
      success: true,
      message: "Guest session cleanup completed",
      stats: guestUserService.getStats(),
    };
  }),
});