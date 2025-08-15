/**
 * Advanced Field Selection Utilities for tRPC API Optimization
 * Implements GraphQL-like field filtering with nested selection and performance optimizations
 */

import { z } from "zod";
import { logger } from "./logger.js";

// Field selection types
export interface FieldSelector {
  [key: string]: boolean | FieldSelector;
}

export interface FieldSelectionOptions {
  include?: string[];
  exclude?: string[];
  select?: FieldSelector;
  maxDepth?: number;
  allowWildcard?: boolean;
}

// Validation schemas
export const fieldSelectionSchema: z.ZodType<any> = z.lazy(() => 
  z.object({
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
    select: z.record(z.union([z.boolean(), fieldSelectionSchema])).optional(),
    maxDepth: z.number().min(1).max(10).default(5),
    allowWildcard: z.boolean().default(true),
  })
);

export type FieldSelectionInput = z.infer<typeof fieldSelectionSchema>;

/**
 * Advanced field selector with support for nested fields and performance optimization
 */
export class AdvancedFieldSelector {
  private cache = new Map<string, FieldSelector>();
  private readonly maxCacheSize = 1000;

  /**
   * Parse field selection string into structured selector
   * Supports dot notation: "user.profile.name", "items.*.price"
   */
  parseFieldSelection(fields: string[]): FieldSelector {
    const cacheKey = fields.sort().join(',');
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const selector: FieldSelector = {};

    for (const field of fields) {
      this.setNestedField(selector, field.split('.'), true);
    }

    // Cache the result
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entries
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(cacheKey, selector);

    return selector;
  }

  /**
   * Apply field selection to data with nested support
   */
  applySelection<T extends Record<string, any>>(
    data: T | T[],
    options: FieldSelectionOptions
  ): Partial<T> | Partial<T>[] {
    if (Array.isArray(data)) {
      return data.map(item => this.selectFields(item, options));
    }
    
    return this.selectFields(data, options);
  }

  /**
   * Select specific fields from an object
   */
  public selectFields<T extends Record<string, any>>(
    obj: T,
    options: FieldSelectionOptions,
    currentDepth: number = 0
  ): Partial<T> {
    if (currentDepth >= (options.maxDepth || 5)) {
      logger.warn("Maximum field selection depth exceeded", "FIELD_SELECTION", {
        currentDepth,
        maxDepth: options.maxDepth,
      });
      return {};
    }

    let result: Partial<T> = {};

    // If select is provided, use it for precise field selection
    if (options.select) {
      result = this.applySelector(obj, options.select, currentDepth, options.maxDepth || 5);
    } else {
      // Start with all fields if no specific selection
      result = { ...obj };
    }

    // Apply include filter (add specific fields)
    if (options.include) {
      const includeSelector = this.parseFieldSelection(options.include);
      const includedFields = this.applySelector(obj, includeSelector, currentDepth, options.maxDepth || 5);
      result = { ...result, ...includedFields };
    }

    // Apply exclude filter (remove specific fields)
    if (options.exclude) {
      for (const field of options.exclude) {
        this.removeNestedField(result, field.split('.'));
      }
    }

    return result;
  }

  /**
   * Apply selector to object with nested field support
   */
  private applySelector<T extends Record<string, any>>(
    obj: T,
    selector: FieldSelector,
    currentDepth: number,
    maxDepth: number
  ): Partial<T> {
    if (currentDepth >= maxDepth) {
      return {};
    }

    const result: Partial<T> = {};

    for (const [key, value] of Object.entries(selector)) {
      if (key === '*' && typeof value === 'object' && value !== null) {
        // Wildcard selection - apply to all object properties
        for (const [objKey, objValue] of Object.entries(obj)) {
          if (typeof objValue === 'object' && objValue !== null) {
            result[objKey as keyof T] = this.applySelector(
              objValue,
              value as FieldSelector,
              currentDepth + 1,
              maxDepth
            ) as T[keyof T];
          }
        }
      } else if (key === '*' && value === true) {
        // Wildcard boolean selection - include all properties
        for (const [objKey, objValue] of Object.entries(obj)) {
          result[objKey as keyof T] = objValue;
        }
      } else if (key in obj) {
        if (value === true) {
          // Include the field
          result[key as keyof T] = obj[key];
        } else if (value === false) {
          // Explicitly exclude the field (skip)
          continue;
        } else if (typeof value === 'object' && obj[key] && typeof obj[key] === 'object') {
          // Nested selection
          if (Array.isArray(obj[key])) {
            // Handle arrays
            result[key as keyof T] = (obj[key] as any[]).map(item => 
              typeof item === 'object' && item !== null
                ? this.applySelector(item, value as FieldSelector, currentDepth + 1, maxDepth)
                : item
            ) as T[keyof T];
          } else {
            // Handle objects
            result[key as keyof T] = this.applySelector(
              obj[key],
              value as FieldSelector,
              currentDepth + 1,
              maxDepth
            ) as T[keyof T];
          }
        }
      }
    }

    return result;
  }

  /**
   * Set nested field in selector
   */
  private setNestedField(selector: FieldSelector, path: string[], value: boolean | FieldSelector): void {
    if (path.length === 0) return;

    const [first, ...rest] = path;
    if (!first) return; // TypeScript guard
    
    if (rest.length === 0) {
      selector[first] = value;
    } else {
      if (!selector[first] || typeof selector[first] !== 'object') {
        selector[first] = {};
      }
      this.setNestedField(selector[first] as FieldSelector, rest, value);
    }
  }

  /**
   * Remove nested field from result
   */
  private removeNestedField<T extends Record<string, any>>(obj: Partial<T>, path: string[]): void {
    if (path.length === 0) return;

    const [first, ...rest] = path;
    
    if (rest.length === 0) {
      delete obj[first as keyof T];
    } else if (obj[first as keyof T] && typeof obj[first as keyof T] === 'object') {
      this.removeNestedField(obj[first as keyof T] as Record<string, any>, rest);
    }
  }

  /**
   * Clear the selector cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
    };
  }
}

/**
 * Performance-optimized field selection functions
 */
export class PerformanceFieldSelector {
  /**
   * Fast field selection for flat objects (no nesting)
   */
  static selectFlatFields<T extends Record<string, any>>(
    obj: T,
    fields: string[]
  ): Partial<T> {
    const result: Partial<T> = {};
    
    for (const field of fields) {
      if (field in obj) {
        result[field as keyof T] = obj[field];
      }
    }
    
    return result;
  }

  /**
   * Exclude fields from flat objects
   */
  static excludeFlatFields<T extends Record<string, any>>(
    obj: T,
    excludeFields: string[]
  ): Partial<T> {
    const result: Partial<T> = { ...obj };
    
    for (const field of excludeFields) {
      delete result[field as keyof T];
    }
    
    return result;
  }

  /**
   * Batch field selection for arrays with performance optimization
   */
  static batchFieldSelection<T extends Record<string, any>>(
    data: T[],
    options: FieldSelectionOptions
  ): Partial<T>[] {
    if (data.length === 0) return [];

    // For small arrays, use direct processing
    if (data.length <= 100) {
      const selector = new AdvancedFieldSelector();
      return data.map(item => selector.selectFields(item, options));
    }

    // For large arrays, use batch processing with optimization
    const batchSize = 1000;
    const results: Partial<T>[] = [];
    const selector = new AdvancedFieldSelector();

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const batchResults = batch.map(item => selector.selectFields(item, options));
      results.push(...batchResults);
    }

    return results;
  }
}

/**
 * Field selection optimization for specific data types
 */
export class TypedFieldSelector {
  /**
   * Select fields for product data with common optimization patterns
   */
  static selectProductFields<T extends Record<string, any>>(
    products: T[],
    selectionType: 'list' | 'detail' | 'search' | 'minimal'
  ): Partial<T>[] {
    const selectionMap = {
      minimal: ['id', 'name', 'price'],
      list: ['id', 'name', 'price', 'images', 'inStock', 'ratings.average'],
      search: ['id', 'name', 'price', 'images', 'category', 'brand', 'inStock'],
      detail: ['*'], // All fields
    };

    const fields = selectionMap[selectionType];
    
    if (fields[0] === '*') {
      return products; // Return all fields
    }

    const selector = new AdvancedFieldSelector();
    return selector.applySelection(products, { include: fields }) as Partial<T>[];
  }

  /**
   * Select fields for user data with privacy considerations
   */
  static selectUserFields<T extends Record<string, any>>(
    users: T[],
    viewerRole: 'admin' | 'user' | 'public'
  ): Partial<T>[] {
    const fieldsByRole = {
      public: ['id', 'name', 'avatar'],
      user: ['id', 'name', 'email', 'avatar', 'preferences'],
      admin: ['*'], // All fields for admin
    };

    const fields = fieldsByRole[viewerRole];
    
    if (fields[0] === '*') {
      return users;
    }

    const selector = new AdvancedFieldSelector();
    return selector.applySelection(users, { include: fields }) as Partial<T>[];
  }
}

/**
 * Field selection middleware for tRPC
 */
export function createFieldSelectionMiddleware() {
  return async ({ next, input }: { next: () => Promise<any>; input: any }) => {
    const result = await next();
    
    // Check if input contains field selection options
    if (input && typeof input === 'object' && 
        (input.fieldSelection || input.fields || input.select)) {
      
      const fieldOptions: FieldSelectionOptions = {
        include: input.fields || input.fieldSelection?.include,
        exclude: input.fieldSelection?.exclude,
        select: input.select || input.fieldSelection?.select,
        maxDepth: input.fieldSelection?.maxDepth || 5,
        allowWildcard: input.fieldSelection?.allowWildcard ?? true,
      };

      const selector = new AdvancedFieldSelector();
      
      if (Array.isArray(result)) {
        return PerformanceFieldSelector.batchFieldSelection(result, fieldOptions);
      } else if (result && typeof result === 'object') {
        return selector.applySelection(result, fieldOptions);
      }
    }

    return result;
  };
}

/**
 * Field selection query builder for SQL optimization
 */
export class SQLFieldSelector {
  /**
   * Convert field selection to SQL SELECT clause
   */
  static buildSelectClause(
    tableName: string,
    options: FieldSelectionOptions,
    tableSchema: Record<string, string>
  ): string {
    if (!options.include && !options.exclude) {
      return `${tableName}.*`;
    }

    let fields: string[] = [];

    if (options.include) {
      // Map field names to database columns
      fields = options.include
        .filter(field => field in tableSchema)
        .map(field => `${tableName}.${tableSchema[field]} AS ${field}`);
    } else {
      // Include all fields by default
      fields = Object.keys(tableSchema)
        .map(field => `${tableName}.${tableSchema[field]} AS ${field}`);
    }

    if (options.exclude) {
      // Remove excluded fields
      fields = fields.filter(field => {
        const fieldName = field.split(' AS ')[1] || field.split('.')[1];
        return fieldName ? !options.exclude!.includes(fieldName) : true;
      });
    }

    return fields.length > 0 ? fields.join(', ') : `${tableName}.*`;
  }

  /**
   * Optimize JOIN queries based on field selection
   */
  static optimizeJoins(
    baseQuery: string,
    fieldSelection: FieldSelectionOptions,
    availableJoins: Record<string, string>
  ): string {
    if (!fieldSelection.include) {
      return baseQuery; // Include all joins if no specific selection
    }

    let optimizedQuery = baseQuery;

    // Remove unnecessary JOINs based on field selection
    for (const [joinAlias, joinClause] of Object.entries(availableJoins)) {
      const needsJoin = fieldSelection.include.some(field => 
        field.startsWith(`${joinAlias}.`)
      );

      if (!needsJoin) {
        // Remove the JOIN clause
        optimizedQuery = optimizedQuery.replace(joinClause, '');
      }
    }

    return optimizedQuery.replace(/\s+/g, ' ').trim();
  }
}

/**
 * Response size estimation and optimization
 */
export const FieldSelectionOptimization = {
  /**
   * Estimate response size reduction from field selection
   */
  estimateSizeReduction<T extends Record<string, any>>(
    data: T[],
    options: FieldSelectionOptions
  ): { original: number; selected: number; reduction: number } {
    if (data.length === 0) {
      return { original: 0, selected: 0, reduction: 0 };
    }

    const originalSize = Buffer.byteLength(JSON.stringify(data), 'utf8');
    
    const selector = new AdvancedFieldSelector();
    const selectedData = selector.applySelection(data, options);
    const selectedSize = Buffer.byteLength(JSON.stringify(selectedData), 'utf8');
    
    const reduction = ((originalSize - selectedSize) / originalSize) * 100;

    return {
      original: originalSize,
      selected: selectedSize,
      reduction: Math.round(reduction * 100) / 100,
    };
  },

  /**
   * Suggest optimal field selection for common use cases
   */
  suggestOptimalSelection(
    useCase: 'mobile' | 'desktop' | 'api' | 'export',
    dataType: 'products' | 'users' | 'orders' | 'generic'
  ): FieldSelectionOptions {
    const suggestions = {
      mobile: {
        products: { include: ['id', 'name', 'price', 'images.thumbnail', 'inStock'] },
        users: { include: ['id', 'name', 'avatar'] },
        orders: { include: ['id', 'total', 'status', 'items.name', 'items.price'] },
        generic: { maxDepth: 2 },
      },
      desktop: {
        products: { include: ['id', 'name', 'price', 'images', 'description', 'ratings', 'inStock'] },
        users: { include: ['id', 'name', 'email', 'avatar', 'preferences'] },
        orders: { include: ['id', 'total', 'status', 'items', 'shipping'] },
        generic: { maxDepth: 3 },
      },
      api: {
        products: { exclude: ['metadata', 'internal'] },
        users: { exclude: ['password', 'tokens', 'internal'] },
        orders: { exclude: ['internal', 'audit'] },
        generic: { maxDepth: 4 },
      },
      export: {
        products: {}, // All fields
        users: { exclude: ['password', 'tokens'] },
        orders: {},
        generic: {},
      },
    };

    return suggestions[useCase][dataType] || suggestions[useCase].generic;
  },
};

// Export singleton instance for global use
export const fieldSelector = new AdvancedFieldSelector();
export const performanceFieldSelector = PerformanceFieldSelector;
export const typedFieldSelector = TypedFieldSelector;