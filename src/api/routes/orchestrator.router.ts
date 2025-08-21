/**
 * MasterOrchestrator tRPC Router
 * Exposes the full capabilities of the MasterOrchestrator through API endpoints
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  router,
  publicProcedure,
  protectedProcedure,
  createFeatureRouter,
} from "../trpc/enhanced-router.js";
import { observable } from "@trpc/server/observable";
import { EventEmitter } from "events";
import { logger } from "../../utils/logger.js";
import { wsService } from "../services/WebSocketService.js";
import { withTimeout, DEFAULT_TIMEOUTS } from "../../utils/timeout.js";
import type { 
  Query, 
  Plan, 
  ExecutionResult,
  QueryAnalysis,
  AgentRoutingPlan 
} from "../../core/master-orchestrator/types.js";

// Event emitter for orchestrator events
const orchestratorEvents = new EventEmitter();

// Input validation schemas
const orchestratorSchemas = {
  query: z.object({
    query: z.string().min(1).max(10000),
    options: z.object({
      useRAG: z.boolean().default(true),
      maxAgents: z.number().min(1).max(10).default(3),
      timeout: z.number().min(1000).max(300000).default(60000),
      includeConfidence: z.boolean().default(false),
      preferredAgents: z.array(z.string()).optional(),
      excludeAgents: z.array(z.string()).optional(),
      temperature: z.number().min(0).max(1).optional(),
      maxRetries: z.number().min(0).max(5).default(3),
    }).optional(),
    context: z.object({
      conversationId: z.string().optional(),
      sessionId: z.string().optional(),
      userId: z.string().optional(),
      previousResults: z.array(z.any()).optional(),
      metadata: z.record(z.any()).optional(),
    }).optional(),
  }),

  plan: z.object({
    query: z.string().min(1).max(10000),
    constraints: z.object({
      agents: z.array(z.string()).optional(),
      excludeAgents: z.array(z.string()).optional(),
      maxSteps: z.number().min(1).max(50).optional(),
      requiredTools: z.array(z.string()).optional(),
      forbiddenTools: z.array(z.string()).optional(),
      executionStrategy: z.enum(["sequential", "parallel", "adaptive"]).optional(),
      timeLimit: z.number().min(1000).optional(),
    }).optional(),
  }),

  executePlan: z.object({
    planId: z.string(),
    options: z.object({
      stepByStep: z.boolean().default(false),
      pauseOnError: z.boolean().default(false),
      skipValidation: z.boolean().default(false),
      timeout: z.number().optional(),
    }).optional(),
  }),

  feedback: z.object({
    queryId: z.string(),
    feedbackType: z.enum(["helpful", "not_helpful", "incorrect", "incomplete"]),
    details: z.string().optional(),
    suggestedImprovement: z.string().optional(),
  }),
};

export const orchestratorRouter = createFeatureRouter(
  "orchestrator",
  router({
    // Process a query through the full orchestrator pipeline
    processQuery: publicProcedure
      .input(orchestratorSchemas.query)
      .mutation(async ({ input, ctx }) => {
        const startTime = Date.now();
        
        logger.info("Processing query through orchestrator", "ORCHESTRATOR_API", {
          queryLength: input.query.length,
          options: input.options,
          userId: ctx.user?.id,
          requestId: ctx.requestId,
        });

        try {
          // Validate orchestrator is initialized
          if (!ctx.masterOrchestrator) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "MasterOrchestrator not initialized",
            });
          }

          // Create query object
          const query: Query = {
            text: input.query,
            conversationId: input.context?.conversationId,
            metadata: {
              ...input.context?.metadata,
              options: input.options,
              userId: input.context?.userId || ctx.user?.id,
              sessionId: input.context?.sessionId,
            },
          };

          // Emit start event
          orchestratorEvents.emit("query:started", {
            queryId: ctx.requestId,
            query: input.query,
            timestamp: new Date().toISOString(),
          });

          // Process with timeout
          const result = await withTimeout(
            ctx.masterOrchestrator.processQuery(query),
            input.options?.timeout || DEFAULT_TIMEOUTS.QUERY_PROCESSING,
            "Query processing timed out"
          );

          // Calculate processing time
          const processingTime = Date.now() - startTime;

          // Emit completion event
          orchestratorEvents.emit("query:completed", {
            queryId: ctx.requestId,
            success: result.success,
            processingTime,
            timestamp: new Date().toISOString(),
          });

          // Broadcast via WebSocket
          wsService.broadcast({
            type: "orchestrator.query.completed",
            payload: {
              queryId: ctx.requestId,
              success: result.success,
              processingTime,
            },
          });

          logger.info("Query processing completed", "ORCHESTRATOR_API", {
            queryId: ctx.requestId,
            success: result.success,
            processingTime,
            stepsExecuted: result.results?.length,
          });

          return {
            queryId: ctx.requestId,
            result,
            processingTime,
            metadata: {
              ...result.metadata,
              requestId: ctx.requestId,
              timestamp: ctx.timestamp,
            },
          };
        } catch (error) {
          logger.error("Query processing failed", "ORCHESTRATOR_API", {
            queryId: ctx.requestId,
            error: error instanceof Error ? error.message : "Unknown error",
          });

          orchestratorEvents.emit("query:failed", {
            queryId: ctx.requestId,
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date().toISOString(),
          });

          throw error;
        }
      }),

    // Create a plan without executing it
    createPlan: publicProcedure
      .input(orchestratorSchemas.plan)
      .mutation(async ({ input, ctx }) => {
        logger.info("Creating execution plan", "ORCHESTRATOR_API", {
          query: input.query.substring(0, 100),
          constraints: input.constraints,
          userId: ctx.user?.id,
        });

        if (!ctx.masterOrchestrator) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "MasterOrchestrator not initialized",
          });
        }

        // Create query object
        const query: Query = {
          text: input.query,
          metadata: input.constraints,
        };

        // Use the orchestrator's createPlan method
        const plan = await (ctx.masterOrchestrator as any).createPlan(
          query,
          undefined, // analysis will be done internally
          undefined  // routing plan will be created internally
        );

        logger.info("Execution plan created", "ORCHESTRATOR_API", {
          planId: plan.id,
          steps: plan.steps.length,
        });

        // Store plan for later execution (in a real implementation)
        // For now, we'll return it directly

        return {
          planId: plan.id,
          plan,
          created: new Date().toISOString(),
        };
      }),

    // Execute a previously created plan
    executePlan: publicProcedure
      .input(orchestratorSchemas.executePlan)
      .mutation(async ({ input, ctx }) => {
        logger.info("Executing plan", "ORCHESTRATOR_API", {
          planId: input.planId,
          options: input.options,
          userId: ctx.user?.id,
        });

        // This would retrieve the plan from storage in a real implementation
        // For now, we'll throw an error indicating this needs implementation
        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
          message: "Plan storage and retrieval not yet implemented. Use processQuery for now.",
        });
      }),

    // Get orchestrator status and capabilities
    status: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.masterOrchestrator) {
        return {
          initialized: false,
          error: "MasterOrchestrator not initialized",
        };
      }

      const isInitialized = await ctx.masterOrchestrator.isInitialized();
      const registeredAgents = ctx.agentRegistry?.getRegisteredTypes() || [];
      const activeAgents = ctx.agentRegistry?.getActiveAgents() || [];
      const ragStatus = await ctx.ragSystem?.getStatus?.() || { status: "unavailable" };

      return {
        initialized: isInitialized,
        llm: {
          available: !!(ctx.masterOrchestrator as any).llm,
          provider: (ctx.masterOrchestrator as any).llm?.constructor?.name || "none",
          modelInfo: (ctx.masterOrchestrator as any).llm?.getModelInfo?.() || {},
        },
        rag: {
          available: !!(ctx.masterOrchestrator as any).ragSystem,
          ...ragStatus,
        },
        agents: {
          registered: registeredAgents,
          active: activeAgents.map((a: any) => ({
            type: a.type,
            status: a.status,
            currentTask: a.currentTask,
          })),
          total: registeredAgents.length,
          activeCount: activeAgents.length,
        },
        capabilities: {
          planning: true,
          execution: true,
          replanning: true,
          ragIntegration: !!(ctx.masterOrchestrator as any).ragSystem,
          confidenceScoring: false, // Would be true with ConfidenceMasterOrchestrator
          multiAgent: true,
          toolExecution: true,
        },
        performance: {
          averageQueryTime: "N/A", // Would need metrics tracking
          successRate: "N/A",
          totalQueries: "N/A",
        },
      };
    }),

    // Get available agents and their capabilities
    getAgents: publicProcedure.query(async ({ ctx }) => {
      const types = ctx.agentRegistry?.getRegisteredTypes() || [];
      const agents = types.map((type: string) => {
        const agent = ctx.agentRegistry?.getAgentSync?.(type);
        return {
          type,
          available: !!agent,
          capabilities: getAgentCapabilities(type),
          description: getAgentDescription(type),
          tools: getAgentTools(type),
        };
      });

      return agents;
    }),

    // Analyze a query without executing it
    analyzeQuery: publicProcedure
      .input(z.object({
        query: z.string().min(1).max(10000),
      }))
      .mutation(async ({ input, ctx }) => {
        logger.info("Analyzing query", "ORCHESTRATOR_API", {
          query: input.query.substring(0, 100),
        });

        if (!ctx.masterOrchestrator) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "MasterOrchestrator not initialized",
          });
        }

        // Use enhanced parser if available
        const parser = (ctx.masterOrchestrator as any).enhancedParser;
        if (!parser) {
          return {
            analysis: {
              intent: "general",
              complexity: 5,
              domains: ["general"],
              priority: "medium",
              estimatedDuration: 30,
            },
            message: "Basic analysis only (LLM parser not available)",
          };
        }

        const query: Query = { text: input.query };
        const analysis = await parser.parseQuery(query);

        // Get routing recommendation
        const router = (ctx.masterOrchestrator as any).agentRouter;
        const routingPlan = router ? await router.routeQuery(analysis) : null;

        return {
          analysis,
          routingPlan,
          ragContext: {
            available: !!(ctx.masterOrchestrator as any).ragSystem,
            recommendedQueries: analysis.entities ? Object.values(analysis.entities).flat() : [],
          },
        };
      }),

    // Submit feedback for a query result
    submitFeedback: publicProcedure
      .input(orchestratorSchemas.feedback)
      .mutation(async ({ input, ctx }) => {
        logger.info("Feedback submitted", "ORCHESTRATOR_API", {
          queryId: input.queryId,
          feedbackType: input.feedbackType,
          userId: ctx.user?.id,
        });

        // Emit feedback event for analytics
        orchestratorEvents.emit("feedback:received", {
          ...input,
          userId: ctx.user?.id,
          timestamp: new Date().toISOString(),
        });

        // In a real implementation, this would store feedback for model improvement
        return {
          success: true,
          message: "Thank you for your feedback. It will help improve the system.",
          feedbackId: `feedback-${Date.now()}`,
        };
      }),

    // Get execution history
    getHistory: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(10),
        offset: z.number().min(0).default(0),
        userId: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        // This would retrieve from a database in a real implementation
        logger.info("Retrieving execution history", "ORCHESTRATOR_API", {
          limit: input.limit,
          offset: input.offset,
          userId: input.userId || ctx.user?.id,
        });

        return {
          history: [],
          total: 0,
          message: "History tracking not yet implemented",
        };
      }),

    // Subscribe to orchestrator events
    subscribe: publicProcedure
      .input(z.object({
        events: z.array(z.enum([
          "query:started",
          "query:completed",
          "query:failed",
          "plan:created",
          "plan:executing",
          "plan:completed",
          "step:started",
          "step:completed",
          "step:failed",
          "agent:assigned",
          "agent:completed",
          "rag:searching",
          "rag:results",
          "replan:triggered",
        ])).default(["query:started", "query:completed", "query:failed"]),
      }))
      .subscription(({ input }) => {
        return observable((observer: any) => {
          const handlers: Record<string, (data: any) => void> = {};

          // Create handlers for each event type
          input.events.forEach(eventType => {
            handlers[eventType] = (data: any) => {
              observer.next({
                type: eventType,
                data,
                timestamp: new Date().toISOString(),
              });
            };
            orchestratorEvents.on(eventType, handlers[eventType]);
          });

          // Cleanup on unsubscribe
          return () => {
            Object.entries(handlers).forEach(([eventType, handler]) => {
              orchestratorEvents.off(eventType, handler);
            });
          };
        });
      }),

    // Test endpoint to verify orchestrator is working
    test: publicProcedure
      .input(z.object({
        message: z.string().default("Hello, orchestrator!"),
      }))
      .query(async ({ input, ctx }) => {
        const hasOrchestrator = !!ctx.masterOrchestrator;
        const isInitialized = hasOrchestrator && await ctx.masterOrchestrator.isInitialized();
        const hasLLM = hasOrchestrator && !!(ctx.masterOrchestrator as any).llm;
        const hasRAG = hasOrchestrator && !!(ctx.masterOrchestrator as any).ragSystem;
        const registeredAgents = ctx.agentRegistry?.getRegisteredTypes() || [];

        return {
          message: `Orchestrator Test: ${input.message}`,
          status: {
            orchestrator: hasOrchestrator ? "available" : "missing",
            initialized: isInitialized,
            llm: hasLLM ? "connected" : "disconnected",
            rag: hasRAG ? "connected" : "disconnected",
            agents: `${registeredAgents.length} registered`,
          },
          timestamp: new Date().toISOString(),
        };
      }),
  })
);

// Helper functions
function getAgentCapabilities(type: string): string[] {
  const capabilities: Record<string, string[]> = {
    ResearchAgent: ["web_search", "information_synthesis", "fact_checking", "summarization"],
    CodeAgent: ["code_generation", "debugging", "refactoring", "code_review", "testing"],
    DataAnalysisAgent: ["data_processing", "statistical_analysis", "visualization", "pattern_recognition"],
    WriterAgent: ["content_creation", "editing", "formatting", "style_adaptation"],
    ToolExecutorAgent: ["tool_orchestration", "workflow_automation", "integration_management"],
  };
  return capabilities[type] || [];
}

function getAgentDescription(type: string): string {
  const descriptions: Record<string, string> = {
    ResearchAgent: "Specializes in web research and information gathering",
    CodeAgent: "Handles code generation, analysis, and debugging",
    DataAnalysisAgent: "Performs data analysis and visualization",
    WriterAgent: "Creates various types of written content",
    ToolExecutorAgent: "Executes and coordinates various tools",
  };
  return descriptions[type] || "Unknown agent type";
}

function getAgentTools(type: string): string[] {
  const tools: Record<string, string[]> = {
    ResearchAgent: ["WebSearchTool", "WebScraperTool"],
    CodeAgent: ["CodeExecutorTool", "FileSystemTool"],
    DataAnalysisAgent: ["DataProcessingTool", "VisualizationTool"],
    WriterAgent: ["MarkdownFormatterTool", "GrammarCheckTool"],
    ToolExecutorAgent: ["WebSearchTool", "WebScraperTool", "FileSystemTool", "CodeExecutorTool"],
  };
  return tools[type] || [];
}