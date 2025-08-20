/**
 * Real-time WebSocket updates hook
 * Provides access to the 5 new message types mentioned in requirements:
 * - agent.status
 * - agent.task  
 * - plan.update
 * - rag.operation
 * - system.health
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useWebSocketConnection, WebSocketEventType, type WebSocketMessage } from './useWebSocketConnection.js';

// Type definitions for real-time update payloads
export interface AgentStatusUpdate {
  agentId: string;
  status: 'idle' | 'busy' | 'error' | 'terminated';
  lastActivity: string;
  currentTask?: string;
  performance?: {
    responseTime: number;
    successRate: number;
  };
}

export interface AgentTaskUpdate {
  agentId: string;
  taskId: string;
  action: 'started' | 'progress' | 'completed' | 'failed';
  progress?: number; // 0-100
  details?: string;
  timestamp: string;
}

export interface PlanUpdate {
  planId: string;
  status: 'created' | 'executing' | 'completed' | 'failed' | 'paused';
  progress: {
    completed: number;
    total: number;
    currentStep?: string;
    estimatedTimeRemaining?: number;
  };
  timestamp: string;
}

export interface RAGOperation {
  operation: 'indexing' | 'searching' | 'embedding' | 'retrieval';
  status: 'started' | 'progress' | 'completed' | 'failed';
  details?: {
    documentCount?: number;
    chunkCount?: number;
    duration?: number;
    query?: string;
    results?: number;
    error?: string;
  };
  timestamp: string;
}

export interface SystemHealth {
  services: Record<string, 'healthy' | 'degraded' | 'down'>;
  metrics: {
    cpu: number;
    memory: number;
    activeAgents: number;
    queueLength: number;
    dbConnections: number;
    responseTime: number;
  };
  timestamp: string;
}

// Hook state interface
interface RealTimeState {
  agentStatuses: Map<string, AgentStatusUpdate>;
  agentTasks: Map<string, AgentTaskUpdate>;
  planUpdates: Map<string, PlanUpdate>;
  ragOperations: RAGOperation[];
  systemHealth: SystemHealth | null;
  isConnected: boolean;
  lastUpdate: string | null;
}

interface UseRealTimeUpdatesOptions {
  subscribeToAgents?: boolean;
  subscribeToPlans?: boolean;
  subscribeToRAG?: boolean;
  subscribeToSystemHealth?: boolean;
  maxRAGOperations?: number;
  onAgentStatusChange?: (agentId: string, status: AgentStatusUpdate) => void;
  onPlanProgress?: (planId: string, update: PlanUpdate) => void;
  onRAGOperation?: (operation: RAGOperation) => void;
  onSystemHealthChange?: (health: SystemHealth) => void;
}

/**
 * Hook for subscribing to real-time updates from the backend
 * Handles the 5 new WebSocket message types with proper error handling and reconnection
 */
export const useRealTimeUpdates = (options: UseRealTimeUpdatesOptions = {}) => {
  const {
    subscribeToAgents = true,
    subscribeToPlans = true,
    subscribeToRAG = true,
    subscribeToSystemHealth = true,
    maxRAGOperations = 50,
    onAgentStatusChange,
    onPlanProgress,
    onRAGOperation,
    onSystemHealthChange
  } = options;

  const [state, setState] = useState<RealTimeState>({
    agentStatuses: new Map(),
    agentTasks: new Map(),
    planUpdates: new Map(),
    ragOperations: [],
    systemHealth: null,
    isConnected: false,
    lastUpdate: null
  });

  const subscriptionsRef = useRef<Set<string>>(new Set());

  // Handle incoming WebSocket messages
  const handleMessage = useCallback((message: WebSocketMessage) => {
    const { type, data, timestamp } = message;
    
    setState(prev => ({ ...prev, lastUpdate: timestamp }));

    switch (type) {
      case WebSocketEventType.AGENT_STATUS:
        if (subscribeToAgents) {
          const agentStatus = data as AgentStatusUpdate;
          setState(prev => ({
            ...prev,
            agentStatuses: new Map(prev.agentStatuses).set(agentStatus.agentId, agentStatus)
          }));
          onAgentStatusChange?.(agentStatus.agentId, agentStatus);
        }
        break;

      case WebSocketEventType.AGENT_TASK:
        if (subscribeToAgents) {
          const agentTask = data as AgentTaskUpdate;
          setState(prev => ({
            ...prev,
            agentTasks: new Map(prev.agentTasks).set(agentTask.taskId, agentTask)
          }));
        }
        break;

      case WebSocketEventType.PLAN_UPDATE:
        if (subscribeToPlans) {
          const planUpdate = data as PlanUpdate;
          setState(prev => ({
            ...prev,
            planUpdates: new Map(prev.planUpdates).set(planUpdate.planId, planUpdate)
          }));
          onPlanProgress?.(planUpdate.planId, planUpdate);
        }
        break;

      case WebSocketEventType.RAG_OPERATION:
        if (subscribeToRAG) {
          const ragOperation = data as RAGOperation;
          setState(prev => ({
            ...prev,
            ragOperations: [ragOperation, ...prev.ragOperations].slice(0, maxRAGOperations)
          }));
          onRAGOperation?.(ragOperation);
        }
        break;

      case WebSocketEventType.SYSTEM_HEALTH:
        if (subscribeToSystemHealth) {
          const systemHealth = data as SystemHealth;
          setState(prev => ({
            ...prev,
            systemHealth
          }));
          onSystemHealthChange?.(systemHealth);
        }
        break;

      default:
        console.log('📨 Unhandled WebSocket message type:', type, data);
    }
  }, [subscribeToAgents, subscribeToPlans, subscribeToRAG, subscribeToSystemHealth, 
      maxRAGOperations, onAgentStatusChange, onPlanProgress, onRAGOperation, onSystemHealthChange]);

  // WebSocket connection management
  const { 
    isConnected, 
    sendMessage, 
    connect, 
    disconnect,
    isConnected: connected,
    reconnectAttempts 
  } = useWebSocketConnection({
    onMessage: handleMessage,
    onConnect: () => {
      console.log('✅ Real-time updates WebSocket connected');
      setState(prev => ({ ...prev, isConnected: true }));
      
      // Subscribe to relevant message types
      const subscriptions = [];
      if (subscribeToAgents) subscriptions.push(WebSocketEventType.AGENT_STATUS, WebSocketEventType.AGENT_TASK);
      if (subscribeToPlans) subscriptions.push(WebSocketEventType.PLAN_UPDATE);
      if (subscribeToRAG) subscriptions.push(WebSocketEventType.RAG_OPERATION);
      if (subscribeToSystemHealth) subscriptions.push(WebSocketEventType.SYSTEM_HEALTH);

      // Send subscription message
      if (subscriptions.length > 0) {
        sendMessage({
          type: 'subscribe',
          data: {
            eventTypes: subscriptions,
            clientId: `client_${Date.now()}`
          },
          timestamp: new Date().toISOString()
        });
        subscriptionsRef.current = new Set(subscriptions);
        console.log('📡 Subscribed to event types:', subscriptions);
      }
    },
    onDisconnect: () => {
      console.log('🔌 Real-time updates WebSocket disconnected');
      setState(prev => ({ ...prev, isConnected: false }));
      subscriptionsRef.current.clear();
    },
    onError: (error) => {
      console.error('❌ Real-time updates WebSocket error:', error);
      setState(prev => ({ ...prev, isConnected: false }));
    },
    autoReconnect: true,
    maxReconnectAttempts: 10
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (subscriptionsRef.current.size > 0) {
        sendMessage({
          type: 'unsubscribe',
          data: {
            eventTypes: Array.from(subscriptionsRef.current)
          },
          timestamp: new Date().toISOString()
        });
      }
    };
  }, [sendMessage]);

  // Manual subscription control
  const subscribe = useCallback((eventTypes: WebSocketEventType[]) => {
    if (isConnected) {
      sendMessage({
        type: 'subscribe',
        data: { eventTypes },
        timestamp: new Date().toISOString()
      });
      eventTypes.forEach(type => subscriptionsRef.current.add(type));
    }
  }, [isConnected, sendMessage]);

  const unsubscribe = useCallback((eventTypes: WebSocketEventType[]) => {
    if (isConnected) {
      sendMessage({
        type: 'unsubscribe',
        data: { eventTypes },
        timestamp: new Date().toISOString()
      });
      eventTypes.forEach(type => subscriptionsRef.current.delete(type));
    }
  }, [isConnected, sendMessage]);

  // Helper methods for accessing state
  const getAgentStatus = useCallback((agentId: string): AgentStatusUpdate | undefined => {
    return state.agentStatuses.get(agentId);
  }, [state.agentStatuses]);

  const getPlanStatus = useCallback((planId: string): PlanUpdate | undefined => {
    return state.planUpdates.get(planId);
  }, [state.planUpdates]);

  const getActiveAgents = useCallback((): AgentStatusUpdate[] => {
    return Array.from(state.agentStatuses.values()).filter(agent => 
      agent.status === 'busy' || agent.status === 'idle'
    );
  }, [state.agentStatuses]);

  const getActivePlans = useCallback((): PlanUpdate[] => {
    return Array.from(state.planUpdates.values()).filter(plan => 
      plan.status === 'executing' || plan.status === 'created'
    );
  }, [state.planUpdates]);

  return {
    // Connection state
    isConnected: state.isConnected,
    connectionStatus: state.isConnected ? 'connected' : 'disconnected',
    reconnectAttempts,
    lastUpdate: state.lastUpdate,

    // Data state
    agentStatuses: Array.from(state.agentStatuses.values()),
    agentTasks: Array.from(state.agentTasks.values()),
    planUpdates: Array.from(state.planUpdates.values()),
    ragOperations: state.ragOperations,
    systemHealth: state.systemHealth,

    // Connection control
    connect,
    disconnect,
    subscribe,
    unsubscribe,

    // Helper methods
    getAgentStatus,
    getPlanStatus,
    getActiveAgents,
    getActivePlans,

    // Raw state for advanced usage
    rawState: state
  };
};

export default useRealTimeUpdates;