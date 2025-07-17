import { useEffect, useRef, useCallback, useState } from "react";
import { createTRPCProxyClient, createWSClient, wsLink } from "@trpc/client";
import type { AppRouter } from "../../api/trpc/router";

interface WebSocketOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket(options: WebSocketOptions = {}) {
  const {
    onConnect,
    onDisconnect,
    onError,
    reconnectDelay = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const clientRef = useRef<ReturnType<typeof createWSClient>>();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    const wsClient = createWSClient({
      url: `ws://localhost:${parseInt(import.meta.env.VITE_API_PORT || "3000") + 1}/trpc-ws`,
      onOpen: () => {
        setIsConnected(true);
        setReconnectAttempts(0);
        onConnect?.();
      },
      onClose: () => {
        setIsConnected(false);
        onDisconnect?.();

        // Attempt to reconnect
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts((prev) => prev + 1);
            connect();
          }, reconnectDelay);
        }
      },
      // onError is not supported in tRPC WebSocket client
      // Error handling happens in subscription error callbacks
    });

    clientRef.current = wsClient;
    return wsClient;
  }, [
    onConnect,
    onDisconnect,
    onError,
    reconnectDelay,
    reconnectAttempts,
    maxReconnectAttempts,
  ]);

  useEffect(() => {
    const wsClient = connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsClient.close();
    };
  }, [connect]);

  const client = createTRPCProxyClient<AppRouter>({
    links: [
      wsLink({
        client: clientRef.current!,
      }),
    ],
  });

  return {
    client,
    isConnected,
    reconnectAttempts,
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

  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = client.ws?.agentStatus?.subscribe?.(
      { agentId },
      {
        onData: (data: any) => {
          setStatus(data);
        },
        onError: (error: any) => {
          console.error("Agent status subscription error:", error);
        },
      },
    );

    return () => {
      unsubscribe.unsubscribe();
    };
  }, [client, agentId, isConnected]);

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

  useEffect(() => {
    if (!isConnected || !planId) return;

    const unsubscribe = client.ws?.planProgress?.subscribe?.(
      { planId },
      {
        onData: (data: any) => {
          setProgress(data);
        },
        onError: (error: any) => {
          console.error("Plan progress subscription error:", error);
        },
      },
    );

    return () => {
      unsubscribe.unsubscribe();
    };
  }, [client, planId, isConnected]);

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

  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = client.ws?.taskQueue?.subscribe?.(undefined, {
      onData: (data: any) => {
        setTasks((prev) => {
          const newTasks = new Map(prev);
          newTasks.set(data.taskId, data);
          return newTasks;
        });
      },
      onError: (error: any) => {
        console.error("Task queue subscription error:", error);
      },
    });

    return () => {
      unsubscribe.unsubscribe();
    };
  }, [client, isConnected]);

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

  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = client.ws?.systemHealth?.subscribe?.(undefined, {
      onData: (data: any) => {
        setHealth(data);
      },
      onError: (error: any) => {
        console.error("System health subscription error:", error);
      },
    });

    return () => {
      unsubscribe.unsubscribe();
    };
  }, [client, isConnected]);

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

  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = client.ws?.ragOperations?.subscribe?.(undefined, {
      onData: (data: any) => {
        setOperations((prev) => [...prev, data].slice(-20)); // Keep last 20 operations
      },
      onError: (error: any) => {
        console.error("RAG operations subscription error:", error);
      },
    });

    return () => {
      unsubscribe.unsubscribe();
    };
  }, [client, isConnected]);

  return operations;
}
