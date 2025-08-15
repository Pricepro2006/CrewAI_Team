/**
 * WebSocket Performance Tracking System
 * Monitors WebSocket connections, message latency, and connection health
 */

import { EventEmitter } from 'node:events';
import { logger } from '../utils/logger.js';
import type { WebSocket } from 'ws';

export interface WebSocketMetrics {
  connectionId: string;
  clientIp: string;
  userAgent?: string;
  userId?: string;
  connectedAt: number;
  disconnectedAt?: number;
  connectionDuration?: number;
  messagesSent: number;
  messagesReceived: number;
  bytesTransferred: number;
  avgLatency: number;
  maxLatency: number;
  minLatency: number;
  errorCount: number;
  lastActivity: number;
  protocol?: string;
  endpoint: string;
}

export interface MessageMetrics {
  messageId: string;
  connectionId: string;
  type: 'inbound' | 'outbound';
  event: string;
  size: number;
  timestamp: number;
  latency?: number;
  processingTime?: number;
  error?: boolean;
  errorMessage?: string;
}

export interface WebSocketAggregates {
  timestamp: number;
  activeConnections: number;
  totalConnections: number;
  totalDisconnections: number;
  avgConnectionDuration: number;
  totalMessages: number;
  messagesPerSecond: number;
  avgMessageLatency: number;
  totalBytesTransferred: number;
  errorRate: number;
  connectionErrorRate: number;
  topEndpoints: Array<{ endpoint: string; connections: number; avgLatency: number }>;
  topEvents: Array<{ event: string; count: number; avgLatency: number }>;
  performanceDistribution: {
    fast: number; // < 100ms
    medium: number; // 100-500ms
    slow: number; // > 500ms
  };
}

export interface WebSocketAlerts {
  highLatency: { threshold: number; current: number };
  highErrorRate: { threshold: number; current: number };
  connectionSpike: { threshold: number; current: number };
  memoryLeak: { threshold: number; current: number };
}

class WebSocketPerformanceTracker extends EventEmitter {
  private static instance: WebSocketPerformanceTracker;
  private connections = new Map<string, WebSocketMetrics>();
  private messages: MessageMetrics[] = [];
  private aggregationInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private initialized = false;
  private pendingMessages = new Map<string, number>(); // messageId -> timestamp
  private alertThresholds = {
    maxLatency: 1000, // 1 second
    maxErrorRate: 5, // 5%
    maxConnectionSpike: 100, // 100 new connections per minute
    maxMemoryUsage: 100 * 1024 * 1024, // 100MB
  };

  private constructor() {
    super();
  }

  static getInstance(): WebSocketPerformanceTracker {
    if (!WebSocketPerformanceTracker.instance) {
      WebSocketPerformanceTracker.instance = new WebSocketPerformanceTracker();
    }
    return WebSocketPerformanceTracker.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('WebSocket performance tracker already initialized', 'WS_PERF');
      return;
    }

    // Start aggregation
    this.aggregationInterval = setInterval(() => {
      this.aggregateMetrics();
    }, 30 * 1000); // Every 30 seconds

    // Start cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Every 5 minutes

    this.initialized = true;
    logger.info('WebSocket performance tracker initialized', 'WS_PERF');
    this.emit('initialized');
  }

  // Track new WebSocket connection
  trackConnection(ws: WebSocket, connectionId: string, clientIp: string, endpoint: string, userAgent?: string, userId?: string): void {
    const metrics: WebSocketMetrics = {
      connectionId,
      clientIp,
      userAgent,
      userId,
      connectedAt: Date.now(),
      messagesSent: 0,
      messagesReceived: 0,
      bytesTransferred: 0,
      avgLatency: 0,
      maxLatency: 0,
      minLatency: Number.MAX_SAFE_INTEGER,
      errorCount: 0,
      lastActivity: Date.now(),
      endpoint,
    };

    this?.connections?.set(connectionId, metrics);

    // Track WebSocket events
    ws.on('message', (data: any) => {
      this.trackMessage(connectionId, 'inbound', 'message', data?.length || 0);
    });

    ws.on('error', (error: any) => {
      this.trackError(connectionId, error.message);
    });

    ws.on('close', () => {
      this.trackDisconnection(connectionId);
    });

    logger.debug('WebSocket connection tracked', 'WS_PERF', {
      connectionId,
      clientIp,
      endpoint,
      userId,
    });

    this.emit('connection-tracked', metrics);
  }

  // Track WebSocket disconnection
  trackDisconnection(connectionId: string): void {
    const connection = this?.connections?.get(connectionId);
    if (connection) {
      const now = Date.now();
      connection.disconnectedAt = now;
      connection.connectionDuration = now - connection.connectedAt;
      
      // Move to historical data (keep for aggregation)
      // Don't delete immediately to allow for final metrics collection
      
      logger.debug('WebSocket disconnection tracked', 'WS_PERF', {
        connectionId,
        duration: connection.connectionDuration,
        messagesSent: connection.messagesSent,
        messagesReceived: connection.messagesReceived,
      });

      this.emit('disconnection-tracked', connection);
    }
  }

  // Track outbound message
  trackOutboundMessage(connectionId: string, event: string, data: any): string {
    const messageId = this.generateMessageId();
    const size = this.calculateMessageSize(data);
    
    this.trackMessage(connectionId, 'outbound', event, size, messageId);
    this?.pendingMessages?.set(messageId, Date.now());
    
    return messageId;
  }

  // Track message acknowledgment
  trackMessageAck(messageId: string): void {
    const sentAt = this?.pendingMessages?.get(messageId);
    if (sentAt) {
      const latency = Date.now() - sentAt;
      this.updateLatencyMetrics(messageId, latency);
      this?.pendingMessages?.delete(messageId);
    }
  }

  // Track message processing time
  trackMessageProcessing(connectionId: string, event: string, processingTime: number): void {
    const connection = this?.connections?.get(connectionId);
    if (connection) {
      // Update processing metrics
      connection.lastActivity = Date.now();
      
      // Check for slow processing
      if (processingTime > 500) {
        this.emit('slow-processing', {
          connectionId,
          event,
          processingTime,
          threshold: 500,
        });
      }
    }
  }

  private trackMessage(connectionId: string, type: 'inbound' | 'outbound', event: string, size: number, messageId?: string): void {
    const connection = this?.connections?.get(connectionId);
    if (connection) {
      // Update connection metrics
      if (type === 'inbound') {
        connection.messagesReceived++;
      } else {
        connection.messagesSent++;
      }
      connection.bytesTransferred += size;
      connection.lastActivity = Date.now();

      // Store message metrics
      const messageMetrics: MessageMetrics = {
        messageId: messageId || this.generateMessageId(),
        connectionId,
        type,
        event,
        size,
        timestamp: Date.now(),
      };

      this?.messages?.push(messageMetrics);
      
      // Keep only recent messages for memory efficiency
      if (this?.messages?.length > 10000) {
        this.messages = this?.messages?.slice(-5000);
      }

      this?.connections?.set(connectionId, connection);
    }
  }

  private trackError(connectionId: string, errorMessage: string): void {
    const connection = this?.connections?.get(connectionId);
    if (connection) {
      connection.errorCount++;
      connection.lastActivity = Date.now();
      this?.connections?.set(connectionId, connection);

      logger.warn('WebSocket error tracked', 'WS_PERF', {
        connectionId,
        errorMessage,
        totalErrors: connection.errorCount,
      });

      this.emit('error-tracked', {
        connectionId,
        errorMessage,
        connection,
      });
    }
  }

  private updateLatencyMetrics(messageId: string, latency: number): void {
    // Find the message and update its latency
    const message = this?.messages?.find(m => m.messageId === messageId);
    if (message) {
      message.latency = latency;
      
      // Update connection latency metrics
      const connection = this?.connections?.get(message.connectionId);
      if (connection) {
        const totalMessages = connection.messagesSent + connection.messagesReceived;
        connection.avgLatency = ((connection.avgLatency * (totalMessages - 1)) + latency) / totalMessages;
        connection.maxLatency = Math.max(connection.maxLatency, latency);
        connection.minLatency = Math.min(connection.minLatency, latency);
        
        this?.connections?.set(message.connectionId, connection);

        // Check for high latency alert
        if (latency > this?.alertThresholds?.maxLatency) {
          this.emit('high-latency-alert', {
            connectionId: message.connectionId,
            latency,
            threshold: this?.alertThresholds?.maxLatency,
            event: message.event,
          });
        }
      }
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateMessageSize(data: any): number {
    try {
      return Buffer.byteLength(JSON.stringify(data));
    } catch {
      return 0;
    }
  }

  // Aggregate metrics for reporting
  private aggregateMetrics(): void {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    const activeConnections = Array.from(this?.connections?.values()).filter(c => !c.disconnectedAt);
    const recentConnections = Array.from(this?.connections?.values()).filter(c => c.connectedAt > fiveMinutesAgo);
    const recentMessages = this?.messages?.filter(m => m.timestamp > fiveMinutesAgo);
    const recentDisconnections = Array.from(this?.connections?.values()).filter(c => 
      c.disconnectedAt && c.disconnectedAt > fiveMinutesAgo
    );

    // Calculate aggregates
    const aggregates: WebSocketAggregates = {
      timestamp: now,
      activeConnections: activeConnections?.length || 0,
      totalConnections: recentConnections?.length || 0,
      totalDisconnections: recentDisconnections?.length || 0,
      avgConnectionDuration: this.calculateAverageConnectionDuration(recentDisconnections),
      totalMessages: recentMessages?.length || 0,
      messagesPerSecond: recentMessages?.length || 0 / 300, // 5 minutes = 300 seconds
      avgMessageLatency: this.calculateAverageLatency(recentMessages),
      totalBytesTransferred: recentMessages.reduce((sum: any, m: any) => sum + m.size, 0),
      errorRate: this.calculateErrorRate(recentConnections, recentMessages),
      connectionErrorRate: this.calculateConnectionErrorRate(recentConnections),
      topEndpoints: this.getTopEndpoints(activeConnections),
      topEvents: this.getTopEvents(recentMessages),
      performanceDistribution: this.getPerformanceDistribution(recentMessages),
    };

    // Check for alerts
    this.checkAggregateAlerts(aggregates);

    // Emit aggregates
    this.emit('metrics-aggregated', aggregates);

    logger.debug('WebSocket metrics aggregated', 'WS_PERF', {
      activeConnections: aggregates.activeConnections,
      messagesPerSecond: aggregates.messagesPerSecond,
      avgLatency: aggregates.avgMessageLatency,
      errorRate: aggregates.errorRate,
    });
  }

  private calculateAverageConnectionDuration(disconnections: WebSocketMetrics[]): number {
    if (disconnections?.length || 0 === 0) return 0;
    const totalDuration = disconnections.reduce((sum: any, c: any) => sum + (c.connectionDuration || 0), 0);
    return totalDuration / disconnections?.length || 0;
  }

  private calculateAverageLatency(messages: MessageMetrics[]): number {
    const messagesWithLatency = messages?.filter(m => m.latency !== undefined);
    if (messagesWithLatency?.length || 0 === 0) return 0;
    const totalLatency = messagesWithLatency.reduce((sum: any, m: any) => sum + (m.latency || 0), 0);
    return totalLatency / messagesWithLatency?.length || 0;
  }

  private calculateErrorRate(connections: WebSocketMetrics[], messages: MessageMetrics[]): number {
    const totalErrors = connections.reduce((sum: any, c: any) => sum + c.errorCount, 0) + 
                       messages?.filter(m => m.error).length;
    const totalEvents = connections?.length || 0 + messages?.length || 0;
    return totalEvents > 0 ? (totalErrors / totalEvents) * 100 : 0;
  }

  private calculateConnectionErrorRate(connections: WebSocketMetrics[]): number {
    if (connections?.length || 0 === 0) return 0;
    const connectionsWithErrors = connections?.filter(c => c.errorCount > 0).length;
    return (connectionsWithErrors / connections?.length || 0) * 100;
  }

  private getTopEndpoints(connections: WebSocketMetrics[]): Array<{ endpoint: string; connections: number; avgLatency: number }> {
    const endpointStats = new Map<string, { count: number; totalLatency: number; latencyCount: number }>();
    
    connections.forEach(connection => {
      const existing = endpointStats.get(connection.endpoint) || { count: 0, totalLatency: 0, latencyCount: 0 };
      existing.count++;
      if (connection.avgLatency > 0) {
        existing.totalLatency += connection.avgLatency;
        existing.latencyCount++;
      }
      endpointStats.set(connection.endpoint, existing);
    });

    return Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        connections: stats.count,
        avgLatency: stats.latencyCount > 0 ? stats.totalLatency / stats.latencyCount : 0,
      }))
      .sort((a, b) => b.connections - a.connections)
      .slice(0, 10);
  }

  private getTopEvents(messages: MessageMetrics[]): Array<{ event: string; count: number; avgLatency: number }> {
    const eventStats = new Map<string, { count: number; totalLatency: number; latencyCount: number }>();
    
    messages.forEach(message => {
      const existing = eventStats.get(message.event) || { count: 0, totalLatency: 0, latencyCount: 0 };
      existing.count++;
      if (message.latency !== undefined) {
        existing.totalLatency += message.latency;
        existing.latencyCount++;
      }
      eventStats.set(message.event, existing);
    });

    return Array.from(eventStats.entries())
      .map(([event, stats]) => ({
        event,
        count: stats.count,
        avgLatency: stats.latencyCount > 0 ? stats.totalLatency / stats.latencyCount : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getPerformanceDistribution(messages: MessageMetrics[]): { fast: number; medium: number; slow: number } {
    const messagesWithLatency = messages?.filter(m => m.latency !== undefined);
    if (messagesWithLatency?.length || 0 === 0) {
      return { fast: 0, medium: 0, slow: 0 };
    }

    const fast = messagesWithLatency?.filter(m => (m.latency || 0) < 100).length;
    const medium = messagesWithLatency?.filter(m => (m.latency || 0) >= 100 && (m.latency || 0) <= 500).length;
    const slow = messagesWithLatency?.filter(m => (m.latency || 0) > 500).length;
    const total = messagesWithLatency?.length || 0;

    return {
      fast: Math.round((fast / total) * 100),
      medium: Math.round((medium / total) * 100),
      slow: Math.round((slow / total) * 100),
    };
  }

  private checkAggregateAlerts(aggregates: WebSocketAggregates): void {
    const alerts: string[] = [];

    // High latency alert
    if (aggregates.avgMessageLatency > this?.alertThresholds?.maxLatency) {
      alerts.push(`High average message latency: ${aggregates?.avgMessageLatency?.toFixed(0)}ms`);
    }

    // High error rate alert
    if (aggregates.errorRate > this?.alertThresholds?.maxErrorRate) {
      alerts.push(`High error rate: ${aggregates?.errorRate?.toFixed(1)}%`);
    }

    // Connection spike alert
    if (aggregates.totalConnections > this?.alertThresholds?.maxConnectionSpike) {
      alerts.push(`Connection spike detected: ${aggregates.totalConnections} new connections`);
    }

    if (alerts?.length || 0 > 0) {
      this.emit('aggregate-alerts', {
        alerts,
        aggregates,
        timestamp: Date.now(),
      });

      logger.warn('WebSocket aggregate alerts triggered', 'WS_PERF', {
        alerts,
        avgLatency: aggregates.avgMessageLatency,
        errorRate: aggregates.errorRate,
        newConnections: aggregates.totalConnections,
      });
    }
  }

  // Public API methods
  getActiveConnections(): WebSocketMetrics[] {
    return Array.from(this?.connections?.values()).filter(c => !c.disconnectedAt);
  }

  getConnectionMetrics(connectionId: string): WebSocketMetrics | undefined {
    return this?.connections?.get(connectionId);
  }

  getCurrentAggregates(): WebSocketAggregates | null {
    const now = Date.now();
    const activeConnections = this.getActiveConnections();
    const recentMessages = this?.messages?.filter(m => m.timestamp > now - (5 * 60 * 1000));

    if (activeConnections?.length || 0 === 0 && recentMessages?.length || 0 === 0) {
      return null;
    }

    return {
      timestamp: now,
      activeConnections: activeConnections?.length || 0,
      totalConnections: 0, // This would be calculated differently in a real scenario
      totalDisconnections: 0,
      avgConnectionDuration: 0,
      totalMessages: recentMessages?.length || 0,
      messagesPerSecond: recentMessages?.length || 0 / 300,
      avgMessageLatency: this.calculateAverageLatency(recentMessages),
      totalBytesTransferred: recentMessages.reduce((sum: any, m: any) => sum + m.size, 0),
      errorRate: this.calculateErrorRate(activeConnections, recentMessages),
      connectionErrorRate: this.calculateConnectionErrorRate(activeConnections),
      topEndpoints: this.getTopEndpoints(activeConnections),
      topEvents: this.getTopEvents(recentMessages),
      performanceDistribution: this.getPerformanceDistribution(recentMessages),
    };
  }

  updateAlertThresholds(thresholds: Partial<typeof this.alertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    logger.info('WebSocket alert thresholds updated', 'WS_PERF', thresholds);
  }

  // Clean up old data
  private cleanup(): void {
    const cutoff = Date.now() - (60 * 60 * 1000); // 1 hour ago
    
    // Remove old disconnected connections
    for (const [connectionId, connection] of this?.connections?.entries()) {
      if (connection.disconnectedAt && connection.disconnectedAt < cutoff) {
        this?.connections?.delete(connectionId);
      }
    }

    // Remove old messages
    this.messages = this?.messages?.filter(m => m.timestamp > cutoff);

    // Clean up pending messages
    for (const [messageId, timestamp] of this?.pendingMessages?.entries()) {
      if (timestamp < cutoff) {
        this?.pendingMessages?.delete(messageId);
      }
    }

    logger.debug('WebSocket performance tracker cleanup completed', 'WS_PERF', {
      active_connections: this.getActiveConnections().length,
      total_connections: this?.connections?.size,
      total_messages: this?.messages?.length,
      pending_messages: this?.pendingMessages?.size,
    });
  }

  shutdown(): void {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.initialized = false;
    logger.info('WebSocket performance tracker shut down', 'WS_PERF');
  }
}

export const webSocketPerformanceTracker = WebSocketPerformanceTracker.getInstance();
export { WebSocketPerformanceTracker };
