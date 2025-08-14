/**
 * tRPC Router for Price Alert System
 * Provides type-safe API endpoints for managing price alerts
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "./trpc.js";
import { TRPCError } from "@trpc/server";
import { getPriceAlertService } from "../services/PriceAlertService.js";
import type { 
  DealAlert, 
  DealNotification, 
  CreateAlertRequest,
  UpdateAlertRequest 
} from "../../types/price-alerts.js";

// Zod schemas for input validation
const createAlertSchema = z.object({
  alertName: z.string().min(1).max(100),
  alertType: z.enum(['price_drop', 'stock_alert', 'sale_alert', 'custom']),
  productName: z.string().optional(),
  productBrand: z.string().optional(),
  productCategory: z.string().optional(),
  upcCode: z.string().optional(),
  targetPrice: z.number().positive().optional(),
  priceDropPercentage: z.number().min(0).max(100).optional(),
  priceDropAmount: z.number().positive().optional(),
  alertFrequency: z.enum(['immediate', 'hourly', 'daily', 'weekly']).optional(),
  notificationMethods: z.array(z.string()).optional(),
  conditions: z.any().optional()
});

const updateAlertSchema = z.object({
  alertId: z.string(),
  updates: z.object({
    alertName: z.string().optional(),
    alertDescription: z.string().optional(),
    targetPrice: z.number().positive().optional(),
    priceDropPercentage: z.number().min(0).max(100).optional(),
    priceDropAmount: z.number().positive().optional(),
    alertFrequency: z.enum(['immediate', 'hourly', 'daily', 'weekly']).optional(),
    notificationMethods: z.array(z.string()).optional(),
    status: z.enum(['active', 'paused', 'expired', 'fulfilled', 'cancelled']).optional(),
    priority: z.number().min(1).max(10).optional()
  })
});

const priceChangeSchema = z.object({
  productName: z.string(),
  productBrand: z.string().optional(),
  productCategory: z.string().optional(),
  upcCode: z.string().optional(),
  currentPrice: z.number().positive(),
  previousPrice: z.number().positive(),
  storeName: z.string().optional()
});

export const priceAlertsRouter = router({
  /**
   * Create a new price alert
   */
  createAlert: protectedProcedure
    .input(createAlertSchema)
    .mutation(async ({ input, ctx }) => {
      const service = getPriceAlertService();
      
      if (!service) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Price alert service not initialized'
        });
      }
      
      if (!ctx.user?.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        });
      }
      
      try {
        const alert = service.createAlert({
          ...input,
          userId: ctx.user.id
        });
        
        return {
          success: true,
          alert,
          message: `Price alert "${alert.alertName}" created successfully`
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create alert: ${error}`
        });
      }
    }),

  /**
   * Get all alerts for the current user
   */
  getUserAlerts: protectedProcedure
    .input(z.object({
      status: z.enum(['active', 'paused', 'expired', 'fulfilled', 'cancelled']).optional()
    }).optional())
    .query(async ({ input, ctx }) => {
      const service = getPriceAlertService();
      
      if (!service) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Price alert service not initialized'
        });
      }
      
      if (!ctx.user?.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        });
      }
      
      try {
        const alerts = service.getUserAlerts(ctx.user.id, input?.status);
        
        return {
          success: true,
          alerts,
          count: alerts.length
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch alerts: ${error}`
        });
      }
    }),

  /**
   * Get a specific alert by ID
   */
  getAlert: protectedProcedure
    .input(z.object({
      alertId: z.string()
    }))
    .query(async ({ input, ctx }) => {
      const service = getPriceAlertService();
      
      if (!service) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Price alert service not initialized'
        });
      }
      
      try {
        const alert = service.getAlert(input.alertId);
        
        if (!alert) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Alert not found'
          });
        }
        
        // Verify user owns this alert
        if (alert.userId !== ctx.user?.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied'
          });
        }
        
        return {
          success: true,
          alert
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch alert: ${error}`
        });
      }
    }),

  /**
   * Update an existing alert
   */
  updateAlert: protectedProcedure
    .input(updateAlertSchema)
    .mutation(async ({ input, ctx }) => {
      const service = getPriceAlertService();
      
      if (!service) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Price alert service not initialized'
        });
      }
      
      try {
        // Verify user owns this alert
        const alert = service.getAlert(input.alertId);
        if (!alert || alert.userId !== ctx.user?.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied'
          });
        }
        
        const success = service.updateAlert(input.alertId, input.updates);
        
        if (!success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update alert'
          });
        }
        
        return {
          success: true,
          message: 'Alert updated successfully'
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update alert: ${error}`
        });
      }
    }),

  /**
   * Delete an alert
   */
  deleteAlert: protectedProcedure
    .input(z.object({
      alertId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const service = getPriceAlertService();
      
      if (!service) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Price alert service not initialized'
        });
      }
      
      try {
        // Verify user owns this alert
        const alert = service.getAlert(input.alertId);
        if (!alert || alert.userId !== ctx.user?.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied'
          });
        }
        
        const success = service.deleteAlert(input.alertId);
        
        if (!success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to delete alert'
          });
        }
        
        return {
          success: true,
          message: 'Alert deleted successfully'
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to delete alert: ${error}`
        });
      }
    }),

  /**
   * Pause an alert
   */
  pauseAlert: protectedProcedure
    .input(z.object({
      alertId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const service = getPriceAlertService();
      
      if (!service) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Price alert service not initialized'
        });
      }
      
      try {
        // Verify user owns this alert
        const alert = service.getAlert(input.alertId);
        if (!alert || alert.userId !== ctx.user?.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied'
          });
        }
        
        const success = service.pauseAlert(input.alertId);
        
        if (!success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to pause alert'
          });
        }
        
        return {
          success: true,
          message: 'Alert paused successfully'
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to pause alert: ${error}`
        });
      }
    }),

  /**
   * Resume a paused alert
   */
  resumeAlert: protectedProcedure
    .input(z.object({
      alertId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const service = getPriceAlertService();
      
      if (!service) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Price alert service not initialized'
        });
      }
      
      try {
        // Verify user owns this alert
        const alert = service.getAlert(input.alertId);
        if (!alert || alert.userId !== ctx.user?.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied'
          });
        }
        
        const success = service.resumeAlert(input.alertId);
        
        if (!success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to resume alert'
          });
        }
        
        return {
          success: true,
          message: 'Alert resumed successfully'
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to resume alert: ${error}`
        });
      }
    }),

  /**
   * Get notification history for the current user
   */
  getNotificationHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50)
    }).optional())
    .query(async ({ input, ctx }) => {
      const service = getPriceAlertService();
      
      if (!service) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Price alert service not initialized'
        });
      }
      
      if (!ctx.user?.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        });
      }
      
      try {
        const notifications = service.getNotificationHistory(
          ctx.user.id, 
          input?.limit || 50
        );
        
        return {
          success: true,
          notifications,
          count: notifications.length
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch notification history: ${error}`
        });
      }
    }),

  /**
   * Mark notification as read
   */
  markNotificationRead: protectedProcedure
    .input(z.object({
      notificationId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const service = getPriceAlertService();
      
      if (!service) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Price alert service not initialized'
        });
      }
      
      try {
        service.markNotificationAsRead(input.notificationId);
        
        return {
          success: true,
          message: 'Notification marked as read'
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to mark notification as read: ${error}`
        });
      }
    }),

  /**
   * Mark notification as clicked
   */
  markNotificationClicked: protectedProcedure
    .input(z.object({
      notificationId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const service = getPriceAlertService();
      
      if (!service) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Price alert service not initialized'
        });
      }
      
      try {
        service.markNotificationAsClicked(input.notificationId);
        
        return {
          success: true,
          message: 'Notification marked as clicked'
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to mark notification as clicked: ${error}`
        });
      }
    }),

  /**
   * Get alert analytics
   */
  getAlertAnalytics: protectedProcedure
    .query(async ({ ctx }) => {
      const service = getPriceAlertService();
      
      if (!service) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Price alert service not initialized'
        });
      }
      
      if (!ctx.user?.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        });
      }
      
      try {
        const analytics = service.getAlertAnalytics(ctx.user.id);
        
        return {
          success: true,
          analytics
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch analytics: ${error}`
        });
      }
    }),

  /**
   * Check price change (internal use, can be called by other services)
   */
  checkPriceChange: publicProcedure
    .input(priceChangeSchema)
    .mutation(async ({ input }) => {
      const service = getPriceAlertService();
      
      if (!service) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Price alert service not initialized'
        });
      }
      
      try {
        const result = await service.checkPriceChange(input);
        
        return {
          success: true,
          result,
          alertsTriggered: result.triggeredAlerts.length
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to check price change: ${error}`
        });
      }
    }),

  /**
   * Test alert notification (for development/testing)
   */
  testAlert: protectedProcedure
    .input(z.object({
      alertId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const service = getPriceAlertService();
      
      if (!service) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Price alert service not initialized'
        });
      }
      
      try {
        // Verify user owns this alert
        const alert = service.getAlert(input.alertId);
        if (!alert || alert.userId !== ctx.user?.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied'
          });
        }
        
        // Trigger a test notification
        const testProduct = {
          productName: alert.productName || 'Test Product',
          productBrand: alert.productBrand,
          productCategory: alert.productCategory,
          upcCode: alert.upcCode,
          currentPrice: (alert.targetPrice || 10) - 1,
          previousPrice: alert.targetPrice || 10,
          storeName: 'Test Store'
        };
        
        const result = await service.checkPriceChange(testProduct);
        
        return {
          success: true,
          message: 'Test notification sent',
          result
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to send test alert: ${error}`
        });
      }
    })
});

export type PriceAlertsRouter = typeof priceAlertsRouter;