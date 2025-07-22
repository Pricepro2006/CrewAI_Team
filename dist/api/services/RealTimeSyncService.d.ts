import { EventEmitter } from 'events';
import type { WebSocketService } from './WebSocketService';
import type { EmailStorageService } from './EmailStorageService';
import type { IEMSDataFlowService } from './IEMSDataFlowService';
import { z } from 'zod';
export declare enum SyncEventType {
    EMAIL_CREATED = "email:created",
    EMAIL_UPDATED = "email:updated",
    EMAIL_DELETED = "email:deleted",
    STATUS_CHANGED = "status:changed",
    WORKFLOW_UPDATED = "workflow:updated",
    SYNC_REQUESTED = "sync:requested",
    SYNC_STARTED = "sync:started",
    SYNC_COMPLETED = "sync:completed",
    SYNC_FAILED = "sync:failed",
    BATCH_UPDATE = "batch:update",
    ANALYSIS_RECEIVED = "analysis:received"
}
declare const SyncEventSchema: z.ZodObject<{
    type: z.ZodNativeEnum<typeof SyncEventType>;
    timestamp: z.ZodString;
    source: z.ZodString;
    data: z.ZodAny;
    metadata: z.ZodOptional<z.ZodObject<{
        userId: z.ZodOptional<z.ZodString>;
        sessionId: z.ZodOptional<z.ZodString>;
        correlationId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        userId?: string | undefined;
        sessionId?: string | undefined;
        correlationId?: string | undefined;
    }, {
        userId?: string | undefined;
        sessionId?: string | undefined;
        correlationId?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: SyncEventType;
    timestamp: string;
    source: string;
    data?: any;
    metadata?: {
        userId?: string | undefined;
        sessionId?: string | undefined;
        correlationId?: string | undefined;
    } | undefined;
}, {
    type: SyncEventType;
    timestamp: string;
    source: string;
    data?: any;
    metadata?: {
        userId?: string | undefined;
        sessionId?: string | undefined;
        correlationId?: string | undefined;
    } | undefined;
}>;
type SyncEvent = z.infer<typeof SyncEventSchema>;
interface SyncStatistics {
    eventsProcessed: number;
    eventsPerMinute: number;
    activeSubscriptions: number;
    lastEventTime?: Date;
    errorCount: number;
    averageProcessingTime: number;
}
/**
 * Service for managing real-time synchronization between IEMS and Email Dashboard
 */
export declare class RealTimeSyncService extends EventEmitter {
    private wsService;
    private emailService;
    private dataFlowService?;
    private subscriptions;
    private eventQueue;
    private isProcessing;
    private statistics;
    private eventBuffer;
    private bufferTimeout?;
    constructor(wsService: WebSocketService, emailService: EmailStorageService);
    /**
     * Set the data flow service for integration
     */
    setDataFlowService(dataFlowService: IEMSDataFlowService): void;
    /**
     * Subscribe to real-time sync events
     */
    subscribe(events: SyncEventType[], callback: (event: SyncEvent) => void, filter?: Record<string, any>): string;
    /**
     * Unsubscribe from real-time sync events
     */
    unsubscribe(subscriptionId: string): boolean;
    /**
     * Publish a sync event
     */
    publishEvent(event: Omit<SyncEvent, 'timestamp'>): Promise<void>;
    /**
     * Process the event queue
     */
    private processEventQueue;
    /**
     * Process a single event
     */
    private processEvent;
    /**
     * Check if event should be buffered
     */
    private shouldBufferEvent;
    /**
     * Buffer event for batch processing
     */
    private bufferEvent;
    /**
     * Flush the event buffer
     */
    private flushEventBuffer;
    /**
     * Check if event matches subscription
     */
    private matchesSubscription;
    /**
     * Broadcast event via WebSocket
     */
    private broadcastEvent;
    /**
     * Handle specific event types
     */
    private handleSpecificEvent;
    /**
     * Handle sync request
     */
    private handleSyncRequest;
    /**
     * Handle new analysis received
     */
    private handleAnalysisReceived;
    /**
     * Handle status change
     */
    private handleStatusChange;
    /**
     * Handle batch update
     */
    private handleBatchUpdate;
    /**
     * Set up WebSocket event listeners
     */
    private setupEventListeners;
    /**
     * Set up data flow service listeners
     */
    private setupDataFlowListeners;
    /**
     * Start statistics tracking
     */
    private startStatisticsTracking;
    /**
     * Update average processing time
     */
    private updateAverageProcessingTime;
    /**
     * Generate subscription ID
     */
    private generateSubscriptionId;
    /**
     * Generate correlation ID
     */
    private generateCorrelationId;
    /**
     * Get sync statistics
     */
    getStatistics(): SyncStatistics;
    /**
     * Get active subscriptions
     */
    getSubscriptions(): Array<{
        id: string;
        events: SyncEventType[];
        filter?: any;
    }>;
    /**
     * Clear all subscriptions
     */
    clearSubscriptions(): void;
}
export {};
//# sourceMappingURL=RealTimeSyncService.d.ts.map