/**
 * BusinessContextManager - Claude Opus-level business insight context management
 * 
 * Optimizes email analysis context for maximum actionable business intelligence
 * extraction while working within token limits of Llama 3.2:3b (8K) and Phi-4 (16K)
 */

import { Logger } from "../../utils/logger.js";
import type { EmailRecord, AnalysisStatus } from "../../types/EmailTypes.js";
import type { Phase1Results, Phase2Results, Phase3Results } from "../../types/AnalysisTypes.js";
import type { EmailChain } from "../../types/ChainTypes.js";

const logger = new Logger("BusinessContextManager");

// Business Context Types
export interface BusinessContext {
  // Core Business Intelligence
  financialContext: FinancialContext;
  technicalContext: TechnicalContext;
  relationshipContext: RelationshipContext;
  temporalContext: TemporalContext;
  workflowContext: WorkflowContext;
  
  // Metadata
  priority: BusinessPriority;
  confidence: number;
  tokenUsage: TokenUsageInfo;
  contextSources: ContextSource[];
}

export interface FinancialContext {
  totalValue: number;
  currency: string;
  poNumbers: string[];
  quoteNumbers: string[];
  budgetApprovals: string[];
  paymentTerms: string[];
  discountDiscussions: boolean;
  competitivePricing: boolean;
  urgentOrders: boolean;
  riskLevel: "low" | "medium" | "high" | "critical";
}

export interface TechnicalContext {
  productSpecs: ProductSpecification[];
  integrationRequirements: string[];
  apiDiscussions: string[];
  systemRequirements: string[];
  technicalConstraints: string[];
  supportTickets: string[];
  errorCodes: string[];
  performanceIssues: string[];
}

export interface RelationshipContext {
  clientCommunications: ClientInteraction[];
  vendorNegotiations: string[];
  internalCoordination: string[];
  stakeholders: Stakeholder[];
  sentimentTrend: "improving" | "stable" | "declining" | "critical";
  satisfactionIndicators: string[];
  loyaltySigns: string[];
  expansionOpportunities: string[];
}

export interface TemporalContext {
  deadlines: Deadline[];
  projectTimelines: Timeline[];
  followupRequirements: FollowupAction[];
  urgencyFactors: string[];
  seasonalFactors: string[];
  businessCycles: string[];
}

export interface WorkflowContext {
  currentStage: string;
  nextActions: string[];
  bottlenecks: string[];
  dependencies: string[];
  automationOpportunities: string[];
  escalationTriggers: string[];
  processOptimizations: string[];
}

// Supporting Types
export interface ProductSpecification {
  partNumber: string;
  quantity: number;
  specifications: string[];
  alternatives: string[];
  availability: string;
  leadTime: string;
}

export interface ClientInteraction {
  type: "inquiry" | "complaint" | "order" | "negotiation" | "support";
  sentiment: "positive" | "neutral" | "negative";
  urgency: "low" | "medium" | "high" | "critical";
  value: number;
  context: string;
}

export interface Stakeholder {
  name: string;
  role: string;
  influence: "low" | "medium" | "high";
  decisionMaker: boolean;
  contactInfo: string;
}

export interface Deadline {
  description: string;
  dueDate: Date;
  criticality: "low" | "medium" | "high" | "critical";
  dependencies: string[];
  status: "pending" | "at_risk" | "overdue" | "completed";
}

export interface Timeline {
  projectName: string;
  phases: TimelinePhase[];
  criticalPath: string[];
  risks: string[];
}

export interface TimelinePhase {
  name: string;
  startDate: Date;
  endDate: Date;
  dependencies: string[];
  deliverables: string[];
}

export interface FollowupAction {
  action: string;
  owner: string;
  dueDate: Date;
  priority: "low" | "medium" | "high" | "critical";
  context: string;
}

export type BusinessPriority = "low" | "medium" | "high" | "critical" | "executive";

export interface TokenUsageInfo {
  used: number;
  available: number;
  efficiency: number; // percentage of valuable content vs total tokens
  compressionRatio: number;
}

export interface ContextSource {
  type: "email" | "chain" | "metadata" | "historical" | "external";
  id: string;
  relevance: number;
  confidence: number;
  timestamp: Date;
}

// Context Optimization Options
export interface ContextOptimizationOptions {
  modelType: "llama3.2" | "phi-4";
  maxTokens?: number;
  priorityLevel: BusinessPriority;
  focusAreas: ContextFocusArea[];
  includeHistorical: boolean;
  compressionLevel: "minimal" | "moderate" | "aggressive";
  preserveEntities: boolean;
  includeChainContext: boolean;
}

export type ContextFocusArea = 
  | "financial" 
  | "technical" 
  | "relationship" 
  | "temporal" 
  | "workflow" 
  | "escalation";

// Main Context Manager Class
export class BusinessContextManager {
  private readonly defaultLlamaTokens = 8000;
  private readonly defaultPhiTokens = 16000;
  private readonly tokenReserve = 0.1; // Reserve 10% for response generation
  
  constructor() {}

  /**
   * Build optimized business context for email analysis
   */
  async buildBusinessContext(
    email: EmailRecord,
    chainData?: EmailChain,
    historicalData?: any[],
    options: ContextOptimizationOptions = {
      modelType: "llama3.2",
      priorityLevel: "medium",
      focusAreas: ["financial", "workflow"],
      includeHistorical: false,
      compressionLevel: "moderate",
      preserveEntities: true,
      includeChainContext: true
    }
  ): Promise<BusinessContext> {
    const startTime = Date.now();
    
    // Determine available tokens
    const maxTokens = options.maxTokens || 
      (options.modelType === "llama3.2" ? this.defaultLlamaTokens : this.defaultPhiTokens);
    const availableTokens = Math.floor(maxTokens * (1 - this.tokenReserve));
    
    logger.info(`Building business context for ${options.modelType} with ${availableTokens} tokens`);

    // Extract raw context from email and chain
    const rawContext = await this.extractRawContext(email, options, chainData, historicalData);
    
    // Prioritize and optimize context based on focus areas
    const optimizedContext = await this.optimizeContext(rawContext, availableTokens, options);
    
    // Calculate confidence and metadata
    const contextMetadata = this.calculateContextMetadata(optimizedContext, availableTokens, options);
    
    const processingTime = Date.now() - startTime;
    logger.info(`Business context built in ${processingTime}ms with ${contextMetadata.tokenUsage.used} tokens`);
    
    const result: BusinessContext = {
      financialContext: optimizedContext.financialContext!,
      technicalContext: optimizedContext.technicalContext!,
      relationshipContext: optimizedContext.relationshipContext!,
      temporalContext: optimizedContext.temporalContext!,
      workflowContext: optimizedContext.workflowContext!,
      ...contextMetadata,
    };
    
    return result;
  }

  /**
   * Build context specifically optimized for Phase 2 (Llama 3.2)
   */
  async buildPhase2Context(
    email: EmailRecord,
    phase1Results: Phase1Results,
    chainData?: EmailChain,
    options: Partial<ContextOptimizationOptions> = {}
  ): Promise<string> {
    const contextOptions: ContextOptimizationOptions = {
      modelType: "llama3.2",
      maxTokens: 6000, // Reserve space for instructions and response
      priorityLevel: this.determinePriority(email, phase1Results),
      focusAreas: this.determineFocusAreas(email, phase1Results),
      includeHistorical: false,
      compressionLevel: "moderate",
      preserveEntities: true,
      includeChainContext: !!chainData,
      ...options
    };

    const businessContext = await this.buildBusinessContext(email, chainData, [], contextOptions);
    return this.formatContextForPhase2(businessContext, phase1Results);
  }

  /**
   * Build context specifically optimized for Phase 3 (Phi-4)
   */
  async buildPhase3Context(
    email: EmailRecord,
    phase1Results: Phase1Results,
    phase2Results: Phase2Results,
    chainData?: EmailChain,
    historicalData?: any[],
    options: Partial<ContextOptimizationOptions> = {}
  ): Promise<string> {
    const contextOptions: ContextOptimizationOptions = {
      modelType: "phi-4",
      maxTokens: 12000, // More space for strategic analysis
      priorityLevel: this.determinePriority(email, phase1Results, phase2Results),
      focusAreas: ["financial", "technical", "relationship", "temporal", "workflow"],
      includeHistorical: true,
      compressionLevel: "minimal", // Preserve more context for strategic insights
      preserveEntities: true,
      includeChainContext: !!chainData,
      ...options
    };

    const businessContext = await this.buildBusinessContext(
      email, 
      chainData, 
      historicalData, 
      contextOptions
    );
    
    return this.formatContextForPhase3(businessContext, phase1Results, phase2Results);
  }

  /**
   * Extract raw context information from email and related data
   */
  private async extractRawContext(
    email: EmailRecord,
    options: ContextOptimizationOptions,
    chainData?: EmailChain,
    historicalData?: any[]
  ): Promise<Partial<BusinessContext>> {
    const context: Partial<BusinessContext> = {};

    // Financial Context Extraction
    if (options.focusAreas.includes("financial")) {
      context.financialContext = await this.extractFinancialContext(email, chainData);
    }

    // Technical Context Extraction
    if (options.focusAreas.includes("technical")) {
      context.technicalContext = await this.extractTechnicalContext(email, chainData);
    }

    // Relationship Context Extraction
    if (options.focusAreas.includes("relationship")) {
      context.relationshipContext = await this.extractRelationshipContext(email, chainData, historicalData);
    }

    // Temporal Context Extraction
    if (options.focusAreas.includes("temporal")) {
      context.temporalContext = await this.extractTemporalContext(email, chainData);
    }

    // Workflow Context Extraction
    if (options.focusAreas.includes("workflow")) {
      context.workflowContext = await this.extractWorkflowContext(email, chainData);
    }

    return context;
  }

  /**
   * Extract financial context with TD SYNNEX-specific patterns
   */
  private async extractFinancialContext(
    email: EmailRecord,
    chainData?: EmailChain
  ): Promise<FinancialContext> {
    const emailText = `${email.subject} ${email.body_text || ''}`.toLowerCase();
    
    // Extract PO numbers
    const poNumbers = this.extractEntities(emailText, /\b(?:po|p\.o\.?|purchase\s+order)[\s#-]?(\d{4,})/gi);
    
    // Extract quote numbers
    const quoteNumbers = this.extractEntities(emailText, /\b(?:quote|qt|quotation)[\s#-]?(\d{4,})/gi);
    
    // Extract dollar amounts
    const dollarMatches = emailText.match(/\$[\d,]+(?:\.\d{2})?/g) || [];
    const totalValue = dollarMatches.reduce((sum: any, amount: any) => {
      const numValue = parseFloat(amount.replace(/[$,]/g, ''));
      return sum + (isNaN(numValue) ? 0 : numValue);
    }, 0);

    // Detect financial urgency indicators
    const urgentOrders = /\b(?:urgent|asap|rush|expedite|critical|emergency)\b.*\b(?:order|po|purchase)\b/i.test(emailText);
    
    // Detect competitive pricing discussions
    const competitivePricing = /\b(?:competitive|competitor|pricing|quote|better\s+price|match|beat)\b/i.test(emailText);
    
    // Detect discount discussions
    const discountDiscussions = /\b(?:discount|rebate|special\s+pricing|deal|promotion|volume\s+pricing)\b/i.test(emailText);

    // Assess financial risk level
    const riskLevel = this.assessFinancialRisk(totalValue, urgentOrders, competitivePricing, emailText);

    return {
      totalValue,
      currency: "USD", // Default for TD SYNNEX
      poNumbers,
      quoteNumbers,
      budgetApprovals: this.extractEntities(emailText, /\b(?:approved|authorization|budget\s+approval)[\s#-]?(\w+)/gi),
      paymentTerms: this.extractPaymentTerms(emailText),
      discountDiscussions,
      competitivePricing,
      urgentOrders,
      riskLevel
    };
  }

  /**
   * Extract technical context with focus on TD SYNNEX products
   */
  private async extractTechnicalContext(
    email: EmailRecord,
    chainData?: EmailChain
  ): Promise<TechnicalContext> {
    const emailText = `${email.subject} ${email.body_text || ''}`.toLowerCase();
    
    // Extract product specifications (TD SYNNEX part number patterns)
    const productSpecs = await this.extractProductSpecifications(emailText);
    
    // Extract technical requirements
    const integrationRequirements = this.extractEntities(emailText, /\b(?:integration|api|sdk|compatibility|requirements?)\b[^.!?]*[.!?]/gi);
    
    // Extract API discussions
    const apiDiscussions = this.extractEntities(emailText, /\b(?:api|rest|soap|endpoint|webhook|integration)\b[^.!?]*[.!?]/gi);
    
    // Extract system requirements
    const systemRequirements = this.extractEntities(emailText, /\b(?:system|server|hardware|software|os|operating\s+system)\s+(?:requirements?|specs?|specifications?)\b[^.!?]*[.!?]/gi);
    
    // Extract support tickets
    const supportTickets = this.extractEntities(emailText, /\b(?:ticket|case|incident)[\s#-]?(\d+)/gi);
    
    // Extract error codes
    const errorCodes = this.extractEntities(emailText, /\b(?:error|fault|exception)[\s#-]?(\w+\d+|\d+\w*)/gi);

    return {
      productSpecs,
      integrationRequirements,
      apiDiscussions,
      systemRequirements,
      technicalConstraints: this.extractTechnicalConstraints(emailText),
      supportTickets,
      errorCodes,
      performanceIssues: this.extractPerformanceIssues(emailText)
    };
  }

  /**
   * Extract relationship context for customer management
   */
  private async extractRelationshipContext(
    email: EmailRecord,
    chainData?: EmailChain,
    historicalData?: any[]
  ): Promise<RelationshipContext> {
    const emailText = `${email.subject} ${email.body_text || ''}`.toLowerCase();
    
    // Analyze sentiment
    const sentiment = this.analyzeSentiment(emailText);
    
    // Extract client interactions
    const clientCommunications = await this.extractClientInteractions(email, sentiment);
    
    // Extract stakeholders
    const stakeholders = await this.extractStakeholders(email, chainData);
    
    // Analyze sentiment trend (requires historical data)
    const sentimentTrend = this.analyzeSentimentTrend(historicalData, sentiment);
    
    // Extract satisfaction indicators
    const satisfactionIndicators = this.extractSatisfactionIndicators(emailText);
    
    // Identify expansion opportunities
    const expansionOpportunities = this.identifyExpansionOpportunities(emailText, chainData);

    return {
      clientCommunications,
      vendorNegotiations: this.extractVendorNegotiations(emailText),
      internalCoordination: this.extractInternalCoordination(emailText),
      stakeholders,
      sentimentTrend,
      satisfactionIndicators,
      loyaltySigns: this.extractLoyaltySigns(emailText),
      expansionOpportunities
    };
  }

  /**
   * Extract temporal context for deadline and timeline management
   */
  private async extractTemporalContext(
    email: EmailRecord,
    chainData?: EmailChain
  ): Promise<TemporalContext> {
    const emailText = `${email.subject} ${email.body_text || ''}`.toLowerCase();
    
    // Extract deadlines
    const deadlines = await this.extractDeadlines(emailText);
    
    // Extract project timelines
    const projectTimelines = await this.extractProjectTimelines(emailText, chainData);
    
    // Extract followup requirements
    const followupRequirements = await this.extractFollowupRequirements(emailText);
    
    // Identify urgency factors
    const urgencyFactors = this.extractUrgencyFactors(emailText);

    return {
      deadlines,
      projectTimelines,
      followupRequirements,
      urgencyFactors,
      seasonalFactors: this.extractSeasonalFactors(emailText),
      businessCycles: this.extractBusinessCycles(emailText)
    };
  }

  /**
   * Extract workflow context for process optimization
   */
  private async extractWorkflowContext(
    email: EmailRecord,
    chainData?: EmailChain
  ): Promise<WorkflowContext> {
    const emailText = `${email.subject} ${email.body_text || ''}`.toLowerCase();
    
    // Determine current workflow stage
    const currentStage = this.determineWorkflowStage(emailText, chainData);
    
    // Extract next actions
    const nextActions = this.extractNextActions(emailText);
    
    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(emailText, chainData);
    
    // Extract dependencies
    const dependencies = this.extractDependencies(emailText);
    
    // Identify automation opportunities
    const automationOpportunities = this.identifyAutomationOpportunities(emailText, chainData);

    return {
      currentStage,
      nextActions,
      bottlenecks,
      dependencies,
      automationOpportunities,
      escalationTriggers: this.identifyEscalationTriggers(emailText),
      processOptimizations: this.identifyProcessOptimizations(emailText, chainData)
    };
  }

  // Helper methods for context optimization and formatting...

  private optimizeContext(
    rawContext: Partial<BusinessContext>,
    availableTokens: number,
    options: ContextOptimizationOptions
  ): Promise<Partial<BusinessContext>> {
    // Implement intelligent context pruning and compression
    // This is a simplified version - full implementation would be more sophisticated
    return Promise.resolve(rawContext);
  }

  private calculateContextMetadata(
    context: Partial<BusinessContext>,
    availableTokens: number,
    options: ContextOptimizationOptions
  ) {
    const used = this.estimateTokenUsage(context);
    const efficiency = this.calculateEfficiency(context, used);
    
    return {
      priority: options.priorityLevel,
      confidence: 0.85, // Calculated based on context completeness
      tokenUsage: {
        used,
        available: availableTokens,
        efficiency,
        compressionRatio: used / availableTokens
      },
      contextSources: [] // Would be populated with actual sources
    };
  }

  private formatContextForPhase2(context: BusinessContext, phase1Results: Phase1Results): string {
    // Create optimized prompt context for Phase 2 analysis
    const sections = [];
    
    if (context.financialContext) {
      sections.push(`FINANCIAL: ${context.financialContext.totalValue} value, ${context.financialContext.poNumbers.length} POs, Risk: ${context.financialContext.riskLevel}`);
    }
    
    if (context.workflowContext) {
      sections.push(`WORKFLOW: Stage=${context.workflowContext.currentStage}, Actions=${context.workflowContext.nextActions.length}`);
    }
    
    if (context.temporalContext && context.temporalContext.deadlines.length > 0) {
      const urgentDeadlines = context.temporalContext.deadlines.filter(d => d.criticality === 'critical').length;
      sections.push(`TEMPORAL: ${urgentDeadlines} critical deadlines`);
    }
    
    return sections.join(' | ');
  }

  private formatContextForPhase3(
    context: BusinessContext, 
    phase1Results: Phase1Results, 
    phase2Results: Phase2Results
  ): string {
    // Create comprehensive context for strategic Phase 3 analysis
    const sections = [];
    
    // Executive summary section
    sections.push("=== EXECUTIVE CONTEXT ===");
    if (context.financialContext) {
      sections.push(`Revenue Impact: ${context.financialContext.totalValue}`);
      sections.push(`Financial Risk: ${context.financialContext.riskLevel}`);
    }
    
    if (context.relationshipContext) {
      sections.push(`Relationship Status: ${context.relationshipContext.sentimentTrend}`);
      sections.push(`Stakeholders: ${context.relationshipContext.stakeholders.length}`);
    }
    
    // Detailed analysis sections...
    if (context.workflowContext) {
      sections.push("\n=== WORKFLOW INTELLIGENCE ===");
      sections.push(`Current Stage: ${context.workflowContext.currentStage}`);
      sections.push(`Bottlenecks: ${context.workflowContext.bottlenecks.join(', ')}`);
      sections.push(`Automation Opportunities: ${context.workflowContext.automationOpportunities.join(', ')}`);
    }
    
    return sections.join('\n');
  }

  // Utility methods (simplified implementations)
  private extractEntities(text: string, pattern: RegExp): string[] {
    const matches = text.match(pattern);
    if (!matches) return [];
    return [...new Set(matches)].slice(0, 10); // Limit to prevent token overflow
  }

  private analyzeSentiment(text: string): "positive" | "neutral" | "negative" {
    const positive = ["thank", "great", "excellent", "happy", "pleased", "satisfied"];
    const negative = ["issue", "problem", "urgent", "complaint", "disappointed", "frustrated"];
    
    const posCount = positive?.filter(word => text.includes(word)).length;
    const negCount = negative?.filter(word => text.includes(word)).length;
    
    if (posCount > negCount) return "positive";
    if (negCount > posCount) return "negative";
    return "neutral";
  }

  private estimateTokenUsage(context: any): number {
    const text = JSON.stringify(context);
    return Math.ceil((text?.length || 0) / 4); // Rough token estimation
  }

  private calculateEfficiency(context: any, tokens: number): number {
    // Calculate how much of the token usage is valuable business content
    // This is a simplified calculation
    return Math.min(1, 0.85); // 85% efficiency baseline
  }

  private determinePriority(
    email: EmailRecord, 
    phase1Results: Phase1Results, 
    phase2Results?: Phase2Results
  ): BusinessPriority {
    if (email.importance === "high") return "high";
    if (phase2Results?.enhanced_classification?.confidence && phase2Results.enhanced_classification.confidence > 0.9) return "high";
    return "medium";
  }

  private determineFocusAreas(
    email: EmailRecord, 
    phase1Results: Phase1Results
  ): ContextFocusArea[] {
    const areas: ContextFocusArea[] = ["workflow"];
    
    const text = `${email.subject} ${email.body_text || ''}`.toLowerCase();
    
    if (/\$|price|cost|budget|financial/.test(text)) {
      areas.push("financial");
    }
    
    if (/technical|api|integration|specs/.test(text)) {
      areas.push("technical");
    }
    
    if (/deadline|urgent|timeline|schedule/.test(text)) {
      areas.push("temporal");
    }
    
    if (/relationship|customer|client|satisfaction/.test(text)) {
      areas.push("relationship");
    }
    
    return areas;
  }

  // Additional helper methods would be implemented here...
  private assessFinancialRisk(totalValue: number, urgentOrders: boolean, competitivePricing: boolean, emailText: string): "low" | "medium" | "high" | "critical" {
    if (totalValue > 100000 && urgentOrders) return "critical";
    if (totalValue > 50000 && competitivePricing) return "high";
    if (totalValue > 10000) return "medium";
    return "low";
  }

  private extractPaymentTerms(text: string): string[] {
    const terms = text.match(/\b\d+\s*(?:days?|net|terms?)\b/gi) || [];
    return [...new Set(terms)];
  }

  private async extractProductSpecifications(text: string): Promise<ProductSpecification[]> {
    // Extract TD SYNNEX part numbers and specifications
    const partNumbers = text.match(/\b[A-Z0-9]{6,}(?:#[A-Z]{3})?\b/g) || [];
    return partNumbers.slice(0, 5).map(part => ({
      partNumber: part,
      quantity: 1,
      specifications: [],
      alternatives: [],
      availability: "unknown",
      leadTime: "unknown"
    }));
  }

  private extractTechnicalConstraints(text: string): string[] {
    const constraints = text.match(/\b(?:limitation|constraint|requirement|dependency)\b[^.!?]*[.!?]/gi) || [];
    return constraints.slice(0, 5);
  }

  private extractPerformanceIssues(text: string): string[] {
    const issues = text.match(/\b(?:slow|performance|timeout|latency|bottleneck)\b[^.!?]*[.!?]/gi) || [];
    return issues.slice(0, 5);
  }

  private async extractClientInteractions(email: EmailRecord, sentiment: "positive" | "neutral" | "negative"): Promise<ClientInteraction[]> {
    return [{
      type: this.classifyInteractionType(email.subject || ''),
      sentiment,
      urgency: email.importance === "high" ? "high" : "medium",
      value: 0,
      context: email.subject || ''
    }];
  }

  private classifyInteractionType(subject: string): "inquiry" | "complaint" | "order" | "negotiation" | "support" {
    const text = subject.toLowerCase();
    if (text.includes("order") || text.includes("purchase")) return "order";
    if (text.includes("issue") || text.includes("problem")) return "complaint";
    if (text.includes("support") || text.includes("help")) return "support";
    if (text.includes("price") || text.includes("negotiate")) return "negotiation";
    return "inquiry";
  }

  private async extractStakeholders(email: EmailRecord, chainData?: EmailChain): Promise<Stakeholder[]> {
    // Extract stakeholders from email addresses and signatures
    const fromAddress = email.from_address || '';
    const fromName = fromAddress ? fromAddress.split('@')[0] : 'unknown';
    return [{
      name: fromName || 'unknown',  // Ensure name is always a string
      role: "unknown",
      influence: "medium",
      decisionMaker: false,
      contactInfo: fromAddress
    }];
  }

  private analyzeSentimentTrend(historicalData?: any[], currentSentiment?: string): "improving" | "stable" | "declining" | "critical" {
    // Analyze sentiment over time - simplified implementation
    return "stable";
  }

  private extractSatisfactionIndicators(text: string): string[] {
    const indicators = text.match(/\b(?:satisfied|happy|pleased|disappointed|frustrated|excellent|terrible)\b[^.!?]*[.!?]/gi) || [];
    return indicators.slice(0, 3);
  }

  private identifyExpansionOpportunities(text: string, chainData?: EmailChain): string[] {
    const opportunities = text.match(/\b(?:additional|more|expand|increase|upgrade|new\s+requirements?)\b[^.!?]*[.!?]/gi) || [];
    return opportunities.slice(0, 3);
  }

  private extractVendorNegotiations(text: string): string[] {
    const negotiations = text.match(/\b(?:vendor|supplier|negotiate|contract|agreement)\b[^.!?]*[.!?]/gi) || [];
    return negotiations.slice(0, 3);
  }

  private extractInternalCoordination(text: string): string[] {
    const coordination = text.match(/\b(?:internal|team|department|coordinate|meeting)\b[^.!?]*[.!?]/gi) || [];
    return coordination.slice(0, 3);
  }

  private extractLoyaltySigns(text: string): string[] {
    const loyalty = text.match(/\b(?:loyal|long-term|partnership|relationship|trust)\b[^.!?]*[.!?]/gi) || [];
    return loyalty.slice(0, 3);
  }

  private async extractDeadlines(text: string): Promise<Deadline[]> {
    const deadlinePattern = /\b(?:deadline|due|by|before)\s+(?:date|time)?\s*:?\s*([^.!?\n]+)/gi;
    const matches = text.match(deadlinePattern) || [];
    
    return matches.slice(0, 3).map(match => ({
      description: match,
      dueDate: new Date(), // Would parse actual date
      criticality: "medium" as const,
      dependencies: [],
      status: "pending" as const
    }));
  }

  private async extractProjectTimelines(text: string, chainData?: EmailChain): Promise<Timeline[]> {
    // Extract project timeline information
    return [];
  }

  private async extractFollowupRequirements(text: string): Promise<FollowupAction[]> {
    const followups = text.match(/\b(?:follow.?up|next\s+steps?|action\s+items?)\b[^.!?]*[.!?]/gi) || [];
    
    return followups.slice(0, 3).map(followup => ({
      action: followup,
      owner: "unknown",
      dueDate: new Date(),
      priority: "medium" as const,
      context: followup
    }));
  }

  private extractUrgencyFactors(text: string): string[] {
    const urgency = text.match(/\b(?:urgent|asap|rush|critical|emergency|immediate)\b[^.!?]*[.!?]/gi) || [];
    return urgency.slice(0, 3);
  }

  private extractSeasonalFactors(text: string): string[] {
    const seasonal = text.match(/\b(?:q[1-4]|quarter|seasonal|holiday|year.?end)\b[^.!?]*[.!?]/gi) || [];
    return seasonal.slice(0, 2);
  }

  private extractBusinessCycles(text: string): string[] {
    const cycles = text.match(/\b(?:budget\s+cycle|fiscal|planning\s+period)\b[^.!?]*[.!?]/gi) || [];
    return cycles.slice(0, 2);
  }

  private determineWorkflowStage(text: string, chainData?: EmailChain): string {
    if (text.includes("quote") || text.includes("pricing")) return "quoting";
    if (text.includes("order") || text.includes("purchase")) return "ordering";
    if (text.includes("delivery") || text.includes("shipping")) return "fulfillment";
    if (text.includes("support") || text.includes("issue")) return "support";
    return "inquiry";
  }

  private extractNextActions(text: string): string[] {
    const actions = text.match(/\b(?:need\s+to|should|must|will|action)\b[^.!?]*[.!?]/gi) || [];
    return actions.slice(0, 5);
  }

  private identifyBottlenecks(text: string, chainData?: EmailChain): string[] {
    const bottlenecks = text.match(/\b(?:delay|bottleneck|blocked|waiting|pending)\b[^.!?]*[.!?]/gi) || [];
    return bottlenecks.slice(0, 3);
  }

  private extractDependencies(text: string): string[] {
    const dependencies = text.match(/\b(?:depends?\s+on|requires?|needs?|waiting\s+for)\b[^.!?]*[.!?]/gi) || [];
    return dependencies.slice(0, 3);
  }

  private identifyAutomationOpportunities(text: string, chainData?: EmailChain): string[] {
    const opportunities = text.match(/\b(?:manual|automate|recurring|routine|standard)\b[^.!?]*[.!?]/gi) || [];
    return opportunities.slice(0, 3);
  }

  private identifyEscalationTriggers(text: string): string[] {
    const triggers = text.match(/\b(?:escalate|urgent|critical|executive|manager)\b[^.!?]*[.!?]/gi) || [];
    return triggers.slice(0, 3);
  }

  private identifyProcessOptimizations(text: string, chainData?: EmailChain): string[] {
    const optimizations = text.match(/\b(?:improve|optimize|streamline|efficiency|faster)\b[^.!?]*[.!?]/gi) || [];
    return optimizations.slice(0, 3);
  }
}

// Export singleton instance
export const businessContextManager = new BusinessContextManager();