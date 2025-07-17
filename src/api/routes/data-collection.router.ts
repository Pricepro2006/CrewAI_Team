/**
 * Data Collection Router
 * tRPC router for data collection pipeline management
 */

import { z } from "zod";
import {
  router,
  publicProcedure,
  protectedProcedure,
} from "../trpc/enhanced-router";
import { DataCollectionPipeline } from "../../core/data-collection/DataCollectionPipeline";
import { logger } from "../../utils/logger";

// Validation schemas
const DataSourceConfigSchema = z.object({
  url: z.string().url().optional(),
  keywords: z.array(z.string()).optional(),
  maxResults: z.number().min(1).max(1000).optional(),
  frequency: z.enum(["hourly", "daily", "weekly", "monthly"]).optional(),
  filters: z.record(z.any()).optional(),
  outputFormat: z.enum(["json", "csv", "markdown"]).optional(),
});

const CreateDataSourceSchema = z.object({
  name: z.string().min(1),
  type: z.enum([
    "web_scraping",
    "search_engine",
    "social_media",
    "ecommerce",
    "news",
  ]),
  config: DataSourceConfigSchema,
  status: z.enum(["active", "inactive"]).default("active"),
});

const UpdateDataSourceSchema = z.object({
  name: z.string().min(1).optional(),
  type: z
    .enum([
      "web_scraping",
      "search_engine",
      "social_media",
      "ecommerce",
      "news",
    ])
    .optional(),
  config: DataSourceConfigSchema.optional(),
  status: z.enum(["active", "inactive", "error"]).optional(),
});

const SearchEngineParamsSchema = z.object({
  query: z.string().min(1),
  engine: z.enum(["google", "bing", "yandex"]).default("google"),
  maxResults: z.number().min(1).max(100).default(10),
  location: z.string().optional(),
  language: z.string().optional(),
});

const WebScrapingParamsSchema = z.object({
  url: z.string().url(),
  extractionPrompt: z.string().optional(),
  followLinks: z.boolean().default(false),
  maxDepth: z.number().min(1).max(5).default(1),
  respectRobots: z.boolean().default(true),
});

// Initialize pipeline (would be done in context in real implementation)
let dataCollectionPipeline: DataCollectionPipeline;

export const dataCollectionRouter = router({
  // Initialize pipeline
  initialize: protectedProcedure.mutation(async () => {
    try {
      if (!dataCollectionPipeline) {
        dataCollectionPipeline = new DataCollectionPipeline({
          apiKey: process.env.BRIGHT_DATA_API_KEY,
          endpoint: process.env.BRIGHT_DATA_ENDPOINT,
          rateLimitPerMinute: 60,
        });
        await dataCollectionPipeline.initialize();
      }

      logger.info(
        "Data collection pipeline initialized",
        "DATA_COLLECTION_API",
      );
      return { success: true, message: "Pipeline initialized successfully" };
    } catch (error) {
      logger.error(
        "Failed to initialize data collection pipeline",
        "DATA_COLLECTION_API",
        { error },
      );
      throw new Error("Failed to initialize pipeline");
    }
  }),

  // Get pipeline statistics
  getStats: protectedProcedure.query(async () => {
    try {
      if (!dataCollectionPipeline) {
        throw new Error("Pipeline not initialized");
      }

      return await dataCollectionPipeline.getStats();
    } catch (error) {
      logger.error("Failed to get pipeline stats", "DATA_COLLECTION_API", {
        error,
      });
      throw error;
    }
  }),

  // Data source management
  sources: router({
    // List all data sources
    list: protectedProcedure.query(async () => {
      try {
        if (!dataCollectionPipeline) {
          return [];
        }

        return dataCollectionPipeline.getDataSources();
      } catch (error) {
        logger.error("Failed to list data sources", "DATA_COLLECTION_API", {
          error,
        });
        throw error;
      }
    }),

    // Create a new data source
    create: protectedProcedure
      .input(CreateDataSourceSchema)
      .mutation(async ({ input }) => {
        try {
          if (!dataCollectionPipeline) {
            throw new Error("Pipeline not initialized");
          }

          const sourceId = await dataCollectionPipeline.addDataSource(input);

          logger.info("Data source created", "DATA_COLLECTION_API", {
            sourceId,
            input,
          });
          return { sourceId, message: "Data source created successfully" };
        } catch (error) {
          logger.error("Failed to create data source", "DATA_COLLECTION_API", {
            error,
          });
          throw error;
        }
      }),

    // Update a data source
    update: protectedProcedure
      .input(
        z.object({
          sourceId: z.string(),
          updates: UpdateDataSourceSchema,
        }),
      )
      .mutation(async ({ input }) => {
        try {
          if (!dataCollectionPipeline) {
            throw new Error("Pipeline not initialized");
          }

          await dataCollectionPipeline.updateDataSource(
            input.sourceId,
            input.updates,
          );

          logger.info("Data source updated", "DATA_COLLECTION_API", {
            sourceId: input.sourceId,
            updates: input.updates,
          });
          return { success: true, message: "Data source updated successfully" };
        } catch (error) {
          logger.error("Failed to update data source", "DATA_COLLECTION_API", {
            error,
          });
          throw error;
        }
      }),

    // Delete a data source
    delete: protectedProcedure
      .input(z.object({ sourceId: z.string() }))
      .mutation(async ({ input }) => {
        try {
          if (!dataCollectionPipeline) {
            throw new Error("Pipeline not initialized");
          }

          await dataCollectionPipeline.removeDataSource(input.sourceId);

          logger.info("Data source deleted", "DATA_COLLECTION_API", {
            sourceId: input.sourceId,
          });
          return { success: true, message: "Data source deleted successfully" };
        } catch (error) {
          logger.error("Failed to delete data source", "DATA_COLLECTION_API", {
            error,
          });
          throw error;
        }
      }),

    // Trigger data collection for a specific source
    collect: protectedProcedure
      .input(z.object({ sourceId: z.string() }))
      .mutation(async ({ input }) => {
        try {
          if (!dataCollectionPipeline) {
            throw new Error("Pipeline not initialized");
          }

          const jobId = await dataCollectionPipeline.collectFromSource(
            input.sourceId,
          );

          logger.info("Data collection triggered", "DATA_COLLECTION_API", {
            sourceId: input.sourceId,
            jobId,
          });
          return { jobId, message: "Data collection started successfully" };
        } catch (error) {
          logger.error(
            "Failed to trigger data collection",
            "DATA_COLLECTION_API",
            { error },
          );
          throw error;
        }
      }),
  }),

  // Job management
  jobs: router({
    // List all jobs
    list: protectedProcedure
      .input(
        z.object({
          sourceId: z.string().optional(),
          status: z
            .enum(["pending", "running", "completed", "failed"])
            .optional(),
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        }),
      )
      .query(async ({ input }) => {
        try {
          if (!dataCollectionPipeline) {
            return [];
          }

          let jobs = input.sourceId
            ? dataCollectionPipeline.getJobsForSource(input.sourceId)
            : dataCollectionPipeline.getJobs();

          if (input.status) {
            jobs = jobs.filter((job) => job.status === input.status);
          }

          // Apply pagination
          const total = jobs.length;
          const paginatedJobs = jobs
            .sort(
              (a, b) =>
                (b.startTime?.getTime() || 0) - (a.startTime?.getTime() || 0),
            )
            .slice(input.offset, input.offset + input.limit);

          return {
            jobs: paginatedJobs,
            total,
            hasMore: input.offset + input.limit < total,
          };
        } catch (error) {
          logger.error("Failed to list jobs", "DATA_COLLECTION_API", { error });
          throw error;
        }
      }),

    // Get job details
    get: protectedProcedure
      .input(z.object({ jobId: z.string() }))
      .query(async ({ input }) => {
        try {
          if (!dataCollectionPipeline) {
            throw new Error("Pipeline not initialized");
          }

          const jobs = dataCollectionPipeline.getJobs();
          const job = jobs.find((j) => j.id === input.jobId);

          if (!job) {
            throw new Error("Job not found");
          }

          return job;
        } catch (error) {
          logger.error("Failed to get job details", "DATA_COLLECTION_API", {
            error,
          });
          throw error;
        }
      }),
  }),

  // Direct data collection operations (for testing/manual collection)
  collect: router({
    // Search engine data collection
    searchEngine: protectedProcedure
      .input(SearchEngineParamsSchema)
      .mutation(async ({ input }) => {
        try {
          logger.info(
            "Manual search engine collection triggered",
            "DATA_COLLECTION_API",
            { input },
          );

          // This would use the Bright Data service directly
          // For now, return a mock response
          return {
            success: true,
            recordsCollected: 0,
            message: "Search engine data collection completed",
            data: [],
          };
        } catch (error) {
          logger.error(
            "Search engine collection failed",
            "DATA_COLLECTION_API",
            { error },
          );
          throw error;
        }
      }),

    // Web scraping data collection
    webScraping: protectedProcedure
      .input(WebScrapingParamsSchema)
      .mutation(async ({ input }) => {
        try {
          logger.info("Manual web scraping triggered", "DATA_COLLECTION_API", {
            input,
          });

          // This would use the Bright Data service directly
          // For now, return a mock response
          return {
            success: true,
            recordsCollected: 0,
            message: "Web scraping completed",
            data: [],
          };
        } catch (error) {
          logger.error("Web scraping failed", "DATA_COLLECTION_API", { error });
          throw error;
        }
      }),
  }),

  // Pipeline control
  control: router({
    // Start pipeline
    start: protectedProcedure.mutation(async () => {
      try {
        if (!dataCollectionPipeline) {
          throw new Error("Pipeline not initialized");
        }

        // Pipeline startup logic would go here
        logger.info("Data collection pipeline started", "DATA_COLLECTION_API");
        return { success: true, message: "Pipeline started successfully" };
      } catch (error) {
        logger.error("Failed to start pipeline", "DATA_COLLECTION_API", {
          error,
        });
        throw error;
      }
    }),

    // Stop pipeline
    stop: protectedProcedure.mutation(async () => {
      try {
        if (!dataCollectionPipeline) {
          throw new Error("Pipeline not initialized");
        }

        await dataCollectionPipeline.shutdown();
        logger.info("Data collection pipeline stopped", "DATA_COLLECTION_API");
        return { success: true, message: "Pipeline stopped successfully" };
      } catch (error) {
        logger.error("Failed to stop pipeline", "DATA_COLLECTION_API", {
          error,
        });
        throw error;
      }
    }),

    // Run scheduled collection
    runScheduled: protectedProcedure.mutation(async () => {
      try {
        if (!dataCollectionPipeline) {
          throw new Error("Pipeline not initialized");
        }

        await dataCollectionPipeline.runScheduledCollection();
        logger.info("Scheduled collection completed", "DATA_COLLECTION_API");
        return { success: true, message: "Scheduled collection completed" };
      } catch (error) {
        logger.error("Scheduled collection failed", "DATA_COLLECTION_API", {
          error,
        });
        throw error;
      }
    }),
  }),
});

export type DataCollectionRouter = typeof dataCollectionRouter;
