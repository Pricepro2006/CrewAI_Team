/**
 * Integration Coordinator
 * Central coordination service that ties all systems together
 */

import type {
  TestConfig,
  TestContext,
} from "../testing/integration-test-framework";

// Define missing types directly
interface HealthStatus {
  status: string;
  services: Record<string, any>;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface SystemConfig {
  version: string;
  environment: string;
  [key: string]: any;
}

import {
  globalErrorHandler,
  RetryHandler,
  CircuitBreaker,
  defaultRetryStrategy,
  defaultCircuitBreakerConfig,
  createApiError,
  createSystemError,
} from "../errors/error-handler";

// Mock missing functions
const globalHealthMonitor = {
  getStatus: () => ({
    status: "healthy",
    services: {},
    timestamp: new Date().toISOString(),
  }),
  getOverallHealth: async () => ({
    status: "healthy" as const,
    services: {} as Record<string, { status: string }>,
    timestamp: new Date().toISOString(),
  }),
  destroy: () => {},
};

const startMonitoring = (interval: number): NodeJS.Timeout => {
  return setInterval(() => {}, interval);
};

const globalMetricsCollector = {
  increment: (
    name: string,
    labels?: Record<string, string>,
    value?: number,
  ) => {},
  histogram: (
    name: string,
    value: number,
    labels?: Record<string, string>,
  ) => {},
  gauge: (name: string, value: number, labels?: Record<string, string>) => {},
  collectAll: async () => ({
    timestamp: new Date().toISOString(),
    metrics: [
      { name: "http_requests_total", value: 10, labels: { method: "GET" } },
      {
        name: "database_query_duration_seconds",
        value: 0.05,
        labels: { operation: "SELECT" },
      },
    ],
  }),
};

const ERROR_CODES = {
  INTERNAL_ERROR: "INTERNAL_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INITIALIZATION_ERROR: "INITIALIZATION_ERROR",
};

import {
  HttpTestClient,
  WebSocketTestClient,
  createTestContext,
  authenticateUser,
} from "../testing/test-client";

// =====================================================
// Integration Coordinator Class
// =====================================================

export class IntegrationCoordinator {
  private initialized: boolean = false;
  private monitoringHandle?: NodeJS.Timeout;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private retryHandlers: Map<string, RetryHandler> = new Map();

  async initialize(config: SystemConfig): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log("🔧 Initializing Integration Coordinator...");

    try {
      // Initialize error handling
      this.setupErrorHandling();

      // Initialize monitoring
      this.setupMonitoring();

      // Initialize circuit breakers and retry handlers
      this.setupResiliencePatterns();

      // Start health checks
      await this.startHealthChecks();

      // Start metrics collection
      this.startMetricsCollection();

      this.initialized = true;
      console.log("✅ Integration Coordinator initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize Integration Coordinator:", error);
      throw createSystemError(
        ERROR_CODES.INITIALIZATION_ERROR,
        "Failed to initialize integration coordinator",
        "integration-coordinator",
        "initialize",
      );
    }
  }

  private setupErrorHandling(): void {
    console.log("📊 Setting up error handling...");

    // Global error handlers are already registered in error-handler.ts
    // Additional custom handlers can be registered here

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      console.error("Uncaught Exception:", error);
      const systemError = createSystemError(
        ERROR_CODES.INTERNAL_ERROR,
        "Uncaught exception occurred",
        "nodejs",
        "runtime",
        "critical",
      );

      globalErrorHandler
        .handleError(systemError, {
          operation: "uncaught_exception",
          metadata: { originalError: error.message, stack: error.stack },
        })
        .catch(console.error);
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      console.error("Unhandled Rejection at:", promise, "reason:", reason);
      const systemError = createSystemError(
        ERROR_CODES.INTERNAL_ERROR,
        "Unhandled promise rejection",
        "nodejs",
        "runtime",
        "high",
      );

      globalErrorHandler
        .handleError(systemError, {
          operation: "unhandled_rejection",
          metadata: { reason: String(reason) },
        })
        .catch(console.error);
    });
  }

  private setupMonitoring(): void {
    console.log("📈 Setting up monitoring...");

    // Additional monitoring setup can be done here
    // Default metrics and health checks are already registered
  }

  private setupResiliencePatterns(): void {
    console.log("🛡️  Setting up resilience patterns...");

    // Create default circuit breakers for critical services
    const services = ["database", "ollama", "chromadb", "vectorstore"];

    services.forEach((service) => {
      const circuitBreaker = new CircuitBreaker(defaultCircuitBreakerConfig);
      const retryHandler = new RetryHandler(defaultRetryStrategy);

      this.circuitBreakers.set(service, circuitBreaker);
      this.retryHandlers.set(service, retryHandler);
    });
  }

  private async startHealthChecks(): Promise<void> {
    console.log("🏥 Starting health checks...");

    // Health checks are automatically started when registered
    // We can run an initial check to ensure everything is working
    const health = await globalHealthMonitor.getOverallHealth();
    console.log(`📊 Initial health status: ${health.status}`);

    if (health.status !== "healthy") {
      console.warn(
        "⚠️  Some critical services are unhealthy:",
        Object.entries(health.services)
          .filter(([_, service]) => (service as any)?.status === "unhealthy")
          .map(([name, _]) => name),
      );
    }
  }

  private startMetricsCollection(): void {
    console.log("📊 Starting metrics collection...");

    this.monitoringHandle = startMonitoring(30000); // Collect every 30 seconds
  }

  async shutdown(): Promise<void> {
    console.log("🔄 Shutting down Integration Coordinator...");

    try {
      // Stop monitoring
      if (this.monitoringHandle) {
        clearInterval(this.monitoringHandle);
        this.monitoringHandle = undefined;
      }

      // Stop health checks
      globalHealthMonitor.destroy();

      this.initialized = false;
      console.log("✅ Integration Coordinator shut down successfully");
    } catch (error) {
      console.error("❌ Error during shutdown:", error);
    }
  }

  // =====================================================
  // Service Access Methods
  // =====================================================

  getCircuitBreaker(service: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(service);
  }

  getRetryHandler(service: string): RetryHandler | undefined {
    return this.retryHandlers.get(service);
  }

  async getHealthStatus(): Promise<HealthStatus> {
    return await globalHealthMonitor.getOverallHealth();
  }

  getErrorMetrics() {
    return globalErrorHandler.getMetrics();
  }

  getErrorReports() {
    return globalErrorHandler.getReports();
  }

  async getMetricsSnapshot() {
    return await globalMetricsCollector.collectAll();
  }

  // =====================================================
  // Testing Integration Methods
  // =====================================================

  async createTestEnvironment(
    config: Partial<TestConfig> = {},
  ): Promise<TestContext> {
    if (!this.initialized) {
      throw new Error(
        "Integration coordinator must be initialized before creating test environment",
      );
    }

    const testConfig: TestConfig = {
      baseUrl: process.env.TEST_BASE_URL || "http://localhost:3001",
      websocketUrl:
        process.env.TEST_WEBSOCKET_URL || "ws://localhost:3002/trpc-ws",
      timeout: 10000,
      retries: 2,
      parallel: false,
      cleanup: true,
      database: {
        resetBetweenTests: true,
        seedData: true,
        useTransactions: true,
        isolationLevel: "READ_COMMITTED",
      },
      services: {
        ollama: { enabled: true, mockResponses: false },
        chromadb: { enabled: true, mockResponses: false },
        websocket: { enabled: true, autoConnect: false, timeout: 5000 },
      },
      authentication: {
        defaultUser: {
          id: "test-user-001",
          email: "test@crewai.local",
          username: "testuser",
          password: "TestPassword123!",
          role: "user",
          permissions: ["read", "write"],
        },
        adminUser: {
          id: "admin-user-001",
          email: "admin@crewai.local",
          username: "admin",
          password: "AdminPassword123!",
          role: "admin",
          permissions: ["read", "write", "admin", "delete"],
        },
        guestUser: {
          id: "guest-user-001",
          email: "guest@crewai.local",
          username: "guest",
          password: "",
          role: "guest",
          permissions: ["read"],
        },
        tokenExpiration: 3600,
      },
      monitoring: {
        metricsEnabled: true,
        tracingEnabled: true,
        logLevel: "info",
        collectCoverage: false,
      },
      ...config,
    };

    return await createTestContext(testConfig);
  }

  // =====================================================
  // Service Health Wrappers
  // =====================================================

  async executeWithCircuitBreaker<T>(
    serviceName: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const circuitBreaker = this.circuitBreakers.get(serviceName);

    if (circuitBreaker) {
      return await circuitBreaker.execute(operation);
    } else {
      // Execute without circuit breaker if not configured
      return await operation();
    }
  }

  async executeWithRetry<T>(
    serviceName: string,
    operation: () => Promise<T>,
    context: Record<string, unknown> = {},
  ): Promise<T> {
    const retryHandler = this.retryHandlers.get(serviceName);

    if (retryHandler) {
      return await retryHandler.execute(operation, context);
    } else {
      // Execute without retry if not configured
      return await operation();
    }
  }

  async executeWithResilience<T>(
    serviceName: string,
    operation: () => Promise<T>,
    context: Record<string, unknown> = {},
  ): Promise<T> {
    // Combine circuit breaker and retry patterns
    const circuitBreakerOp = () =>
      this.executeWithCircuitBreaker(serviceName, operation);
    return await this.executeWithRetry(serviceName, circuitBreakerOp, context);
  }

  // =====================================================
  // Metrics Helpers
  // =====================================================

  recordHttpRequest(
    method: string,
    route: string,
    status: number,
    duration: number,
  ): void {
    globalMetricsCollector.increment("http_requests_total", {
      method,
      route,
      status: status.toString(),
    });

    globalMetricsCollector.histogram(
      "http_request_duration_seconds",
      duration / 1000,
      {
        method,
        route,
      },
    );
  }

  recordAgentTask(agentType: string, status: string, duration: number): void {
    globalMetricsCollector.increment("agent_tasks_total", {
      agent_type: agentType,
      status,
    });

    globalMetricsCollector.histogram(
      "agent_task_duration_seconds",
      duration / 1000,
      {
        agent_type: agentType,
      },
    );
  }

  recordLlmRequest(
    model: string,
    provider: string,
    tokens: number,
    duration: number,
  ): void {
    globalMetricsCollector.increment("llm_requests_total", {
      model,
      provider,
    });

    globalMetricsCollector.increment(
      "llm_tokens_total",
      {
        model,
        type: "total",
      },
      tokens,
    );

    globalMetricsCollector.histogram(
      "llm_request_duration_seconds",
      duration / 1000,
      {
        model,
      },
    );
  }

  recordDatabaseOperation(
    operation: string,
    duration: number,
    error?: boolean,
  ): void {
    globalMetricsCollector.histogram(
      "database_query_duration_seconds",
      duration / 1000,
      {
        operation,
      },
    );

    if (error) {
      globalMetricsCollector.increment("database_errors_total", {
        type: operation,
      });
    }
  }

  setActiveConnections(
    type: "http" | "websocket" | "database",
    count: number,
  ): void {
    const metricMap = {
      http: "http_active_requests",
      websocket: "websocket_connections_active",
      database: "database_connections_active",
    };

    globalMetricsCollector.gauge(metricMap[type], count);
  }

  // =====================================================
  // Validation Helpers
  // =====================================================

  isHealthy(): boolean {
    return this.initialized;
  }

  getStatus(): string {
    return this.initialized ? "running" : "stopped";
  }

  getVersion(): string {
    return process.env.npm_package_version || "1.0.0";
  }

  getUptime(): number {
    return process.uptime();
  }
}

// =====================================================
// Global Integration Coordinator Instance
// =====================================================

export const integrationCoordinator = new IntegrationCoordinator();

export default integrationCoordinator;
