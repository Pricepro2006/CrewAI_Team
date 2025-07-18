/**
 * Comprehensive logging system for CrewAI Team
 */
export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    FATAL = 4
}
export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    component?: string;
    metadata?: Record<string, any>;
    stack?: string;
}
export declare class Logger {
    private static instance;
    private logDir;
    private logLevel;
    private enableConsole;
    private enableFile;
    private logQueue;
    private isWriting;
    private constructor();
    static getInstance(): Logger;
    private ensureLogDirectory;
    private formatLogEntry;
    private getLogColor;
    private writeToFile;
    private getLogFileName;
    private writeToConsole;
    private processLogQueue;
    private log;
    debug(message: string, component?: string, metadata?: Record<string, any>): void;
    info(message: string, component?: string, metadata?: Record<string, any>): void;
    warn(message: string, component?: string, metadata?: Record<string, any>): void;
    error(message: string, component?: string, metadata?: Record<string, any>, error?: Error): void;
    fatal(message: string, component?: string, metadata?: Record<string, any>, error?: Error): void;
    agentActivity(agentType: string, action: string, metadata?: Record<string, any>): void;
    systemHealth(component: string, status: 'healthy' | 'degraded' | 'unhealthy', message?: string): void;
    llmCall(model: string, prompt: string, response: string, metadata?: Record<string, any>): void;
    ragQuery(query: string, resultsCount: number, metadata?: Record<string, any>): void;
    toolExecution(toolName: string, parameters: any, result: any, duration: number): void;
    flush(): Promise<void>;
}
export declare const logger: Logger;
export declare function createErrorHandler(component: string): (error: Error, context?: Record<string, any>) => void;
export declare function createPerformanceMonitor(component: string): {
    start: (operation: string) => {
        end: (metadata?: Record<string, any>) => void;
    };
};
export declare function withErrorHandling<T extends any[], R>(fn: (...args: T) => Promise<R>, component: string, operation: string): (...args: T) => Promise<R>;
//# sourceMappingURL=logger.d.ts.map