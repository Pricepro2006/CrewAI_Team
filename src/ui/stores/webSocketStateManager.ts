/**
 * WebSocket State Manager
 * Centralized state management for WebSocket connections
 * with race condition prevention and optimistic updates
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import type { 
  WebSocketEvent,
  EmailWebSocketEvent,
  WorkflowWebSocketEvent,
  SystemWebSocketEvent,
  WebSocketError,
} from '../../shared/types/websocket-events.js';

interface PendingUpdate {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  retries: number;
  maxRetries: number;
}

interface OptimisticUpdate {
  id: string;
  type: string;
  apply: (state: any) => void;
  rollback: (state: any) => void;
  timestamp: Date;
  confirmed: boolean;
}

interface WebSocketStateManager {
  // Connection state
  connections: Map<string, {
    endpoint: string;
    status: 'connecting' | 'connected' | 'disconnected' | 'error';
    lastActivity: Date;
    reconnectAttempts: number;
  }>;
  
  // Event processing state
  eventQueue: WebSocketEvent[];
  processingEvents: Set<string>;
  pendingUpdates: Map<string, PendingUpdate>;
  optimisticUpdates: Map<string, OptimisticUpdate>;
  
  // Email state cache
  emailCache: Map<string, {
    data: any;
    version: number;
    lastUpdated: Date;
  }>;
  
  // Stats cache
  statsCache: {
    total: number;
    critical: number;
    inProgress: number;
    completed: number;
    lastUpdated: Date;
  } | null;
  
  // Error tracking
  errors: WebSocketError[];
  
  // Actions
  setConnectionStatus: (
    endpoint: string, 
    status: 'connecting' | 'connected' | 'disconnected' | 'error'
  ) => void;
  
  queueEvent: (event: WebSocketEvent) => void;
  processEvent: (eventId: string) => Promise<void>;
  
  addPendingUpdate: (update: PendingUpdate) => void;
  confirmUpdate: (updateId: string) => void;
  retryUpdate: (updateId: string) => void;
  
  applyOptimisticUpdate: (update: OptimisticUpdate) => void;
  confirmOptimisticUpdate: (updateId: string) => void;
  rollbackOptimisticUpdate: (updateId: string) => void;
  
  updateEmailCache: (emailId: string, data: any) => void;
  updateStatsCache: (stats: any) => void;
  
  addError: (error: WebSocketError) => void;
  clearErrors: () => void;
  
  // Utilities
  isProcessingEvent: (eventId: string) => boolean;
  getEventQueue: () => WebSocketEvent[];
  getPendingUpdates: () => PendingUpdate[];
  getOptimisticUpdates: () => OptimisticUpdate[];
  
  // Cleanup
  clearOldEvents: (olderThan: Date) => void;
  reset: () => void;
}

// Event deduplication helper
const getEventKey = (event: WebSocketEvent): string => {
  if ('data' in event && event.data && typeof event.data === 'object') {
    const data = event.data as any;
    if ('emailId' in data) return `${event.type}:${data.emailId}`;
    if ('taskId' in data) return `${event.type}:${data.taskId}`;
  }
  return `${event.type}:${event.id}`;
};

// Create store with middleware
export const useWebSocketStateManager = create<WebSocketStateManager>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial state
      connections: new Map(),
      eventQueue: [],
      processingEvents: new Set(),
      pendingUpdates: new Map(),
      optimisticUpdates: new Map(),
      emailCache: new Map(),
      statsCache: null,
      errors: [],

      // Connection management
      setConnectionStatus: (endpoint, status) => {
        set((state: any) => {
          state?.connections?.set(endpoint, {
            endpoint,
            status,
            lastActivity: new Date(),
            reconnectAttempts: status === 'error' 
              ? (state?.connections?.get(endpoint)?.reconnectAttempts || 0) + 1 
              : 0,
          });
        });
      },

      // Event queue management with deduplication
      queueEvent: (event: any) => {
        set((state: any) => {
          const eventKey = getEventKey(event);
          
          // Check if we're already processing this event
          if (state?.processingEvents?.has(eventKey)) {
            console.debug('Event already being processed:', eventKey);
            return;
          }
          
          // Check if this event is already in the queue
          const existingIndex = state?.eventQueue?.findIndex(
            e => getEventKey(e) === eventKey
          );
          
          if (existingIndex !== -1) {
            // Replace with newer event
            state.eventQueue[existingIndex] = event;
          } else {
            // Add to queue
            state?.eventQueue?.push(event);
          }
          
          // Limit queue size to prevent memory issues
          if (state?.eventQueue?.length > 1000) {
            state.eventQueue = state?.eventQueue?.slice(-500);
          }
        });
      },

      // Process event with race condition prevention
      processEvent: async (eventId: any) => {
        const state = get();
        const event = state?.eventQueue?.find(e => e.id === eventId);
        
        if (!event) return;
        
        const eventKey = getEventKey(event);
        
        // Check if already processing
        if (state?.processingEvents?.has(eventKey)) {
          console.debug('Event already being processed:', eventKey);
          return;
        }
        
        // Mark as processing
        set((state: any) => {
          state?.processingEvents?.add(eventKey);
        });
        
        try {
          // Process based on event type
          if (event.type === 'email:stats_updated') {
            set((state: any) => {
              state.updateStatsCache((event as any).data.stats);
            });
          } else if (event?.type?.startsWith('email:')) {
            const emailEvent = event as EmailWebSocketEvent;
            if ('data' in emailEvent && 'emailId' in emailEvent.data) {
              const emailId = (emailEvent.data as any).emailId;
              set((state: any) => {
                state.updateEmailCache(emailId, emailEvent.data);
              });
            }
          }
          
          // Remove from queue after successful processing
          set((state: any) => {
            state.eventQueue = state?.eventQueue?.filter(e => e.id !== eventId);
          });
          
        } catch (error) {
          console.error('Error processing event:', error);
          set((state: any) => {
            state.addError({
              code: 'EVENT_PROCESSING_ERROR',
              message: `Failed to process event ${eventKey}`,
              recoverable: true,
            });
          });
        } finally {
          // Remove from processing set
          set((state: any) => {
            state?.processingEvents?.delete(eventKey);
          });
        }
      },

      // Pending update management
      addPendingUpdate: (update: any) => {
        set((state: any) => {
          state?.pendingUpdates?.set(update.id, update);
        });
      },

      confirmUpdate: (updateId: any) => {
        set((state: any) => {
          state?.pendingUpdates?.delete(updateId);
        });
      },

      retryUpdate: (updateId: any) => {
        set((state: any) => {
          const update = state?.pendingUpdates?.get(updateId);
          if (update && update.retries < update.maxRetries) {
            update.retries++;
            update.timestamp = new Date();
          } else if (update) {
            // Max retries reached, remove update
            state?.pendingUpdates?.delete(updateId);
            state.addError({
              code: 'UPDATE_FAILED',
              message: `Failed to apply update ${updateId} after ${update.retries} retries`,
              recoverable: false,
            });
          }
        });
      },

      // Optimistic update management
      applyOptimisticUpdate: (update: any) => {
        set((state: any) => {
          // Apply the update
          update.apply(state);
          
          // Store for potential rollback
          state?.optimisticUpdates?.set(update.id, update);
        });
      },

      confirmOptimisticUpdate: (updateId: any) => {
        set((state: any) => {
          const update = state?.optimisticUpdates?.get(updateId);
          if (update) {
            update.confirmed = true;
            // Remove after confirmation
            setTimeout(() => {
              set((state: any) => {
                state?.optimisticUpdates?.delete(updateId);
              });
            }, 5000);
          }
        });
      },

      rollbackOptimisticUpdate: (updateId: any) => {
        set((state: any) => {
          const update = state?.optimisticUpdates?.get(updateId);
          if (update && !update.confirmed) {
            // Rollback the update
            update.rollback(state);
            state?.optimisticUpdates?.delete(updateId);
          }
        });
      },

      // Cache management
      updateEmailCache: (emailId, data) => {
        set((state: any) => {
          const existing = state?.emailCache?.get(emailId);
          state?.emailCache?.set(emailId, {
            data: { ...(existing?.data || {}), ...data },
            version: (existing?.version || 0) + 1,
            lastUpdated: new Date(),
          });
          
          // Limit cache size
          if (state?.emailCache?.size > 500) {
            // Remove oldest entries
            const entries = Array.from(state?.emailCache?.entries());
            entries.sort((a, b) => 
              a[1].lastUpdated.getTime() - b[1].lastUpdated.getTime()
            );
            entries.slice(0, 100).forEach(([id]) => {
              state?.emailCache?.delete(id);
            });
          }
        });
      },

      updateStatsCache: (stats: any) => {
        set((state: any) => {
          state.statsCache = {
            ...stats,
            lastUpdated: new Date(),
          };
        });
      },

      // Error management
      addError: (error: any) => {
        set((state: any) => {
          state?.errors?.push(error);
          
          // Limit error history
          if (state?.errors?.length > 50) {
            state.errors = state?.errors?.slice(-25);
          }
        });
      },

      clearErrors: () => {
        set((state: any) => {
          state.errors = [];
        });
      },

      // Utilities
      isProcessingEvent: (eventId: any) => {
        return get().processingEvents.has(eventId);
      },

      getEventQueue: () => {
        return [...get().eventQueue];
      },

      getPendingUpdates: () => {
        return Array.from(get().pendingUpdates.values());
      },

      getOptimisticUpdates: () => {
        return Array.from(get().optimisticUpdates.values());
      },

      // Cleanup
      clearOldEvents: (olderThan: any) => {
        set((state: any) => {
          state.eventQueue = state?.eventQueue?.filter(
            e => e.timestamp > olderThan
          );
          
          // Clean up old pending updates
          const pendingEntries = Array.from(state?.pendingUpdates?.entries());
          pendingEntries.forEach(([id, update]) => {
            if (update.timestamp < olderThan) {
              state?.pendingUpdates?.delete(id);
            }
          });
          
          // Clean up old optimistic updates
          const optimisticEntries = Array.from(state?.optimisticUpdates?.entries());
          optimisticEntries.forEach(([id, update]) => {
            if (update.timestamp < olderThan && update.confirmed) {
              state?.optimisticUpdates?.delete(id);
            }
          });
        });
      },

      reset: () => {
        set(() => ({
          connections: new Map(),
          eventQueue: [],
          processingEvents: new Set(),
          pendingUpdates: new Map(),
          optimisticUpdates: new Map(),
          emailCache: new Map(),
          statsCache: null,
          errors: [],
        }));
      },
    }))
  )
);

// Selectors for common queries
export const selectConnectionStatus = (endpoint: string) =>
  (state: WebSocketStateManager) => state?.connections?.get(endpoint);

export const selectIsConnected = (endpoint: string) =>
  (state: WebSocketStateManager) => 
    state?.connections?.get(endpoint)?.status === 'connected';

export const selectStatsCache = () =>
  (state: WebSocketStateManager) => state.statsCache;

export const selectEmailCache = (emailId: string) =>
  (state: WebSocketStateManager) => state?.emailCache?.get(emailId);

export const selectPendingUpdatesCount = () =>
  (state: WebSocketStateManager) => state?.pendingUpdates?.size;

export const selectHasErrors = () =>
  (state: WebSocketStateManager) => state?.errors?.length > 0;

// Event processor for background processing
export class WebSocketEventProcessor {
  private processingInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  start() {
    // Process events every 100ms
    this.processingInterval = setInterval(() => {
      const state = useWebSocketStateManager.getState();
      const queue = state.getEventQueue();
      
      // Process up to 10 events at a time
      queue.slice(0, 10).forEach(event => {
        state.processEvent(event.id);
      });
    }, 100);

    // Cleanup old data every minute
    this.cleanupInterval = setInterval(() => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      useWebSocketStateManager.getState().clearOldEvents(fiveMinutesAgo);
    }, 60000);
  }

  stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Create global processor instance
export const webSocketEventProcessor = new WebSocketEventProcessor();