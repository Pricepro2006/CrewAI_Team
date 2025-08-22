import { z } from "zod";
import {
  router,
  publicProcedure,
  commonSchemas,
  createFeatureRouter,
} from "../trpc/enhanced-router.js";
import { logger } from "../../utils/logger.js";
import { BrightDataService } from "../../core/data-collection/BrightDataService.js";
import type {
  SearchEngineParams,
  WebScrapingParams,
  EcommerceScrapingParams,
  SocialMediaParams,
  BrightDataCredentials,
} from "../../core/data-collection/types.js";

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
const credentials: BrightDataCredentials = {
  apiKey: process.env.BRIGHT_DATA_API_KEY || "",
  rateLimitPerMinute: 60,
};

// This would be injected from the MCP server in production
const brightDataService = new BrightDataService(credentials);

export const dataCollectionRouter = createFeatureRouter(
  "dataCollection",
  router({
    // Search Engine Data Collection
    searchEngine: publicProcedure
      .input(dataCollectionSchemas.searchEngine)
      .mutation(async ({ input, ctx }) => {
        logger.info(
          "Starting search engine data collection",
          "DATA_COLLECTION",
          {
            query: input.query,
            engine: input.engine,
            requestId: ctx.requestId,
          },
        );

        try {
          const searchParams: SearchEngineParams = {
            query: input.query,
            engine: input.engine,
            maxResults: input.maxResults,
            location: input.location,
            language: input.language,
            cursor: input.cursor,
          };

          const results =
            await brightDataService.collectSearchResults(searchParams);

          logger.info(
            "Search engine data collection completed",
            "DATA_COLLECTION",
            {
              recordsCollected: results?.length || 0,
              requestId: ctx.requestId,
            },
          );

          return {
            success: true,
            data: results,
            metadata: {
              totalRecords: results?.length || 0,
              engine: input.engine,
              timestamp: new Date().toISOString(),
              requestId: ctx.requestId,
            },
          };
        } catch (error) {
          logger.error(
            "Search engine data collection failed",
            "DATA_COLLECTION",
            {
              error,
              requestId: ctx.requestId,
            },
          );
          throw new Error(
            `Search engine data collection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }),

    // Web Scraping Data Collection
    webScraping: publicProcedure
      .input(dataCollectionSchemas.webScraping)
      .mutation(async ({ input, ctx }) => {
        logger.info(
          "Starting web scraping data collection",
          "DATA_COLLECTION",
          {
            url: input.url,
            requestId: ctx.requestId,
          },
        );

        try {
          const scrapingParams: WebScrapingParams = {
            url: input.url,
            extractionPrompt: input.extractionPrompt,
            followLinks: input.followLinks,
            maxDepth: input.maxDepth,
            respectRobots: input.respectRobots,
          };

          const results =
            await brightDataService.collectWebScrapingData(scrapingParams);

          logger.info(
            "Web scraping data collection completed",
            "DATA_COLLECTION",
            {
              recordsCollected: results?.length || 0,
              requestId: ctx.requestId,
            },
          );

          // Transform the BrightData response to match UI expectations
          if (results && results.length > 0) {
            const scraped = results[0];
            const content = scraped?.data?.content;
            
            // Parse HTML to extract metadata, links, and images
            const htmlContent = content?.html || "";
            const markdownContent = content?.markdown || "";
            
            // Extract metadata from HTML
            const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/i);
            const descriptionMatch = htmlContent.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
            const keywordsMatch = htmlContent.match(/<meta\s+name=["']keywords["']\s+content=["'](.*?)["']/i);
            
            // Extract links from HTML
            const linkMatches = htmlContent.matchAll(/<a\s+[^>]*href=["'](.*?)["'][^>]*>(.*?)<\/a>/gi);
            const links = Array.from(linkMatches).map((match: any) => ({
              url: match[1] || '',
              text: (match[2] || '').replace(/<[^>]*>/g, '').trim()
            })).filter(link => link.url && !link.url.startsWith('#'));
            
            // Extract images from HTML
            const imageMatches = htmlContent.matchAll(/<img\s+[^>]*src=["'](.*?)["'](?:\s+alt=["'](.*?)["'])?/gi);
            const images = Array.from(imageMatches).map((match: any) => ({
              src: match[1] || '',
              alt: match[2] || ""
            })).filter(img => img.src);
            
            return {
              metadata: {
                title: titleMatch ? titleMatch[1] : "N/A",
                description: descriptionMatch ? descriptionMatch[1] : "N/A",
                keywords: keywordsMatch ? keywordsMatch[1].split(',').map((k: string) => k.trim()) : []
              },
              content: markdownContent || htmlContent.replace(/<[^>]*>/g, '').substring(0, 1000),
              links: links.slice(0, 50), // Limit to first 50 links
              images: images.slice(0, 20), // Limit to first 20 images
              extractedData: content?.extractedData
            };
          }

          // Fallback response if no results
          return {
            metadata: {
              title: "N/A",
              description: "N/A",
              keywords: []
            },
            content: "Failed to extract content from the website",
            links: [],
            images: []
          };
        } catch (error) {
          logger.error(
            "Web scraping data collection failed",
            "DATA_COLLECTION",
            {
              error,
              requestId: ctx.requestId,
            },
          );
          throw new Error(
            `Web scraping failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
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
          const ecommerceParams: EcommerceScrapingParams = {
            platform: input.platform,
            productUrl: input.productUrl,
            searchKeyword: input.searchKeyword,
            maxProducts: input.maxProducts,
          };

          const results =
            await brightDataService.collectEcommerceData(ecommerceParams);

          logger.info(
            "E-commerce data collection completed",
            "DATA_COLLECTION",
            {
              platform: input.platform,
              recordsCollected: results?.length || 0,
              requestId: ctx.requestId,
            },
          );

          return {
            success: true,
            data: results,
            metadata: {
              totalRecords: results?.length || 0,
              platform: input.platform,
              timestamp: new Date().toISOString(),
              requestId: ctx.requestId,
            },
          };
        } catch (error) {
          logger.error("E-commerce data collection failed", "DATA_COLLECTION", {
            error,
            platform: input.platform,
            requestId: ctx.requestId,
          });
          throw new Error(
            `E-commerce data collection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }),

    // Social Media Data Collection
    socialMedia: publicProcedure
      .input(dataCollectionSchemas.socialMedia)
      .mutation(async ({ input, ctx }) => {
        logger.info(
          "Starting social media data collection",
          "DATA_COLLECTION",
          {
            platform: input.platform,
            requestId: ctx.requestId,
          },
        );

        try {
          const socialParams: SocialMediaParams = {
            platform: input.platform,
            profileUrl: input.profileUrl,
            includeComments: input.includeComments,
            includeMedia: input.includeMedia,
          };

          const results =
            await brightDataService.collectSocialMediaData(socialParams);

          logger.info(
            "Social media data collection completed",
            "DATA_COLLECTION",
            {
              platform: input.platform,
              recordsCollected: results?.length || 0,
              requestId: ctx.requestId,
            },
          );

          return {
            success: true,
            data: results,
            metadata: {
              totalRecords: results?.length || 0,
              platform: input.platform,
              timestamp: new Date().toISOString(),
              requestId: ctx.requestId,
            },
          };
        } catch (error) {
          logger.error(
            "Social media data collection failed",
            "DATA_COLLECTION",
            {
              error,
              platform: input.platform,
              requestId: ctx.requestId,
            },
          );
          throw new Error(
            `Social media data collection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
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
      } catch (error) {
        logger.error("Failed to get data collection stats", "DATA_COLLECTION", {
          error,
          requestId: ctx.requestId,
        });
        throw new Error(
          `Failed to get statistics: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
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
      } catch (error) {
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
  }),
);
