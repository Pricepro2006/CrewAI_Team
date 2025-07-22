/**
 * Comprehensive logging system for CrewAI Team
 */
import { promises as fs } from 'fs';
import path from 'path';
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
    LogLevel[LogLevel["FATAL"] = 4] = "FATAL";
})(LogLevel || (LogLevel = {}));
export class Logger {
    constructor() {
        this.logQueue = [];
        this.isWriting = false;
        this.logDir = path.join(process.cwd(), 'data', 'logs');
        this.logLevel = process.env['LOG_LEVEL'] === 'debug' ? LogLevel.DEBUG : LogLevel.INFO;
        this.enableConsole = process.env['NODE_ENV'] !== 'production';
        this.enableFile = true;
        this.ensureLogDirectory();
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    async ensureLogDirectory() {
        try {
            await fs.mkdir(this.logDir, { recursive: true });
        }
        catch (error) {
            console.error('Failed to create log directory:', error);
        }
    }
    formatLogEntry(entry) {
        const levelName = LogLevel[entry.level].padEnd(5);
        const component = entry.component ? `[${entry.component}]` : '';
        const metadata = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
        let formatted = `${entry.timestamp} ${levelName} ${component} ${entry.message}${metadata}`;
        if (entry.stack) {
            formatted += `\n${entry.stack}`;
        }
        return formatted;
    }
    getLogColor(level) {
        switch (level) {
            case LogLevel.DEBUG: return '\x1b[36m'; // Cyan
            case LogLevel.INFO: return '\x1b[32m'; // Green
            case LogLevel.WARN: return '\x1b[33m'; // Yellow
            case LogLevel.ERROR: return '\x1b[31m'; // Red
            case LogLevel.FATAL: return '\x1b[35m'; // Magenta
            default: return '\x1b[0m';
        }
    }
    async writeToFile(entry) {
        if (!this.enableFile)
            return;
        const logFileName = this.getLogFileName(entry.level);
        const logPath = path.join(this.logDir, logFileName);
        const formatted = this.formatLogEntry(entry) + '\n';
        try {
            await fs.appendFile(logPath, formatted);
        }
        catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }
    getLogFileName(level) {
        switch (level) {
            case LogLevel.DEBUG: return 'debug.log';
            case LogLevel.INFO: return 'app.log';
            case LogLevel.WARN: return 'app.log';
            case LogLevel.ERROR: return 'error.log';
            case LogLevel.FATAL: return 'error.log';
            default: return 'app.log';
        }
    }
    writeToConsole(entry) {
        if (!this.enableConsole)
            return;
        const color = this.getLogColor(entry.level);
        const reset = '\x1b[0m';
        const formatted = this.formatLogEntry(entry);
        console.log(`${color}${formatted}${reset}`);
    }
    async processLogQueue() {
        if (this.isWriting || this.logQueue.length === 0)
            return;
        this.isWriting = true;
        const batch = this.logQueue.splice(0, 100); // Process in batches
        for (const entry of batch) {
            await this.writeToFile(entry);
        }
        this.isWriting = false;
        // Process remaining queue
        if (this.logQueue.length > 0) {
            setImmediate(() => this.processLogQueue());
        }
    }
    log(level, message, component, metadata, error) {
        if (level < this.logLevel)
            return;
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...(component && { component }),
            ...(metadata && { metadata }),
            ...(error?.stack && { stack: error.stack })
        };
        this.writeToConsole(entry);
        this.logQueue.push(entry);
        this.processLogQueue();
    }
    debug(message, component, metadata) {
        this.log(LogLevel.DEBUG, message, component, metadata);
    }
    info(message, component, metadata) {
        this.log(LogLevel.INFO, message, component, metadata);
    }
    warn(message, component, metadata) {
        this.log(LogLevel.WARN, message, component, metadata);
    }
    error(message, component, metadata, error) {
        this.log(LogLevel.ERROR, message, component, metadata, error);
    }
    fatal(message, component, metadata, error) {
        this.log(LogLevel.FATAL, message, component, metadata, error);
    }
    // Specialized logging methods
    agentActivity(agentType, action, metadata) {
        this.info(`Agent ${agentType}: ${action}`, 'AGENT', metadata);
    }
    systemHealth(component, status, message) {
        const level = status === 'healthy' ? LogLevel.INFO : status === 'degraded' ? LogLevel.WARN : LogLevel.ERROR;
        this.log(level, `System health: ${component} is ${status}${message ? ` - ${message}` : ''}`, 'HEALTH');
    }
    llmCall(model, prompt, response, metadata) {
        this.debug(`LLM Call: ${model}`, 'LLM', {
            prompt: prompt.substring(0, 200),
            response: response.substring(0, 200),
            ...metadata
        });
    }
    ragQuery(query, resultsCount, metadata) {
        this.debug(`RAG Query: ${query}`, 'RAG', {
            resultsCount,
            ...metadata
        });
    }
    toolExecution(toolName, parameters, result, duration) {
        this.info(`Tool executed: ${toolName}`, 'TOOL', {
            parameters,
            success: result.success,
            duration: `${duration}ms`
        });
    }
    async flush() {
        while (this.logQueue.length > 0 || this.isWriting) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
}
// Global logger instance
export const logger = Logger.getInstance();
// Error handling middleware
export function createErrorHandler(component) {
    return (error, context) => {
        logger.error(`Unhandled error in ${component}`, component, context, error);
        // In production, you might want to send to external monitoring service
        if (process.env['NODE_ENV'] === 'production') {
            // Send to Sentry, DataDog, etc.
        }
    };
}
// Performance monitoring
export function createPerformanceMonitor(component) {
    return {
        start: (operation) => {
            const startTime = Date.now();
            return {
                end: (metadata) => {
                    const duration = Date.now() - startTime;
                    logger.debug(`Performance: ${operation} took ${duration}ms`, component, metadata);
                    // Alert if operation takes too long
                    if (duration > 10000) { // 10 seconds
                        logger.warn(`Slow operation detected: ${operation} took ${duration}ms`, component, metadata);
                    }
                }
            };
        }
    };
}
// Async error wrapper
export function withErrorHandling(fn, component, operation) {
    return async (...args) => {
        const errorHandler = createErrorHandler(component);
        const perf = createPerformanceMonitor(component);
        const perfMonitor = perf.start(operation);
        try {
            const result = await fn(...args);
            perfMonitor.end({ success: true });
            return result;
        }
        catch (error) {
            perfMonitor.end({ success: false });
            errorHandler(error, { operation, args });
            throw error;
        }
    };
}
