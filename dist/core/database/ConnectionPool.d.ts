import Database from "better-sqlite3";
import { EventEmitter } from "events";
/**
 * Connection pool configuration options
 */
export interface PoolConfig {
    filename: string;
    poolSize?: number;
    maxIdleTime?: number;
    checkpointInterval?: number;
    walSizeLimit?: number;
    enableWAL?: boolean;
    readonly?: boolean;
    verbose?: boolean;
}
/**
 * Connection pool for better-sqlite3 with WAL mode support
 *
 * Implements best practices for SQLite connection pooling:
 * - WAL mode for concurrent readers
 * - Automatic checkpointing to prevent WAL file growth
 * - Connection recycling based on idle time
 * - Performance monitoring and statistics
 */
export declare class ConnectionPool extends EventEmitter {
    private config;
    private connections;
    private availableConnections;
    private checkpointInterval?;
    private maintenanceInterval?;
    private stats;
    constructor(config: PoolConfig);
    private initialize;
    /**
     * Create a new database connection
     */
    private createConnection;
    /**
     * Acquire a connection from the pool
     */
    acquire(): Promise<Database.Database>;
    /**
     * Release a connection back to the pool
     */
    release(db: Database.Database): void;
    private releaseConnection;
    /**
     * Execute a query with automatic connection management
     */
    execute<T>(fn: (db: Database.Database) => T, options?: {
        retries?: number;
    }): Promise<T>;
    /**
     * Start checkpoint monitoring for WAL mode
     */
    private startCheckpointMonitoring;
    /**
     * Start connection maintenance routine
     */
    private startMaintenanceRoutine;
    /**
     * Get pool statistics
     */
    getStats(): {
        poolSize: number;
        activeConnections: number;
        availableConnections: number;
        totalQueries: number;
        checkpoints: number;
        recycledConnections: number;
        connectionDetails: Array<{
            id: string;
            inUse: boolean;
            queryCount: number;
            idleTime: number;
            lifetime: number;
        }>;
    };
    /**
     * Close all connections and clean up
     */
    close(): void;
}
//# sourceMappingURL=ConnectionPool.d.ts.map