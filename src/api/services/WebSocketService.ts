import { EventEmitter } from 'events';
import type { WebSocket } from 'ws';
import { z } from 'zod';

// Message types for WebSocket communication
export const WebSocketMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('agent.status'),
    agentId: z.string(),
    status: z.enum(['idle', 'busy', 'error', 'terminated']),
    timestamp: z.date()
  }),
  z.object({
    type: z.literal('agent.task'),
    agentId: z.string(),
    taskId: z.string(),
    status: z.enum(['started', 'completed', 'failed']),
    result: z.any().optional(),
    error: z.string().optional(),
    timestamp: z.date()
  }),
  z.object({
    type: z.literal('plan.update'),
    planId: z.string(),
    status: z.enum(['created', 'executing', 'completed', 'failed', 'replanned']),
    progress: z.object({
      completed: z.number(),
      total: z.number(),
      currentStep: z.string().optional()
    }).optional(),
    timestamp: z.date()
  }),
  z.object({
    type: z.literal('chat.message'),
    conversationId: z.string(),
    message: z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
      metadata: z.any().optional()
    }),
    timestamp: z.date()
  }),
  z.object({
    type: z.literal('task.update'),
    taskId: z.string(),
    status: z.enum(['queued', 'executing', 'completed', 'failed']),
    progress: z.number().min(0).max(100).optional(),
    result: z.any().optional(),
    error: z.string().optional(),
    timestamp: z.date()
  }),
  z.object({
    type: z.literal('rag.operation'),
    operation: z.enum(['indexing', 'searching', 'embedding']),
    status: z.enum(['started', 'completed', 'failed']),
    details: z.object({
      documentCount: z.number().optional(),
      chunkCount: z.number().optional(),
      duration: z.number().optional(),
      error: z.string().optional()
    }).optional(),
    timestamp: z.date()
  }),
  z.object({
    type: z.literal('system.health'),
    services: z.record(z.enum(['healthy', 'degraded', 'down'])),
    metrics: z.object({
      cpu: z.number().optional(),
      memory: z.number().optional(),
      activeAgents: z.number().optional(),
      queueLength: z.number().optional()
    }).optional(),
    timestamp: z.date()
  })
]);

export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

export class WebSocketService extends EventEmitter {
  private clients: Map<string, Set<WebSocket>> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map();

  constructor() {
    super();
    this.setMaxListeners(0); // No limit on listeners
  }

  /**
   * Register a WebSocket client
   */
  registerClient(clientId: string, ws: WebSocket): void {
    if (!this.clients.has(clientId)) {
      this.clients.set(clientId, new Set());
    }
    this.clients.get(clientId)!.add(ws);

    // Clean up on disconnect
    ws.on('close', () => {
      this.unregisterClient(clientId, ws);
    });
  }

  /**
   * Unregister a WebSocket client
   */
  unregisterClient(clientId: string, ws: WebSocket): void {
    const clientSockets = this.clients.get(clientId);
    if (clientSockets) {
      clientSockets.delete(ws);
      if (clientSockets.size === 0) {
        this.clients.delete(clientId);
        this.subscriptions.delete(clientId);
      }
    }
  }

  /**
   * Subscribe a client to specific message types
   */
  subscribe(clientId: string, types: string[]): void {
    if (!this.subscriptions.has(clientId)) {
      this.subscriptions.set(clientId, new Set());
    }
    const clientSubs = this.subscriptions.get(clientId)!;
    types.forEach(type => clientSubs.add(type));
  }

  /**
   * Unsubscribe a client from specific message types
   */
  unsubscribe(clientId: string, types: string[]): void {
    const clientSubs = this.subscriptions.get(clientId);
    if (clientSubs) {
      types.forEach(type => clientSubs.delete(type));
    }
  }

  /**
   * Broadcast a message to all subscribed clients
   */
  broadcast(message: WebSocketMessage): void {
    const messageStr = JSON.stringify(message);

    this.clients.forEach((sockets, clientId) => {
      const clientSubs = this.subscriptions.get(clientId);
      
      // Check if client is subscribed to this message type
      if (clientSubs && (clientSubs.has(message.type) || clientSubs.has('*'))) {
        sockets.forEach(ws => {
          if (ws.readyState === ws.OPEN) {
            ws.send(messageStr);
          }
        });
      }
    });

    // Also emit as an event for internal listeners
    this.emit(message.type, message);
  }

  /**
   * Send a message to a specific client
   */
  sendToClient(clientId: string, message: WebSocketMessage): void {
    const sockets = this.clients.get(clientId);
    if (sockets) {
      const messageStr = JSON.stringify(message);
      sockets.forEach(ws => {
        if (ws.readyState === ws.OPEN) {
          ws.send(messageStr);
        }
      });
    }
  }

  /**
   * Get the number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get client subscription info
   */
  getClientSubscriptions(clientId: string): string[] {
    const subs = this.subscriptions.get(clientId);
    return subs ? Array.from(subs) : [];
  }

  // Convenience methods for common broadcasts

  broadcastAgentStatus(agentId: string, status: 'idle' | 'busy' | 'error' | 'terminated'): void {
    this.broadcast({
      type: 'agent.status',
      agentId,
      status,
      timestamp: new Date()
    });
  }

  broadcastAgentTask(
    agentId: string, 
    taskId: string, 
    status: 'started' | 'completed' | 'failed',
    result?: any,
    error?: string
  ): void {
    this.broadcast({
      type: 'agent.task',
      agentId,
      taskId,
      status,
      result,
      error,
      timestamp: new Date()
    });
  }

  broadcastPlanUpdate(
    planId: string,
    status: 'created' | 'executing' | 'completed' | 'failed' | 'replanned',
    progress?: { completed: number; total: number; currentStep?: string }
  ): void {
    this.broadcast({
      type: 'plan.update',
      planId,
      status,
      progress,
      timestamp: new Date()
    });
  }

  broadcastChatMessage(
    conversationId: string,
    message: { role: 'user' | 'assistant' | 'system'; content: string; metadata?: any }
  ): void {
    this.broadcast({
      type: 'chat.message',
      conversationId,
      message,
      timestamp: new Date()
    });
  }

  broadcastTaskUpdate(
    taskId: string,
    status: 'queued' | 'executing' | 'completed' | 'failed',
    progress?: number,
    result?: any,
    error?: string
  ): void {
    this.broadcast({
      type: 'task.update',
      taskId,
      status,
      progress,
      result,
      error,
      timestamp: new Date()
    });
  }

  broadcastRAGOperation(
    operation: 'indexing' | 'searching' | 'embedding',
    status: 'started' | 'completed' | 'failed',
    details?: {
      documentCount?: number;
      chunkCount?: number;
      duration?: number;
      error?: string;
    }
  ): void {
    this.broadcast({
      type: 'rag.operation',
      operation,
      status,
      details,
      timestamp: new Date()
    });
  }

  broadcastSystemHealth(
    services: Record<string, 'healthy' | 'degraded' | 'down'>,
    metrics?: {
      cpu?: number;
      memory?: number;
      activeAgents?: number;
      queueLength?: number;
    }
  ): void {
    this.broadcast({
      type: 'system.health',
      services,
      metrics,
      timestamp: new Date()
    });
  }
}

// Singleton instance
export const wsService = new WebSocketService();