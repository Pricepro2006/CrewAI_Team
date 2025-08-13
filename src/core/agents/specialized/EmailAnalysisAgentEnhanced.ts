import { BaseAgent } from "../base/BaseAgent.js";
import type { AgentContext, AgentResult } from "../base/AgentTypes.js";
import { OllamaProvider } from "../../llm/OllamaProvider.js";
import { logger } from "../../../utils/logger.js";
import { EmailAnalysisCache } from "../../cache/EmailAnalysisCache.js";
import type { EmailAnalysis } from "./EmailAnalysisTypes.js";

// Email interfaces
interface Email {
  id: string;
  subject: string;
  body?: string;
  bodyPreview?: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  to?: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  receivedDateTime: string;
  isRead: boolean;
  categories: string[];
  importance?: string;
  hasAttachments?: boolean;
}

// Enhanced interfaces based on TD SYNNEX analysis
export interface QuickAnalysis {
  workflow: {
    primary: string;
    confidence: number;
  };
  priority: "Critical" | "High" | "Medium" | "Low";
  intent: "Action Required" | "FYI" | "Request" | "Update";
  urgency: "Immediate" | "24 Hours" | "72 Hours" | "No Rush";
  suggestedState:
    | "New"
    | "In Review"
    | "In Progress"
    | "Pending External"
    | "Completed"
    | "Archived";
  confidence: number;
}

export interface DeepWorkflowAnalysis extends QuickAnalysis {
  detailedWorkflow: {
    primary: string;
    secondary: string[];
    relatedCategories: string[];
    confidence: number;
  };
  entities: EnhancedEmailEntities;
  actionItems: ActionItem[];
  workflowState: WorkflowState;
  businessImpact: BusinessImpact;
  contextualSummary: string;
  suggestedResponse?: string;
  relatedEmails?: string[];
}

interface EnhancedEmailEntities {
  poNumbers: Array<{
    value: string;
    format: "8-digit" | "10-digit" | "11-digit" | "alphanumeric";
    context: string;
  }>;
  quoteNumbers: Array<{
    value: string;
    type: "CAS" | "TS" | "WQ" | "other";
    context: string;
  }>;
  caseNumbers: Array<{
    value: string;
    type: "INC" | "order" | "tracking" | "other";
    context: string;
  }>;
  partNumbers: string[];
  orderReferences: string[];
  contacts: {
    internal: Array<{ name: string; role: string; email?: string }>;
    external: Array<{ name: string; company: string; email?: string }>;
  };
  amounts: Array<{ value: number; currency: string; context: string }>;
  dates: Array<{ date: string; type: string; context: string }>;
}

interface ActionItem {
  action: string;
  type: "reply" | "forward" | "task" | "approval" | "follow-up";
  deadline?: string;
  assignee?: string;
  priority: number;
  slaStatus?: "on-track" | "at-risk" | "overdue";
}

interface WorkflowState {
  current: string;
  suggestedNext: string;
  estimatedCompletion?: string;
  blockers?: string[];
}

interface BusinessImpact {
  revenue?: number;
  customerSatisfaction: "positive" | "neutral" | "negative";
  urgencyReason?: string;
}

export interface EmailAnalysisResult {
  quick: QuickAnalysis;
  deep: DeepWorkflowAnalysis;
  actionSummary: string;
  processingMetadata: {
    stage1Time: number;
    stage2Time: number;
    totalTime: number;
    models: {
      stage1: string;
      stage2: string;
    };
  };
}

export class EmailAnalysisAgentEnhanced extends BaseAgent {
  private quickProvider: OllamaProvider;
  private deepProvider: OllamaProvider;
  private cache: EmailAnalysisCache;

  // TD SYNNEX specific configurations based on analysis
  private readonly workflowDistribution = {
    "Order Management": 0.879,
    "Shipping/Logistics": 0.832,
    "Quote Processing": 0.652,
    "Customer Support": 0.391,
    "Deal Registration": 0.176,
    "Approval Workflows": 0.119,
    "Renewal Processing": 0.022,
    "Vendor Management": 0.015,
  };

  // Enhanced entity patterns from TD SYNNEX data
  private readonly patterns = {
    poNumber: [
      /\b(?:PO|P\.O\.|Purchase Order)[\s#:-]*(\d{8})\b/gi, // 8-digit
      /\b(?:PO|P\.O\.|Purchase Order)[\s#:-]*(\d{10})\b/gi, // 10-digit
      /\b(?:PO|P\.O\.|Purchase Order)[\s#:-]*(\d{11})\b/gi, // 11-digit
      /\b(?:PO|P\.O\.|Purchase Order)[\s#:-]*([A-Z]{2,3}\d{6,9})\b/gi, // Alphanumeric
    ],
    quoteNumber: [
      /\b(?:CAS)[\s#:-]*(\d{6,10})\b/gi, // CAS quotes
      /\b(?:TS)[\s#:-]*(\d{6,10})\b/gi, // TS quotes
      /\b(?:WQ)[\s#:-]*(\d{6,10})\b/gi, // WQ quotes
      /\b(?:Quote)[\s#:-]*([A-Z0-9]{6,12})\b/gi, // Generic quotes
    ],
    caseNumber: [
      /\b(?:INC)[\s#:-]*(\d{6,10})\b/gi, // Incident numbers
      /\b(?:Case|Ticket)[\s#:-]*(\d{6,10})\b/gi, // Case/Ticket numbers
      /\b(?:SR|REQ)[\s#:-]*(\d{6,10})\b/gi, // Service requests
    ],
    trackingNumber: [
      /\b(1Z[\w\d]{16,34})\b/gi, // UPS
      /\b(\d{12,14})\b/gi, // FedEx
      /\b(9[234]\d{21})\b/gi, // USPS
    ],
    partNumber: /\b([A-Z0-9]{5,10}(?:#[A-Z]{3})?)\b/g, // HP part numbers
    orderReference: /\b(?:Order|ORD|REF)[\s#:-]*([A-Z0-9]{6,12})\b/gi,
    amount:
      /\$[\d,]+\.?\d{0,2}|\b\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|EUR|GBP)\b/gi,
    date: /\b(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{2,4})\b/gi,
  };

  // Workflow state machine based on TD SYNNEX's 97.3% completion rate
  private readonly workflowStates = {
    New: {
      transitions: ["In Review", "In Progress"],
      avgTimeToNext: 15, // minutes
      conditions: ["email.isRead", "categorization.complete"],
    },
    "In Review": {
      transitions: ["In Progress", "Pending External"],
      avgTimeToNext: 60, // minutes
      conditions: ["analysis.complete", "action.assigned"],
    },
    "In Progress": {
      transitions: ["Pending External", "Completed"],
      avgTimeToNext: 240, // minutes (4 hours)
      conditions: ["task.created", "response.sent"],
    },
    "Pending External": {
      transitions: ["In Progress", "Completed"],
      avgTimeToNext: 1440, // minutes (24 hours)
      conditions: ["external.response", "timeout.reached"],
    },
    Completed: {
      transitions: ["Archived"],
      avgTimeToNext: 10080, // minutes (7 days)
      conditions: ["retention.period"],
    },
    Archived: {
      transitions: [],
      avgTimeToNext: null,
      conditions: [],
    },
  };

  // SLA definitions based on priority
  private readonly slaDefinitions = {
    Critical: { hours: 4, escalation: 2 },
    High: { hours: 24, escalation: 12 },
    Medium: { hours: 72, escalation: 48 },
    Low: { hours: 168, escalation: 120 }, // 1 week
  };

  constructor() {
    super(
      "EmailAnalysisAgentEnhanced",
      "Advanced email analysis with TD SYNNEX workflow optimization",
      "qwen3:0.6b",
    );

    // Stage 1: Quick categorization model
    this.quickProvider = new OllamaProvider({
      model: "qwen3:0.6b",
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    });

    // Stage 2: Deep analysis model
    this.deepProvider = new OllamaProvider({
      model: "granite3.3:2b",
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    });

    this.cache = new EmailAnalysisCache({
      maxSize: 1000,
      ttl: 1000 * 60 * 30, // 30 minutes
    });

    // Enhanced capabilities
    this.addCapability("email-analysis");
    this.addCapability("entity-extraction");
    this.addCapability("workflow-management");
    this.addCapability("priority-assessment");
    this.addCapability("sla-tracking");
    this.addCapability("pattern-learning");
  }

  async execute(task: string, context: AgentContext): Promise<AgentResult> {
    try {
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
          confidence: analysis.deep.confidence,
          emailId: email.id,
          processingTime: analysis.processingMetadata.totalTime,
        },
      };
    } catch (error) {
      return this.handleError(error as Error);
    }
  }

  async analyzeEmail(email: Email): Promise<EmailAnalysisResult> {
    const startTime = Date.now();
    logger.info(`Analyzing email: ${email.subject}`, "EMAIL_AGENT_ENHANCED");

    // Check cache first
    const cached = this.cache.get(email.id);
    if (cached) {
      logger.debug(
        `Using cached analysis for email: ${email.id}`,
        "EMAIL_AGENT_ENHANCED",
      );
      // Convert EmailAnalysis to EmailAnalysisResult format
      return {
        quick: {
          workflow: {
            primary: cached.categories.workflow[0] || "Unknown",
            confidence: cached.confidence,
          },
          priority: cached.priority,
          intent: "Action Required" as const,
          urgency: "No Rush" as const,
          suggestedState: "New" as const,
          confidence: cached.confidence,
        },
        deep: {
          workflow: {
            primary: cached.categories.workflow[0] || "Unknown",
            confidence: cached.confidence,
          },
          priority: cached.priority,
          intent: "Action Required" as const,
          urgency: "No Rush" as const,
          suggestedState: "New" as const,
          confidence: cached.confidence,
          detailedWorkflow: {
            primary: cached.categories.workflow[0] || "Unknown",
            secondary: cached.categories.workflow.slice(1),
            relatedCategories: [],
            confidence: cached.confidence,
          },
          entities: {
            ...cached.entities,
            partNumbers: [],
            orderReferences: [],
            contacts: [],
          } as any,
          actionItems: [],
          workflowState: {
            current: cached.workflowState,
            suggested: "New",
            transitionReason: "Cached result",
          } as any,
          businessImpact: {
            severity: "Medium",
            urgency: "Normal",
            customerImpact: "Low",
          } as any,
          contextualSummary: cached.summary || "Cached email analysis",
        },
        actionSummary: cached.summary,
        processingMetadata: {
          stage1Time: 0,
          stage2Time: 0,
          totalTime: 0,
          models: {
            stage1: "cached",
            stage2: "cached",
          },
        },
      };
    }

    // Stage 1: Quick categorization (always run)
    const stage1Start = Date.now();
    const quickAnalysis = await this.quickCategorize(email);
    const stage1Time = Date.now() - stage1Start;

    // Stage 2: Deep analysis (always run for TD SYNNEX requirements)
    const stage2Start = Date.now();
    const deepAnalysis = await this.deepWorkflowAnalysis(email, quickAnalysis);
    const stage2Time = Date.now() - stage2Start;

    // Stage 3: Extract action summary
    const actionSummary = await this.extractActionSummary(email, deepAnalysis);

    const result: EmailAnalysisResult = {
      quick: quickAnalysis,
      deep: deepAnalysis,
      actionSummary,
      processingMetadata: {
        stage1Time,
        stage2Time,
        totalTime: Date.now() - startTime,
        models: {
          stage1: "qwen3:0.6b",
          stage2: "granite3.3:2b",
        },
      },
    };

    // Cache the result - convert to EmailAnalysis format for cache
    const cacheAnalysis: EmailAnalysis = {
      categories: {
        workflow: result.deep.detailedWorkflow
          ? [result.deep.detailedWorkflow.primary]
          : [],
        priority: result.deep.priority,
        intent: result.deep.intent,
        urgency: result.deep.urgency,
      },
      priority: result.deep.priority,
      entities: {
        poNumbers: result.deep.entities.poNumbers?.map((p) => p.value) || [],
        quoteNumbers:
          result.deep.entities.quoteNumbers?.map((q) => q.value) || [],
        orderNumbers: result.deep.entities.orderReferences || [],
        trackingNumbers: [],
        caseNumbers:
          result.deep.entities.caseNumbers?.map((c) => c.value) || [],
        customers:
          result.deep.entities.contacts?.external?.map(
            (c) => c.company || c.name,
          ) || [],
        products: result.deep.entities.partNumbers || [],
        amounts: result.deep.entities.amounts || [],
        dates: result.deep.entities.dates || [],
      },
      workflowState: result.deep.workflowState.current,
      suggestedActions: result.deep.actionItems?.map((a) => a.action) || [],
      confidence: result.deep.confidence,
      summary: result.deep.contextualSummary,
    };
    this.cache.set(email.id, cacheAnalysis);

    // Track pattern for learning
    await this.trackWorkflowPattern(email, result);

    return result;
  }

  private async quickCategorize(email: Email): Promise<QuickAnalysis> {
    const prompt = `Analyze this TD SYNNEX email for quick categorization. You must respond with ONLY a valid JSON object.

Subject: ${email.subject}
From: ${email.from.emailAddress.address}
Preview: ${email.bodyPreview || email.body?.substring(0, 500)}
Has Attachments: ${email.hasAttachments ? "Yes" : "No"}

Categorize into:
1. Workflow (choose ONE primary):
   - Order Management (87.9% - orders, POs, purchasing)
   - Shipping/Logistics (83.2% - shipping, tracking, delivery)
   - Quote Processing (65.2% - quotes, pricing, proposals)
   - Customer Support (39.1% - issues, problems, help)
   - Deal Registration (17.6% - partner deals, registrations)
   - Approval Workflows (11.9% - approvals, authorizations)
   - Renewal Processing (2.2% - renewals, extensions)
   - Vendor Management (1.5% - vendor issues, RMAs)

2. Priority: Critical (immediate action), High (24hr), Medium (72hr), Low (no urgency)
3. Intent: Action Required, FYI, Request, Update
4. Urgency: Immediate, 24 Hours, 72 Hours, No Rush
5. Suggested State: New, In Review, In Progress, Pending External, Completed, Archived

Response format:
{
  "workflow": {
    "primary": "exact workflow name from list",
    "confidence": 0.0-1.0
  },
  "priority": "Critical|High|Medium|Low",
  "intent": "Action Required|FYI|Request|Update",
  "urgency": "Immediate|24 Hours|72 Hours|No Rush",
  "suggestedState": "New|In Review|In Progress|Pending External|Completed|Archived",
  "confidence": 0.0-1.0
}`;

    try {
      const response = await this.quickProvider.generate(prompt, {
        temperature: 0.1,
        format: "json",
      });

      const parsed = JSON.parse(response);

      // Validate and ensure proper structure
      return {
        workflow: parsed.workflow || {
          primary: "Customer Support",
          confidence: 0.5,
        },
        priority: parsed.priority || "Medium",
        intent: parsed.intent || "FYI",
        urgency: parsed.urgency || "No Rush",
        suggestedState: parsed.suggestedState || "New",
        confidence: parsed.confidence || 0.7,
      };
    } catch (error) {
      logger.error(
        "Quick categorization failed, using fallback",
        "EMAIL_AGENT_ENHANCED",
        { error },
      );
      return this.fallbackQuickCategorization(email);
    }
  }

  private async deepWorkflowAnalysis(
    email: Email,
    quickAnalysis: QuickAnalysis,
  ): Promise<DeepWorkflowAnalysis> {
    // Extract entities first
    const entities = await this.extractEnhancedEntities(email);

    const prompt = `Perform deep TD SYNNEX workflow analysis of this email.

Subject: ${email.subject}
From: ${email.from.emailAddress.address}
To: ${email.to?.map((t) => t.emailAddress.address).join(", ") || "N/A"}
Body: ${email.body || email.bodyPreview}
Quick Analysis: ${JSON.stringify(quickAnalysis)}
Extracted Entities: ${JSON.stringify(entities)}

Analyze and provide:
1. Detailed workflow categorization with secondary workflows
2. Specific action items with deadlines and types
3. Current workflow state and next suggested state
4. Business impact assessment
5. Related workflow categories
6. Contextual summary (2-3 sentences)
7. Suggested response template if action required

Focus on TD SYNNEX operations: orders, quotes, shipping, support, deals, approvals, renewals, vendors.`;

    try {
      const response = await this.deepProvider.generate(prompt, {
        temperature: 0.2,
        maxTokens: 1000,
      });

      // Parse and structure the deep analysis
      const deepAnalysis = await this.parseDeepAnalysis(
        response,
        quickAnalysis,
        entities,
      );

      // Calculate SLA status for action items
      deepAnalysis.actionItems = await this.calculateSLAStatus(
        deepAnalysis.actionItems,
        quickAnalysis.priority,
        email.receivedDateTime,
      );

      return deepAnalysis;
    } catch (error) {
      logger.error(
        "Deep analysis failed, using enhanced quick analysis",
        "EMAIL_AGENT_ENHANCED",
        { error },
      );
      return this.enhanceQuickAnalysis(quickAnalysis, entities);
    }
  }

  private async extractEnhancedEntities(
    email: Email,
  ): Promise<EnhancedEmailEntities> {
    const text = `${email.subject} ${email.body || email.bodyPreview}`;
    const entities: EnhancedEmailEntities = {
      poNumbers: [],
      quoteNumbers: [],
      caseNumbers: [],
      partNumbers: [],
      orderReferences: [],
      contacts: { internal: [], external: [] },
      amounts: [],
      dates: [],
    };

    // Extract PO Numbers with format detection
    for (const pattern of this.patterns.poNumber) {
      const matches = this.extractMatchesWithContext(text, pattern);
      matches.forEach((match) => {
        const format = this.detectPOFormat(match.value);
        entities.poNumbers.push({
          value: match.value,
          format,
          context: match.context,
        });
      });
    }

    // Extract Quote Numbers with type detection
    for (const [index, pattern] of this.patterns.quoteNumber.entries()) {
      const matches = this.extractMatchesWithContext(text, pattern);
      const types = ["CAS", "TS", "WQ", "other"];
      matches.forEach((match) => {
        entities.quoteNumbers.push({
          value: match.value,
          type: types[index] as any,
          context: match.context,
        });
      });
    }

    // Extract Case Numbers with type detection
    for (const [index, pattern] of this.patterns.caseNumber.entries()) {
      const matches = this.extractMatchesWithContext(text, pattern);
      const types = ["INC", "order", "tracking"];
      matches.forEach((match) => {
        entities.caseNumbers.push({
          value: match.value,
          type: (types[index] || "other") as any,
          context: match.context,
        });
      });
    }

    // Extract other entities
    entities.partNumbers = this.extractMatches(text, this.patterns.partNumber);
    entities.orderReferences = this.extractMatches(
      text,
      this.patterns.orderReference,
    );

    // Extract amounts with context
    const amountMatches = this.extractMatchesWithContext(
      text,
      this.patterns.amount,
    );
    entities.amounts = amountMatches.map((match) => {
      const value = parseFloat(
        match.value.replace(/[$,]/g, "").replace(/\s*[A-Z]{3}$/, ""),
      );
      const currency = match.value.match(/[A-Z]{3}$/)?.[0] || "USD";
      return { value, currency, context: match.context };
    });

    // Extract dates with type detection
    const dateMatches = this.extractMatchesWithContext(
      text,
      this.patterns.date,
    );
    entities.dates = dateMatches.map((match) => ({
      date: match.value,
      type: this.detectDateType(match.context),
      context: match.context,
    }));

    // Extract contacts with classification
    entities.contacts = await this.extractAndClassifyContacts(email, text);

    return entities;
  }

  private extractMatchesWithContext(
    text: string,
    pattern: RegExp,
  ): Array<{ value: string; context: string }> {
    const matches: Array<{ value: string; context: string }> = [];
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const value = match[1] || match[0];
      const index = match.index;
      const contextStart = Math.max(0, index - 50);
      const contextEnd = Math.min(text.length, index + match[0].length + 50);
      const context = text.substring(contextStart, contextEnd).trim();

      matches.push({ value, context });
    }

    return matches;
  }

  private extractMatches(text: string, pattern: RegExp): string[] {
    const matches: string[] = [];
    let match;

    while ((match = pattern.exec(text)) !== null) {
      matches.push(match[1] || match[0]);
    }

    return [...new Set(matches)];
  }

  private detectPOFormat(
    po: string,
  ): "8-digit" | "10-digit" | "11-digit" | "alphanumeric" {
    if (/^\d{8}$/.test(po)) return "8-digit";
    if (/^\d{10}$/.test(po)) return "10-digit";
    if (/^\d{11}$/.test(po)) return "11-digit";
    return "alphanumeric";
  }

  private detectDateType(context: string): string {
    const lower = context.toLowerCase();
    if (lower.includes("due") || lower.includes("deadline")) return "deadline";
    if (lower.includes("ship") || lower.includes("delivery")) return "shipping";
    if (lower.includes("expire") || lower.includes("end")) return "expiration";
    if (lower.includes("start") || lower.includes("begin")) return "start";
    return "mentioned";
  }

  private async extractAndClassifyContacts(
    email: Email,
    text: string,
  ): Promise<{
    internal: Array<{ name: string; role: string; email?: string }>;
    external: Array<{ name: string; company: string; email?: string }>;
  }> {
    const contacts: {
      internal: Array<{ name: string; role: string; email?: string }>;
      external: Array<{ name: string; company: string; email?: string }>;
    } = {
      internal: [],
      external: [],
    };

    // Internal domains
    const internalDomains = ["tdsynnex.com", "techdata.com", "synnex.com"];

    // Extract from email metadata
    const sender = {
      name: email.from.emailAddress.name,
      email: email.from.emailAddress.address,
      role: "sender",
    };

    if (internalDomains.some((domain) => sender.email.includes(domain))) {
      contacts.internal.push({
        name: sender.name,
        role: sender.role,
        email: sender.email,
      });
    } else {
      contacts.external.push({
        name: sender.name,
        company: this.extractCompanyFromEmail(sender.email),
        email: sender.email,
      });
    }

    // Extract from email content using patterns
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const emailMatches = text.match(emailPattern) || [];

    emailMatches.forEach((email) => {
      if (!email.includes(sender.email)) {
        const isInternal = internalDomains.some((domain) =>
          email.includes(domain),
        );
        const contact = {
          email,
          name: this.extractNameNearEmail(email, text),
        };

        if (isInternal) {
          contacts.internal.push({
            name: contact.name,
            role: "mentioned",
            email: contact.email,
          });
        } else {
          contacts.external.push({
            name: contact.name,
            company: this.extractCompanyFromEmail(email),
            email: contact.email,
          });
        }
      }
    });

    return contacts;
  }

  private extractCompanyFromEmail(email: string): string {
    const domain = email.split("@")[1];
    if (!domain) return "Unknown";

    const company = domain.split(".")[0];
    if (!company) return "Unknown";
    return company.charAt(0).toUpperCase() + company.slice(1);
  }

  private extractNameNearEmail(email: string, text: string): string {
    const index = text.indexOf(email);
    const before = text.substring(Math.max(0, index - 50), index);

    // Look for name patterns before email
    const namePattern = /([A-Z][a-z]+ [A-Z][a-z]+)(?:\s|,|:)*$/;
    const match = before.match(namePattern);

    return match?.[1] || "Unknown";
  }

  private async calculateSLAStatus(
    actionItems: ActionItem[],
    priority: string,
    receivedDate: string,
  ): Promise<ActionItem[]> {
    const validPriority = priority as keyof typeof this.slaDefinitions;
    const sla =
      this.slaDefinitions[validPriority] || this.slaDefinitions["Medium"];
    const received = new Date(receivedDate).getTime();
    const now = Date.now();
    const elapsed = now - received;
    const slaMillis = sla.hours * 3600000;

    return actionItems.map((item) => {
      const remaining = slaMillis - elapsed;

      if (remaining < 0) {
        item.slaStatus = "overdue";
      } else if (remaining < sla.escalation * 3600000) {
        item.slaStatus = "at-risk";
      } else {
        item.slaStatus = "on-track";
      }

      // Set deadline if not already set (exclude informational items)
      if (!item.deadline) {
        item.deadline = new Date(received + slaMillis).toISOString();
      }

      return item;
    });
  }

  private async parseDeepAnalysis(
    response: string,
    quickAnalysis: QuickAnalysis,
    entities: EnhancedEmailEntities,
  ): Promise<DeepWorkflowAnalysis> {
    // Try to extract structured data from response
    const analysis: DeepWorkflowAnalysis = {
      ...quickAnalysis,
      detailedWorkflow: {
        primary: quickAnalysis.workflow.primary,
        secondary: [],
        relatedCategories: [],
        confidence: 0.9,
      },
      entities,
      actionItems: [],
      workflowState: {
        current: quickAnalysis.suggestedState,
        suggestedNext: this.getNextState(quickAnalysis.suggestedState),
        blockers: [],
      },
      businessImpact: {
        customerSatisfaction: "neutral",
        urgencyReason: "",
      },
      contextualSummary: "",
      relatedEmails: [],
    };

    // Extract action items from response
    const actionPattern =
      /(?:action|task|need to|must|should|required):\s*([^.!?\n]+)/gi;
    let actionMatch;
    while ((actionMatch = actionPattern.exec(response)) !== null) {
      const actionText = actionMatch[1]?.trim();
      if (actionText) {
        analysis.actionItems.push({
          action: actionText,
          type: this.detectActionType(actionText),
          priority: this.mapPriorityToNumber(quickAnalysis.priority),
        });
      }
    }

    // Extract summary if present
    const summaryMatch = response.match(
      /summary:\s*([^.!?\n]+(?:[.!?][^.!?\n]+)*)/i,
    );
    if (summaryMatch?.[1]) {
      analysis.contextualSummary = summaryMatch[1].trim();
    } else {
      // Generate summary from entities
      analysis.contextualSummary = this.generateContextualSummary(
        entities,
        quickAnalysis,
      );
    }

    // Detect business impact
    if (/urgent|critical|immediate|asap/i.test(response)) {
      analysis.businessImpact.customerSatisfaction = "negative";
      analysis.businessImpact.urgencyReason = "Customer escalation detected";
    } else if (/thank|appreciate|great|excellent/i.test(response)) {
      analysis.businessImpact.customerSatisfaction = "positive";
    }

    // Extract revenue if mentioned
    const revenueMatch = response.match(
      /(?:revenue|value|worth).*?\$?([\d,]+(?:\.\d{2})?)/i,
    );
    if (revenueMatch?.[1]) {
      analysis.businessImpact.revenue = parseFloat(
        revenueMatch[1].replace(/,/g, ""),
      );
    }

    return analysis;
  }

  private detectActionType(action: string): ActionItem["type"] {
    const lower = action.toLowerCase();
    if (lower.includes("reply") || lower.includes("respond")) return "reply";
    if (lower.includes("forward") || lower.includes("send to"))
      return "forward";
    if (lower.includes("approve") || lower.includes("authorization"))
      return "approval";
    if (lower.includes("follow up") || lower.includes("check"))
      return "follow-up";
    return "task";
  }

  private mapPriorityToNumber(priority: string): number {
    const map = { Critical: 1, High: 2, Medium: 3, Low: 4 };
    return map[priority as keyof typeof map] || 3;
  }

  private getNextState(currentState: string): string {
    const transitions =
      this.workflowStates[currentState as keyof typeof this.workflowStates]
        ?.transitions || [];
    return transitions[0] || currentState;
  }

  private generateContextualSummary(
    entities: EnhancedEmailEntities,
    analysis: QuickAnalysis,
  ): string {
    const parts = [];

    if (entities.poNumbers.length > 0 && entities.poNumbers[0]) {
      parts.push(`PO ${entities.poNumbers[0].value}`);
    }
    if (entities.quoteNumbers.length > 0 && entities.quoteNumbers[0]) {
      parts.push(`Quote ${entities.quoteNumbers[0].value}`);
    }
    if (entities.caseNumbers.length > 0 && entities.caseNumbers[0]) {
      parts.push(`Case ${entities.caseNumbers[0].value}`);
    }

    const entityString =
      parts.length > 0 ? `regarding ${parts.join(", ")}` : "";

    return `${analysis.workflow.primary} ${analysis.intent.toLowerCase()} ${entityString}. Priority: ${analysis.priority}, Action needed within ${analysis.urgency}.`.trim();
  }

  private async extractActionSummary(
    email: Email,
    analysis: DeepWorkflowAnalysis,
  ): Promise<string> {
    if (analysis.actionItems.length === 0) {
      return "No specific action required";
    }

    const primaryAction = analysis.actionItems.sort(
      (a, b) => a.priority - b.priority,
    )[0];

    if (!primaryAction) {
      return "No action items found";
    }

    // Generate concise action summary
    const prompt = `Create a concise action summary (max 100 characters) for this email action:
Action: ${primaryAction.action}
Type: ${primaryAction.type}
Workflow: ${analysis.detailedWorkflow.primary}
Priority: ${analysis.priority}

Summary:`;

    try {
      const summary = await this.quickProvider.generate(prompt, {
        temperature: 0.3,
        maxTokens: 50,
      });

      return summary.trim().substring(0, 100);
    } catch (error) {
      // Fallback to truncated action
      return primaryAction.action.substring(0, 100);
    }
  }

  private fallbackQuickCategorization(email: Email): QuickAnalysis {
    const subject = email.subject.toLowerCase();
    const preview = (email.bodyPreview || "").toLowerCase();
    const content = subject + " " + preview;

    // Determine workflow based on keywords
    let workflow = "Customer Support";
    let confidence = 0.6;

    if (
      content.includes("order") ||
      content.includes("po ") ||
      content.includes("purchase")
    ) {
      workflow = "Order Management";
      confidence = 0.8;
    } else if (
      content.includes("ship") ||
      content.includes("tracking") ||
      content.includes("delivery")
    ) {
      workflow = "Shipping/Logistics";
      confidence = 0.8;
    } else if (
      content.includes("quote") ||
      content.includes("pricing") ||
      content.includes("proposal")
    ) {
      workflow = "Quote Processing";
      confidence = 0.75;
    } else if (content.includes("deal") || content.includes("registration")) {
      workflow = "Deal Registration";
      confidence = 0.7;
    }

    // Determine priority
    let priority: QuickAnalysis["priority"] = "Medium";
    let urgency: QuickAnalysis["urgency"] = "72 Hours";

    if (
      content.includes("urgent") ||
      content.includes("critical") ||
      content.includes("asap")
    ) {
      priority = "Critical";
      urgency = "Immediate";
    } else if (content.includes("important") || content.includes("priority")) {
      priority = "High";
      urgency = "24 Hours";
    }

    // Determine intent
    let intent: QuickAnalysis["intent"] = "FYI";
    if (
      content.includes("please") ||
      content.includes("request") ||
      content.includes("need")
    ) {
      intent = "Request";
    } else if (
      content.includes("action required") ||
      content.includes("response needed")
    ) {
      intent = "Action Required";
    } else if (content.includes("update") || content.includes("status")) {
      intent = "Update";
    }

    return {
      workflow: { primary: workflow, confidence },
      priority,
      intent,
      urgency,
      suggestedState: email.isRead ? "In Review" : "New",
      confidence: confidence * 0.8, // Reduce confidence for fallback
    };
  }

  private enhanceQuickAnalysis(
    quickAnalysis: QuickAnalysis,
    entities: EnhancedEmailEntities,
  ): DeepWorkflowAnalysis {
    // Create a basic deep analysis from quick analysis
    return {
      ...quickAnalysis,
      detailedWorkflow: {
        primary: quickAnalysis.workflow.primary,
        secondary: this.inferSecondaryWorkflows(
          quickAnalysis.workflow.primary,
          entities,
        ),
        relatedCategories: [],
        confidence: quickAnalysis.confidence,
      },
      entities,
      actionItems: this.inferActionItems(quickAnalysis, entities),
      workflowState: {
        current: quickAnalysis.suggestedState,
        suggestedNext: this.getNextState(quickAnalysis.suggestedState),
        blockers: [],
      },
      businessImpact: {
        customerSatisfaction: "neutral",
        urgencyReason:
          quickAnalysis.urgency === "Immediate" ? "High priority request" : "",
      },
      contextualSummary: this.generateContextualSummary(
        entities,
        quickAnalysis,
      ),
      relatedEmails: [],
    };
  }

  private inferSecondaryWorkflows(
    primary: string,
    entities: EnhancedEmailEntities,
  ): string[] {
    const secondary = [];

    // Based on entity presence
    if (
      entities.orderReferences.some((ref) =>
        /track|ship|fedex|ups|1z/i.test(ref),
      ) &&
      primary !== "Shipping/Logistics"
    ) {
      secondary.push("Shipping/Logistics");
    }
    if (entities.quoteNumbers.length > 0 && primary !== "Quote Processing") {
      secondary.push("Quote Processing");
    }
    if (entities.poNumbers.length > 0 && primary !== "Order Management") {
      secondary.push("Order Management");
    }

    return secondary;
  }

  private inferActionItems(
    analysis: QuickAnalysis,
    entities: EnhancedEmailEntities,
  ): ActionItem[] {
    const actions: ActionItem[] = [];

    if (analysis.intent === "Action Required") {
      actions.push({
        action: "Review and respond to request",
        type: "reply",
        priority: this.mapPriorityToNumber(analysis.priority),
      });
    }

    if (entities.poNumbers.length > 0 && entities.poNumbers[0]) {
      actions.push({
        action: `Process PO ${entities.poNumbers[0].value}`,
        type: "task",
        priority: 2,
      });
    }

    if (entities.quoteNumbers.length > 0 && entities.quoteNumbers[0]) {
      actions.push({
        action: `Review quote ${entities.quoteNumbers[0].value}`,
        type: "task",
        priority: 3,
      });
    }

    return actions;
  }

  private async trackWorkflowPattern(
    email: Email,
    analysis: EmailAnalysisResult,
  ): Promise<void> {
    // Track patterns for future learning (would typically write to database)
    logger.debug("Tracking workflow pattern", "EMAIL_AGENT_ENHANCED", {
      workflow: analysis.deep.detailedWorkflow.primary,
      entities: Object.keys(analysis.deep.entities).reduce(
        (acc, key) => {
          const entityValue = (analysis.deep.entities as any)[key];
          acc[key] = Array.isArray(entityValue) ? entityValue.length : 0;
          return acc;
        },
        {} as Record<string, number>,
      ),
      confidence: analysis.deep.confidence,
      processingTime: analysis.processingMetadata.totalTime,
    });
  }

  private formatAnalysisOutput(analysis: EmailAnalysisResult): string {
    const { quick, deep, actionSummary, processingMetadata } = analysis;

    return `=== TD SYNNEX Email Analysis Complete ===

QUICK ANALYSIS (${processingMetadata.stage1Time}ms):
- Workflow: ${quick.workflow.primary} (${(quick.workflow.confidence * 100).toFixed(1)}% confidence)
- Priority: ${quick.priority}
- Intent: ${quick.intent}
- Urgency: ${quick.urgency}
- Suggested State: ${quick.suggestedState}

DEEP ANALYSIS (${processingMetadata.stage2Time}ms):
- Primary Workflow: ${deep.detailedWorkflow.primary}
- Secondary Workflows: ${deep.detailedWorkflow.secondary.join(", ") || "None"}
- Confidence: ${(deep.detailedWorkflow.confidence * 100).toFixed(1)}%

WORKFLOW STATE:
- Current: ${deep.workflowState.current}
- Next: ${deep.workflowState.suggestedNext}
${deep.workflowState.blockers && deep.workflowState.blockers.length > 0 ? `- Blockers: ${deep.workflowState.blockers.join(", ")}` : ""}

ACTION SUMMARY: ${actionSummary}

ACTION ITEMS:
${deep.actionItems
  .map(
    (item, i) =>
      `${i + 1}. ${item.action}
   - Type: ${item.type}
   - Priority: ${item.priority}
   - SLA Status: ${item.slaStatus || "N/A"}
   ${item.deadline ? `- Deadline: ${new Date(item.deadline).toLocaleString()}` : ""}`,
  )
  .join("\n")}

EXTRACTED ENTITIES:
- PO Numbers: ${deep.entities.poNumbers.map((po) => `${po.value} (${po.format})`).join(", ") || "None"}
- Quote Numbers: ${deep.entities.quoteNumbers.map((q) => `${q.value} (${q.type})`).join(", ") || "None"}
- Case Numbers: ${deep.entities.caseNumbers.map((c) => `${c.value} (${c.type})`).join(", ") || "None"}
- Part Numbers: ${deep.entities.partNumbers.join(", ") || "None"}
- Order References: ${deep.entities.orderReferences.join(", ") || "None"}
- Internal Contacts: ${deep.entities.contacts.internal.map((c) => c.name).join(", ") || "None"}
- External Contacts: ${deep.entities.contacts.external.map((c) => `${c.name} (${c.company})`).join(", ") || "None"}

BUSINESS IMPACT:
- Customer Satisfaction: ${deep.businessImpact.customerSatisfaction}
${deep.businessImpact.revenue ? `- Revenue Impact: $${deep.businessImpact.revenue.toLocaleString()}` : ""}
${deep.businessImpact.urgencyReason ? `- Urgency Reason: ${deep.businessImpact.urgencyReason}` : ""}

SUMMARY: ${deep.contextualSummary}

Total Processing Time: ${processingMetadata.totalTime}ms
Models Used: ${processingMetadata.models.stage1} → ${processingMetadata.models.stage2}`;
  }
}
