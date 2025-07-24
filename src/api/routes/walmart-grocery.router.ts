import { z } from "zod";
import {
  router,
  publicProcedure,
  commonSchemas,
  createFeatureRouter,
} from "../trpc/enhanced-router";
import { observable } from "@trpc/server/observable";
import { EventEmitter } from "events";
import { logger } from "../../utils/logger";
import { withTimeout, DEFAULT_TIMEOUTS } from "../../utils/timeout";
import { BrightDataService } from "../../core/data-collection/BrightDataService";
import type { CollectedData } from "../../core/data-collection/types";

// Event emitter for real-time updates
const walmartEvents = new EventEmitter();

// Input validation schemas
const walmartSchemas = {
  productSearch: z.object({
    query: z.string().min(1).max(500),
    category: z.string().optional(),
    minPrice: z.number().optional(),
    maxPrice: z.number().optional(),
    inStock: z.boolean().optional(),
    storeId: z.string().optional(),
    limit: z.number().min(1).max(100).default(20),
  }),

  productDetails: z.object({
    productId: z.string(),
    includeReviews: z.boolean().default(false),
    includeAvailability: z.boolean().default(true),
  }),

  cartOperation: z.object({
    userId: z.string(),
    productId: z.string(),
    quantity: z.number().min(1).max(99),
    operation: z.enum(["add", "update", "remove"]),
  }),

  dealAnalysis: z.object({
    productIds: z.array(z.string()).min(1).max(50),
    dealId: z.string().optional(),
    customerId: z.string().optional(),
  }),

  scraperConfig: z.object({
    url: z.string().url(),
    extractType: z.enum(["product", "search", "category", "deals"]),
    options: z.record(z.any()).optional(),
  }),
};

// Create the Walmart grocery router
export const walmartGroceryRouter = createFeatureRouter(
  "walmartGrocery",
  router({
    // Search for products
    searchProducts: publicProcedure
      .input(walmartSchemas.productSearch)
      .mutation(async ({ input, ctx }) => {
        logger.info("Searching Walmart products", "WALMART", {
          query: input.query,
          filters: {
            category: input.category,
            priceRange: [input.minPrice, input.maxPrice],
            inStock: input.inStock,
          },
        });

        try {
          // Use BrightData service for product search
          const brightData = new BrightDataService(
            { rateLimitPerMinute: 60 },
            ctx.mcpTools, // Pass MCP tools from context
          );

          const searchResults = await brightData.collectEcommerceData({
            platform: "walmart",
            searchKeyword: input.query,
            maxProducts: input.limit,
            includeReviews: false,
            includeAvailability: input.inStock,
          });

          // Process with MasterOrchestrator for enhanced analysis
          const processedResults = await ctx.masterOrchestrator.processQuery({
            text: `Analyze these Walmart grocery search results for "${input.query}" and provide recommendations`,
            context: {
              searchResults: searchResults.map((r) => r.data),
              filters: input,
              requestType: "product_search",
            },
          });

          // Store in RAG system for future reference
          await ctx.ragSystem.addDocument(
            JSON.stringify({
              query: input.query,
              results: searchResults,
              analysis: processedResults,
              timestamp: new Date(),
            }),
            {
              id: `walmart-search-${Date.now()}`,
              title: `Walmart Search: ${input.query}`,
              tags: ["walmart", "search", "grocery"],
            },
          );

          // Emit real-time update
          walmartEvents.emit("search_completed", {
            query: input.query,
            resultCount: searchResults.length,
            timestamp: new Date(),
          });

          return {
            success: true,
            products: searchResults,
            analysis: processedResults.summary,
            metadata: {
              totalResults: searchResults.length,
              searchId: `search-${Date.now()}`,
              cached: false,
            },
          };
        } catch (error) {
          logger.error("Product search failed", "WALMART", { error });
          throw new Error(
            `Failed to search products: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }),

    // Get product details with scraping
    getProductDetails: publicProcedure
      .input(walmartSchemas.productDetails)
      .query(async ({ input, ctx }) => {
        logger.info("Fetching product details", "WALMART", {
          productId: input.productId,
          options: input,
        });

        try {
          // First check RAG cache
          const cachedData = await ctx.ragSystem.search(
            `walmart product ${input.productId}`,
            1,
          );

          if (cachedData.length > 0 && cachedData[0].score > 0.8) {
            logger.info("Returning cached product data", "WALMART");
            return {
              source: "cache",
              data: cachedData[0].content,
              timestamp: cachedData[0].metadata.timestamp,
            };
          }

          // Use BrightData for fresh data
          const brightData = new BrightDataService(
            { rateLimitPerMinute: 60 },
            ctx.mcpTools,
          );

          const productUrl = `https://www.walmart.com/ip/${input.productId}`;
          const productData = await brightData.collectEcommerceData({
            platform: "walmart",
            productUrl,
            includeReviews: input.includeReviews,
            includeAvailability: input.includeAvailability,
          });

          // Store in RAG for future use
          await ctx.ragSystem.addDocument(JSON.stringify(productData[0].data), {
            id: `walmart-product-${input.productId}`,
            title: `Walmart Product: ${input.productId}`,
            tags: ["walmart", "product", "grocery"],
            productId: input.productId,
            timestamp: new Date(),
          });

          return {
            source: "fresh",
            data: productData[0].data,
            timestamp: new Date(),
          };
        } catch (error) {
          logger.error("Failed to fetch product details", "WALMART", { error });
          throw error;
        }
      }),

    // Cart operations with deal integration
    cartOperation: publicProcedure
      .input(walmartSchemas.cartOperation)
      .mutation(async ({ input, ctx }) => {
        logger.info("Processing cart operation", "WALMART", {
          operation: input.operation,
          userId: input.userId,
          productId: input.productId,
        });

        try {
          // Get user's cart from conversation service
          let cart = await ctx.conversationService.get(`cart-${input.userId}`);

          if (!cart) {
            cart = await ctx.conversationService.create();
            await ctx.conversationService.updateTitle(
              cart.id,
              `Cart for ${input.userId}`,
            );
          }

          // Process cart operation
          let cartUpdate;
          switch (input.operation) {
            case "add":
              cartUpdate = {
                action: "add_item",
                productId: input.productId,
                quantity: input.quantity,
              };
              break;
            case "update":
              cartUpdate = {
                action: "update_quantity",
                productId: input.productId,
                quantity: input.quantity,
              };
              break;
            case "remove":
              cartUpdate = {
                action: "remove_item",
                productId: input.productId,
              };
              break;
          }

          // Check for applicable deals
          const dealAnalysis = await ctx.dealDataService.analyzeDealForProducts(
            [input.productId],
            input.userId,
          );

          // Update cart in conversation
          await ctx.conversationService.addMessage(cart.id, {
            role: "system",
            content: JSON.stringify({
              type: "cart_update",
              update: cartUpdate,
              timestamp: new Date(),
              deals: dealAnalysis,
            }),
          });

          // Emit real-time update
          walmartEvents.emit("cart_updated", {
            userId: input.userId,
            cartId: cart.id,
            operation: input.operation,
            productId: input.productId,
            timestamp: new Date(),
          });

          return {
            success: true,
            cartId: cart.id,
            operation: input.operation,
            deals: dealAnalysis,
            message: `Cart ${input.operation} successful`,
          };
        } catch (error) {
          logger.error("Cart operation failed", "WALMART", { error });
          throw error;
        }
      }),

    // Analyze deals for products
    analyzeDeal: publicProcedure
      .input(walmartSchemas.dealAnalysis)
      .query(async ({ input, ctx }) => {
        logger.info("Analyzing deals for products", "WALMART", {
          productCount: input.productIds.length,
          dealId: input.dealId,
        });

        try {
          // Get product details for all products
          const productPromises = input.productIds.map(async (productId) => {
            const cached = await ctx.ragSystem.search(
              `walmart product ${productId}`,
              1,
            );
            return cached.length > 0 ? cached[0].content : null;
          });

          const products = await Promise.all(productPromises);

          // Analyze with deal service
          const dealAnalysis = await ctx.dealDataService.analyzeDealForProducts(
            input.productIds,
            input.customerId || "default",
          );

          // Process with MasterOrchestrator for recommendations
          const analysis = await ctx.masterOrchestrator.processQuery({
            text: "Analyze these products for deal opportunities and savings",
            context: {
              products: products.filter(Boolean),
              dealAnalysis,
              customerId: input.customerId,
            },
          });

          return {
            products: input.productIds,
            dealAnalysis,
            recommendations: analysis.summary,
            potentialSavings: dealAnalysis.totalSavings || 0,
            applicableDeals: dealAnalysis.deals || [],
          };
        } catch (error) {
          logger.error("Deal analysis failed", "WALMART", { error });
          throw error;
        }
      }),

    // Scrape Walmart data with BrightData
    scrapeData: publicProcedure
      .input(walmartSchemas.scraperConfig)
      .mutation(async ({ input, ctx }) => {
        logger.info("Scraping Walmart data", "WALMART", {
          url: input.url,
          type: input.extractType,
        });

        try {
          const brightData = new BrightDataService(
            { rateLimitPerMinute: 60 },
            ctx.mcpTools,
          );

          let scrapedData: CollectedData[];

          switch (input.extractType) {
            case "product":
              scrapedData = await brightData.collectEcommerceData({
                platform: "walmart",
                productUrl: input.url,
                includeReviews: true,
                includeAvailability: true,
              });
              break;

            case "search":
            case "category":
            case "deals":
              scrapedData = await brightData.collectWebScrapingData({
                url: input.url,
                extractionPrompt: `Extract ${input.extractType} data from this Walmart page`,
                followLinks: false,
                respectRobots: true,
              });
              break;

            default:
              throw new Error(`Unknown extract type: ${input.extractType}`);
          }

          // Store scraped data
          for (const data of scrapedData) {
            await ctx.ragSystem.addDocument(JSON.stringify(data.data), {
              id: data.id,
              title: `Walmart ${input.extractType}: ${input.url}`,
              tags: ["walmart", "scraped", input.extractType],
              url: input.url,
              timestamp: new Date(),
            });
          }

          // Emit completion event
          walmartEvents.emit("scraping_completed", {
            url: input.url,
            type: input.extractType,
            recordsCollected: scrapedData.length,
          });

          return {
            success: true,
            recordsCollected: scrapedData.length,
            data: scrapedData,
            message: `Successfully scraped ${scrapedData.length} records`,
          };
        } catch (error) {
          logger.error("Scraping failed", "WALMART", { error });
          throw error;
        }
      }),

    // Subscribe to real-time updates
    onUpdate: publicProcedure
      .input(
        z.object({
          events: z.array(
            z.enum(["search", "cart", "scraping", "deals", "all"]),
          ),
          userId: z.string().optional(),
        }),
      )
      .subscription(({ input }) => {
        return observable((observer) => {
          const handlers: Record<string, (data: any) => void> = {};

          // Subscribe to requested events
          if (input.events.includes("all") || input.events.includes("search")) {
            handlers.search_completed = (data) => {
              observer.next({ type: "search_completed", data });
            };
            walmartEvents.on("search_completed", handlers.search_completed);
          }

          if (input.events.includes("all") || input.events.includes("cart")) {
            handlers.cart_updated = (data) => {
              if (!input.userId || data.userId === input.userId) {
                observer.next({ type: "cart_updated", data });
              }
            };
            walmartEvents.on("cart_updated", handlers.cart_updated);
          }

          if (
            input.events.includes("all") ||
            input.events.includes("scraping")
          ) {
            handlers.scraping_completed = (data) => {
              observer.next({ type: "scraping_completed", data });
            };
            walmartEvents.on("scraping_completed", handlers.scraping_completed);
          }

          // Cleanup on unsubscribe
          return () => {
            Object.entries(handlers).forEach(([event, handler]) => {
              walmartEvents.off(event, handler);
            });
          };
        });
      }),

    // Get shopping recommendations
    getRecommendations: publicProcedure
      .input(
        z.object({
          userId: z.string(),
          category: z.string().optional(),
          budget: z.number().optional(),
          dietaryRestrictions: z.array(z.string()).optional(),
        }),
      )
      .query(async ({ input, ctx }) => {
        logger.info("Generating shopping recommendations", "WALMART", {
          userId: input.userId,
          filters: input,
        });

        try {
          // Get user's shopping history from conversations
          const userHistory = await ctx.conversationService.search(
            `cart-${input.userId}`,
            10,
          );

          // Analyze with MasterOrchestrator
          const recommendations = await ctx.masterOrchestrator.processQuery({
            text: "Generate personalized Walmart grocery shopping recommendations",
            context: {
              userId: input.userId,
              shoppingHistory: userHistory,
              preferences: {
                category: input.category,
                budget: input.budget,
                dietaryRestrictions: input.dietaryRestrictions,
              },
            },
          });

          return {
            userId: input.userId,
            recommendations: recommendations.summary,
            categories: recommendations.metadata?.categories || [],
            estimatedBudget: recommendations.metadata?.budget || 0,
            timestamp: new Date(),
          };
        } catch (error) {
          logger.error("Failed to generate recommendations", "WALMART", {
            error,
          });
          throw error;
        }
      }),

    // Upload receipt for analysis
    uploadReceipt: publicProcedure
      .input(
        z.object({
          userId: z.string(),
          receiptData: z.string(), // Base64 encoded
          mimeType: z.string(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        logger.info("Processing receipt upload", "WALMART", {
          userId: input.userId,
          mimeType: input.mimeType,
        });

        try {
          // Decode and process receipt
          const buffer = Buffer.from(input.receiptData, "base64");
          const receiptId = `receipt-${Date.now()}`;

          // Store in RAG system
          await ctx.ragSystem.addDocument(buffer.toString("utf-8"), {
            id: receiptId,
            title: `Walmart Receipt - ${input.userId}`,
            userId: input.userId,
            mimeType: input.mimeType,
            uploadedAt: new Date(),
            tags: ["walmart", "receipt", "purchase"],
          });

          // Analyze with MasterOrchestrator
          const analysis = await ctx.masterOrchestrator.processQuery({
            text: "Analyze this Walmart receipt for spending patterns and savings opportunities",
            context: {
              receiptId,
              userId: input.userId,
            },
          });

          return {
            success: true,
            receiptId,
            analysis: analysis.summary,
            insights: analysis.metadata?.insights || [],
          };
        } catch (error) {
          logger.error("Receipt upload failed", "WALMART", { error });
          throw error;
        }
      }),
  }),
);
