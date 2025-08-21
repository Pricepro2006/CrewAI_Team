/**
 * WebSocket Configuration
 * Provides dynamic WebSocket URL configuration based on environment
 */
interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  timeout: number;
}

interface WebSocketEndpoints {
  trpc: string;
  native: string;
  walmart: string;
  email: string;
}

// Type guard for browser environment
const isBrowser = typeof window !== 'undefined';

/**
 * Get the correct ports for API and WebSocket based on environment
 */
const getPorts = () => {
  const apiPort = process.env.VITE_API_PORT || process.env.API_PORT || '3001';
  const wsPort = process.env.VITE_WS_PORT || process.env.WS_PORT || '8080';
  return { apiPort, wsPort };
};

/**
 * Get WebSocket URLs for different services
 * UPDATED: All WebSocket endpoints now point to the working API server on port 3001
 * The standalone WebSocket server on port 8080 has connection handshake issues
 */
export const getWebSocketEndpoints = (): WebSocketEndpoints => {
  const { apiPort, wsPort } = getPorts();
  
  if (!isBrowser) {
    // Server-side rendering - all endpoints on API server
    return {
      trpc: `ws://localhost:${apiPort}/trpc-ws`,
      native: `ws://localhost:${apiPort}/ws`,
      walmart: `ws://localhost:${apiPort}/ws/walmart`,
      email: `ws://localhost:${apiPort}/ws/email`
    };
  }

  const protocol = window?.location?.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window?.location?.hostname || 'localhost';

  // TEMPORARY FIX: All WebSocket endpoints point to API server (port 3001)
  // until standalone WebSocket server (port 8080) handshake issue is resolved
  return {
    trpc: `${protocol}//${host}:${apiPort}/trpc-ws`,
    native: `${protocol}//${host}:${apiPort}/ws`,
    walmart: `${protocol}//${host}:${apiPort}/ws/walmart`,
    email: `${protocol}//${host}:${apiPort}/ws/email`
  };
};

/**
 * Get the primary WebSocket URL (native WebSocket on port 8080)
 */
export const getWebSocketUrl = (): string => {
  const endpoints = getWebSocketEndpoints();
  return endpoints.native;
};

/**
 * Get tRPC WebSocket URL (HTTP upgrade on port 3000)
 */
export const getTRPCWebSocketUrl = (): string => {
  const endpoints = getWebSocketEndpoints();
  return endpoints.trpc;
};

/**
 * Primary WebSocket configuration (native WebSocket)
 */
export const webSocketConfig: WebSocketConfig = {
  url: getWebSocketUrl(),
  reconnectInterval: 3000, // 3 seconds
  maxReconnectAttempts: 10,
  timeout: 30000, // 30 seconds
};

/**
 * tRPC WebSocket configuration
 */
export const trpcWebSocketConfig: WebSocketConfig = {
  url: getTRPCWebSocketUrl(),
  reconnectInterval: 3000,
  maxReconnectAttempts: 10,
  timeout: 30000,
};

/**
 * Get Walmart-specific WebSocket URL
 */
export const getWalmartWebSocketUrl = (): string => {
  const endpoints = getWebSocketEndpoints();
  return endpoints.walmart;
};

/**
 * Get Email processing WebSocket URL
 */
export const getEmailWebSocketUrl = (): string => {
  const endpoints = getWebSocketEndpoints();
  return endpoints.email;
};

export const walmartWebSocketConfig: WebSocketConfig = {
  url: getWalmartWebSocketUrl(),
  reconnectInterval: 3000,
  maxReconnectAttempts: 10,
  timeout: 30000,
};

/**
 * Get API base URL for HTTP requests
 */
export const getApiBaseUrl = (): string => {
  const { apiPort } = getPorts();
  
  if (!isBrowser) {
    return `http://localhost:${apiPort}`;
  }

  const protocol = window?.location?.protocol;
  const host = window?.location?.hostname || 'localhost';
  
  return `${protocol}//${host}:${apiPort}`;
};

/**
 * Get all WebSocket endpoints for debugging
 */
export const getWebSocketDebugInfo = () => {
  const endpoints = getWebSocketEndpoints();
  const { apiPort, wsPort } = getPorts();
  
  return {
    ports: { apiPort, wsPort },
    endpoints,
    environment: process.env.NODE_ENV || 'development',
    isBrowser
  };
};

/**
 * Get reconnection delay with exponential backoff
 */
export const getReconnectionDelay = (attempt: number): number => {
  const initialDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  const backoffMultiplier = 1.5;
  
  const delay = Math.min(
    initialDelay * Math.pow(backoffMultiplier, attempt - 1),
    maxDelay
  );
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 1000;
};

export default webSocketConfig;