/**
 * Base Repository Pattern Implementation
 * Provides common database operations with proper error handling and performance optimization
 * Enhanced with comprehensive SQL injection protection
 */

import Database from 'better-sqlite3';
type DatabaseInstance = Database.Database;
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../utils/logger.js";
import {
  SqlInjectionProtection,
  SqlInjectionError,
} from "../security/SqlInjectionProtection.js";
import {
  DatabaseErrorHandler,
  DatabaseSecurityError,
} from "../security/DatabaseErrorHandler.js";

export interface BaseEntity {
  id: string;
  created_at?: string;
  updated_at?: string;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
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
  protected db: DatabaseInstance;
  protected tableName: string;
  protected primaryKey: string = "id";
  protected sqlSecurity: SqlInjectionProtection;

  constructor(db: DatabaseInstance, tableName: string) {
    this.db = db;
    this.sqlSecurity = new SqlInjectionProtection({
      enableStrictValidation: true,
      enableQueryLogging: process.env.NODE_ENV === "development",
      enableBlacklist: true,
      maxQueryLength: 10000,
      maxParameterCount: 100,
    });
    this.tableName = this.sanitizeTableName(tableName);
  }

  /**
   * Sanitize table name to prevent SQL injection
   */
  private sanitizeTableName(tableName: string): string {
    try {
      return this?.sqlSecurity?.sanitizeTableName(tableName);
    } catch (error) {
      logger.error(
        "Invalid table name provided to repository",
        "REPOSITORY_SECURITY",
        {
          tableName,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      throw new Error(`Invalid table name: ${tableName}`);
    }
  }

  /**
   * Generate a new UUID for entity ID
   */
  protected generateId(): string {
    return uuidv4();
  }

  /**
   * Validate entity data before database operations
   */
  protected validateEntityData(data: any): void {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid entity data: must be an object");
    }

    // Check for suspicious properties that might indicate injection attempts
    const suspiciousKeys = Object.keys(data).filter((key: any) => {
      try {
        this.sanitizeColumnName(key);
        return false;
      } catch {
        return true;
      }
    });

    if (suspiciousKeys?.length || 0 > 0) {
      logger.error("Suspicious entity keys detected", "REPOSITORY_SECURITY", {
        tableName: this.tableName,
        suspiciousKeys,
      });
      throw new Error("Invalid entity properties detected");
    }

    // Validate string values for potential SQL injection
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string") {
        try {
          this?.sqlSecurity?.validateQueryParameters([value]);
        } catch (error) {
          if (error instanceof SqlInjectionError) {
            logger.error(
              "Suspicious entity value detected",
              "REPOSITORY_SECURITY",
              {
                tableName: this.tableName,
                key,
                error: error.message,
              },
            );
            throw new Error(`Invalid value for property: ${key}`);
          }
        }
      }
    }
  }

  /**
   * Build WHERE clause from conditions object with SQL injection protection
   */
  protected buildWhereClause(conditions: Record<string, any>): {
    clause: string;
    params: any[];
  } {
    try {
      return this?.sqlSecurity?.createSecureWhereClause(conditions);
    } catch (error) {
      if (error instanceof SqlInjectionError) {
        logger.error(
          "SQL injection attempt in WHERE clause",
          "REPOSITORY_SECURITY",
          {
            tableName: this.tableName,
            conditions,
            error: error.message,
          },
        );
        throw new Error("Invalid query conditions");
      }
      throw error;
    }
  }

  /**
   * Build ORDER BY clause with SQL injection protection
   */
  protected buildOrderClause(
    orderBy?: string,
    orderDirection: "ASC" | "DESC" = "ASC",
  ): string {
    try {
      return this?.sqlSecurity?.createSecureOrderClause(
        orderBy || this.primaryKey,
        orderDirection,
      );
    } catch (error) {
      if (error instanceof SqlInjectionError) {
        logger.error(
          "SQL injection attempt in ORDER BY clause",
          "REPOSITORY_SECURITY",
          {
            tableName: this.tableName,
            orderBy,
            orderDirection,
            error: error.message,
          },
        );
        throw new Error("Invalid order parameters");
      }
      throw error;
    }
  }

  /**
   * Sanitize column name to prevent SQL injection
   */
  protected sanitizeColumnName(columnName: string): string {
    try {
      return this?.sqlSecurity?.sanitizeColumnName(columnName);
    } catch (error) {
      if (error instanceof SqlInjectionError) {
        logger.error("Invalid column name in query", "REPOSITORY_SECURITY", {
          tableName: this.tableName,
          columnName,
          error: error.message,
        });
        throw new Error("Invalid column name");
      }
      throw error;
    }
  }

  /**
   * Execute a query with performance monitoring and SQL injection protection
   */
  protected executeQuery<R = any>(
    query: string,
    params: any[] = [],
    operation: "get" | "all" | "run" = "all",
  ): R {
    const startTime = Date.now();

    try {
      // Validate query and parameters for SQL injection
      const { query: validatedQuery, params: validatedParams } =
        this?.sqlSecurity?.validateQueryExecution(query, params);

      const stmt = this?.db?.prepare(validatedQuery);
      let result: R;

      switch (operation) {
        case "get":
          result = stmt.get(...validatedParams) as R;
          break;
        case "run":
          result = stmt.run(...validatedParams) as R;
          break;
        default:
          result = stmt.all(...validatedParams) as R;
      }

      const executionTime = Date.now() - startTime;

      if (executionTime > 1000) {
        // Log slow queries
        logger.warn(`Slow query detected (${executionTime}ms)`, "DATABASE", {
          tableName: this.tableName,
          executionTime,
          queryType: this.getQueryType(validatedQuery),
        });
      }

      return result;
    } catch (error) {
      if (error instanceof SqlInjectionError) {
        logger.error(
          "SQL injection attempt blocked in query execution",
          "REPOSITORY_SECURITY",
          {
            tableName: this.tableName,
            error: error.message,
            queryPreview: query.substring(0, 100),
          },
        );
        throw new DatabaseSecurityError(
          "Invalid query detected",
          "SQL_INJECTION_BLOCKED",
          error,
        );
      }

      // Handle database errors securely
      const dbError = DatabaseErrorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: operation,
          table: this.tableName,
        } as any,
      );

      // Re-throw with user-friendly message
      throw new DatabaseSecurityError(
        dbError.userMessage,
        dbError.code,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Get query type for logging
   */
  private getQueryType(query: string): string {
    const normalizedQuery = query.toLowerCase().trim();

    if (normalizedQuery.startsWith("select")) return "SELECT";
    if (normalizedQuery.startsWith("insert")) return "INSERT";
    if (normalizedQuery.startsWith("update")) return "UPDATE";
    if (normalizedQuery.startsWith("delete")) return "DELETE";

    return "OTHER";
  }

  /**
   * Find entity by ID
   */
  async findById(id: string): Promise<T | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
    const result = this.executeQuery<T>(query, [id], "get");
    return result || null;
  }

  /**
   * Find all entities with optional filtering and pagination
   */
  async findAll(options: QueryOptions = {}): Promise<T[]> {
    const { limit, offset, orderBy, orderDirection, where } = options;
    const { clause: whereClause, params: whereParams } = this.buildWhereClause(
      where || {},
    );
    const orderClause = this.buildOrderClause(orderBy, orderDirection);

    let query = `SELECT * FROM ${this.tableName} ${whereClause} ${orderClause}`;
    const params = [...whereParams];

    if (limit !== undefined) {
      query += " LIMIT ?";
      params.push(limit);

      if (offset !== undefined) {
        query += " OFFSET ?";
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
    options: Omit<QueryOptions, "limit" | "offset"> = {},
  ): Promise<PaginatedResult<T>> {
    const offset = (page - 1) * pageSize;

    // Get total count
    const { clause: whereClause, params: whereParams } = this.buildWhereClause(
      options.where || {},
    );
    const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`;
    const countResult = this.executeQuery<{ total: number }>(
      countQuery,
      whereParams,
      "get",
    );
    const total = countResult?.total || 0;

    // Get paginated data
    const data = await this.findAll({
      ...options,
      limit: pageSize,
      offset,
    });

    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  /**
   * Find one entity by conditions
   */
  async findOne(conditions: Record<string, any>): Promise<T | null> {
    const { clause: whereClause, params } = this.buildWhereClause(conditions);
    const query = `SELECT * FROM ${this.tableName} ${whereClause} LIMIT 1`;
    const result = this.executeQuery<T>(query, params, "get");
    return result || null;
  }

  /**
   * Count entities with optional filtering
   */
  async count(conditions: Record<string, any> = {}): Promise<number> {
    const { clause: whereClause, params } = this.buildWhereClause(conditions);
    const query = `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`;
    const result = this.executeQuery<{ total: number }>(query, params, "get");
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
   * Create a new entity with comprehensive validation
   */
  async create(data: Omit<T, "id" | "created_at" | "updated_at">): Promise<T> {
    // Validate entity data
    this.validateEntityData(data);

    const now = new Date().toISOString();
    const entityData = {
      ...data,
      id: this.generateId(),
      created_at: now,
      updated_at: now,
    } as T;

    const columns = Object.keys(entityData)
      .map((key: any) => this.sanitizeColumnName(key))
      .join(", ");
    const placeholders = Object.keys(entityData)
      .map(() => "?")
      .join(", ");
    const values = Object.values(entityData);

    const query = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`;

    try {
      this.executeQuery(query, values, "run");
      logger.info("Entity created successfully", "DATABASE", {
        tableName: this.tableName,
        entityId: entityData.id,
      });
      return entityData;
    } catch (error) {
      const dbError = DatabaseErrorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: "create",
          table: this.tableName,
        },
      );

      throw new DatabaseSecurityError(
        dbError.userMessage,
        dbError.code,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Update an entity by ID with comprehensive validation
   */
  async update(
    id: string,
    data: Partial<Omit<T, "id" | "created_at">>,
  ): Promise<T | null> {
    // Validate ID format
    try {
      this?.sqlSecurity?.validateQueryParameters([id]);
    } catch (error) {
      if (error instanceof SqlInjectionError) {
        logger.error("Invalid ID in update operation", "REPOSITORY_SECURITY", {
          tableName: this.tableName,
          id,
          error: error.message,
        });
        throw new Error("Invalid entity ID");
      }
      throw error;
    }

    // Validate update data
    this.validateEntityData(data);

    // Check if entity exists
    const existingEntity = await this.findById(id);
    if (!existingEntity) {
      return null;
    }

    const updateData = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    const updateFields = Object.keys(updateData)
      .map((key: any) => `${this.sanitizeColumnName(key)} = ?`)
      .join(", ");
    const values = [...Object.values(updateData), id];

    const query = `UPDATE ${this.tableName} SET ${updateFields} WHERE ${this.sanitizeColumnName(this.primaryKey)} = ?`;

    try {
      this.executeQuery(query, values, "run");
      logger.info("Entity updated successfully", "DATABASE", {
        tableName: this.tableName,
        entityId: id,
      });

      // Return updated entity
      return await this.findById(id);
    } catch (error) {
      const dbError = DatabaseErrorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: "update",
          table: this.tableName,
        },
      );

      throw new DatabaseSecurityError(
        dbError.userMessage,
        dbError.code,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Delete an entity by ID
   */
  async delete(id: string): Promise<boolean> {
    const query = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;

    try {
      const result = this.executeQuery<any>(query, [id], "run");
      const deleted = result.changes > 0;

      if (deleted) {
        logger.info(`Deleted ${this.tableName} with id: ${id}`, "DATABASE");
      }

      return deleted;
    } catch (error) {
      const dbError = DatabaseErrorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: "delete",
          table: this.tableName,
        },
      );

      throw new DatabaseSecurityError(
        dbError.userMessage,
        dbError.code,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Delete multiple entities by conditions
   */
  async deleteWhere(conditions: Record<string, any>): Promise<number> {
    const { clause: whereClause, params } = this.buildWhereClause(conditions);
    const query = `DELETE FROM ${this.tableName} ${whereClause}`;

    try {
      const result = this.executeQuery<any>(
        query,
        params,
        "run",
      );
      const deletedCount = result?.changes;

      logger.info(
        `Deleted ${deletedCount} records from ${this.tableName}`,
        "DATABASE",
      );
      return deletedCount;
    } catch (error) {
      const dbError = DatabaseErrorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: "deleteWhere",
          table: this.tableName,
        },
      );

      throw new DatabaseSecurityError(
        dbError.userMessage,
        dbError.code,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Execute raw SQL query with enhanced security validation
   * WARNING: Use with extreme caution. Prefer typed repository methods.
   */
  async raw<R = any>(query: string, params: any[] = []): Promise<R> {
    logger.warn("Raw SQL query execution", "REPOSITORY_SECURITY", {
      tableName: this.tableName,
      queryType: this.getQueryType(query),
      paramCount: params?.length || 0,
    });

    return this.executeQuery<R>(query, params);
  }

  /**
   * Execute a transaction
   */
  async transaction<R>(callback: (repo: this) => Promise<R>): Promise<R> {
    const transaction = this?.db?.transaction(() => {
      return callback(this);
    });

    try {
      return await transaction();
    } catch (error) {
      const dbError = DatabaseErrorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: "transaction",
          table: this.tableName,
        },
      );

      throw new DatabaseSecurityError(
        dbError.userMessage,
        dbError.code,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Bulk insert entities
   */
  async bulkCreate(
    entities: Array<Omit<T, "id" | "created_at" | "updated_at">>,
  ): Promise<T[]> {
    if (entities?.length || 0 === 0) {
      return [];
    }

    const now = new Date().toISOString();
    const entitiesWithMetadata = entities?.map((entity: any) => ({
      ...entity,
      id: this.generateId(),
      created_at: now,
      updated_at: now,
    })) as T[];

    const columns = Object.keys(entitiesWithMetadata[0] as object).join(", ");
    const placeholders = Object.keys(entitiesWithMetadata[0] as object)
      .map(() => "?")
      .join(", ");
    const query = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`;

    const insertStmt = this?.db?.prepare(query);
    const transaction = this?.db?.transaction((entities: T[]) => {
      for (const entity of entities) {
        insertStmt.run(...Object.values(entity));
      }
    });

    try {
      transaction(entitiesWithMetadata);
      logger.info(
        `Bulk created ${entities?.length || 0} records in ${this.tableName}`,
        "DATABASE",
      );
      return entitiesWithMetadata;
    } catch (error) {
      const dbError = DatabaseErrorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: "bulkCreate",
          table: this.tableName,
        },
      );

      throw new DatabaseSecurityError(
        dbError.userMessage,
        dbError.code,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Search entities with text-based search and SQL injection protection
   */
  async search(
    searchTerm: string,
    searchColumns: string[],
    options: QueryOptions = {},
  ): Promise<T[]> {
    if (!searchTerm.trim() || searchColumns?.length || 0 === 0) {
      return [];
    }

    // Validate search term
    try {
      this?.sqlSecurity?.validateQueryParameters([searchTerm]);
    } catch (error) {
      if (error instanceof SqlInjectionError) {
        logger.error(
          "SQL injection attempt in search term",
          "REPOSITORY_SECURITY",
          {
            tableName: this.tableName,
            searchTerm,
            error: error.message,
          },
        );
        throw new Error("Invalid search term");
      }
      throw error;
    }

    // Sanitize search columns
    const sanitizedColumns = searchColumns?.map((column: any) => {
      try {
        return this.sanitizeColumnName(column);
      } catch (error) {
        logger.error("Invalid search column", "REPOSITORY_SECURITY", {
          tableName: this.tableName,
          column,
          error: error instanceof Error ? error.message : String(error),
        });
        throw new Error(`Invalid search column: ${column}`);
      }
    });

    const searchConditions = sanitizedColumns
      .map((column: any) => `${column} LIKE ?`)
      .join(" OR ");
    const searchParams = sanitizedColumns?.map(() => `%${searchTerm}%`);

    const { clause: whereClause, params: whereParams } = this.buildWhereClause(
      options.where || {},
    );
    const orderClause = this.buildOrderClause(
      options.orderBy,
      options.orderDirection,
    );

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
      query += " LIMIT ?";
      params.push(options.limit);

      if (options.offset !== undefined) {
        query += " OFFSET ?";
        params.push(options.offset);
      }
    }

    return this.executeQuery<T[]>(query, params);
  }
}
