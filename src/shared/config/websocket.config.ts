/**
 * Unified WebSocket Configuration
 * Centralized configuration for all WebSocket connections in the system
 */

export interface WebSocketEndpoint {
  url: string;
  protocol: 'ws' | 'wss';
  path: string;
  port: number;
}

export interface WebSocketConfig {
  env: 'development' | 'production' | 'test';
  endpoints: {
    trpc: WebSocketEndpoint;
    socketio: WebSocketEndpoint;
    email: WebSocketEndpoint;
  };
  reconnection: {
    enabled: boolean;
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };
  heartbeat: {
    enabled: boolean;
    interval: number;
    timeout: number;
  };
  security: {
    requireAuth: boolean;
    tokenHeader: string;
    csrfProtection: boolean;
  };
}

// Get environment-specific configuration
const getEnvConfig = (): WebSocketConfig['env'] => {
  const env = process.env.NODE_ENV || 'development';
  if (env === 'production') return 'production';
  if (env === 'test') return 'test';
  return 'development';
};

// Get protocol based on environment
const getProtocol = (): 'ws' | 'wss' => {
  if (typeof window !== 'undefined') {
    return window?.location?.protocol === 'https:' ? 'wss' : 'ws';
  }
  return getEnvConfig() === 'production' ? 'wss' : 'ws';
};

// Get host based on environment
const getHost = (): string => {
  if (typeof window !== 'undefined') {
    return window?.location?.hostname;
  }
  return process.env.HOST || 'localhost';
};

// Get ports from environment or defaults
const getPorts = () => ({
  api: parseInt(process.env.VITE_API_PORT || process.env.API_PORT || '3001', 10),
  websocket: parseInt(process.env.WEBSOCKET_PORT || '8080', 10),
  trpc: parseInt(process.env.VITE_API_PORT || process.env.API_PORT || '3001', 10), // Same as API for HTTP upgrade
});

/**
 * Unified WebSocket configuration
 * All WebSocket connections should use this configuration
 */
export const websocketConfig: WebSocketConfig = {
  env: getEnvConfig(),
  endpoints: {
    trpc: {
      protocol: getProtocol(),
      url: `${getProtocol()}://${getHost()}:${getPorts().trpc}/trpc-ws`,
      path: '/trpc-ws',
      port: getPorts().trpc,
    },
    socketio: {
      protocol: getProtocol(),
      url: `${getProtocol()}://${getHost()}:${getPorts().websocket}`,
      path: '/ws',
      port: getPorts().websocket,
    },
    email: {
      protocol: getProtocol(),
      url: `${getProtocol()}://${getHost()}:${getPorts().websocket}/email`,
      path: '/email',
      port: getPorts().websocket,
    },
  },
  reconnection: {
    enabled: true,
    maxAttempts: 5,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 1.5,
  },
  heartbeat: {
    enabled: true,
    interval: 30000, // 30 seconds
    timeout: 60000, // 60 seconds
  },
  security: {
    requireAuth: getEnvConfig() === 'production',
    tokenHeader: 'Authorization',
    csrfProtection: true,
  },
};

/**
 * Get WebSocket URL for a specific endpoint
 */
export const getWebSocketUrl = (
  endpoint: keyof WebSocketConfig['endpoints']
): string => {
  return websocketConfig.endpoints[endpoint].url;
};

/**
 * Get reconnection delay with exponential backoff
 */
export const getReconnectionDelay = (attempt: number): number => {
  const { initialDelay, maxDelay, backoffMultiplier } = websocketConfig.reconnection;
  const delay = Math.min(
    initialDelay * Math.pow(backoffMultiplier, attempt - 1),
    maxDelay
  );
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 1000;
};

/**
 * WebSocket event types for type safety
 */
export enum WebSocketEventType {
  // Connection events
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  RECONNECT = 'reconnect',
  RECONNECT_ATTEMPT = 'reconnect_attempt',
  RECONNECT_FAILED = 'reconnect_failed',
  ERROR = 'error',

  // Email events
  EMAIL_CREATED = 'email:created',
  EMAIL_UPDATED = 'email:updated',
  EMAIL_ANALYZED = 'email:analyzed',
  EMAIL_STATE_CHANGED = 'email:state_changed',
  EMAIL_BULK_UPDATE = 'email:bulk_update',
  EMAIL_SLA_ALERT = 'email:sla_alert',
  EMAIL_ANALYTICS_UPDATED = 'email:analytics_updated',
  EMAIL_TABLE_DATA_UPDATED = 'email:table_data_updated',
  EMAIL_STATS_UPDATED = 'email:stats_updated',
  EMAIL_BATCH_CREATED = 'email:batch_created',
  EMAIL_BATCH_STATUS_UPDATED = 'email:batch_status_updated',
  EMAIL_BATCH_DELETED = 'email:batch_deleted',

  // Workflow events
  WORKFLOW_TASK_CREATED = 'workflow:task:created',
  WORKFLOW_TASK_UPDATED = 'workflow:task:updated',
  WORKFLOW_TASK_COMPLETED = 'workflow:task:completed',
  WORKFLOW_STATUS_CHANGED = 'workflow:status:changed',
  WORKFLOW_SLA_WARNING = 'workflow:sla:warning',
  WORKFLOW_SLA_VIOLATED = 'workflow:sla:violated',
  WORKFLOW_METRICS_UPDATED = 'workflow:metrics:updated',
  WORKFLOW_BATCH_CREATED = 'workflow:batch:created',
  WORKFLOW_BATCH_COMPLETED = 'workflow:batch:completed',

  // System events
  SYSTEM_HEALTH = 'system:health',
  SYSTEM_METRICS = 'system:metrics',
  SYSTEM_PERFORMANCE_WARNING = 'system:performance_warning',

  // Agent events
  AGENT_STATUS = 'agent:status',
  AGENT_TASK = 'agent:task',
  AGENT_PERFORMANCE = 'agent:performance',

  // Subscription events
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  SUBSCRIPTION_SUCCESS = 'subscription:success',
  SUBSCRIPTION_ERROR = 'subscription:error',
}

// Export default configuration
export default websocketConfig;