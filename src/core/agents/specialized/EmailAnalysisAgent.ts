import { BaseAgent } from "../base/BaseAgent.js";
import type { AgentContext, AgentResult } from "../base/AgentTypes.js";
import { logger } from "../../../utils/logger.js";
// Re-export types for backward compatibility
export * from "./EmailAnalysisTypes.js";
import type {
  Email,
  EmailAnalysis,
  EmailEntities,
  EmailProcessingResult,
} from "./EmailAnalysisTypes.js";
import {
  PRODUCTION_EMAIL_CONFIG,
  enhancePriorityDetection,
  ANALYSIS_SCENARIOS,
} from "./EmailAnalysisConfig.js";

export class EmailAnalysisAgent extends BaseAgent {
  private cache: any; // Will be initialized later to avoid circular import

  // TD SYNNEX specific categories
  private readonly categories = {
    workflow: [
      "Order Management",
      "Shipping/Logistics",
      "Quote Processing",
      "Customer Support",
      "Deal Registration",
      "Approval Workflows",
      "Renewal Processing",
      "Vendor Management",
    ],
    priority: ["Critical", "High", "Medium", "Low"],
    intent: ["Action Required", "FYI", "Request", "Update"],
    urgency: ["Immediate", "24 Hours", "72 Hours", "No Rush"],
  };

  // Entity extraction patterns
  private readonly patterns = {
    poNumber: /\b(?:PO|P\.O\.|Purchase Order)[\s#:-]*(\d{8,12})\b/gi,
    quoteNumber: /\b(?:CAS|TS|WQ|Quote)[\s#:-]*(\d{6,10})\b/gi,
    orderNumber: /\b(?:Order|ORD)[\s#:-]*([A-Z]{2,3}\d{6,10})\b/gi,
    trackingNumber: /\b(?:1Z|FEDEX|UPS)[\w\d]{10,35}\b/gi,
    caseNumber: /\b(?:Case|Ticket|INC)[\s#:-]*(\d{6,10})\b/gi,
    amount:
      /\$[\d,]+\.?\d{0,2}|\b\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|EUR|GBP)\b/gi,
    date: /\b(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{2,4})\b/gi,
  };

  // Workflow state machine
  private readonly workflowStates = {
    New: {
      transitions: ["In Review", "In Progress"],
      conditions: ["email.isRead", "email.hasReply"],
    },
    "In Review": {
      transitions: ["In Progress", "Pending External"],
      conditions: ["categorization.complete", "action.assigned"],
    },
    "In Progress": {
      transitions: ["Pending External", "Completed"],
      conditions: ["task.created", "response.sent"],
    },
    "Pending External": {
      transitions: ["In Progress", "Completed"],
      conditions: ["external.response", "timeout.reached"],
    },
    Completed: {
      transitions: [],
      conditions: [],
    },
  };

  constructor() {
    try {
      super(
        "EmailAnalysisAgent",
        "Specializes in analyzing and categorizing TD SYNNEX email communications",
        PRODUCTION_EMAIL_CONFIG.primaryModel, // Use production-tested model
      );
    } catch (error) {
      // If super constructor fails, create a minimal agent
      logger.error('Failed to initialize EmailAnalysisAgent base class', 'EMAIL_AGENT', { error });
      // Continue with a simplified initialization
      super(
        "EmailAnalysisAgent",
        "Specializes in analyzing and categorizing TD SYNNEX email communications",
        "llama3.2:3b", // Fallback to default model
      );
    }

    // IMPORTANT: Disable RAG for EmailAnalysisAgent to prevent circular dependencies
    // Email content is indexed into RAG by the email processing pipeline
    this.ragEnabled = false;

    // LLM provider will be initialized by BaseAgent

    // Cache will be initialized lazily to avoid circular import
    this.cache = null;

    // Add capabilities
    this.addCapability("email-analysis");
    this.addCapability("entity-extraction");
    this.addCapability("workflow-management");
    this.addCapability("priority-assessment");
  }
  
  override async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Initialize cache
      await this.initializeCache();
      
      // Initialize base agent if it has an init method
      if (super.initialize && typeof super.initialize === 'function') {
        await super.initialize();
      }
      
      this.initialized = true;
      logger.info('EmailAnalysisAgent initialized successfully', 'EMAIL_AGENT');
    } catch (error) {
      logger.error('Failed to initialize EmailAnalysisAgent', 'EMAIL_AGENT', { error });
      // Don't throw - allow graceful degradation
    }
  }

  private async initializeCache(): Promise<void> {
    if (!this.cache) {
      const { EmailAnalysisCache } = await import(
        "../../cache/EmailAnalysisCache.js"
      );
      this.cache = new EmailAnalysisCache({
        maxSize: 500,
        ttl: 1000 * 60 * 30, // 30 minutes
      });
    }
  }

  override async execute(task: string, context: AgentContext): Promise<AgentResult> {
    try {
      // Parse email data from task
      const email = context.metadata?.email as Email;

      if (!email) {
        return {
          success: false,
          error: "No email data provided in context",
        };
      }

      const analysis = await this.analyzeEmail(email);

      return {
        success: true,
        data: analysis,
        output: this.formatAnalysisOutput(analysis),
        metadata: {
          agent: this.name,
          timestamp: new Date().toISOString(),
          confidence: analysis.confidence,
          emailId: email.id,
        },
      };
    } catch (error) {
      return this.handleError(error as Error);
    }
  }

  async analyzeEmail(email: Email): Promise<EmailAnalysis> {
    logger.info(`Analyzing email: ${email.subject}`, "EMAIL_AGENT");

    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Check cache first
    await this.initializeCache();
    const cached = this?.cache?.get(email.id);
    if (cached) {
      logger.debug(
        `Using cached analysis for email: ${email.id}`,
        "EMAIL_AGENT",
      );
      return cached;
    }

    // Stage 1: Quick categorization with lightweight model
    const quickAnalysis = await this.quickCategorize(email);

    // Stage 2: Deep analysis if confidence is low
    if (quickAnalysis.confidence && quickAnalysis.confidence < 0.8) {
      const deepAnalysis = await this.deepAnalyze(email);
      return this.mergeAnalyses(quickAnalysis, deepAnalysis);
    }

    // Stage 3: Entity extraction
    const entities = await this.extractEntities(email);

    // Stage 4: Workflow state determination
    const workflowState = await this.determineWorkflowState(email, entities);

    // Stage 5: Generate suggested actions
    const suggestedActions = await this.generateActions(email, workflowState);

    // Stage 6: Generate summary
    const summary = await this.generateSummary(email);

    // Apply TD SYNNEX-specific priority rules
    const modelPriority = quickAnalysis.priority || "Medium";
    const enhancedPriority = enhancePriorityDetection(email, modelPriority);

    const analysis: EmailAnalysis = {
      categories: quickAnalysis.categories || {
        workflow: [],
        priority: enhancedPriority.priority,
        intent: "FYI",
        urgency: "No Rush",
      },
      priority: enhancedPriority.priority as
        | "Critical"
        | "High"
        | "Medium"
        | "Low",
      entities,
      workflowState,
      suggestedActions,
      confidence: Math.max(
        quickAnalysis.confidence || 0.5,
        enhancedPriority.confidence,
      ),
      summary,
      prioritySource: enhancedPriority.source as
        | "pattern-rule"
        | "workflow-rule"
        | "model", // Track how priority was determined
    };

    // Cache the result
    await this.initializeCache();
    this?.cache?.set(email.id, analysis);

    return analysis;
  }

  private async quickCategorize(email: Email): Promise<Partial<EmailAnalysis>> {
    const prompt = `Analyze this email and categorize it.

Subject: ${email.subject}
From: ${email?.from?.emailAddress.address}
Preview: ${email.bodyPreview || email.body?.substring(0, 500)}

Categories to assign:
- workflow: ${this?.categories?.workflow.join(", ")}
- priority: ${this?.categories?.priority.join(", ")}
- intent: ${this?.categories?.intent.join(", ")}
- urgency: ${this?.categories?.urgency.join(", ")}

Please provide:
1. Workflow categories that apply
2. Priority level (Critical, High, Medium, or Low)
3. Intent of the email
4. Urgency level
5. Confidence score (0.0 to 1.0)`;

    try {
      const response = await this.generateLLMResponse(prompt, {
        temperature: 0.1,
      });

      return this.parseCategorizeResponse(response.response);
    } catch (error) {
      logger.error("Quick categorization failed", "EMAIL_AGENT", { error });

      // Fallback to rule-based categorization
      return this.fallbackCategorization(email);
    }
  }

  private parseCategorizeResponse(response: string): Partial<EmailAnalysis> {
    const lowerResponse = response.toLowerCase();
    
    // Extract priority
    let priority: "Critical" | "High" | "Medium" | "Low" = "Medium";
    if (lowerResponse.includes("critical")) priority = "Critical";
    else if (lowerResponse.includes("high")) priority = "High";
    else if (lowerResponse.includes("low")) priority = "Low";
    
    // Extract workflow categories
    const workflowCategories: string[] = [];
    for (const category of this?.categories?.workflow || []) {
      if (lowerResponse.includes(category.toLowerCase())) {
        workflowCategories.push(category);
      }
    }
    
    // Extract intent
    let intent = "general";
    for (const intentType of this?.categories?.intent || []) {
      if (lowerResponse.includes(intentType.toLowerCase())) {
        intent = intentType;
        break;
      }
    }
    
    // Extract urgency
    let urgency = "normal";
    for (const urgencyLevel of this?.categories?.urgency || []) {
      if (lowerResponse.includes(urgencyLevel.toLowerCase())) {
        urgency = urgencyLevel;
        break;
      }
    }
    
    // Extract confidence (look for decimal numbers)
    let confidence = 0.7;
    const confidenceMatch = response.match(/\b0?\.\d+\b|\b1\.0\b/);
    if (confidenceMatch) {
      confidence = parseFloat(confidenceMatch[0]);
    }
    
    return {
      categories: {
        workflow: workflowCategories,
        priority,
        intent,
        urgency,
      },
      priority,
      confidence,
    };
  }

  private async deepAnalyze(email: Email): Promise<Partial<EmailAnalysis>> {
    // Switch to more capable model for deep analysis
    const prompt = `Perform deep analysis of this email for TD SYNNEX workflow.

Subject: ${email.subject}
From: ${email?.from?.emailAddress.address}
Body: ${email.body || email.bodyPreview}

Analyze:
1. True business intent and urgency
2. Hidden action items
3. Relationship to ongoing workflows
4. Priority based on sender and content
5. Required follow-up actions

Provide detailed categorization with high confidence.`;

    try {
      const response = await this.generateLLMResponse(prompt, {
        temperature: 0.2,
      });

      // Parse and structure the response
      return this.parseDeepAnalysis(response.response);
    } catch (error) {
      logger.error("Deep analysis failed", "EMAIL_AGENT", { error });
      return {};
    }
  }

  private async extractEntities(email: Email): Promise<EmailEntities> {
    const text = `${email.subject} ${email.body || email.bodyPreview}`;
    const entities: EmailEntities = {
      poNumbers: [],
      quoteNumbers: [],
      orderNumbers: [],
      trackingNumbers: [],
      caseNumbers: [],
      customers: [],
      products: [],
      amounts: [],
      dates: [],
    };

    // Extract using regex patterns
    entities.poNumbers = this.extractMatches(text, this?.patterns?.poNumber);
    entities.quoteNumbers = this.extractMatches(
      text,
      this?.patterns?.quoteNumber,
    );
    entities.orderNumbers = this.extractMatches(
      text,
      this?.patterns?.orderNumber,
    );
    entities.trackingNumbers = this.extractMatches(
      text,
      this?.patterns?.trackingNumber,
    );
    entities.caseNumbers = this.extractMatches(text, this?.patterns?.caseNumber);

    // Extract amounts
    const amountMatches = text.match(this?.patterns?.amount) || [];
    entities.amounts = amountMatches?.map((match: any) => {
      const value = parseFloat(
        match.replace(/[$,]/g, "").replace(/\s*[A-Z]{3}$/, ""),
      );
      const currency = match.match(/[A-Z]{3}$/)?.[0] || "USD";
      return { value, currency };
    });

    // Extract dates
    const dateMatches = text.match(this?.patterns?.date) || [];
    entities.dates = dateMatches?.map((date: any) => ({
      date,
      context: this.getDateContext(date, text),
    }));

    // Extract customers and products using NER
    const nerEntities = await this.extractNEREntities(text);
    entities.customers = nerEntities.customers;
    entities.products = nerEntities.products;

    return entities;
  }

  private extractMatches(text: string, pattern: RegExp): string[] {
    const matches: string[] = [];
    let match;

    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) {
        matches.push(match[1]);
      } else {
        matches.push(match[0]);
      }
    }

    return [...new Set(matches)]; // Remove duplicates
  }

  private getDateContext(date: string, text: string): string {
    const index = text.indexOf(date);
    const contextStart = Math.max(0, index - 30);
    const contextEnd = Math.min(text?.length || 0, index + date?.length || 0 + 30);
    return text.substring(contextStart, contextEnd).trim();
  }

  private async extractNEREntities(
    text: string,
  ): Promise<{ customers: string[]; products: string[] }> {
    // This would typically use a more sophisticated NER model
    // For now, using pattern matching for TD SYNNEX specific entities

    const customers: string[] = [];
    const products: string[] = [];

    // Common customer patterns
    const customerPatterns = [
      /(?:customer|client|partner|reseller):\s*([A-Z][A-Za-z\s&,.-]+)/gi,
      /(?:for|to|from)\s+([A-Z][A-Za-z\s&,.-]+(?:Inc|LLC|Corp|Ltd|Company))/gi,
    ];

    // Product patterns (HP products, etc.)
    const productPatterns = [
      /\b([A-Z0-9]{5,12}(?:#[A-Z]{3})?)\b/g, // SKU patterns
      /\b(?:HP|HPE|Dell|Lenovo|Microsoft)\s+([A-Za-z0-9\s-]+)/gi,
    ];

    customerPatterns.forEach((pattern: any) => {
      const matches = text.match(pattern) || [];
      customers.push(
        ...matches?.map((m: any) =>
          m
            .replace(/^(customer|client|partner|reseller|for|to|from):\s*/i, "")
            .trim(),
        ),
      );
    });

    productPatterns.forEach((pattern: any) => {
      const matches = text.match(pattern) || [];
      products.push(...matches);
    });

    return {
      customers: [...new Set(customers)],
      products: [...new Set(products)],
    };
  }

  private async determineWorkflowState(
    email: Email,
    entities: EmailEntities,
  ): Promise<string> {
    // Determine initial state based on email properties
    if (!email.isRead) {
      return "New";
    }

    // Check for specific entity patterns that indicate state
    if (entities?.trackingNumbers?.length > 0) {
      return "Pending External"; // Waiting for delivery
    }

    if (entities?.poNumbers?.length > 0 || entities?.orderNumbers?.length > 0) {
      return "In Progress"; // Active order processing
    }

    if (entities?.quoteNumbers?.length > 0) {
      return "In Review"; // Quote needs review
    }

    // Default to In Review for read emails
    return "In Review";
  }

  private async generateActions(
    email: Email,
    workflowState: string,
  ): Promise<string[]> {
    const actions: string[] = [];

    // State-based actions
    switch (workflowState) {
      case "New":
        actions.push("Mark as read and categorize");
        actions.push("Assign to appropriate team member");
        break;

      case "In Review":
        actions.push("Review content and determine next steps");
        actions.push("Check for related emails or cases");
        break;

      case "In Progress":
        actions.push("Update case/order status");
        actions.push("Send progress update to customer");
        break;

      case "Pending External":
        actions.push("Set follow-up reminder");
        actions.push("Monitor for external response");
        break;
    }

    // Entity-based actions
    if (email?.categories?.includes("Order Management")) {
      actions.push("Verify order details in system");
      actions.push("Check inventory availability");
    }

    if (email?.categories?.includes("Customer Support")) {
      actions.push("Create or update support ticket");
      actions.push("Check customer history");
    }

    return actions;
  }

  private async generateSummary(email: Email): Promise<string> {
    const prompt = `Generate a concise 1-2 sentence summary of this email:
Subject: ${email.subject}
From: ${email?.from?.emailAddress.name || email?.from?.emailAddress.address}
Preview: ${email.bodyPreview || email.body?.substring(0, 300)}

Summary:`;

    try {
      const summary = await this.generateLLMResponse(prompt, {
        temperature: 0.3,
        maxTokens: 100,
      });

      return summary?.response?.trim();
    } catch (error) {
      // Fallback to subject-based summary
      return `Email from ${email?.from?.emailAddress.name || email?.from?.emailAddress.address} regarding: ${email.subject}`;
    }
  }

  private mergeAnalyses(
    quick: Partial<EmailAnalysis>,
    deep: Partial<EmailAnalysis>,
  ): EmailAnalysis {
    // Merge analyses, preferring deep analysis when available
    return {
      categories: deep.categories ||
        quick.categories || {
          workflow: [],
          priority: "Medium",
          intent: "FYI",
          urgency: "No Rush",
        },
      priority: deep.priority || quick.priority || "Medium",
      entities: deep.entities || quick.entities || this.emptyEntities(),
      workflowState: deep.workflowState || quick.workflowState || "New",
      suggestedActions: [
        ...(deep.suggestedActions || []),
        ...(quick.suggestedActions || []),
      ],
      confidence: Math.max(quick.confidence || 0, deep.confidence || 0),
      summary: deep.summary || quick.summary || "",
    };
  }

  private fallbackCategorization(email: Email): Partial<EmailAnalysis> {
    // Simple rule-based fallback
    const subject = email?.subject?.toLowerCase();
    const preview = (email.bodyPreview || "").toLowerCase();
    const content = subject + " " + preview;

    const categories = {
      workflow: [] as string[],
      priority: "Medium" as "Critical" | "High" | "Medium" | "Low",
      intent: "FYI" as "Action Required" | "FYI" | "Request" | "Update",
      urgency: "No Rush" as "Immediate" | "24 Hours" | "72 Hours" | "No Rush",
    };

    // Workflow detection
    if (content.includes("order") || content.includes("po ")) {
      categories?.workflow?.push("Order Management");
    }
    if (content.includes("ship") || content.includes("tracking")) {
      categories?.workflow?.push("Shipping/Logistics");
    }
    if (content.includes("quote") || content.includes("pricing")) {
      categories?.workflow?.push("Quote Processing");
    }

    // Priority detection
    if (
      content.includes("urgent") ||
      content.includes("critical") ||
      content.includes("asap")
    ) {
      categories.priority = "Critical";
      categories.urgency = "Immediate";
    } else if (content.includes("important") || content.includes("priority")) {
      categories.priority = "High";
      categories.urgency = "24 Hours";
    }

    // Intent detection
    if (
      content.includes("please") ||
      content.includes("request") ||
      content.includes("need")
    ) {
      categories.intent = "Request";
    } else if (
      content.includes("action required") ||
      content.includes("response needed")
    ) {
      categories.intent = "Action Required";
    }

    return {
      categories,
      priority: categories.priority,
      confidence: 0.6,
    };
  }

  private parseDeepAnalysis(response: string): Partial<EmailAnalysis> {
    // Parse the unstructured response from deep analysis
    try {
      // Attempt to extract JSON if present
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Otherwise parse text response
      const analysis: Partial<EmailAnalysis> = {
        confidence: 0.85,
      };

      // Extract priority mentions
      if (/critical|urgent|immediate/i.test(response)) {
        analysis.priority = "Critical";
      } else if (/high.*priority/i.test(response)) {
        analysis.priority = "High";
      }

      return analysis;
    } catch (error) {
      logger.error("Failed to parse deep analysis", "EMAIL_AGENT", { error });
      return { confidence: 0.5 };
    }
  }

  private emptyEntities(): EmailEntities {
    return {
      poNumbers: [],
      quoteNumbers: [],
      orderNumbers: [],
      trackingNumbers: [],
      caseNumbers: [],
      customers: [],
      products: [],
      amounts: [],
      dates: [],
    };
  }

  private formatAnalysisOutput(analysis: EmailAnalysis): string {
    return `Email Analysis Complete:
Priority: ${analysis.priority}
Workflow: ${analysis?.categories?.workflow.join(", ")}
Intent: ${analysis?.categories?.intent}
Urgency: ${analysis?.categories?.urgency}
State: ${analysis.workflowState}
Confidence: ${(analysis.confidence * 100).toFixed(1)}%

Summary: ${analysis.summary}

Suggested Actions:
${analysis?.suggestedActions?.map((action: any) => `- ${action}`).join("\n")}

Extracted Entities:
- PO Numbers: ${analysis?.entities?.poNumbers.join(", ") || "None"}
- Quote Numbers: ${analysis?.entities?.quoteNumbers.join(", ") || "None"}
- Order Numbers: ${analysis?.entities?.orderNumbers.join(", ") || "None"}
- Customers: ${analysis?.entities?.customers.join(", ") || "None"}`;
  }
}
