/**
 * Budget Tracking tRPC Router
 * Provides API endpoints for budget management and spending analytics
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "./enhanced-router.js";
import { getBudgetTrackingService } from "../services/BudgetTrackingService.js";
import { TRPCError } from "@trpc/server";
import { logger } from "../../utils/logger.js";

// Input schemas
const getBudgetSummarySchema = z.object({
  userId: z.string(),
  period: z.enum(["month", "week", "custom"]).default("month"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const getSpendingAnalyticsSchema = z.object({
  userId: z.string(),
  timeRange: z.enum(["week", "month", "quarter"]).default("month"),
});

const updateMonthlyBudgetSchema = z.object({
  userId: z.string(),
  amount: z.number().min(0).max(10000),
});

const updateCategoryBudgetSchema = z.object({
  userId: z.string(),
  category: z.string(),
  amount: z.number().min(0).max(5000),
});

const saveBudgetPreferencesSchema = z.object({
  userId: z.string(),
  monthlyBudget: z.number().min(0).max(10000),
  categoryBudgets: z.record(z.string(), z.number()),
  alertThreshold: z.number().min(0).max(100),
  rolloverEnabled: z.boolean(),
  autoAdjust: z.boolean(),
});

export const budgetTrackingRouter = router({
  /**
   * Get budget summary for a user
   */
  getBudgetSummary: publicProcedure
    .input(getBudgetSummarySchema)
    .query(async ({ input }) => {
      const service = getBudgetTrackingService();
      
      if (!service) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Budget tracking service not initialized",
        });
      }

      try {
        const summary = service.getBudgetSummary(
          input.userId,
          input.period,
          input.startDate,
          input.endDate
        );

        logger.info(`Retrieved budget summary for user ${input.userId}`, "BUDGET");
        
        return {
          success: true,
          summary,
        };
      } catch (error) {
        logger.error(`Failed to get budget summary: ${error}`, "BUDGET");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to get budget summary",
        });
      }
    }),

  /**
   * Get spending analytics
   */
  getSpendingAnalytics: publicProcedure
    .input(getSpendingAnalyticsSchema)
    .query(async ({ input }) => {
      const service = getBudgetTrackingService();
      
      if (!service) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Budget tracking service not initialized",
        });
      }

      try {
        const analytics = service.getSpendingAnalytics(
          input.userId,
          input.timeRange
        );

        logger.info(`Retrieved spending analytics for user ${input.userId}`, "BUDGET");
        
        return {
          success: true,
          analytics,
        };
      } catch (error) {
        logger.error(`Failed to get spending analytics: ${error}`, "BUDGET");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to get spending analytics",
        });
      }
    }),

  /**
   * Get user budget preferences
   */
  getUserBudgetPreferences: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const service = getBudgetTrackingService();
      
      if (!service) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Budget tracking service not initialized",
        });
      }

      try {
        const preferences = service.getUserBudgetPreferences(input.userId);
        
        if (!preferences) {
          // Service will create default preferences if none exist
          logger.info(`Created default preferences for user ${input.userId}`, "BUDGET");
        }

        return {
          success: true,
          preferences,
        };
      } catch (error) {
        logger.error(`Failed to get user preferences: ${error}`, "BUDGET");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to get user preferences",
        });
      }
    }),

  /**
   * Update monthly budget
   */
  updateMonthlyBudget: publicProcedure
    .input(updateMonthlyBudgetSchema)
    .mutation(async ({ input }) => {
      const service = getBudgetTrackingService();
      
      if (!service) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Budget tracking service not initialized",
        });
      }

      try {
        const success = service.updateMonthlyBudget(input.userId, input.amount);
        
        if (success) {
          logger.info(`Updated monthly budget for user ${input.userId} to $${input.amount}`, "BUDGET");
        }

        return {
          success,
          message: success ? "Monthly budget updated successfully" : "Failed to update monthly budget",
        };
      } catch (error) {
        logger.error(`Failed to update monthly budget: ${error}`, "BUDGET");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to update monthly budget",
        });
      }
    }),

  /**
   * Update category budget
   */
  updateCategoryBudget: publicProcedure
    .input(updateCategoryBudgetSchema)
    .mutation(async ({ input }) => {
      const service = getBudgetTrackingService();
      
      if (!service) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Budget tracking service not initialized",
        });
      }

      try {
        const success = service.updateCategoryBudget(
          input.userId,
          input.category,
          input.amount
        );
        
        if (success) {
          logger.info(`Updated ${input.category} budget for user ${input.userId} to $${input.amount}`, "BUDGET");
        }

        return {
          success,
          message: success ? "Category budget updated successfully" : "Failed to update category budget",
        };
      } catch (error) {
        logger.error(`Failed to update category budget: ${error}`, "BUDGET");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to update category budget",
        });
      }
    }),

  /**
   * Save complete budget preferences
   */
  saveBudgetPreferences: publicProcedure
    .input(saveBudgetPreferencesSchema)
    .mutation(async ({ input }) => {
      const service = getBudgetTrackingService();
      
      if (!service) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Budget tracking service not initialized",
        });
      }

      try {
        const preferences = {
          userId: input.userId,
          monthlyBudget: input.monthlyBudget,
          categoryBudgets: input.categoryBudgets,
          alertThreshold: input.alertThreshold,
          rolloverEnabled: input.rolloverEnabled,
          autoAdjust: input.autoAdjust,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const success = service.saveUserBudgetPreferences(preferences);
        
        if (success) {
          logger.info(`Saved budget preferences for user ${input.userId}`, "BUDGET");
        }

        return {
          success,
          message: success ? "Budget preferences saved successfully" : "Failed to save preferences",
        };
      } catch (error) {
        logger.error(`Failed to save budget preferences: ${error}`, "BUDGET");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to save preferences",
        });
      }
    }),

  /**
   * Get budget alerts for a user
   */
  getBudgetAlerts: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      // This would typically query a separate alerts table
      // For now, return based on current budget status
      const service = getBudgetTrackingService();
      
      if (!service) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Budget tracking service not initialized",
        });
      }

      try {
        const summary = service.getBudgetSummary(input.userId);
        const preferences = service.getUserBudgetPreferences(input.userId);
        
        const alerts = [];
        
        if (summary.percentage >= 100) {
          alerts.push({
            id: "budget-exceeded",
            type: "critical",
            message: "Monthly budget exceeded!",
            percentage: summary.percentage,
            timestamp: new Date().toISOString(),
          });
        } else if (summary.percentage >= (preferences?.alertThreshold || 80)) {
          alerts.push({
            id: "budget-warning",
            type: "warning",
            message: `${summary.percentage.toFixed(0)}% of monthly budget used`,
            percentage: summary.percentage,
            timestamp: new Date().toISOString(),
          });
        }

        // Check category budgets
        summary.categories.forEach(category => {
          if (category.percentage >= 100) {
            alerts.push({
              id: `category-exceeded-${category.category}`,
              type: "warning",
              message: `${category.category} budget exceeded`,
              percentage: category.percentage,
              timestamp: new Date().toISOString(),
            });
          }
        });

        return {
          success: true,
          alerts,
        };
      } catch (error) {
        logger.error(`Failed to get budget alerts: ${error}`, "BUDGET");
        return {
          success: false,
          alerts: [],
        };
      }
    }),

  /**
   * Get budget trends over time
   */
  getBudgetTrends: publicProcedure
    .input(z.object({ 
      userId: z.string(),
      months: z.number().min(1).max(12).default(6),
    }))
    .query(async ({ input }) => {
      const service = getBudgetTrackingService();
      
      if (!service) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Budget tracking service not initialized",
        });
      }

      try {
        // Calculate trends for the past N months
        const trends = [];
        const now = new Date();
        
        for (let i = input.months - 1; i >= 0; i--) {
          const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
          
          const summary = service.getBudgetSummary(
            input.userId,
            "custom",
            monthDate.toISOString(),
            monthEnd.toISOString()
          );
          
          trends.push({
            month: monthDate.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
            spent: summary.totalSpent,
            budget: summary.totalBudget,
            percentage: summary.percentage,
          });
        }

        return {
          success: true,
          trends,
        };
      } catch (error) {
        logger.error(`Failed to get budget trends: ${error}`, "BUDGET");
        return {
          success: false,
          trends: [],
        };
      }
    }),
});