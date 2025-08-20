/**
 * EmailIngestionService - Core service for email ingestion pipeline
 *
 * Supports three operational modes:
 * 1. Manual Load Mode - Batch import from JSON files or databases
 * 2. Auto-Pull Mode - Scheduled pulling from Microsoft Graph/Gmail APIs
 * 3. Hybrid Mode - Concurrent manual and auto operations
 *
 * Features:
 * - 60+ emails/minute processing capability
 * - Deduplication by message_id
 * - Redis queue integration with priority management
 * - Comprehensive error handling and retry logic
 * - Real-time progress tracking
 */
// =====================================================
// Type Definitions
// =====================================================
export var IngestionMode;
(function (IngestionMode) {
    IngestionMode["MANUAL"] = "manual";
    IngestionMode["AUTO_PULL"] = "auto_pull";
    IngestionMode["HYBRID"] = "hybrid";
})(IngestionMode || (IngestionMode = {}));
export var IngestionSource;
(function (IngestionSource) {
    IngestionSource["JSON_FILE"] = "json_file";
    IngestionSource["DATABASE"] = "database";
    IngestionSource["MICROSOFT_GRAPH"] = "microsoft_graph";
    IngestionSource["GMAIL_API"] = "gmail_api";
    IngestionSource["WEBHOOK"] = "webhook";
})(IngestionSource || (IngestionSource = {}));
// =====================================================
// Error Handling
// =====================================================
export class IngestionError extends Error {
    code;
    source;
    retryable;
    originalError;
    constructor(message, code, source, retryable = true, originalError) {
        super(message);
        this.code = code;
        this.source = source;
        this.retryable = retryable;
        this.originalError = originalError;
        this.name = 'IngestionError';
    }
}
export const IngestionErrorCodes = {
    DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
    INVALID_FORMAT: 'INVALID_FORMAT',
    QUEUE_ERROR: 'QUEUE_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    API_ERROR: 'API_ERROR',
    PROCESSING_ERROR: 'PROCESSING_ERROR',
    RATE_LIMIT: 'RATE_LIMIT',
    AUTH_ERROR: 'AUTH_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT'
};
// =====================================================
// Implementation Notes
// =====================================================
/**
 * Implementation Guidelines:
 *
 * 1. Deduplication Strategy:
 *    - Use Redis SET with TTL for message ID tracking
 *    - Hash message IDs for consistent storage
 *    - Implement sliding window for deduplication
 *
 * 2. Priority Calculation:
 *    - Base priority on email importance flag
 *    - Boost for keywords (urgent, critical, etc.)
 *    - Consider sender domain reputation
 *    - Factor in email age (older = higher priority)
 *
 * 3. Error Handling:
 *    - Exponential backoff for retries
 *    - Dead letter queue for permanent failures
 *    - Circuit breaker for API sources
 *    - Graceful degradation for non-critical errors
 *
 * 4. Performance Optimization:
 *    - Batch database operations
 *    - Connection pooling for APIs
 *    - Parallel processing where possible
 *    - Memory-efficient streaming for large batches
 *
 * 5. Monitoring:
 *    - Real-time metrics via WebSocket
 *    - Prometheus-compatible metrics
 *    - Structured logging with context
 *    - Alert thresholds for queue health
 */
// Additional exports for external use (types and interfaces already declared with export keyword)
// The enums IngestionMode, IngestionSource, class IngestionError, and const IngestionErrorCodes 
// are already exported via their export keywords above
