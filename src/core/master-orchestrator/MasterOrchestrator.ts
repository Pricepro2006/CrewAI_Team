import { llmProviderManager, LLMProviderManager, LLMProvider } from "../llm/LLMProviderManager.js";
import type { EmailAnalysisResult } from "../../api/services/EmailStorageService.js";
import { AgentRegistry } from "../agents/registry/AgentRegistry.js";
import { RAGSystem } from "../rag/RAGSystem.js";
import { PlanExecutor } from "./PlanExecutor.js";
import { PlanReviewer } from "./PlanReviewer.js";
import { EnhancedParser } from "./EnhancedParser.js";
import { AgentRouter } from "./AgentRouter.js";
import { SimplePlanGenerator } from "./SimplePlanGenerator.js";
import type {
  Plan,
  ExecutionResult,
  Query,
  MasterOrchestratorConfig,
  ReviewResult,
} from "./types.js";
import type { QueryAnalysis, AgentRoutingPlan } from "./enhanced-types.js";
import { logger, createPerformanceMonitor } from "../../utils/logger.js";
import { wsService } from "../../api/services/WebSocketService.js";
import { responseCache } from "../llm/ResponseCache.js";
import { PromptOptimizer } from "../llm/PromptOptimizer.js";
import {
  withTimeout,
  DEFAULT_TIMEOUTS,
  TimeoutError,
} from "../../utils/timeout.js";

export class MasterOrchestrator {
  private llm: LLMProvider | null = null;
  private config: MasterOrchestratorConfig;
  public agentRegistry: AgentRegistry;
  public ragSystem: RAGSystem;
  private planExecutor: PlanExecutor;
  private planReviewer: PlanReviewer;
  private enhancedParser: EnhancedParser | null = null;
  private agentRouter: AgentRouter;
  private perfMonitor = createPerformanceMonitor("MasterOrchestrator");

  constructor(config: MasterOrchestratorConfig) {
    logger.info("Initializing MasterOrchestrator", "ORCHESTRATOR", { config });

    this.config = config;
    this.agentRegistry = new AgentRegistry();

    // Use default RAG config if not provided (optimized for email processing)
    const ragConfig = config.rag || {
      vectorStore: {
        type: "adaptive" as const, // Use adaptive store for better fallback handling
        baseUrl: process.env.CHROMADB_URL || "http://localhost:8000",
        collectionName: process.env.CHROMADB_COLLECTION || "email-rag-collection",
        dimension: 4096, // Match Llama 3.2:3b embedding dimensions
      },
      chunking: {
        size: 1000, // Larger chunks for email content
        overlap: 100, // More overlap for context preservation
        method: "sentence" as const,
        trimWhitespace: true,
        preserveFormatting: false,
      },
      retrieval: {
        topK: 10, // More results for email context
        minScore: 0.3, // Lower threshold for email similarity
        reranking: false,
        boostRecent: true, // Prefer recent emails
      },
    };

    this.ragSystem = new RAGSystem(ragConfig);
    this.planExecutor = new PlanExecutor(this.agentRegistry, this.ragSystem);
    this.planReviewer = new PlanReviewer();
    // EnhancedParser will be initialized in initialize() method after LLM is created
    this.agentRouter = new AgentRouter();

    logger.info("MasterOrchestrator initialized successfully", "ORCHESTRATOR");
  }

  private async initializeLLMProvider(): Promise<void> {
    try {
      // Use the singleton LLMProviderManager instance
      this.llm = llmProviderManager;
      await this.llm.initialize();
      
      const llmManager = this.llm as LLMProviderManager;
      logger.info("LLM provider initialized successfully", "ORCHESTRATOR", { 
        isUsingFallback: llmManager.isUsingFallback(),
        modelInfo: this.llm.getModelInfo()
      });
    } catch (error) {
      logger.warn(
        `LLM initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}. System will use fallback responses.`,
        "ORCHESTRATOR"
      );
      // Don't fail initialization - the system can work with limited functionality
      this.llm = null;
    }
  }

  async initialize(): Promise<void> {
    // Initialize LLM provider using new manager
    await this.initializeLLMProvider();
    
    // Initialize EnhancedParser now that LLM is available
    if (this.llm) {
      this.enhancedParser = new EnhancedParser(this.llm as any);
    }

    // Initialize RAG system (gracefully handle ChromaDB failures)
    if (this.ragSystem) {
      try {
        await this.ragSystem.initialize();
        
        // Check if we're using fallback mode
        const ragHealth = await this.ragSystem.getHealthStatus();
        if (ragHealth?.vectorStore?.fallbackUsed) {
          logger.info(
            "RAG system initialized with in-memory fallback - ChromaDB unavailable but system operational", 
            "ORCHESTRATOR"
          );
        } else {
          logger.info("RAG system initialized successfully with ChromaDB", "ORCHESTRATOR");
        }
      } catch (error) {
        logger.warn(
          `RAG system initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}. Continuing without RAG capabilities.`,
          "ORCHESTRATOR"
        );
        // Don't fail initialization - the system can work without RAG
        // Set ragSystem to null to prevent usage attempts
        this.ragSystem = null as any;
      }
    }

    // Initialize agents registry
    await this.agentRegistry.initialize();

    // Pass RAG system to agent registry so all agents can access it
    // This will integrate RAG with all agents except EmailAnalysisAgent
    if (this.ragSystem && this.agentRegistry) {
      this.agentRegistry.setRAGSystem(this.ragSystem);
      logger.info("RAG system integrated with agent registry", "ORCHESTRATOR");
    }

    logger.info("MasterOrchestrator initialization completed", "ORCHESTRATOR");
  }

  async isInitialized(): Promise<boolean> {
    return true; // For health checks
  }

  /**
   * Public method to generate text using the configured LLM
   * @param prompt The prompt to generate text from
   * @param options Optional generation parameters
   * @returns Generated text response
   */
  public async generateText(prompt: string, options?: any): Promise<string> {
    if (!this.llm) {
      throw new Error("LLM provider not initialized");
    }
    const response = await this.llm.generate(prompt, options);
    return typeof response === 'string' ? response : response.response || '';
  }

  async processEmail(email: any): Promise<EmailAnalysisResult> {
    const perf = this.perfMonitor.start("processEmail");

    logger.info("Processing email through agent system", "ORCHESTRATOR", {
      emailId: email.id,
      subject: email.subject?.substring(0, 100),
    });

    try {
      // Create email analysis query
      const query: Query = {
        text: `Analyze this email for business intelligence:\n\nSubject: ${email.subject}\nFrom: ${email.from?.emailAddress?.address}\nBody: ${(email.body || email.bodyPreview || '').substring(0, 2000)}`,
        conversationId: email.id,
        metadata: { email, task: 'email_analysis' }
      };

      // Process through standard agent pipeline
      const result = await this.processQuery(query);

      // Convert ExecutionResult to EmailAnalysisResult
      return this.convertToEmailAnalysis(result, email);
    } catch (error) {
      logger.error("Email processing failed", "ORCHESTRATOR", { emailId: email.id }, error as Error);
      perf.end({ success: false });
      throw error;
    }
  }

  private convertToEmailAnalysis(result: ExecutionResult, email: any): EmailAnalysisResult {
    // Extract analysis data from agent results
    const agentData = result.results.find((r: any) => r.agent === 'EmailAnalysisAgent')?.data;
    
    return {
      quick: {
        workflow: {
          primary: agentData?.categories?.workflow?.[0] || 'General Support',
          secondary: agentData?.categories?.workflow?.slice(1) || []
        },
        priority: agentData?.priority || 'Medium',
        intent: agentData?.categories?.intent || 'FYI',
        urgency: agentData?.categories?.urgency || 'No Rush',
        confidence: agentData?.confidence || 0.5,
        suggestedState: agentData?.workflowState || 'New'
      },
      deep: {
        detailedWorkflow: {
          primary: agentData?.categories?.workflow?.[0] || 'General Support',
          secondary: agentData?.categories?.workflow?.slice(1) || [],
          relatedCategories: [],
          confidence: agentData?.confidence || 0.5
        },
        entities: {
          poNumbers: agentData?.entities?.poNumbers || [],
          quoteNumbers: agentData?.entities?.quoteNumbers || [],
          caseNumbers: agentData?.entities?.caseNumbers || [],
          partNumbers: agentData?.entities?.products || [],
          orderReferences: agentData?.entities?.orderNumbers || [],
          contacts: agentData?.entities?.customers?.map((c: string) => ({ name: c, type: 'external' as const })) || []
        },
        actionItems: agentData?.suggestedActions?.map((action: string) => ({
          type: 'action',
          description: action,
          priority: agentData?.priority || 'Medium',
          slaHours: this.getSlaHours(agentData?.priority || 'Medium'),
          slaStatus: 'on-track' as const
        })) || [],
        workflowState: {
          current: agentData?.workflowState || 'New',
          suggestedNext: this.getNextState(agentData?.workflowState || 'New'),
          blockers: []
        },
        businessImpact: {
          customerSatisfaction: 'medium' as const,
          urgencyReason: agentData?.categories?.urgency !== 'No Rush' ? `Priority: ${agentData?.priority}` : undefined
        },
        contextualSummary: agentData?.summary || result.summary || '',
        suggestedResponse: agentData?.suggestedResponse,
        relatedEmails: []
      },
      actionSummary: agentData?.suggestedActions?.join('; ') || 'Email processed and categorized',
      processingMetadata: {
        stage1Time: Date.now() - (result.metadata?.timestamp ? new Date(result.metadata.timestamp).getTime() : Date.now()),
        stage2Time: 0,
        totalTime: Date.now() - (result.metadata?.timestamp ? new Date(result.metadata.timestamp).getTime() : Date.now()),
        models: {
          stage1: 'MasterOrchestrator',
          stage2: 'EmailAnalysisAgent'
        }
      }
    };
  }

  private getSlaHours(priority: string): number {
    switch (priority) {
      case 'Critical': return 4;
      case 'High': return 24;
      case 'Medium': return 72;
      case 'Low': return 168;
      default: return 72;
    }
  }

  private getNextState(currentState: string): string {
    const stateTransitions: Record<string, string> = {
      'New': 'In Review',
      'In Review': 'In Progress', 
      'In Progress': 'Pending External',
      'Pending External': 'Completed'
    };
    return stateTransitions[currentState] || 'In Review';
  }

  async processQuery(query: Query): Promise<ExecutionResult> {
    const perf = this.perfMonitor.start("processQuery");

    logger.info("Processing query START", "ORCHESTRATOR", {
      query: query?.text?.substring(0, 100),
      conversationId: query.conversationId,
      hasLLM: !!this.llm,
      hasAgentRegistry: !!this.agentRegistry,
      hasRAGSystem: !!this.ragSystem,
      hasPlanExecutor: !!this.planExecutor,
      enhancedParserStatus: !!this.enhancedParser,
      timestamp: new Date().toISOString()
    });

    // Debug the initialization state
    logger.debug("MasterOrchestrator state check", "ORCHESTRATOR_DEBUG", {
      agentRegistryMethods: this.agentRegistry ? Object.getOwnPropertyNames(Object.getPrototypeOf(this.agentRegistry)) : null,
      ragSystemMethods: this.ragSystem ? Object.getOwnPropertyNames(Object.getPrototypeOf(this.ragSystem)) : null,
      planExecutorMethods: this.planExecutor ? Object.getOwnPropertyNames(Object.getPrototypeOf(this.planExecutor)) : null,
      configDetails: {
        ollamaUrl: this.config?.ollamaUrl,
        ragConfig: !!this.config?.rag
      }
    });

    // Check cache first for instant responses (TEMPORARILY DISABLED FOR DEBUGGING)
    const USE_CACHE = false; // Disable cache to test actual agent processing
    const cachedResponse = USE_CACHE ? responseCache.get(query.text) : null;
    if (cachedResponse) {
      logger.info("Using cached response", "ORCHESTRATOR", {
        query: query.text.substring(0, 50)
      });
      
      const duration = perf.end();
      return {
        success: true,
        results: [],
        summary: cachedResponse,
        metadata: {
          source: "cache",
          responseTime: duration,
          timestamp: new Date().toISOString(),
          confidence: 1.0
        }
      };
    }

    logger.info("Cache disabled - proceeding with full agent processing", "ORCHESTRATOR_DEBUG", {
      query: query.text.substring(0, 100)
    });

    try {
      // Step 0: Enhanced query analysis with timeout
      let queryAnalysis;
      if (this.enhancedParser) {
        queryAnalysis = await withTimeout(
          this.enhancedParser.parseQuery(query),
          DEFAULT_TIMEOUTS.QUERY_PROCESSING,
          "Query analysis timed out",
        );
      } else {
        // Fallback query analysis when parser is not available
        queryAnalysis = {
          intent: 'general',
          complexity: 5,
          domains: ['general'],
          priority: 'medium',
          estimatedDuration: 30
        };
      }

      logger.info("Query analysis completed", "ORCHESTRATOR", {
        intent: queryAnalysis.intent,
        complexity: queryAnalysis.complexity,
        domains: queryAnalysis.domains,
        priority: queryAnalysis.priority,
        estimatedDuration: queryAnalysis.estimatedDuration,
      });

      // Check if this is a system-related question about capabilities
      // These should use internal knowledge, not external research
      const systemQuestionPatterns = [
        'which tools', 'what tools', 'available tools', 'your tools',
        'which agents', 'what agents', 'available agents', 'your agents',
        'capabilities', 'what can you', 'what do you', 'how do you work',
        'your functions', 'your features', 'system info', 'about you'
      ];
      
      const isSystemQuestion = systemQuestionPatterns.some(pattern => 
        query.text.toLowerCase().includes(pattern)
      );

      if (isSystemQuestion) {
        // Override the intent to 'system_info' so it doesn't get routed to ResearchAgent
        queryAnalysis.intent = 'system_info';
        queryAnalysis.domains = ['system', 'capabilities'];
      }

      // Step 0.5: Create intelligent agent routing plan with timeout
      const routingPlan = await withTimeout(
        this.agentRouter.routeQuery(queryAnalysis as QueryAnalysis),
        DEFAULT_TIMEOUTS.PLAN_CREATION,
        "Agent routing plan creation timed out",
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
        this.createPlan(query, queryAnalysis as QueryAnalysis, routingPlan),
        DEFAULT_TIMEOUTS.PLAN_CREATION,
        "Plan creation timed out",
      );
      logger.info("Plan created successfully", "ORCHESTRATOR", {
        steps: plan?.steps?.length,
      });

      // Broadcast plan creation
      wsService.broadcastPlanUpdate(plan.id, "created", {
        completed: 0,
        total: plan.steps.length,
      });

      // Step 2: Execute plan with replan loop
      logger.info("Starting plan execution phase", "ORCHESTRATOR_EXECUTION", {
        planId: plan.id,
        stepCount: plan.steps.length,
        planMetadata: plan.metadata,
        firstStepAgent: plan.steps[0]?.agentType,
        firstStepTask: plan.steps[0]?.task?.substring(0, 100)
      });

      let executionResult: ExecutionResult = {
        success: false,
        results: [],
        summary: "No execution performed",
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

        logger.info("About to call planExecutor.execute", "ORCHESTRATOR_EXECUTION", {
          attempt: attempts + 1,
          planId: plan.id,
          executorAvailable: !!this.planExecutor,
          timeout: DEFAULT_TIMEOUTS.AGENT_EXECUTION
        });

        executionResult = await withTimeout(
          this.planExecutor.execute(plan),
          DEFAULT_TIMEOUTS.AGENT_EXECUTION,
          "Plan execution timed out",
        );

        logger.info("planExecutor.execute completed", "ORCHESTRATOR_EXECUTION", {
          success: executionResult.success,
          resultsCount: executionResult.results?.length || 0,
          summary: executionResult.summary?.substring(0, 100),
          hasResults: !!executionResult.results,
          confidence: executionResult.metadata?.confidence
        });

        // Step 3: Review execution results with timeout
        const review = await withTimeout(
          this.planReviewer.reviewPlan(plan),
          DEFAULT_TIMEOUTS.PLAN_CREATION,
          "Plan review timed out",
        );

        logger.debug("Plan review completed", "ORCHESTRATOR", {
          satisfactory:
            (review as any).approved || (review as any).satisfactory,
          attempts: attempts + 1,
        });

        if (
          !(review as any).approved &&
          !(review as any).satisfactory &&
          attempts < maxAttempts
        ) {
          // Check if failures are only infrastructure-related
          const hasOnlyInfrastructureFailures =
            review?.failedSteps?.length === 0 &&
            review?.feedback?.includes("infrastructure limitations");

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
            this.replan(query, plan, review, queryAnalysis as QueryAnalysis),
            DEFAULT_TIMEOUTS.PLAN_CREATION,
            "Replanning timed out",
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

      // Cache successful responses for future use
      if (result.success && result.summary) {
        responseCache.set(query.text, result.summary);
        logger.debug("Response cached for future use", "ORCHESTRATOR", {
          query: query.text.substring(0, 50)
        });
      }

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
            message: error.message,
          },
          error,
        );

        // Return a timeout response instead of throwing
        return {
          success: false,
          results: [],
          summary:
            "I apologize, but processing your request took too long. This can happen with complex queries or when the system is under heavy load. Please try simplifying your request or try again later.",
          metadata: {
            error: "timeout",
            duration: error.duration,
            timestamp: new Date().toISOString(),
          },
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
    // TEMPORARY: Always use simple plan to bypass RAG timeout issues
    const USE_SIMPLE_PLAN = true; // Force simple plan until RAG is fixed
    const isComplexQuery = this.isComplexQuery(query, analysis);
    
    // Use simple plan for now
    if (!isComplexQuery || USE_SIMPLE_PLAN) {
      logger.info(
        "Using simple plan generator (RAG bypass mode)",
        "ORCHESTRATOR",
      );
      return SimplePlanGenerator.createSimplePlan(query, routingPlan);
    }
    
    // For complex queries when RAG is fixed
    if (isComplexQuery && !this.llm) {
      logger.warn("Complex query detected but LLM unavailable, using enhanced simple plan", "ORCHESTRATOR");
      return SimplePlanGenerator.createMultiAgentPlan(query, routingPlan, analysis);
    }
    
    // Skip RAG for now - it's causing timeouts
    let ragContext = "";
    /* DISABLED: RAG causing timeouts
    try {
      logger.debug("Searching knowledge base for relevant context", "ORCHESTRATOR");
      const ragResults = await this.ragSystem?.search(query.text, 3);
      if ((ragResults?.length || 0) > 0) {
        ragContext = `
      
      Relevant Knowledge Base Context:
      ${ragResults?.map((r, i) => `
      ${i + 1}. [Score: ${r?.score?.toFixed(3)}] 
         Category: ${r?.metadata?.category || "general"}
         Title: ${r?.metadata?.title || r?.metadata?.fileName}
         Content: ${r?.content?.substring(0, 300)}...
      `).join("\n")}
      `;
        logger.info(`Found ${ragResults?.length || 0} relevant knowledge base entries`, "ORCHESTRATOR");
      }
    } catch (error) {
      logger.warn(`Failed to retrieve RAG context: ${error instanceof Error ? error.message : "Unknown error"}`, "ORCHESTRATOR");
    }
    */
    
    const analysisContext = analysis
      ? `
      
      Query Analysis Context:
      - Intent: ${analysis.intent}
      - Complexity: ${analysis.complexity}/10
      - Required domains: ${analysis?.domains?.join(", ")}
      - Priority: ${analysis.priority}
      - Estimated duration: ${analysis.estimatedDuration} seconds
      - Resource requirements: ${JSON.stringify(analysis.resourceRequirements)}
      - Detected entities: ${JSON.stringify(analysis.entities)}
    `
      : "";

    const routingContext = routingPlan
      ? `
      
      Agent Routing Plan:
      - Selected agents: ${routingPlan?.selectedAgents?.map((a: any) => `${a.agentType} (priority: ${a.priority}, confidence: ${a.confidence})`).join(", ")}
      - Execution strategy: ${routingPlan.executionStrategy}
      - Overall confidence: ${routingPlan.confidence}
      - Risk level: ${routingPlan?.riskAssessment?.level}
      - Risk factors: ${routingPlan?.riskAssessment?.factors?.join(", ") || 'None'}
      - Fallback agents available: ${routingPlan?.fallbackAgents?.join(", ") || 'None'}
    `
      : "";

    // Add system context for system-info questions
    const systemContext = analysis?.intent === 'system_info' ? `
      
      SYSTEM CAPABILITIES:
      You oversee a team of 6 specialized agents with the following capabilities:
      
      1. ResearchAgent:
         - Web search (DuckDuckGo/SearXNG)
         - Information gathering and fact-checking
         - Content extraction from web pages
         
      2. CodeAgent:
         - Code generation in multiple languages
         - Debugging and code analysis
         - Algorithm implementation
         
      3. DataAnalysisAgent:
         - Data processing and statistics
         - Pattern recognition and insights
         - Visualization and reporting
         
      4. WriterAgent:
         - Content creation and documentation
         - Summarization and explanations
         - Report writing
         
      5. ToolExecutorAgent:
         - Web scraping (WebScraperTool with Axios/Cheerio)
         - Tool coordination and automation
         - External API integration
         
      6. EmailAnalysisAgent:
         - Email processing and categorization
         - Chain analysis and threading
         - Business intelligence extraction
      
      Additional System Features:
      - RAG System with ChromaDB vector store for semantic search
      - LLM: Llama 3.2 3B model for intelligent responses
      - WebSocket real-time updates
      - Walmart grocery tracking system
      - Redis queue management
      
      When answering system questions, provide specific, accurate information about these capabilities.
    ` : "";

    const prompt = `
      You are the Master Orchestrator. Create a detailed plan to address this query:
      "${query.text}"${analysisContext}${routingContext}${ragContext}${systemContext}
      
      Break down the task into clear, actionable steps considering the analysis, routing context, and relevant knowledge base information.
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

    if (!this.llm) {
      logger.warn("LLM not available, using fallback plan generation", "ORCHESTRATOR");
      return SimplePlanGenerator.createSimplePlan(query, routingPlan);
    }

    const llamaResponse = await withTimeout(
      this.llm.generate(prompt, {
        format: "json",
        temperature: 0.3,
        maxTokens: 2000,
      }),
      DEFAULT_TIMEOUTS.LLM_GENERATION,
      "LLM generation timed out during plan creation",
    );
    return this.parsePlan(llamaResponse.response, query);
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

    if (!this.llm) {
      logger.warn("LLM not available, using fallback replanning", "ORCHESTRATOR");
      return SimplePlanGenerator.createSimplePlan(query);
    }

    const llamaResponse = await withTimeout(
      this.llm.generate(prompt, {
        format: "json",
        temperature: 0.3,
        maxTokens: 2000,
      }),
      DEFAULT_TIMEOUTS.LLM_GENERATION,
      "LLM generation timed out during replanning",
    );
    return this.parsePlan(llamaResponse.response, query);
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

  private isComplexQuery(query: Query, analysis?: QueryAnalysis): boolean {
    // Determine if query requires multiple agents or complex processing
    const queryText = query.text.toLowerCase();
    
    // Check for multi-step indicators
    const multiStepIndicators = [
      'and then', 'after that', 'followed by', 'next',
      'multiple', 'several', 'various', 'comprehensive',
      'analyze and', 'research and', 'create and'
    ];
    
    // Check for cross-domain requirements
    const hasCrossDomain = analysis?.domains && analysis.domains.length > 1;
    
    // Check for high complexity score
    const isHighComplexity = analysis?.complexity && analysis.complexity > 7;
    
    // Check for multiple entities
    const hasMultipleEntities = analysis?.entities && 
      Object.keys(analysis.entities).length > 2;
    
    // Check query length (complex queries tend to be longer)
    const isLongQuery = query.text.length > 150;
    
    // Check for multi-step keywords in query
    const hasMultiStepKeywords = multiStepIndicators.some(indicator => 
      queryText.includes(indicator)
    );
    
    return hasCrossDomain || isHighComplexity || hasMultipleEntities || 
           isLongQuery || hasMultiStepKeywords;
  }

  private formatResponse(executionResult: ExecutionResult): ExecutionResult {
    // Consolidate results into a coherent response
    const summary = executionResult.results
      .map((result: any) => result.output)
      .filter((output: any) => output)
      .join("\n\n");

    return {
      ...executionResult,
      summary,
      metadata: {
        totalSteps: executionResult.results.length,
        successfulSteps: executionResult.results.filter((r: any) => r.success)
          .length,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
