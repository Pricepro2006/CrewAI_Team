/**
 * Service-level type definitions for advanced TypeScript patterns
 * Phase 4 TypeScript remediation - Service orchestration types
 */

// Advanced service orchestration interfaces
export interface IServiceOrchestrator<T = any> {
  orchestrate(input: T): Promise<OrchestratedResult<T>>;
  getMetrics(): ServiceMetrics;
  shutdown(): Promise<void>;
}

export interface OrchestratedResult<T> {
  success: boolean;
  result?: T;
  errors?: string[];
  warnings?: string[];
  metadata?: {
    processingTime: number;
    servicesInvolved: string[];
    retryAttempts: number;
  };
}

export interface ServiceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  throughput: number;
  uptime: number;
}

// Service lifecycle management
export interface IServiceLifecycleManager {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  getStatus(): ServiceStatus;
}

export enum ServiceStatus {
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
  DEGRADED = 'degraded'
}

// Inter-service communication
export interface IServiceCommunicator {
  sendMessage<T>(service: string, message: ServiceMessage<T>): Promise<ServiceResponse<T>>;
  subscribe<T>(eventType: string, handler: ServiceMessageHandler<T>): void;
  unsubscribe(eventType: string): void;
}

export interface ServiceMessage<T = any> {
  id: string;
  type: string;
  payload: T;
  timestamp: number;
  source: string;
  target: string;
  metadata?: Record<string, any>;
}

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}

export type ServiceMessageHandler<T> = (message: ServiceMessage<T>) => Promise<ServiceResponse<T>>;

// Performance optimization patterns
export interface IPerformanceOptimizer {
  optimize(config: OptimizationConfig): Promise<OptimizationResult>;
  getRecommendations(): PerformanceRecommendation[];
  applyOptimizations(optimizations: OptimizationType[]): Promise<void>;
}

export interface OptimizationConfig {
  targetThroughput: number;
  maxLatency: number;
  resourceConstraints: ResourceConstraints;
  optimizationLevel: 'conservative' | 'balanced' | 'aggressive';
}

export interface ResourceConstraints {
  maxMemory: number;
  maxCPU: number;
  maxConnections: number;
  diskIOLimit?: number;
  networkIOLimit?: number;
}

export interface OptimizationResult {
  applied: OptimizationType[];
  skipped: OptimizationType[];
  warnings: string[];
  estimatedImprovement: {
    throughputIncrease: number; // percentage
    latencyReduction: number;   // percentage
    resourceUsageReduction: number; // percentage
  };
}

export interface PerformanceRecommendation {
  type: OptimizationType;
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  estimatedImpact: string;
  implementation: string;
}

export enum OptimizationType {
  CONNECTION_POOLING = 'connection_pooling',
  CACHING = 'caching',
  BATCHING = 'batching',
  COMPRESSION = 'compression',
  ASYNC_PROCESSING = 'async_processing',
  LOAD_BALANCING = 'load_balancing',
  RESOURCE_SCALING = 'resource_scaling'
}

// Complex async coordination patterns
export interface IAsyncCoordinator {
  coordinate<T>(operations: AsyncOperation<T>[]): Promise<CoordinationResult<T>>;
  retry<T>(operation: AsyncOperation<T>, policy: RetryPolicy): Promise<T>;
  timeout<T>(operation: AsyncOperation<T>, timeoutMs: number): Promise<T>;
  circuit<T>(operation: AsyncOperation<T>, config: CircuitBreakerConfig): Promise<T>;
}

export interface AsyncOperation<T> {
  id: string;
  operation: () => Promise<T>;
  dependencies?: string[];
  timeout?: number;
  retryPolicy?: RetryPolicy;
}

export interface CoordinationResult<T> {
  completed: Array<{ id: string; result: T }>;
  failed: Array<{ id: string; error: Error }>;
  skipped: Array<{ id: string; reason: string }>;
  metrics: {
    totalTime: number;
    parallelism: number;
    successRate: number;
  };
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'exponential' | 'linear' | 'fixed';
  baseDelay: number;
  maxDelay?: number;
  jitter?: boolean;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringWindow: number;
  halfOpenMaxCalls: number;
}

// Advanced error handling patterns
export interface ServiceError extends Error {
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
  recoverable: boolean;
  retryable: boolean;
  timestamp: number;
}

export interface IErrorHandler {
  handle(error: ServiceError): Promise<ErrorHandlingResult>;
  classify(error: Error): ServiceError;
  recover(error: ServiceError): Promise<boolean>;
}

export interface ErrorHandlingResult {
  handled: boolean;
  recovered: boolean;
  escalated: boolean;
  actions: string[];
  nextAttemptDelay?: number;
}

// Resource management patterns
export interface IResourceManager {
  acquire<T>(resourceType: string, config?: ResourceConfig): Promise<ManagedResource<T>>;
  release(resource: ManagedResource<any>): Promise<void>;
  getUsage(): ResourceUsageStats;
}

export interface ManagedResource<T> {
  id: string;
  resource: T;
  type: string;
  metadata: {
    acquiredAt: number;
    expiresAt?: number;
    usage: number;
  };
}

export interface ResourceConfig {
  timeout?: number;
  maxUsage?: number;
  priority?: number;
  metadata?: Record<string, any>;
}

export interface ResourceUsageStats {
  totalResources: number;
  activeResources: number;
  pendingRequests: number;
  utilizationRate: number;
  resourceTypes: Record<string, number>;
}