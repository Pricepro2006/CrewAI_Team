/**
 * WebSocket Connection Manager
 * Provides reliable WebSocket connections with automatic reconnection and error handling
 */

import React from "react";
import { webSocketConfig, getReconnectionDelay } from "../../config/websocket.config.js";
import { logger } from "../../utils/logger.js";

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
  id?: string;
}

export interface WebSocketManagerOptions {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  timeout?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private reconnectInterval: number;
  private timeout: number;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private connectionTimeoutId: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private isManuallyDisconnected = false;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  
  // Callback options
  private onConnect?: () => void;
  private onDisconnect?: () => void;
  private onMessage?: (message: WebSocketMessage) => void;
  private onError?: (error: Event) => void;

  constructor(options: WebSocketManagerOptions = {}) {
    this.url = options.url || webSocketConfig.url;
    this.maxReconnectAttempts = options.maxReconnectAttempts || webSocketConfig.maxReconnectAttempts;
    this.reconnectInterval = options.reconnectInterval || webSocketConfig.reconnectInterval;
    this.timeout = options.timeout || webSocketConfig.timeout;
    this.onConnect = options.onConnect;
    this.onDisconnect = options.onDisconnect;
    this.onMessage = options.onMessage;
    this.onError = options.onError;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.CONNECTING)) {
        logger.warn("WebSocket connection already in progress", "WEBSOCKET_MANAGER");
        return;
      }

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        logger.info("WebSocket already connected", "WEBSOCKET_MANAGER");
        resolve();
        return;
      }

      this.isConnecting = true;
      this.isManuallyDisconnected = false;

      try {
        logger.info("Connecting to WebSocket", "WEBSOCKET_MANAGER", { url: this.url });
        
        this.ws = new WebSocket(this.url);
        
        // Set connection timeout
        this.connectionTimeoutId = setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
            logger.warn("WebSocket connection timeout", "WEBSOCKET_MANAGER");
            this.ws.close();
            reject(new Error("Connection timeout"));
          }
        }, this.timeout);

        this.ws.onopen = () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          
          if (this.connectionTimeoutId) {
            clearTimeout(this.connectionTimeoutId);
            this.connectionTimeoutId = null;
          }

          logger.info("WebSocket connected successfully", "WEBSOCKET_MANAGER");
          
          if (this.onConnect) {
            this.onConnect();
          }
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            
            // Call global message handler
            if (this.onMessage) {
              this.onMessage(message);
            }
            
            // Call specific type listeners
            const typeListeners = this.listeners.get(message.type);
            if (typeListeners) {
              typeListeners.forEach(listener => {
                try {
                  listener(message.data);
                } catch (error) {
                  logger.error("Error in WebSocket message listener", "WEBSOCKET_MANAGER", { error, messageType: message.type });
                }
              });
            }
            
          } catch (error) {
            logger.error("Failed to parse WebSocket message", "WEBSOCKET_MANAGER", { error, data: event.data });
          }
        };

        this.ws.onclose = (event) => {
          this.isConnecting = false;
          
          if (this.connectionTimeoutId) {
            clearTimeout(this.connectionTimeoutId);
            this.connectionTimeoutId = null;
          }

          logger.info("WebSocket connection closed", "WEBSOCKET_MANAGER", { 
            code: event.code, 
            reason: event.reason, 
            wasClean: event.wasClean 
          });
          
          if (this.onDisconnect) {
            this.onDisconnect();
          }

          // Attempt reconnection if not manually disconnected
          if (!this.isManuallyDisconnected && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error("Max reconnection attempts reached", "WEBSOCKET_MANAGER");
          }
        };

        this.ws.onerror = (error) => {
          logger.error("WebSocket error occurred", "WEBSOCKET_MANAGER", { error });
          
          if (this.onError) {
            this.onError(error);
          }
          
          if (this.isConnecting) {
            reject(new Error("WebSocket connection failed"));
          }
        };
        
      } catch (error) {
        this.isConnecting = false;
        logger.error("Failed to create WebSocket connection", "WEBSOCKET_MANAGER", { error });
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.isManuallyDisconnected = true;
    
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }

    if (this.ws) {
      logger.info("Manually disconnecting WebSocket", "WEBSOCKET_MANAGER");
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send message to WebSocket server
   */
  send(type: string, data: any): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn("Cannot send message - WebSocket not connected", "WEBSOCKET_MANAGER", { type });
      return false;
    }

    try {
      const message: WebSocketMessage = {
        type,
        data,
        timestamp: new Date().toISOString(),
        id: Math.random().toString(36).substring(7)
      };
      
      this.ws.send(JSON.stringify(message));
      logger.debug("Message sent via WebSocket", "WEBSOCKET_MANAGER", { type, messageId: message.id });
      return true;
    } catch (error) {
      logger.error("Failed to send WebSocket message", "WEBSOCKET_MANAGER", { error, type });
      return false;
    }
  }

  /**
   * Subscribe to specific message types
   */
  on(messageType: string, listener: (data: any) => void): () => void {
    if (!this.listeners.has(messageType)) {
      this.listeners.set(messageType, new Set());
    }
    
    this.listeners.get(messageType)!.add(listener);
    
    // Return unsubscribe function
    return () => {
      const typeListeners = this.listeners.get(messageType);
      if (typeListeners) {
        typeListeners.delete(listener);
        if (typeListeners.size === 0) {
          this.listeners.delete(messageType);
        }
      }
    };
  }

  /**
   * Remove listener for specific message type
   */
  off(messageType: string, listener: (data: any) => void): void {
    const typeListeners = this.listeners.get(messageType);
    if (typeListeners) {
      typeListeners.delete(listener);
      if (typeListeners.size === 0) {
        this.listeners.delete(messageType);
      }
    }
  }

  /**
   * Get current connection status
   */
  getStatus(): {
    connected: boolean;
    connecting: boolean;
    readyState: number | null;
    reconnectAttempts: number;
    url: string;
  } {
    return {
      connected: this.ws ? this.ws.readyState === WebSocket.OPEN : false,
      connecting: this.isConnecting,
      readyState: this.ws ? this.ws.readyState : null,
      reconnectAttempts: this.reconnectAttempts,
      url: this.url
    };
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.isManuallyDisconnected) {
      return;
    }

    this.reconnectAttempts++;
    const delay = getReconnectionDelay(this.reconnectAttempts);
    
    logger.info("Scheduling WebSocket reconnection", "WEBSOCKET_MANAGER", {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delay: `${delay}ms`
    });

    this.reconnectTimeoutId = setTimeout(() => {
      this.connect().catch(error => {
        logger.error("Reconnection attempt failed", "WEBSOCKET_MANAGER", { error, attempt: this.reconnectAttempts });
      });
    }, delay);
  }
}

// Global WebSocket manager instance
let globalWebSocketManager: WebSocketManager | null = null;

/**
 * Get or create global WebSocket manager
 */
export function getWebSocketManager(options?: WebSocketManagerOptions): WebSocketManager {
  if (!globalWebSocketManager) {
    globalWebSocketManager = new WebSocketManager(options);
  }
  return globalWebSocketManager;
}

/**
 * React hook for WebSocket connection
 */
export function useWebSocket(options?: WebSocketManagerOptions) {
  const [status, setStatus] = React.useState({
    connected: false,
    connecting: false,
    error: null as Error | null
  });

  const manager = React.useMemo(() => getWebSocketManager({
    ...options,
    onConnect: () => {
      setStatus(prev => ({ ...prev, connected: true, connecting: false, error: null }));
      options?.onConnect?.();
    },
    onDisconnect: () => {
      setStatus(prev => ({ ...prev, connected: false, connecting: false }));
      options?.onDisconnect?.();
    },
    onError: (error: Event) => {
      setStatus(prev => ({ ...prev, error: new Error("WebSocket connection error"), connecting: false }));
      options?.onError?.(error);
    }
  }), []);

  const connect = React.useCallback(() => {
    setStatus(prev => ({ ...prev, connecting: true, error: null }));
    return manager.connect();
  }, [manager]);

  const disconnect = React.useCallback(() => {
    manager.disconnect();
  }, [manager]);

  const send = React.useCallback((type: string, data: any) => {
    return manager.send(type, data);
  }, [manager]);

  const subscribe = React.useCallback((messageType: string, listener: (data: any) => void) => {
    return manager.on(messageType, listener);
  }, [manager]);

  return {
    ...status,
    connect,
    disconnect,
    send,
    subscribe,
    manager
  };
}