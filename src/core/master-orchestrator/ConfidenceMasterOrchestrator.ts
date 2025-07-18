/**
 * ConfidenceMasterOrchestrator - Enhanced orchestrator with confidence-scored RAG
 * Replaces the 6-step planning approach with a streamlined 4-step confidence workflow
 */

import { OllamaProvider } from "../llm/OllamaProvider";
import { AgentRegistry } from "../agents/registry/AgentRegistry";
import { RAGSystem } from "../rag/RAGSystem";
import { PlanExecutor } from "./PlanExecutor";
import { EnhancedParser } from "./EnhancedParser";
import { AgentRouter } from "./AgentRouter";
import { SimplePlanGenerator } from "./SimplePlanGenerator";
import {
  QueryComplexityAnalyzer,
  ConfidenceRAGRetriever,
  ConfidenceContextBuilder,
  ConfidenceResponseGenerator,
  MultiModalEvaluator,
  ConfidenceCalibrator,
  AdaptiveDeliveryManager,
  ActionType,
  ResponseEvaluationResult,
  DeliveredResponse,
} from "../rag/confidence";
import type {
  Plan,
  ExecutionResult,
  Query,
  MasterOrchestratorConfig,
} from "./types";
import type { QueryAnalysis, AgentRoutingPlan } from "./enhanced-types";
import { logger, createPerformanceMonitor } from "../../utils/logger";
// import { wsService } from "../../api/services/WebSocketService"; // TODO: Integrate WebSocket updates
import { VectorStore } from "../rag/VectorStore";
import { EventEmitter } from "events";
import { PerformanceOptimizer } from "../rag/confidence/PerformanceOptimizer";
import {
  selectModel,
  getModelForSystemLoad,
  MODEL_CONFIGS,
} from "../../config/model-selection.config";

export interface ConfidenceOrchestratorResult extends ExecutionResult {
  confidence: number;
  deliveredResponse: DeliveredResponse;
  processingPath: "simple-query" | "confidence-rag" | "agent-orchestration";
  feedbackId: string;
}

export class ConfidenceMasterOrchestrator extends EventEmitter {
  private llm: OllamaProvider;
  public agentRegistry: AgentRegistry;
  public ragSystem: RAGSystem;
  private planExecutor: PlanExecutor;
  private enhancedParser: EnhancedParser;
  private agentRouter: AgentRouter;
  private perfMonitor = createPerformanceMonitor(
    "ConfidenceMasterOrchestrator",
  );

  // Confidence scoring components
  private confidenceRAG: {
    analyzer: QueryComplexityAnalyzer;
    retriever: ConfidenceRAGRetriever;
    contextBuilder: ConfidenceContextBuilder;
    generator: ConfidenceResponseGenerator;
    evaluator: MultiModalEvaluator;
    calibrator: ConfidenceCalibrator;
    delivery: AdaptiveDeliveryManager;
  };

  // Performance optimizer
  private performanceOptimizer: PerformanceOptimizer;

  // Configuration
  private confidenceConfig = {
    complexityThresholds: {
      simple: 3,
      medium: 7,
    },
    processingTimeouts: {
      simple: 5000,
      medium: 30000,
      complex: 120000,
    },
    fallbackEnabled: true,
  };

  constructor(config: MasterOrchestratorConfig) {
    super();
    logger.info(
      "Initializing ConfidenceMasterOrchestrator",
      "CONFIDENCE_ORCHESTRATOR",
      { config },
    );

    // Initialize performance optimizer first
    this.performanceOptimizer = new PerformanceOptimizer({
      enableCache: true,
      cacheSize: 500,
      cacheTTL: 300000, // 5 minutes
      enableBatching: true,
      batchSize: 5,
      batchTimeout: 100,
      enableModelSwitching: true,
      cpuThreshold: 0.8,
      memoryThreshold: 0.85,
    });

    // Initialize LLM with model selection based on configuration
    // Default to complex model (granite3.3:2b) for main orchestrator
    const defaultModel = MODEL_CONFIGS.COMPLEX.model;
    this.llm = new OllamaProvider({
      model: config.model || defaultModel,
      baseUrl: config.ollamaUrl,
      temperature: MODEL_CONFIGS.COMPLEX.temperature,
      maxTokens: MODEL_CONFIGS.COMPLEX.maxTokens,
    });

    // Initialize core systems
    this.agentRegistry = new AgentRegistry();
    this.ragSystem = new RAGSystem(config.rag || this.getDefaultRAGConfig());
    this.planExecutor = new PlanExecutor(this.agentRegistry, this.ragSystem);
    this.enhancedParser = new EnhancedParser(this.llm);
    this.agentRouter = new AgentRouter(this.llm);

    // Initialize confidence scoring components
    const vectorStore = new VectorStore();
    this.confidenceRAG = {
      analyzer: new QueryComplexityAnalyzer(),
      retriever: new ConfidenceRAGRetriever(vectorStore),
      contextBuilder: new ConfidenceContextBuilder(),
      generator: new ConfidenceResponseGenerator(this.llm),
      evaluator: new MultiModalEvaluator(),
      calibrator: new ConfidenceCalibrator(),
      delivery: new AdaptiveDeliveryManager(),
    };

    logger.info(
      "ConfidenceMasterOrchestrator initialized successfully",
      "CONFIDENCE_ORCHESTRATOR",
    );
  }

  async initialize(): Promise<void> {
    // Initialize RAG system
    try {
      await this.ragSystem.initialize();
      logger.info("RAG system initialized", "CONFIDENCE_ORCHESTRATOR");
    } catch (error) {
      logger.warn(
        "RAG initialization failed, continuing with limited functionality",
        "CONFIDENCE_ORCHESTRATOR",
        { error: (error as Error).message },
      );
    }

    // Initialize agents
    await this.agentRegistry.initialize();

    // Load calibration parameters if available
    await this.loadCalibrationParameters();

    logger.info(
      "ConfidenceMasterOrchestrator fully initialized",
      "CONFIDENCE_ORCHESTRATOR",
    );
  }

  async processQuery(query: Query): Promise<ConfidenceOrchestratorResult> {
    const perf = this.perfMonitor.start("processQuery");
    const startTime = Date.now();

    logger.info(
      "Processing query with confidence scoring",
      "CONFIDENCE_ORCHESTRATOR",
      {
        query: query.text.substring(0, 100),
        conversationId: query.conversationId,
      },
    );

    try {
      // Step 1: Analyze query complexity (with caching)
      const complexityCacheKey = this.performanceOptimizer.generateQueryKey(
        `complexity:${query.text}`,
      );

      const complexity = await this.performanceOptimizer.withCache(
        complexityCacheKey,
        async () => this.confidenceRAG.analyzer.assessComplexity(query.text),
        60000, // Cache for 1 minute
      );

      this.emit("confidence:update", {
        stage: "query-analysis",
        confidence: complexity.score / 10,
        details: complexity,
      });

      logger.info("Query complexity assessed", "CONFIDENCE_ORCHESTRATOR", {
        score: complexity.score,
        factors: complexity.factors,
      });

      // Step 2: Select model based on complexity and system load
      const systemLoad = this.performanceOptimizer.getSystemLoad();
      const modelConfig = selectModel(query.text, {
        urgency: query.metadata?.urgency || "normal",
        accuracy: query.metadata?.accuracy || "normal",
      });

      // Apply system load adjustments
      const adjustedModelConfig = getModelForSystemLoad(
        modelConfig,
        systemLoad,
      );

      // Switch model if different from current
      if (adjustedModelConfig.model !== this.llm.config.model) {
        logger.info(
          "Switching model based on complexity and system load",
          "CONFIDENCE_ORCHESTRATOR",
          {
            from: this.llm.config.model,
            to: adjustedModelConfig.model,
            complexity: complexity.score,
            systemLoad,
          },
        );
        this.llm = new OllamaProvider({
          model: adjustedModelConfig.model,
          baseUrl: this.llm.config.baseUrl,
          temperature: adjustedModelConfig.temperature,
          maxTokens: adjustedModelConfig.maxTokens,
        });
      }

      // Step 3: Route based on complexity
      let result: ConfidenceOrchestratorResult;

      if (
        complexity.score <= this.confidenceConfig.complexityThresholds.simple
      ) {
        result = await this.handleSimpleQuery(query, complexity);
      } else if (
        complexity.score <= this.confidenceConfig.complexityThresholds.medium
      ) {
        result = await this.handleConfidenceRAG(query, complexity);
      } else {
        result = await this.handleComplexAgentTask(query, complexity);
      }

      // Emit final result
      this.emit("processing:complete", {
        query: query.text,
        confidence: result.confidence,
        processingPath: result.processingPath,
        duration: Date.now() - startTime,
      });

      perf.end({ success: true, confidence: result.confidence });
      return result;
    } catch (error) {
      logger.error(
        "Query processing failed",
        "CONFIDENCE_ORCHESTRATOR",
        { query: query.text },
        error as Error,
      );

      perf.end({ success: false });

      // Return fallback response
      return this.createFallbackResponse(query, error as Error);
    }
  }

  /**
   * Handle simple queries with direct response
   */
  private async handleSimpleQuery(
    query: Query,
    _complexity: any,
  ): Promise<ConfidenceOrchestratorResult> {
    logger.info("Handling simple query", "CONFIDENCE_ORCHESTRATOR");

    // Use simple model for quick responses
    const simpleModel = new OllamaProvider({
      model: MODEL_CONFIGS.SIMPLE.model,
      baseUrl: this.llm.config.baseUrl,
      temperature: MODEL_CONFIGS.SIMPLE.temperature,
      maxTokens: MODEL_CONFIGS.SIMPLE.maxTokens,
    });

    // Generate direct response
    const response = await simpleModel.generate(
      `Answer this simple question concisely: ${query.text}`,
      {
        temperature: MODEL_CONFIGS.SIMPLE.temperature,
        maxTokens: MODEL_CONFIGS.SIMPLE.maxTokens,
      },
    );

    // Quick evaluation
    const _evaluation = this.confidenceRAG.evaluator.quickEvaluate(
      query.text,
      response,
      0.85, // High base confidence for simple queries
    );

    // Deliver response
    const delivered = await this.confidenceRAG.delivery.deliver(_evaluation, {
      includeConfidenceScore: true,
      confidenceFormat: "percentage",
    });

    return this.createOrchestratorResult(response, delivered, "simple-query");
  }

  /**
   * Handle medium complexity queries with confidence RAG
   */
  private async handleConfidenceRAG(
    query: Query,
    _complexity: any,
  ): Promise<ConfidenceOrchestratorResult> {
    logger.info("Handling with confidence RAG", "CONFIDENCE_ORCHESTRATOR");

    // Step 1: Retrieve relevant documents (with caching)
    const retrievalCacheKey = this.performanceOptimizer.generateQueryKey(
      `retrieval:${query.text}`,
    );

    const retrieval = await this.performanceOptimizer.withCache(
      retrievalCacheKey,
      async () =>
        this.confidenceRAG.retriever.retrieve(query.text, {
          topK: 5,
          minConfidence: 0.6,
        }),
      180000, // Cache for 3 minutes
    );

    this.emit("confidence:update", {
      stage: "retrieval",
      confidence: retrieval.averageConfidence,
      details: { documentsFound: retrieval.documents.length },
    });

    // Optimize document selection
    const optimizedDocs = await this.performanceOptimizer.optimizeRetrieval(
      retrieval.documents,
      5,
    );

    // Step 2: Build context
    const context = this.confidenceRAG.contextBuilder.buildContext(
      optimizedDocs,
      query.text,
      { mode: "unified", includeConfidence: true },
    );

    // Step 3: Generate response with confidence
    const generation =
      await this.confidenceRAG.generator.generateWithConfidence({
        query: query.text,
        retrievedDocuments: retrieval.documents,
        complexity: _complexity.score,
        context,
      });

    this.emit("confidence:update", {
      stage: "generation",
      confidence: generation.rawConfidence,
      details: { tokenCount: generation.tokenConfidence.length },
    });

    // Step 4: Evaluate response
    const evaluation = await this.confidenceRAG.evaluator.evaluate(
      query.text,
      generation.response,
      retrieval.documents,
      generation.tokenConfidence,
    );

    this.emit("evaluation:complete", {
      factuality: evaluation.factualityScore,
      relevance: evaluation.relevanceScore,
      coherence: evaluation.coherenceScore,
      overall: evaluation.overallConfidence,
      action: evaluation.recommendedAction,
    });

    // Step 5: Apply calibration
    const calibrated = this.confidenceRAG.calibrator.calibrate(
      evaluation.overallConfidence,
      { method: "temperature_scaling" },
    );

    evaluation.overallConfidence = calibrated.calibratedScore;

    // Step 6: Deliver response
    const delivered = await this.confidenceRAG.delivery.deliver(evaluation, {
      includeConfidenceScore: true,
      includeSourceAttribution: true,
      includeUncertaintyWarnings: true,
      includeEvidence: true,
      confidenceFormat: "detailed",
    });

    return this.createOrchestratorResult(
      generation.response,
      delivered,
      "confidence-rag",
    );
  }

  /**
   * Handle complex queries with full agent orchestration
   */
  private async handleComplexAgentTask(
    query: Query,
    _complexity: any,
  ): Promise<ConfidenceOrchestratorResult> {
    logger.info(
      "Handling complex query with agents",
      "CONFIDENCE_ORCHESTRATOR",
    );

    // Use enhanced parser for query analysis
    const queryAnalysis = await this.enhancedParser.parseQuery(query);

    // Create agent routing plan
    const routingPlan = await this.agentRouter.createRoutingPlan(queryAnalysis);

    // Create and execute plan
    const plan = await this.createEnhancedPlan(
      query,
      queryAnalysis,
      routingPlan,
    );
    const executionResult = await this.planExecutor.execute(plan);

    // Format agent results
    const consolidatedResponse = this.consolidateAgentResults(executionResult);

    // Evaluate the consolidated response
    const evaluation = await this.confidenceRAG.evaluator.evaluate(
      query.text,
      consolidatedResponse,
      [], // No direct sources for agent responses
      [], // No token confidence for agent responses
    );

    // Add agent-specific confidence adjustments
    const agentConfidence = this.calculateAgentConfidence(executionResult);
    evaluation.overallConfidence =
      (evaluation.overallConfidence + agentConfidence) / 2;

    // Deliver response
    const delivered = await this.confidenceRAG.delivery.deliver(evaluation, {
      includeConfidenceScore: true,
      includeUncertaintyWarnings: true,
      confidenceFormat: "detailed",
    });

    return this.createOrchestratorResult(
      consolidatedResponse,
      delivered,
      "agent-orchestration",
    );
  }

  /**
   * Create enhanced plan for complex queries
   */
  private async createEnhancedPlan(
    query: Query,
    analysis: QueryAnalysis,
    routingPlan: AgentRoutingPlan,
  ): Promise<Plan> {
    // Use SimplePlanGenerator for performance if enabled
    if (process.env["USE_SIMPLE_PLAN"] !== "false") {
      return SimplePlanGenerator.createSimplePlan(query, routingPlan);
    }

    // Otherwise create confidence-aware plan
    const prompt = `
      Create a plan for this complex query with confidence scoring in mind:
      "${query.text}"
      
      Query Analysis:
      - Intent: ${analysis.intent}
      - Complexity: ${analysis.complexity}/10
      - Domains: ${analysis.domains.join(", ")}
      - Priority: ${analysis.priority}
      
      Agent Routing:
      - Selected agents: ${routingPlan.selectedAgents
        .map((a) => `${a.agentType} (confidence: ${a.confidence})`)
        .join(", ")}
      - Strategy: ${routingPlan.executionStrategy}
      - Overall confidence: ${routingPlan.confidence}
      
      Create a plan that maximizes confidence by:
      1. Using the most confident agents for critical tasks
      2. Including verification steps
      3. Gathering supporting evidence
      
      Return JSON format with confidence-aware steps.
    `;

    const response = await this.llm.generate(prompt, {
      format: "json",
      temperature: 0.3,
      maxTokens: 2000,
    });

    return this.parsePlan(response, query);
  }

  /**
   * Parse plan from LLM response
   */
  private parsePlan(response: string, query: Query): Plan {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        id: `plan-${Date.now()}`,
        steps: parsed.steps || [],
      };
    } catch (error) {
      logger.error(
        "Failed to parse plan",
        "CONFIDENCE_ORCHESTRATOR",
        {},
        error as Error,
      );
      // Create a simple fallback plan
      return {
        id: `plan-fallback-${Date.now()}`,
        steps: [
          {
            id: "1",
            title: "Process query",
            description: "Process the user query with available agents",
            agentType: "ResearchAgent",
            input: { query: query.text },
            dependencies: [],
            tools: [],
          },
        ],
      };
    }
  }

  /**
   * Consolidate results from multiple agents
   */
  private consolidateAgentResults(executionResult: ExecutionResult): string {
    const sections = executionResult.results
      .filter((r) => r.success && r.output)
      .map((r) => {
        const agentName = r.metadata?.agentType || "Unknown Agent";
        return `## ${agentName} Results\n\n${r.output}`;
      });

    return sections.join("\n\n");
  }

  /**
   * Calculate confidence based on agent execution
   */
  private calculateAgentConfidence(executionResult: ExecutionResult): number {
    const results = executionResult.results;
    if (results.length === 0) return 0.5;

    const successRate =
      results.filter((r) => r.success).length / results.length;
    const avgStepConfidence =
      results
        .filter((r) => r.metadata?.confidence)
        .reduce((sum, r) => sum + (r.metadata.confidence || 0), 0) /
      results.length;

    return successRate * 0.6 + avgStepConfidence * 0.4;
  }

  /**
   * Create fallback response for errors
   */
  private createFallbackResponse(
    query: Query,
    error: Error,
  ): ConfidenceOrchestratorResult {
    const evaluation: ResponseEvaluationResult = {
      overallConfidence: 0,
      qualityMetrics: { factuality: 0, relevance: 0, coherence: 0 },
      factualityScore: 0,
      relevanceScore: 0,
      coherenceScore: 0,
      recommendedAction: ActionType.FALLBACK,
      humanReviewNeeded: true,
      query: query.text,
      response: "",
      id: `eval-fallback-${Date.now()}`,
    };

    const delivered: DeliveredResponse = {
      content: this.getErrorFallbackMessage(error),
      confidence: { score: 0, category: "very_low", display: "Error" },
      warnings: ["System error occurred"],
      metadata: {
        action: ActionType.FALLBACK,
        humanReviewNeeded: true,
        uncertaintyAreas: ["entire_response"],
        processingTime: 0,
      },
      feedbackId: `feedback-error-${Date.now()}`,
    };

    return {
      results: [],
      summary: delivered.content,
      confidence: 0,
      deliveredResponse: delivered,
      processingPath: "simple-query",
      feedbackId: delivered.feedbackId,
      metadata: { error: error.message },
    };
  }

  /**
   * Get error-specific fallback message
   */
  private getErrorFallbackMessage(error: Error): string {
    if (error.message.includes("timeout")) {
      return "I apologize, but the request timed out. This might be due to system load. Please try again with a simpler question or break down your request into smaller parts.";
    }

    if (error.message.includes("model")) {
      return "I'm having trouble accessing the AI model at the moment. Please ensure the system is properly configured and try again.";
    }

    return "I encountered an unexpected error while processing your request. Please try rephrasing your question or contact support if the issue persists.";
  }

  /**
   * Create orchestrator result
   */
  private createOrchestratorResult(
    response: string,
    delivered: DeliveredResponse,
    processingPath: ConfidenceOrchestratorResult["processingPath"],
  ): ConfidenceOrchestratorResult {
    return {
      results: [
        {
          success: true,
          output: response,
          metadata: {
            confidence: delivered.confidence.score,
            action: delivered.metadata.action,
          },
        },
      ],
      summary: delivered.content,
      confidence: delivered.confidence.score,
      deliveredResponse: delivered,
      processingPath,
      feedbackId: delivered.feedbackId,
      metadata: {
        processingPath,
        humanReviewNeeded: delivered.metadata.humanReviewNeeded,
      },
    };
  }

  /**
   * Capture user feedback
   */
  captureFeedback(feedbackId: string, feedback: any): void {
    this.confidenceRAG.delivery.captureFeedback(feedbackId, feedback);

    // Update calibration if positive feedback
    if (feedback.helpful && feedback.accurate) {
      const history = this.confidenceRAG.delivery.exportHistory();
      const delivery = history.find((d) => d.feedbackId === feedbackId);

      if (delivery) {
        this.confidenceRAG.calibrator.trainCalibration(
          [
            {
              predictedConfidence: delivery.confidence.score,
              actualAccuracy: 0.9, // High accuracy based on positive feedback
            },
          ],
          "temperature_scaling",
        );
      }
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return {
      delivery: this.confidenceRAG.delivery.getDeliveryStats(),
      calibration: this.confidenceRAG.calibrator.getDiagnostics(),
      performance: this.perfMonitor.getStats(),
      optimization: this.performanceOptimizer.getStatistics(),
    };
  }

  /**
   * Load calibration parameters
   */
  private async loadCalibrationParameters(): Promise<void> {
    // In production, load from database or file
    // For now, use default parameters
    logger.info("Loading calibration parameters", "CONFIDENCE_ORCHESTRATOR");
  }

  /**
   * Save calibration parameters
   */
  async saveCalibrationParameters(): Promise<void> {
    const params = this.confidenceRAG.calibrator.exportParameters();
    // In production, save to database or file
    logger.info("Saving calibration parameters", "CONFIDENCE_ORCHESTRATOR", {
      params,
    });
  }

  /**
   * Get default RAG configuration
   */
  private getDefaultRAGConfig() {
    return {
      vectorStore: {
        type: "chromadb" as const,
        path: "./data/chroma",
        collectionName: "confidence-rag",
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
        reranking: true,
      },
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.info(
      "Cleaning up ConfidenceMasterOrchestrator",
      "CONFIDENCE_ORCHESTRATOR",
    );

    // Cleanup performance optimizer
    this.performanceOptimizer.cleanup();

    // Save calibration parameters before cleanup
    await this.saveCalibrationParameters();

    // Clear event listeners
    this.removeAllListeners();

    logger.info("Cleanup complete", "CONFIDENCE_ORCHESTRATOR");
  }
}
