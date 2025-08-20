/**
 * Data Collection Pipeline
 * Orchestrates data collection from multiple sources using Bright Data
 */

import { EventEmitter } from "events";
import { BrightDataService } from "./BrightDataService.js";
import { logger } from "../../utils/logger.js";
import type {
  DataSource,
  DataCollectionJob,
  CollectedData,
  DataProcessingRule,
  DataPipelineStats,
  BrightDataCredentials,
} from "./types.js";

export class DataCollectionPipeline extends EventEmitter {
  private brightDataService: BrightDataService;
  private sources = new Map<string, DataSource>();
  private jobs = new Map<string, DataCollectionJob>();
  private processingRules: DataProcessingRule[] = [];
  private isRunning = false;
  private schedulerInterval?: NodeJS.Timeout;

  constructor(credentials: BrightDataCredentials) {
    super();
    this.brightDataService = new BrightDataService(credentials);
    this.setMaxListeners(0); // No limit on listeners
  }

  /**
   * Initialize the pipeline
   */
  async initialize(): Promise<void> {
    try {
      logger.info("Initializing Data Collection Pipeline", "DATA_PIPELINE");

      // Load existing sources and rules from database
      await this.loadConfiguration();

      // Start the scheduler
      this.startScheduler();

      this.isRunning = true;
      logger.info(
        "Data Collection Pipeline initialized successfully",
        "DATA_PIPELINE",
      );
    } catch (error) {
      logger.error(
        "Failed to initialize Data Collection Pipeline",
        "DATA_PIPELINE",
        { error },
      );
      throw error;
    }
  }

  /**
   * Add a new data source
   */
  async addDataSource(
    source: Omit<DataSource, "id" | "createdAt">,
  ): Promise<string> {
    const id = `source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newSource: DataSource = {
      id,
      ...source,
      createdAt: new Date(),
    };

    this?.sources?.set(id, newSource);

    logger.info("Data source added", "DATA_PIPELINE", {
      sourceId: id,
      type: source.type,
    });
    this.emit("source:added", newSource);

    return id;
  }

  /**
   * Remove a data source
   */
  async removeDataSource(sourceId: string): Promise<void> {
    const source = this?.sources?.get(sourceId);
    if (!source) {
      throw new Error(`Data source not found: ${sourceId}`);
    }

    this?.sources?.delete(sourceId);

    logger.info("Data source removed", "DATA_PIPELINE", { sourceId });
    this.emit("source:removed", source);
  }

  /**
   * Update a data source
   */
  async updateDataSource(
    sourceId: string,
    updates: Partial<DataSource>,
  ): Promise<void> {
    const source = this?.sources?.get(sourceId);
    if (!source) {
      throw new Error(`Data source not found: ${sourceId}`);
    }

    const updatedSource = { ...source, ...updates };
    this?.sources?.set(sourceId, updatedSource);

    logger.info("Data source updated", "DATA_PIPELINE", { sourceId, updates });
    this.emit("source:updated", updatedSource);
  }

  /**
   * Run data collection for a specific source
   */
  async collectFromSource(sourceId: string): Promise<string> {
    const source = this?.sources?.get(sourceId);
    if (!source) {
      throw new Error(`Data source not found: ${sourceId}`);
    }

    if (source.status !== "active") {
      throw new Error(`Data source is not active: ${sourceId}`);
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const job: DataCollectionJob = {
      id: jobId,
      sourceId,
      status: "pending",
      startTime: new Date(),
    };

    this?.jobs?.set(jobId, job);
    this.emit("job:started", job);

    try {
      // Update job status
      job.status = "running";
      this?.jobs?.set(jobId, job);

      // Collect data based on source type
      let collectedData: CollectedData[] = [];

      switch (source.type) {
        case "search_engine":
          collectedData = await this.collectSearchEngineData(source);
          break;
        case "web_scraping":
          collectedData = await this.collectWebScrapingData(source);
          break;
        case "ecommerce":
          collectedData = await this.collectEcommerceData(source);
          break;
        case "social_media":
          collectedData = await this.collectSocialMediaData(source);
          break;
        default:
          throw new Error(`Unsupported source type: ${source.type}`);
      }

      // Process collected data
      const processedData = await this.processCollectedData(collectedData);

      // Update job completion
      job.status = "completed";
      job.endTime = new Date();
      job.recordsCollected = processedData?.length || 0;
      this?.jobs?.set(jobId, job);

      // Update source last run time
      source.lastRun = new Date();
      this?.sources?.set(sourceId, source);

      logger.info("Data collection completed", "DATA_PIPELINE", {
        jobId,
        sourceId,
        recordsCollected: processedData?.length || 0,
      });

      this.emit("job:completed", job, processedData);
      return jobId;
    } catch (error) {
      // Update job failure
      job.status = "failed";
      job.endTime = new Date();
      job.error = (error as Error).message;
      this?.jobs?.set(jobId, job);

      logger.error("Data collection failed", "DATA_PIPELINE", {
        jobId,
        sourceId,
        error: (error as Error).message,
      });

      this.emit("job:failed", job, error);
      throw error;
    }
  }

  /**
   * Run scheduled data collection for all active sources
   */
  async runScheduledCollection(): Promise<void> {
    const activeSources = Array.from(this?.sources?.values()).filter(
      (source: any) => source.status === "active",
    );

    logger.info("Running scheduled data collection", "DATA_PIPELINE", {
      activeSources: activeSources?.length || 0,
    });

    const results = await Promise.allSettled(
      activeSources?.map((source: any) => this.collectFromSource(source.id)),
    );

    const successful = results?.filter((r: any) => r.status === "fulfilled").length;
    const failed = results?.filter((r: any) => r.status === "rejected").length;

    logger.info("Scheduled data collection completed", "DATA_PIPELINE", {
      successful,
      failed,
      total: activeSources?.length || 0,
    });
  }

  /**
   * Get pipeline statistics
   */
  async getStats(): Promise<DataPipelineStats> {
    const sources = Array.from(this?.sources?.values());
    const jobs = Array.from(this?.jobs?.values());

    return {
      totalSources: sources?.length || 0,
      activeSources: sources?.filter((s: any) => s.status === "active").length,
      totalJobs: jobs?.length || 0,
      successfulJobs: jobs?.filter((j: any) => j.status === "completed").length,
      failedJobs: jobs?.filter((j: any) => j.status === "failed").length,
      recordsCollected: jobs.reduce(
        (sum, j) => sum + (j.recordsCollected || 0),
        0,
      ),
      lastActivity:
        jobs?.length || 0 > 0
          ? new Date(Math.max(...jobs?.map((j: any) => j.startTime?.getTime() || 0)))
          : undefined,
    };
  }

  /**
   * Get all data sources
   */
  getDataSources(): DataSource[] {
    return Array.from(this?.sources?.values());
  }

  /**
   * Get all jobs
   */
  getJobs(): DataCollectionJob[] {
    return Array.from(this?.jobs?.values());
  }

  /**
   * Get jobs for a specific source
   */
  getJobsForSource(sourceId: string): DataCollectionJob[] {
    return Array.from(this?.jobs?.values()).filter(
      (job: any) => job.sourceId === sourceId,
    );
  }

  /**
   * Shutdown the pipeline
   */
  async shutdown(): Promise<void> {
    this.isRunning = false;

    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }

    logger.info("Data Collection Pipeline shutdown", "DATA_PIPELINE");
  }

  // Private methods

  private async loadConfiguration(): Promise<void> {
    // This would load configuration from database
    // For now, we'll add some example sources

    logger.info("Loading pipeline configuration", "DATA_PIPELINE");
    // Configuration would be loaded from persistent storage
  }

  private startScheduler(): void {
    // Run scheduled collection every hour
    this.schedulerInterval = setInterval(
      () => {
        if (this.isRunning) {
          this.runScheduledCollection().catch((error: any) => {
            logger.error("Scheduled collection failed", "DATA_PIPELINE", {
              error,
            });
          });
        }
      },
      60 * 60 * 1000,
    ); // 1 hour
  }

  private async collectSearchEngineData(
    source: DataSource,
  ): Promise<CollectedData[]> {
    const params = {
      query: source?.config?.keywords?.join(" ") || "",
      engine: "google" as const,
      maxResults: source?.config?.maxResults || 10,
    };

    return await this?.brightDataService?.collectSearchResults(params);
  }

  private async collectWebScrapingData(
    source: DataSource,
  ): Promise<CollectedData[]> {
    if (!source?.config?.url) {
      throw new Error("URL is required for web scraping");
    }

    const params = {
      url: source?.config?.url,
      extractionPrompt: source?.config?.filters?.extractionPrompt,
      followLinks: source?.config?.filters?.followLinks || false,
      maxDepth: source?.config?.filters?.maxDepth || 1,
    };

    return await this?.brightDataService?.collectWebScrapingData(params);
  }

  private async collectEcommerceData(
    source: DataSource,
  ): Promise<CollectedData[]> {
    const platform = source?.config?.filters?.platform;
    if (!platform) {
      throw new Error("Platform is required for e-commerce data collection");
    }

    const params = {
      platform,
      productUrl: source?.config?.url,
      searchKeyword: source?.config?.keywords?.[0],
      maxProducts: source?.config?.maxResults || 10,
    };

    return await this?.brightDataService?.collectEcommerceData(params);
  }

  private async collectSocialMediaData(
    source: DataSource,
  ): Promise<CollectedData[]> {
    const platform = source?.config?.filters?.platform;
    if (!platform) {
      throw new Error("Platform is required for social media data collection");
    }

    const params = {
      platform,
      profileUrl: source?.config?.url,
      searchTerm: source?.config?.keywords?.[0],
      maxPosts: source?.config?.maxResults || 10,
    };

    return await this?.brightDataService?.collectSocialMediaData(params);
  }

  private async processCollectedData(
    data: CollectedData[],
  ): Promise<CollectedData[]> {
    // Apply processing rules to collected data
    for (const item of data) {
      for (const rule of this.processingRules) {
        if (rule.enabled && this.shouldApplyRule(rule, item)) {
          await this.applyProcessingRule(rule, item);
        }
      }
      item.processedAt = new Date();
    }

    return data;
  }

  private shouldApplyRule(
    rule: DataProcessingRule,
    data: CollectedData,
  ): boolean {
    // Check if rule should be applied based on source types and other criteria
    return (
      rule?.sourceTypes?.includes("*") ||
      rule?.sourceTypes?.some((type: any) => data.tags?.includes(type))
    );
  }

  private async applyProcessingRule(
    rule: DataProcessingRule,
    data: CollectedData,
  ): Promise<void> {
    // Apply specific processing based on rule type
    switch (rule.processor) {
      case "text_extraction":
        // Extract text content
        break;
      case "data_cleaning":
        // Clean and normalize data
        break;
      case "entity_extraction":
        // Extract entities using NLP
        break;
      case "sentiment_analysis":
        // Analyze sentiment
        break;
    }
  }
}
