import { useEffect, useRef, useCallback, useState } from "react";
import { createTRPCProxyClient, createWSClient, wsLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../api/trpc/router.js";
import { trpcWebSocketConfig, getTRPCWebSocketUrl, getWebSocketDebugInfo } from "../../config/websocket.config.js";

interface WebSocketOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket(options: WebSocketOptions = {}): {
  client: any;
  isConnected: boolean;
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
  reconnectAttempts: number;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (message: any) => void;
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
  const clientRef = useRef<ReturnType<typeof createWSClient>>();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const isReconnectingRef = useRef(false);
  const isMountedRef = useRef(true);

  const connect = useCallback(async () => {
    // Prevent multiple simultaneous connections
    if (isReconnectingRef.current || !isMountedRef.current) {
      return;
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
        onClose: (event) => {
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
                  connect();
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
      reconnectTimeoutRef.current = undefined;
    }

    if (clientRef.current) {
      clientRef?.current?.close();
      clientRef.current = undefined;
    }

    setIsConnected(false);
    setConnectionStatus("disconnected");
    setReconnectAttempts(0);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]); // Include connect and disconnect dependencies

  const client = createTRPCProxyClient<AppRouter>({
    transformer: superjson,
    links: [
      wsLink({
        client: clientRef.current!,
      }),
    ],
  });

  const sendMessage = useCallback(
    (message: any) => {
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
      connect();
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
  const unsubscribeRef = useRef<any>(null);

  useEffect(() => {
    if (!isConnected) return;

    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef?.current?.unsubscribe?.();
      unsubscribeRef.current = null;
    }

    try {
      if (client && typeof client === "object" && "ws" in client) {
        const ws = (client as any).ws;
        if (ws && typeof ws.subscribe === "function") {
          unsubscribeRef.current = ws.subscribe(
            {
              types: ["agent.status"],
              filter: { agentId },
            },
            {
              onData: (data: any) => {
                setStatus(data);
              },
              onError: (error: any) => {
                console.error("Agent status subscription error:", error);
              },
            },
          );
        }
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
  const unsubscribeRef = useRef<any>(null);

  useEffect(() => {
    if (!isConnected || !planId) return;

    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef?.current?.unsubscribe?.();
      unsubscribeRef.current = null;
    }

    try {
      if (client && typeof client === "object" && "ws" in client) {
        const ws = (client as any).ws;
        if (ws && typeof ws.subscribe === "function") {
          unsubscribeRef.current = ws.subscribe(
            {
              types: ["plan.update"],
              filter: { planId },
            },
            {
              onData: (data: any) => {
                setProgress(data);
              },
              onError: (error: any) => {
                console.error("Plan progress subscription error:", error);
              },
            },
          );
        }
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
  const unsubscribeRef = useRef<any>(null);
  const MAX_TASKS = 100; // Prevent unbounded growth

  useEffect(() => {
    if (!isConnected) return;

    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef?.current?.unsubscribe?.();
      unsubscribeRef.current = null;
    }

    try {
      if (client && typeof client === "object" && "ws" in client) {
        const ws = (client as any).ws;
        if (ws && typeof ws.subscribe === "function") {
          unsubscribeRef.current = ws.subscribe(
            {
              types: ["task.update"],
            },
            {
              onData: (data: any) => {
                setTasks((prev: any) => {
                  const newTasks = new Map(prev);
                  newTasks.set(data.taskId, data);

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
                          a[1].timestamp.getTime() - b[1].timestamp.getTime(),
                      )
                      .slice(0, newTasks.size - MAX_TASKS);

                    toRemove.forEach(([taskId]) => newTasks.delete(taskId));
                  }

                  return newTasks;
                });
              },
              onError: (error: any) => {
                console.error("Task queue subscription error:", error);
              },
            },
          );
        }
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
  const unsubscribeRef = useRef<any>(null);

  useEffect(() => {
    if (!isConnected) return;

    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef?.current?.unsubscribe?.();
      unsubscribeRef.current = null;
    }

    try {
      if (client && typeof client === "object" && "ws" in client) {
        const ws = (client as any).ws;
        if (ws && typeof ws.subscribe === "function") {
          unsubscribeRef.current = ws.subscribe(
            {
              types: ["system.health"],
            },
            {
              onData: (data: any) => {
                setHealth(data);
              },
              onError: (error: any) => {
                console.error("System health subscription error:", error);
              },
            },
          );
        }
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
  const unsubscribeRef = useRef<any>(null);

  useEffect(() => {
    if (!isConnected) return;

    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef?.current?.unsubscribe?.();
      unsubscribeRef.current = null;
    }

    try {
      if (client && typeof client === "object" && "ws" in client) {
        const ws = (client as any).ws;
        if (ws && typeof ws.subscribe === "function") {
          unsubscribeRef.current = ws.subscribe(
            {
              types: ["rag.operation"],
            },
            {
              onData: (data: any) => {
                setOperations((prev: any) => [...prev, data].slice(-20)); // Keep last 20 operations
              },
              onError: (error: any) => {
                console.error("RAG operations subscription error:", error);
              },
            },
          );
        }
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
