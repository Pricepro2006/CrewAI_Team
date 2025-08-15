/**
 * Cart Router - tRPC endpoints for cart persistence
 * Provides complete cart management with session and user support
 */

import { z } from "zod";
import { router, publicProcedure, createFeatureRouter } from "./enhanced-router.js";
import { CartPersistenceService } from "../services/CartPersistenceService.js";
import { logger } from "../../utils/logger.js";
import { v4 as uuidv4 } from "uuid";

// Initialize service
const cartService = new CartPersistenceService();

// Schemas
const cartItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(1).max(99),
  metadata: z.any().optional(),
});

const cartOperationSchema = z.object({
  sessionId: z.string(),
  userId: z.string().optional(),
  operation: z.enum(["add", "update", "remove", "clear"]),
  productId: z.string().optional(),
  quantity: z.number().optional(),
  metadata: z.any().optional(),
});

const getCartSchema = z.object({
  sessionId: z.string(),
  userId: z.string().optional(),
});

const saveForLaterSchema = z.object({
  cartId: z.string(),
  productId: z.string(),
  userId: z.string(),
});

const moveToCartSchema = z.object({
  userId: z.string(),
  productId: z.string(),
  cartId: z.string(),
});

export const cartRouter = createFeatureRouter(
  "cart",
  router({
    // Get or create cart
    getCart: publicProcedure
      .input(getCartSchema)
      .query(async ({ input }) => {
        try {
          const cart = await cartService.getOrCreateCart(
            input.sessionId,
            input.userId
          );
          
          logger.info("Cart retrieved", "CART", {
            cartId: cart.id,
            itemCount: cart?.items?.length,
            userId: input.userId,
          });
          
          return {
            success: true,
            cart,
          };
        } catch (error) {
          logger.error("Error getting cart", "CART", { error, input });
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to get cart",
            cart: null,
          };
        }
      }),

    // Cart operations (add/update/remove/clear)
    cartOperation: publicProcedure
      .input(cartOperationSchema)
      .mutation(async ({ input }) => {
        try {
          // Get or create cart first
          const cart = await cartService.getOrCreateCart(
            input.sessionId,
            input.userId
          );
          
          let result;
          
          switch (input.operation) {
            case "add":
            case "update":
              if (!input.productId || input.quantity === undefined) {
                throw new Error("Product ID and quantity required for add/update");
              }
              result = await cartService.addOrUpdateItem(
                cart.id,
                input.productId,
                input.quantity,
                input.metadata
              );
              break;
              
            case "remove":
              if (!input.productId) {
                throw new Error("Product ID required for remove");
              }
              result = await cartService.removeItem(cart.id, input.productId);
              break;
              
            case "clear":
              await cartService.clearCart(cart.id);
              result = { cleared: true };
              break;
              
            default:
              throw new Error(`Unknown operation: ${input.operation}`);
          }
          
          // Get updated cart
          const updatedCart = await cartService.getOrCreateCart(
            input.sessionId,
            input.userId
          );
          
          logger.info("Cart operation completed", "CART", {
            operation: input.operation,
            cartId: cart.id,
            productId: input.productId,
          });
          
          return {
            success: true,
            operation: input.operation,
            result,
            cart: updatedCart,
          };
        } catch (error) {
          logger.error("Cart operation failed", "CART", { error, input });
          return {
            success: false,
            error: error instanceof Error ? error.message : "Operation failed",
            cart: null,
          };
        }
      }),

    // Add item to cart
    addItem: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        userId: z.string().optional(),
        productId: z.string(),
        quantity: z.number().min(1).max(99).default(1),
        metadata: z.any().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const cart = await cartService.getOrCreateCart(
            input.sessionId,
            input.userId
          );
          
          const item = await cartService.addOrUpdateItem(
            cart.id,
            input.productId,
            input.quantity,
            input.metadata
          );
          
          const updatedCart = await cartService.getOrCreateCart(
            input.sessionId,
            input.userId
          );
          
          return {
            success: true,
            item,
            cart: updatedCart,
          };
        } catch (error) {
          logger.error("Error adding item to cart", "CART", { error, input });
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to add item",
            cart: null,
          };
        }
      }),

    // Update item quantity
    updateQuantity: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        userId: z.string().optional(),
        productId: z.string(),
        quantity: z.number().min(0).max(99),
      }))
      .mutation(async ({ input }) => {
        try {
          const cart = await cartService.getOrCreateCart(
            input.sessionId,
            input.userId
          );
          
          if (input.quantity === 0) {
            await cartService.removeItem(cart.id, input.productId);
          } else {
            await cartService.addOrUpdateItem(
              cart.id,
              input.productId,
              input.quantity
            );
          }
          
          const updatedCart = await cartService.getOrCreateCart(
            input.sessionId,
            input.userId
          );
          
          return {
            success: true,
            cart: updatedCart,
          };
        } catch (error) {
          logger.error("Error updating quantity", "CART", { error, input });
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to update",
            cart: null,
          };
        }
      }),

    // Remove item from cart
    removeItem: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        userId: z.string().optional(),
        productId: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const cart = await cartService.getOrCreateCart(
            input.sessionId,
            input.userId
          );
          
          await cartService.removeItem(cart.id, input.productId);
          
          const updatedCart = await cartService.getOrCreateCart(
            input.sessionId,
            input.userId
          );
          
          return {
            success: true,
            cart: updatedCart,
          };
        } catch (error) {
          logger.error("Error removing item", "CART", { error, input });
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to remove",
            cart: null,
          };
        }
      }),

    // Clear cart
    clearCart: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        userId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const cart = await cartService.getOrCreateCart(
            input.sessionId,
            input.userId
          );
          
          await cartService.clearCart(cart.id);
          
          return {
            success: true,
            cart: {
              ...cart,
              items: [],
              subtotal: 0,
              total: 0,
            },
          };
        } catch (error) {
          logger.error("Error clearing cart", "CART", { error, input });
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to clear",
          };
        }
      }),

    // Save item for later
    saveForLater: publicProcedure
      .input(saveForLaterSchema)
      .mutation(async ({ input }) => {
        try {
          await cartService.saveForLater(
            input.cartId,
            input.productId,
            input.userId
          );
          
          return {
            success: true,
            message: "Item saved for later",
          };
        } catch (error) {
          logger.error("Error saving for later", "CART", { error, input });
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to save",
          };
        }
      }),

    // Move saved item back to cart
    moveToCart: publicProcedure
      .input(moveToCartSchema)
      .mutation(async ({ input }) => {
        try {
          await cartService.moveToCart(
            input.userId,
            input.productId,
            input.cartId
          );
          
          return {
            success: true,
            message: "Item moved to cart",
          };
        } catch (error) {
          logger.error("Error moving to cart", "CART", { error, input });
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to move",
          };
        }
      }),

    // Convert cart to order
    convertToOrder: publicProcedure
      .input(z.object({
        cartId: z.string(),
        orderId: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          await cartService.convertCart(input.cartId, input.orderId);
          
          return {
            success: true,
            orderId: input.orderId,
            message: "Cart converted to order",
          };
        } catch (error) {
          logger.error("Error converting cart", "CART", { error, input });
          return {
            success: false,
            error: error instanceof Error ? error.message : "Conversion failed",
          };
        }
      }),

    // Get cart statistics
    getStats: publicProcedure
      .input(z.object({
        period: z.enum(["day", "week", "month"]).default("day"),
      }))
      .query(async ({ input }) => {
        try {
          const stats = cartService.getCartStats(input.period);
          
          return {
            success: true,
            stats,
          };
        } catch (error) {
          logger.error("Error getting cart stats", "CART", { error });
          return {
            success: false,
            stats: null,
          };
        }
      }),

    // Track product view
    trackView: publicProcedure
      .input(z.object({
        productId: z.string(),
        sessionId: z.string(),
        userId: z.string().optional(),
        interactionType: z.enum(["view", "quick_view", "compare", "zoom"])
          .default("view"),
      }))
      .mutation(async ({ input }) => {
        try {
          await cartService.trackProductView(
            input.productId,
            input.sessionId,
            input.userId,
            input.interactionType
          );
          
          return {
            success: true,
            tracked: true,
          };
        } catch (error) {
          logger.error("Error tracking view", "CART", { error, input });
          return {
            success: false,
            tracked: false,
          };
        }
      }),

    // Get recently viewed products
    getRecentlyViewed: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        userId: z.string().optional(),
        limit: z.number().min(1).max(50).default(10),
      }))
      .query(async ({ input }) => {
        try {
          const productIds = cartService.getRecentlyViewed(
            input.sessionId,
            input.userId,
            input.limit
          );
          
          return {
            success: true,
            productIds,
          };
        } catch (error) {
          logger.error("Error getting recently viewed", "CART", { error });
          return {
            success: false,
            productIds: [],
          };
        }
      }),

    // Generate session ID for new users
    generateSession: publicProcedure
      .query(() => {
        const sessionId = `session-${uuidv4()}`;
        
        return {
          success: true,
          sessionId,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        };
      }),
  })
);