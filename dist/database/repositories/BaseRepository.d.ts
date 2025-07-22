/**
 * Base Repository Pattern Implementation
 * Provides common database operations with proper error handling and performance optimization
 */
import type Database from 'better-sqlite3';
export interface BaseEntity {
    id: string;
    created_at?: string;
    updated_at?: string;
}
export interface QueryOptions {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
    where?: Record<string, any>;
}
export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
}
export declare abstract class BaseRepository<T extends BaseEntity> {
    protected db: Database.Database;
    protected tableName: string;
    protected primaryKey: string;
    constructor(db: Database.Database, tableName: string);
    /**
     * Generate a new UUID for entity ID
     */
    protected generateId(): string;
    /**
     * Build WHERE clause from conditions object
     */
    protected buildWhereClause(conditions: Record<string, any>): {
        clause: string;
        params: any[];
    };
    /**
     * Build ORDER BY clause
     */
    protected buildOrderClause(orderBy?: string, orderDirection?: 'ASC' | 'DESC'): string;
    /**
     * Sanitize column name to prevent SQL injection
     */
    protected sanitizeColumnName(columnName: string): string;
    /**
     * Execute a query with performance monitoring
     */
    protected executeQuery<R = any>(query: string, params?: any[], operation?: 'get' | 'all' | 'run'): R;
    /**
     * Find entity by ID
     */
    findById(id: string): Promise<T | null>;
    /**
     * Find all entities with optional filtering and pagination
     */
    findAll(options?: QueryOptions): Promise<T[]>;
    /**
     * Find entities with pagination
     */
    findPaginated(page?: number, pageSize?: number, options?: Omit<QueryOptions, 'limit' | 'offset'>): Promise<PaginatedResult<T>>;
    /**
     * Find one entity by conditions
     */
    findOne(conditions: Record<string, any>): Promise<T | null>;
    /**
     * Count entities with optional filtering
     */
    count(conditions?: Record<string, any>): Promise<number>;
    /**
     * Check if entity exists
     */
    exists(conditions: Record<string, any>): Promise<boolean>;
    /**
     * Create a new entity
     */
    create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T>;
    /**
     * Update an entity by ID
     */
    update(id: string, data: Partial<Omit<T, 'id' | 'created_at'>>): Promise<T | null>;
    /**
     * Delete an entity by ID
     */
    delete(id: string): Promise<boolean>;
    /**
     * Delete multiple entities by conditions
     */
    deleteWhere(conditions: Record<string, any>): Promise<number>;
    /**
     * Execute raw SQL query
     */
    raw<R = any>(query: string, params?: any[]): Promise<R>;
    /**
     * Execute a transaction
     */
    transaction<R>(callback: (repo: this) => Promise<R>): Promise<R>;
    /**
     * Bulk insert entities
     */
    bulkCreate(entities: Array<Omit<T, 'id' | 'created_at' | 'updated_at'>>): Promise<T[]>;
    /**
     * Search entities with text-based search
     */
    search(searchTerm: string, searchColumns: string[], options?: QueryOptions): Promise<T[]>;
}
//# sourceMappingURL=BaseRepository.d.ts.map