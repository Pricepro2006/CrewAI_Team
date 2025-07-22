/**
 * Base Repository Pattern Implementation
 * Provides common database operations with proper error handling and performance optimization
 */
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
export class BaseRepository {
    db;
    tableName;
    primaryKey = 'id';
    constructor(db, tableName) {
        this.db = db;
        this.tableName = tableName;
    }
    /**
     * Generate a new UUID for entity ID
     */
    generateId() {
        return uuidv4();
    }
    /**
     * Build WHERE clause from conditions object
     */
    buildWhereClause(conditions) {
        if (!conditions || Object.keys(conditions).length === 0) {
            return { clause: '', params: [] };
        }
        const clauses = [];
        const params = [];
        for (const [key, value] of Object.entries(conditions)) {
            if (value === null || value === undefined) {
                clauses.push(`${key} IS NULL`);
            }
            else if (Array.isArray(value)) {
                const placeholders = value.map(() => '?').join(',');
                clauses.push(`${key} IN (${placeholders})`);
                params.push(...value);
            }
            else if (typeof value === 'object' && value.operator) {
                // Support for complex conditions like { operator: '>', value: 100 }
                clauses.push(`${key} ${value.operator} ?`);
                params.push(value.value);
            }
            else {
                clauses.push(`${key} = ?`);
                params.push(value);
            }
        }
        return {
            clause: `WHERE ${clauses.join(' AND ')}`,
            params
        };
    }
    /**
     * Build ORDER BY clause
     */
    buildOrderClause(orderBy, orderDirection = 'ASC') {
        if (!orderBy) {
            return `ORDER BY ${this.primaryKey} ASC`;
        }
        // Sanitize column name to prevent SQL injection
        const sanitizedColumn = this.sanitizeColumnName(orderBy);
        return `ORDER BY ${sanitizedColumn} ${orderDirection}`;
    }
    /**
     * Sanitize column name to prevent SQL injection
     */
    sanitizeColumnName(columnName) {
        // Only allow alphanumeric characters, underscores, and dots
        return columnName.replace(/[^a-zA-Z0-9_.]/g, '');
    }
    /**
     * Execute a query with performance monitoring
     */
    executeQuery(query, params = [], operation = 'all') {
        const startTime = Date.now();
        try {
            const stmt = this.db.prepare(query);
            let result;
            switch (operation) {
                case 'get':
                    result = stmt.get(...params);
                    break;
                case 'run':
                    result = stmt.run(...params);
                    break;
                default:
                    result = stmt.all(...params);
            }
            const executionTime = Date.now() - startTime;
            if (executionTime > 1000) { // Log slow queries
                logger.warn(`Slow query detected (${executionTime}ms): ${query}`, 'DATABASE');
            }
            return result;
        }
        catch (error) {
            logger.error(`Database query failed: ${error}. Query: ${query}`, 'DATABASE');
            throw error;
        }
    }
    /**
     * Find entity by ID
     */
    async findById(id) {
        const query = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
        const result = this.executeQuery(query, [id], 'get');
        return result || null;
    }
    /**
     * Find all entities with optional filtering and pagination
     */
    async findAll(options = {}) {
        const { limit, offset, orderBy, orderDirection, where } = options;
        const { clause: whereClause, params: whereParams } = this.buildWhereClause(where || {});
        const orderClause = this.buildOrderClause(orderBy, orderDirection);
        let query = `SELECT * FROM ${this.tableName} ${whereClause} ${orderClause}`;
        const params = [...whereParams];
        if (limit !== undefined) {
            query += ' LIMIT ?';
            params.push(limit);
            if (offset !== undefined) {
                query += ' OFFSET ?';
                params.push(offset);
            }
        }
        return this.executeQuery(query, params);
    }
    /**
     * Find entities with pagination
     */
    async findPaginated(page = 1, pageSize = 50, options = {}) {
        const offset = (page - 1) * pageSize;
        // Get total count
        const { clause: whereClause, params: whereParams } = this.buildWhereClause(options.where || {});
        const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`;
        const countResult = this.executeQuery(countQuery, whereParams, 'get');
        const total = countResult?.total || 0;
        // Get paginated data
        const data = await this.findAll({
            ...options,
            limit: pageSize,
            offset
        });
        const totalPages = Math.ceil(total / pageSize);
        return {
            data,
            total,
            page,
            pageSize,
            totalPages,
            hasNext: page < totalPages,
            hasPrevious: page > 1
        };
    }
    /**
     * Find one entity by conditions
     */
    async findOne(conditions) {
        const { clause: whereClause, params } = this.buildWhereClause(conditions);
        const query = `SELECT * FROM ${this.tableName} ${whereClause} LIMIT 1`;
        const result = this.executeQuery(query, params, 'get');
        return result || null;
    }
    /**
     * Count entities with optional filtering
     */
    async count(conditions = {}) {
        const { clause: whereClause, params } = this.buildWhereClause(conditions);
        const query = `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`;
        const result = this.executeQuery(query, params, 'get');
        return result?.total || 0;
    }
    /**
     * Check if entity exists
     */
    async exists(conditions) {
        const count = await this.count(conditions);
        return count > 0;
    }
    /**
     * Create a new entity
     */
    async create(data) {
        const now = new Date().toISOString();
        const entityData = {
            ...data,
            id: this.generateId(),
            created_at: now,
            updated_at: now
        };
        const columns = Object.keys(entityData).join(', ');
        const placeholders = Object.keys(entityData).map(() => '?').join(', ');
        const values = Object.values(entityData);
        const query = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`;
        try {
            this.executeQuery(query, values, 'run');
            logger.info(`Created ${this.tableName} with id: ${entityData.id}`, 'DATABASE');
            return entityData;
        }
        catch (error) {
            logger.error(`Failed to create ${this.tableName}: ${error}`, 'DATABASE');
            throw error;
        }
    }
    /**
     * Update an entity by ID
     */
    async update(id, data) {
        // Check if entity exists
        const existingEntity = await this.findById(id);
        if (!existingEntity) {
            return null;
        }
        const updateData = {
            ...data,
            updated_at: new Date().toISOString()
        };
        const updateFields = Object.keys(updateData)
            .map(key => `${key} = ?`)
            .join(', ');
        const values = [...Object.values(updateData), id];
        const query = `UPDATE ${this.tableName} SET ${updateFields} WHERE ${this.primaryKey} = ?`;
        try {
            this.executeQuery(query, values, 'run');
            logger.info(`Updated ${this.tableName} with id: ${id}`, 'DATABASE');
            // Return updated entity
            return await this.findById(id);
        }
        catch (error) {
            logger.error(`Failed to update ${this.tableName} with id ${id}: ${error}`, 'DATABASE');
            throw error;
        }
    }
    /**
     * Delete an entity by ID
     */
    async delete(id) {
        const query = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
        try {
            const result = this.executeQuery(query, [id], 'run');
            const deleted = result.changes > 0;
            if (deleted) {
                logger.info(`Deleted ${this.tableName} with id: ${id}`, 'DATABASE');
            }
            return deleted;
        }
        catch (error) {
            logger.error(`Failed to delete ${this.tableName} with id ${id}: ${error}`, 'DATABASE');
            throw error;
        }
    }
    /**
     * Delete multiple entities by conditions
     */
    async deleteWhere(conditions) {
        const { clause: whereClause, params } = this.buildWhereClause(conditions);
        const query = `DELETE FROM ${this.tableName} ${whereClause}`;
        try {
            const result = this.executeQuery(query, params, 'run');
            const deletedCount = result.changes;
            logger.info(`Deleted ${deletedCount} records from ${this.tableName}`, 'DATABASE');
            return deletedCount;
        }
        catch (error) {
            logger.error(`Failed to delete from ${this.tableName}: ${error}`, 'DATABASE');
            throw error;
        }
    }
    /**
     * Execute raw SQL query
     */
    async raw(query, params = []) {
        return this.executeQuery(query, params);
    }
    /**
     * Execute a transaction
     */
    async transaction(callback) {
        const transaction = this.db.transaction(() => {
            return callback(this);
        });
        try {
            return await transaction();
        }
        catch (error) {
            logger.error(`Transaction failed for ${this.tableName}: ${error}`, 'DATABASE');
            throw error;
        }
    }
    /**
     * Bulk insert entities
     */
    async bulkCreate(entities) {
        if (entities.length === 0) {
            return [];
        }
        const now = new Date().toISOString();
        const entitiesWithMetadata = entities.map(entity => ({
            ...entity,
            id: this.generateId(),
            created_at: now,
            updated_at: now
        }));
        const columns = Object.keys(entitiesWithMetadata[0]).join(', ');
        const placeholders = Object.keys(entitiesWithMetadata[0]).map(() => '?').join(', ');
        const query = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`;
        const insertStmt = this.db.prepare(query);
        const transaction = this.db.transaction((entities) => {
            for (const entity of entities) {
                insertStmt.run(...Object.values(entity));
            }
        });
        try {
            transaction(entitiesWithMetadata);
            logger.info(`Bulk created ${entities.length} records in ${this.tableName}`, 'DATABASE');
            return entitiesWithMetadata;
        }
        catch (error) {
            logger.error(`Failed to bulk create in ${this.tableName}: ${error}`, 'DATABASE');
            throw error;
        }
    }
    /**
     * Search entities with text-based search
     */
    async search(searchTerm, searchColumns, options = {}) {
        if (!searchTerm.trim() || searchColumns.length === 0) {
            return [];
        }
        const searchConditions = searchColumns.map(column => `${column} LIKE ?`).join(' OR ');
        const searchParams = searchColumns.map(() => `%${searchTerm}%`);
        const { clause: whereClause, params: whereParams } = this.buildWhereClause(options.where || {});
        const orderClause = this.buildOrderClause(options.orderBy, options.orderDirection);
        let query = `SELECT * FROM ${this.tableName}`;
        const params = [];
        if (whereClause) {
            query += ` ${whereClause} AND (${searchConditions})`;
            params.push(...whereParams, ...searchParams);
        }
        else {
            query += ` WHERE (${searchConditions})`;
            params.push(...searchParams);
        }
        query += ` ${orderClause}`;
        if (options.limit !== undefined) {
            query += ' LIMIT ?';
            params.push(options.limit);
            if (options.offset !== undefined) {
                query += ' OFFSET ?';
                params.push(options.offset);
            }
        }
        return this.executeQuery(query, params);
    }
}
//# sourceMappingURL=BaseRepository.js.map