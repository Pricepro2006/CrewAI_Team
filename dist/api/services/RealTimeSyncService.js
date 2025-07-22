import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { z } from 'zod';
// Real-time sync event types
export var SyncEventType;
(function (SyncEventType) {
    SyncEventType["EMAIL_CREATED"] = "email:created";
    SyncEventType["EMAIL_UPDATED"] = "email:updated";
    SyncEventType["EMAIL_DELETED"] = "email:deleted";
    SyncEventType["STATUS_CHANGED"] = "status:changed";
    SyncEventType["WORKFLOW_UPDATED"] = "workflow:updated";
    SyncEventType["SYNC_REQUESTED"] = "sync:requested";
    SyncEventType["SYNC_STARTED"] = "sync:started";
    SyncEventType["SYNC_COMPLETED"] = "sync:completed";
    SyncEventType["SYNC_FAILED"] = "sync:failed";
    SyncEventType["BATCH_UPDATE"] = "batch:update";
    SyncEventType["ANALYSIS_RECEIVED"] = "analysis:received";
})(SyncEventType || (SyncEventType = {}));
// Sync event schema
const SyncEventSchema = z.object({
    type: z.nativeEnum(SyncEventType),
    timestamp: z.string().datetime(),
    source: z.string(),
    data: z.any(),
    metadata: z.object({
        userId: z.string().optional(),
        sessionId: z.string().optional(),
        correlationId: z.string().optional()
    }).optional()
});
/**
 * Service for managing real-time synchronization between IEMS and Email Dashboard
 */
export class RealTimeSyncService extends EventEmitter {
    wsService;
    emailService;
    dataFlowService;
    subscriptions = new Map();
    eventQueue = [];
    isProcessing = false;
    statistics;
    eventBuffer = new Map();
    bufferTimeout;
    constructor(wsService, emailService) {
        super();
        this.wsService = wsService;
        this.emailService = emailService;
        this.statistics = {
            eventsProcessed: 0,
            eventsPerMinute: 0,
            activeSubscriptions: 0,
            errorCount: 0,
            averageProcessingTime: 0
        };
        this.setupEventListeners();
        this.startStatisticsTracking();
    }
    /**
     * Set the data flow service for integration
     */
    setDataFlowService(dataFlowService) {
        this.dataFlowService = dataFlowService;
        this.setupDataFlowListeners();
    }
    /**
     * Subscribe to real-time sync events
     */
    subscribe(events, callback, filter) {
        const id = this.generateSubscriptionId();
        const subscription = {
            id,
            events,
            filter,
            callback
        };
        this.subscriptions.set(id, subscription);
        this.statistics.activeSubscriptions = this.subscriptions.size;
        logger.info(`New sync subscription created: ${id}`, 'REAL_TIME_SYNC', { events, filter });
        return id;
    }
    /**
     * Unsubscribe from real-time sync events
     */
    unsubscribe(subscriptionId) {
        const deleted = this.subscriptions.delete(subscriptionId);
        if (deleted) {
            this.statistics.activeSubscriptions = this.subscriptions.size;
            logger.info(`Sync subscription removed: ${subscriptionId}`);
        }
        return deleted;
    }
    /**
     * Publish a sync event
     */
    async publishEvent(event) {
        const fullEvent = {
            ...event,
            timestamp: new Date().toISOString()
        };
        // Validate event
        try {
            SyncEventSchema.parse(fullEvent);
        }
        catch (error) {
            logger.error('Invalid sync event', 'REAL_TIME_SYNC', {}, error instanceof Error ? error : new Error(String(error)));
            return;
        }
        // Add to queue
        this.eventQueue.push(fullEvent);
        // Process queue
        await this.processEventQueue();
    }
    /**
     * Process the event queue
     */
    async processEventQueue() {
        if (this.isProcessing || this.eventQueue.length === 0) {
            return;
        }
        this.isProcessing = true;
        const startTime = Date.now();
        try {
            while (this.eventQueue.length > 0) {
                const event = this.eventQueue.shift();
                // Process event
                await this.processEvent(event);
                // Update statistics
                this.statistics.eventsProcessed++;
                this.statistics.lastEventTime = new Date();
            }
        }
        catch (error) {
            logger.error('Error processing event queue', 'REAL_TIME_SYNC', {}, error instanceof Error ? error : new Error(String(error)));
            this.statistics.errorCount++;
        }
        finally {
            this.isProcessing = false;
            // Update average processing time
            const processingTime = Date.now() - startTime;
            this.updateAverageProcessingTime(processingTime);
        }
    }
    /**
     * Process a single event
     */
    async processEvent(event) {
        logger.debug(`Processing sync event: ${event.type}`, 'REAL_TIME_SYNC', event);
        // Buffer events for batch processing
        if (this.shouldBufferEvent(event)) {
            this.bufferEvent(event);
            return;
        }
        // Notify subscribers
        for (const subscription of this.subscriptions.values()) {
            if (this.matchesSubscription(event, subscription)) {
                try {
                    subscription.callback(event);
                }
                catch (error) {
                    logger.error(`Subscription callback error: ${subscription.id}`, 'REAL_TIME_SYNC', {}, error instanceof Error ? error : new Error(String(error)));
                }
            }
        }
        // Broadcast via WebSocket
        this.broadcastEvent(event);
        // Handle specific event types
        await this.handleSpecificEvent(event);
    }
    /**
     * Check if event should be buffered
     */
    shouldBufferEvent(event) {
        const bufferableEvents = [
            SyncEventType.EMAIL_CREATED,
            SyncEventType.EMAIL_UPDATED,
            SyncEventType.STATUS_CHANGED
        ];
        return bufferableEvents.includes(event.type);
    }
    /**
     * Buffer event for batch processing
     */
    bufferEvent(event) {
        const key = `${event.type}:${event.source}`;
        if (!this.eventBuffer.has(key)) {
            this.eventBuffer.set(key, []);
        }
        this.eventBuffer.get(key).push(event);
        // Reset buffer timeout
        if (this.bufferTimeout) {
            clearTimeout(this.bufferTimeout);
        }
        // Flush buffer after delay
        this.bufferTimeout = setTimeout(() => {
            this.flushEventBuffer();
        }, 1000); // 1 second buffer
    }
    /**
     * Flush the event buffer
     */
    async flushEventBuffer() {
        if (this.eventBuffer.size === 0) {
            return;
        }
        logger.info(`Flushing event buffer with ${this.eventBuffer.size} groups`);
        for (const [key, events] of this.eventBuffer.entries()) {
            if (events.length === 0)
                continue;
            // Create batch event
            const batchEvent = {
                type: SyncEventType.BATCH_UPDATE,
                timestamp: new Date().toISOString(),
                source: 'sync-service',
                data: {
                    eventType: events[0]?.type || 'unknown',
                    count: events.length,
                    events: events
                },
                metadata: {
                    correlationId: this.generateCorrelationId()
                }
            };
            // Process batch event
            await this.processEvent(batchEvent);
        }
        // Clear buffer
        this.eventBuffer.clear();
    }
    /**
     * Check if event matches subscription
     */
    matchesSubscription(event, subscription) {
        // Check event type
        if (!subscription.events.includes(event.type)) {
            return false;
        }
        // Check filter
        if (subscription.filter) {
            for (const [key, value] of Object.entries(subscription.filter)) {
                if (event.data?.[key] !== value) {
                    return false;
                }
            }
        }
        return true;
    }
    /**
     * Broadcast event via WebSocket
     */
    broadcastEvent(event) {
        const wsMessage = {
            type: 'sync_event',
            event: event
        };
        this.wsService.broadcastEmailBulkUpdate(event.type, [], { successful: 1, failed: 0, total: 1 });
    }
    /**
     * Handle specific event types
     */
    async handleSpecificEvent(event) {
        switch (event.type) {
            case SyncEventType.SYNC_REQUESTED:
                await this.handleSyncRequest(event);
                break;
            case SyncEventType.ANALYSIS_RECEIVED:
                await this.handleAnalysisReceived(event);
                break;
            case SyncEventType.STATUS_CHANGED:
                await this.handleStatusChange(event);
                break;
            case SyncEventType.BATCH_UPDATE:
                await this.handleBatchUpdate(event);
                break;
        }
    }
    /**
     * Handle sync request
     */
    async handleSyncRequest(event) {
        if (!this.dataFlowService) {
            logger.warn('Data flow service not available for sync request');
            return;
        }
        logger.info('Processing sync request', 'REAL_TIME_SYNC', event.metadata);
        // Publish sync started event
        await this.publishEvent({
            type: SyncEventType.SYNC_STARTED,
            source: 'sync-service',
            data: { requestId: event.metadata?.correlationId }
        });
        try {
            // Perform sync
            const result = await this.dataFlowService.performSync();
            // Publish sync completed event
            await this.publishEvent({
                type: SyncEventType.SYNC_COMPLETED,
                source: 'sync-service',
                data: result,
                metadata: event.metadata
            });
        }
        catch (error) {
            // Publish sync failed event
            await this.publishEvent({
                type: SyncEventType.SYNC_FAILED,
                source: 'sync-service',
                data: { error: error instanceof Error ? error.message : String(error) },
                metadata: event.metadata
            });
        }
    }
    /**
     * Handle new analysis received
     */
    async handleAnalysisReceived(event) {
        logger.info('Processing new analysis', event.data);
        try {
            // Extract email data from analysis
            const emailData = event.data.email;
            // Create or update email
            const email = await this.emailService.createEmail(emailData);
            // Publish email created event
            await this.publishEvent({
                type: SyncEventType.EMAIL_CREATED,
                source: 'analysis-processor',
                data: { email },
                metadata: event.metadata
            });
        }
        catch (error) {
            logger.error('Failed to process analysis', 'REAL_TIME_SYNC', {}, error instanceof Error ? error : new Error(String(error)));
        }
    }
    /**
     * Handle status change
     */
    async handleStatusChange(event) {
        const { emailId, oldStatus, newStatus, userId } = event.data;
        logger.info(`Status changed for email ${emailId}: ${oldStatus} -> ${newStatus}`);
        try {
            // Update email status
            await this.emailService.updateEmailStatus(emailId, newStatus);
            // Create audit log entry
            await this.emailService.createAuditLog({
                entityType: 'email',
                entityId: emailId,
                action: 'status_change',
                oldValues: { status: oldStatus },
                newValues: { status: newStatus },
                performedBy: userId || 'system'
            });
        }
        catch (error) {
            logger.error('Failed to update status', 'REAL_TIME_SYNC', {}, error instanceof Error ? error : new Error(String(error)));
        }
    }
    /**
     * Handle batch update
     */
    async handleBatchUpdate(event) {
        const { eventType, count, events } = event.data;
        logger.info(`Processing batch update: ${count} ${eventType} events`);
        // Process individual events without buffering
        for (const subEvent of events) {
            await this.processEvent(subEvent);
        }
    }
    /**
     * Set up WebSocket event listeners
     */
    setupEventListeners() {
        // Listen for WebSocket connections
        this.wsService.on('connection', (ws) => {
            logger.info('New WebSocket connection for real-time sync');
            // Send initial sync status
            ws.send(JSON.stringify({
                type: 'sync_status',
                data: this.getStatistics()
            }));
        });
        // Listen for sync requests via WebSocket
        this.wsService.on('message', async (data) => {
            if (data.type === 'sync_request') {
                await this.publishEvent({
                    type: SyncEventType.SYNC_REQUESTED,
                    source: 'websocket',
                    data: data.payload,
                    metadata: {
                        sessionId: data.sessionId,
                        userId: data.userId
                    }
                });
            }
        });
    }
    /**
     * Set up data flow service listeners
     */
    setupDataFlowListeners() {
        if (!this.dataFlowService)
            return;
        // Listen for sync events
        this.dataFlowService.on('sync:start', () => {
            this.publishEvent({
                type: SyncEventType.SYNC_STARTED,
                source: 'data-flow-service',
                data: {}
            });
        });
        this.dataFlowService.on('sync:complete', (result) => {
            this.publishEvent({
                type: SyncEventType.SYNC_COMPLETED,
                source: 'data-flow-service',
                data: result
            });
        });
        // Listen for new emails
        this.dataFlowService.on('email:created', (email) => {
            this.publishEvent({
                type: SyncEventType.EMAIL_CREATED,
                source: 'data-flow-service',
                data: { email }
            });
        });
    }
    /**
     * Start statistics tracking
     */
    startStatisticsTracking() {
        // Update events per minute
        setInterval(() => {
            const now = Date.now();
            const oneMinuteAgo = now - 60000;
            // Count events in the last minute
            // This is simplified - in production, you'd track timestamps
            this.statistics.eventsPerMinute = Math.floor(this.statistics.eventsProcessed / 10);
        }, 60000); // Every minute
    }
    /**
     * Update average processing time
     */
    updateAverageProcessingTime(newTime) {
        const { averageProcessingTime, eventsProcessed } = this.statistics;
        // Calculate new average
        this.statistics.averageProcessingTime =
            (averageProcessingTime * (eventsProcessed - 1) + newTime) / eventsProcessed;
    }
    /**
     * Generate subscription ID
     */
    generateSubscriptionId() {
        return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    /**
     * Generate correlation ID
     */
    generateCorrelationId() {
        return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    /**
     * Get sync statistics
     */
    getStatistics() {
        return {
            ...this.statistics,
            activeSubscriptions: this.subscriptions.size
        };
    }
    /**
     * Get active subscriptions
     */
    getSubscriptions() {
        return Array.from(this.subscriptions.values()).map(sub => ({
            id: sub.id,
            events: sub.events,
            filter: sub.filter
        }));
    }
    /**
     * Clear all subscriptions
     */
    clearSubscriptions() {
        this.subscriptions.clear();
        this.statistics.activeSubscriptions = 0;
        logger.info('All sync subscriptions cleared');
    }
}
//# sourceMappingURL=RealTimeSyncService.js.map