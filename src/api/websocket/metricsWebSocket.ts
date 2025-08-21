import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { logger } from '../../utils/logger.js';
import { MetricsCollectionService } from '../../monitoring/MetricsCollectionService.js';

export class MetricsWebSocketServer {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      noServer: true,  // Handle upgrade manually
      path: '/ws/metrics',
      perMessageDeflate: false // Disable compression for real-time metrics
    });

    this.setupWebSocketHandlers();
    this.startMetricsBroadcast();
    
    logger.info('[METRICS_WS] Metrics WebSocket server initialized at /ws/metrics');
  }

  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = `metrics-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      logger.info('[METRICS_WS] New client connected', { 
        clientId,
        ip: req.socket.remoteAddress 
      });

      this.clients.add(ws);

      // Send initial metrics snapshot
      this.sendMetricsSnapshot(ws);

      // Handle client messages
      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(ws, data);
        } catch (error) {
          logger.error('[METRICS_WS] Failed to parse message', error);
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        this.clients.delete(ws);
        logger.info('[METRICS_WS] Client disconnected', { clientId });
      });

      ws.on('error', (error) => {
        logger.error('[METRICS_WS] WebSocket error', { clientId, error });
        this.clients.delete(ws);
      });

      // Send welcome message
      this.sendToClient(ws, {
        type: 'connection',
        status: 'connected',
        clientId,
        timestamp: new Date().toISOString()
      });
    });
  }

  private handleClientMessage(ws: WebSocket, data: any): void {
    switch (data.type) {
      case 'subscribe':
        this.handleSubscription(ws, data.metrics);
        break;
      case 'unsubscribe':
        this.handleUnsubscription(ws, data.metrics);
        break;
      case 'ping':
        this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
        break;
      case 'request_snapshot':
        this.sendMetricsSnapshot(ws);
        break;
      default:
        logger.warn('[METRICS_WS] Unknown message type', { type: data.type });
    }
  }

  private handleSubscription(ws: WebSocket, metrics?: string[]): void {
    // Store subscription preferences on the WebSocket object
    (ws as any).subscribedMetrics = metrics || ['all'];
    this.sendToClient(ws, {
      type: 'subscription',
      status: 'subscribed',
      metrics: metrics || ['all']
    });
  }

  private handleUnsubscription(ws: WebSocket, metrics?: string[]): void {
    if (metrics) {
      const current = (ws as any).subscribedMetrics || [];
      (ws as any).subscribedMetrics = current.filter((m: string) => !metrics.includes(m));
    } else {
      (ws as any).subscribedMetrics = [];
    }
    
    this.sendToClient(ws, {
      type: 'subscription',
      status: 'unsubscribed',
      metrics
    });
  }

  private startMetricsBroadcast(): void {
    // Broadcast metrics every 5 seconds
    this.metricsInterval = setInterval(() => {
      this.broadcastMetrics();
    }, 5000);
  }

  private async broadcastMetrics(): Promise<void> {
    const metrics = await this.collectCurrentMetrics();
    
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        const subscribedMetrics = (client as any).subscribedMetrics || ['all'];
        const filteredMetrics = this.filterMetrics(metrics, subscribedMetrics);
        
        this.sendToClient(client, {
          type: 'metrics_update',
          data: filteredMetrics,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  private async sendMetricsSnapshot(ws: WebSocket): Promise<void> {
    const metrics = await this.collectCurrentMetrics();
    
    this.sendToClient(ws, {
      type: 'metrics_snapshot',
      data: metrics,
      timestamp: new Date().toISOString()
    });
  }

  private async collectCurrentMetrics(): Promise<any> {
    // Collect various metrics
    const metricsService = MetricsCollectionService.getInstance();
    const systemMetrics = metricsService.getMetricsSummary();
    
    // Get WebSocket-specific metrics
    const wsMetrics = {
      totalConnections: this.clients.size,
      activeConnections: Array.from(this.clients).filter(
        ws => ws.readyState === WebSocket.OPEN
      ).length,
      pendingConnections: Array.from(this.clients).filter(
        ws => ws.readyState === WebSocket.CONNECTING
      ).length
    };

    // Memory usage
    const memUsage = process.memoryUsage();
    const memoryMetrics = {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024) // MB
    };

    // CPU usage (simple approximation)
    const cpuUsage = process.cpuUsage();
    const cpuMetrics = {
      user: Math.round(cpuUsage.user / 1000), // ms
      system: Math.round(cpuUsage.system / 1000) // ms
    };

    return {
      system: systemMetrics,
      websocket: wsMetrics,
      memory: memoryMetrics,
      cpu: cpuMetrics,
      uptime: Math.round(process.uptime()),
      timestamp: Date.now()
    };
  }

  private filterMetrics(metrics: any, subscriptions: string[]): any {
    if (subscriptions.includes('all')) {
      return metrics;
    }

    const filtered: any = {};
    subscriptions.forEach(sub => {
      if (metrics[sub]) {
        filtered[sub] = metrics[sub];
      }
    });

    // Always include timestamp
    filtered.timestamp = metrics.timestamp;
    
    return filtered;
  }

  private sendToClient(ws: WebSocket, data: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(data));
      } catch (error) {
        logger.error('[METRICS_WS] Failed to send to client', error);
      }
    }
  }

  public broadcast(type: string, data: any): void {
    const message = {
      type,
      data,
      timestamp: new Date().toISOString()
    };

    this.clients.forEach(client => {
      this.sendToClient(client, message);
    });
  }

  public getConnectionCount(): number {
    return this.clients.size;
  }

  public handleUpgrade(request: any, socket: any, head: any): void {
    this.wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
      this.wss.emit('connection', ws, request);
    });
  }

  public close(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    this.clients.forEach(client => {
      client.close(1000, 'Server shutting down');
    });

    this.wss.close();
    logger.info('[METRICS_WS] Metrics WebSocket server closed');
  }
}

// Export singleton instance creator
export function createMetricsWebSocketServer(server: Server): MetricsWebSocketServer {
  return new MetricsWebSocketServer(server);
}