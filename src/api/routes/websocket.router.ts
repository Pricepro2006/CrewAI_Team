import { z } from 'zod';
import { router, publicProcedure } from '../trpc/router';
import { observable } from '@trpc/server/observable';
import { wsService } from '../services/WebSocketService';
import type { Router } from '@trpc/server';

export const websocketRouter: Router<any> = router({
  // Subscribe to specific message types
  subscribe: publicProcedure
    .input(z.object({
      types: z.array(z.string()).default(['*']), // Subscribe to all by default
      filter: z.object({
        conversationId: z.string().optional(),
        agentId: z.string().optional(),
        planId: z.string().optional(),
        taskId: z.string().optional()
      }).optional()
    }))
    .subscription(({ input }) => {
      return observable((observer) => {
        // Create handlers for each message type
        const handlers: Record<string, (message: any) => void> = {
          'agent.status': (message) => {
            if (!input.filter?.agentId || message.agentId === input.filter.agentId) {
              observer.next(message);
            }
          },
          'agent.task': (message) => {
            if (!input.filter?.agentId || message.agentId === input.filter.agentId) {
              observer.next(message);
            }
          },
          'plan.update': (message) => {
            if (!input.filter?.planId || message.planId === input.filter.planId) {
              observer.next(message);
            }
          },
          'chat.message': (message) => {
            if (!input.filter?.conversationId || message.conversationId === input.filter.conversationId) {
              observer.next(message);
            }
          },
          'task.update': (message) => {
            if (!input.filter?.taskId || message.taskId === input.filter.taskId) {
              observer.next(message);
            }
          },
          'rag.operation': (message) => {
            observer.next(message);
          },
          'system.health': (message) => {
            observer.next(message);
          }
        };

        // Subscribe to requested types
        const subscribedTypes = input.types.includes('*') 
          ? Object.keys(handlers) 
          : input.types.filter(type => handlers[type]);

        // Register listeners
        subscribedTypes.forEach(type => {
          wsService.on(type, handlers[type]);
        });

        // Cleanup function
        return () => {
          subscribedTypes.forEach(type => {
            wsService.off(type, handlers[type]);
          });
        };
      });
    }),

  // Subscribe to agent status updates
  agentStatus: publicProcedure
    .input(z.object({
      agentId: z.string().optional() // Optional to subscribe to all agents
    }))
    .subscription(({ input }) => {
      return observable((observer) => {
        const handler = (message: any) => {
          if (message.type === 'agent.status' && 
              (!input.agentId || message.agentId === input.agentId)) {
            observer.next({
              agentId: message.agentId,
              status: message.status,
              timestamp: message.timestamp
            });
          }
        };

        wsService.on('agent.status', handler);

        return () => {
          wsService.off('agent.status', handler);
        };
      });
    }),

  // Subscribe to plan execution updates
  planProgress: publicProcedure
    .input(z.object({
      planId: z.string()
    }))
    .subscription(({ input }) => {
      return observable((observer) => {
        const handler = (message: any) => {
          if (message.type === 'plan.update' && message.planId === input.planId) {
            observer.next({
              status: message.status,
              progress: message.progress,
              timestamp: message.timestamp
            });
          }
        };

        wsService.on('plan.update', handler);

        return () => {
          wsService.off('plan.update', handler);
        };
      });
    }),

  // Subscribe to task queue updates
  taskQueue: publicProcedure
    .subscription(() => {
      return observable((observer) => {
        const handler = (message: any) => {
          if (message.type === 'task.update') {
            observer.next({
              taskId: message.taskId,
              status: message.status,
              progress: message.progress,
              timestamp: message.timestamp
            });
          }
        };

        wsService.on('task.update', handler);

        return () => {
          wsService.off('task.update', handler);
        };
      });
    }),

  // Subscribe to RAG operations
  ragOperations: publicProcedure
    .subscription(() => {
      return observable((observer) => {
        const handler = (message: any) => {
          if (message.type === 'rag.operation') {
            observer.next({
              operation: message.operation,
              status: message.status,
              details: message.details,
              timestamp: message.timestamp
            });
          }
        };

        wsService.on('rag.operation', handler);

        return () => {
          wsService.off('rag.operation', handler);
        };
      });
    }),

  // Subscribe to system health updates
  systemHealth: publicProcedure
    .subscription(() => {
      return observable((observer) => {
        const handler = (message: any) => {
          if (message.type === 'system.health') {
            observer.next({
              services: message.services,
              metrics: message.metrics,
              timestamp: message.timestamp
            });
          }
        };

        wsService.on('system.health', handler);

        // Send initial health status
        observer.next({
          services: {
            api: 'healthy',
            database: 'healthy',
            ollama: 'healthy',
            vectorstore: 'healthy'
          },
          metrics: {
            activeAgents: 0,
            queueLength: 0
          },
          timestamp: new Date()
        });

        return () => {
          wsService.off('system.health', handler);
        };
      });
    }),

  // Get WebSocket connection stats
  connectionStats: publicProcedure
    .query(() => {
      return {
        connectedClients: wsService.getClientCount(),
        timestamp: new Date()
      };
    })
});