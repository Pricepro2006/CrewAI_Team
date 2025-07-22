# WebSocket Real-time Patterns: TypeScript, Node.js, tRPC, and Event-Driven Architecture

## Overview

WebSockets enable bi-directional, real-time communication between clients and servers, making them essential for modern interactive applications. This guide covers implementation patterns for WebSocket integration with tRPC, TypeScript, and event-driven architectures.

## tRPC Real-time Communication Options

### Transport Options

tRPC supports two main approaches for real-time communication:

1. **WebSockets**: Full bidirectional communication with connection state management
2. **Server-Sent Events (SSE)**: Simpler unidirectional server-to-client streaming

### When to Use Each

- **SSE**: Recommended for most subscription use cases - simpler setup, no custom server required
- **WebSockets**: For complex bidirectional communication, gaming, collaborative editing

## WebSocket Integration with tRPC

### 1. Basic Server Setup

```typescript
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import { createTRPCRouter } from './trpc';
import { WebSocketServer } from 'ws';
import { createContext } from './context';

const appRouter = createTRPCRouter({
  // Your routers here
});

const wss = new WebSocketServer({
  port: 3001,
});

const handler = applyWSSHandler({
  wss,
  router: appRouter,
  createContext,
  keepAlive: {
    enabled: true,
    pingMs: 30000,
    pongWaitMs: 5000,
  },
});

wss.on('connection', (ws) => {
  console.log(`Connection opened (${wss.clients.size} total)`);
  
  ws.once('close', () => {
    console.log(`Connection closed (${wss.clients.size} total)`);
  });
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  handler.broadcastReconnectNotification();
  wss.close();
});
```

### 2. Subscription Procedures

```typescript
import { z } from 'zod';
import { observable } from '@trpc/server/observable';
import { EventEmitter } from 'events';

// Event emitter for real-time events
const eventEmitter = new EventEmitter();

const subscriptionRouter = createTRPCRouter({
  // Basic subscription
  onMessage: publicProcedure
    .input(z.object({ roomId: z.string() }))
    .subscription(({ input }) => {
      return observable<{ message: string; userId: string; timestamp: Date }>((emit) => {
        const handler = (data: any) => {
          if (data.roomId === input.roomId) {
            emit.next(data);
          }
        };
        
        eventEmitter.on('message', handler);
        
        return () => {
          eventEmitter.off('message', handler);
        };
      });
    }),
    
  // Tracked subscription with auto-reconnection
  onTaskProgress: publicProcedure
    .input(z.object({ taskId: z.string(), lastEventId: z.string().optional() }))
    .subscription(({ input }) => {
      return observable<{ progress: number; status: string; eventId: string }>((emit) => {
        const handler = (data: any) => {
          if (data.taskId === input.taskId) {
            emit.next({
              ...data,
              eventId: `${data.taskId}-${Date.now()}`,
            });
          }
        };
        
        eventEmitter.on('taskProgress', handler);
        
        // Send initial state if reconnecting
        if (input.lastEventId) {
          // Resume from last known state
          const lastState = getTaskState(input.taskId, input.lastEventId);
          if (lastState) {
            emit.next(lastState);
          }
        }
        
        return () => {
          eventEmitter.off('taskProgress', handler);
        };
      });
    }),
    
  // Agent status subscription
  onAgentStatus: publicProcedure
    .subscription(() => {
      return observable<{
        agentId: string;
        status: 'active' | 'idle' | 'error';
        currentTask?: string;
        progress?: number;
      }>((emit) => {
        const handler = (data: any) => {
          emit.next(data);
        };
        
        eventEmitter.on('agentStatus', handler);
        
        return () => {
          eventEmitter.off('agentStatus', handler);
        };
      });
    }),
});
```

### 3. Client-Side Implementation

```typescript
import { createTRPCClient, createWSClient, wsLink, httpBatchLink, splitLink } from '@trpc/client';
import type { AppRouter } from '../server/router';

// Create WebSocket client
const wsClient = createWSClient({
  url: 'ws://localhost:3001',
  onOpen: () => {
    console.log('WebSocket connected');
  },
  onClose: () => {
    console.log('WebSocket disconnected');
  },
  onError: (error) => {
    console.error('WebSocket error:', error);
  },
});

// Create tRPC client with mixed transport
const trpcClient = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === 'subscription',
      true: wsLink({
        client: wsClient,
      }),
      false: httpBatchLink({
        url: 'http://localhost:3000/api/trpc',
      }),
    }),
  ],
});

// Usage examples
export class RealtimeClient {
  private subscriptions: Map<string, () => void> = new Map();
  
  subscribeToMessages(roomId: string, callback: (message: any) => void): () => void {
    const unsubscribe = trpcClient.onMessage.subscribe(
      { roomId },
      {
        onData: callback,
        onError: (error) => {
          console.error('Message subscription error:', error);
        },
      }
    );
    
    this.subscriptions.set(`messages-${roomId}`, unsubscribe);
    return unsubscribe;
  }
  
  subscribeToTaskProgress(taskId: string, callback: (progress: any) => void): () => void {
    const unsubscribe = trpcClient.onTaskProgress.subscribe(
      { taskId },
      {
        onData: callback,
        onError: (error) => {
          console.error('Task progress subscription error:', error);
        },
      }
    );
    
    this.subscriptions.set(`task-${taskId}`, unsubscribe);
    return unsubscribe;
  }
  
  subscribeToAgentStatus(callback: (status: any) => void): () => void {
    const unsubscribe = trpcClient.onAgentStatus.subscribe(
      undefined,
      {
        onData: callback,
        onError: (error) => {
          console.error('Agent status subscription error:', error);
        },
      }
    );
    
    this.subscriptions.set('agent-status', unsubscribe);
    return unsubscribe;
  }
  
  disconnect(): void {
    this.subscriptions.forEach((unsubscribe) => unsubscribe());
    this.subscriptions.clear();
    wsClient.close();
  }
}
```

## Event-Driven Architecture Patterns

### 1. Event Emitter Pattern

```typescript
import { EventEmitter } from 'events';

class TypedEventEmitter<T extends Record<string, any>> {
  private emitter = new EventEmitter();
  
  on<K extends keyof T>(event: K, listener: (data: T[K]) => void): void {
    this.emitter.on(event as string, listener);
  }
  
  off<K extends keyof T>(event: K, listener: (data: T[K]) => void): void {
    this.emitter.off(event as string, listener);
  }
  
  emit<K extends keyof T>(event: K, data: T[K]): void {
    this.emitter.emit(event as string, data);
  }
  
  once<K extends keyof T>(event: K, listener: (data: T[K]) => void): void {
    this.emitter.once(event as string, listener);
  }
}

interface SystemEvents {
  agentStatusChange: {
    agentId: string;
    status: 'active' | 'idle' | 'error';
    timestamp: Date;
  };
  taskProgress: {
    taskId: string;
    progress: number;
    status: string;
    timestamp: Date;
  };
  messageReceived: {
    roomId: string;
    message: string;
    userId: string;
    timestamp: Date;
  };
}

const systemEvents = new TypedEventEmitter<SystemEvents>();
```

### 2. Event Broadcasting Service

```typescript
class EventBroadcaster {
  private eventEmitter: EventEmitter;
  private subscriberCount: Map<string, number> = new Map();
  
  constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter;
  }
  
  broadcast<T>(event: string, data: T): void {
    this.eventEmitter.emit(event, data);
    
    // Track broadcast metrics
    this.trackBroadcast(event);
  }
  
  addSubscriber(event: string): void {
    const current = this.subscriberCount.get(event) || 0;
    this.subscriberCount.set(event, current + 1);
  }
  
  removeSubscriber(event: string): void {
    const current = this.subscriberCount.get(event) || 0;
    this.subscriberCount.set(event, Math.max(0, current - 1));
  }
  
  getSubscriberCount(event: string): number {
    return this.subscriberCount.get(event) || 0;
  }
  
  private trackBroadcast(event: string): void {
    const subscriberCount = this.getSubscriberCount(event);
    console.log(`Broadcasting ${event} to ${subscriberCount} subscribers`);
  }
}
```

### 3. Room-based Event Management

```typescript
class RoomManager {
  private rooms: Map<string, Set<string>> = new Map();
  private userRooms: Map<string, Set<string>> = new Map();
  
  joinRoom(userId: string, roomId: string): void {
    // Add user to room
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(userId);
    
    // Track user's rooms
    if (!this.userRooms.has(userId)) {
      this.userRooms.set(userId, new Set());
    }
    this.userRooms.get(userId)!.add(roomId);
  }
  
  leaveRoom(userId: string, roomId: string): void {
    this.rooms.get(roomId)?.delete(userId);
    this.userRooms.get(userId)?.delete(roomId);
    
    // Clean up empty rooms
    if (this.rooms.get(roomId)?.size === 0) {
      this.rooms.delete(roomId);
    }
  }
  
  getRoomUsers(roomId: string): string[] {
    return Array.from(this.rooms.get(roomId) || []);
  }
  
  getUserRooms(userId: string): string[] {
    return Array.from(this.userRooms.get(userId) || []);
  }
  
  broadcastToRoom(roomId: string, event: string, data: any): void {
    const users = this.getRoomUsers(roomId);
    users.forEach(userId => {
      systemEvents.emit('userMessage', {
        userId,
        event,
        data,
      });
    });
  }
}
```

## Advanced WebSocket Patterns

### 1. Connection State Management

```typescript
class ConnectionManager {
  private connections: Map<string, WebSocket> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  
  addConnection(userId: string, ws: WebSocket): void {
    this.connections.set(userId, ws);
    this.startHeartbeat(userId);
    
    ws.on('close', () => {
      this.removeConnection(userId);
    });
    
    ws.on('error', (error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
      this.removeConnection(userId);
    });
  }
  
  removeConnection(userId: string): void {
    this.connections.delete(userId);
    
    const interval = this.heartbeatIntervals.get(userId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(userId);
    }
  }
  
  sendToUser(userId: string, message: any): boolean {
    const ws = this.connections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }
  
  broadcastToAll(message: any): void {
    this.connections.forEach((ws, userId) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      } else {
        this.removeConnection(userId);
      }
    });
  }
  
  private startHeartbeat(userId: string): void {
    const interval = setInterval(() => {
      const ws = this.connections.get(userId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        this.removeConnection(userId);
      }
    }, 30000);
    
    this.heartbeatIntervals.set(userId, interval);
  }
  
  getConnectionCount(): number {
    return this.connections.size;
  }
  
  getConnectedUsers(): string[] {
    return Array.from(this.connections.keys());
  }
}
```

### 2. Message Queue Integration

```typescript
import { EventEmitter } from 'events';

class MessageQueue {
  private queue: Array<{
    id: string;
    userId: string;
    message: any;
    timestamp: Date;
    retryCount: number;
  }> = [];
  
  private processing = false;
  private maxRetries = 3;
  
  constructor(private connectionManager: ConnectionManager) {}
  
  enqueue(userId: string, message: any): void {
    this.queue.push({
      id: `${userId}-${Date.now()}`,
      userId,
      message,
      timestamp: new Date(),
      retryCount: 0,
    });
    
    this.processQueue();
  }
  
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      
      try {
        const delivered = this.connectionManager.sendToUser(item.userId, item.message);
        
        if (!delivered) {
          if (item.retryCount < this.maxRetries) {
            item.retryCount++;
            this.queue.push(item);
          } else {
            console.error(`Failed to deliver message ${item.id} after ${this.maxRetries} retries`);
          }
        }
      } catch (error) {
        console.error(`Error processing message ${item.id}:`, error);
      }
      
      // Small delay between processing items
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    this.processing = false;
  }
}
```

### 3. Rate Limiting and Throttling

```typescript
class RateLimiter {
  private userLimits: Map<string, {
    count: number;
    resetTime: number;
  }> = new Map();
  
  private windowMs = 60000; // 1 minute
  private maxRequests = 100;
  
  isAllowed(userId: string): boolean {
    const now = Date.now();
    const userLimit = this.userLimits.get(userId);
    
    if (!userLimit || now > userLimit.resetTime) {
      this.userLimits.set(userId, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }
    
    if (userLimit.count >= this.maxRequests) {
      return false;
    }
    
    userLimit.count++;
    return true;
  }
  
  getRemainingRequests(userId: string): number {
    const userLimit = this.userLimits.get(userId);
    return userLimit ? this.maxRequests - userLimit.count : this.maxRequests;
  }
}
```

## React Integration Patterns

### 1. useSubscription Hook

```typescript
import { useEffect, useRef, useState } from 'react';
import { trpcClient } from './trpc';

export function useSubscription<T>(
  subscriptionFn: () => { subscribe: (opts: any) => () => void },
  options: {
    enabled?: boolean;
    onData?: (data: T) => void;
    onError?: (error: Error) => void;
  } = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  
  useEffect(() => {
    if (options.enabled === false) {
      return;
    }
    
    const subscription = subscriptionFn();
    
    unsubscribeRef.current = subscription.subscribe({
      onData: (newData: T) => {
        setData(newData);
        setError(null);
        options.onData?.(newData);
      },
      onError: (newError: Error) => {
        setError(newError);
        options.onError?.(newError);
      },
    });
    
    return () => {
      unsubscribeRef.current?.();
    };
  }, [options.enabled]);
  
  return { data, error };
}

// Usage
function ChatComponent({ roomId }: { roomId: string }) {
  const { data: message } = useSubscription(
    () => trpcClient.onMessage,
    {
      enabled: !!roomId,
      onData: (message) => {
        console.log('New message:', message);
      },
    }
  );
  
  return <div>{message?.content}</div>;
}
```

### 2. Real-time Status Component

```typescript
import { useEffect, useState } from 'react';

interface AgentStatus {
  agentId: string;
  status: 'active' | 'idle' | 'error';
  currentTask?: string;
  progress?: number;
}

export function AgentStatusMonitor() {
  const [agents, setAgents] = useState<Map<string, AgentStatus>>(new Map());
  
  useEffect(() => {
    const unsubscribe = trpcClient.onAgentStatus.subscribe(
      undefined,
      {
        onData: (status) => {
          setAgents(prev => new Map(prev).set(status.agentId, status));
        },
        onError: (error) => {
          console.error('Agent status subscription error:', error);
        },
      }
    );
    
    return unsubscribe;
  }, []);
  
  return (
    <div>
      <h2>Agent Status</h2>
      {Array.from(agents.values()).map(agent => (
        <div key={agent.agentId}>
          <h3>{agent.agentId}</h3>
          <p>Status: {agent.status}</p>
          {agent.currentTask && <p>Task: {agent.currentTask}</p>}
          {agent.progress && <p>Progress: {agent.progress}%</p>}
        </div>
      ))}
    </div>
  );
}
```

## Performance Optimization

### 1. Connection Pooling

```typescript
class ConnectionPool {
  private pool: WebSocket[] = [];
  private activeConnections: Set<WebSocket> = new Set();
  private maxConnections = 100;
  
  async getConnection(): Promise<WebSocket> {
    if (this.pool.length > 0) {
      const ws = this.pool.pop()!;
      this.activeConnections.add(ws);
      return ws;
    }
    
    if (this.activeConnections.size >= this.maxConnections) {
      throw new Error('Connection pool exhausted');
    }
    
    const ws = new WebSocket('ws://localhost:3001');
    this.activeConnections.add(ws);
    return ws;
  }
  
  releaseConnection(ws: WebSocket): void {
    this.activeConnections.delete(ws);
    if (ws.readyState === WebSocket.OPEN) {
      this.pool.push(ws);
    }
  }
}
```

### 2. Message Compression

```typescript
import { deflate, inflate } from 'zlib';
import { promisify } from 'util';

const deflateAsync = promisify(deflate);
const inflateAsync = promisify(inflate);

class MessageCompressor {
  async compress(message: any): Promise<Buffer> {
    const json = JSON.stringify(message);
    return await deflateAsync(json);
  }
  
  async decompress(buffer: Buffer): Promise<any> {
    const json = await inflateAsync(buffer);
    return JSON.parse(json.toString());
  }
}
```

## Best Practices

### 1. Error Handling and Resilience

```typescript
class ResilientWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  
  constructor(private url: string) {}
  
  connect(): void {
    this.ws = new WebSocket(this.url);
    
    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      console.log('WebSocket connected');
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.attemptReconnect();
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }
  
  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        console.log(`Reconnection attempt ${this.reconnectAttempts}`);
        this.connect();
      }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
    }
  }
}
```

### 2. Monitoring and Metrics

```typescript
class WebSocketMetrics {
  private connections = 0;
  private messagesReceived = 0;
  private messagesSent = 0;
  private errors = 0;
  
  incrementConnections(): void {
    this.connections++;
  }
  
  decrementConnections(): void {
    this.connections--;
  }
  
  incrementMessagesReceived(): void {
    this.messagesReceived++;
  }
  
  incrementMessagesSent(): void {
    this.messagesSent++;
  }
  
  incrementErrors(): void {
    this.errors++;
  }
  
  getMetrics(): {
    connections: number;
    messagesReceived: number;
    messagesSent: number;
    errors: number;
  } {
    return {
      connections: this.connections,
      messagesReceived: this.messagesReceived,
      messagesSent: this.messagesSent,
      errors: this.errors,
    };
  }
}
```

This comprehensive guide provides the foundation for implementing robust, scalable real-time applications using WebSockets with tRPC, TypeScript, and event-driven architecture patterns. The patterns ensure optimal performance, reliability, and maintainability in production environments.