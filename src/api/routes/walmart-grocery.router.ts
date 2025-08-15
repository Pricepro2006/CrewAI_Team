import { z } from "zod";
import {
  router,
  publicProcedure,
  commonSchemas,
  createFeatureRouter,
} from "../trpc/enhanced-router.js";
import {
  databaseMiddleware,
  walmartDatabaseMiddleware,
  safeColumnAccess,
  withDatabaseContext,
  type DatabaseContext,
  type SafeQueryResult
} from "../trpc/database-middleware.js";
import { observable } from "@trpc/server/observable";
import { EventEmitter } from "events";
import { logger } from "../../utils/logger.js";
import { withTimeout, DEFAULT_TIMEOUTS } from "../../utils/timeout.js";
import { BrightDataService } from "../../core/data-collection/BrightDataService.js";
import type { CollectedData } from "../../core/data-collection/types.js";
import { WalmartGroceryService } from "../services/WalmartGroceryService.js";
import { GroceryListRepository, GroceryItemRepository } from "../../database/repositories/GroceryRepository.js";
import { getDatabaseManager } from "../../database/DatabaseManager.js";
import type { WalmartProduct } from "../../types/walmart-grocery.js";

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

  // List management schemas
  createList: z.object({
    userId: z.string(),
    name: z.string().min(1).max(100),
    description: z.string().optional(),
  }),

  updateList: z.object({
    listId: z.string(),
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
  }),

  addItemToList: z.object({
    listId: z.string(),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().min(1).max(99),
      listId: z.string().optional(),
      notes: z.string().optional(),
    })),
  }),

  removeItemFromList: z.object({
    listId: z.string(),
    itemId: z.string(),
  }),

  // Order management schemas
  createOrder: z.object({
    userId: z.string(),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().min(1),
      price: z.number(),
    })),
    deliveryAddress: z.string(),
    deliveryDate: z.string(),
    deliverySlot: z.string(),
  }),

  updateOrderStatus: z.object({
    orderId: z.string(),
    status: z.enum(["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"]),
  }),

  // Preference schemas
  updatePreferences: z.object({
    userId: z.string(),
    preferences: z.object({
      dietaryRestrictions: z.array(z.string()).optional(),
      allergies: z.array(z.string()).optional(),
      favoriteCategories: z.array(z.string()).optional(),
      preferredBrands: z.array(z.string()).optional(),
      avoidBrands: z.array(z.string()).optional(),
      deliveryPreferences: z.object({
        preferredDays: z.array(z.string()).optional(),
        preferredTimeSlots: z.array(z.string()).optional(),
      }).optional(),
    }),
  }),

  // Alert schemas
  createAlert: z.object({
    userId: z.string(),
    productId: z.string(),
    alertType: z.enum(["price_drop", "back_in_stock", "deal"]),
    targetPrice: z.number().optional(),
  }),

  // Price tracking schemas
  trackPrice: z.object({
    productId: z.string(),
    userId: z.string(),
    targetPrice: z.number().optional(),
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

          const collectedData = await brightData.collectEcommerceData({
            platform: "walmart",
            searchKeyword: input.query,
            maxProducts: input.limit,
          });

          // Transform CollectedData to WalmartProduct format
          const searchResults: WalmartProduct[] = collectedData?.map(item => ({
            id: item?.data?.id || item.id,
            walmartId: item?.data?.id || item.id,
            upc: item?.data?.upc,
            name: item?.data?.name || item?.data?.title || '',
            brand: item?.data?.brand || '',
            category: {
              id: item?.data?.categoryId || '1',
              name: typeof item?.data?.category === 'string' ? item?.data?.category : 'Uncategorized',
              path: typeof item?.data?.category === 'string' ? [item?.data?.category] : ['Uncategorized'],
              level: 1
            },
            subcategory: item?.data?.subcategory,
            description: item?.data?.description || '',
            shortDescription: item?.data?.shortDescription,
            price: {
              currency: 'USD',
              regular: parseFloat(item?.data?.price) || 0,
              sale: item?.data?.originalPrice ? parseFloat(item?.data?.originalPrice) : undefined,
              unit: item?.data?.unitPrice ? parseFloat(item?.data?.unitPrice) : undefined,
              unitOfMeasure: item?.data?.unit || 'each',
              pricePerUnit: item?.data?.pricePerUnit,
              wasPrice: item?.data?.originalPrice ? parseFloat(item?.data?.originalPrice) : undefined
            },
            images: [{
              id: '1',
              url: item?.data?.imageUrl || item?.data?.image || '',
              type: 'primary' as const,
              alt: item?.data?.name || item?.data?.title || ''
            }],
            availability: {
              inStock: item?.data?.inStock !== false,
              stockLevel: item?.data?.stockLevel ? (item?.data?.inStock ? ('in_stock' as const) : ('out_of_stock' as const)) : undefined,
              quantity: item?.data?.quantity,
              onlineOnly: item?.data?.onlineOnly,
              instoreOnly: item?.data?.instoreOnly
            },
            ratings: item?.data?.rating ? {
              average: parseFloat(item?.data?.rating),
              count: parseInt(item?.data?.reviewCount) || 0,
              distribution: {
                5: 0,
                4: 0,
                3: 0,
                2: 0,
                1: 0
              }
            } : undefined,
            nutritionFacts: item?.data?.nutritionalInfo,
            ingredients: item?.data?.ingredients,
            allergens: item?.data?.allergens,
            metadata: {
              source: 'scrape' as const,
              lastScraped: new Date().toISOString(),
              confidence: 0.8,
              dealEligible: true
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }));

          // Process with MasterOrchestrator for enhanced analysis
          const processedResults = await ctx?.masterOrchestrator?.processQuery({
            text: `Analyze these Walmart grocery search results for "${input.query}" and provide recommendations`,
            metadata: {
              searchResults: searchResults,
              filters: input,
              requestType: "product_search",
            },
          });

          // Store in RAG system for future reference
          await ctx?.ragSystem?.addDocument(
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
            resultCount: searchResults?.length || 0,
            timestamp: new Date(),
          });

          return {
            success: true,
            products: searchResults,
            analysis: processedResults.summary,
            metadata: {
              totalResults: searchResults?.length || 0,
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
          const cachedData = await ctx?.ragSystem?.search(
            `walmart product ${input.productId}`,
            1,
          );

          if (cachedData?.length || 0 > 0 && cachedData[0].score > 0.8) {
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

          const productUrl = `https://www?.walmart.com/ip/${input.productId}`;
          const productData = await brightData.collectEcommerceData({
            platform: "walmart",
            productUrl,
            // Note: includeReviews and includeAvailability are not supported by BrightData API
            // These were part of the product details input but not used in the actual collection
          });

          // Store in RAG for future use
          if (productData && productData?.length || 0 > 0 && productData[0]) {
            await ctx?.ragSystem?.addDocument(JSON.stringify(productData[0].data), {
              id: `walmart-product-${input.productId}`,
              title: `Walmart Product: ${input.productId}`,
              tags: ["walmart", "product", "grocery"],
              productId: input.productId,
              timestamp: new Date(),
            });
          }

          return {
            source: "fresh",
            data: productData && productData?.length || 0 > 0 && productData[0] ? productData[0].data : null,
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
          let cart = await ctx?.conversationService?.get(`cart-${input.userId}`);

          if (!cart) {
            cart = await ctx?.conversationService?.create();
            await ctx?.conversationService?.updateTitle(
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
          const dealAnalysis = await ctx?.dealDataService?.analyzeDealForProducts(
            [input.productId],
            input.userId,
          );

          // Update cart in conversation
          await ctx?.conversationService?.addMessage(cart.id, {
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
          productCount: input?.productIds?.length,
          dealId: input.dealId,
        });

        try {
          // Get product details for all products
          const productPromises = input.productIds?.map(async (productId: any) => {
            const cached = await ctx?.ragSystem?.search(
              `walmart product ${productId}`,
              1,
            );
            return cached?.length || 0 > 0 ? cached[0].content : null;
          });

          const products = await Promise.all(productPromises);

          // Analyze with deal service
          const dealAnalysis = await ctx?.dealDataService?.analyzeDealForProducts(
            input.productIds,
            input.customerId || "default",
          );

          // Process with MasterOrchestrator for recommendations
          const analysis = await ctx?.masterOrchestrator?.processQuery({
            text: "Analyze these products for deal opportunities and savings",
            metadata: {
              products: products?.filter(Boolean),
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
                // Note: includeReviews and includeAvailability are not supported by BrightData API
                // These options were removed from the collectEcommerceData call
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
            await ctx?.ragSystem?.addDocument(JSON.stringify(data.data), {
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
            recordsCollected: scrapedData?.length || 0,
          });

          return {
            success: true,
            recordsCollected: scrapedData?.length || 0,
            data: scrapedData,
            message: `Successfully scraped ${scrapedData?.length || 0} records`,
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
            z.enum(["search", "cart", "scraping", "deals", "grocery", "recommendations", "totals", "all"]),
          ),
          userId: z.string().optional(),
        }),
      )
      .subscription(({ input }) => {
        return observable((observer: any) => {
          const handlers: Record<string, (data: any) => void> = {};

          // Subscribe to requested events
          if (input?.events?.includes("all") || input?.events?.includes("search")) {
            handlers.search_completed = (data: any) => {
              observer.next({ type: "search_completed", data });
            };
            walmartEvents.on("search_completed", handlers.search_completed);
          }

          if (input?.events?.includes("all") || input?.events?.includes("cart")) {
            handlers.cart_updated = (data: any) => {
              if (!input.userId || data.userId === input.userId || "") {
                observer.next({ type: "cart_updated", data });
              }
            };
            walmartEvents.on("cart_updated", handlers.cart_updated);
          }

          if (
            input?.events?.includes("all") ||
            input?.events?.includes("scraping")
          ) {
            handlers.scraping_completed = (data: any) => {
              observer.next({ type: "scraping_completed", data });
            };
            walmartEvents.on("scraping_completed", handlers.scraping_completed);
          }

          if (input?.events?.includes("all") || input?.events?.includes("grocery")) {
            handlers.grocery_input_processed = (data: any) => {
              if (!input.userId || data.userId === input.userId || "") {
                observer.next({ type: "grocery_input_processed", data });
              }
            };
            walmartEvents.on("grocery_input_processed", handlers.grocery_input_processed);
          }

          if (input?.events?.includes("all") || input?.events?.includes("recommendations")) {
            handlers.recommendations_generated = (data: any) => {
              if (!input.userId || data.userId === input.userId || "") {
                observer.next({ type: "recommendations_generated", data });
              }
            };
            walmartEvents.on("recommendations_generated", handlers.recommendations_generated);
          }

          if (input?.events?.includes("all") || input?.events?.includes("totals")) {
            handlers.totals_calculated = (data: any) => {
              observer.next({ type: "totals_calculated", data });
            };
            walmartEvents.on("totals_calculated", handlers.totals_calculated);
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
          const userHistory = await ctx?.conversationService?.search(
            `cart-${input.userId}`,
            10,
          );

          // Analyze with MasterOrchestrator
          const recommendations = await ctx?.masterOrchestrator?.processQuery({
            text: "Generate personalized Walmart grocery shopping recommendations",
            metadata: {
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
          await ctx?.ragSystem?.addDocument(buffer.toString("utf-8"), {
            id: receiptId,
            title: `Walmart Receipt - ${input.userId}`,
            userId: input.userId,
            mimeType: input.mimeType,
            uploadedAt: new Date(),
            tags: ["walmart", "receipt", "purchase"],
          });

          // Analyze with MasterOrchestrator
          const analysis = await ctx?.masterOrchestrator?.processQuery({
            text: "Analyze this Walmart receipt for spending patterns and savings opportunities",
            metadata: {
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

    // Get grocery lists for a user
    getLists: publicProcedure
      .use(walmartDatabaseMiddleware)
      .input(z.object({ userId: z.string() }))
      .query(async ({ ctx, input }) => {
        const dbCtx = ctx as DatabaseContext;
        logger.info("Fetching grocery lists", "WALMART", {
          userId: input.userId,
        });

        const listsResult = await dbCtx?.safeDb?.select(
          'grocery_lists',
          ['id', 'user_id', 'name', 'description', 'estimated_total', 'created_at', 'updated_at'],
          'user_id = ?',
          [input.userId]
        );

        if (listsResult?.warnings?.length > 0) {
          logger.warn("Schema warnings in getLists", "WALMART", {
            warnings: listsResult.warnings,
            missingColumns: listsResult.missingColumns
          });
        }

        return {
          lists: listsResult?.data?.map(list => ({
            id: safeColumnAccess(list, 'id', ''),
            userId: safeColumnAccess(list, 'user_id', input.userId),
            name: safeColumnAccess(list, 'name', 'Unnamed List'),
            description: safeColumnAccess(list, 'description', ''),
            items: [],
            totalEstimate: safeColumnAccess(list, 'estimated_total', 0),
            createdAt: new Date(safeColumnAccess(list, 'created_at', Date.now())),
            updatedAt: new Date(safeColumnAccess(list, 'updated_at', Date.now())),
            tags: [],
            isShared: false,
          })),
        };
      }),

    // Create a new grocery list
    createList: publicProcedure
      .use(walmartDatabaseMiddleware)
      .input(walmartSchemas.createList)
      .mutation(async ({ ctx, input }) => {
        const dbCtx = ctx as DatabaseContext;
        logger.info("Creating grocery list", "WALMART", input);

        const listData = {
          user_id: input.userId,
          name: input.name,
          description: input.description || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const result = await dbCtx?.safeDb?.insert('grocery_lists', listData);

        if (result?.warnings?.length > 0) {
          logger.warn("Schema warnings in createList", "WALMART", {
            warnings: result.warnings,
            skippedColumns: result.skippedColumns
          });
        }

        // Get the created list to return full data
        const createdLists = await dbCtx?.safeDb?.select(
          'grocery_lists',
          ['id', 'user_id', 'name', 'description', 'created_at', 'updated_at'],
          'user_id = ? AND name = ?',
          [input.userId, input.name]
        );

        const list = createdLists.data[0];

        return {
          success: true,
          list: {
            id: safeColumnAccess(list, 'id', ''),
            userId: safeColumnAccess(list, 'user_id', input.userId),
            name: safeColumnAccess(list, 'name', input.name),
            description: safeColumnAccess(list, 'description', input.description || ''),
            items: [],
            totalEstimate: 0,
            createdAt: new Date(safeColumnAccess(list, 'created_at', Date.now())),
            updatedAt: new Date(safeColumnAccess(list, 'updated_at', Date.now())),
            tags: [],
            isShared: false,
          },
        };
      }),

    // Update a grocery list
    updateList: publicProcedure
      .use(walmartDatabaseMiddleware)
      .input(walmartSchemas.updateList)
      .mutation(async ({ ctx, input }) => {
        const dbCtx = ctx as DatabaseContext;
        logger.info("Updating grocery list", "WALMART", input);

        const updateData: Record<string, any> = {
          updated_at: new Date().toISOString()
        };

        if (input.name) {
          updateData.name = input.name;
        }
        if (input.description !== undefined) {
          updateData.description = input.description;
        }

        const result = await dbCtx?.safeDb?.update(
          'grocery_lists',
          updateData,
          'id = ?',
          [input.listId]
        );

        if (result?.warnings?.length > 0) {
          logger.warn("Schema warnings in updateList", "WALMART", {
            warnings: result.warnings,
            skippedColumns: result.skippedColumns
          });
        }

        if (result.affectedRows === 0) {
          throw new Error(`List with ID ${input.listId} not found`);
        }

        return {
          success: true,
          listId: input.listId,
          affectedRows: result.affectedRows,
        };
      }),

    // Delete a grocery list
    deleteList: publicProcedure
      .use(walmartDatabaseMiddleware)
      .input(z.object({ listId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const dbCtx = ctx as DatabaseContext;
        logger.info("Deleting grocery list", "WALMART", input);

        const result = await dbCtx?.safeDb?.delete(
          'grocery_lists',
          'id = ?',
          [input.listId]
        );

        if (result.affectedRows === 0) {
          throw new Error(`List with ID ${input.listId} not found`);
        }

        return {
          success: true,
          listId: input.listId,
          affectedRows: result.affectedRows,
        };
      }),

    // Add items to a list
    addItemToList: publicProcedure
      .input(walmartSchemas.addItemToList)
      .mutation(async ({ input, ctx }) => {
        logger.info("Adding items to list", "WALMART", {
          listId: input.listId,
          itemCount: input?.items?.length,
        });

        try {
          const walmartService = WalmartGroceryService.getInstance();
          // Transform input items to match CartItem interface
          const cartItems = input?.items?.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            listId: input.listId,
            notes: item.notes
          }));

          const items = await walmartService.addItemsToList(
            input.listId,
            cartItems,
          );

          return {
            success: true,
            items,
          };
        } catch (error) {
          logger.error("Failed to add items", "WALMART", { error });
          throw error;
        }
      }),

    // Remove item from list
    removeItemFromList: publicProcedure
      .use(walmartDatabaseMiddleware)
      .input(walmartSchemas.removeItemFromList)
      .mutation(async ({ ctx, input }) => {
        const dbCtx = ctx as DatabaseContext;
        logger.info("Removing item from list", "WALMART", input);

        const result = await dbCtx?.safeDb?.delete(
          'grocery_items',
          'id = ? AND list_id = ?',
          [input.itemId, input.listId]
        );

        if (result.affectedRows === 0) {
          throw new Error(`Item with ID ${input.itemId} not found in list ${input.listId}`);
        }

        return {
          success: true,
          listId: input.listId,
          itemId: input.itemId,
          affectedRows: result.affectedRows,
        };
      }),

    // Get user orders
    getOrders: publicProcedure
      .input(z.object({
        userId: z.string(),
        limit: z.number().optional().default(20),
        offset: z.number().optional().default(0),
      }))
      .query(async ({ input, ctx }) => {
        logger.info("Fetching orders", "WALMART", input);

        try {
          // For now, return mock data until order repository is implemented
          const mockOrders = [{
            id: `order-${Date.now()}`,
            userId: input.userId,
            orderNumber: `WM${Date.now()}`,
            items: [],
            subtotal: 0,
            tax: 0,
            fees: 0,
            deliveryFee: 0,
            total: 0,
            status: "pending" as const,
            orderDate: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            deliveryAddress: "123 Main St",
            deliveryDate: new Date(),
            deliverySlot: "10:00 AM - 12:00 PM",
          }];

          return {
            orders: mockOrders,
            totalCount: mockOrders?.length || 0,
          };
        } catch (error) {
          logger.error("Failed to fetch orders", "WALMART", { error });
          throw error;
        }
      }),

    // Get single order details
    getOrder: publicProcedure
      .input(z.object({ orderId: z.string() }))
      .query(async ({ input, ctx }) => {
        logger.info("Fetching order details", "WALMART", input);

        try {
          // Mock implementation
          return {
            order: {
              id: input.orderId,
              userId: "mock-user",
              orderNumber: `WM${input.orderId}`,
              items: [],
              subtotal: 0,
              tax: 0,
              fees: 0,
              deliveryFee: 0,
              total: 0,
              status: "pending" as const,
              orderDate: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
              deliveryAddress: "123 Main St",
              deliveryDate: new Date(),
              deliverySlot: "10:00 AM - 12:00 PM",
            },
          };
        } catch (error) {
          logger.error("Failed to fetch order", "WALMART", { error });
          throw error;
        }
      }),

    // Create a new order
    createOrder: publicProcedure
      .input(walmartSchemas.createOrder)
      .mutation(async ({ input, ctx }) => {
        logger.info("Creating order", "WALMART", input);

        try {
          const orderId = `order-${Date.now()}`;
          const orderNumber = `WM${Date.now()}`;

          // Calculate totals
          const subtotal = input?.items?.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0,
          );
          const tax = subtotal * 0.08; // 8% tax
          const deliveryFee = subtotal >= 35 ? 0 : 4.95;
          const total = subtotal + tax + deliveryFee;

          const order = {
            id: orderId,
            userId: input.userId,
            orderNumber,
            items: input.items,
            subtotal,
            tax,
            fees: 0,
            deliveryFee,
            total,
            status: "pending" as const,
            orderDate: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            deliveryAddress: input.deliveryAddress,
            deliveryDate: new Date(input.deliveryDate),
            deliverySlot: input.deliverySlot,
          };

          return {
            success: true,
            order,
          };
        } catch (error) {
          logger.error("Failed to create order", "WALMART", { error });
          throw error;
        }
      }),

    // Update order status
    updateOrderStatus: publicProcedure
      .input(walmartSchemas.updateOrderStatus)
      .mutation(async ({ input, ctx }) => {
        logger.info("Updating order status", "WALMART", input);

        try {
          return {
            success: true,
            orderId: input.orderId,
            status: input.status,
          };
        } catch (error) {
          logger.error("Failed to update order status", "WALMART", { error });
          throw error;
        }
      }),

    // Track order
    trackOrder: publicProcedure
      .input(z.object({ orderId: z.string() }))
      .query(async ({ input, ctx }) => {
        logger.info("Tracking order", "WALMART", input);

        try {
          return {
            orderId: input.orderId,
            status: "preparing",
            trackingSteps: [
              { step: "Order Placed", completed: true, timestamp: new Date() },
              { step: "Preparing", completed: true, timestamp: new Date() },
              { step: "Out for Delivery", completed: false, timestamp: null },
              { step: "Delivered", completed: false, timestamp: null },
            ],
            estimatedDelivery: new Date(),
            driverInfo: null,
          };
        } catch (error) {
          logger.error("Failed to track order", "WALMART", { error });
          throw error;
        }
      }),

    // Get user preferences
    getPreferences: publicProcedure
      .input(z.object({ userId: z.string() }))
      .query(async ({ input, ctx }) => {
        logger.info("Fetching user preferences", "WALMART", input);

        try {
          return {
            preferences: {
              dietaryRestrictions: [],
              allergies: [],
              favoriteCategories: [],
              preferredBrands: [],
              avoidBrands: [],
              deliveryPreferences: {
                preferredDays: [],
                preferredTimeSlots: [],
              },
            },
          };
        } catch (error) {
          logger.error("Failed to fetch preferences", "WALMART", { error });
          throw error;
        }
      }),

    // Update user preferences
    updatePreferences: publicProcedure
      .input(walmartSchemas.updatePreferences)
      .mutation(async ({ input, ctx }) => {
        logger.info("Updating user preferences", "WALMART", input);

        try {
          return {
            success: true,
            preferences: input.preferences,
          };
        } catch (error) {
          logger.error("Failed to update preferences", "WALMART", { error });
          throw error;
        }
      }),

    // Get deal alerts
    getAlerts: publicProcedure
      .input(z.object({ userId: z.string() }))
      .query(async ({ input, ctx }) => {
        logger.info("Fetching deal alerts", "WALMART", input);

        try {
          return {
            alerts: [],
          };
        } catch (error) {
          logger.error("Failed to fetch alerts", "WALMART", { error });
          throw error;
        }
      }),

    // Create deal alert
    createAlert: publicProcedure
      .input(walmartSchemas.createAlert)
      .mutation(async ({ input, ctx }) => {
        logger.info("Creating deal alert", "WALMART", input);

        try {
          const alertId = `alert-${Date.now()}`;

          return {
            success: true,
            alert: {
              id: alertId,
              userId: input.userId,
              productId: input.productId,
              alertType: input.alertType,
              targetPrice: input.targetPrice,
              createdAt: new Date(),
              active: true,
            },
          };
        } catch (error) {
          logger.error("Failed to create alert", "WALMART", { error });
          throw error;
        }
      }),

    // Delete deal alert
    deleteAlert: publicProcedure
      .input(z.object({ alertId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        logger.info("Deleting deal alert", "WALMART", input);

        try {
          return {
            success: true,
            alertId: input.alertId,
          };
        } catch (error) {
          logger.error("Failed to delete alert", "WALMART", { error });
          throw error;
        }
      }),

    // Track product price
    trackPrice: publicProcedure
      .input(walmartSchemas.trackPrice)
      .mutation(async ({ input, ctx }) => {
        logger.info("Setting up price tracking", "WALMART", input);

        try {
          const trackingId = `track-${Date.now()}`;

          return {
            success: true,
            tracking: {
              id: trackingId,
              productId: input.productId,
              userId: input.userId,
              targetPrice: input.targetPrice,
              currentPrice: 0,
              createdAt: new Date(),
              active: true,
            },
          };
        } catch (error) {
          logger.error("Failed to track price", "WALMART", { error });
          throw error;
        }
      }),

    // Get price history
    getPriceHistory: publicProcedure
      .input(z.object({
        productId: z.string(),
        days: z.number().optional().default(30),
      }))
      .query(async ({ input, ctx }) => {
        logger.info("Fetching price history", "WALMART", input);

        try {
          // Mock price history data
          const history = [];
          const now = Date.now();
          const dayMs = 24 * 60 * 60 * 1000;

          for (let i = 0; i < input.days; i++) {
            history.push({
              date: new Date(now - i * dayMs),
              price: 10 + Math.random() * 5,
              available: true,
            });
          }

          return {
            productId: input.productId,
            history: history.reverse(),
            lowestPrice: Math.min(...history?.map(h => h.price)),
            highestPrice: Math.max(...history?.map(h => h.price)),
            averagePrice: history.reduce((sum: any, h: any) => sum + h.price, 0) / history?.length || 0,
          };
        } catch (error) {
          logger.error("Failed to fetch price history", "WALMART", { error });
          throw error;
        }
      }),

    // Process natural language grocery input with live pricing
    processGroceryInput: publicProcedure
      .input(z.object({
        conversationId: z.string(),
        userId: z.string(),
        input: z.string().min(1).max(1000),
        location: z.object({
          zipCode: z.string(),
          city: z.string(),
          state: z.string(),
        }).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        logger.info("Processing grocery input", "WALMART", {
          conversationId: input.conversationId,
          userId: input.userId,
          inputLength: input?.input?.length,
        });

        try {
          const { WalmartChatAgent } = await import("../services/agents/WalmartChatAgent.js");
          const chatAgent = WalmartChatAgent.getInstance();

          const result = await chatAgent.processMessage(
            input.conversationId,
            input.userId,
            input.input,
            input.location ? {
              zipCode: input?.location?.zipCode,
              city: input?.location?.city,
              state: input?.location?.state
            } : undefined
          );

          // Emit real-time update
          walmartEvents.emit("grocery_input_processed", {
            conversationId: input.conversationId,
            userId: input.userId,
            listTotal: result.list?.estimatedTotal || 0,
            itemCount: result.list?.items?.length || 0 || 0,
            timestamp: new Date(),
          });

          return {
            success: true,
            response: result.response,
            groceryList: result.list ? {
              items: result?.list?.items,
              subtotal: result?.list?.runningTotal,
              estimatedTax: result?.list?.estimatedTax,
              total: result?.list?.estimatedTotal,
              savings: result?.list?.savings,
              itemCount: result?.list?.items?.length || 0,
              deliveryEligible: result?.list?.runningTotal >= 35,
              deliveryThreshold: 35,
            } : null,
            suggestions: result.suggestions || [],
            metadata: {
              processed: true,
              timestamp: new Date(),
              conversationId: input.conversationId,
            },
          };
        } catch (error) {
          logger.error("Failed to process grocery input", "WALMART", { error });
          throw new Error(
            `Failed to process input: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }),

    // Get user's purchase history with patterns
    getPurchaseHistory: publicProcedure
      .input(z.object({
        userId: z.string(),
        limit: z.number().min(1).max(100).optional().default(20),
        offset: z.number().min(0).optional().default(0),
        timeframe: z.enum(["week", "month", "quarter", "year", "all"]).optional().default("month"),
        includePatterns: z.boolean().optional().default(true),
      }))
      .query(async ({ input, ctx }) => {
        logger.info("Fetching purchase history", "WALMART", {
          userId: input.userId,
          timeframe: input.timeframe,
        });

        try {
          // Get user's order history from conversation service and RAG system
          const orderHistory = await ctx?.conversationService?.search(
            `orders-${input.userId}`,
            input.limit * 2 // Get more to filter properly
          );

          // Search RAG for saved receipts and purchase data
          const purchaseData = await ctx?.ragSystem?.search(
            `walmart receipt purchase user:${input.userId}`,
            input.limit
          );

          // Calculate timeframe filter
          const now = new Date();
          let startDate = new Date();
          switch (input.timeframe) {
            case "week":
              startDate.setDate(now.getDate() - 7);
              break;
            case "month":
              startDate.setMonth(now.getMonth() - 1);
              break;
            case "quarter":
              startDate.setMonth(now.getMonth() - 3);
              break;
            case "year":
              startDate.setFullYear(now.getFullYear() - 1);
              break;
            case "all":
            default:
              startDate = new Date(0);
              break;
          }

          // Mock purchase history for now - in real implementation would come from database
          const purchases = Array.from({ length: Math.min(input.limit, 15) }, (_, i) => {
            const purchaseDate = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
            const itemCount = Math.floor(Math.random() * 20) + 5;
            const total = Math.random() * 200 + 50;
            
            return {
              id: `purchase-${Date.now()}-${i}`,
              orderId: `WM${Date.now()}${i}`,
              date: purchaseDate,
              total: Number(total.toFixed(2)),
              itemCount,
              status: "completed" as const,
              fulfillmentMethod: ["delivery", "pickup"][Math.floor(Math.random() * 2)] as "delivery" | "pickup",
              items: Array.from({ length: Math.min(itemCount, 5) }, (_, j) => ({
                productId: `product-${i}-${j}`,
                name: ["Milk", "Bread", "Eggs", "Bananas", "Chicken", "Rice", "Pasta"][Math.floor(Math.random() * 7)],
                quantity: Math.floor(Math.random() * 3) + 1,
                price: Number((Math.random() * 15 + 2).toFixed(2)),
                category: ["Dairy", "Bakery", "Produce", "Meat"][Math.floor(Math.random() * 4)],
              })),
              savings: Number((total * 0.1).toFixed(2)),
            };
          }).filter(p => p.date >= startDate);

          let patterns = null;
          if (input.includePatterns && purchases?.length || 0 > 0) {
            // Calculate purchase patterns
            const categoryFrequency = purchases
              .flatMap(p => p.items)
              .reduce((acc: any, item: any) => {
                const category = item.category || 'Unknown';
                acc[category] = (acc[category] || 0) + item.quantity;
                return acc;
              }, {} as Record<string, number>);

            const productFrequency = purchases
              .flatMap(p => p.items)
              .reduce((acc: any, item: any) => {
                const name = item.name || 'Unknown Product';
                acc[name] = (acc[name] || 0) + item.quantity;
                return acc;
              }, {} as Record<string, number>);

            const avgOrderValue = purchases.reduce((sum: any, p: any) => sum + p.total, 0) / purchases?.length || 0;
            const totalSpent = purchases.reduce((sum: any, p: any) => sum + p.total, 0);
            const totalSavings = purchases.reduce((sum: any, p: any) => sum + p.savings, 0);

            patterns = {
              topCategories: Object.entries(categoryFrequency)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([category, count]) => ({ category, count })),
              topProducts: Object.entries(productFrequency)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([product, count]) => ({ product, count })),
              avgOrderValue: Number(avgOrderValue.toFixed(2)),
              totalSpent: Number(totalSpent.toFixed(2)),
              totalSavings: Number(totalSavings.toFixed(2)),
              orderFrequency: purchases?.length || 0 / 4, // Orders per week approximation
              preferredFulfillment: purchases.reduce((acc: any, p: any) => {
                acc[p.fulfillmentMethod] = (acc[p.fulfillmentMethod] || 0) + 1;
                return acc;
              }, {} as Record<string, number>),
            };
          }

          return {
            purchases: purchases.slice(input.offset, input.offset + input.limit),
            patterns,
            totalCount: purchases?.length || 0,
            timeframe: input.timeframe,
            summary: {
              totalPurchases: purchases?.length || 0,
              totalSpent: purchases.reduce((sum: any, p: any) => sum + p.total, 0),
              totalSavings: purchases.reduce((sum: any, p: any) => sum + p.savings, 0),
              avgOrderValue: purchases?.length || 0 > 0 ? purchases.reduce((sum: any, p: any) => sum + p.total, 0) / purchases?.length || 0 : 0,
            },
          };
        } catch (error) {
          logger.error("Failed to fetch purchase history", "WALMART", { error });
          throw error;
        }
      }),

    // Get AI-powered recommendations based on history and current deals
    getSmartRecommendations: publicProcedure
      .input(z.object({
        userId: z.string(),
        context: z.enum(["reorder", "trending", "deals", "seasonal", "personalized"]).optional().default("personalized"),
        budget: z.number().positive().optional(),
        dietaryRestrictions: z.array(z.string()).optional(),
        excludeCategories: z.array(z.string()).optional(),
        limit: z.number().min(1).max(50).optional().default(10),
      }))
      .query(async ({ input, ctx }) => {
        logger.info("Generating smart recommendations", "WALMART", {
          userId: input.userId,
          context: input.context,
          limit: input.limit,
        });

        try {
          // Get user's purchase history for context
          const userHistory = await ctx?.conversationService?.search(
            `purchase-${input.userId}`,
            20
          );

          // Get user preferences
          const userPreferences = await ctx?.ragSystem?.search(
            `preferences user:${input.userId}`,
            5
          );

          // Get current deals
          const currentDeals = await ctx?.dealDataService?.analyzeDealForProducts(
            [], // Empty array to get general deals
            input.userId
          );

          // Process with MasterOrchestrator for intelligent recommendations
          const recommendationPrompt = `Generate personalized Walmart grocery recommendations for user ${input.userId}.
            
            Context: ${input.context}
            Budget: ${input.budget ? `$${input.budget}` : 'No limit'}
            Dietary restrictions: ${input.dietaryRestrictions?.join(', ') || 'None'}
            Exclude categories: ${input.excludeCategories?.join(', ') || 'None'}
            
            Consider:
            - User's purchase history patterns
            - Current deals and promotions  
            - Seasonal trends and availability
            - Budget optimization
            - Health and dietary preferences
            
            Focus on: practical everyday items, value for money, and items likely to be needed soon.`;

          const analysis = await ctx?.masterOrchestrator?.processQuery({
            text: recommendationPrompt,
            metadata: {
              userId: input.userId,
              context: input.context,
              purchaseHistory: userHistory,
              preferences: userPreferences,
              currentDeals: currentDeals.deals || [],
              budget: input.budget,
            },
          });

          // Mock recommendations based on context - in real implementation would use ML/AI
          const mockRecommendations = [];
          const contextData = {
            reorder: [
              { name: "Whole Milk 1 Gallon", category: "Dairy", price: 3.48, originalPrice: undefined, reason: "Frequently purchased item" },
              { name: "Banana Bundle", category: "Produce", price: 1.28, originalPrice: undefined, reason: "Weekly staple" },
              { name: "Sliced Bread", category: "Bakery", price: 2.50, originalPrice: undefined, reason: "Regular purchase" },
            ],
            trending: [
              { name: "Plant-Based Milk", category: "Dairy Alternatives", price: 4.98, originalPrice: undefined, reason: "Trending healthy choice" },
              { name: "Avocado Toast Kit", category: "Prepared Foods", price: 5.99, originalPrice: undefined, reason: "Popular breakfast option" },
              { name: "Kombucha Variety Pack", category: "Beverages", price: 8.99, originalPrice: undefined, reason: "Growing popularity" },
            ],
            deals: [
              { name: "Chicken Breast Family Pack", category: "Meat", price: 8.99, originalPrice: 12.99, reason: "25% off sale" },
              { name: "Pasta Variety 8-Pack", category: "Pantry", price: 6.49, originalPrice: 8.99, reason: "BOGO 50% off" },
              { name: "Frozen Vegetables Mix", category: "Frozen", price: 2.99, originalPrice: 4.49, reason: "Rollback price" },
            ],
            seasonal: [
              { name: "Pumpkin Spice Coffee", category: "Beverages", price: 5.99, originalPrice: undefined, reason: "Fall seasonal favorite" },
              { name: "Apple Variety Pack", category: "Produce", price: 4.99, originalPrice: undefined, reason: "Peak apple season" },
              { name: "Soup Variety Pack", category: "Pantry", price: 7.99, originalPrice: undefined, reason: "Cold weather comfort food" },
            ],
            personalized: [
              { name: "Greek Yogurt 4-Pack", category: "Dairy", price: 4.49, originalPrice: undefined, reason: "Matches your protein preference" },
              { name: "Quinoa Grain Bowl Kit", category: "Health Foods", price: 6.99, originalPrice: undefined, reason: "Healthy grain alternative" },
              { name: "Fresh Salmon Fillet", category: "Seafood", price: 9.99, originalPrice: undefined, reason: "Omega-3 rich choice" },
            ],
          };

          const baseRecommendations = contextData[input.context] || contextData.personalized;
          
          for (let i = 0; i < Math.min(input.limit, 12); i++) {
            const baseItem = baseRecommendations[i % baseRecommendations?.length || 0];
            if (!baseItem) continue;
            
            mockRecommendations.push({
              id: `rec-${Date.now()}-${i}`,
              productId: `walmart-${Math.random().toString(36).substr(2, 9)}`,
              name: baseItem.name,
              category: baseItem.category,
              price: baseItem.price,
              originalPrice: baseItem.originalPrice,
              savings: baseItem.originalPrice ? Number((baseItem.originalPrice - baseItem.price).toFixed(2)) : 0,
              reason: baseItem.reason,
              confidence: 0.8 + Math.random() * 0.2,
              inStock: true,
              imageUrl: `https://i5?.walmartimages?.com/asr/placeholder-${i}.jpg`,
              matchScore: Math.random() * 0.3 + 0.7, // 0.7-1.0 range
              tags: [input.context, baseItem?.category?.toLowerCase().replace(/\s+/g, '_')],
            });
          }

          // Emit real-time update
          walmartEvents.emit("recommendations_generated", {
            userId: input.userId,
            context: input.context,
            count: mockRecommendations?.length || 0,
            timestamp: new Date(),
          });

          return {
            recommendations: mockRecommendations,
            context: input.context,
            analysis: analysis.summary,
            metadata: {
              userId: input.userId,
              generatedAt: new Date(),
              algorithm: "hybrid_collaborative_content",
              confidence: 0.85,
              personalizedScore: userHistory?.length || 0 > 0 ? 0.9 : 0.6,
              dealOpportunities: mockRecommendations?.filter(r => r.savings > 0).length,
            },
            budgetAnalysis: input.budget ? {
              budget: input.budget,
              estimatedSpend: mockRecommendations.reduce((sum: any, r: any) => sum + r.price, 0),
              savingsOpportunity: mockRecommendations.reduce((sum: any, r: any) => sum + r.savings, 0),
              itemsWithinBudget: mockRecommendations?.filter(r => r.price <= (input.budget! * 0.1)).length,
            } : null,
          };
        } catch (error) {
          logger.error("Failed to generate smart recommendations", "WALMART", { error });
          throw error;
        }
      }),

    // Calculate real-time list totals with tax, savings, and delivery
    calculateListTotals: publicProcedure
      .input(z.object({
        items: z.array(z.object({
          productId: z.string(),
          quantity: z.number().positive(),
          price: z.number().positive(),
          originalPrice: z.number().positive().optional(),
        })),
        location: z.object({
          zipCode: z.string(),
          state: z.string(),
        }),
        promoCode: z.string().optional(),
        loyaltyMember: z.boolean().optional().default(false),
      }))
      .mutation(async ({ input, ctx }) => {
        logger.info("Calculating list totals", "WALMART", {
          itemCount: input?.items?.length,
          location: input?.location?.zipCode,
        });

        try {
          // Calculate base totals
          const subtotal = input?.items?.reduce(
            (sum, item) => sum + (item.price * item.quantity),
            0
          );

          const originalSubtotal = input?.items?.reduce(
            (sum, item) => sum + ((item.originalPrice || item.price) * item.quantity),
            0
          );

          const itemSavings = originalSubtotal - subtotal;

          // Calculate tax based on location (mock tax rates)
          const taxRates: Record<string, number> = {
            'AL': 0.04, 'AK': 0.00, 'AZ': 0.056, 'AR': 0.065, 'CA': 0.0725,
            'CO': 0.029, 'CT': 0.0635, 'DE': 0.00, 'FL': 0.06, 'GA': 0.04,
            'HI': 0.04, 'ID': 0.06, 'IL': 0.0625, 'IN': 0.07, 'IA': 0.06,
            'KS': 0.065, 'KY': 0.06, 'LA': 0.0445, 'ME': 0.055, 'MD': 0.06,
            'MA': 0.0625, 'MI': 0.06, 'MN': 0.06875, 'MS': 0.07, 'MO': 0.04225,
            'MT': 0.00, 'NE': 0.055, 'NV': 0.0685, 'NH': 0.00, 'NJ': 0.06625,
            'NM': 0.05125, 'NY': 0.08, 'NC': 0.0475, 'ND': 0.05, 'OH': 0.0575,
            'OK': 0.045, 'OR': 0.00, 'PA': 0.06, 'RI': 0.07, 'SC': 0.06,
            'SD': 0.045, 'TN': 0.07, 'TX': 0.0625, 'UT': 0.0485, 'VT': 0.06,
            'VA': 0.053, 'WA': 0.065, 'WV': 0.06, 'WI': 0.05, 'WY': 0.04,
          };

          const taxRate = taxRates[input?.location?.state.toUpperCase()] || 0.06;
          const tax = subtotal * taxRate;

          // Apply promo code discounts (mock)
          let promoDiscount = 0;
          let promoDescription = "";
          if (input.promoCode) {
            const promoCodes: Record<string, { discount: number; type: 'percentage' | 'fixed'; description: string }> = {
              'SAVE10': { discount: 0.10, type: 'percentage', description: '10% off entire order' },
              'WELCOME5': { discount: 5.00, type: 'fixed', description: '$5 off first order' },
              'GROCERY15': { discount: 0.15, type: 'percentage', description: '15% off groceries' },
              'FREESHIP': { discount: 0, type: 'fixed', description: 'Free shipping' },
            };

            const promo = promoCodes[input?.promoCode?.toUpperCase()];
            if (promo) {
              promoDescription = promo.description;
              if (promo.type === 'percentage') {
                promoDiscount = subtotal * promo.discount;
              } else {
                promoDiscount = promo.discount;
              }
            }
          }

          // Loyalty member discount
          let loyaltyDiscount = 0;
          if (input.loyaltyMember) {
            loyaltyDiscount = subtotal * 0.02; // 2% loyalty discount
          }

          // Calculate delivery fee
          const adjustedSubtotal = subtotal - promoDiscount - loyaltyDiscount;
          const deliveryFee = adjustedSubtotal >= 35 ? 0 : 4.95;

          // Special delivery fee waiver for promo codes
          const waiveDeliveryFee = input.promoCode === 'FREESHIP';
          const finalDeliveryFee = waiveDeliveryFee ? 0 : deliveryFee;

          const totalSavings = itemSavings + promoDiscount + loyaltyDiscount + (deliveryFee - finalDeliveryFee);
          const total = adjustedSubtotal + tax + finalDeliveryFee;

          // Emit real-time update
          walmartEvents.emit("totals_calculated", {
            itemCount: input?.items?.length,
            subtotal: Number(subtotal.toFixed(2)),
            total: Number(total.toFixed(2)),
            savings: Number(totalSavings.toFixed(2)),
            timestamp: new Date(),
          });

          return {
            success: true,
            calculation: {
              subtotal: Number(subtotal.toFixed(2)),
              originalSubtotal: Number(originalSubtotal.toFixed(2)),
              itemSavings: Number(itemSavings.toFixed(2)),
              promoDiscount: Number(promoDiscount.toFixed(2)),
              promoDescription,
              loyaltyDiscount: Number(loyaltyDiscount.toFixed(2)),
              tax: Number(tax.toFixed(2)),
              taxRate: Number((taxRate * 100).toFixed(2)), // Convert to percentage
              deliveryFee: Number(finalDeliveryFee.toFixed(2)),
              deliveryFeeWaived: waiveDeliveryFee,
              totalSavings: Number(totalSavings.toFixed(2)),
              total: Number(total.toFixed(2)),
              freeDeliveryEligible: adjustedSubtotal >= 35,
              freeDeliveryThreshold: 35,
              amountForFreeDelivery: adjustedSubtotal < 35 ? Number((35 - adjustedSubtotal).toFixed(2)) : 0,
            },
            breakdown: {
              itemCount: input?.items?.length,
              location: input.location,
              promoCode: input.promoCode,
              loyaltyMember: input.loyaltyMember,
              calculatedAt: new Date(),
            },
            recommendations: adjustedSubtotal < 35 ? [
              {
                type: "free_delivery",
                message: `Add $${(35 - adjustedSubtotal).toFixed(2)} more to qualify for free delivery`,
                suggestedItems: ["Bananas ($1.28)", "Bread ($2.50)", "Milk ($3.48)"],
              }
            ] : [],
          };
        } catch (error) {
          logger.error("Failed to calculate list totals", "WALMART", { error });
          throw error;
        }
      }),

    // Get dashboard statistics - REAL DATA instead of hardcoded
    getStats: publicProcedure
      .use(walmartDatabaseMiddleware)
      .query(async ({ ctx }) => {
        const dbCtx = ctx as DatabaseContext;
        logger.info("Fetching dashboard statistics", "WALMART");
        
        try {
          // Get real product count from database
          const productCount = await dbCtx?.safeDb?.select(
            'walmart_products',
            ['COUNT(*) as count']
          );
          
          // Get user's saved amount this month from orders
          const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
          const savedResult = await dbCtx?.safeDb?.select(
            'grocery_orders',
            ['COALESCE(SUM(total_savings), 0) as totalSaved'],
            "strftime('%Y-%m', created_at) = ?",
            [currentMonth]
          );
          
          // Get active price alerts count
          const alertsResult = await dbCtx?.safeDb?.select(
            'price_alerts',
            ['COUNT(*) as count'],
            'is_active = 1'
          );
          
          const productsTracked = productCount.data[0] ? safeColumnAccess(productCount.data[0], 'count', 0) : 0;
          const savedThisMonth = savedResult.data[0] ? safeColumnAccess(savedResult.data[0], 'totalSaved', 0) : 0;
          const activeAlerts = alertsResult.data[0] ? safeColumnAccess(alertsResult.data[0], 'count', 0) : 0;
          
          return {
            success: true,
            stats: {
              productsTracked: Number(productsTracked),
              savedThisMonth: Number(savedThisMonth),
              activeAlerts: Number(activeAlerts),
              lastUpdated: new Date().toISOString()
            }
          };
        } catch (error) {
          logger.error("Failed to fetch stats", "WALMART", { error });
          // Return default values on error to prevent UI crashes
          return {
            success: false,
            stats: {
              productsTracked: 0,
              savedThisMonth: 0,
              activeAlerts: 0,
              lastUpdated: new Date().toISOString()
            }
          };
        }
      }),

    // Get trending products for Price History tab - REAL DATA
    getTrending: publicProcedure
      .use(walmartDatabaseMiddleware)
      .input(z.object({
        limit: z.number().min(1).max(20).default(6),
        days: z.number().min(1).max(90).default(30)
      }))
      .query(async ({ ctx, input }) => {
        const dbCtx = ctx as DatabaseContext;
        logger.info("Fetching trending products", "WALMART", input);
        
        try {
          // Get products with recent price changes
          const trendingQuery = `
            SELECT id, name, category, current_price, original_price, image_url, stock_status
            FROM walmart_products
            WHERE current_price IS NOT NULL
            ORDER BY (CASE 
              WHEN original_price > 0 THEN (original_price - current_price) / original_price 
              ELSE 0 
            END) DESC LIMIT ?
          `;
          const trendingProducts = await dbCtx?.safeDb?.query(trendingQuery, [input.limit]);
          
          const trending = (trendingProducts || []).map((product: any) => {
            const currentPrice = safeColumnAccess(product, 'current_price', 0);
            const originalPrice = safeColumnAccess(product, 'original_price', currentPrice);
            const priceChange = originalPrice > 0 ? ((currentPrice - originalPrice) / originalPrice * 100) : 0;
            
            return {
              id: safeColumnAccess(product, 'id', ''),
              name: safeColumnAccess(product, 'name', 'Unknown Product'),
              category: safeColumnAccess(product, 'category', 'Uncategorized'),
              currentPrice: Number(currentPrice),
              originalPrice: Number(originalPrice),
              priceChange: Number(priceChange.toFixed(2)),
              trend: priceChange < 0 ? 'down' : priceChange > 0 ? 'up' : 'stable',
              imageUrl: safeColumnAccess(product, 'image_url', '/api/placeholder/80/80'),
              inStock: safeColumnAccess(product, 'stock_status', 'unknown' as any) !== 'out_of_stock'
            };
          });
          
          return {
            success: true,
            trending,
            period: `Last ${input.days} days`
          };
        } catch (error) {
          logger.error("Failed to fetch trending products", "WALMART", { error });
          return {
            success: false,
            trending: [],
            period: `Last ${input.days} days`
          };
        }
      }),

    // Get budget data - REAL spending data
    getBudget: publicProcedure
      .use(walmartDatabaseMiddleware)
      .input(z.object({
        userId: z.string().default('default_user'),
        month: z.string().optional() // YYYY-MM format
      }))
      .query(async ({ ctx, input }) => {
        const dbCtx = ctx as DatabaseContext;
        logger.info("Fetching budget data", "WALMART", input);
        
        const currentMonth = input.month || new Date().toISOString().slice(0, 7);
        
        try {
          // Get user's budget settings
          const budgetSettings = await dbCtx?.safeDb?.select(
            'grocery_user_preferences',
            ['monthly_budget', 'budget_categories'],
            'user_id = ?',
            [input.userId]
          );
          
          const monthlyBudget = budgetSettings.data && budgetSettings?.data?.length > 0 
            ? safeColumnAccess(budgetSettings.data[0], 'monthly_budget', 400)
            : 400; // Default budget
          
          // Get actual spending for this month by category
          const spendingQuery = `
            SELECT 
              wp.category,
              SUM(oi.quantity * oi.price) as spent
            FROM grocery_order_items oi
            JOIN walmart_products wp ON oi.product_id = wp.id
            JOIN grocery_orders o ON oi.order_id = o.id
            WHERE o.user_id = ? 
              AND strftime('%Y-%m', o.created_at) = ?
            GROUP BY wp.category
          `;
          
          const categorySpending = await dbCtx?.safeDb?.query(spendingQuery, [input.userId, currentMonth]);
          
          // Calculate totals
          let totalSpent = 0;
          const categories: Record<string, number> = {};
          
          for (const cat of categorySpending) {
            const amount = Number(cat.spent || 0);
            categories[cat.category] = amount;
            totalSpent += amount;
          }
          
          // Set default category budgets if not spent
          const categoryBudgets = {
            'Produce': { spent: categories['Produce'] || 0, budget: 114 },
            'Dairy & Eggs': { spent: categories['Dairy'] || 0, budget: 70 },
            'Meat & Seafood': { spent: categories['Meat'] || 0, budget: 140 },
            'Bakery': { spent: categories['Bakery'] || 0, budget: 40 },
            'Beverages': { spent: categories['Beverages'] || 0, budget: 36 }
          };
          
          return {
            success: true,
            budget: {
              monthlyBudget: Number(monthlyBudget),
              totalSpent: Number(totalSpent.toFixed(2)),
              remaining: Number((monthlyBudget - totalSpent).toFixed(2)),
              percentUsed: Number(((totalSpent / monthlyBudget) * 100).toFixed(1)),
              categories: categoryBudgets,
              month: currentMonth,
              daysRemaining: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()
            }
          };
        } catch (error) {
          logger.error("Failed to fetch budget data", "WALMART", { error });
          // Return default budget data on error
          return {
            success: false,
            budget: {
              monthlyBudget: 400,
              totalSpent: 0,
              remaining: 400,
              percentUsed: 0,
              categories: {},
              month: currentMonth,
              daysRemaining: 30
            }
          };
        }
      }),
  })
);
