/**
 * Deals Router
 * tRPC router for deal data operations
 */

import { z } from "zod";
import { router, publicProcedure } from "../trpc/router";
import { DealDataService } from "../services/DealDataService";
import { logger } from "../../utils/logger";

// Get singleton instance
const dealDataService = DealDataService.getInstance();

export const dealsRouter = router({
  /**
   * Get a deal by deal ID with all items
   */
  getDeal: publicProcedure
    .input(
      z.object({
        dealId: z.string().regex(/^\d{8}$/, "Deal ID must be 8 digits"),
      }),
    )
    .query(async ({ input }) => {
      try {
        const dealResponse = await dealDataService.getDeal(input.dealId);

        if (!dealResponse) {
          throw new Error(`Deal ${input.dealId} not found`);
        }

        return dealResponse;
      } catch (error) {
        logger.error("Failed to get deal", "DEALS_ROUTER", {
          dealId: input.dealId,
          error,
        });
        throw error;
      }
    }),

  /**
   * Get deal item by product number and deal ID
   */
  getDealItem: publicProcedure
    .input(
      z.object({
        dealId: z.string().regex(/^\d{8}$/, "Deal ID must be 8 digits"),
        productNumber: z.string(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const item = await dealDataService.getDealItem(
          input.dealId,
          input.productNumber,
        );

        if (!item) {
          throw new Error(
            `Product ${input.productNumber} not found in deal ${input.dealId}`,
          );
        }

        // Calculate price based on product family
        const calculatedPrice = dealDataService.calculatePrice(
          item.dealerNetPrice,
          item.productFamily,
        );

        return {
          ...item,
          calculatedPrice,
          priceDisclaimer:
            "This quote is not to be used as a valid quote. Please reach out to InsightHPI@TDSYNNEX.com for a formal quote if needed.",
        };
      } catch (error) {
        logger.error("Failed to get deal item", "DEALS_ROUTER", {
          dealId: input.dealId,
          productNumber: input.productNumber,
          error,
        });
        throw error;
      }
    }),

  /**
   * Calculate price for quantity
   */
  calculatePriceForQuantity: publicProcedure
    .input(
      z.object({
        dealId: z.string().regex(/^\d{8}$/, "Deal ID must be 8 digits"),
        productNumber: z.string(),
        quantity: z.number().int().positive(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const item = await dealDataService.getDealItem(
          input.dealId,
          input.productNumber,
        );

        if (!item) {
          throw new Error(
            `Product ${input.productNumber} not found in deal ${input.dealId}`,
          );
        }

        if (input.quantity > item.remainingQuantity) {
          throw new Error(
            `Requested quantity (${input.quantity}) exceeds remaining quantity (${item.remainingQuantity})`,
          );
        }

        const unitPrice = dealDataService.calculatePrice(
          item.dealerNetPrice,
          item.productFamily,
        );
        const totalPrice = unitPrice * input.quantity;

        return {
          productNumber: item.productNumber,
          productFamily: item.productFamily,
          quantity: input.quantity,
          remainingQuantity: item.remainingQuantity,
          unitPrice,
          totalPrice,
          currency: "USD",
          priceDisclaimer:
            "This quote is not to be used as a valid quote. Please reach out to InsightHPI@TDSYNNEX.com for a formal quote if needed.",
        };
      } catch (error) {
        logger.error("Failed to calculate price", "DEALS_ROUTER", {
          dealId: input.dealId,
          productNumber: input.productNumber,
          quantity: input.quantity,
          error,
        });
        throw error;
      }
    }),

  /**
   * Get deal analytics
   */
  getDealAnalytics: publicProcedure.query(async () => {
    try {
      // For now, return sample analytics
      // In production, this would query aggregated data
      return {
        totalDeals: 3,
        activeDeals: 3,
        expiredDeals: 0,
        totalValue: 471300.0,
        averageDealValue: 157100.0,
        topCustomers: [
          { name: "GLOBAL SYSTEMS LLC", dealCount: 1, totalValue: 256800.0 },
          { name: "ACME CORPORATION", dealCount: 1, totalValue: 125000.0 },
          { name: "TECH SOLUTIONS INC", dealCount: 1, totalValue: 89500.0 },
        ],
        productFamilyBreakdown: {
          IPG: { count: 4, value: 284925.0 },
          PSG: { count: 3, value: 186375.0 },
        },
        expirationAlerts: [
          {
            dealId: "46123789",
            customer: "GLOBAL SYSTEMS LLC",
            daysUntilExpiration: 158,
            endDate: "2025-06-30",
          },
          {
            dealId: "44892156",
            customer: "TECH SOLUTIONS INC",
            daysUntilExpiration: 204,
            endDate: "2025-08-15",
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get deal analytics", "DEALS_ROUTER", { error });
      throw new Error("Failed to retrieve analytics");
    }
  }),
});

export type DealsRouter = typeof dealsRouter;
