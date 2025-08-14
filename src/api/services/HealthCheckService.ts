/**
 * Health Check Service
 * Centralized health monitoring for all microservices and dependencies
 */

import { EventEmitter } from "events";
import Database from "better-sqlite3";
import { logger } from "../../utils/logger.js";
import fetch from "node-fetch";
import appConfig from "../../config/app.config.js";

export enum HealthStatus {
  HEALTHY = "healthy",
  DEGRADED = "degraded",
  UNHEALTHY = "unhealthy",
  UNKNOWN = "unknown"
}

export enum HealthCheckLevel {
  BASIC = "basic",    // Just ping/connectivity
  DEEP = "deep",      // Check functionality
  FULL = "full"       // Complete diagnostic
}

export interface ServiceHealth {
  name: string;
  status: HealthStatus;
  message?: string;
  latency?: number;
  lastCheck: string;
  details?: Record<string, any>;
}

export interface SystemHealth {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  services: ServiceHealth[];
  metrics?: {
    cpu?: number;
    memory?: number;
    responseTime?: number;
  };
}

export interface HealthCheckConfig {
  intervalMs: number;
  timeoutMs: number;
  retries: number;
  circuitBreakerThreshold: number;
}

interface CircuitBreaker {
  failures: number;
  lastFailure?: Date;
  isOpen: boolean;
  nextRetry?: Date;
}

export class HealthCheckService extends EventEmitter {
  private config: HealthCheckConfig;
  private checkInterval: NodeJS.Timeout | null = null;
  private healthHistory: SystemHealth[] = [];
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private startTime: Date;
  
  constructor(config?: Partial<HealthCheckConfig>) {
    super();
    this.config = {
      intervalMs: config?.intervalMs || 30000, // 30 seconds
      timeoutMs: config?.timeoutMs || 5000,    // 5 seconds
      retries: config?.retries || 3,
      circuitBreakerThreshold: config?.circuitBreakerThreshold || 5
    };
    this.startTime = new Date();
  }

  /**
   * Initialize health monitoring
   */
  async initialize() {
    logger.info("Initializing Health Check Service", "HEALTH");
    
    // Start periodic health checks
    this.startMonitoring();
    
    // Perform initial health check
    await this.performHealthCheck();
    
    logger.info("Health Check Service initialized", "HEALTH");
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(level: HealthCheckLevel = HealthCheckLevel.BASIC): Promise<SystemHealth> {
    const startTime = Date.now();
    const services: ServiceHealth[] = [];
    
    // Check core services in parallel
    const checks = [
      this.checkDatabase(),
      this.checkRedis(),
      this.checkOllama(),
      this.checkChromaDB(),
      this.checkMicroservice("pricing-service", 3007),
      this.checkMicroservice("nlp-service", 3008),
      this.checkMicroservice("cache-warmer", 3006),
      this.checkMicroservice("grocery-service", 3005),
      this.checkMicroservice("deal-engine", 3009),
      this.checkMicroservice("memory-monitor", 3010),
      this.checkWebSocket(),
    ];

    // Execute all checks with timeout
    const results = await Promise.allSettled(
      checks.map(check => this.withTimeout(check, this.config.timeoutMs))
    );

    // Process results
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        services.push(result.value);
      } else {
        const serviceName = this.getServiceNameByIndex(index);
        services.push({
          name: serviceName,
          status: HealthStatus.UNHEALTHY,
          message: result.reason?.message || "Health check failed",
          lastCheck: new Date().toISOString()
        });
      }
    });

    // Calculate overall system status
    const unhealthyCount = services.filter(s => s.status === HealthStatus.UNHEALTHY).length;
    const degradedCount = services.filter(s => s.status === HealthStatus.DEGRADED).length;
    
    let systemStatus: HealthStatus;
    if (unhealthyCount > 2) {
      systemStatus = HealthStatus.UNHEALTHY;
    } else if (unhealthyCount > 0 || degradedCount > 2) {
      systemStatus = HealthStatus.DEGRADED;
    } else {
      systemStatus = HealthStatus.HEALTHY;
    }

    const health: SystemHealth = {
      status: systemStatus,
      timestamp: new Date().toISOString(),
      uptime: (Date.now() - this.startTime.getTime()) / 1000,
      services,
      metrics: {
        responseTime: Date.now() - startTime,
        memory: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        cpu: process.cpuUsage().user / 1000000 // seconds
      }
    };

    // Store in history (keep last 100 checks)
    this.healthHistory.push(health);
    if (this.healthHistory.length > 100) {
      this.healthHistory.shift();
    }

    // Emit health status
    this.emit("health:check", health);
    
    if (systemStatus === HealthStatus.UNHEALTHY) {
      this.emit("health:critical", health);
    } else if (systemStatus === HealthStatus.DEGRADED) {
      this.emit("health:warning", health);
    }

    return health;
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const db = new Database(
        process.env['DATABASE_PATH'] || appConfig.database?.path || "./data/app.db",
        { readonly: true }
      );
      
      // Perform simple query
      const result = db.prepare("SELECT 1 as test").get();
      db.close();
      
      return {
        name: "database",
        status: HealthStatus.HEALTHY,
        latency: Date.now() - start,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      this.handleServiceFailure("database");
      return {
        name: "database",
        status: HealthStatus.UNHEALTHY,
        message: error instanceof Error ? error.message : "Database check failed",
        latency: Date.now() - start,
        lastCheck: new Date().toISOString()
      };
    }
  }

  /**
   * Check Redis connectivity
   */
  private async checkRedis(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      // Check if Redis is configured
      if (!appConfig.redis?.host) {
        return {
          name: "redis",
          status: HealthStatus.UNKNOWN,
          message: "Redis not configured",
          lastCheck: new Date().toISOString()
        };
      }

      // Simple Redis ping via HTTP (if Redis has HTTP interface)
      // Otherwise, we'd need to use a Redis client
      const response = await fetch(`http://${appConfig.redis.host}:${appConfig.redis.port || 6379}/ping`, {
        method: "GET",
        timeout: 2000
      });

      return {
        name: "redis",
        status: response.ok ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        latency: Date.now() - start,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      // Redis might not have HTTP interface, check circuit breaker
      if (this.isCircuitOpen("redis")) {
        return {
          name: "redis",
          status: HealthStatus.DEGRADED,
          message: "Circuit breaker open",
          lastCheck: new Date().toISOString()
        };
      }
      
      return {
        name: "redis",
        status: HealthStatus.DEGRADED,
        message: "Redis connectivity uncertain",
        latency: Date.now() - start,
        lastCheck: new Date().toISOString()
      };
    }
  }

  /**
   * Check Ollama/llama.cpp connectivity
   */
  private async checkOllama(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const baseUrl = appConfig.ollama?.baseUrl || "http://localhost:11434";
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: "GET",
        timeout: 3000
      });

      const data = await response.json() as any;
      const hasModels = data.models && data.models.length > 0;

      return {
        name: "ollama",
        status: hasModels ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
        message: hasModels ? `${data.models.length} models available` : "No models loaded",
        latency: Date.now() - start,
        lastCheck: new Date().toISOString(),
        details: {
          models: data.models?.map((m: any) => m.name) || []
        }
      };
    } catch (error) {
      this.handleServiceFailure("ollama");
      return {
        name: "ollama",
        status: HealthStatus.UNHEALTHY,
        message: error instanceof Error ? error.message : "Ollama check failed",
        latency: Date.now() - start,
        lastCheck: new Date().toISOString()
      };
    }
  }

  /**
   * Check ChromaDB connectivity
   */
  private async checkChromaDB(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      if (!appConfig.rag?.vectorStore?.baseUrl) {
        return {
          name: "chromadb",
          status: HealthStatus.UNKNOWN,
          message: "ChromaDB not configured",
          lastCheck: new Date().toISOString()
        };
      }

      const response = await fetch(`${appConfig.rag.vectorStore.baseUrl}/api/v1/heartbeat`, {
        method: "GET",
        timeout: 2000
      });

      return {
        name: "chromadb",
        status: response.ok ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        latency: Date.now() - start,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      this.handleServiceFailure("chromadb");
      return {
        name: "chromadb",
        status: HealthStatus.UNHEALTHY,
        message: error instanceof Error ? error.message : "ChromaDB check failed",
        latency: Date.now() - start,
        lastCheck: new Date().toISOString()
      };
    }
  }

  /**
   * Check microservice health
   */
  private async checkMicroservice(name: string, port: number): Promise<ServiceHealth> {
    const start = Date.now();
    
    // Check circuit breaker
    if (this.isCircuitOpen(name)) {
      return {
        name,
        status: HealthStatus.DEGRADED,
        message: "Circuit breaker open - service temporarily unavailable",
        lastCheck: new Date().toISOString()
      };
    }

    try {
      const response = await fetch(`http://localhost:${port}/health`, {
        method: "GET",
        timeout: 2000
      });

      if (response.ok) {
        const data = await response.json() as any;
        this.resetCircuitBreaker(name);
        
        return {
          name,
          status: data.status === "healthy" ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
          latency: Date.now() - start,
          lastCheck: new Date().toISOString(),
          details: data
        };
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      this.handleServiceFailure(name);
      return {
        name,
        status: HealthStatus.UNHEALTHY,
        message: `Service on port ${port} not responding`,
        latency: Date.now() - start,
        lastCheck: new Date().toISOString()
      };
    }
  }

  /**
   * Check WebSocket server
   */
  private async checkWebSocket(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const response = await fetch("http://localhost:8080/health", {
        method: "GET",
        timeout: 2000
      });

      return {
        name: "websocket",
        status: response.ok ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        latency: Date.now() - start,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      return {
        name: "websocket",
        status: HealthStatus.UNHEALTHY,
        message: "WebSocket server not responding",
        latency: Date.now() - start,
        lastCheck: new Date().toISOString()
      };
    }
  }

  /**
   * Circuit breaker management
   */
  private isCircuitOpen(service: string): boolean {
    const breaker = this.circuitBreakers.get(service);
    if (!breaker) return false;
    
    if (breaker.isOpen && breaker.nextRetry) {
      if (new Date() >= breaker.nextRetry) {
        breaker.isOpen = false;
        breaker.failures = 0;
      }
    }
    
    return breaker.isOpen;
  }

  private handleServiceFailure(service: string) {
    let breaker = this.circuitBreakers.get(service);
    if (!breaker) {
      breaker = { failures: 0, isOpen: false };
      this.circuitBreakers.set(service, breaker);
    }

    breaker.failures++;
    breaker.lastFailure = new Date();

    if (breaker.failures >= this.config.circuitBreakerThreshold) {
      breaker.isOpen = true;
      breaker.nextRetry = new Date(Date.now() + 60000); // Retry after 1 minute
      logger.warn(`Circuit breaker opened for service: ${service}`, "HEALTH");
      this.emit("circuit:open", { service, breaker });
    }
  }

  private resetCircuitBreaker(service: string) {
    const breaker = this.circuitBreakers.get(service);
    if (breaker) {
      breaker.failures = 0;
      breaker.isOpen = false;
      breaker.lastFailure = undefined;
      breaker.nextRetry = undefined;
    }
  }

  /**
   * Utility functions
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error("Health check timeout")), timeoutMs)
      )
    ]);
  }

  private getServiceNameByIndex(index: number): string {
    const services = [
      "database", "redis", "ollama", "chromadb",
      "pricing-service", "nlp-service", "cache-warmer",
      "grocery-service", "deal-engine", "memory-monitor",
      "websocket"
    ];
    return services[index] || "unknown";
  }

  /**
   * Start periodic monitoring
   */
  private startMonitoring() {
    this.checkInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.intervalMs);
    
    logger.info(`Started health monitoring (interval: ${this.config.intervalMs}ms)`, "HEALTH");
  }

  /**
   * Get health history
   */
  getHealthHistory(limit: number = 10): SystemHealth[] {
    return this.healthHistory.slice(-limit);
  }

  /**
   * Get current health status
   */
  getCurrentHealth(): SystemHealth | null {
    return this.healthHistory[this.healthHistory.length - 1] || null;
  }

  /**
   * Shutdown the service
   */
  shutdown() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    logger.info("Health Check Service shutdown", "HEALTH");
  }
}

// Export singleton instance management
let healthCheckService: HealthCheckService | null = null;

export function initializeHealthCheckService(config?: Partial<HealthCheckConfig>): HealthCheckService {
  if (!healthCheckService) {
    healthCheckService = new HealthCheckService(config);
    healthCheckService.initialize();
  }
  return healthCheckService;
}

export function getHealthCheckService(): HealthCheckService | null {
  return healthCheckService;
}

export default HealthCheckService;