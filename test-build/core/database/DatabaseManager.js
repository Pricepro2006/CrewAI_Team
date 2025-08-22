import Database from 'better-sqlite3';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
class DatabaseConnection {
    db;
    disposed = false;
    metrics;
    constructor(dbPath, options) {
        this.db = new Database(dbPath, {
            ...options,
            verbose: config.get('NODE_ENV') === 'development' ?
                (message) => logger.debug(`[SQLite] ${message}`) : undefined
        });
        this.metrics = {
            id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date(),
            lastUsed: new Date(),
            queryCount: 0,
            totalQueryTime: 0,
            averageQueryTime: 0
        };
        this.setupDatabase();
    }
    setupDatabase() {
        // Enable foreign keys
        this.db.pragma('foreign_keys = ON');
        // Optimize for performance
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('cache_size = 10000');
        this.db.pragma('page_size = 4096');
        this.db.pragma('temp_store = MEMORY');
        this.db.pragma('mmap_size = 268435456'); // 256MB memory map
        // Auto-vacuum to prevent database bloat
        this.db.pragma('auto_vacuum = INCREMENTAL');
        logger.info(`Database connection ${this.metrics.id} established with optimizations`);
    }
    prepare(sql) {
        if (this.disposed) {
            throw new Error(`Connection ${this.metrics.id} has been disposed`);
        }
        return this.db.prepare(sql);
    }
    exec(sql) {
        if (this.disposed) {
            throw new Error(`Connection ${this.metrics.id} has been disposed`);
        }
        this.db.exec(sql);
    }
    transaction(fn) {
        if (this.disposed) {
            throw new Error(`Connection ${this.metrics.id} has been disposed`);
        }
        return this.db.transaction(fn)();
    }
    close() {
        if (!this.disposed) {
            this.db.close();
            this.disposed = true;
            logger.info(`Database connection ${this.metrics.id} closed. Metrics:`, {
                queryCount: this.metrics.queryCount,
                averageQueryTime: this.metrics.averageQueryTime.toFixed(2) + 'ms',
                totalTime: this.metrics.totalQueryTime + 'ms'
            });
        }
    }
    isDisposed() {
        return this.disposed;
    }
    getMetrics() {
        return { ...this.metrics };
    }
    updateMetrics(queryTime) {
        if (this.metrics) {
            this.metrics.queryCount++;
            this.metrics.totalQueryTime += queryTime;
            this.metrics.averageQueryTime = this.metrics.totalQueryTime / this.metrics.queryCount;
            this.metrics.lastUsed = new Date();
        }
    }
    getRawDatabase() {
        if (this.disposed) {
            throw new Error(`Connection ${this.metrics.id} has been disposed`);
        }
        return this.db;
    }
}
class ConnectionPool {
    connections = new Map();
    maxConnections;
    currentIndex = 0;
    constructor(maxConnections = 5) {
        this.maxConnections = maxConnections;
    }
    getConnection(dbPath, options) {
        const key = `${dbPath}-${this.currentIndex % this.maxConnections}`;
        let connection = this.connections.get(key);
        if (!connection || connection.isDisposed()) {
            connection = new DatabaseConnection(dbPath, options);
            this.connections.set(key, connection);
        }
        this.currentIndex++;
        return connection;
    }
    closeAll() {
        for (const connection of this.connections.values()) {
            connection.close();
        }
        this.connections.clear();
        logger.info('All database connections closed');
    }
    getPoolMetrics() {
        const metrics = Array.from(this.connections.values()).map(conn => conn.getMetrics());
        return {
            totalConnections: this.connections.size,
            connections: metrics
        };
    }
}
// Enhanced connection wrapper with automatic error recovery
class EnhancedDatabaseConnection {
    connection;
    dbPath;
    options;
    pool;
    constructor(dbPath, pool, options) {
        this.dbPath = dbPath;
        this.options = options;
        this.pool = pool;
        this.connection = pool.getConnection(dbPath, options);
    }
    execute(queryFn) {
        if (this.disposed) {
            throw new Error(`Connection ${this.metrics?.id} has been disposed`);
        }
        const startTime = Date.now();
        if (this.metrics) {
            this.metrics.lastUsed = new Date();
        }
        try {
            const result = queryFn(this.db);
            const queryTime = Date.now() - startTime;
            if (this.metrics) {
                this.metrics.queryCount++;
                this.metrics.totalQueryTime += queryTime;
            }
            return result;
        }
        catch (error) {
            logger.error(`Query failed on connection ${this.metrics?.id}:`, error);
            throw error;
        }
    }
    get db() {
        return this.connection.getRawDatabase();
    }
    get disposed() {
        return this.connection.isDisposed();
    }
    get metrics() {
        return this.connection?.getMetrics();
    }
    prepare(sql) {
        const startTime = Date.now();
        try {
            const stmt = this.connection.prepare(sql);
            this.connection.updateMetrics(Date.now() - startTime);
            return stmt;
        }
        catch (error) {
            this.handleError(error);
            // Retry once after recovery
            return this.connection.prepare(sql);
        }
    }
    exec(sql) {
        const startTime = Date.now();
        try {
            this.connection.exec(sql);
            this.connection.updateMetrics(Date.now() - startTime);
        }
        catch (error) {
            this.handleError(error);
            // Retry once after recovery
            this.connection.exec(sql);
        }
    }
    transaction(fn) {
        const startTime = Date.now();
        try {
            const result = this.connection.transaction(fn);
            this.connection.updateMetrics(Date.now() - startTime);
            return result;
        }
        catch (error) {
            this.handleError(error);
            // Retry once after recovery
            return this.connection.transaction(fn);
        }
    }
    handleError(error) {
        logger.error('Database operation failed, attempting recovery:', error);
        // Check if connection is still valid
        if (this.connection.isDisposed()) {
            // Get a new connection from the pool
            this.connection = this.pool.getConnection(this.dbPath, this.options);
            logger.info('Recovered with new database connection');
        }
    }
    close() {
        this.connection.close();
    }
    getMetrics() {
        return this.connection.getMetrics();
    }
    getRawDatabase() {
        return this.connection.getRawDatabase();
    }
}
class DatabaseManager {
    static instance;
    pool;
    connections = new Map();
    initialized = false;
    initializationPromises = new Map();
    constructor() {
        this.pool = new ConnectionPool(5);
    }
    static getInstance() {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }
    getConnection(dbName = 'main') {
        const dbPath = this.getDbPath(dbName);
        let connection = this.connections.get(dbName);
        if (!connection) {
            connection = new EnhancedDatabaseConnection(dbPath, this.pool, {
                readonly: false,
                fileMustExist: false
            });
            this.connections.set(dbName, connection);
            // Initialize database schema if needed (async but non-blocking)
            if (!this.initialized && !this.initializationPromises.has(dbName)) {
                const initPromise = this.initializeDatabase(connection, dbName)
                    .then(() => {
                    this.initialized = true;
                })
                    .catch(error => {
                    logger.error('Database initialization failed', 'DATABASE_MANAGER', { dbName, error });
                })
                    .finally(() => {
                    this.initializationPromises.delete(dbName);
                });
                this.initializationPromises.set(dbName, initPromise);
                // Don't wait here - let initialization happen in background
                // Schema creation is idempotent so it's safe
            }
        }
        return connection;
    }
    getDbPath(dbName) {
        const dataDir = join(process.cwd(), 'data');
        if (!existsSync(dataDir)) {
            mkdirSync(dataDir, { recursive: true });
        }
        const dbPaths = {
            main: join(dataDir, 'crewai_enhanced.db'),
            walmart: join(dataDir, 'walmart_grocery.db'),
            basic: join(dataDir, 'basic.db')
        };
        return dbPaths[dbName] || dbPaths.main;
    }
    async initializeDatabase(connection, dbName) {
        if (dbName === 'main') {
            this.initializeMainDatabase(connection);
        }
        else if (dbName === 'walmart') {
            this.initializeWalmartDatabase(connection);
        }
    }
    initializeMainDatabase(connection) {
        try {
            connection.exec(`
      CREATE TABLE IF NOT EXISTS emails (
        id TEXT PRIMARY KEY,
        subject TEXT,
        body TEXT,
        sender TEXT,
        recipients TEXT,
        date TEXT,
        thread_id TEXT,
        chain_id TEXT,
        is_complete_chain BOOLEAN DEFAULT 0,
        phase_1_results TEXT,
        phase_2_results TEXT,
        phase_3_results TEXT,
        processed_at TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_emails_chain_id ON emails(chain_id);
      CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON emails(thread_id);
      CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date);
      CREATE INDEX IF NOT EXISTS idx_emails_complete_chain ON emails(is_complete_chain);

      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'idle',
        last_active DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        agent_id TEXT,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        input TEXT,
        output TEXT,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (agent_id) REFERENCES agents(id)
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_agent_id ON tasks(agent_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      `);
            logger.info('Main database initialized with schema');
        }
        catch (error) {
            // Schema might already exist, log and continue
            logger.info('Main database schema already exists or error creating', { error });
        }
    }
    initializeWalmartDatabase(connection) {
        try {
            connection.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT,
        price REAL,
        quantity INTEGER,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        total REAL,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
      CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
      `);
            logger.info('Walmart database initialized with schema');
        }
        catch (error) {
            // Schema might already exist, log and continue
            logger.info('Walmart database schema already exists or error creating', { error });
        }
    }
    async closeAll() {
        try {
            for (const connection of this.connections.values()) {
                try {
                    connection.close();
                }
                catch (error) {
                    logger.warn('Error closing connection', { error });
                }
            }
            // Wait for any pending initializations
            await Promise.all(Array.from(this.initializationPromises.values()));
            this.connections.clear();
            this.pool.closeAll();
            this.initialized = false;
            this.initializationPromises.clear();
            logger.info('All database connections closed');
        }
        catch (error) {
            logger.error('Error during closeAll', { error });
            throw error;
        }
    }
    getPoolMetrics() {
        return this.pool.getPoolMetrics();
    }
}
export const databaseManager = DatabaseManager.getInstance();
// Convenience export for shutdown
export const shutdownDatabaseManager = async () => {
    try {
        await databaseManager.closeAll();
    }
    catch (error) {
        logger.error('Error shutting down database manager', { error });
        // Don't re-throw to allow graceful shutdown
    }
};
// Export the class and instance
export { DatabaseManager };
export default databaseManager;
