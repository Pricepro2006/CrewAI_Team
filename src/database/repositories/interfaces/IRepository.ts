/**
 * Base repository interface defining common CRUD operations
 */
export interface IRepository<T, K> {
  /**
   * Find an entity by its primary key
   */
  findById(id: K): Promise<T | null>;

  /**
   * Find all entities matching a condition
   */
  findAll(filter?: Partial<T>): Promise<T[]>;

  /**
   * Create a new entity
   */
  create(entity: Omit<T, "id">): Promise<T>;

  /**
   * Update an existing entity
   */
  update(id: K, entity: Partial<T>): Promise<T | null>;

  /**
   * Delete an entity by its primary key
   */
  delete(id: K): Promise<boolean>;

  /**
   * Count entities matching a condition
   */
  count(filter?: Partial<T>): Promise<number>;

  /**
   * Check if an entity exists
   */
  exists(id: K): Promise<boolean>;
}

/**
 * Base repository interface with pagination support
 */
export interface IPaginatedRepository<T, K> extends IRepository<T, K> {
  /**
   * Find entities with pagination
   */
  findPaginated(options: PaginationOptions): Promise<PaginatedResult<T>>;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
  filter?: Record<string, any>;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}
