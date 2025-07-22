import { EventEmitter } from 'events';
import type { EmailStorageService } from './EmailStorageService';
import type { WebSocketService } from './WebSocketService';
import { z } from 'zod';
declare const DataFlowConfigSchema: z.ZodObject<{
    iemsAnalysisDir: z.ZodDefault<z.ZodString>;
    iemsDatabase: z.ZodDefault<z.ZodString>;
    dashboardDatabase: z.ZodDefault<z.ZodString>;
    syncIntervalMinutes: z.ZodDefault<z.ZodNumber>;
    batchSize: z.ZodDefault<z.ZodNumber>;
    enableRealTimeSync: z.ZodDefault<z.ZodBoolean>;
    watchNewFiles: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    iemsAnalysisDir: string;
    iemsDatabase: string;
    dashboardDatabase: string;
    syncIntervalMinutes: number;
    batchSize: number;
    enableRealTimeSync: boolean;
    watchNewFiles: boolean;
}, {
    iemsAnalysisDir?: string | undefined;
    iemsDatabase?: string | undefined;
    dashboardDatabase?: string | undefined;
    syncIntervalMinutes?: number | undefined;
    batchSize?: number | undefined;
    enableRealTimeSync?: boolean | undefined;
    watchNewFiles?: boolean | undefined;
}>;
type DataFlowConfig = z.infer<typeof DataFlowConfigSchema>;
interface SyncResult {
    success: boolean;
    recordsProcessed: number;
    recordsFailed: number;
    duration: number;
    errors?: string[];
}
interface DataFlowStatus {
    isRunning: boolean;
    lastSync?: Date;
    nextSync?: Date;
    totalSyncs: number;
    totalRecordsProcessed: number;
    lastError?: string;
}
/**
 * Service for managing data flow between IEMS and Email Dashboard
 */
export declare class IEMSDataFlowService extends EventEmitter {
    private config;
    private emailService;
    private wsService;
    private syncInterval?;
    private fileWatcher?;
    private status;
    private isSyncing;
    constructor(config: Partial<DataFlowConfig> | undefined, emailService: EmailStorageService, wsService: WebSocketService);
    /**
     * Start the data flow service
     */
    start(): Promise<void>;
    /**
     * Stop the data flow service
     */
    stop(): Promise<void>;
    /**
     * Perform a manual sync
     */
    performSync(): Promise<SyncResult>;
    /**
     * Process a single new analysis file
     */
    processNewAnalysisFile(filePath: string): Promise<void>;
    /**
     * Transform analysis data to email format
     */
    private transformAnalysisToEmail;
    /**
     * Generate email summary
     */
    private generateSummary;
    /**
     * Map workflow state
     */
    private mapWorkflowState;
    /**
     * Map workflow type
     */
    private mapWorkflowType;
    /**
     * Map priority level
     */
    private mapPriority;
    /**
     * Parse date from components
     */
    private parseDate;
    /**
     * Extract entities from analysis
     */
    private extractEntities;
    /**
     * Extract recipients from participants
     */
    private extractRecipients;
    /**
     * Set up scheduled sync
     */
    private setupScheduledSync;
    /**
     * Set up file watcher for new analysis files
     */
    private setupFileWatcher;
    /**
     * Set up real-time sync event listeners
     */
    private setupRealTimeSync;
    /**
     * Get service status
     */
    getStatus(): DataFlowStatus;
    /**
     * Get sync statistics
     */
    getStatistics(): Promise<any>;
}
export {};
//# sourceMappingURL=IEMSDataFlowService.d.ts.map