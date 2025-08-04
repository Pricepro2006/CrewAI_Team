import { logger } from "../../utils/logger.js";

interface QueryFilter {
  field: string;
  operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "LIKE" | "IN" | "NOT IN";
  value: any;
}

interface QueryOptions {
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
  limit?: number;
  offset?: number;
}

export class EmailQueryBuilder {
  private tableName: string;
  private selectFields: string[] = ["*"];
  private filters: QueryFilter[] = [];
  private joins: string[] = [];
  private groupByFields: string[] = [];
  private havingClauses: string[] = [];
  private options: QueryOptions = {};
  // Logger is now imported as a singleton

  constructor(tableName: string) {
    this.tableName = tableName;
    // Logger is now imported as a singleton
  }

  /**
   * Specify fields to select
   */
  select(fields: string | string[]): this {
    this.selectFields = Array.isArray(fields) ? fields : [fields];
    return this;
  }

  /**
   * Add a WHERE condition
   */
  where(field: string, operator: QueryFilter["operator"], value: any): this {
    this.filters.push({ field, operator, value });
    return this;
  }

  /**
   * Add a JOIN clause
   */
  join(joinClause: string): this {
    this.joins.push(joinClause);
    return this;
  }

  /**
   * Add a LEFT JOIN clause
   */
  leftJoin(table: string, condition: string): this {
    this.joins.push(`LEFT JOIN ${table} ON ${condition}`);
    return this;
  }

  /**
   * Add GROUP BY fields
   */
  groupBy(fields: string | string[]): this {
    this.groupByFields = Array.isArray(fields) ? fields : [fields];
    return this;
  }

  /**
   * Add HAVING clause
   */
  having(clause: string): this {
    this.havingClauses.push(clause);
    return this;
  }

  /**
   * Set ORDER BY
   */
  orderBy(field: string, direction: "ASC" | "DESC" = "ASC"): this {
    this.options.orderBy = field;
    this.options.orderDirection = direction;
    return this;
  }

  /**
   * Set LIMIT
   */
  limit(limit: number): this {
    this.options.limit = limit;
    return this;
  }

  /**
   * Set OFFSET
   */
  offset(offset: number): this {
    this.options.offset = offset;
    return this;
  }

  /**
   * Build the SQL query
   */
  build(): { query: string; params: any[] } {
    const params: any[] = [];
    let query = `SELECT ${this.selectFields.join(", ")} FROM ${this.tableName}`;

    // Add joins
    if (this.joins.length > 0) {
      query += " " + this.joins.join(" ");
    }

    // Add WHERE clause
    if (this.filters.length > 0) {
      const whereConditions = this.filters.map((filter) => {
        if (filter.operator === "IN" || filter.operator === "NOT IN") {
          const placeholders = Array.isArray(filter.value)
            ? filter.value.map(() => "?").join(", ")
            : "?";
          if (Array.isArray(filter.value)) {
            params.push(...filter.value);
          } else {
            params.push(filter.value);
          }
          return `${filter.field} ${filter.operator} (${placeholders})`;
        } else {
          params.push(filter.value);
          return `${filter.field} ${filter.operator} ?`;
        }
      });
      query += " WHERE " + whereConditions.join(" AND ");
    }

    // Add GROUP BY
    if (this.groupByFields.length > 0) {
      query += " GROUP BY " + this.groupByFields.join(", ");
    }

    // Add HAVING
    if (this.havingClauses.length > 0) {
      query += " HAVING " + this.havingClauses.join(" AND ");
    }

    // Add ORDER BY
    if (this.options.orderBy) {
      query += ` ORDER BY ${this.options.orderBy} ${this.options.orderDirection}`;
    }

    // Add LIMIT
    if (this.options.limit) {
      query += ` LIMIT ${this.options.limit}`;
    }

    // Add OFFSET
    if (this.options.offset) {
      query += ` OFFSET ${this.options.offset}`;
    }

    logger.debug("Built query", "EMAIL_QUERY", { query, params });
    return { query, params };
  }

  /**
   * Reset the builder
   */
  reset(): this {
    this.selectFields = ["*"];
    this.filters = [];
    this.joins = [];
    this.groupByFields = [];
    this.havingClauses = [];
    this.options = {};
    return this;
  }

  /**
   * Common query patterns
   */
  static emailAnalytics() {
    return new EmailQueryBuilder("email_analysis").leftJoin(
      "emails",
      "email_analysis.email_id = emails.id",
    );
  }

  static emailsWithAnalysis() {
    return new EmailQueryBuilder("emails").leftJoin(
      "email_analysis",
      "emails.id = email_analysis.email_id",
    );
  }

  static processingMetrics() {
    return new EmailQueryBuilder("email_analysis")
      .select([
        "primary_workflow",
        "COUNT(*) as count",
        "AVG(processing_time_ms) as avg_time",
        "MIN(processing_time_ms) as min_time",
        "MAX(processing_time_ms) as max_time",
      ])
      .where("workflow_state", "=", "COMPLETE")
      .groupBy("primary_workflow");
  }
}
