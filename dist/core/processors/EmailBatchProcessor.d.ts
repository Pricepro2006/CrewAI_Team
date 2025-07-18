import { EmailAnalysisAgent, EmailAnalysis } from '../agents/specialized/EmailAnalysisAgent';
import { EmailAnalysisCache } from '../cache/EmailAnalysisCache';
interface BatchProcessingOptions {
    concurrency?: number;
    timeout?: number;
    useCaching?: boolean;
    retryAttempts?: number;
}
interface BatchResult {
    emailId: string;
    success: boolean;
    analysis?: EmailAnalysis;
    error?: string;
    fromCache?: boolean;
    processingTime?: number;
}
export declare class EmailBatchProcessor {
    private queue;
    private agent;
    private cache;
    private options;
    constructor(agent: EmailAnalysisAgent, cache: EmailAnalysisCache, options?: BatchProcessingOptions);
    /**
     * Process multiple emails in batch
     */
    processBatch(emails: any[]): Promise<BatchResult[]>;
    /**
     * Process single email with caching and retry
     */
    private processEmail;
    /**
     * Get queue statistics
     */
    getStats(): {
        queue: {
            size: number;
            pending: number;
            isPaused: boolean;
        };
        cache: {
            size: number;
            hitRate: number;
            hits: number;
            misses: number;
            evictions: number;
        };
    };
    /**
     * Pause processing
     */
    pause(): void;
    /**
     * Resume processing
     */
    resume(): void;
    /**
     * Clear the queue
     */
    clear(): void;
    /**
     * Process emails with optimized Graph API calls
     */
    processWithGraphOptimization(emails: any[], graphClient: any): Promise<BatchResult[]>;
}
export {};
//# sourceMappingURL=EmailBatchProcessor.d.ts.map