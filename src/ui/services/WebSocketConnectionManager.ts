/**
 * WebSocket Connection Manager
 * Singleton service to prevent duplicate WebSocket connections and manage state globally
 */

import { EventEmitter } from 'events';

// Environment variable detection

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

interface ManagedConnection {
  id: string;
  url: string;
  ws: WebSocket | null;
  status: ConnectionStatus;
  attempts: number;
  lastActivity: number;
  metadata?: Record<string, unknown>;
}

class WebSocketConnectionManager extends EventEmitter {
  private static instance: WebSocketConnectionManager;
  private connections: Map<string, ManagedConnection> = new Map();
  private connectionLocks: Map<string, boolean> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private maxConnectionsPerUrl = 1;
  private debugMode = (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') || false;

  private constructor() {
    super();
    this.setupCleanupInterval();
  }

  public static getInstance(): WebSocketConnectionManager {
    if (!WebSocketConnectionManager.instance) {
      WebSocketConnectionManager.instance = new WebSocketConnectionManager();
    }
    return WebSocketConnectionManager.instance;
  }

  /**
   * Get or create a WebSocket connection
   */
  public async getConnection(
    url: string,
    options: {
      id?: string;
      forceNew?: boolean;
      metadata?: Record<string, unknown>;
      onOpen?: (event: Event) => void;
      onClose?: (event: CloseEvent) => void;
      onMessage?: (event: MessageEvent) => void;
      onError?: (event: Event) => void;
    } = {}
  ): Promise<WebSocket | null> {
    const connectionId = options.id || this.generateConnectionId(url);
    
    // Check if connection is locked (being created)
    if (this.connectionLocks.get(connectionId)) {
      this.log('warn', `Connection ${connectionId} is locked, waiting...`);
      await this.waitForLock(connectionId);
    }

    // Check for existing connection
    const existing = this.connections.get(connectionId);
    if (existing && !options.forceNew) {
      if (existing.ws?.readyState === WebSocket.OPEN) {
        this.log('info', `Reusing existing connection ${connectionId}`);
        existing.lastActivity = Date.now();
        return existing.ws;
      } else if (existing.ws?.readyState === WebSocket.CONNECTING) {
        this.log('info', `Connection ${connectionId} is already connecting`);
        return new Promise<WebSocket | null>((resolve) => {
          const checkInterval = setInterval(() => {
            if (existing.ws?.readyState === WebSocket.OPEN) {
              clearInterval(checkInterval);
              resolve(existing.ws);
            } else if (existing.ws?.readyState === WebSocket.CLOSED) {
              clearInterval(checkInterval);
              resolve(null);
            }
          }, 100);

          // Timeout after 10 seconds
          setTimeout(() => {
            clearInterval(checkInterval);
            resolve(null);
          }, 10000);
        });
      }
    }

    // Check connection limit per URL
    const urlConnections = Array.from(this.connections.values()).filter(
      conn => conn.url === url && conn.ws?.readyState === WebSocket.OPEN
    );

    if (urlConnections.length >= this.maxConnectionsPerUrl && !options.forceNew) {
      this.log('warn', `Max connections (${this.maxConnectionsPerUrl}) reached for ${url}`);
      return urlConnections[0]?.ws || null;
    }

    // Lock connection creation
    this.connectionLocks.set(connectionId, true);

    try {
      // Close existing connection if forcing new
      if (existing && options.forceNew) {
        this.closeConnection(connectionId);
      }

      // Create new WebSocket
      const ws = new WebSocket(url);
      
      // Create managed connection
      const managedConnection: ManagedConnection = {
        id: connectionId,
        url,
        ws,
        status: 'connecting',
        attempts: (existing?.attempts || 0) + 1,
        lastActivity: Date.now(),
        metadata: options.metadata
      };

      this.connections.set(connectionId, managedConnection);
      
      // Setup event handlers
      ws.onopen = (event: Event) => {
        this.log('info', `Connection ${connectionId} opened`);
        managedConnection.status = 'connected';
        managedConnection.attempts = 0;
        managedConnection.lastActivity = Date.now();
        
        this.clearReconnectTimer(connectionId);
        this.emit('connected', { connectionId, url });
        options.onOpen?.(event);
      };

      ws.onclose = (event: CloseEvent) => {
        this.log('info', `Connection ${connectionId} closed`, { code: event.code, reason: event.reason });
        managedConnection.status = 'disconnected';
        managedConnection.ws = null;
        
        this.emit('disconnected', { connectionId, url, code: event.code, reason: event.reason });
        options.onClose?.(event);

        // Handle reconnection if not intentional close
        if (event.code !== 1000 && managedConnection.attempts < 5) {
          this.scheduleReconnect(connectionId, url, options);
        } else if (managedConnection.attempts >= 5) {
          managedConnection.status = 'failed';
          this.emit('failed', { connectionId, url });
        }
      };

      ws.onerror = (event: Event) => {
        this.log('error', `Connection ${connectionId} error`);
        managedConnection.status = 'failed';
        
        this.emit('error', { connectionId, url, error: event });
        options.onError?.(event);
      };

      ws.onmessage = (event: MessageEvent) => {
        managedConnection.lastActivity = Date.now();
        options.onMessage?.(event);
      };

      // Wait for connection to open or fail
      return new Promise<WebSocket | null>((resolve) => {
        const timeout = setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING) {
            ws.close();
            resolve(null);
          }
        }, 10000);

        ws.addEventListener('open', () => {
          clearTimeout(timeout);
          resolve(ws);
        });

        ws.addEventListener('error', () => {
          clearTimeout(timeout);
          resolve(null);
        });
      });

    } finally {
      // Release lock
      this.connectionLocks.delete(connectionId);
    }
  }

  /**
   * Close a specific connection
   */
  public closeConnection(connectionId: string, code: number = 1000, reason: string = 'Normal closure'): void {
    const connection = this.connections.get(connectionId);
    
    if (connection?.ws) {
      if (connection.ws.readyState === WebSocket.OPEN || connection.ws.readyState === WebSocket.CONNECTING) {
        connection.ws.close(code, reason);
      }
      connection.ws = null;
    }

    this.clearReconnectTimer(connectionId);
    this.connections.delete(connectionId);
    this.connectionLocks.delete(connectionId);
    
    this.log('info', `Connection ${connectionId} closed and removed`);
  }

  /**
   * Close all connections
   */
  public closeAll(): void {
    this.log('info', 'Closing all connections');
    
    const connectionIds = Array.from(this.connections.keys());
    for (const connectionId of connectionIds) {
      this.closeConnection(connectionId);
    }
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(connectionId: string): ConnectionStatus {
    const connection = this.connections.get(connectionId);
    return connection?.status || 'disconnected';
  }

  /**
   * Get all active connections
   */
  public getActiveConnections(): Array<{ id: string; url: string; status: ConnectionStatus }> {
    return Array.from(this.connections.values())
      .filter(conn => conn.ws?.readyState === WebSocket.OPEN)
      .map(conn => ({
        id: conn.id,
        url: conn.url,
        status: conn.status
      }));
  }

  /**
   * Check if a connection exists and is active
   */
  public isConnectionActive(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    return connection?.ws?.readyState === WebSocket.OPEN || false;
  }

  /**
   * Send message through a managed connection
   */
  public sendMessage(connectionId: string, data: unknown): boolean {
    const connection = this.connections.get(connectionId);
    
    if (connection?.ws?.readyState === WebSocket.OPEN) {
      try {
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        connection.ws.send(message);
        connection.lastActivity = Date.now();
        return true;
      } catch (error) {
        this.log('error', `Failed to send message on ${connectionId}`, error);
        return false;
      }
    }
    
    this.log('warn', `Cannot send message - connection ${connectionId} not open`);
    return false;
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(
    connectionId: string,
    url: string,
    options: {
      id?: string;
      forceNew?: boolean;
      metadata?: Record<string, unknown>;
      onOpen?: (event: Event) => void;
      onClose?: (event: CloseEvent) => void;
      onMessage?: (event: MessageEvent) => void;
      onError?: (event: Event) => void;
    }
  ): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.status = 'reconnecting';
    
    // Calculate delay with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, connection.attempts), 30000);
    
    this.log('info', `Scheduling reconnect for ${connectionId} in ${delay}ms (attempt ${connection.attempts + 1})`);
    
    const timer = setTimeout(async () => {
      this.reconnectTimers.delete(connectionId);
      
      if (this.connections.has(connectionId)) {
        await this.getConnection(url, { ...options, id: connectionId });
      }
    }, delay);

    this.reconnectTimers.set(connectionId, timer);
  }

  /**
   * Clear reconnection timer
   */
  private clearReconnectTimer(connectionId: string): void {
    const timer = this.reconnectTimers.get(connectionId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(connectionId);
    }
  }

  /**
   * Wait for connection lock to be released
   */
  private async waitForLock(connectionId: string, timeout: number = 5000): Promise<void> {
    const startTime = Date.now();
    
    return new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.connectionLocks.get(connectionId) || Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Generate connection ID from URL
   */
  private generateConnectionId(url: string): string {
    return `ws_${url.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
  }

  /**
   * Setup cleanup interval for stale connections
   */
  private setupCleanupInterval(): void {
    setInterval(() => {
      const staleTimeout = 5 * 60 * 1000; // 5 minutes
      const now = Date.now();

      const connections = Array.from(this.connections.entries());
      for (const [connectionId, connection] of connections) {
        if (
          connection.status === 'disconnected' &&
          now - connection.lastActivity > staleTimeout
        ) {
          this.log('info', `Cleaning up stale connection ${connectionId}`);
          this.connections.delete(connectionId);
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Logging helper
   */
  private log(level: 'info' | 'warn' | 'error', message: string, data?: unknown): void {
    if (!this.debugMode && level === 'info') return;

    const prefix = '[WebSocketManager]';
    
    switch (level) {
      case 'error':
        console.error(prefix, message, data || '');
        break;
      case 'warn':
        console.warn(prefix, message, data || '');
        break;
      default:
        console.log(prefix, message, data || '');
    }
  }

  /**
   * Get statistics
   */
  public getStatistics(): {
    totalConnections: number;
    activeConnections: number;
    failedConnections: number;
    reconnectingConnections: number;
  } {
    const connections = Array.from(this.connections.values());
    
    return {
      totalConnections: connections.length,
      activeConnections: connections.filter(c => c.status === 'connected').length,
      failedConnections: connections.filter(c => c.status === 'failed').length,
      reconnectingConnections: connections.filter(c => c.status === 'reconnecting').length
    };
  }
}

// Export singleton instance
export const wsConnectionManager = WebSocketConnectionManager.getInstance();
export default WebSocketConnectionManager;