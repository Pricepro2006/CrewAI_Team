/**
 * Data Flow Configuration
 * Settings for IEMS to Email Dashboard data synchronization
 */
export interface DataFlowConfig {
    iemsAnalysisDir: string;
    iemsDatabase: string;
    dashboardDatabase: string;
    syncIntervalMinutes: number;
    batchSize: number;
    enableRealTimeSync: boolean;
    watchNewFiles: boolean;
    maxConcurrentProcessing: number;
    processingTimeout: number;
    retryAttempts: number;
    retryDelay: number;
    enableMetrics: boolean;
    metricsInterval: number;
}
export declare const defaultDataFlowConfig: DataFlowConfig;
/**
 * Get configuration for current environment
 */
export declare function getDataFlowConfig(env?: string): DataFlowConfig;
/**
 * Validate data flow configuration
 */
export declare function validateDataFlowConfig(config: DataFlowConfig): string[];
//# sourceMappingURL=dataflow.config.d.ts.map