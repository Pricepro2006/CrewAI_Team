import { EventEmitter } from 'events';
import { z } from 'zod';
import type { BaseEvent, EventHandler } from './EventBus.js';

// Routing schemas and types
export const RouteRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean().default(true),
  priority: z.number().default(100), // Lower number = higher priority
  conditions: z.object({
    eventType: z.union([z.string(), z.array(z.string())]).optional(),
    eventTypePattern: z.string().optional(), // Regex pattern
    source: z.union([z.string(), z.array(z.string())]).optional(),
    sourcePattern: z.string().optional(),
    metadata: z.record(z.any()).optional(),
    payload: z.record(z.any()).optional(),
    customFilter: z.string().optional() // JavaScript expression
  }),
  actions: z.object({
    route: z.array(z.string()).default([]), // Target services/handlers
    transform: z.string().optional(), // Transform function
    enrich: z.record(z.any()).optional(), // Additional metadata to add
    delay: z.number().optional(), // Delay in milliseconds
    priority: z.number().optional(), // Override event priority
    duplicate: z.boolean().default(false), // Allow multiple deliveries
    dlq: z.boolean().default(false) // Send to dead letter queue on failure
  }),
  metadata: z.record(z.string()).default({})
});

export const RoutingTableSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string().default('1.0.0'),
  rules: z.array(RouteRuleSchema),
  defaultRoute: z.array(z.string()).default([]),
  createdAt: z.number(),
  updatedAt: z.number()
});

export const FilterSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['include', 'exclude', 'transform', 'enrich']),
  enabled: z.boolean().default(true),
  conditions: z.object({
    eventType: z.string().optional(),
    source: z.string().optional(),
    expression: z.string().optional() // JavaScript condition
  }),
  action: z.object({
    transform: z.string().optional(),
    addMetadata: z.record(z.any()).optional(),
    removeFields: z.array(z.string()).optional()
  }).optional()
});

export type RouteRule = z.infer<typeof RouteRuleSchema>;
export type RoutingTable = z.infer<typeof RoutingTableSchema>;
export type EventFilter = z.infer<typeof FilterSchema>;

export interface RoutingResult {
  matched: boolean;
  routes: string[];
  transformedEvent?: BaseEvent;
  metadata: {
    ruleId?: string;
    ruleName?: string;
    processingTime: number;
    priority: number;
  };
}

export interface FilterResult {
  passed: boolean;
  event: BaseEvent;
  metadata: {
    filtersApplied: string[];
    transformations: string[];
  };
}

/**
 * EventRouter - Advanced message routing and filtering system
 * 
 * Features:
 * - Rule-based event routing with priority ordering
 * - Pattern matching and regex support
 * - Event transformation and enrichment
 * - Content-based filtering
 * - Dead letter queue support
 * - Performance monitoring and metrics
 */
export class EventRouter extends EventEmitter {
  private routingTables = new Map<string, RoutingTable>();
  private filters = new Map<string, EventFilter>();
  private handlers = new Map<string, EventHandler>();
  private routingCache = new Map<string, RoutingResult>();
  private metrics = {
    routedEvents: 0,
    filteredEvents: 0,
    transformedEvents: 0,
    routingErrors: 0,
    averageRoutingTime: 0
  };

  constructor() {
    super();
    this.setupDefaultFilters();
    this.startMetricsCollection();
  }

  private setupDefaultFilters(): void {
    // Add some common filters
    this.addFilter({
      id: 'system_events_filter',
      name: 'System Events Filter',
      type: 'include',
      enabled: true,
      conditions: {
        eventType: 'system.*'
      }
    });

    this.addFilter({
      id: 'sensitive_data_filter',
      name: 'Sensitive Data Filter',
      type: 'transform',
      enabled: true,
      conditions: {
        expression: 'event?.payload?.password || event?.payload?.token || event?.payload?.secret'
      },
      action: {
        removeFields: ['payload.password', 'payload.token', 'payload.secret'],
        addMetadata: { 'filtered': 'sensitive_data_removed' }
      }
    });
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.emit('metrics', { ...this.metrics, timestamp: Date.now() });
    }, 60000); // Every minute
  }

  // Routing table management
  public addRoutingTable(table: Omit<RoutingTable, 'createdAt' | 'updatedAt'>): void {
    const now = Date.now();
    const routingTable: RoutingTable = {
      ...table,
      createdAt: now,
      updatedAt: now
    };

    // Validate the routing table
    RoutingTableSchema.parse(routingTable);

    // Sort rules by priority (lower number = higher priority)
    routingTable?.rules?.sort((a, b) => a.priority - b.priority);

    this?.routingTables?.set(table.id, routingTable);
    this.clearRoutingCache(); // Clear cache when rules change

    this.emit('routing_table_added', {
      tableId: table.id,
      rulesCount: table?.rules?.length
    });
  }

  public removeRoutingTable(tableId: string): boolean {
    const removed = this?.routingTables?.delete(tableId);
    if (removed) {
      this.clearRoutingCache();
      this.emit('routing_table_removed', { tableId });
    }
    return removed;
  }

  public getRoutingTable(tableId: string): RoutingTable | undefined {
    return this?.routingTables?.get(tableId);
  }

  public listRoutingTables(): RoutingTable[] {
    return Array.from(this?.routingTables?.values());
  }

  // Filter management
  public addFilter(filter: EventFilter): void {
    FilterSchema.parse(filter);
    this?.filters?.set(filter.id, filter);
    
    this.emit('filter_added', {
      filterId: filter.id,
      type: filter.type
    });
  }

  public removeFilter(filterId: string): boolean {
    const removed = this?.filters?.delete(filterId);
    if (removed) {
      this.emit('filter_removed', { filterId });
    }
    return removed;
  }

  public getFilter(filterId: string): EventFilter | undefined {
    return this?.filters?.get(filterId);
  }

  public listFilters(): EventFilter[] {
    return Array.from(this?.filters?.values());
  }

  // Handler registration
  public registerHandler(handlerId: string, handler: EventHandler): void {
    this?.handlers?.set(handlerId, handler);
    
    this.emit('handler_registered', {
      handlerId,
      eventType: handler.eventType
    });
  }

  public unregisterHandler(handlerId: string): boolean {
    const removed = this?.handlers?.delete(handlerId);
    if (removed) {
      this.emit('handler_unregistered', { handlerId });
    }
    return removed;
  }

  // Core routing functionality
  public async routeEvent(event: BaseEvent, tableId?: string): Promise<RoutingResult> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = this.getCacheKey(event, tableId);
      if (this?.routingCache?.has(cacheKey)) {
        const cached = this?.routingCache?.get(cacheKey)!;
        return {
          ...cached,
          metadata: {
            ...cached.metadata,
            processingTime: Date.now() - startTime
          }
        };
      }

      let routes: string[] = [];
      let transformedEvent = event;
      let matchedRule: RouteRule | undefined;

      // Apply filters first
      const filterResult = await this.applyFilters(event);
      if (!filterResult.passed) {
        this.metrics.filteredEvents++;
        return {
          matched: false,
          routes: [],
          metadata: {
            processingTime: Date.now() - startTime,
            priority: 0
          }
        };
      }

      transformedEvent = filterResult.event;
      if ((filterResult.metadata?.transformations?.length || 0) > 0) {
        this.metrics.transformedEvents++;
      }

      // Route through specific table or all tables
      const tablesToCheck = tableId 
        ? [this?.routingTables?.get(tableId)].filter(Boolean) as RoutingTable[]
        : Array.from(this?.routingTables?.values());

      for (const table of tablesToCheck) {
        for (const rule of table.rules) {
          if (!rule.enabled) continue;

          if (await this.evaluateRule(rule, transformedEvent)) {
            matchedRule = rule;
            routes.push(...rule.actions.route);

            // Apply rule transformations
            if (rule.actions.transform) {
              transformedEvent = await this.applyTransformation(
                transformedEvent,
                rule.actions.transform
              );
            }

            // Apply enrichment
            if (rule.actions.enrich) {
              transformedEvent = {
                ...transformedEvent,
                metadata: {
                  ...transformedEvent.metadata,
                  ...rule.actions.enrich
                }
              };
            }

            // If not allowing duplicates, stop at first match
            if (!rule.actions.duplicate) {
              break;
            }
          }
        }

        if (routes.length > 0 && !matchedRule?.actions.duplicate) {
          break;
        }
      }

      // Use default routes if no matches
      if (routes.length === 0) {
        for (const table of tablesToCheck) {
          routes.push(...table.defaultRoute);
        }
      }

      const result: RoutingResult = {
        matched: routes.length > 0,
        routes: [...new Set(routes)], // Remove duplicates
        transformedEvent: transformedEvent !== event ? transformedEvent : undefined,
        metadata: {
          ruleId: matchedRule?.id,
          ruleName: matchedRule?.name,
          processingTime: Date.now() - startTime,
          priority: matchedRule?.priority || 0
        }
      };

      // Cache the result
      if (this.routingCache.size < 1000) { // Limit cache size
      this.routingCache.set(cacheKey, result);
      }

      this.metrics.routedEvents++;
      this.updateAverageRoutingTime(result.metadata.processingTime);

      this.emit('event_routed', {
        eventId: event.id,
        eventType: event.type,
        routes: result.routes,
        ruleMatched: !!matchedRule,
        processingTime: result.metadata.processingTime
      });

      return result;

    } catch (error) {
      this.metrics.routingErrors++;
      this.emit('routing_error', {
        eventId: event.id,
        error,
        processingTime: Date.now() - startTime
      });
      throw error;
    }
  }

  public async filterEvent(event: BaseEvent): Promise<FilterResult> {
    return await this.applyFilters(event);
  }

  // Rule evaluation
  private async evaluateRule(rule: RouteRule, event: BaseEvent): Promise<boolean> {
    try {
      const { conditions } = rule;

      // Event type matching
      if (conditions.eventType) {
        if (Array.isArray(conditions.eventType)) {
          if (!conditions.eventType.includes(event.type)) {
            return false;
          }
        } else {
          if (event.type !== conditions.eventType) {
            return false;
          }
        }
      }

      // Event type pattern matching
      if (conditions.eventTypePattern) {
        const regex = new RegExp(conditions.eventTypePattern);
        if (!regex.test(event.type)) {
          return false;
        }
      }

      // Source matching
      if (conditions.source) {
        if (Array.isArray(conditions.source)) {
          if (!conditions.source.includes(event.source)) {
            return false;
          }
        } else {
          if (event.source !== conditions.source) {
            return false;
          }
        }
      }

      // Source pattern matching
      if (conditions.sourcePattern) {
        const regex = new RegExp(conditions.sourcePattern);
        if (!regex.test(event.source)) {
          return false;
        }
      }

      // Metadata matching
      if (conditions.metadata) {
        for (const [key, value] of Object.entries(conditions.metadata)) {
          if (event.metadata[key] !== value) {
            return false;
          }
        }
      }

      // Payload matching
      if (conditions.payload) {
        for (const [key, value] of Object.entries(conditions.payload)) {
          if (event.payload[key] !== value) {
            return false;
          }
        }
      }

      // Custom filter evaluation
      if (conditions.customFilter) {
        try {
          const result = this.evaluateJavaScript(conditions.customFilter, { event });
          if (!result) {
            return false;
          }
        } catch (error) {
          this.emit('rule_evaluation_error', {
            ruleId: rule.id,
            expression: conditions.customFilter,
            error
          });
          return false;
        }
      }

      return true;

    } catch (error) {
      this.emit('rule_evaluation_error', {
        ruleId: rule.id,
        error
      });
      return false;
    }
  }

  // Filter application
  private async applyFilters(event: BaseEvent): Promise<FilterResult> {
    let currentEvent = { ...event };
    const filtersApplied: string[] = [];
    const transformations: string[] = [];

    // Sort filters by type (include/exclude first, then transform/enrich)
    const sortedFilters = Array.from(this?.filters?.values())
      .filter(f => f.enabled)
      .sort((a, b) => {
        const order = { include: 1, exclude: 2, transform: 3, enrich: 4 };
        return order[a.type] - order[b.type];
      });

    for (const filter of sortedFilters) {
      try {
        const matches = await this.evaluateFilterConditions(filter, currentEvent);
        
        if (!matches) continue;

        filtersApplied.push(filter.id);

        switch (filter.type) {
          case 'include':
            // Event passes if it matches an include filter
            break;

          case 'exclude':
            // Event is excluded if it matches an exclude filter
            return {
              passed: false,
              event: currentEvent,
              metadata: { filtersApplied, transformations }
            };

          case 'transform':
            if (filter.action) {
              currentEvent = await this.applyFilterAction(currentEvent, filter.action);
              transformations.push(filter.id);
            }
            break;

          case 'enrich':
            if (filter.action?.addMetadata) {
              currentEvent = {
                ...currentEvent,
                metadata: {
                  ...currentEvent.metadata,
                  ...filter?.action?.addMetadata
                }
              };
              transformations.push(filter.id);
            }
            break;
        }

      } catch (error) {
        this.emit('filter_error', {
          filterId: filter.id,
          eventId: event.id,
          error
        });
      }
    }

    return {
      passed: true,
      event: currentEvent,
      metadata: { filtersApplied, transformations }
    };
  }

  private async evaluateFilterConditions(filter: EventFilter, event: BaseEvent): Promise<boolean> {
    const { conditions } = filter;

    if (conditions.eventType && event.type !== conditions.eventType) {
      return false;
    }

    if (conditions.source && event.source !== conditions.source) {
      return false;
    }

    if (conditions.expression) {
      try {
        return this.evaluateJavaScript(conditions.expression, { event });
      } catch (error) {
        return false;
      }
    }

    return true;
  }

  private async applyFilterAction(event: BaseEvent, action: NonNullable<EventFilter['action']>): Promise<BaseEvent> {
    let result = { ...event };

    // Remove fields
    if (action.removeFields) {
      for (const fieldPath of action.removeFields) {
        result = this.removeFieldByPath(result, fieldPath);
      }
    }

    // Add metadata
    if (action.addMetadata) {
      result.metadata = {
        ...result.metadata,
        ...action.addMetadata
      };
    }

    // Apply transformation
    if (action.transform) {
      result = await this.applyTransformation(result, action.transform);
    }

    return result;
  }

  private async applyTransformation(event: BaseEvent, transformation: string): Promise<BaseEvent> {
    try {
      // This would implement transformation logic
      // For now, just return the event unchanged
      // In production, this could use a sandboxed JavaScript engine
      return this.evaluateJavaScript(`(${transformation})(event)`, { event });
    } catch (error) {
      this.emit('transformation_error', {
        eventId: event.id,
        transformation,
        error
      });
      return event;
    }
  }

  // Utility methods
  private evaluateJavaScript(expression: string, context: Record<string, any>): any {
    // SECURITY WARNING: In production, this should use a sandboxed environment
    // like vm2 or a WebAssembly-based JavaScript engine
    try {
      const func = new Function(...Object.keys(context), `return ${expression}`);
      return func(...Object.values(context));
    } catch (error) {
      throw new Error(`JavaScript evaluation failed: ${error}`);
    }
  }

  private removeFieldByPath(obj: any, path: string): any {
    const parts = path.split('.');
    const result = JSON.parse(JSON.stringify(obj));
    
    if (!parts || parts.length === 0) return result;
    
    let current = result;
    const partsLength = parts.length;
    for (let i = 0; i < partsLength - 1; i++) {
      const part = parts[i];
      if (!part || !(part in current)) return result;
      current = current[part];
    }
    
    const lastPart = parts[partsLength - 1];
    if (lastPart && current && typeof current === 'object') {
      delete current[lastPart];
    }
    return result;
  }

  private getCacheKey(event: BaseEvent, tableId?: string): string {
    return `${event.type}:${event.source}:${tableId || 'all'}:${JSON.stringify(event.metadata)}`;
  }

  private clearRoutingCache(): void {
    this?.routingCache?.clear();
  }

  private updateAverageRoutingTime(newTime: number): void {
    if (this.metrics.routedEvents === 1) {
      this.metrics.averageRoutingTime = newTime;
    } else if (this.metrics.routedEvents > 1) {
      this.metrics.averageRoutingTime = (this.metrics.averageRoutingTime * (this.metrics.routedEvents - 1) + newTime) / this.metrics.routedEvents;
    }
  }

  // Public API methods
  public getMetrics() {
    return {
      ...this.metrics,
      routingTables: this.routingTables.size,
      filters: this.filters.size,
      handlers: this.handlers.size,
      cacheSize: this.routingCache.size
    };
  }

  public clearCache(): void {
    this.clearRoutingCache();
    this.emit('cache_cleared');
  }

  public async testRule(rule: RouteRule, event: BaseEvent): Promise<boolean> {
    return await this.evaluateRule(rule, event);
  }

  public async testFilter(filter: EventFilter, event: BaseEvent): Promise<FilterResult> {
    const originalFilters = new Map(this.filters);
    try {
      this?.filters?.clear();
      this?.filters?.set(filter.id, filter);
      return await this.applyFilters(event);
    } finally {
      this?.filters?.clear();
      for (const [id, f] of originalFilters) {
        this?.filters?.set(id, f);
      }
    }
  }

  public getRoutingStatistics(timeWindow: number = 60000): {
    totalRouted: number;
    averageTime: number;
    errorRate: number;
    topRoutes: Array<{ route: string; count: number }>;
  } {
    // This would track routing statistics over time
    // For now, return current metrics
    return {
      totalRouted: this.metrics.routedEvents,
      averageTime: this.metrics.averageRoutingTime,
      errorRate: this.metrics.routingErrors / Math.max(1, this.metrics.routedEvents),
      topRoutes: []
    };
  }
}