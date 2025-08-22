/**
 * Optimized Database Connection Pool for CrewAI Team
 * Implements advanced connection pooling with performance monitoring
 */
import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
export class OptimizedConnectionPool extends EventEmitter {
    config;
    connections = new Map();
    waitingQueue = [];
    metrics = {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        waitingQueries: 0,
        totalQueries: 0,
        avgQueryTime: 0,
        slowQueries: 0,
        errors: 0,
        connectionCreations: 0,
        connectionDestructions: 0,
    };
    queryTimes = [];
    cleanupInterval;
    dbPath;
    constructor(dbPath, config = {}) {
        super();
        this.dbPath = dbPath;
        this.config = {
            maxConnections: config.maxConnections ?? 10,
            minConnections: config.minConnections ?? 2,
            connectionTimeout: config.connectionTimeout ?? 30000,
            idleTimeout: config.idleTimeout ?? 300000, // 5 minutes
            retryAttempts: config.retryAttempts ?? 3,
            retryDelay: config.retryDelay ?? 1000,
            enableWAL: config.enableWAL ?? true,
            enableForeignKeys: config.enableForeignKeys ?? true,
            cacheSize: config.cacheSize ?? 10000,
            pragmaSettings: {
                journal_mode: 'WAL',
                synchronous: 'NORMAL',
                cache_size: -10000, // 10MB cache
                temp_store: 'MEMORY',
                mmap_size: 268435456, // 256MB
                optimize: 1,
                ...config.pragmaSettings,
            },
        };
        this.initializePool();
        this.startCleanupRoutine();
    }
    /**
     * Initialize the connection pool with minimum connections
     */
    async initializePool() {
        try {
            for (let i = 0; i < this.config.minConnections; i++) {
                await this.createConnection();
            }
            this.emit('pool-initialized', this.metrics);
        }
        catch (error) {
            this.emit('pool-error', error);
            throw new Error(`Failed to initialize connection pool: ${error}`);
        }
    }
    /**
     * Create a new database connection with optimized settings
     */
    async createConnection() {
        const startTime = Date.now();
        const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        try {
            const db = new Database(this.dbPath, {
                verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
                fileMustExist: false,
            });
            // Apply performance optimizations
            this.applyPragmaSettings(db);
            const connection = {
                db,
                id: connectionId,
                createdAt: new Date(),
                lastUsed: new Date(),
                queryCount: 0,
                isActive: false,
                connectionTime: Date.now() - startTime,
            };
            this.connections.set(connectionId, connection);
            this.metrics.connectionCreations++;
            this.metrics.totalConnections++;
            this.metrics.idleConnections++;
            this.emit('connection-created', { connectionId, connectionTime: connection.connectionTime });
            return connection;
        }
        catch (error) {
            this.metrics.errors++;
            this.emit('connection-error', { connectionId, error });
            throw error;
        }
    }
    /**
     * Apply optimized PRAGMA settings to a connection
     */
    applyPragmaSettings(db) {
        try {
            // Enable foreign keys if configured
            if (this.config.enableForeignKeys) {
                db.pragma('foreign_keys = ON');
            }
            // Apply all pragma settings
            Object.entries(this.config.pragmaSettings).forEach(([key, value]) => {
                db.pragma(`${key} = ${value}`);
            });
            // Verify WAL mode is enabled
            if (this.config.enableWAL) {
                const journalMode = db.pragma('journal_mode', { simple: true });
                if (journalMode !== 'wal') {
                    console.warn(`WAL mode not enabled, current mode: ${journalMode}`);
                }
            }
        }
        catch (error) {
            console.warn('Failed to apply some PRAGMA settings:', error);
        }
    }
    /**
     * Get a connection from the pool
     */
    async getConnection() {
        return new Promise((resolve, reject) => {
            // Find available idle connection
            const idleConnection = Array.from(this.connections.values())
                .find(conn => !conn.isActive);
            if (idleConnection) {
                this.activateConnection(idleConnection);
                resolve(idleConnection);
                return;
            }
            // Create new connection if under limit
            if (this.connections.size < this.config.maxConnections) {
                this.createConnection()
                    .then(connection => {
                    this.activateConnection(connection);
                    resolve(connection);
                })
                    .catch(reject);
                return;
            }
            // Queue the request
            this.waitingQueue.push({
                resolve,
                reject,
                timestamp: new Date(),
            });
            this.metrics.waitingQueries++;
            // Set timeout for waiting requests
            setTimeout(() => {
                const index = this.waitingQueue.findIndex(req => req.resolve === resolve);
                if (index !== -1) {
                    this.waitingQueue.splice(index, 1);
                    this.metrics.waitingQueries--;
                    reject(new Error('Connection timeout: No connection available'));
                }
            }, this.config.connectionTimeout);
        });
    }
    /**
     * Release a connection back to the pool
     */
    releaseConnection(connection) {
        if (!this.connections.has(connection.id)) {
            console.warn(`Attempted to release unknown connection: ${connection.id}`);
            return;
        }
        connection.isActive = false;
        connection.lastUsed = new Date();
        this.metrics.activeConnections--;
        this.metrics.idleConnections++;
        // Process waiting queue
        if (this.waitingQueue.length > 0) {
            const waitingRequest = this.waitingQueue.shift();
            this.metrics.waitingQueries--;
            this.activateConnection(connection);
            waitingRequest.resolve(connection);
        }
        this.emit('connection-released', { connectionId: connection.id });
    }
    /**
     * Execute a query with automatic connection management
     */
    async executeQuery(query, params = [], options = {}) {
        const startTime = Date.now();
        let connection = null;
        try {
            connection = await this.getConnection();
            // Prepare statement for reuse if specified
            let result;
            if (options.prepare) {
                const stmt = connection.db.prepare(query);
                result = stmt.all(params);
            }
            else {
                result = connection.db.prepare(query).all(params);
            }
            // Update metrics
            const queryTime = Date.now() - startTime;
            this.updateQueryMetrics(queryTime);
            connection.queryCount++;
            this.emit('query-executed', {
                connectionId: connection.id,
                queryTime,
                query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
            });
            return result;
        }
        catch (error) {
            this.metrics.errors++;
            this.emit('query-error', { error, query: query.substring(0, 100) });
            throw error;
        }
        finally {
            if (connection) {
                this.releaseConnection(connection);
            }
        }
    }
    /**
     * Execute a transaction with automatic rollback on error
     */
    async executeTransaction(callback) {
        const connection = await this.getConnection();
        try {
            const result = connection.db.transaction(() => {
                return callback(connection.db);
            })();
            this.emit('transaction-completed', { connectionId: connection.id });
            return result;
        }
        catch (error) {
            this.metrics.errors++;
            this.emit('transaction-error', { connectionId: connection.id, error });
            throw error;
        }
        finally {
            this.releaseConnection(connection);
        }
    }
    /**
     * Get pool performance metrics
     */
    getMetrics() {
        const sortedTimes = [...this.queryTimes].sort((a, b) => a - b);
        const queryTimePercentiles = {
            p50: this.getPercentile(sortedTimes, 0.5),
            p90: this.getPercentile(sortedTimes, 0.9),
            p95: this.getPercentile(sortedTimes, 0.95),
            p99: this.getPercentile(sortedTimes, 0.99),
        };
        return {
            ...this.metrics,
            queryTimePercentiles,
        };
    }
    /**
     * Get detailed connection information
     */
    getConnectionInfo() {
        return Array.from(this.connections.values()).map(conn => ({
            id: conn.id,
            createdAt: conn.createdAt,
            lastUsed: conn.lastUsed,
            queryCount: conn.queryCount,
            isActive: conn.isActive,
            connectionTime: conn.connectionTime,
        }));
    }
    /**
     * Optimize database (run ANALYZE and PRAGMA optimize)
     */
    async optimizeDatabase() {
        const connection = await this.getConnection();
        try {
            connection.db.exec('ANALYZE');
            connection.db.pragma('optimize');
            this.emit('database-optimized');
        }
        finally {
            this.releaseConnection(connection);
        }
    }
    /**
     * Close all connections and clean up
     */
    async close() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        // Close all connections
        for (const connection of this.connections.values()) {
            try {
                connection.db.close();
                this.metrics.connectionDestructions++;
            }
            catch (error) {
                console.warn(`Error closing connection ${connection.id}:`, error);
            }
        }
        this.connections.clear();
        this.waitingQueue.forEach(req => req.reject(new Error('Connection pool closed')));
        this.waitingQueue.length = 0;
        this.emit('pool-closed', this.metrics);
    }
    /**
     * Private helper methods
     */
    activateConnection(connection) {
        connection.isActive = true;
        connection.lastUsed = new Date();
        this.metrics.activeConnections++;
        this.metrics.idleConnections--;
    }
    updateQueryMetrics(queryTime) {
        this.metrics.totalQueries++;
        this.queryTimes.push(queryTime);
        // Keep only last 1000 query times for percentile calculation
        if (this.queryTimes.length > 1000) {
            this.queryTimes.shift();
        }
        // Update average query time
        const totalTime = this.queryTimes.reduce((sum, time) => sum + time, 0);
        this.metrics.avgQueryTime = totalTime / this.queryTimes.length;
        // Count slow queries (>1 second)
        if (queryTime > 1000) {
            this.metrics.slowQueries++;
        }
    }
    getPercentile(sortedArray, percentile) {
        if (sortedArray.length === 0)
            return 0;
        const index = Math.ceil(sortedArray.length * percentile) - 1;
        return sortedArray[Math.max(0, index)] || 0;
    }
    startCleanupRoutine() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupIdleConnections();
        }, 60000); // Run every minute
    }
    cleanupIdleConnections() {
        const now = new Date();
        const connectionsToClose = [];
        for (const [id, connection] of this.connections.entries()) {
            if (!connection.isActive &&
                (now.getTime() - connection.lastUsed.getTime()) > this.config.idleTimeout &&
                this.connections.size > this.config.minConnections) {
                connectionsToClose.push(id);
            }
        }
        connectionsToClose.forEach(id => {
            const connection = this.connections.get(id);
            if (connection) {
                try {
                    connection.db.close();
                    this.connections.delete(id);
                    this.metrics.totalConnections--;
                    this.metrics.idleConnections--;
                    this.metrics.connectionDestructions++;
                    this.emit('connection-cleaned', { connectionId: id });
                }
                catch (error) {
                    console.warn(`Error cleaning up connection ${id}:`, error);
                }
            }
        });
    }
}
// Factory function for creating optimized pool instances
export function createOptimizedPool(dbPath, config) {
    return new OptimizedConnectionPool(dbPath, config);
}
