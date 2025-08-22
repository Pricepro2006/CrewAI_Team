/**
 * Database Error Handler
 * Secure error handling to prevent database structure exposure
 */
import { logger } from "../../utils/logger.js";
export class DatabaseSecurityError extends Error {
    code;
    originalError;
    constructor(message, code, originalError) {
        super(message);
        this.code = code;
        this.originalError = originalError;
        this.name = "DatabaseSecurityError";
    }
}
/**
 * Database Error Handler Class
 */
export class DatabaseErrorHandler {
    // Patterns that indicate database structure exposure
    static SENSITIVE_PATTERNS = [
        /table\s+['"`]?(\w+)['"`]?\s+(doesn't exist|not found)/i,
        /column\s+['"`]?(\w+)['"`]?\s+(doesn't exist|not found|unknown)/i,
        /database\s+['"`]?(\w+)['"`]?\s+(doesn't exist|not found)/i,
        /schema\s+['"`]?(\w+)['"`]?\s+(doesn't exist|not found)/i,
        /constraint\s+['"`]?(\w+)['"`]?\s+(violation|failed)/i,
        /foreign\s+key\s+constraint/i,
        /unique\s+constraint/i,
        /primary\s+key\s+constraint/i,
        /check\s+constraint/i,
        /syntax\s+error\s+near/i,
        /sqlite_master/i,
        /sqlite_sequence/i,
        /information_schema/i,
        /sys\.(tables|columns|databases)/i,
        /PRAGMA\s+/i,
        /DESCRIBE\s+/i,
        /SHOW\s+(TABLES|COLUMNS|DATABASES)/i,
        /ALTER\s+TABLE/i,
        /CREATE\s+TABLE/i,
        /DROP\s+TABLE/i,
    ];
    // Common database error codes and their user-friendly messages
    static ERROR_CODE_MAPPINGS = {
        // SQLite error codes
        SQLITE_CONSTRAINT: "The operation violates a data constraint",
        SQLITE_CONSTRAINT_UNIQUE: "This record already exists",
        SQLITE_CONSTRAINT_FOREIGNKEY: "Referenced data not found",
        SQLITE_CONSTRAINT_NOTNULL: "Required field is missing",
        SQLITE_CONSTRAINT_CHECK: "Invalid data provided",
        SQLITE_READONLY: "Database is in read-only mode",
        SQLITE_LOCKED: "Database is temporarily unavailable",
        SQLITE_BUSY: "Database is busy, please try again",
        SQLITE_NOTFOUND: "Requested data not found",
        SQLITE_NOMEM: "Insufficient memory available",
        SQLITE_IOERR: "Database file error",
        SQLITE_CORRUPT: "Database corruption detected",
        // Generic error codes
        ENOENT: "Database file not found",
        EACCES: "Database access denied",
        EPERM: "Database operation not permitted",
        EMFILE: "Too many database connections",
        ENFILE: "System limit reached",
        ENOSPC: "Insufficient disk space",
    };
    /**
     * Process and sanitize database errors
     */
    static handleError(error, context = {}) {
        const originalMessage = error.message || "Unknown database error";
        const errorCode = this.extractErrorCode(error);
        // Check if error contains sensitive information
        const isSensitive = this.containsSensitiveInformation(originalMessage);
        // Create sanitized user message
        const userMessage = this.createUserFriendlyMessage(originalMessage, errorCode, isSensitive);
        // Determine log level based on error type
        const logLevel = this.determineLogLevel(error, errorCode);
        // Log the full error details for debugging (server-side only)
        this.logError(error, context, {
            originalMessage,
            userMessage,
            isSensitive,
            errorCode,
        });
        return {
            message: originalMessage,
            code: errorCode,
            details: isSensitive ? undefined : this.extractSafeDetails(error),
            isSensitive,
            userMessage,
            logLevel,
        };
    }
    /**
     * Check if error message contains sensitive database information
     */
    static containsSensitiveInformation(message) {
        return this?.SENSITIVE_PATTERNS?.some((pattern) => pattern.test(message));
    }
    /**
     * Extract error code from various error types
     */
    static extractErrorCode(error) {
        // Check for SQLite error codes
        if ("code" in error && typeof error.code === "string") {
            return error.code;
        }
        // Check for errno property
        if ("errno" in error && typeof error.errno === "number") {
            return `ERRNO_${error.errno}`;
        }
        // Extract from message patterns
        const codeMatch = error?.message?.match(/\b(SQLITE_\w+|ENOENT|EACCES|EPERM|EMFILE|ENFILE|ENOSPC)\b/i);
        if (codeMatch) {
            return codeMatch[1].toUpperCase();
        }
        return undefined;
    }
    /**
     * Create user-friendly error message
     */
    static createUserFriendlyMessage(originalMessage, errorCode, isSensitive = false) {
        // Use predefined mapping if available
        if (errorCode && this.ERROR_CODE_MAPPINGS[errorCode]) {
            return this.ERROR_CODE_MAPPINGS[errorCode];
        }
        // If error contains sensitive information, use generic message
        if (isSensitive) {
            return "A database error occurred. Please contact support if the problem persists.";
        }
        // For non-sensitive errors, provide more specific but safe messages
        if (originalMessage.toLowerCase().includes("not found")) {
            return "The requested data was not found.";
        }
        if (originalMessage.toLowerCase().includes("already exists")) {
            return "This record already exists.";
        }
        if (originalMessage.toLowerCase().includes("constraint")) {
            return "The operation violates data constraints.";
        }
        if (originalMessage.toLowerCase().includes("permission") ||
            originalMessage.toLowerCase().includes("access")) {
            return "Access denied for this operation.";
        }
        if (originalMessage.toLowerCase().includes("timeout") ||
            originalMessage.toLowerCase().includes("busy")) {
            return "The database is temporarily unavailable. Please try again.";
        }
        if (originalMessage.toLowerCase().includes("connection")) {
            return "Database connection error. Please try again.";
        }
        // Default generic message for unknown errors
        return "A database operation failed. Please contact support if the problem persists.";
    }
    /**
     * Determine appropriate log level for error
     */
    static determineLogLevel(error, errorCode) {
        // Critical errors that need immediate attention
        const criticalCodes = [
            "SQLITE_CORRUPT",
            "SQLITE_IOERR",
            "SQLITE_NOMEM",
            "ENOSPC",
        ];
        if (errorCode && criticalCodes.includes(errorCode)) {
            return "error";
        }
        // Warning level for business logic errors
        const warningCodes = [
            "SQLITE_CONSTRAINT",
            "SQLITE_CONSTRAINT_UNIQUE",
            "SQLITE_CONSTRAINT_FOREIGNKEY",
            "SQLITE_CONSTRAINT_NOTNULL",
            "SQLITE_CONSTRAINT_CHECK",
        ];
        if (errorCode && warningCodes.includes(errorCode)) {
            return "warn";
        }
        // Informational for expected errors (like not found)
        if (errorCode === "SQLITE_NOTFOUND" ||
            error?.message?.toLowerCase().includes("not found")) {
            return "info";
        }
        // Default to error for unknown issues
        return "error";
    }
    /**
     * Extract safe details from error that can be shared with client
     */
    static extractSafeDetails(error) {
        const safeDetails = {};
        // Add timestamp
        safeDetails.timestamp = new Date().toISOString();
        // Add error type
        safeDetails.type = error?.constructor?.name;
        // Add safe properties
        if ("errno" in error && typeof error.errno === "number") {
            safeDetails.errno = error.errno;
        }
        return safeDetails;
    }
    /**
     * Log error with appropriate level and context
     */
    static logError(error, context, errorInfo) {
        const logContext = {
            ...context,
            errorType: error?.constructor?.name,
            errorCode: errorInfo.errorCode,
            isSensitive: errorInfo.isSensitive,
            userMessage: errorInfo.userMessage,
            stack: error.stack,
        };
        switch (errorInfo.isSensitive) {
            case true:
                logger.error("Sensitive Database Error", "DATABASE_SECURITY", {
                    ...logContext,
                    originalMessage: errorInfo.originalMessage,
                });
                break;
            default:
                logger[this.determineLogLevel(error, errorInfo.errorCode)]("Database Error", "DATABASE", logContext);
        }
    }
    /**
     * Create safe error response for API
     */
    static createAPIErrorResponse(error, context = {}) {
        const handledError = this.handleError(error, context);
        return {
            success: false,
            error: {
                message: handledError.userMessage,
                code: handledError.isSensitive ? "DATABASE_ERROR" : handledError.code,
                details: handledError.isSensitive ? undefined : handledError.details,
            },
        };
    }
    /**
     * Validate that error handling is working correctly
     */
    static validateErrorHandling(testErrors) {
        const results = [];
        let passed = 0;
        let failed = 0;
        for (const test of testErrors) {
            const handled = this.handleError(test.error);
            const isSafe = !this.containsSensitiveInformation(handled.userMessage);
            if (isSafe === test.expectedSafe) {
                passed++;
                results.push({
                    error: test?.error?.message,
                    passed: true,
                });
            }
            else {
                failed++;
                results.push({
                    error: test?.error?.message,
                    passed: false,
                    reason: `Expected safe: ${test.expectedSafe}, got: ${isSafe}`,
                });
            }
        }
        return { passed, failed, results };
    }
}
/**
 * Create wrapper for database operations with error handling
 */
export function withDatabaseErrorHandling(operation, context) {
    return async (...args) => {
        try {
            return await operation(...args);
        }
        catch (error) {
            const dbError = DatabaseErrorHandler.handleError(error instanceof Error ? error : new Error(String(error)), {
                operation: context.operationName,
                table: context.table,
                userId: context.userId,
            });
            // Re-throw with sanitized message for API consumption
            const sanitizedError = new DatabaseSecurityError(dbError.userMessage, dbError.code, error instanceof Error ? error : undefined);
            throw sanitizedError;
        }
    };
}
/**
 * Middleware to handle database errors in Express/tRPC
 */
export function createDatabaseErrorMiddleware() {
    return (error, context = {}) => {
        const handledError = DatabaseErrorHandler.handleError(error, context);
        if (handledError.isSensitive) {
            // Don't expose sensitive database information
            throw new Error(handledError.userMessage);
        }
        // For non-sensitive errors, we can provide more detail
        const enhancedError = new Error(handledError.userMessage);
        if (handledError.code) {
            enhancedError.code = handledError.code;
        }
        if (handledError.details) {
            enhancedError.details = handledError.details;
        }
        throw enhancedError;
    };
}
// Export singleton instance
export const databaseErrorHandler = DatabaseErrorHandler;
