import { LLMProviderManager } from "../llm/LLMProviderManager.js";
import { AgentRegistry } from "../agents/registry/AgentRegistry.js";
import { RAGSystem } from "../rag/RAGSystem.js";
import { PlanExecutor } from "./PlanExecutor.js";
import { PlanReviewer } from "./PlanReviewer.js";
import { EnhancedParser } from "./EnhancedParser.js";
import { AgentRouter } from "./AgentRouter.js";
import { SimplePlanGenerator } from "./SimplePlanGenerator.js";
import { logger, createPerformanceMonitor } from "../../utils/logger.js";
import { wsService } from "../../api/services/WebSocketService.js";
import { withTimeout, DEFAULT_TIMEOUTS, TimeoutError, } from "../../utils/timeout.js";
export class MasterOrchestrator {
    llm = null;
    config;
    agentRegistry;
    ragSystem;
    planExecutor;
    planReviewer;
    enhancedParser = null;
    agentRouter;
    perfMonitor = createPerformanceMonitor("MasterOrchestrator");
    constructor(config) {
        logger.info("Initializing MasterOrchestrator", "ORCHESTRATOR", { config });
        this.config = config;
        this.agentRegistry = new AgentRegistry();
        // Use default RAG config if not provided (optimized for email processing)
        const ragConfig = config.rag || {
            vectorStore: {
                type: "adaptive", // Use adaptive store for better fallback handling
                baseUrl: process.env.CHROMADB_URL || "http://localhost:8000",
                collectionName: process.env.CHROMADB_COLLECTION || "email-rag-collection",
                dimension: 4096, // Match Llama 3.2:3b embedding dimensions
            },
            chunking: {
                size: 1000, // Larger chunks for email content
                overlap: 100, // More overlap for context preservation
                method: "sentence",
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
    async initializeLLMProvider() {
        try {
            // Use the new LLMProviderManager
            this.llm = new LLMProviderManager();
            await this.llm.initialize();
            const llmManager = this.llm;
            logger.info("LLM provider initialized successfully", "ORCHESTRATOR", {
                isUsingFallback: llmManager.isUsingFallback(),
                modelInfo: this.llm.getModelInfo()
            });
        }
        catch (error) {
            logger.warn(`LLM initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}. System will use fallback responses.`, "ORCHESTRATOR");
            // Don't fail initialization - the system can work with limited functionality
            this.llm = null;
        }
    }
    async initialize() {
        // Initialize LLM provider using new manager
        await this.initializeLLMProvider();
        // Initialize EnhancedParser now that LLM is available
        if (this.llm) {
            this.enhancedParser = new EnhancedParser(this.llm);
        }
        // Initialize RAG system (gracefully handle ChromaDB failures)
        if (this.ragSystem) {
            try {
                await this.ragSystem.initialize();
                // Check if we're using fallback mode
                const ragHealth = await this.ragSystem.getHealthStatus();
                if (ragHealth?.vectorStore?.fallbackUsed) {
                    logger.info("RAG system initialized with in-memory fallback - ChromaDB unavailable but system operational", "ORCHESTRATOR");
                }
                else {
                    logger.info("RAG system initialized successfully with ChromaDB", "ORCHESTRATOR");
                }
            }
            catch (error) {
                logger.warn(`RAG system initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}. Continuing without RAG capabilities.`, "ORCHESTRATOR");
                // Don't fail initialization - the system can work without RAG
                // Set ragSystem to null to prevent usage attempts
                this.ragSystem = null;
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
    async isInitialized() {
        return true; // For health checks
    }
    async processEmail(email) {
        const perf = this.perfMonitor.start("processEmail");
        logger.info("Processing email through agent system", "ORCHESTRATOR", {
            emailId: email.id,
            subject: email.subject?.substring(0, 100),
        });
        try {
            // Create email analysis query
            const query = {
                text: `Analyze this email for business intelligence:\n\nSubject: ${email.subject}\nFrom: ${email.from?.emailAddress?.address}\nBody: ${(email.body || email.bodyPreview || '').substring(0, 2000)}`,
                conversationId: email.id,
                metadata: { email, task: 'email_analysis' }
            };
            // Process through standard agent pipeline
            const result = await this.processQuery(query);
            // Convert ExecutionResult to EmailAnalysisResult
            return this.convertToEmailAnalysis(result, email);
        }
        catch (error) {
            logger.error("Email processing failed", "ORCHESTRATOR", { emailId: email.id }, error);
            perf.end({ success: false });
            throw error;
        }
    }
    convertToEmailAnalysis(result, email) {
        // Extract analysis data from agent results
        const agentData = result.results.find((r) => r.agent === 'EmailAnalysisAgent')?.data;
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
                    contacts: agentData?.entities?.customers?.map((c) => ({ name: c, type: 'external' })) || []
                },
                actionItems: agentData?.suggestedActions?.map((action) => ({
                    type: 'action',
                    description: action,
                    priority: agentData?.priority || 'Medium',
                    slaHours: this.getSlaHours(agentData?.priority || 'Medium'),
                    slaStatus: 'on-track'
                })) || [],
                workflowState: {
                    current: agentData?.workflowState || 'New',
                    suggestedNext: this.getNextState(agentData?.workflowState || 'New'),
                    blockers: []
                },
                businessImpact: {
                    customerSatisfaction: 'medium',
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
    getSlaHours(priority) {
        switch (priority) {
            case 'Critical': return 4;
            case 'High': return 24;
            case 'Medium': return 72;
            case 'Low': return 168;
            default: return 72;
        }
    }
    getNextState(currentState) {
        const stateTransitions = {
            'New': 'In Review',
            'In Review': 'In Progress',
            'In Progress': 'Pending External',
            'Pending External': 'Completed'
        };
        return stateTransitions[currentState] || 'In Review';
    }
    async processQuery(query) {
        const perf = this.perfMonitor.start("processQuery");
        logger.info("Processing query", "ORCHESTRATOR", {
            query: query?.text?.substring(0, 100),
            conversationId: query.conversationId,
        });
        try {
            // Step 0: Enhanced query analysis with timeout
            let queryAnalysis;
            if (this.enhancedParser) {
                queryAnalysis = await withTimeout(this.enhancedParser.parseQuery(query), DEFAULT_TIMEOUTS.QUERY_PROCESSING, "Query analysis timed out");
            }
            else {
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
            // Step 0.5: Create intelligent agent routing plan with timeout
            const routingPlan = await withTimeout(this.agentRouter.routeQuery(queryAnalysis), DEFAULT_TIMEOUTS.PLAN_CREATION, "Agent routing plan creation timed out");
            logger.info("Agent routing plan created", "ORCHESTRATOR", {
                primaryAgent: routingPlan.primaryAgent,
                strategy: routingPlan.executionStrategy,
                confidence: routingPlan.confidence,
                fallbackAgents: routingPlan.fallbackAgents?.length || 0,
            });
            // Step 1: Create initial plan with enhanced context and timeout
            logger.info("Starting plan creation", "ORCHESTRATOR");
            let plan = await withTimeout(this.createPlan(query, queryAnalysis, routingPlan), DEFAULT_TIMEOUTS.PLAN_CREATION, "Plan creation timed out");
            logger.info("Plan created successfully", "ORCHESTRATOR", {
                steps: plan?.steps?.length,
            });
            // Broadcast plan creation
            wsService.broadcastPlanUpdate(plan.id, "created", {
                completed: 0,
                total: plan.steps.length,
            });
            // Step 2: Execute plan with replan loop
            let executionResult = {
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
                logger.debug(`Executing plan (attempt ${attempts + 1}/${maxAttempts})`, "ORCHESTRATOR", {
                    stepsCount: plan.steps.length,
                });
                executionResult = await withTimeout(this.planExecutor.execute(plan), DEFAULT_TIMEOUTS.AGENT_EXECUTION, "Plan execution timed out");
                // Step 3: Review execution results with timeout
                const review = await withTimeout(this.planReviewer.reviewPlan(plan), DEFAULT_TIMEOUTS.PLAN_CREATION, "Plan review timed out");
                logger.debug("Plan review completed", "ORCHESTRATOR", {
                    satisfactory: review.approved || review.satisfactory,
                    attempts: attempts + 1,
                });
                if (!review.approved &&
                    !review.satisfactory &&
                    attempts < maxAttempts) {
                    // Check if failures are only infrastructure-related
                    const hasOnlyInfrastructureFailures = review?.failedSteps?.length === 0 &&
                        review?.feedback?.includes("infrastructure limitations");
                    if (hasOnlyInfrastructureFailures) {
                        logger.info("Skipping replan due to infrastructure limitations", "ORCHESTRATOR", {
                            feedback: review.feedback,
                        });
                        break;
                    }
                    // Step 4: Replan if necessary
                    logger.info("Replanning due to unsatisfactory results", "ORCHESTRATOR", {
                        feedback: review.feedback,
                        failedSteps: review.failedSteps,
                    });
                    plan = await withTimeout(this.replan(query, plan, review, queryAnalysis), DEFAULT_TIMEOUTS.PLAN_CREATION, "Replanning timed out");
                    attempts++;
                }
                else {
                    break;
                }
            } while (attempts < maxAttempts);
            // Step 5: Format and return final response
            const result = this.formatResponse(executionResult);
            logger.info("Query processing completed", "ORCHESTRATOR", {
                success: result.metadata?.["successfulSteps"] ===
                    result.metadata?.["totalSteps"],
                attempts: attempts + 1,
                totalSteps: result.metadata?.["totalSteps"],
            });
            perf.end({ success: true });
            return result;
        }
        catch (error) {
            if (error instanceof TimeoutError) {
                logger.error("Query processing timed out", "ORCHESTRATOR", {
                    query: query.text,
                    duration: error.duration,
                    message: error.message,
                }, error);
                // Return a timeout response instead of throwing
                return {
                    success: false,
                    results: [],
                    summary: "I apologize, but processing your request took too long. This can happen with complex queries or when the system is under heavy load. Please try simplifying your request or try again later.",
                    metadata: {
                        error: "timeout",
                        duration: error.duration,
                        timestamp: new Date().toISOString(),
                    },
                };
            }
            logger.error("Query processing failed", "ORCHESTRATOR", { query: query.text }, error);
            perf.end({ success: false });
            throw error;
        }
    }
    async createPlan(query, analysis, routingPlan) {
        // Use simple plan generator only as fallback or when explicitly requested
        const USE_SIMPLE_PLAN = process.env["USE_SIMPLE_PLAN"] === "true"; // Changed default to false
        const isComplexQuery = this.isComplexQuery(query, analysis);
        // Use LLM for complex queries unless simple plan is forced
        if (USE_SIMPLE_PLAN && !isComplexQuery) {
            logger.info("Using simple plan generator for basic query", "ORCHESTRATOR");
            return SimplePlanGenerator.createSimplePlan(query, routingPlan);
        }
        // For complex queries, always try LLM first
        if (isComplexQuery && !this.llm) {
            logger.warn("Complex query detected but LLM unavailable, using enhanced simple plan", "ORCHESTRATOR");
            return SimplePlanGenerator.createMultiAgentPlan(query, routingPlan, analysis);
        }
        // Retrieve relevant context from RAG system
        let ragContext = "";
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
        }
        catch (error) {
            logger.warn(`Failed to retrieve RAG context: ${error instanceof Error ? error.message : "Unknown error"}`, "ORCHESTRATOR");
        }
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
      - Selected agents: ${routingPlan?.selectedAgents?.map((a) => `${a.agentType} (priority: ${a.priority}, confidence: ${a.confidence})`).join(", ")}
      - Execution strategy: ${routingPlan.executionStrategy}
      - Overall confidence: ${routingPlan.confidence}
      - Risk level: ${routingPlan?.riskAssessment?.level}
      - Risk factors: ${routingPlan?.riskAssessment?.factors?.join(", ") || 'None'}
      - Fallback agents available: ${routingPlan?.fallbackAgents?.join(", ") || 'None'}
    `
            : "";
        const prompt = `
      You are the Master Orchestrator. Create a detailed plan to address this query:
      "${query.text}"${analysisContext}${routingContext}${ragContext}
      
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
        const llamaResponse = await withTimeout(this.llm.generate(prompt, {
            format: "json",
            temperature: 0.3,
            maxTokens: 2000,
        }), DEFAULT_TIMEOUTS.LLM_GENERATION, "LLM generation timed out during plan creation");
        return this.parsePlan(llamaResponse.response, query);
    }
    async replan(query, originalPlan, review, analysis) {
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
        const llamaResponse = await withTimeout(this.llm.generate(prompt, {
            format: "json",
            temperature: 0.3,
            maxTokens: 2000,
        }), DEFAULT_TIMEOUTS.LLM_GENERATION, "LLM generation timed out during replanning");
        return this.parsePlan(llamaResponse.response, query);
    }
    parsePlan(response, query) {
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
                steps: parsed.steps.map((step) => ({
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
        }
        catch (error) {
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
    isComplexQuery(query, analysis) {
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
        const hasMultiStepKeywords = multiStepIndicators.some(indicator => queryText.includes(indicator));
        return hasCrossDomain || isHighComplexity || hasMultipleEntities ||
            isLongQuery || hasMultiStepKeywords;
    }
    formatResponse(executionResult) {
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
