/**
 * Data Collection Pipeline
 * Orchestrates data collection from multiple sources using Bright Data
 */
import { EventEmitter } from "events";
import { BrightDataService } from "./BrightDataService";
import { logger } from "../../utils/logger";
export class DataCollectionPipeline extends EventEmitter {
    brightDataService;
    sources = new Map();
    jobs = new Map();
    processingRules = [];
    isRunning = false;
    schedulerInterval;
    constructor(credentials) {
        super();
        this.brightDataService = new BrightDataService(credentials);
        this.setMaxListeners(0); // No limit on listeners
    }
    /**
     * Initialize the pipeline
     */
    async initialize() {
        try {
            logger.info("Initializing Data Collection Pipeline", "DATA_PIPELINE");
            // Load existing sources and rules from database
            await this.loadConfiguration();
            // Start the scheduler
            this.startScheduler();
            this.isRunning = true;
            logger.info("Data Collection Pipeline initialized successfully", "DATA_PIPELINE");
        }
        catch (error) {
            logger.error("Failed to initialize Data Collection Pipeline", "DATA_PIPELINE", { error });
            throw error;
        }
    }
    /**
     * Add a new data source
     */
    async addDataSource(source) {
        const id = `source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newSource = {
            id,
            ...source,
            createdAt: new Date(),
        };
        this.sources.set(id, newSource);
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
    async removeDataSource(sourceId) {
        const source = this.sources.get(sourceId);
        if (!source) {
            throw new Error(`Data source not found: ${sourceId}`);
        }
        this.sources.delete(sourceId);
        logger.info("Data source removed", "DATA_PIPELINE", { sourceId });
        this.emit("source:removed", source);
    }
    /**
     * Update a data source
     */
    async updateDataSource(sourceId, updates) {
        const source = this.sources.get(sourceId);
        if (!source) {
            throw new Error(`Data source not found: ${sourceId}`);
        }
        const updatedSource = { ...source, ...updates };
        this.sources.set(sourceId, updatedSource);
        logger.info("Data source updated", "DATA_PIPELINE", { sourceId, updates });
        this.emit("source:updated", updatedSource);
    }
    /**
     * Run data collection for a specific source
     */
    async collectFromSource(sourceId) {
        const source = this.sources.get(sourceId);
        if (!source) {
            throw new Error(`Data source not found: ${sourceId}`);
        }
        if (source.status !== "active") {
            throw new Error(`Data source is not active: ${sourceId}`);
        }
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const job = {
            id: jobId,
            sourceId,
            status: "pending",
            startTime: new Date(),
        };
        this.jobs.set(jobId, job);
        this.emit("job:started", job);
        try {
            // Update job status
            job.status = "running";
            this.jobs.set(jobId, job);
            // Collect data based on source type
            let collectedData = [];
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
            job.recordsCollected = processedData.length;
            this.jobs.set(jobId, job);
            // Update source last run time
            source.lastRun = new Date();
            this.sources.set(sourceId, source);
            logger.info("Data collection completed", "DATA_PIPELINE", {
                jobId,
                sourceId,
                recordsCollected: processedData.length,
            });
            this.emit("job:completed", job, processedData);
            return jobId;
        }
        catch (error) {
            // Update job failure
            job.status = "failed";
            job.endTime = new Date();
            job.error = error.message;
            this.jobs.set(jobId, job);
            logger.error("Data collection failed", "DATA_PIPELINE", {
                jobId,
                sourceId,
                error: error.message,
            });
            this.emit("job:failed", job, error);
            throw error;
        }
    }
    /**
     * Run scheduled data collection for all active sources
     */
    async runScheduledCollection() {
        const activeSources = Array.from(this.sources.values()).filter((source) => source.status === "active");
        logger.info("Running scheduled data collection", "DATA_PIPELINE", {
            activeSources: activeSources.length,
        });
        const results = await Promise.allSettled(activeSources.map((source) => this.collectFromSource(source.id)));
        const successful = results.filter((r) => r.status === "fulfilled").length;
        const failed = results.filter((r) => r.status === "rejected").length;
        logger.info("Scheduled data collection completed", "DATA_PIPELINE", {
            successful,
            failed,
            total: activeSources.length,
        });
    }
    /**
     * Get pipeline statistics
     */
    async getStats() {
        const sources = Array.from(this.sources.values());
        const jobs = Array.from(this.jobs.values());
        return {
            totalSources: sources.length,
            activeSources: sources.filter((s) => s.status === "active").length,
            totalJobs: jobs.length,
            successfulJobs: jobs.filter((j) => j.status === "completed").length,
            failedJobs: jobs.filter((j) => j.status === "failed").length,
            recordsCollected: jobs.reduce((sum, j) => sum + (j.recordsCollected || 0), 0),
            lastActivity: jobs.length > 0
                ? new Date(Math.max(...jobs.map((j) => j.startTime?.getTime() || 0)))
                : undefined,
        };
    }
    /**
     * Get all data sources
     */
    getDataSources() {
        return Array.from(this.sources.values());
    }
    /**
     * Get all jobs
     */
    getJobs() {
        return Array.from(this.jobs.values());
    }
    /**
     * Get jobs for a specific source
     */
    getJobsForSource(sourceId) {
        return Array.from(this.jobs.values()).filter((job) => job.sourceId === sourceId);
    }
    /**
     * Shutdown the pipeline
     */
    async shutdown() {
        this.isRunning = false;
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
        }
        logger.info("Data Collection Pipeline shutdown", "DATA_PIPELINE");
    }
    // Private methods
    async loadConfiguration() {
        // This would load configuration from database
        // For now, we'll add some example sources
        logger.info("Loading pipeline configuration", "DATA_PIPELINE");
        // Configuration would be loaded from persistent storage
    }
    startScheduler() {
        // Run scheduled collection every hour
        this.schedulerInterval = setInterval(() => {
            if (this.isRunning) {
                this.runScheduledCollection().catch((error) => {
                    logger.error("Scheduled collection failed", "DATA_PIPELINE", {
                        error,
                    });
                });
            }
        }, 60 * 60 * 1000); // 1 hour
    }
    async collectSearchEngineData(source) {
        const params = {
            query: source.config.keywords?.join(" ") || "",
            engine: "google",
            maxResults: source.config.maxResults || 10,
        };
        return await this.brightDataService.collectSearchResults(params);
    }
    async collectWebScrapingData(source) {
        if (!source.config.url) {
            throw new Error("URL is required for web scraping");
        }
        const params = {
            url: source.config.url,
            extractionPrompt: source.config.filters?.extractionPrompt,
            followLinks: source.config.filters?.followLinks || false,
            maxDepth: source.config.filters?.maxDepth || 1,
        };
        return await this.brightDataService.collectWebScrapingData(params);
    }
    async collectEcommerceData(source) {
        const platform = source.config.filters?.platform;
        if (!platform) {
            throw new Error("Platform is required for e-commerce data collection");
        }
        const params = {
            platform,
            productUrl: source.config.url,
            searchKeyword: source.config.keywords?.[0],
            maxProducts: source.config.maxResults || 10,
        };
        return await this.brightDataService.collectEcommerceData(params);
    }
    async collectSocialMediaData(source) {
        const platform = source.config.filters?.platform;
        if (!platform) {
            throw new Error("Platform is required for social media data collection");
        }
        const params = {
            platform,
            profileUrl: source.config.url,
            searchTerm: source.config.keywords?.[0],
            maxPosts: source.config.maxResults || 10,
        };
        return await this.brightDataService.collectSocialMediaData(params);
    }
    async processCollectedData(data) {
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
    shouldApplyRule(rule, data) {
        // Check if rule should be applied based on source types and other criteria
        return (rule.sourceTypes.includes("*") ||
            rule.sourceTypes.some((type) => data.tags?.includes(type)));
    }
    async applyProcessingRule(rule, data) {
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
//# sourceMappingURL=DataCollectionPipeline.js.map