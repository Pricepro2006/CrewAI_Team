/**
 * Walmart Grocery Integration Coordinator
 * Central orchestration hub for all Walmart grocery agent components
 *
 * Integration Coordinator: Master coordination and integration management
 */

import { EventEmitter } from "events";
import { logger } from "../../utils/logger";
import {
  walmartErrorHandler,
  type WalmartBaseError,
  type ErrorContext,
} from "../errors/walmart-error-handler";
import { WalmartMonitoringSystem } from "../monitoring/walmart-monitoring";
import type {
  WalmartWebSocketEventType,
  WalmartEventSubscription,
  WalmartEventHandler,
} from "../../types/walmart-websocket-events";
import type {
  ShoppingCart,
  SearchQuery,
  WalmartApiResponse,
} from "../../types/walmart-grocery";
import type { WebSocketService } from "../../api/services/WebSocketService";

// =====================================================
// Integration Coordinator
// =====================================================

export class WalmartIntegrationCoordinator extends EventEmitter {
  private static instance: WalmartIntegrationCoordinator;
  private services: WalmartServiceRegistry;
  private monitoring: WalmartMonitoringSystem;
  private eventBus: WalmartEventBus;
  private config: IntegrationConfig;
  private healthStatus: IntegrationHealth;
  private initialized: boolean = false;

  private constructor(config: IntegrationConfig) {
    super();
    this.config = config;
    this.services = new WalmartServiceRegistry();
    this.eventBus = new WalmartEventBus(this);
    this.healthStatus = {
      status: "initializing",
      services: {},
      lastCheck: new Date().toISOString(),
    };
  }

  static getInstance(
    config?: IntegrationConfig,
  ): WalmartIntegrationCoordinator {
    if (!WalmartIntegrationCoordinator.instance) {
      if (!config) {
        throw new Error("Configuration required for first initialization");
      }
      WalmartIntegrationCoordinator.instance =
        new WalmartIntegrationCoordinator(config);
    }
    return WalmartIntegrationCoordinator.instance;
  }

  // =====================================================
  // Initialization and Lifecycle
  // =====================================================

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn(
        "Integration coordinator already initialized",
        "WALMART_INTEGRATION",
      );
      return;
    }

    logger.info(
      "Initializing Walmart Integration Coordinator",
      "WALMART_INTEGRATION",
    );

    try {
      // Initialize monitoring system
      this.monitoring = WalmartMonitoringSystem.create(this.config.monitoring);
      this.services.register("monitoring", this.monitoring);

      // Register error handlers
      this.setupErrorHandling();

      // Initialize WebSocket event system
      await this.eventBus.initialize();

      // Register default services
      await this.registerDefaultServices();

      // Set up health checks
      this.setupHealthChecks();

      // Start periodic tasks
      this.startPeriodicTasks();

      this.healthStatus.status = "healthy";
      this.initialized = true;

      logger.info(
        "Walmart Integration Coordinator initialized successfully",
        "WALMART_INTEGRATION",
      );

      // Emit initialization complete event
      this.emit("initialized", { timestamp: new Date().toISOString() });
    } catch (error) {
      this.healthStatus.status = "unhealthy";
      logger.error(
        "Failed to initialize Walmart Integration Coordinator",
        "WALMART_INTEGRATION",
        { error },
      );
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    logger.info(
      "Shutting down Walmart Integration Coordinator",
      "WALMART_INTEGRATION",
    );

    try {
      // Stop periodic tasks
      this.stopPeriodicTasks();

      // Shutdown services
      await this.services.shutdownAll();

      // Close event bus
      await this.eventBus.shutdown();

      this.initialized = false;
      this.healthStatus.status = "stopped";

      logger.info(
        "Walmart Integration Coordinator shutdown complete",
        "WALMART_INTEGRATION",
      );
    } catch (error) {
      logger.error("Error during shutdown", "WALMART_INTEGRATION", { error });
      throw error;
    }
  }

  // =====================================================
  // Service Management
  // =====================================================

  registerService<T extends WalmartService>(name: string, service: T): void {
    this.services.register(name, service);

    // Set up service monitoring
    this.monitoring.registerHealthCheck(`service_${name}`, async () => {
      if (
        "healthCheck" in service &&
        typeof service.healthCheck === "function"
      ) {
        await service.healthCheck();
      }
    });

    logger.info("Service registered", "WALMART_INTEGRATION", {
      serviceName: name,
    });
  }

  getService<T extends WalmartService>(name: string): T {
    const service = this.services.get<T>(name);
    if (!service) {
      throw new Error(`Service '${name}' not found`);
    }
    return service;
  }

  // =====================================================
  // Event Management
  // =====================================================

  async subscribeToEvents(
    subscription: WalmartEventSubscription,
  ): Promise<string> {
    return this.eventBus.subscribe(subscription);
  }

  async unsubscribeFromEvents(subscriptionId: string): Promise<void> {
    return this.eventBus.unsubscribe(subscriptionId);
  }

  async publishEvent<T>(
    eventType: WalmartWebSocketEventType,
    data: T,
    metadata?: EventMetadata,
  ): Promise<void> {
    return this.eventBus.publish(eventType, data, metadata);
  }

  onEvent<T>(
    eventType: WalmartWebSocketEventType,
    handler: WalmartEventHandler<T>,
  ): void {
    this.eventBus.on(eventType, handler);
  }

  offEvent<T>(
    eventType: WalmartWebSocketEventType,
    handler?: WalmartEventHandler<T>,
  ): void {
    this.eventBus.off(eventType, handler);
  }

  // =====================================================
  // Orchestrated Operations
  // =====================================================

  async searchProducts(
    query: SearchQuery,
    _context?: OperationContext,
  ): Promise<OrchestrationResult<any>> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    try {
      this.monitoring.increment("walmart.search.requests", 1, {
        operation: "search",
        userId: _context?.userId || "anonymous",
      });

      // Get search service
      const searchService = this.getService<WalmartSearchService>("search");

      // Execute search with monitoring
      const result = await this.monitoring.timer(
        "walmart.search.execution_time",
        () => searchService.search(query),
        { userId: _context?.userId || "anonymous" },
      );

      // Publish search event
      await this.publishEvent("walmart.search.completed", {
        operationId,
        query,
        results: result,
        userId: _context?.userId,
      });

      // Update metrics
      this.monitoring.increment("walmart.search.success", 1);

      return {
        success: true,
        data: result,
        operationId,
        executionTime: Date.now() - startTime,
        metadata: {
          cached: result.metadata?.cached || false,
          totalResults: result.data.length,
        },
      };
    } catch (error) {
      // Handle error through error handler
      const errorContext: ErrorContext = {
        operation: "search_products",
        userId: _context?.userId,
        requestId: operationId,
        metadata: { query },
      };

      const handlingResult = await walmartErrorHandler.handleError(
        error as Error,
        errorContext,
      );

      this.monitoring.increment("walmart.search.errors", 1, {
        error: (error as WalmartBaseError).code || "unknown",
      });

      return {
        success: false,
        error: error as WalmartBaseError,
        operationId,
        executionTime: Date.now() - startTime,
        retry: handlingResult.retry,
        retryAfter: handlingResult.retryAfter,
      };
    }
  }

  async updateCart(
    operation: CartOperation,
    _context?: OperationContext,
  ): Promise<OrchestrationResult<ShoppingCart>> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    try {
      this.monitoring.increment("walmart.cart.operations", 1, {
        operation: operation.operation,
        userId: operation.userId,
      });

      // Get cart service
      const cartService = this.getService<WalmartCartService>("cart");

      // Execute cart operation
      const result = await this.monitoring.timer(
        "walmart.cart.execution_time",
        () => cartService.updateCart(operation),
        { userId: operation.userId, operation: operation.operation },
      );

      // Publish cart event
      await this.publishEvent("walmart.cart.item_updated", {
        operationId,
        operation,
        cart: result,
        userId: operation.userId,
      });

      this.monitoring.increment("walmart.cart.success", 1);

      return {
        success: true,
        data: result,
        operationId,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      const errorContext: ErrorContext = {
        operation: "update_cart",
        userId: operation.userId,
        productId: operation.productId,
        requestId: operationId,
      };

      const handlingResult = await walmartErrorHandler.handleError(
        error as Error,
        errorContext,
      );

      this.monitoring.increment("walmart.cart.errors", 1);

      return {
        success: false,
        error: error as WalmartBaseError,
        operationId,
        executionTime: Date.now() - startTime,
        retry: handlingResult.retry,
      };
    }
  }

  async placeOrder(
    orderRequest: OrderRequest,
    _context?: OperationContext,
  ): Promise<OrchestrationResult<any>> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    try {
      this.monitoring.increment("walmart.order.attempts", 1, {
        userId: orderRequest.userId,
        fulfillmentMethod: orderRequest.fulfillment.method,
      });

      // Get order service
      const orderService = this.getService<WalmartOrderService>("order");

      // Begin transaction
      const transaction = await this.beginTransaction();

      try {
        // Place order
        const order = await this.monitoring.timer(
          "walmart.order.execution_time",
          () => orderService.placeOrder(orderRequest, transaction),
          { userId: orderRequest.userId },
        );

        // Commit transaction
        await transaction.commit();

        // Publish order events
        await this.publishEvent("walmart.order.placed", {
          operationId,
          order,
          userId: orderRequest.userId,
        });

        this.monitoring.increment("walmart.order.success", 1);

        return {
          success: true,
          data: order,
          operationId,
          executionTime: Date.now() - startTime,
        };
      } catch (error) {
        // Rollback transaction
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      const errorContext: ErrorContext = {
        operation: "place_order",
        userId: orderRequest.userId,
        requestId: operationId,
      };

      const handlingResult = await walmartErrorHandler.handleError(
        error as Error,
        errorContext,
      );

      this.monitoring.increment("walmart.order.errors", 1);

      return {
        success: false,
        error: error as WalmartBaseError,
        operationId,
        executionTime: Date.now() - startTime,
        retry: handlingResult.retry,
      };
    }
  }

  // =====================================================
  // Health and Status
  // =====================================================

  async getHealthStatus(): Promise<IntegrationHealth> {
    const systemHealth = this.monitoring.getHealthStatus();
    const serviceStatuses = await this.services.getHealthStatuses();

    this.healthStatus = {
      status: systemHealth.status,
      services: serviceStatuses,
      lastCheck: new Date().toISOString(),
      metrics: {
        totalServices: Object.keys(serviceStatuses).length,
        healthyServices: Object.values(serviceStatuses).filter(
          (s) => s.status === "healthy",
        ).length,
        unhealthyServices: Object.values(serviceStatuses).filter(
          (s) => s.status === "unhealthy",
        ).length,
      },
    };

    return this.healthStatus;
  }

  async getMetrics(): Promise<IntegrationMetrics> {
    const dashboardData = await this.monitoring.getDashboardData();

    return {
      timestamp: new Date().toISOString(),
      systemHealth: dashboardData.health,
      activeAlerts: dashboardData.alerts.length,
      operationMetrics: {
        searches: dashboardData.summary.totalSearches,
        cartOperations: dashboardData.summary.totalCartOps,
        orders: dashboardData.summary.totalOrders,
        errors: dashboardData.summary.totalErrors,
      },
      performanceMetrics: {
        averageResponseTime: dashboardData.summary.avgResponseTime,
        throughput: this.calculateThroughput(dashboardData),
        errorRate: this.calculateErrorRate(dashboardData),
      },
    };
  }

  // =====================================================
  // Private Methods
  // =====================================================

  private setupErrorHandling(): void {
    // Register global error handler
    walmartErrorHandler.registerGlobalHandler(
      async (error, context, result) => {
        // Log to monitoring system
        this.monitoring.increment("walmart.errors", 1, {
          code: error.code,
          operation: context?.operation || "unknown",
        });

        // Emit error event
        this.emit("error", {
          error,
          context,
          result,
          timestamp: new Date().toISOString(),
        });
      },
    );

    // Set up process error handlers
    process.on("unhandledRejection", (error) => {
      logger.error("Unhandled promise rejection", "WALMART_INTEGRATION", {
        error,
      });
      this.monitoring.increment("walmart.unhandled_errors", 1);
    });

    process.on("uncaughtException", (error) => {
      logger.error("Uncaught exception", "WALMART_INTEGRATION", { error });
      this.monitoring.increment("walmart.uncaught_errors", 1);
    });
  }

  private async registerDefaultServices(): Promise<void> {
    // Note: Actual service implementations would be injected
    // This shows the expected service registration pattern

    if (this.config.services.search?.enabled) {
      // const searchService = new WalmartSearchService(this.config.services.search);
      // this.registerService('search', searchService);
    }

    if (this.config.services.cart?.enabled) {
      // const cartService = new WalmartCartService(this.config.services.cart);
      // this.registerService('cart', cartService);
    }

    if (this.config.services.order?.enabled) {
      // const orderService = new WalmartOrderService(this.config.services.order);
      // this.registerService('order', orderService);
    }

    logger.info("Default services registered", "WALMART_INTEGRATION");
  }

  private setupHealthChecks(): void {
    this.monitoring.registerHealthCheck("integration_coordinator", async () => {
      if (!this.initialized) {
        throw new Error("Integration coordinator not initialized");
      }

      // Check if all critical services are healthy
      const criticalServices = ["search", "cart", "order"];
      for (const serviceName of criticalServices) {
        const service = this.services.get(serviceName);
        if (service && "healthCheck" in service) {
          await (service as any).healthCheck();
        }
      }
    });
  }

  private startPeriodicTasks(): void {
    // Update health status every 30 seconds
    setInterval(() => {
      this.getHealthStatus().catch((error) => {
        logger.error("Health check failed", "WALMART_INTEGRATION", { error });
      });
    }, 30000);

    // Emit metrics every minute
    setInterval(() => {
      this.getMetrics()
        .then((metrics) => {
          this.emit("metrics", metrics);
        })
        .catch((error) => {
          logger.error("Metrics collection failed", "WALMART_INTEGRATION", {
            error,
          });
        });
    }, 60000);
  }

  private stopPeriodicTasks(): void {
    // Clear all intervals - in a real implementation,
    // you'd store interval IDs and clear them individually
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async beginTransaction(): Promise<WalmartTransaction> {
    // Implementation would depend on your database/transaction system
    return {
      commit: async () => {
        /* commit logic */
      },
      rollback: async () => {
        /* rollback logic */
      },
    };
  }

  private calculateThroughput(dashboardData: any): number {
    const totalOperations =
      dashboardData.summary.totalSearches +
      dashboardData.summary.totalCartOps +
      dashboardData.summary.totalOrders;
    return totalOperations / 60; // operations per minute
  }

  private calculateErrorRate(dashboardData: any): number {
    const totalOperations =
      dashboardData.summary.totalSearches +
      dashboardData.summary.totalCartOps +
      dashboardData.summary.totalOrders;
    const totalErrors = dashboardData.summary.totalErrors;
    return totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0;
  }
}

// =====================================================
// Supporting Classes
// =====================================================

class WalmartServiceRegistry {
  private services: Map<string, WalmartService> = new Map();

  register<T extends WalmartService>(name: string, service: T): void {
    this.services.set(name, service);
  }

  get<T extends WalmartService>(name: string): T | undefined {
    return this.services.get(name) as T | undefined;
  }

  async shutdownAll(): Promise<void> {
    const shutdownPromises = Array.from(this.services.values()).map(
      (service) => {
        if ("shutdown" in service && typeof service.shutdown === "function") {
          return (service as any).shutdown();
        }
        return Promise.resolve();
      },
    );

    await Promise.allSettled(shutdownPromises);
    this.services.clear();
  }

  async getHealthStatuses(): Promise<Record<string, ServiceHealth>> {
    const statuses: Record<string, ServiceHealth> = {};

    const healthPromises = Array.from(this.services.entries()).map(
      async ([name, service]) => {
        try {
          if (
            "healthCheck" in service &&
            typeof service.healthCheck === "function"
          ) {
            await (service as any).healthCheck();
            statuses[name] = {
              status: "healthy",
              lastCheck: new Date().toISOString(),
            };
          } else {
            statuses[name] = {
              status: "unknown",
              lastCheck: new Date().toISOString(),
            };
          }
        } catch (error) {
          statuses[name] = {
            status: "unhealthy",
            lastCheck: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    );

    await Promise.allSettled(healthPromises);
    return statuses;
  }
}

class WalmartEventBus extends EventEmitter {
  private subscriptions: Map<string, EventSubscription> = new Map();
  private wsService?: WebSocketService;

  constructor(private coordinator: WalmartIntegrationCoordinator) {
    super();
  }

  async initialize(): Promise<void> {
    // Initialize WebSocket service integration
    logger.info("Event bus initialized", "WALMART_INTEGRATION");
  }

  async shutdown(): Promise<void> {
    this.subscriptions.clear();
    this.removeAllListeners();
    logger.info("Event bus shutdown", "WALMART_INTEGRATION");
  }

  async subscribe(subscription: WalmartEventSubscription): Promise<string> {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const eventSub: EventSubscription = {
      id: subscriptionId,
      channels: subscription.channels,
      events: subscription.events,
      filters: subscription.filters,
      handler: (event) => {
        this.emit(event.type, event);
      },
    };

    this.subscriptions.set(subscriptionId, eventSub);

    logger.debug("Event subscription created", "WALMART_INTEGRATION", {
      subscriptionId,
      channels: subscription.channels.length,
      events: subscription.events?.length || 0,
    });

    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      this.subscriptions.delete(subscriptionId);
      logger.debug("Event subscription removed", "WALMART_INTEGRATION", {
        subscriptionId,
      });
    }
  }

  async publish<T>(
    eventType: WalmartWebSocketEventType,
    data: T,
    metadata?: EventMetadata,
  ): Promise<void> {
    const event = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: eventType,
      data,
      timestamp: new Date().toISOString(),
      metadata,
    };

    // Emit locally
    this.emit(eventType, event);

    // Publish via WebSocket if available
    if (this.wsService) {
      await this.wsService.broadcast(eventType, event);
    }

    logger.debug("Event published", "WALMART_INTEGRATION", {
      eventType,
      eventId: event.id,
    });
  }
}

// =====================================================
// Type Definitions
// =====================================================

export interface WalmartService {
  name: string;
  healthCheck?(): Promise<void>;
  shutdown?(): Promise<void>;
}

export interface WalmartSearchService extends WalmartService {
  search(query: SearchQuery): Promise<WalmartApiResponse<SearchResults>>;
}

export interface WalmartCartService extends WalmartService {
  updateCart(operation: CartOperation): Promise<ShoppingCart>;
  getCart(userId: string): Promise<ShoppingCart>;
}

export interface WalmartOrderService extends WalmartService {
  placeOrder(
    request: OrderRequest,
    transaction?: WalmartTransaction,
  ): Promise<Order>;
  getOrder(orderId: string): Promise<Order>;
}

export interface IntegrationConfig {
  monitoring: {
    metrics: {
      maxHistorySize: number;
      retentionPeriod: number;
    };
    storage: {
      type: "memory" | "redis" | "influxdb";
      connectionString?: string;
    };
    alerts: {
      enabled: boolean;
      webhookUrl?: string;
    };
  };
  services: {
    search?: { enabled: boolean; config?: any };
    cart?: { enabled: boolean; config?: any };
    order?: { enabled: boolean; config?: any };
    scraping?: { enabled: boolean; config?: any };
  };
  events: {
    websocket: {
      enabled: boolean;
      url?: string;
    };
  };
}

export interface OperationContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface OrchestrationResult<T> {
  success: boolean;
  data?: T;
  error?: WalmartBaseError;
  operationId: string;
  executionTime: number;
  retry?: boolean;
  retryAfter?: number;
  metadata?: Record<string, unknown>;
}

export interface CartOperation {
  userId: string;
  productId: string;
  quantity: number;
  operation: "add" | "update" | "remove";
}

export interface OrderRequest {
  userId: string;
  cartId: string;
  fulfillment: {
    method: "pickup" | "delivery";
    storeId?: string;
    address?: any;
    timeSlot?: any;
  };
  payment: {
    method: string;
    token?: string;
  };
}

export interface WalmartTransaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface IntegrationHealth {
  status: "healthy" | "degraded" | "unhealthy" | "initializing" | "stopped";
  services: Record<string, ServiceHealth>;
  lastCheck: string;
  metrics?: {
    totalServices: number;
    healthyServices: number;
    unhealthyServices: number;
  };
}

export interface ServiceHealth {
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  lastCheck: string;
  error?: string;
  responseTime?: number;
}

export interface IntegrationMetrics {
  timestamp: string;
  systemHealth: any;
  activeAlerts: number;
  operationMetrics: {
    searches: number;
    cartOperations: number;
    orders: number;
    errors: number;
  };
  performanceMetrics: {
    averageResponseTime: number;
    throughput: number;
    errorRate: number;
  };
}

export interface EventSubscription {
  id: string;
  channels: string[];
  events?: WalmartWebSocketEventType[];
  filters?: any;
  handler: (event: any) => void;
}

export interface EventMetadata {
  source?: string;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
}

// Export default configuration
export const DEFAULT_INTEGRATION_CONFIG: IntegrationConfig = {
  monitoring: {
    metrics: {
      maxHistorySize: 1000,
      retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
    storage: {
      type: "memory",
    },
    alerts: {
      enabled: true,
    },
  },
  services: {
    search: { enabled: true },
    cart: { enabled: true },
    order: { enabled: true },
    scraping: { enabled: true },
  },
  events: {
    websocket: {
      enabled: true,
    },
  },
};

// Export convenience function
export function createWalmartIntegration(
  config?: Partial<IntegrationConfig>,
): WalmartIntegrationCoordinator {
  const fullConfig = { ...DEFAULT_INTEGRATION_CONFIG, ...config };
  return WalmartIntegrationCoordinator.getInstance(fullConfig);
}
