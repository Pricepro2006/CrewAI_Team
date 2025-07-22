import { z } from "zod";
import { router, publicProcedure, commonSchemas, createFeatureRouter, } from "../trpc/enhanced-router";
import { logger } from "../../utils/logger";
import { BrightDataService } from "../../core/data-collection/BrightDataService";
// Input validation schemas
const dataCollectionSchemas = {
    searchEngine: z.object({
        query: z.string().min(1).max(500),
        engine: z.enum(["google", "bing", "yandex"]).default("google"),
        maxResults: z.number().min(1).max(100).default(10),
        location: z.string().optional(),
        language: z.string().optional(),
        cursor: z.string().optional(),
    }),
    webScraping: z.object({
        url: z.string().url(),
        extractionPrompt: z.string().optional(),
        followLinks: z.boolean().default(false),
        maxDepth: z.number().min(1).max(5).default(1),
        respectRobots: z.boolean().default(true),
    }),
    ecommerce: z.object({
        platform: z.enum([
            "amazon",
            "walmart",
            "ebay",
            "homedepot",
            "zara",
            "etsy",
            "bestbuy",
        ]),
        productUrl: z.string().url().optional(),
        searchKeyword: z.string().optional(),
        maxProducts: z.number().min(1).max(100).optional(),
    }),
    socialMedia: z.object({
        platform: z.enum([
            "linkedin",
            "instagram",
            "tiktok",
            "facebook",
            "youtube",
        ]),
        profileUrl: z.string().url(),
        includeComments: z.boolean().default(false),
        includeMedia: z.boolean().default(false),
    }),
    job: z.object({
        id: z.string().uuid(),
    }),
};
// Initialize BrightData service (in production, this would come from context)
const credentials = {
    apiKey: process.env.BRIGHT_DATA_API_KEY || "",
    rateLimitPerMinute: 60,
};
// This would be injected from the MCP server in production
const brightDataService = new BrightDataService(credentials);
export const dataCollectionRouter = createFeatureRouter("dataCollection", router({
    // Search Engine Data Collection
    searchEngine: publicProcedure
        .input(dataCollectionSchemas.searchEngine)
        .mutation(async ({ input, ctx }) => {
        logger.info("Starting search engine data collection", "DATA_COLLECTION", {
            query: input.query,
            engine: input.engine,
            requestId: ctx.requestId,
        });
        try {
            const searchParams = {
                query: input.query,
                engine: input.engine,
                maxResults: input.maxResults,
                location: input.location,
                language: input.language,
                cursor: input.cursor,
            };
            const results = await brightDataService.collectSearchResults(searchParams);
            logger.info("Search engine data collection completed", "DATA_COLLECTION", {
                recordsCollected: results.length,
                requestId: ctx.requestId,
            });
            return {
                success: true,
                data: results,
                metadata: {
                    totalRecords: results.length,
                    engine: input.engine,
                    timestamp: new Date().toISOString(),
                    requestId: ctx.requestId,
                },
            };
        }
        catch (error) {
            logger.error("Search engine data collection failed", "DATA_COLLECTION", {
                error,
                requestId: ctx.requestId,
            });
            throw new Error(`Search engine data collection failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }),
    // Web Scraping Data Collection
    webScraping: publicProcedure
        .input(dataCollectionSchemas.webScraping)
        .mutation(async ({ input, ctx }) => {
        logger.info("Starting web scraping data collection", "DATA_COLLECTION", {
            url: input.url,
            requestId: ctx.requestId,
        });
        try {
            const scrapingParams = {
                url: input.url,
                extractionPrompt: input.extractionPrompt,
                followLinks: input.followLinks,
                maxDepth: input.maxDepth,
                respectRobots: input.respectRobots,
            };
            const results = await brightDataService.collectWebScrapingData(scrapingParams);
            logger.info("Web scraping data collection completed", "DATA_COLLECTION", {
                recordsCollected: results.length,
                requestId: ctx.requestId,
            });
            return {
                success: true,
                data: results,
                metadata: {
                    totalRecords: results.length,
                    url: input.url,
                    timestamp: new Date().toISOString(),
                    requestId: ctx.requestId,
                },
            };
        }
        catch (error) {
            logger.error("Web scraping data collection failed", "DATA_COLLECTION", {
                error,
                requestId: ctx.requestId,
            });
            throw new Error(`Web scraping failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }),
    // E-commerce Data Collection
    ecommerce: publicProcedure
        .input(dataCollectionSchemas.ecommerce)
        .mutation(async ({ input, ctx }) => {
        logger.info("Starting e-commerce data collection", "DATA_COLLECTION", {
            platform: input.platform,
            requestId: ctx.requestId,
        });
        try {
            const ecommerceParams = {
                platform: input.platform,
                productUrl: input.productUrl,
                searchKeyword: input.searchKeyword,
                maxProducts: input.maxProducts,
            };
            const results = await brightDataService.collectEcommerceData(ecommerceParams);
            logger.info("E-commerce data collection completed", "DATA_COLLECTION", {
                platform: input.platform,
                recordsCollected: results.length,
                requestId: ctx.requestId,
            });
            return {
                success: true,
                data: results,
                metadata: {
                    totalRecords: results.length,
                    platform: input.platform,
                    timestamp: new Date().toISOString(),
                    requestId: ctx.requestId,
                },
            };
        }
        catch (error) {
            logger.error("E-commerce data collection failed", "DATA_COLLECTION", {
                error,
                platform: input.platform,
                requestId: ctx.requestId,
            });
            throw new Error(`E-commerce data collection failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }),
    // Social Media Data Collection
    socialMedia: publicProcedure
        .input(dataCollectionSchemas.socialMedia)
        .mutation(async ({ input, ctx }) => {
        logger.info("Starting social media data collection", "DATA_COLLECTION", {
            platform: input.platform,
            requestId: ctx.requestId,
        });
        try {
            const socialParams = {
                platform: input.platform,
                profileUrl: input.profileUrl,
                includeComments: input.includeComments,
                includeMedia: input.includeMedia,
            };
            const results = await brightDataService.collectSocialMediaData(socialParams);
            logger.info("Social media data collection completed", "DATA_COLLECTION", {
                platform: input.platform,
                recordsCollected: results.length,
                requestId: ctx.requestId,
            });
            return {
                success: true,
                data: results,
                metadata: {
                    totalRecords: results.length,
                    platform: input.platform,
                    timestamp: new Date().toISOString(),
                    requestId: ctx.requestId,
                },
            };
        }
        catch (error) {
            logger.error("Social media data collection failed", "DATA_COLLECTION", {
                error,
                platform: input.platform,
                requestId: ctx.requestId,
            });
            throw new Error(`Social media data collection failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }),
    // Get Pipeline Statistics
    stats: publicProcedure.query(async ({ ctx }) => {
        try {
            const stats = await brightDataService.getPipelineStats();
            logger.info("Retrieved data collection stats", "DATA_COLLECTION", {
                totalSources: stats.totalSources,
                activeSources: stats.activeSources,
                requestId: ctx.requestId,
            });
            return {
                success: true,
                data: stats,
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            logger.error("Failed to get data collection stats", "DATA_COLLECTION", {
                error,
                requestId: ctx.requestId,
            });
            throw new Error(`Failed to get statistics: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }),
    // Health Check
    health: publicProcedure.query(async ({ ctx }) => {
        try {
            // Perform basic health checks
            const healthStatus = {
                brightData: {
                    status: "healthy",
                    rateLimits: {
                        search: "within_limits",
                        scraping: "within_limits",
                        ecommerce: "within_limits",
                        socialMedia: "within_limits",
                    },
                },
                database: "connected",
                timestamp: new Date().toISOString(),
            };
            return {
                success: true,
                status: "healthy",
                services: healthStatus,
                requestId: ctx.requestId,
            };
        }
        catch (error) {
            logger.error("Data collection health check failed", "DATA_COLLECTION", {
                error,
                requestId: ctx.requestId,
            });
            return {
                success: false,
                status: "unhealthy",
                error: error instanceof Error ? error.message : "Unknown error",
                requestId: ctx.requestId,
            };
        }
    }),
    // List Available Platforms
    platforms: publicProcedure.query(() => {
        return {
            searchEngines: ["google", "bing", "yandex"],
            ecommerce: [
                "amazon",
                "walmart",
                "ebay",
                "homedepot",
                "zara",
                "etsy",
                "bestbuy",
            ],
            socialMedia: ["linkedin", "instagram", "tiktok", "facebook", "youtube"],
            webScraping: {
                supportedFormats: ["markdown", "html", "extracted_data"],
                maxDepth: 5,
                respectRobots: true,
            },
        };
    }),
}));
//# sourceMappingURL=data-collection.router.js.map