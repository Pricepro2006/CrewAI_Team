import { OllamaProvider } from "../llm/OllamaProvider";
import { AgentRegistry } from "../agents/registry/AgentRegistry";
import { RAGSystem } from "../rag/RAGSystem";
import { PlanExecutor } from "./PlanExecutor";
import { PlanReviewer } from "./PlanReviewer";
import { EnhancedParser } from "./EnhancedParser";
import { AgentRouter } from "./AgentRouter";
import { SimplePlanGenerator } from "./SimplePlanGenerator";
import type {
  Plan,
  ExecutionResult,
  Query,
  MasterOrchestratorConfig,
  ReviewResult,
} from "./types";
import type { QueryAnalysis, AgentRoutingPlan } from "./enhanced-types";
import { logger, createPerformanceMonitor } from "../../utils/logger";
import { wsService } from "../../api/services/WebSocketService";
import { withTimeout, DEFAULT_TIMEOUTS, TimeoutError } from "../../utils/timeout";

export class MasterOrchestrator {
  private llm: OllamaProvider;
  public agentRegistry: AgentRegistry;
  public ragSystem: RAGSystem;
  private planExecutor: PlanExecutor;
  private planReviewer: PlanReviewer;
  private enhancedParser: EnhancedParser;
  private agentRouter: AgentRouter;
  private perfMonitor = createPerformanceMonitor("MasterOrchestrator");

  constructor(config: MasterOrchestratorConfig) {
    logger.info("Initializing MasterOrchestrator", "ORCHESTRATOR", { config });

    this.llm = new OllamaProvider({
      model: config.model || "phi3:mini",  // Good balance for CPU performance
      baseUrl: config.ollamaUrl,
    });

    this.agentRegistry = new AgentRegistry();

    // Use default RAG config if not provided (for testing)
    const ragConfig = config.rag || {
      vectorStore: {
        type: "chromadb" as const,
        path: "./test-data/chroma-test",
        collectionName: "test-collection",
        dimension: 384,
      },
      chunking: {
        size: 500,
        overlap: 50,
        method: "sentence" as const,
      },
      retrieval: {
        topK: 5,
        minScore: 0.5,
        reranking: false,
      },
    };

    this.ragSystem = new RAGSystem(ragConfig);
    this.planExecutor = new PlanExecutor(this.agentRegistry, this.ragSystem);
    this.planReviewer = new PlanReviewer();
    this.enhancedParser = new EnhancedParser(this.llm);
    this.agentRouter = new AgentRouter();

    logger.info("MasterOrchestrator initialized successfully", "ORCHESTRATOR");
  }

  async initialize(): Promise<void> {
    // Initialize RAG system (gracefully handle test scenarios)
    if (this.ragSystem) {
      try {
        await this.ragSystem.initialize();
        logger.info("RAG system initialized successfully", "ORCHESTRATOR");
      } catch (error) {
        logger.warn(
          "RAG system initialization failed, continuing without RAG",
          "ORCHESTRATOR",
          {
            error: (error as Error).message,
          },
        );
        // Don't fail initialization if RAG isn't available (useful for tests)
      }
    }

    // Initialize agents registry
    await this.agentRegistry.initialize();

    logger.info("MasterOrchestrator initialization completed", "ORCHESTRATOR");
  }

  async isInitialized(): Promise<boolean> {
    return true; // For health checks
  }

  async processQuery(query: Query): Promise<ExecutionResult> {
    const perf = this.perfMonitor.start("processQuery");

    logger.info("Processing query", "ORCHESTRATOR", {
      query: query.text.substring(0, 100),
      conversationId: query.conversationId,
    });

    try {
      // Step 0: Enhanced query analysis with timeout
      const queryAnalysis = await withTimeout(
        this.enhancedParser.parseQuery(query),
        DEFAULT_TIMEOUTS.QUERY_PROCESSING,
        "Query analysis timed out"
      );

      logger.info("Query analysis completed", "ORCHESTRATOR", {
        intent: queryAnalysis.intent,
        complexity: queryAnalysis.complexity,
        domains: queryAnalysis.domains,
        priority: queryAnalysis.priority,
        estimatedDuration: queryAnalysis.estimatedDuration,
      });

      // Step 0.5: Create intelligent agent routing plan with timeout
      const routingPlan = await withTimeout(
        this.agentRouter.routeQuery(queryAnalysis),
        DEFAULT_TIMEOUTS.PLAN_CREATION,
        "Agent routing plan creation timed out"
      );

      logger.info("Agent routing plan created", "ORCHESTRATOR", {
        primaryAgent: (routingPlan as any).primaryAgent,
        strategy: (routingPlan as any).executionStrategy,
        confidence: (routingPlan as any).confidence,
        fallbackAgents: (routingPlan as any).fallbackAgents?.length || 0,
      });

      // Step 1: Create initial plan with enhanced context and timeout
      logger.info("Starting plan creation", "ORCHESTRATOR");
      let plan = await withTimeout(
        this.createPlan(query, queryAnalysis, routingPlan),
        DEFAULT_TIMEOUTS.PLAN_CREATION,
        "Plan creation timed out"
      );
      logger.info("Plan created successfully", "ORCHESTRATOR", {
        steps: plan.steps.length,
      });

      // Broadcast plan creation
      wsService.broadcastPlanUpdate(plan.id, "created", {
        completed: 0,
        total: plan.steps.length,
      });

      // Step 2: Execute plan with replan loop
      let executionResult: ExecutionResult = {
        success: false,
        results: [],
        summary: 'No execution performed'
      };
      let attempts = 0;
      const maxAttempts = 3;
      const startTime = Date.now();
      const maxTotalTime = 120000; // 2 minutes max for entire replan loop

      do {
        // Check if we've exceeded total time limit
        if (Date.now() - startTime > maxTotalTime) {
          logger.warn("Replan loop exceeded time limit", "ORCHESTRATOR", {
            elapsedTime: Date.now() - startTime,
            attempts: attempts,
          });
          break;
        }
        
        logger.debug(
          `Executing plan (attempt ${attempts + 1}/${maxAttempts})`,
          "ORCHESTRATOR",
          {
            stepsCount: plan.steps.length,
          },
        );

        executionResult = await withTimeout(
          this.planExecutor.execute(plan),
          DEFAULT_TIMEOUTS.AGENT_EXECUTION,
          "Plan execution timed out"
        );

        // Step 3: Review execution results with timeout
        const review = await withTimeout(
          this.planReviewer.reviewPlan(plan),
          DEFAULT_TIMEOUTS.PLAN_CREATION,
          "Plan review timed out"
        );

        logger.debug("Plan review completed", "ORCHESTRATOR", {
          satisfactory: (review as any).approved || (review as any).satisfactory,
          attempts: attempts + 1,
        });

        if (!(review as any).approved && !(review as any).satisfactory && attempts < maxAttempts) {
          // Check if failures are only infrastructure-related
          const hasOnlyInfrastructureFailures = review.failedSteps.length === 0 && 
            review.feedback.includes('infrastructure limitations');
            
          if (hasOnlyInfrastructureFailures) {
            logger.info(
              "Skipping replan due to infrastructure limitations",
              "ORCHESTRATOR",
              {
                feedback: review.feedback,
              },
            );
            break;
          }
          
          // Step 4: Replan if necessary
          logger.info(
            "Replanning due to unsatisfactory results",
            "ORCHESTRATOR",
            {
              feedback: review.feedback,
              failedSteps: review.failedSteps,
            },
          );

          plan = await withTimeout(
            this.replan(query, plan, review, queryAnalysis),
            DEFAULT_TIMEOUTS.PLAN_CREATION,
            "Replanning timed out"
          );
          attempts++;
        } else {
          break;
        }
      } while (attempts < maxAttempts);

      // Step 5: Format and return final response
      const result = this.formatResponse(executionResult);

      logger.info("Query processing completed", "ORCHESTRATOR", {
        success:
          result.metadata?.["successfulSteps"] ===
          result.metadata?.["totalSteps"],
        attempts: attempts + 1,
        totalSteps: result.metadata?.["totalSteps"],
      });

      perf.end({ success: true });
      return result;
    } catch (error) {
      if (error instanceof TimeoutError) {
        logger.error(
          "Query processing timed out",
          "ORCHESTRATOR",
          { 
            query: query.text,
            duration: error.duration,
            message: error.message
          },
          error
        );
        
        // Return a timeout response instead of throwing
        return {
          success: false,
          results: [],
          summary: "I apologize, but processing your request took too long. This can happen with complex queries or when the system is under heavy load. Please try simplifying your request or try again later.",
          metadata: {
            error: 'timeout',
            duration: error.duration,
            timestamp: new Date().toISOString()
          }
        };
      }
      
      logger.error(
        "Query processing failed",
        "ORCHESTRATOR",
        { query: query.text },
        error as Error,
      );
      perf.end({ success: false });
      throw error;
    }
  }

  private async createPlan(
    query: Query,
    analysis?: QueryAnalysis,
    routingPlan?: AgentRoutingPlan,
  ): Promise<Plan> {
    // Use simple plan generator for CPU performance
    const USE_SIMPLE_PLAN = process.env['USE_SIMPLE_PLAN'] !== 'false';
    if (USE_SIMPLE_PLAN) {
      logger.info("Using simple plan generator for CPU performance", "ORCHESTRATOR");
      return SimplePlanGenerator.createSimplePlan(query, routingPlan);
    }
    const analysisContext = analysis
      ? `
      
      Query Analysis Context:
      - Intent: ${analysis.intent}
      - Complexity: ${analysis.complexity}/10
      - Required domains: ${analysis.domains.join(", ")}
      - Priority: ${analysis.priority}
      - Estimated duration: ${analysis.estimatedDuration} seconds
      - Resource requirements: ${JSON.stringify(analysis.resourceRequirements)}
      - Detected entities: ${JSON.stringify(analysis.entities)}
    `
      : "";

    const routingContext = routingPlan
      ? `
      
      Agent Routing Plan:
      - Selected agents: ${routingPlan.selectedAgents.map((a) => `${a.agentType} (priority: ${a.priority}, confidence: ${a.confidence})`).join(", ")}
      - Execution strategy: ${routingPlan.executionStrategy}
      - Overall confidence: ${routingPlan.confidence}
      - Risk level: ${routingPlan.riskAssessment.level}
      - Risk factors: ${routingPlan.riskAssessment.factors.join(", ")}
      - Fallback agents available: ${routingPlan.fallbackAgents.join(", ")}
    `
      : "";

    const prompt = `
      You are the Master Orchestrator. Create a detailed plan to address this query:
      "${query.text}"${analysisContext}${routingContext}
      
      Break down the task into clear, actionable steps considering the analysis and routing context.
      For each step, determine:
      1. What information is needed (RAG query)
      2. Which agent should handle it - PRIORITIZE agents from the routing plan
      3. What tools might be required based on resource requirements
      4. Expected output
      
      Agent Selection Guidelines (follow routing plan recommendations):
      - ResearchAgent: For research, web search, information gathering
      - CodeAgent: For programming, debugging, code analysis
      - DataAnalysisAgent: For data processing, analysis, metrics
      - WriterAgent: For documentation, explanations, summaries
      - ToolExecutorAgent: For tool coordination and complex workflows
      
      IMPORTANT: Use the recommended agents from the routing plan unless there's a compelling reason not to.
      
      Return a structured plan in JSON format with the following structure:
      {
        "steps": [
          {
            "id": "step-1",
            "description": "Description of the step",
            "agentType": "ResearchAgent|CodeAgent|DataAnalysisAgent|WriterAgent|ToolExecutorAgent",
            "requiresTool": boolean,
            "toolName": "tool_name" (if requiresTool is true),
            "ragQuery": "Query for RAG system",
            "expectedOutput": "Description of expected output",
            "dependencies": ["step-ids"] (optional)
          }
        ]
      }
    `;

    const response = await withTimeout(
      this.llm.generate(prompt, {
        format: "json",
        temperature: 0.3,
        maxTokens: 2000,
      }),
      DEFAULT_TIMEOUTS.LLM_GENERATION,
      "LLM generation timed out during plan creation"
    );
    return this.parsePlan(response, query);
  }

  private async replan(
    query: Query,
    originalPlan: Plan,
    review: ReviewResult,
    analysis?: QueryAnalysis,
  ): Promise<Plan> {
    const prompt = `
      The original plan did not satisfy the requirements.
      
      Original Query: "${query.text}"
      Original Plan: ${JSON.stringify(originalPlan)}
      Review Feedback: ${review.feedback}
      Failed Steps: ${JSON.stringify(review.failedSteps)}
      
      Create a revised plan that addresses the issues.
      Focus on:
      1. Fixing the failed steps
      2. Adding missing information gathering steps
      3. Ensuring proper agent and tool selection
      
      Return the revised plan in the same JSON format.
    `;

    const response = await withTimeout(
      this.llm.generate(prompt, {
        format: "json",
        temperature: 0.3,
        maxTokens: 2000,
      }),
      DEFAULT_TIMEOUTS.LLM_GENERATION,
      "LLM generation timed out during replanning"
    );
    return this.parsePlan(response, query);
  }

  private parsePlan(response: string, query?: Query): Plan {
    try {
      // Extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate the plan structure
      if (!parsed.steps || !Array.isArray(parsed.steps)) {
        throw new Error("Invalid plan structure: missing steps array");
      }

      return {
        id: `plan-${Date.now()}`,
        steps: parsed.steps.map((step: any) => ({
          id: step.id || `step-${Date.now()}-${Math.random()}`,
          task: step.task || step.description,
          description: step.description,
          agentType: step.agentType,
          requiresTool: step.requiresTool || false,
          toolName: step.toolName,
          ragQuery: step.ragQuery,
          expectedOutput: step.expectedOutput,
          dependencies: step.dependencies || [],
          parameters: step.parameters || {},
        })),
      };
    } catch (error) {
      console.error("Failed to parse plan:", error);
      // Return a fallback plan
      return {
        id: `plan-fallback-${Date.now()}`,
        steps: [
          {
            id: "fallback-1",
            task: "Process query with general approach",
            description: "Process query with general approach",
            agentType: "ResearchAgent",
            requiresTool: false,
            ragQuery: query?.text || "General query processing",
            expectedOutput: "General response to query",
            dependencies: [],
          },
        ],
      };
    }
  }

  private formatResponse(executionResult: ExecutionResult): ExecutionResult {
    // Consolidate results into a coherent response
    const summary = executionResult.results
      .map((result) => result.output)
      .filter((output) => output)
      .join("\n\n");

    return {
      ...executionResult,
      summary,
      metadata: {
        totalSteps: executionResult.results.length,
        successfulSteps: executionResult.results.filter((r) => r.success)
          .length,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
