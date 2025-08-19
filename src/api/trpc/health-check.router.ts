/**
 * Health Check tRPC Router
 * Provides comprehensive health monitoring endpoints
 */

import { z } from "zod";
import { router, publicProcedure } from "./enhanced-router.js";
import { healthCheckService, type HealthCheckResult, type ServiceConfig } from "../../monitoring/HealthCheckService.js";
import { TRPCError } from "@trpc/server";
import { logger } from "../../utils/logger.js";

type HealthCheckLevel = "basic" | "deep" | "full";

export const healthCheckRouter = router({
  /**
   * Get current system health
   */
  getCurrentHealth: publicProcedure
    .input(z.object({
      level: z.enum(["basic", "deep", "full"]).optional().default("basic"),
    }).optional())
    .query(async ({ input }) => {
      const service = healthCheckService;
      
      if (!service) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Health check service not initialized",
        });
      }

      try {
        const level = (input?.level || "basic") as HealthCheckLevel;
        const health = await service.getAggregatedHealth();
        
        return {
          success: true,
          health,
        };
      } catch (error) {
        logger.error(`Failed to get health status: ${error}`, "HEALTH");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to get health status",
        });
      }
    }),

  /**
   * Get health history
   */
  getHealthHistory: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(10),
    }).optional())
    .query(async ({ input }) => {
      const service = healthCheckService;
      
      if (!service) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Health check service not initialized",
        });
      }

      try {
        // Get recent health results from all services
        const allServices = service.getServiceConfigurations();
        const history: HealthCheckResult[] = [];
        
        for (const serviceConfig of allServices.slice(0, input?.limit || 10)) {
          const serviceHealth = service.getServiceHealth(serviceConfig.id);
          if (serviceHealth) {
            history.push(serviceHealth);
          }
        }
        
        return {
          success: true,
          history,
        };
      } catch (error) {
        logger.error(`Failed to get health history: ${error}`, "HEALTH");
        return {
          success: false,
          history: [],
        };
      }
    }),

  /**
   * Get service-specific health
   */
  getServiceHealth: publicProcedure
    .input(z.object({
      serviceName: z.string(),
    }))
    .query(async ({ input }) => {
      const service = healthCheckService;
      
      if (!service) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Health check service not initialized",
        });
      }

      try {
        const currentHealth = service.getAggregatedHealth();
        
        if (!currentHealth) {
          throw new Error("No health data available");
        }

        const serviceHealth = currentHealth?.services?.find(
          (s: any) => s.serviceName === input.serviceName
        );

        if (!serviceHealth) {
          throw new Error(`Service ${input.serviceName} not found`);
        }

        return {
          success: true,
          service: serviceHealth,
        };
      } catch (error) {
        logger.error(`Failed to get service health: ${error}`, "HEALTH");
        throw new TRPCError({
          code: "NOT_FOUND",
          message: error instanceof Error ? error.message : "Service not found",
        });
      }
    }),

  /**
   * Trigger immediate health check
   */
  triggerHealthCheck: publicProcedure
    .input(z.object({
      level: z.enum(["basic", "deep", "full"]).optional().default("basic"),
    }).optional())
    .mutation(async ({ input }) => {
      const service = healthCheckService;
      
      if (!service) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Health check service not initialized",
        });
      }

      try {
        const level = (input?.level || "basic") as HealthCheckLevel;
        const health = await service.getAggregatedHealth();
        
        logger.info(`Manual health check triggered (level: ${level})`, "HEALTH");
        
        return {
          success: true,
          health,
        };
      } catch (error) {
        logger.error(`Failed to trigger health check: ${error}`, "HEALTH");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to trigger health check",
        });
      }
    }),

  /**
   * Get health trends
   */
  getHealthTrends: publicProcedure
    .input(z.object({
      hours: z.number().min(1).max(24).default(1),
    }).optional())
    .query(async ({ input }) => {
      const service = healthCheckService;
      
      if (!service) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Health check service not initialized",
        });
      }

      try {
        // Get recent health results
        const allServices = service.getServiceConfigurations();
        const history: HealthCheckResult[] = [];
        
        for (const serviceConfig of allServices) {
          const serviceHealth = service.getServiceHealth(serviceConfig.id);
          if (serviceHealth) {
            history.push(serviceHealth);
          }
        }
        const hoursAgo = new Date(Date.now() - (input?.hours || 1) * 60 * 60 * 1000);
        
        const recentHistory = history?.filter((h: any) => 
          new Date(h.timestamp) >= hoursAgo
        );

        // Calculate trends
        const trends = {
          totalChecks: recentHistory?.length || 0,
          healthyPercentage: (recentHistory?.filter((h: any) => h.status === "healthy").length / recentHistory?.length || 0) * 100,
          degradedPercentage: (recentHistory?.filter((h: any) => h.status === "degraded").length / recentHistory?.length || 0) * 100,
          unhealthyPercentage: (recentHistory?.filter((h: any) => h.status === "unhealthy").length / recentHistory?.length || 0) * 100,
          averageResponseTime: recentHistory.reduce((sum: any, h: any) => sum + (h.metrics?.responseTime || 0), 0) / recentHistory?.length || 0,
          serviceFailures: {} as Record<string, number>,
        };

        // Count service failures
        recentHistory.forEach((h: any) => {
          h?.services?.forEach((s: any) => {
            if (s.status === "unhealthy") {
              trends.serviceFailures[s.name] = (trends.serviceFailures[s.name] || 0) + 1;
            }
          });
        });

        return {
          success: true,
          trends,
          period: `Last ${input?.hours || 1} hour(s)`,
        };
      } catch (error) {
        logger.error(`Failed to get health trends: ${error}`, "HEALTH");
        return {
          success: false,
          trends: null,
        };
      }
    }),

  /**
   * Subscribe to health events (for real-time updates)
   */
  subscribeToHealth: publicProcedure
    .subscription(async function* () {
      const service = healthCheckService;
      
      if (!service) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Health check service not initialized",
        });
      }

      // This would typically use a pub/sub mechanism
      // For now, we'll yield the current health periodically
      while (true) {
        const health = service.getAggregatedHealth();
        if (health) {
          yield {
            services: health.services,
            timestamp: health.lastCheck.toISOString(),
            overall: health.overall
          };
        }
        
        // Wait 30 seconds before next update
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }),
});