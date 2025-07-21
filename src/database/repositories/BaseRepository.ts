/**
 * Base Repository Pattern Implementation
 * Provides common database operations with proper error handling and performance optimization
 */

import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';

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

export abstract class BaseRepository<T extends BaseEntity> {
  protected db: Database.Database;
  protected tableName: string;
  protected primaryKey: string = 'id';

  constructor(db: Database.Database, tableName: string) {
    this.db = db;
    this.tableName = tableName;
  }

  /**
   * Generate a new UUID for entity ID
   */
  protected generateId(): string {
    return uuidv4();
  }

  /**
   * Build WHERE clause from conditions object
   */
  protected buildWhereClause(conditions: Record<string, any>): { clause: string; params: any[] } {
    if (!conditions || Object.keys(conditions).length === 0) {
      return { clause: '', params: [] };
    }

    const clauses: string[] = [];
    const params: any[] = [];

    for (const [key, value] of Object.entries(conditions)) {
      if (value === null || value === undefined) {
        clauses.push(`${key} IS NULL`);
      } else if (Array.isArray(value)) {
        const placeholders = value.map(() => '?').join(',');
        clauses.push(`${key} IN (${placeholders})`);
        params.push(...value);
      } else if (typeof value === 'object' && value.operator) {
        // Support for complex conditions like { operator: '>', value: 100 }
        clauses.push(`${key} ${value.operator} ?`);
        params.push(value.value);
      } else {
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
  protected buildOrderClause(orderBy?: string, orderDirection: 'ASC' | 'DESC' = 'ASC'): string {
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
  protected sanitizeColumnName(columnName: string): string {
    // Only allow alphanumeric characters, underscores, and dots
    return columnName.replace(/[^a-zA-Z0-9_.]/g, '');
  }

  /**
   * Execute a query with performance monitoring
   */
  protected executeQuery<R = any>(
    query: string, 
    params: any[] = [], 
    operation: 'get' | 'all' | 'run' = 'all'
  ): R {
    const startTime = Date.now();
    
    try {
      const stmt = this.db.prepare(query);
      let result: R;

      switch (operation) {
        case 'get':
          result = stmt.get(...params) as R;
          break;
        case 'run':
          result = stmt.run(...params) as R;
          break;
        default:
          result = stmt.all(...params) as R;
      }

      const executionTime = Date.now() - startTime;
      
      if (executionTime > 1000) { // Log slow queries
        logger.warn(`Slow query detected (${executionTime}ms): ${query}`, 'DATABASE');
      }

      return result;
    } catch (error) {
      logger.error(`Database query failed: ${error}. Query: ${query}`, 'DATABASE');
      throw error;
    }
  }

  /**
   * Find entity by ID
   */
  async findById(id: string): Promise<T | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
    const result = this.executeQuery<T>(query, [id], 'get');
    return result || null;
  }

  /**
   * Find all entities with optional filtering and pagination
   */
  async findAll(options: QueryOptions = {}): Promise<T[]> {
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

    return this.executeQuery<T[]>(query, params);
  }

  /**
   * Find entities with pagination
   */
  async findPaginated(
    page: number = 1,
    pageSize: number = 50,
    options: Omit<QueryOptions, 'limit' | 'offset'> = {}
  ): Promise<PaginatedResult<T>> {
    const offset = (page - 1) * pageSize;
    
    // Get total count
    const { clause: whereClause, params: whereParams } = this.buildWhereClause(options.where || {});
    const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`;
    const countResult = this.executeQuery<{ total: number }>(countQuery, whereParams, 'get');
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
  async findOne(conditions: Record<string, any>): Promise<T | null> {
    const { clause: whereClause, params } = this.buildWhereClause(conditions);
    const query = `SELECT * FROM ${this.tableName} ${whereClause} LIMIT 1`;
    const result = this.executeQuery<T>(query, params, 'get');
    return result || null;
  }

  /**
   * Count entities with optional filtering
   */
  async count(conditions: Record<string, any> = {}): Promise<number> {
    const { clause: whereClause, params } = this.buildWhereClause(conditions);
    const query = `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`;
    const result = this.executeQuery<{ total: number }>(query, params, 'get');
    return result?.total || 0;
  }

  /**
   * Check if entity exists
   */
  async exists(conditions: Record<string, any>): Promise<boolean> {
    const count = await this.count(conditions);
    return count > 0;
  }

  /**
   * Create a new entity
   */
  async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> {
    const now = new Date().toISOString();
    const entityData = {
      ...data,
      id: this.generateId(),
      created_at: now,
      updated_at: now
    } as T;

    const columns = Object.keys(entityData).join(', ');
    const placeholders = Object.keys(entityData).map(() => '?').join(', ');
    const values = Object.values(entityData);

    const query = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`;
    
    try {
      this.executeQuery(query, values, 'run');
      logger.info(`Created ${this.tableName} with id: ${entityData.id}`, 'DATABASE');
      return entityData;
    } catch (error) {
      logger.error(`Failed to create ${this.tableName}: ${error}`, 'DATABASE');
      throw error;
    }
  }

  /**
   * Update an entity by ID
   */
  async update(id: string, data: Partial<Omit<T, 'id' | 'created_at'>>): Promise<T | null> {
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
    } catch (error) {
      logger.error(`Failed to update ${this.tableName} with id ${id}: ${error}`, 'DATABASE');
      throw error;
    }
  }

  /**
   * Delete an entity by ID
   */
  async delete(id: string): Promise<boolean> {
    const query = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
    
    try {
      const result = this.executeQuery<Database.RunResult>(query, [id], 'run');
      const deleted = result.changes > 0;
      
      if (deleted) {
        logger.info(`Deleted ${this.tableName} with id: ${id}`, 'DATABASE');
      }
      
      return deleted;
    } catch (error) {
      logger.error(`Failed to delete ${this.tableName} with id ${id}: ${error}`, 'DATABASE');
      throw error;
    }
  }

  /**
   * Delete multiple entities by conditions
   */
  async deleteWhere(conditions: Record<string, any>): Promise<number> {
    const { clause: whereClause, params } = this.buildWhereClause(conditions);
    const query = `DELETE FROM ${this.tableName} ${whereClause}`;
    
    try {
      const result = this.executeQuery<Database.RunResult>(query, params, 'run');
      const deletedCount = result.changes;
      
      logger.info(`Deleted ${deletedCount} records from ${this.tableName}`, 'DATABASE');
      return deletedCount;
    } catch (error) {
      logger.error(`Failed to delete from ${this.tableName}: ${error}`, 'DATABASE');
      throw error;
    }
  }

  /**
   * Execute raw SQL query
   */
  async raw<R = any>(query: string, params: any[] = []): Promise<R> {
    return this.executeQuery<R>(query, params);
  }

  /**
   * Execute a transaction
   */
  async transaction<R>(callback: (repo: this) => Promise<R>): Promise<R> {
    const transaction = this.db.transaction(() => {
      return callback(this);
    });

    try {
      return await transaction();
    } catch (error) {
      logger.error(`Transaction failed for ${this.tableName}: ${error}`, 'DATABASE');
      throw error;
    }
  }

  /**
   * Bulk insert entities
   */
  async bulkCreate(entities: Array<Omit<T, 'id' | 'created_at' | 'updated_at'>>): Promise<T[]> {
    if (entities.length === 0) {
      return [];
    }

    const now = new Date().toISOString();
    const entitiesWithMetadata = entities.map(entity => ({
      ...entity,
      id: this.generateId(),
      created_at: now,
      updated_at: now
    })) as T[];

    const columns = Object.keys(entitiesWithMetadata[0]).join(', ');
    const placeholders = Object.keys(entitiesWithMetadata[0]).map(() => '?').join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`;

    const insertStmt = this.db.prepare(query);
    const transaction = this.db.transaction((entities: T[]) => {
      for (const entity of entities) {
        insertStmt.run(...Object.values(entity));
      }
    });

    try {
      transaction(entitiesWithMetadata);
      logger.info(`Bulk created ${entities.length} records in ${this.tableName}`, 'DATABASE');
      return entitiesWithMetadata;
    } catch (error) {
      logger.error(`Failed to bulk create in ${this.tableName}: ${error}`, 'DATABASE');
      throw error;
    }
  }

  /**
   * Search entities with text-based search
   */
  async search(searchTerm: string, searchColumns: string[], options: QueryOptions = {}): Promise<T[]> {
    if (!searchTerm.trim() || searchColumns.length === 0) {
      return [];
    }

    const searchConditions = searchColumns.map(column => `${column} LIKE ?`).join(' OR ');
    const searchParams = searchColumns.map(() => `%${searchTerm}%`);
    
    const { clause: whereClause, params: whereParams } = this.buildWhereClause(options.where || {});
    const orderClause = this.buildOrderClause(options.orderBy, options.orderDirection);
    
    let query = `SELECT * FROM ${this.tableName}`;
    const params: any[] = [];

    if (whereClause) {
      query += ` ${whereClause} AND (${searchConditions})`;
      params.push(...whereParams, ...searchParams);
    } else {
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

    return this.executeQuery<T[]>(query, params);
  }
}