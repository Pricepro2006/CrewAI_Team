/**
 * Data Collection Pipeline
 * Orchestrates data collection from multiple sources using Bright Data
 */
import { EventEmitter } from "events";
import type { DataSource, DataCollectionJob, DataPipelineStats, BrightDataCredentials } from "./types";
export declare class DataCollectionPipeline extends EventEmitter {
    private brightDataService;
    private sources;
    private jobs;
    private processingRules;
    private isRunning;
    private schedulerInterval?;
    constructor(credentials: BrightDataCredentials);
    /**
     * Initialize the pipeline
     */
    initialize(): Promise<void>;
    /**
     * Add a new data source
     */
    addDataSource(source: Omit<DataSource, "id" | "createdAt">): Promise<string>;
    /**
     * Remove a data source
     */
    removeDataSource(sourceId: string): Promise<void>;
    /**
     * Update a data source
     */
    updateDataSource(sourceId: string, updates: Partial<DataSource>): Promise<void>;
    /**
     * Run data collection for a specific source
     */
    collectFromSource(sourceId: string): Promise<string>;
    /**
     * Run scheduled data collection for all active sources
     */
    runScheduledCollection(): Promise<void>;
    /**
     * Get pipeline statistics
     */
    getStats(): Promise<DataPipelineStats>;
    /**
     * Get all data sources
     */
    getDataSources(): DataSource[];
    /**
     * Get all jobs
     */
    getJobs(): DataCollectionJob[];
    /**
     * Get jobs for a specific source
     */
    getJobsForSource(sourceId: string): DataCollectionJob[];
    /**
     * Shutdown the pipeline
     */
    shutdown(): Promise<void>;
    private loadConfiguration;
    private startScheduler;
    private collectSearchEngineData;
    private collectWebScrapingData;
    private collectEcommerceData;
    private collectSocialMediaData;
    private processCollectedData;
    private shouldApplyRule;
    private applyProcessingRule;
}
//# sourceMappingURL=DataCollectionPipeline.d.ts.map