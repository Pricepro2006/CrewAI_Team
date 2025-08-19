import { useEffect, useRef, useCallback, useState } from "react";
import { createTRPCProxyClient, createWSClient, wsLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../api/trpc/router";
import type { TRPCClientError } from '@trpc/client';
import { trpcWebSocketConfig, getTRPCWebSocketUrl, getWebSocketDebugInfo } from "../../config/websocket.config.js";

interface WebSocketOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket(options: WebSocketOptions = {}): {
  client: ReturnType<typeof createTRPCProxyClient<AppRouter>> | null;
  isConnected: boolean;
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
  reconnectAttempts: number;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (message: Record<string, unknown>) => void;
} {
  const {
    onConnect,
    onDisconnect,
    onError,
    reconnectDelay = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("disconnected");
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const clientRef = useRef<ReturnType<typeof createWSClient> | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isReconnectingRef = useRef(false);
  const isMountedRef = useRef(true);

  const connect = useCallback(async (): Promise<ReturnType<typeof createWSClient> | undefined> => {
    // Prevent multiple simultaneous connections
    if (isReconnectingRef.current || !isMountedRef.current) {
      return undefined;
    }

    setConnectionStatus("connecting");

    try {
      const wsUrl = getTRPCWebSocketUrl();
      console.log('🔌 Connecting to tRPC WebSocket:', wsUrl);
      console.log('📊 WebSocket Debug Info:', getWebSocketDebugInfo());

      const wsClient = createWSClient({
        url: wsUrl,
        onOpen: () => {
          if (!isMountedRef.current) return;

          console.log('✅ tRPC WebSocket connected successfully');
          setIsConnected(true);
          setConnectionStatus("connected");
          setReconnectAttempts(0);
          isReconnectingRef.current = false;
          onConnect?.();
        },
        onClose: (event?: { code?: number; reason?: string }) => {
          if (!isMountedRef.current) return;

          console.log('🔚 tRPC WebSocket disconnected:', event?.code, event?.reason);
          setIsConnected(false);
          setConnectionStatus("disconnected");
          onDisconnect?.();

          // Attempt to reconnect if not manually disconnected and not a normal closure
          setReconnectAttempts((currentAttempts) => {
            if (
              currentAttempts < maxReconnectAttempts &&
              isMountedRef.current &&
              event?.code !== 1000
            ) {
              isReconnectingRef.current = true;
              const delay = reconnectDelay * Math.pow(1.5, currentAttempts); // Exponential backoff
              console.log(`🔄 Reconnecting in ${delay}ms (attempt ${currentAttempts + 1}/${maxReconnectAttempts})`);
              
              reconnectTimeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                  void connect();
                }
              }, delay);
              
              return currentAttempts + 1;
            } else if (currentAttempts >= maxReconnectAttempts) {
              console.error('❌ Max reconnection attempts reached');
              setConnectionStatus("error");
              onError?.(new Error("Max reconnection attempts reached"));
              return currentAttempts;
            }
            return currentAttempts;
          });
        },
        // onError is not supported in tRPC WebSocket client
        // Error handling happens in subscription error callbacks
      });

      clientRef.current = wsClient;
      return wsClient;
    } catch (error) {
      console.error('❌ Failed to create tRPC WebSocket client:', error);
      setConnectionStatus("error");
      onError?.(error as Error);
      isReconnectingRef.current = false;
      return undefined;
    }
  }, [
    onConnect,
    onDisconnect,
    onError,
    reconnectDelay,
    maxReconnectAttempts,
  ]); // Removed reconnectAttempts to prevent stale closures

  const disconnect = useCallback(() => {
    isMountedRef.current = false;
    isReconnectingRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (clientRef.current) {
      clientRef?.current?.close();
      clientRef.current = null;
    }

    setIsConnected(false);
    setConnectionStatus("disconnected");
    setReconnectAttempts(0);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void connect();

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]); // Re-connect when connect/disconnect functions change

  const client = clientRef.current ? createTRPCProxyClient<AppRouter>({
    transformer: superjson,
    links: [
      wsLink({
        client: clientRef.current,
      }),
    ],
  }) : null;

  const sendMessage = useCallback(
    (message: Record<string, unknown>) => {
      if (!clientRef.current || !isConnected) {
        console.warn("WebSocket not connected, cannot send message");
        return;
      }

      // tRPC WebSocket client doesn't have a direct send method
      // Messages are sent through subscriptions and mutations
      console.warn("Direct message sending not supported in tRPC WebSocket");
    },
    [isConnected],
  );

  return {
    client,
    isConnected,
    connectionStatus,
    reconnectAttempts,
    connect: () => {
      isMountedRef.current = true;
      setReconnectAttempts(0);
      void connect();
    },
    disconnect,
    sendMessage,
  };
}

// Hook for subscribing to agent status updates
export function useAgentStatus(agentId?: string) {
  const [status, setStatus] = useState<{
    agentId: string;
    status: "idle" | "busy" | "error" | "terminated";
    timestamp: Date;
  } | null>(null);

  const { client, isConnected } = useWebSocket();
  const unsubscribeRef = useRef<{ unsubscribe?: () => void } | null>(null);

  useEffect(() => {
    if (!isConnected) return;

    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef?.current?.unsubscribe?.();
      unsubscribeRef.current = null;
    }

    try {
      if (client) {
        // tRPC WebSocket subscriptions are handled differently
        // This is a placeholder for proper tRPC subscription implementation
        console.log("Agent status subscription requested for:", agentId);
        
        // For now, simulate subscription with periodic checks
        const interval = setInterval(() => {
          // This would be replaced with actual tRPC subscription
          const mockStatus = {
            agentId: agentId || 'unknown',
            status: 'idle' as const,
            timestamp: new Date(),
          };
          setStatus(mockStatus);
        }, 5000);

        unsubscribeRef.current = {
          unsubscribe: () => clearInterval(interval)
        };
      }
    } catch (error) {
      console.error("Failed to set up agent status subscription:", error);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef?.current?.unsubscribe?.();
        unsubscribeRef.current = null;
      }
    };
  }, [client, agentId, isConnected]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef?.current?.unsubscribe?.();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  return status;
}

// Hook for subscribing to plan execution progress
export function usePlanProgress(planId: string) {
  const [progress, setProgress] = useState<{
    status: string;
    progress?: {
      completed: number;
      total: number;
      currentStep?: string;
    };
    timestamp: Date;
  } | null>(null);

  const { client, isConnected } = useWebSocket();
  const unsubscribeRef = useRef<{ unsubscribe?: () => void } | null>(null);

  useEffect(() => {
    if (!isConnected || !planId) return;

    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef?.current?.unsubscribe?.();
      unsubscribeRef.current = null;
    }

    try {
      if (client) {
        // tRPC WebSocket subscriptions are handled differently
        // This is a placeholder for proper tRPC subscription implementation
        console.log("Plan progress subscription requested for:", planId);
        
        // For now, simulate subscription with periodic checks
        const interval = setInterval(() => {
          // This would be replaced with actual tRPC subscription
          const mockProgress = {
            status: 'in-progress',
            progress: {
              completed: Math.floor(Math.random() * 10),
              total: 10,
              currentStep: 'Processing...',
            },
            timestamp: new Date(),
          };
          setProgress(mockProgress);
        }, 3000);

        unsubscribeRef.current = {
          unsubscribe: () => clearInterval(interval)
        };
      }
    } catch (error) {
      console.error("Failed to set up plan progress subscription:", error);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef?.current?.unsubscribe?.();
        unsubscribeRef.current = null;
      }
    };
  }, [client, planId, isConnected]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef?.current?.unsubscribe?.();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  return progress;
}

// Hook for subscribing to task queue updates
export function useTaskQueue() {
  const [tasks, setTasks] = useState<
    Map<
      string,
      {
        taskId: string;
        status: string;
        progress?: number;
        timestamp: Date;
      }
    >
  >(new Map());

  const { client, isConnected } = useWebSocket();
  const unsubscribeRef = useRef<{ unsubscribe?: () => void } | null>(null);
  const MAX_TASKS = 100; // Prevent unbounded growth

  useEffect(() => {
    if (!isConnected) return;

    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef?.current?.unsubscribe?.();
      unsubscribeRef.current = null;
    }

    try {
      if (client) {
        // tRPC WebSocket subscriptions are handled differently
        // This is a placeholder for proper tRPC subscription implementation
        console.log("Task queue subscription requested");
        
        // For now, simulate subscription with periodic checks
        const interval = setInterval(() => {
          // This would be replaced with actual tRPC subscription
          const mockTask = {
            taskId: `task_${Date.now()}`,
            status: 'running',
            progress: Math.random() * 100,
            timestamp: new Date(),
          };
          
          setTasks((prev) => {
            const newTasks = new Map(prev);
            newTasks.set(mockTask.taskId, mockTask);

            // Limit map size to prevent memory leaks
            if (newTasks.size > MAX_TASKS) {
              // Remove oldest completed/failed tasks
              const entries = Array.from(newTasks.entries());
              const toRemove = entries
                .filter(
                  ([_, task]) =>
                    task.status === "completed" ||
                    task.status === "failed",
                )
                .sort(
                  (a, b) =>
                    new Date(a[1].timestamp).getTime() - new Date(b[1].timestamp).getTime(),
                )
                .slice(0, newTasks.size - MAX_TASKS);

              toRemove.forEach(([taskId]) => newTasks.delete(taskId));
            }

            return newTasks;
          });
        }, 2000);

        unsubscribeRef.current = {
          unsubscribe: () => clearInterval(interval)
        };
      }
    } catch (error) {
      console.error("Failed to set up task queue subscription:", error);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef?.current?.unsubscribe?.();
        unsubscribeRef.current = null;
      }
    };
  }, [client, isConnected]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef?.current?.unsubscribe?.();
        unsubscribeRef.current = null;
      }
      setTasks(new Map()); // Clear tasks on unmount
    };
  }, []);

  return Array.from(tasks.values());
}

// Hook for subscribing to system health updates
export function useSystemHealth() {
  const [health, setHealth] = useState<{
    services: Record<string, "healthy" | "degraded" | "down">;
    metrics?: {
      cpu?: number;
      memory?: number;
      activeAgents?: number;
      queueLength?: number;
    };
    timestamp: Date;
  } | null>(null);

  const { client, isConnected } = useWebSocket();
  const unsubscribeRef = useRef<{ unsubscribe?: () => void } | null>(null);

  useEffect(() => {
    if (!isConnected) return;

    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef?.current?.unsubscribe?.();
      unsubscribeRef.current = null;
    }

    try {
      if (client) {
        // tRPC WebSocket subscriptions are handled differently
        // This is a placeholder for proper tRPC subscription implementation
        console.log("System health subscription requested");
        
        // For now, simulate subscription with periodic checks
        const interval = setInterval(() => {
          // This would be replaced with actual tRPC subscription
          const mockHealth = {
            services: {
              database: 'healthy' as const,
              redis: 'healthy' as const,
              llm: 'degraded' as const,
              agents: 'healthy' as const,
            },
            metrics: {
              cpu: Math.random() * 100,
              memory: Math.random() * 100,
              activeAgents: Math.floor(Math.random() * 10),
              queueLength: Math.floor(Math.random() * 50),
            },
            timestamp: new Date(),
          };
          setHealth(mockHealth);
        }, 5000);

        unsubscribeRef.current = {
          unsubscribe: () => clearInterval(interval)
        };
      }
    } catch (error) {
      console.error("Failed to set up system health subscription:", error);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef?.current?.unsubscribe?.();
        unsubscribeRef.current = null;
      }
    };
  }, [client, isConnected]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef?.current?.unsubscribe?.();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  return health;
}

// Hook for subscribing to RAG operations
export function useRAGOperations() {
  const [operations, setOperations] = useState<
    Array<{
      operation: "indexing" | "searching" | "embedding";
      status: "started" | "completed" | "failed";
      details?: {
        documentCount?: number;
        chunkCount?: number;
        duration?: number;
        error?: string;
      };
      timestamp: Date;
    }>
  >([]);

  const { client, isConnected } = useWebSocket();
  const unsubscribeRef = useRef<{ unsubscribe?: () => void } | null>(null);

  useEffect(() => {
    if (!isConnected) return;

    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef?.current?.unsubscribe?.();
      unsubscribeRef.current = null;
    }

    try {
      if (client) {
        // tRPC WebSocket subscriptions are handled differently
        // This is a placeholder for proper tRPC subscription implementation
        console.log("RAG operations subscription requested");
        
        // For now, simulate subscription with periodic checks
        const interval = setInterval(() => {
          // This would be replaced with actual tRPC subscription
          const operations = ['indexing', 'searching', 'embedding'] as const;
          const statuses = ['started', 'completed', 'failed'] as const;
          
          const mockOperation = {
            operation: operations[Math.floor(Math.random() * operations.length)],
            status: statuses[Math.floor(Math.random() * statuses.length)],
            details: {
              documentCount: Math.floor(Math.random() * 1000),
              chunkCount: Math.floor(Math.random() * 5000),
              duration: Math.floor(Math.random() * 10000),
            },
            timestamp: new Date(),
          };
          
          setOperations((prev) => [...prev, mockOperation].slice(-20)); // Keep last 20 operations
        }, 4000);

        unsubscribeRef.current = {
          unsubscribe: () => clearInterval(interval)
        };
      }
    } catch (error) {
      console.error("Failed to set up RAG operations subscription:", error);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef?.current?.unsubscribe?.();
        unsubscribeRef.current = null;
      }
    };
  }, [client, isConnected]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef?.current?.unsubscribe?.();
        unsubscribeRef.current = null;
      }
      setOperations([]); // Clear operations on unmount
    };
  }, []);

  return operations;
}
