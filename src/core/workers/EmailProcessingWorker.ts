/**
 * Email Processing Worker
 *
 * Runs in a worker thread to process emails using the three-phase analysis system.
 * Implements batching, connection pooling, and efficient memory management.
 */

import { parentPort, workerData } from "worker_threads";
import { Agent } from "http";
import { Ollama } from "ollama";
import Database from "better-sqlite3";
import { z } from "zod";
import { Logger } from "../../utils/logger.js";
import type {
  EmailProcessingJob,
  EmailJobData,
} from "./EmailProcessingWorkerPool.js";

const logger = new Logger(`Worker-${workerData.workerId}`);

// ============================================
// TYPE DEFINITIONS
// ============================================

const Phase2ResponseSchema = z.object({
  workflow_validation: z.string(),
  missed_entities: z.object({
    project_names: z.array(z.string()),
    company_names: z.array(z.string()),
    people: z.array(z.string()),
    products: z.array(z.string()),
    technical_specs: z.array(z.string()),
    locations: z.array(z.string()),
    other_references: z.array(z.string()),
  }),
  action_items: z.array(
    z.object({
      task: z.string(),
      owner: z.string(),
      deadline: z.string(),
      revenue_impact: z.string().optional(),
    }),
  ),
  risk_assessment: z.string(),
  initial_response: z.string(),
  confidence: z.number().min(0).max(1),
  business_process: z.string(),
  extracted_requirements: z.array(z.string()),
});

const Phase3ResponseSchema = z.object({
  strategic_insights: z.object({
    opportunity: z.string(),
    risk: z.string(),
    relationship: z.string(),
  }),
  executive_summary: z.string(),
  escalation_needed: z.boolean(),
  revenue_impact: z.string(),
  cross_email_patterns: z.array(z.string()).optional(),
  workflow_intelligence: z.object({
    predicted_next_steps: z.array(z.string()),
    bottleneck_risks: z.array(z.string()),
    optimization_opportunities: z.array(z.string()),
  }),
});

type Phase2Response = z.infer<typeof Phase2ResponseSchema>;
type Phase3Response = z.infer<typeof Phase3ResponseSchema>;

interface BatchPrompt {
  id: string;
  prompt: string;
  emailId: string;
}

interface OllamaConnection {
  instance: Ollama;
  lastUsed: number;
  requestCount: number;
}

// ============================================
// WORKER IMPLEMENTATION
// ============================================

class EmailProcessingWorker {
  private workerId: string;
  private db: Database.Database;
  private ollamaPool: Map<string, OllamaConnection> = new Map();
  private maxOllamaConnections = 3;
  private connectionIndex = 0;
  private memoryCheckInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private processedCount = 0;
  private failedCount = 0;
  private startTime = Date.now();

  constructor() {
    this.workerId = workerData.workerId;

    try {
      // Initialize database with error handling
      this.db = new Database("./data/crewai_enhanced.db", { readonly: false });
      this.initialize();
    } catch (error) {
      logger.error("Failed to initialize worker:", error as string);

      // Send error to parent
      if (parentPort) {
        parentPort.postMessage({
          type: "error",
          error: {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          workerId: this.workerId,
        });
      }

      // Exit with error code
      process.exit(1);
    }
  }

  /**
   * Initialize the worker
   */
  private initialize(): void {
    logger.info("Worker initializing...");

    // Configure SQLite for better performance
    this?.db?.pragma("journal_mode = WAL");
    this?.db?.pragma("synchronous = NORMAL");
    this?.db?.pragma("cache_size = 10000");
    this?.db?.pragma("temp_store = MEMORY");

    // Create Ollama connection pool
    this.initializeOllamaPool();

    // Start monitoring
    this.startMemoryMonitoring();
    this.startMetricsReporting();

    // Set up message handlers
    this.setupMessageHandlers();

    logger.info("Worker initialized successfully");

    // Send initialization complete message
    if (parentPort) {
      parentPort.postMessage({
        type: "initialized",
        workerId: this.workerId,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Initialize Ollama connection pool
   */
  private initializeOllamaPool(): void {
    for (let i = 0; i < this.maxOllamaConnections; i++) {
      const connectionId = `conn_${i}`;
      this?.ollamaPool?.set(connectionId, {
        instance: new Ollama({
          host: "http://localhost:11434",
          // Enable keep-alive for connection reuse
          fetch: (url, options) =>
            fetch(url, {
              ...options,
              keepalive: true,
              // @ts-expect-error - Node.js specific option
              agent: new Agent({
                keepAlive: true,
                keepAliveMsecs: 30000,
                maxSockets: 10,
              }),
            }),
        }),
        lastUsed: Date.now(),
        requestCount: 0,
      });
    }
  }

  /**
   * Get an Ollama connection from the pool
   */
  private getOllamaConnection(): OllamaConnection {
    // Round-robin selection
    const connectionId = `conn_${this.connectionIndex % this.maxOllamaConnections}`;
    this.connectionIndex++;

    const connection = this?.ollamaPool?.get(connectionId)!;
    connection.lastUsed = Date.now();
    connection.requestCount++;

    return connection;
  }

  /**
   * Set up message handlers
   */
  private setupMessageHandlers(): void {
    if (!parentPort) return;

    parentPort.on("message", async (message: any) => {
      switch (message.type) {
        case "processJob":
          await this.processJob(message.job, message.jobId);
          break;

        case "shutdown":
          await this.shutdown();
          break;

        case "health":
          parentPort?.postMessage({
            type: "health-response",
            status: "healthy",
            workerId: this.workerId,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            stats: {
              processed: this.processedCount,
              failed: this.failedCount,
              uptime: Date.now() - this.startTime,
            },
          });
          break;

        default:
          logger.warn("Unknown message type:", message.type);
      }
    });
  }

  /**
   * Process a job containing multiple emails
   */
  private async processJob(
    job: EmailProcessingJob,
    jobId: string,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info(`Processing job ${jobId} with ${job?.emails?.length} emails`);

      // Process emails in batches for efficiency
      const batchSize = 5;
      const results = [];

      for (let i = 0; i < job?.emails?.length; i += batchSize) {
        const batch = job?.emails?.slice(i, i + batchSize);
        const batchResults = await this.processBatch(batch, job.options);
        results.push(...batchResults);
      }

      // Save results to database
      await this.saveResults(results);

      const processingTime = Date.now() - startTime;
      this.processedCount += job?.emails?.length;

      // Send completion message
      parentPort?.postMessage({
        type: "jobComplete",
        jobId,
        data: {
          emailCount: job?.emails?.length,
          processingTime,
          results: results?.map((r: any) => ({
            emailId: r.emailId,
            phases: r.phases,
            priority: r.priority,
          })),
        },
      });
    } catch (error) {
      logger.error(`Job ${jobId} failed:`, error as string);
      this.failedCount += job?.emails?.length;

      parentPort?.postMessage({
        type: "jobFailed",
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Process a batch of emails
   */
  private async processBatch(
    emails: EmailJobData[],
    options: EmailProcessingJob["options"],
  ): Promise<any[]> {
    const results = [];

    // Phase 1: Rule-based analysis (parallel)
    const phase1Results = await Promise.all(
      emails?.map((email: any) => this.runPhase1(email)),
    );

    // Phase 2: LLM enhancement (batched)
    const phase2Results = await this.runPhase2Batch(
      emails,
      phase1Results,
      options,
    );

    // Determine which emails need Phase 3
    const phase3Candidates = emails?.filter((email, index) => {
      const chainAnalysis = phase1Results[index].chain_analysis;
      return chainAnalysis?.is_complete_chain || options.forceAllPhases;
    });

    // Phase 3: Strategic analysis (batched for complete chains)
    let phase3Results: any[] = [];
    if (phase3Candidates?.length || 0 > 0) {
      const phase3Indices = emails
        .map((email, index) => (phase3Candidates.includes(email) ? index : -1))
        .filter((i: any) => i >= 0);

      phase3Results = await this.runPhase3Batch(
        phase3Candidates,
        phase3Indices?.map((i: any) => phase1Results[i]),
        phase3Indices?.map((i: any) => phase2Results[i]),
        options,
      );
    }

    // Combine results
    let phase3Index = 0;
    for (let i = 0; i < emails?.length || 0; i++) {
      const email = emails[i];
      const phase1 = phase1Results[i];
      const phase2 = phase2Results[i];

      const isPhase3Email = email ? phase3Candidates.includes(email) : false;
      const result = isPhase3Email
        ? {
            ...phase2,
            ...phase3Results[phase3Index++],
            phases: 3,
          }
        : {
            ...phase2,
            phases: 2,
          };

      results.push({
        emailId: email?.id || 'unknown',
        ...result,
      });
    }

    return results;
  }

  /**
   * Phase 1: Rule-based analysis
   */
  private async runPhase1(email: EmailJobData): Promise<any> {
    const startTime = Date.now();
    const content = `${email.subject} ${email.body}`.toLowerCase();

    // Extract entities using optimized patterns
    const entities = {
      po_numbers: this.extractPattern(content, /\bPO\s*#?\s*(\d{7,12})\b/gi),
      quote_numbers: this.extractPattern(
        content,
        /\bquote\s*#?\s*(\d{6,10})\b/gi,
      ),
      case_numbers: this.extractPattern(
        content,
        /\b(?:case|ticket|sr|inc)\s*#?\s*(\d{6,10})\b/gi,
      ),
      part_numbers: this.extractPartNumbers(content),
      dollar_amounts: this.extractPattern(content, /\$[\d,]+(?:\.\d{2})?/g),
      dates: this.extractDates(content),
      contacts: this.extractContacts(content),
    };

    // Detect workflow state
    const workflow_state = this.detectWorkflowState(content);

    // Calculate urgency and priority
    const urgency_score = this.calculateUrgencyScore(content);
    const priority =
      urgency_score >= 5
        ? "critical"
        : urgency_score >= 3
          ? "high"
          : urgency_score >= 1
            ? "medium"
            : "low";

    // Get chain analysis from database
    const chain_analysis = await this.getChainAnalysis(email.conversation_id);

    return {
      workflow_state,
      priority,
      entities,
      urgency_score,
      financial_impact: this.calculateFinancialImpact(entities.dollar_amounts),
      key_phrases: this.extractKeyPhrases(content),
      sender_category: this.categorizeSender(email.sender_email),
      detected_patterns: this.detectPatterns(content, entities),
      chain_analysis,
      processing_time: Date.now() - startTime,
    };
  }

  /**
   * Phase 2: Batch LLM enhancement
   */
  private async runPhase2Batch(
    emails: EmailJobData[],
    phase1Results: any[],
    options: EmailProcessingJob["options"],
  ): Promise<any[]> {
    const connection = this.getOllamaConnection();
    const results = [];

    // Create batch prompts
    const prompts: BatchPrompt[] = emails?.map((email, index) => ({
      id: `${email.id}_phase2`,
      emailId: email.id,
      prompt: this.buildPhase2Prompt(email, phase1Results[index]),
    }));

    // Process in smaller batches to avoid overwhelming Ollama
    const llmBatchSize = 3;
    for (let i = 0; i < prompts?.length || 0; i += llmBatchSize) {
      const batch = prompts.slice(i, i + llmBatchSize);
      const batchResults = await this.callLlamaBatch(connection, batch, {
        temperature: 0.1,
        num_predict: 1200,
        format: "json",
      });

      // Parse and validate results
      for (let j = 0; j < batchResults?.length || 0; j++) {
        const promptIndex = i + j;
        const response = batchResults[j];

        try {
          const parsed = JSON.parse(response || '{}');
          const validated = Phase2ResponseSchema.parse(parsed);

          results[promptIndex] = {
            ...phase1Results[promptIndex],
            ...validated,
            phase2_processing_time: 0, // Will be calculated
          };
        } catch (error) {
          logger.warn(
            `Phase 2 parsing failed for email ${emails[promptIndex]?.id || 'unknown'}:`,
            error,
          );
          results[promptIndex] = this.getPhase2Fallback(
            phase1Results[promptIndex],
          );
        }
      }
    }

    return results;
  }

  /**
   * Phase 3: Batch strategic analysis
   */
  private async runPhase3Batch(
    emails: EmailJobData[],
    phase1Results: any[],
    phase2Results: any[],
    options: EmailProcessingJob["options"],
  ): Promise<any[]> {
    const connection = this.getOllamaConnection();
    const results = [];

    // Create batch prompts
    const prompts: BatchPrompt[] = emails?.map((email, index) => ({
      id: `${email.id}_phase3`,
      emailId: email.id,
      prompt: this.buildPhase3Prompt(
        email,
        phase1Results[index],
        phase2Results[index],
      ),
    }));

    // Process with Phi-4
    const llmBatchSize = 2; // Smaller batch for larger model
    for (let i = 0; i < prompts?.length || 0; i += llmBatchSize) {
      const batch = prompts.slice(i, i + llmBatchSize);
      const batchResults = await this.callPhiBatch(connection, batch, {
        temperature: 0.3,
        num_predict: 2000,
        format: "json",
      });

      // Parse and validate results
      for (let j = 0; j < batchResults?.length || 0; j++) {
        const promptIndex = i + j;
        const response = batchResults[j];

        try {
          const parsed = JSON.parse(response);
          const validated = Phase3ResponseSchema.parse(parsed);

          results[promptIndex] = {
            ...validated,
            phase3_processing_time: 0, // Will be calculated
          };
        } catch (error) {
          logger.warn(
            `Phase 3 parsing failed for email ${emails[promptIndex]?.id || 'unknown'}:`,
            error,
          );
          results[promptIndex] = this.getPhase3Fallback(
            phase2Results[promptIndex],
          );
        }
      }
    }

    return results;
  }

  /**
   * Call Llama 3.2 with batch prompts
   */
  private async callLlamaBatch(
    connection: OllamaConnection,
    prompts: BatchPrompt[],
    options: any,
  ): Promise<string[]> {
    const results = await Promise.all(
      prompts?.map(async (prompt: any) => {
        try {
          const response = await connection?.instance?.generate({
            model: "llama3.2:3b",
            prompt: prompt.prompt,
            stream: false,
            format: options.format,
            options: {
              temperature: options.temperature,
              num_predict: options.num_predict,
            },
          });
          return response.response;
        } catch (error) {
          logger.error(`Llama call failed for ${prompt.id}:`, error as string);
          return "{}"; // Return empty JSON on error
        }
      }),
    );

    return results;
  }

  /**
   * Call Phi-4 with batch prompts
   */
  private async callPhiBatch(
    connection: OllamaConnection,
    prompts: BatchPrompt[],
    options: any,
  ): Promise<string[]> {
    const results = await Promise.all(
      prompts?.map(async (prompt: any) => {
        try {
          const response = await connection?.instance?.generate({
            model: "doomgrave/phi-4:14b-tools-Q3_K_S",
            prompt: prompt.prompt,
            stream: false,
            format: options.format,
            options: {
              temperature: options.temperature,
              num_predict: options.num_predict,
            },
          });
          return response.response;
        } catch (error) {
          logger.error(`Phi call failed for ${prompt.id}:`, error as string);
          return "{}"; // Return empty JSON on error
        }
      }),
    );

    return results;
  }

  /**
   * Build Phase 2 prompt
   */
  private buildPhase2Prompt(email: EmailJobData, phase1Results: any): string {
    return `Analyze this business email and enhance the initial analysis.

Email:
Subject: ${email.subject}
From: ${email.sender_email}
Date: ${email.received_at}
Body: ${email?.body?.substring(0, 1000)}...

Initial Analysis:
${JSON.stringify(phase1Results, null, 2)}

Provide enhanced analysis in this exact JSON format:
{
  "workflow_validation": "detailed validation of workflow state",
  "missed_entities": {
    "project_names": ["array of project names"],
    "company_names": ["array of company names"],
    "people": ["array of people names"],
    "products": ["array of product names"],
    "technical_specs": ["array of technical specifications"],
    "locations": ["array of locations"],
    "other_references": ["array of other important references"]
  },
  "action_items": [
    {
      "task": "specific task description",
      "owner": "person responsible",
      "deadline": "deadline or urgency",
      "revenue_impact": "potential revenue impact"
    }
  ],
  "risk_assessment": "detailed risk assessment",
  "initial_response": "suggested initial response to this email",
  "confidence": 0.75,
  "business_process": "identified business process",
  "extracted_requirements": ["array of extracted requirements"]
}`;
  }

  /**
   * Build Phase 3 prompt
   */
  private buildPhase3Prompt(
    email: EmailJobData,
    phase1Results: any,
    phase2Results: any,
  ): string {
    return `Provide strategic analysis for this complete email chain.

Email Context:
Subject: ${email.subject}
Chain Type: ${phase1Results.chain_analysis?.chain_type}
Completeness: ${phase1Results.chain_analysis?.completeness_score}%

Current Analysis:
Phase 1: ${JSON.stringify(phase1Results, null, 2)}
Phase 2: ${JSON.stringify(phase2Results, null, 2)}

Provide strategic insights in this exact JSON format:
{
  "strategic_insights": {
    "opportunity": "key business opportunity identified",
    "risk": "primary risk assessment",
    "relationship": "customer relationship analysis"
  },
  "executive_summary": "concise executive summary",
  "escalation_needed": true/false,
  "revenue_impact": "estimated revenue impact",
  "cross_email_patterns": ["patterns identified across the chain"],
  "workflow_intelligence": {
    "predicted_next_steps": ["predicted next steps in workflow"],
    "bottleneck_risks": ["potential bottlenecks"],
    "optimization_opportunities": ["workflow optimization opportunities"]
  }
}`;
  }

  /**
   * Helper methods for entity extraction
   */
  private extractPattern(text: string, pattern: RegExp): string[] {
    const matches = text.match(pattern) || [];
    return [...new Set(matches)];
  }

  private extractPartNumbers(text: string): string[] {
    const patterns = [
      /\b([A-Z0-9]{5,15}(?:[#\-\s]?[A-Z0-9]{1,5})?)\b/g,
      /\b(\d{5,10}[A-Z]{1,3})\b/g,
    ];

    const results = new Set<string>();
    const upperText = text.toUpperCase();

    patterns.forEach((pattern: any) => {
      const matches = upperText.match(pattern) || [];
      matches.forEach((m: any) => {
        if (!m.match(/^(THE|AND|FOR|WITH|FROM|THIS|THAT|HAVE|WILL|BEEN)$/)) {
          results.add(m);
        }
      });
    });

    return Array.from(results).slice(0, 20);
  }

  private extractDates(text: string): string[] {
    const patterns = [
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
      /\b\d{1,2}-\d{1,2}-\d{2,4}\b/g,
      /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/gi,
    ];

    const results = new Set<string>();
    patterns.forEach((pattern: any) => {
      const matches = text.match(pattern) || [];
      matches.forEach((m: any) => results.add(m));
    });

    return Array.from(results);
  }

  private extractContacts(text: string): string[] {
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const phonePattern =
      /\b(\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9})\b/g;

    const results = new Set<string>();
    const emails = text.match(emailPattern) || [];
    const phones = text.match(phonePattern) || [];

    [...emails, ...phones].forEach((contact: any) => results.add(contact));
    return Array.from(results).slice(0, 10);
  }

  /**
   * Workflow state detection
   */
  private detectWorkflowState(content: string): string {
    const stateKeywords = {
      COMPLETION: ["resolved", "completed", "closed", "shipped", "delivered"],
      IN_PROGRESS: ["update", "status", "working on", "in progress"],
      QUOTE_PROCESSING: ["quote", "pricing", "cost"],
      ORDER_MANAGEMENT: ["order", "purchase"],
      SHIPPING: ["ship", "deliver", "tracking"],
      RETURNS: ["return", "rma", "refund"],
    };

    for (const [state, keywords] of Object.entries(stateKeywords)) {
      if (keywords.some((keyword: any) => content.includes(keyword))) {
        return state;
      }
    }

    return "START_POINT";
  }

  /**
   * Calculate urgency score
   */
  private calculateUrgencyScore(content: string): number {
    const urgencyKeywords = [
      { word: "urgent", weight: 2 },
      { word: "critical", weight: 3 },
      { word: "asap", weight: 2 },
      { word: "immediate", weight: 2 },
      { word: "emergency", weight: 3 },
      { word: "escalat", weight: 2 },
      { word: "deadline", weight: 1 },
      { word: "today", weight: 1 },
      { word: "now", weight: 1 },
    ];

    let score = 0;
    urgencyKeywords.forEach(({ word, weight }) => {
      if (content.includes(word)) score += weight;
    });

    return Math.min(score, 10);
  }

  /**
   * Calculate financial impact
   */
  private calculateFinancialImpact(amounts: string[]): number {
    return amounts
      .map((amt: any) => parseFloat(amt.replace(/[$,]/g, "")))
      .filter((amt: any) => !isNaN(amt))
      .reduce((sum: any, amt: any) => sum + amt, 0);
  }

  /**
   * Extract key phrases
   */
  private extractKeyPhrases(content: string): string[] {
    const patterns = [
      /urgent\s+\w+\s+\w+/gi,
      /need\s+\w+\s+by\s+\w+/gi,
      /deadline\s+\w+\s+\w+/gi,
      /critical\s+\w+\s+\w+/gi,
    ];

    const phrases = new Set<string>();
    patterns.forEach((pattern: any) => {
      const matches = content.match(pattern) || [];
      matches.forEach((m: any) => phrases.add(m));
    });

    return Array.from(phrases).slice(0, 10);
  }

  /**
   * Categorize sender
   */
  private categorizeSender(email: string): string {
    const lowerEmail = email.toLowerCase();

    const categories = {
      key_customer: ["insightordersupport", "team4401", "vip@", "executive@"],
      internal: ["@tdsynnex.com", "@synnex.com", "@techdata.com"],
      partner: ["@hp.com", "@dell.com", "@microsoft.com", "@cisco.com"],
    };

    for (const [category, patterns] of Object.entries(categories)) {
      if (patterns.some((pattern: any) => lowerEmail.includes(pattern))) {
        return category;
      }
    }

    return "standard";
  }

  /**
   * Detect patterns
   */
  private detectPatterns(content: string, entities: any): string[] {
    const patterns = [];

    if (entities?.part_numbers?.length > 5) patterns.push("bulk_order");
    if ((content.match(/urgent|asap|critical/gi) || []).length > 2)
      patterns.push("high_urgency");
    if (this.calculateFinancialImpact(entities.dollar_amounts) > 50000)
      patterns.push("high_value");
    if (content.includes("expedite") || content.includes("rush"))
      patterns.push("expedited_processing");
    if (content.includes("cancel") || content.includes("void"))
      patterns.push("cancellation_risk");

    return patterns;
  }

  /**
   * Get chain analysis from database
   */
  private async getChainAnalysis(conversationId: string): Promise<any> {
    try {
      const stmt = this?.db?.prepare(`
        SELECT 
          conversation_id as chain_id,
          COUNT(*) as chain_length,
          MIN(received_date_time) as first_email,
          MAX(received_date_time) as last_email,
          COUNT(DISTINCT sender_email) as participant_count
        FROM emails_enhanced
        WHERE conversation_id = ?
        GROUP BY conversation_id
      `);

      const result = stmt.get(conversationId) as any;
      if (!result) return null;

      // Simple completeness check based on chain length and duration
      const duration =
        new Date(result.last_email).getTime() -
        new Date(result.first_email).getTime();
      const durationDays = duration / (1000 * 60 * 60 * 24);

      const isComplete = result.chain_length >= 3 && durationDays > 0.5;
      const completenessScore = Math.min(
        100,
        result.chain_length * 20 + (durationDays > 1 ? 20 : 0),
      );

      return {
        chain_id: result.chain_id,
        is_complete_chain: isComplete,
        chain_length: result.chain_length,
        completeness_score: completenessScore,
        chain_type: "general", // Would need more analysis for accurate type
        missing_elements: isComplete
          ? []
          : ["Additional correspondence needed"],
      };
    } catch (error) {
      logger.error("Chain analysis failed:", error as string);
      return null;
    }
  }

  /**
   * Get Phase 2 fallback
   */
  private getPhase2Fallback(phase1Results: any): any {
    return {
      ...phase1Results,
      workflow_validation: `Confirmed: ${phase1Results.workflow_state}`,
      missed_entities: {
        project_names: [],
        company_names: [],
        people: [],
        products: [],
        technical_specs: [],
        locations: [],
        other_references: [],
      },
      action_items: [],
      risk_assessment: "Standard risk level",
      initial_response:
        "Thank you for your email. We are processing your request.",
      confidence: 0.5,
      business_process: phase1Results.workflow_state,
      phase2_processing_time: 0,
      extracted_requirements: [],
    };
  }

  /**
   * Get Phase 3 fallback
   */
  private getPhase3Fallback(phase2Results: any): any {
    return {
      strategic_insights: {
        opportunity: "Standard processing opportunity",
        risk: "Low risk",
        relationship: "Stable relationship",
      },
      executive_summary: phase2Results.risk_assessment,
      escalation_needed: phase2Results.priority === "critical",
      revenue_impact: "$0",
      cross_email_patterns: [],
      workflow_intelligence: {
        predicted_next_steps: ["Continue standard processing"],
        bottleneck_risks: ["None identified"],
        optimization_opportunities: ["None identified"],
      },
      phase3_processing_time: 0,
    };
  }

  /**
   * Save results to database
   */
  private async saveResults(results: any[]): Promise<void> {
    const transaction = this?.db?.transaction((results: any[]) => {
      const stmt = this?.db?.prepare(`
        UPDATE emails_enhanced SET
          workflow_state = ?,
          priority = ?,
          confidence_score = ?,
          analyzed_at = ?,
          chain_completeness_score = ?,
          is_chain_complete = ?,
          extracted_entities = ?,
          analysis_phases = ?,
          status = 'analyzed',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      for (const result of results) {
        stmt.run(
          result.workflow_state,
          result.priority,
          result.confidence || 0.5,
          new Date().toISOString(),
          result.chain_analysis?.completeness_score || 0,
          result.chain_analysis?.is_complete_chain ? 1 : 0,
          JSON.stringify(result.entities || {}),
          result.phases,
          result.emailId,
        );
      }
    });

    transaction(results);
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    this.memoryCheckInterval = setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedMB = usage.heapUsed / 1024 / 1024;

      if (heapUsedMB > workerData.maxMemory * 0.9) {
        logger.warn(`High memory usage: ${heapUsedMB.toFixed(2)}MB`);
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      // Report memory metrics
      parentPort?.postMessage({
        type: "metrics",
        data: {
          currentMemoryUsage: heapUsedMB,
          isIdle:
            this.processedCount === 0 || Date.now() - this.startTime > 60000,
        },
      });
    }, 10000); // Every 10 seconds
  }

  /**
   * Start metrics reporting
   */
  private startMetricsReporting(): void {
    this.metricsInterval = setInterval(() => {
      const uptime = Date.now() - this.startTime;
      const throughput =
        uptime > 0 ? this.processedCount / (uptime / 60000) : 0;

      parentPort?.postMessage({
        type: "metrics",
        data: {
          processedJobs: this.processedCount,
          failedJobs: this.failedCount,
          averageProcessingTime: 0, // Would need to track this
          cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
          throughput,
        },
      });
    }, 30000); // Every 30 seconds
  }

  /**
   * Graceful shutdown
   */
  private async shutdown(): Promise<void> {
    logger.info("Worker shutting down...");

    // Clear intervals
    if (this.memoryCheckInterval) clearInterval(this.memoryCheckInterval);
    if (this.metricsInterval) clearInterval(this.metricsInterval);

    // Close database
    this?.db?.close();

    // Clear connection pool
    this?.ollamaPool?.clear();

    logger.info("Worker shutdown complete");
    process.exit(0);
  }
}

// Create and start the worker
const worker = new EmailProcessingWorker();

// Send heartbeat
setInterval(() => {
  parentPort?.postMessage({ type: "heartbeat" });
}, 5000);
