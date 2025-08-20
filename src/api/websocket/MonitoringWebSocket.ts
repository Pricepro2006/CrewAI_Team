/**
 * Monitoring WebSocket Server
 * Provides real-time monitoring data to dashboard clients
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { monitoringService } from '../../services/MonitoringService.js';
import { logger } from '../../utils/logger.js';

interface MonitoringWebSocketClient {
  ws: WebSocket;
  id: string;
  connectedAt: Date;
  subscriptions: Set<string>;
  isAlive: boolean;
}

interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: string;
}

export class MonitoringWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, MonitoringWebSocketClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(port: number = 3002) {
    // Create WebSocket server
    this.wss = new WebSocketServer({ 
      port,
      path: '/monitoring'
    });

    this.setupEventHandlers();
    this.startHeartbeat();
    
    logger.info(`Monitoring WebSocket server started on port ${port}`, 'MONITOR_WS');
  }

  private setupEventHandlers(): void {
    // Handle new connections
    this?.wss?.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      const clientId = this.generateClientId();
      const client: MonitoringWebSocketClient = {
        ws,
        id: clientId,
        connectedAt: new Date(),
        subscriptions: new Set(),
        isAlive: true
      };

      this?.clients?.set(clientId, client);

      // Track connection in monitoring service
      monitoringService.trackConnection(clientId, 'websocket', {
        path: request.url,
        headers: request.headers,
        remoteAddress: request?.socket?.remoteAddress
      });

      logger.info(`Monitoring client connected: ${clientId}`, 'MONITOR_WS');

      // Setup client-specific handlers
      this.setupClientHandlers(client);

      // Send initial data
      this.sendToClient(client, {
        type: 'welcome',
        data: {
          clientId,
          serverTime: new Date().toISOString(),
          availableSubscriptions: [
            'dashboard_data',
            'health_status',
            'metrics',
            'alerts',
            'performance',
            'database_queries',
            'connections'
          ]
        }
      });
    });

    // Listen to monitoring service events
    this.setupMonitoringEventHandlers();
  }

  private setupClientHandlers(client: MonitoringWebSocketClient): void {
    const { ws, id } = client;

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;
        this.handleClientMessage(client, message);
      } catch (error) {
        logger.error(`Invalid message from client ${id}`, 'MONITOR_WS', { error });
        this.sendToClient(client, {
          type: 'error',
          data: { message: 'Invalid JSON message format' }
        });
      }
    });

    // Handle client disconnect
    ws.on('close', (code: number, reason: Buffer) => {
      logger.info(`Monitoring client disconnected: ${id}`, 'MONITOR_WS', { 
        code, 
        reason: reason.toString() 
      });
      
      monitoringService.disconnectConnection(id);
      this?.clients?.delete(id);
    });

    // Handle errors
    ws.on('error', (error: Error) => {
      logger.error(`Monitoring client error: ${id}`, 'MONITOR_WS', { error });
      monitoringService.disconnectConnection(id, error.message);
    });

    // Handle pong responses (for heartbeat)
    ws.on('pong', () => {
      client.isAlive = true;
      monitoringService.updateConnectionActivity(id);
    });
  }

  private handleClientMessage(client: MonitoringWebSocketClient, message: WebSocketMessage): void {
    const { type, data } = message;

    switch (type) {
      case 'subscribe':
        if (data?.subscription && typeof data.subscription === 'string') {
          client?.subscriptions?.add(data.subscription);
          logger.debug(`Client ${client.id} subscribed to ${data.subscription}`, 'MONITOR_WS');
          
          // Send initial data for the subscription
          this.sendInitialSubscriptionData(client, data.subscription);
        }
        break;

      case 'unsubscribe':
        if (data?.subscription && typeof data.subscription === 'string') {
          client?.subscriptions?.delete(data.subscription);
          logger.debug(`Client ${client.id} unsubscribed from ${data.subscription}`, 'MONITOR_WS');
        }
        break;

      case 'get_dashboard_data':
        this.sendDashboardData(client);
        break;

      case 'get_health_status':
        this.sendHealthStatus(client);
        break;

      case 'ping':
        this.sendToClient(client, { type: 'pong', timestamp: new Date().toISOString() });
        break;

      default:
        logger.warn(`Unknown message type from client ${client.id}: ${type}`, 'MONITOR_WS');
        this.sendToClient(client, {
          type: 'error',
          data: { message: `Unknown message type: ${type}` }
        });
    }
  }

  private setupMonitoringEventHandlers(): void {
    // Forward monitoring service events to subscribed clients
    
    monitoringService.on('metric', (metric: any) => {
      this.broadcastToSubscribed('metrics', {
        type: 'metric',
        data: metric
      });
    });

    monitoringService.on('alert', (alert: any) => {
      this.broadcastToSubscribed('alerts', {
        type: 'alert',
        data: alert
      });
    });

    monitoringService.on('performance', (performance: any) => {
      this.broadcastToSubscribed('performance', {
        type: 'performance',
        data: performance
      });
    });

    monitoringService.on('database_query', (query: any) => {
      this.broadcastToSubscribed('database_queries', {
        type: 'database_query',
        data: query
      });
    });

    monitoringService.on('connection_change', (connection: any) => {
      this.broadcastToSubscribed('connections', {
        type: 'connection_change',
        data: connection
      });
    });

    monitoringService.on('health_check', (health: any) => {
      this.broadcastToSubscribed('health_status', {
        type: 'health_status',
        data: health
      });
    });
  }

  private async sendInitialSubscriptionData(client: MonitoringWebSocketClient, subscription: string): Promise<void> {
    try {
      switch (subscription) {
        case 'dashboard_data':
          await this.sendDashboardData(client);
          break;
        case 'health_status':
          await this.sendHealthStatus(client);
          break;
        case 'metrics':
          const recentMetrics = monitoringService.getMetrics(undefined, 20);
          this.sendToClient(client, {
            type: 'metrics_batch',
            data: recentMetrics
          });
          break;
        case 'alerts':
          const activeAlerts = monitoringService.getActiveAlerts();
          this.sendToClient(client, {
            type: 'alerts_batch',
            data: activeAlerts
          });
          break;
        case 'performance':
          const recentPerformance = monitoringService.getPerformanceMetrics(20);
          this.sendToClient(client, {
            type: 'performance_batch',
            data: recentPerformance
          });
          break;
        case 'database_queries':
          const recentQueries = monitoringService.getDatabaseQueries(20);
          this.sendToClient(client, {
            type: 'database_queries_batch',
            data: recentQueries
          });
          break;
        case 'connections':
          const connections = monitoringService.getActiveConnections();
          this.sendToClient(client, {
            type: 'connections_batch',
            data: connections
          });
          break;
      }
    } catch (error) {
      logger.error(`Failed to send initial data for ${subscription}`, 'MONITOR_WS', { error });
    }
  }

  private async sendDashboardData(client: MonitoringWebSocketClient): Promise<void> {
    try {
      const dashboardData = monitoringService.getDashboardData();
      this.sendToClient(client, {
        type: 'dashboard_data',
        data: dashboardData
      });
    } catch (error) {
      logger.error('Failed to send dashboard data', 'MONITOR_WS', { error });
    }
  }

  private async sendHealthStatus(client: MonitoringWebSocketClient): Promise<void> {
    try {
      const health = await monitoringService.runHealthChecks();
      this.sendToClient(client, {
        type: 'health_status',
        data: health
      });
    } catch (error) {
      logger.error('Failed to send health status', 'MONITOR_WS', { error });
    }
  }

  private sendToClient(client: MonitoringWebSocketClient, message: WebSocketMessage): void {
    if (client?.ws?.readyState === WebSocket.OPEN) {
      try {
        const messageWithTimestamp = {
          ...message,
          timestamp: new Date().toISOString()
        };
        
        client?.ws?.send(JSON.stringify(messageWithTimestamp));
      } catch (error) {
        logger.error(`Failed to send message to client ${client.id}`, 'MONITOR_WS', { error });
      }
    }
  }

  private broadcastToSubscribed(subscription: string, message: WebSocketMessage): void {
    for (const [clientId, client] of this.clients) {
      if (client?.subscriptions?.has(subscription)) {
        this.sendToClient(client, message);
      }
    }
  }

  private broadcast(message: WebSocketMessage): void {
    for (const [clientId, client] of this.clients) {
      this.sendToClient(client, message);
    }
  }

  private generateClientId(): string {
    return `monitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [clientId, client] of this.clients) {
        if (!client.isAlive) {
          // Client didn't respond to previous ping, terminate
          logger.info(`Terminating unresponsive client: ${clientId}`, 'MONITOR_WS');
          client?.ws?.terminate();
          this?.clients?.delete(clientId);
          monitoringService.disconnectConnection(clientId, 'Heartbeat timeout');
          continue;
        }

        // Mark client as potentially dead and send ping
        client.isAlive = false;
        try {
          client?.ws?.ping();
        } catch (error) {
          logger.error(`Failed to ping client ${clientId}`, 'MONITOR_WS', { error });
          this?.clients?.delete(clientId);
          monitoringService.disconnectConnection(clientId, 'Ping failed');
        }
      }

      // Update monitoring metrics
      monitoringService.gauge('websocket.clients', this?.clients?.size, { server: 'monitoring' });
    }, 30000); // 30 second heartbeat
  }

  /**
   * Get connected clients information
   */
  getClientsInfo(): any[] {
    return Array.from(this?.clients?.values()).map(client => ({
      id: client.id,
      connectedAt: client.connectedAt,
      subscriptions: Array.from(client.subscriptions),
      isAlive: client.isAlive
    }));
  }

  /**
   * Get server statistics
   */
  getServerStats(): any {
    return {
      totalClients: this?.clients?.size,
      activeClients: Array.from(this?.clients?.values()).filter(c => c.isAlive).length,
      subscriptions: this.getSubscriptionStats(),
      uptime: process.uptime()
    };
  }

  private getSubscriptionStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    for (const client of this?.clients?.values()) {
      for (const subscription of client.subscriptions) {
        stats[subscription] = (stats[subscription] || 0) + 1;
      }
    }
    
    return stats;
  }

  /**
   * Shutdown the WebSocket server
   */
  close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all client connections
    for (const [clientId, client] of this.clients) {
      client?.ws?.close(1001, 'Server shutting down');
      monitoringService.disconnectConnection(clientId, 'Server shutdown');
    }

    // Close the server
    this?.wss?.close(() => {
      logger.info('Monitoring WebSocket server closed', 'MONITOR_WS');
    });
  }
}

// Export default instance
export const monitoringWebSocketServer = new MonitoringWebSocketServer();
export default monitoringWebSocketServer;