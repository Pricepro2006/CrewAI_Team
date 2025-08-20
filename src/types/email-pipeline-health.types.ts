/**
 * TypeScript Types for Email Pipeline Health Monitoring
 * Comprehensive type definitions for health checking and monitoring
 */

export type HealthStatus = "healthy" | "degraded" | "unhealthy";
export type ServiceName =
  | "database"
  | "redis"
  | "ollama"
  | "llama"
  | "pipeline"
  | "processingQueue";
export type TimeWindow = "1h" | "24h" | "7d" | "30d";

/**
 * Core health check interfaces
 */
export interface ServiceHealth {
  status: HealthStatus;
  lastCheck: string;
  responseTime?: number;
  errorCount?: number;
  details?: string;
  metrics?: Record<string, number>;
}

export interface ServiceHealthMap {
  database: ServiceHealth;
  redis: ServiceHealth;
  ollama: ServiceHealth;
  llama: ServiceHealth;
  pipeline: ServiceHealth;
  processingQueue: ServiceHealth;
}

/**
 * System resource metrics
 */
export interface SystemResourceMetrics {
  memoryUsage: number; // MB
  cpuUsage: number; // Percentage or seconds
  diskUsage: number; // MB or percentage
  databaseSize: number; // MB
}

/**
 * Email pipeline specific metrics
 */
export interface EmailPipelineBasicMetrics {
  totalEmails: number;
  todaysEmails: number;
  unprocessedEmails: number;
  failedEmails: number;
  averageProcessingTime: number; // Seconds
  queueDepth: number;
}

export interface ProcessingRateMetrics {
  lastHour: number;
  last24Hours: number;
  last7Days: number;
}

export interface QueueMetrics {
  depth: number;
  averageWaitTime: number; // Seconds
  throughput: number; // Emails per hour
}

export interface StageMetrics {
  stage1Success: number; // Percentage
  stage2Success: number; // Percentage
  stage3Success: number; // Percentage
  overallSuccessRate: number; // Percentage
}

export interface EmailPipelineMetrics extends EmailPipelineBasicMetrics {
  processingRates: ProcessingRateMetrics;
  queueMetrics: QueueMetrics;
  stageMetrics: StageMetrics;
  systemResources?: SystemResourceMetrics;
}

/**
 * Complete health status response
 */
export interface EmailPipelineHealthStatus {
  status: HealthStatus;
  timestamp: string;
  services: ServiceHealthMap;
  metrics: EmailPipelineBasicMetrics;
  resources: SystemResourceMetrics;
}

/**
 * Detailed health status with extended metrics
 */
export interface DetailedEmailPipelineHealthStatus
  extends EmailPipelineHealthStatus {
  detailedMetrics: EmailPipelineMetrics;
  responseTime: number;
  cacheInfo: {
    cached: boolean;
    cacheAge: number; // Milliseconds
  };
}

/**
 * Health check query parameters
 */
export interface HealthCheckQuery {
  force?: boolean;
  services?: ServiceName[];
}

export interface MetricsQuery {
  timeWindow?: TimeWindow;
  includeDetails?: boolean;
}

/**
 * API Response types
 */
export interface BaseApiResponse {
  timestamp: string;
  responseTime?: number;
}

export interface HealthCheckApiResponse extends BaseApiResponse {
  status: HealthStatus;
  services: {
    critical: {
      database: HealthStatus;
      ollama: HealthStatus;
      llama: HealthStatus;
      pipeline: HealthStatus;
    };
    optional: {
      redis: HealthStatus;
      processingQueue: HealthStatus;
    };
  };
  metrics: EmailPipelineBasicMetrics;
}

export interface DetailedHealthCheckApiResponse extends BaseApiResponse {
  status: HealthStatus;
  services: ServiceHealthMap;
  metrics: EmailPipelineBasicMetrics;
  resources: SystemResourceMetrics;
  detailedMetrics: EmailPipelineMetrics;
  cacheInfo: {
    cached: boolean;
    cacheAge: number;
  };
}

export interface MetricsApiResponse extends BaseApiResponse {
  metrics: EmailPipelineMetrics;
  healthSummary: {
    status: HealthStatus;
    timestamp: string;
    criticalServices: {
      database: HealthStatus;
      ollama: HealthStatus;
      llama: HealthStatus;
      pipeline: HealthStatus;
    };
  };
  query: {
    timeWindow: TimeWindow;
    includeDetails: boolean;
  };
  generatedAt: string;
}

export interface ServiceHealthApiResponse extends BaseApiResponse {
  service: ServiceName;
  status: HealthStatus;
  lastCheck: string;
  responseTime?: number;
  errorCount?: number;
  details?: string;
  metrics?: Record<string, number>;
  checkedAt: string;
}

export interface ForcedHealthCheckApiResponse
  extends DetailedHealthCheckApiResponse {
  message: string;
  forced: true;
}

/**
 * Error response types
 */
export interface HealthCheckErrorResponse extends BaseApiResponse {
  status: "error";
  message: string;
  error: string;
}

export interface ServiceHealthErrorResponse extends BaseApiResponse {
  status: "error";
  service: ServiceName;
  message: string;
  error: string;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  cacheTTL: number; // Milliseconds
  timeouts: {
    database: number;
    redis: number;
    ollama: number;
    llama: number;
    pipeline: number;
    queue: number;
  };
  thresholds: {
    responseTime: {
      healthy: number;
      degraded: number;
    };
    successRate: {
      healthy: number;
      degraded: number;
    };
    queueDepth: {
      healthy: number;
      degraded: number;
    };
    memoryUsage: {
      healthy: number;
      degraded: number;
    };
  };
}

/**
 * Health checker internal types
 */
export interface HealthCheckResult {
  service: ServiceName;
  status: HealthStatus;
  responseTime: number;
  error?: Error;
  metrics?: Record<string, number>;
  details?: string;
}

export interface DatabaseHealthDetails {
  tablesChecked: number;
  databaseSize: number;
  connectionPool?: {
    active: number;
    idle: number;
    total: number;
  };
}

export interface OllamaHealthDetails {
  modelsAvailable: number;
  missingModels: number;
  requiredModels: string[];
  availableModels: string[];
}

export interface PipelineHealthDetails {
  currentStatus: string;
  recentExecutions: number;
  failedExecutions: number;
  successRate: number;
  averageExecutionTime?: number;
}

export interface QueueHealthDetails {
  unprocessedCount: number;
  stuckCount: number;
  processedLastHour: number;
  averageWaitTime: number;
}

/**
 * Extended service health with typed details
 */
export interface TypedServiceHealth extends ServiceHealth {
  details?: string;
  typedDetails?:
    | DatabaseHealthDetails
    | OllamaHealthDetails
    | PipelineHealthDetails
    | QueueHealthDetails;
}

/**
 * Health history types (for future implementation)
 */
export interface HealthCheckHistoryEntry {
  id: string;
  timestamp: string;
  status: HealthStatus;
  services: ServiceHealthMap;
  metrics: EmailPipelineBasicMetrics;
  responseTime: number;
  triggeredBy?: string; // user ID or 'system'
}

export interface HealthCheckHistoryQuery {
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
  services?: ServiceName[];
  statuses?: HealthStatus[];
}

export interface HealthCheckHistoryResponse extends BaseApiResponse {
  entries: HealthCheckHistoryEntry[];
  total: number;
  query: HealthCheckHistoryQuery;
  hasMore: boolean;
}

/**
 * Utility types
 */
export type ServiceHealthStatus = {
  [K in ServiceName]: HealthStatus;
};

export type PartialServiceHealth = Partial<ServiceHealth>;

export type OptionalServiceHealthMap = {
  [K in ServiceName]?: ServiceHealth;
};

/**
 * Type guards
 */
export function isHealthStatus(value: string): value is HealthStatus {
  return ["healthy", "degraded", "unhealthy"].includes(value);
}

export function isServiceName(value: string): value is ServiceName {
  return [
    "database",
    "redis",
    "ollama",
    "llama",
    "pipeline",
    "processingQueue",
  ].includes(value);
}

export function isTimeWindow(value: string): value is TimeWindow {
  return ["1h", "24h", "7d", "30d"].includes(value);
}

/**
 * Default configurations
 */
export const DEFAULT_HEALTH_CHECK_CONFIG: HealthCheckConfig = {
  cacheTTL: 30000, // 30 seconds
  timeouts: {
    database: 1000,
    redis: 2000,
    ollama: 5000,
    llama: 5000,
    pipeline: 3000,
    queue: 2000,
  },
  thresholds: {
    responseTime: {
      healthy: 1000,
      degraded: 3000,
    },
    successRate: {
      healthy: 95,
      degraded: 80,
    },
    queueDepth: {
      healthy: 1000,
      degraded: 5000,
    },
    memoryUsage: {
      healthy: 512, // MB
      degraded: 1024, // MB
    },
  },
};

export const TIME_WINDOW_MS = {
  "1h": 3600000,
  "24h": 86400000,
  "7d": 604800000,
  "30d": 2592000000,
} as const;
