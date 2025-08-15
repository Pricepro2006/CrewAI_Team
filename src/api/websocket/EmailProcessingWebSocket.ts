/**
 * Email Processing WebSocket Service
 * Provides real-time updates for email processing pipeline
 */

import { EventEmitter } from "events";
import { logger } from "../../utils/logger.js";
import type { WebSocketServer, WebSocket } from "ws";

export interface EmailProcessingEvent {
  type: 'email_processed' | 'phase_started' | 'phase_completed' | 'error' | 'stats_updated';
  emailId?: string;
  phase?: 1 | 2 | 3;
  timestamp: string;
  data?: any;
  processingTime?: number;
  error?: string;
}

export interface ProcessingStats {
  totalEmails: number;
  processedEmails: number;
  currentlyProcessing: number;
  averageProcessingTime: number;
  phase1Complete: number;
  phase2Complete: number;
  phase3Complete: number;
  errors: number;
}

export class EmailProcessingWebSocket extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private processingStats: ProcessingStats = {
    totalEmails: 0,
    processedEmails: 0,
    currentlyProcessing: 0,
    averageProcessingTime: 0,
    phase1Complete: 0,
    phase2Complete: 0,
    phase3Complete: 0,
    errors: 0,
  };
  private statsUpdateInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.setupStatsUpdater();
    logger.info("EmailProcessingWebSocket initialized", "WEBSOCKET");
  }

  /**
   * Initialize WebSocket server with existing server
   */
  initialize(wss: WebSocketServer): void {
    this.wss = wss;
    this.setupWebSocketHandlers();
    logger.info("EmailProcessingWebSocket connected to WebSocket server", "WEBSOCKET");
  }

  /**
   * Setup WebSocket connection handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);
      logger.debug("Email processing WebSocket client connected", "WEBSOCKET", {
        totalClients: this.clients.size,
      });

      // Send initial stats to new client
      this.sendToClient(ws, {
        type: 'stats_updated',
        timestamp: new Date().toISOString(),
        data: this.processingStats,
      });

      // Handle client disconnect
      ws.on('close', () => {
        this.clients.delete(ws);
        logger.debug("Email processing WebSocket client disconnected", "WEBSOCKET", {
          totalClients: this.clients.size,
        });
      });

      // Handle client errors
      ws.on('error', (error) => {
        logger.warn("Email processing WebSocket client error", "WEBSOCKET", { error });
        this.clients.delete(ws);
      });
    });
  }

  /**
   * Setup periodic stats updates
   */
  private setupStatsUpdater(): void {
    this.statsUpdateInterval = setInterval(() => {
      this.broadcastStatsUpdate();
    }, 5000); // Update every 5 seconds
  }

  /**
   * Broadcast processing event to all connected clients
   */
  broadcastEvent(event: EmailProcessingEvent): void {
    const message = JSON.stringify(event);
    let successCount = 0;
    let errorCount = 0;

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
          successCount++;
        } catch (error) {
          errorCount++;
          logger.warn("Failed to send WebSocket message to client", "WEBSOCKET", { error });
          this.clients.delete(client);
        }
      } else {
        this.clients.delete(client);
      }
    });

    if (successCount > 0) {
      logger.debug("Broadcasting email processing event", "WEBSOCKET", {
        eventType: event.type,
        clients: successCount,
        errors: errorCount,
      });
    }
  }

  /**
   * Send event to specific client
   */
  private sendToClient(client: WebSocket, event: EmailProcessingEvent): void {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(event));
      } catch (error) {
        logger.warn("Failed to send WebSocket message to specific client", "WEBSOCKET", { error });
        this.clients.delete(client);
      }
    }
  }

  /**
   * Update processing statistics
   */
  updateStats(stats: Partial<ProcessingStats>): void {
    this.processingStats = { ...this.processingStats, ...stats };
    
    // Broadcast stats update immediately for important changes
    if (stats.currentlyProcessing !== undefined || stats.processedEmails !== undefined) {
      this.broadcastStatsUpdate();
    }
  }

  /**
   * Broadcast stats update to all clients
   */
  private broadcastStatsUpdate(): void {
    this.broadcastEvent({
      type: 'stats_updated',
      timestamp: new Date().toISOString(),
      data: this.processingStats,
    });
  }

  /**
   * Email processing lifecycle events
   */
  emailProcessingStarted(emailId: string, phase: 1 | 2 | 3): void {
    this.updateStats({ currentlyProcessing: this.processingStats.currentlyProcessing + 1 });
    
    this.broadcastEvent({
      type: 'phase_started',
      emailId,
      phase,
      timestamp: new Date().toISOString(),
    });
  }

  emailProcessingCompleted(emailId: string, phase: 1 | 2 | 3, processingTime: number): void {
    const updates: Partial<ProcessingStats> = {
      currentlyProcessing: Math.max(0, this.processingStats.currentlyProcessing - 1),
      processedEmails: this.processingStats.processedEmails + 1,
    };

    // Update phase-specific counters
    switch (phase) {
      case 1:
        updates.phase1Complete = this.processingStats.phase1Complete + 1;
        break;
      case 2:
        updates.phase2Complete = this.processingStats.phase2Complete + 1;
        break;
      case 3:
        updates.phase3Complete = this.processingStats.phase3Complete + 1;
        break;
    }

    // Update average processing time
    const totalProcessingTime = this.processingStats.averageProcessingTime * this.processingStats.processedEmails;
    updates.averageProcessingTime = (totalProcessingTime + processingTime) / (this.processingStats.processedEmails + 1);

    this.updateStats(updates);

    this.broadcastEvent({
      type: 'phase_completed',
      emailId,
      phase,
      timestamp: new Date().toISOString(),
      processingTime,
    });

    this.broadcastEvent({
      type: 'email_processed',
      emailId,
      timestamp: new Date().toISOString(),
      data: { phase, processingTime },
    });
  }

  emailProcessingError(emailId: string, phase: 1 | 2 | 3, error: string): void {
    this.updateStats({ 
      currentlyProcessing: Math.max(0, this.processingStats.currentlyProcessing - 1),
      errors: this.processingStats.errors + 1,
    });

    this.broadcastEvent({
      type: 'error',
      emailId,
      phase,
      timestamp: new Date().toISOString(),
      error,
    });
  }

  /**
   * Get current statistics
   */
  getStats(): ProcessingStats {
    return { ...this.processingStats };
  }

  /**
   * Get connected clients count
   */
  getConnectedClients(): number {
    return this.clients.size;
  }

  /**
   * Shutdown the WebSocket service
   */
  shutdown(): void {
    if (this.statsUpdateInterval) {
      clearInterval(this.statsUpdateInterval);
      this.statsUpdateInterval = null;
    }

    // Close all client connections
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1000, 'Server shutting down');
      }
    });
    this.clients.clear();

    this.removeAllListeners();
    logger.info("EmailProcessingWebSocket shut down", "WEBSOCKET");
  }
}

// Singleton instance for global use
export const emailProcessingWebSocket = new EmailProcessingWebSocket();