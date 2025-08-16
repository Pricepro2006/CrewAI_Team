/**
 * ThreadContextManager - Multi-turn context preservation for email threads
 * 
 * Maintains coherent business context across email chains while optimizing
 * for token limits and preserving critical business intelligence
 */

import { Logger } from "../../utils/logger.js";
import { RedisService } from "../cache/RedisService.js";
import type { EmailRecord } from "../../types/EmailTypes.js";
import type { EmailChain } from "../../types/ChainTypes.js";
import type { BusinessContext } from "./BusinessContextManager.js";
import type { Phase1Results, Phase2Results, Phase3Results } from "../../types/AnalysisTypes.js";

const logger = new Logger("ThreadContextManager");

// Thread Context Types
export interface ThreadContext {
  chainId: string;
  conversationId: string;
  businessContext: BusinessContext;
  chronologicalFlow: ChronologicalEntry[];
  keyDecisions: BusinessDecision[];
  stakeholderMap: StakeholderMap;
  evolutionTimeline: ContextEvolution[];
  contextSummary: ThreadSummary;
  tokenUsage: ThreadTokenUsage;
}

export interface ChronologicalEntry {
  emailId: string;
  timestamp: Date;
  sender: string;
  keyPoints: string[];
  businessImpact: BusinessImpact;
  contextChanges: ContextChange[];
  analysisQuality: "high" | "medium" | "low";
}

export interface BusinessDecision {
  decisionId: string;
  description: string;
  decisionMaker: string;
  timestamp: Date;
  impact: "critical" | "high" | "medium" | "low";
  affectedStakeholders: string[];
  consequences: string[];
  reversibility: "reversible" | "partially_reversible" | "irreversible";
}

export interface StakeholderMap {
  primaryDecisionMakers: Stakeholder[];
  technicalContacts: Stakeholder[];
  financialApprovers: Stakeholder[];
  influencers: Stakeholder[];
  relationshipHistory: RelationshipHistory[];
}

export interface Stakeholder {
  email: string;
  name?: string;
  role: string;
  organization: string;
  influence: "high" | "medium" | "low";
  responsePattern: "fast" | "slow" | "sporadic";
  communicationStyle: "formal" | "casual" | "technical";
  decisionAuthority: string[];
}

export interface RelationshipHistory {
  stakeholderEmail: string;
  interactionCount: number;
  sentimentTrend: "improving" | "stable" | "declining";
  lastInteraction: Date;
  keyTopics: string[];
  issuesRaised: string[];
  satisfactionLevel: "high" | "medium" | "low" | "unknown";
}

export interface ContextEvolution {
  timestamp: Date;
  changeType: "new_requirement" | "scope_change" | "stakeholder_change" | "priority_shift" | "technical_change";
  description: string;
  impact: "minor" | "moderate" | "significant" | "critical";
  causedBy: string; // email ID or external factor
  businessImplications: string[];
}

export interface ThreadSummary {
  executiveSummary: string;
  currentStatus: string;
  nextCriticalActions: string[];
  keyRisks: string[];
  opportunitiesIdentified: string[];
  totalBusinessValue: number;
  timelineStatus: "on_track" | "at_risk" | "delayed" | "unknown";
  confidenceLevel: number;
}

export interface ThreadTokenUsage {
  totalCapacity: number;
  usedTokens: number;
  contextCompressionRatio: number;
  prioritizedContent: number; // percentage of high-priority content
  lastOptimization: Date;
}

export interface BusinessImpact {
  financialImpact: number;
  operationalImpact: "positive" | "negative" | "neutral";
  strategicImportance: "critical" | "high" | "medium" | "low";
  customerRelationshipImpact: "strengthening" | "stable" | "straining";
  timelineImpact: "accelerating" | "neutral" | "delaying";
}

export interface ContextChange {
  field: string;
  previousValue: any;
  newValue: any;
  changeSignificance: "critical" | "important" | "minor";
  businessRationale: string;
}

// Context Preservation Options
export interface ThreadContextOptions {
  maxHistoryEntries: number;
  compressionThreshold: number; // token count threshold for compression
  preserveDecisions: boolean;
  includeStakeholderHistory: boolean;
  focusOnBusinessValue: boolean;
  optimizeForModel: "llama3.2" | "phi-4";
  retentionPolicy: "full" | "smart_compression" | "summary_only";
}

// Thread Context Manager Class
export class ThreadContextManager {
  private redisService: RedisService;
  private contextCache: Map<string, ThreadContext> = new Map();
  private readonly defaultTTL = 7 * 24 * 60 * 60; // 7 days in seconds

  constructor(redisUrl?: string) {
    this.redisService = new RedisService(
      redisUrl ? {
        host: redisUrl.split("://")[1]?.split(":")[0] || "localhost",
        port: parseInt(redisUrl.split(":").pop() || "6379"),
      } : undefined
    );
  }

  /**
   * Build comprehensive thread context for email chain analysis
   */
  async buildThreadContext(
    chain: EmailChain,
    emails: EmailRecord[],
    businessContext: BusinessContext,
    options: ThreadContextOptions = this.getDefaultOptions()
  ): Promise<ThreadContext> {
    const startTime = Date.now();
    logger.info(`Building thread context for chain ${chain.chain_id} with ${emails?.length || 0} emails`);

    // Check for existing context
    const existingContext = await this.getExistingContext(chain.chain_id);
    
    // Build chronological flow
    const chronologicalFlow = await this.buildChronologicalFlow(emails, existingContext?.chronologicalFlow);
    
    // Extract key business decisions
    const keyDecisions = await this.extractBusinessDecisions(emails, chronologicalFlow);
    
    // Build stakeholder map
    const stakeholderMap = await this.buildStakeholderMap(emails, existingContext?.stakeholderMap);
    
    // Track context evolution
    const evolutionTimeline = await this.trackContextEvolution(
      emails, 
      existingContext?.evolutionTimeline || []
    );
    
    // Generate thread summary
    const contextSummary = await this.generateThreadSummary(
      chronologicalFlow,
      keyDecisions,
      businessContext,
      options
    );
    
    // Calculate token usage and optimize
    const tokenUsage = await this.calculateTokenUsage(
      chronologicalFlow,
      keyDecisions,
      stakeholderMap,
      options
    );

    const threadContext: ThreadContext = {
      chainId: chain.chain_id,
      conversationId: chain.conversation_id,
      businessContext,
      chronologicalFlow,
      keyDecisions,
      stakeholderMap,
      evolutionTimeline,
      contextSummary,
      tokenUsage
    };

    // Apply optimization if needed
    const optimizedContext = await this.optimizeContextForTokens(threadContext, options);
    
    // Cache the context
    await this.cacheThreadContext(optimizedContext);
    
    const processingTime = Date.now() - startTime;
    logger.info(`Thread context built in ${processingTime}ms for chain ${chain.chain_id}`);
    
    return optimizedContext;
  }

  /**
   * Update thread context with new email
   */
  async updateThreadContext(
    chainId: string,
    newEmail: EmailRecord,
    newAnalysis: Phase1Results | Phase2Results | Phase3Results,
    options: ThreadContextOptions = this.getDefaultOptions()
  ): Promise<ThreadContext> {
    const existingContext = await this.getExistingContext(chainId);
    
    if (!existingContext) {
      throw new Error(`No existing context found for chain ${chainId}`);
    }

    // Add new chronological entry
    const newEntry = await this.createChronologicalEntry(newEmail, newAnalysis);
    existingContext?.chronologicalFlow?.push(newEntry);
    
    // Update business decisions if any
    const newDecisions = await this.extractDecisionsFromEmail(newEmail, newAnalysis);
    existingContext?.keyDecisions?.push(...newDecisions);
    
    // Update stakeholder map
    await this.updateStakeholderMap(existingContext.stakeholderMap, newEmail);
    
    // Track context evolution
    const contextChanges = await this.detectContextChanges(existingContext, newEmail, newAnalysis);
    if (contextChanges?.length || 0 > 0) {
      existingContext?.evolutionTimeline?.push({
        timestamp: new Date(),
        changeType: this.classifyContextChange(contextChanges),
        description: `Context updated with email ${newEmail.id}`,
        impact: this.assessChangeImpact(contextChanges),
        causedBy: newEmail.id,
        businessImplications: contextChanges?.map(c => c.businessRationale)
      });
    }
    
    // Regenerate summary
    existingContext.contextSummary = await this.generateThreadSummary(
      existingContext.chronologicalFlow,
      existingContext.keyDecisions,
      existingContext.businessContext,
      options
    );
    
    // Optimize if token usage exceeds threshold
    const optimizedContext = await this.optimizeContextForTokens(existingContext, options);
    
    // Update cache
    await this.cacheThreadContext(optimizedContext);
    
    return optimizedContext;
  }

  /**
   * Generate optimized context for LLM analysis
   */
  async generateLLMContext(
    chainId: string,
    contextType: "phase2" | "phase3",
    maxTokens: number = 4000
  ): Promise<string> {
    const threadContext = await this.getExistingContext(chainId);
    
    if (!threadContext) {
      return "No thread context available";
    }

    if (contextType === "phase2") {
      return this.formatForPhase2(threadContext, maxTokens);
    } else {
      return this.formatForPhase3(threadContext, maxTokens);
    }
  }

  /**
   * Build chronological flow of the email thread
   */
  private async buildChronologicalFlow(
    emails: EmailRecord[],
    existingFlow?: ChronologicalEntry[]
  ): Promise<ChronologicalEntry[]> {
    const sortedEmails = emails.sort((a, b) => 
      new Date(a.received_time).getTime() - new Date(b.received_time).getTime()
    );

    const chronologicalFlow: ChronologicalEntry[] = [];
    
    for (const email of sortedEmails) {
      // Check if this email is already in existing flow
      const existing = existingFlow?.find(entry => entry.emailId === email.id);
      if (existing) {
        chronologicalFlow.push(existing);
        continue;
      }

      // Create new entry
      const entry: ChronologicalEntry = {
        emailId: email.id,
        timestamp: new Date(email.received_time),
        sender: email.from_address,
        keyPoints: await this.extractKeyPoints(email),
        businessImpact: await this.assessBusinessImpact(email),
        contextChanges: [],
        analysisQuality: this.assessAnalysisQuality(email)
      };

      chronologicalFlow.push(entry);
    }

    return chronologicalFlow;
  }

  /**
   * Extract key business decisions from emails
   */
  private async extractBusinessDecisions(
    emails: EmailRecord[],
    chronologicalFlow: ChronologicalEntry[]
  ): Promise<BusinessDecision[]> {
    const decisions: BusinessDecision[] = [];
    
    for (const email of emails) {
      const emailText = `${email.subject} ${email.body_text || ''}`.toLowerCase();
      
      // Look for decision indicators
      const decisionIndicators = [
        /\b(?:decided|decision|approve|approved|reject|rejected|choose|chosen|select|selected)\b/gi,
        /\b(?:go ahead|proceed|stop|halt|cancel|cancelled|postpone|delay)\b/gi,
        /\b(?:budget approved|budget rejected|funding approved|authorized)\b/gi
      ];

      for (const pattern of decisionIndicators) {
        const matches = emailText.match(pattern);
        if (matches && matches?.length || 0 > 0) {
          const decision: BusinessDecision = {
            decisionId: `${email.id}_${decisions?.length || 0}`,
            description: this.extractDecisionDescription(emailText, matches[0]),
            decisionMaker: email.from_address,
            timestamp: new Date(email.received_time),
            impact: this.assessDecisionImpact(emailText),
            affectedStakeholders: this.extractAffectedStakeholders(email),
            consequences: this.extractConsequences(emailText),
            reversibility: this.assessReversibility(emailText)
          };
          
          decisions.push(decision);
        }
      }
    }

    return decisions;
  }

  /**
   * Build stakeholder map from email participants
   */
  private async buildStakeholderMap(
    emails: EmailRecord[],
    existingMap?: StakeholderMap
  ): Promise<StakeholderMap> {
    const stakeholderMap: StakeholderMap = existingMap || {
      primaryDecisionMakers: [],
      technicalContacts: [],
      financialApprovers: [],
      influencers: [],
      relationshipHistory: []
    };

    // Extract all unique participants
    const participants = new Set<string>();
    emails.forEach(email => {
      participants.add(email.from_address);
      if (email.to_addresses) {
        email?.to_addresses?.split(',').forEach(addr => participants.add(addr.trim()));
      }
    });

    // Analyze each participant
    for (const email of participants) {
      const existingStakeholder = this.findStakeholderInMap(stakeholderMap, email);
      
      if (!existingStakeholder) {
        const stakeholder = await this.analyzeStakeholder(email, emails);
        this.categorizeStakeholder(stakeholderMap, stakeholder);
      } else {
        // Update existing stakeholder
        await this.updateStakeholderAnalysis(existingStakeholder, emails);
      }
    }

    return stakeholderMap;
  }

  /**
   * Track context evolution over time
   */
  private async trackContextEvolution(
    emails: EmailRecord[],
    existingTimeline: ContextEvolution[]
  ): Promise<ContextEvolution[]> {
    const evolutionTimeline = [...existingTimeline];
    
    // Analyze emails for context changes
    for (let i = 1; i < emails?.length || 0; i++) {
      const prevEmail = emails[i - 1];
      const currentEmail = emails[i];
      
      const changes = await this.detectEvolutionChanges(prevEmail, currentEmail);
      evolutionTimeline.push(...changes);
    }

    return evolutionTimeline.sort((a, b) => a?.timestamp?.getTime() - b?.timestamp?.getTime());
  }

  /**
   * Generate comprehensive thread summary
   */
  private async generateThreadSummary(
    chronologicalFlow: ChronologicalEntry[],
    keyDecisions: BusinessDecision[],
    businessContext: BusinessContext,
    options: ThreadContextOptions
  ): Promise<ThreadSummary> {
    // Calculate total business value
    const totalBusinessValue = chronologicalFlow.reduce(
      (sum, entry) => sum + (entry?.businessImpact?.financialImpact || 0), 
      0
    );

    // Determine current status
    const currentStatus = this.determineCurrentStatus(chronologicalFlow, keyDecisions);
    
    // Extract next critical actions
    const nextCriticalActions = this.extractNextActions(chronologicalFlow, keyDecisions);
    
    // Identify key risks
    const keyRisks = this.identifyThreadRisks(chronologicalFlow, businessContext);
    
    // Find opportunities
    const opportunitiesIdentified = this.identifyOpportunities(chronologicalFlow, businessContext);
    
    // Assess timeline status
    const timelineStatus = this.assessTimelineStatus(chronologicalFlow, businessContext);
    
    // Calculate confidence level
    const confidenceLevel = this.calculateThreadConfidence(chronologicalFlow, keyDecisions);

    return {
      executiveSummary: `Email thread analysis: ${chronologicalFlow?.length || 0} emails, ${keyDecisions?.length || 0} key decisions, $${totalBusinessValue} business value`,
      currentStatus,
      nextCriticalActions,
      keyRisks,
      opportunitiesIdentified,
      totalBusinessValue,
      timelineStatus,
      confidenceLevel
    };
  }

  /**
   * Optimize context for token constraints
   */
  private async optimizeContextForTokens(
    context: ThreadContext,
    options: ThreadContextOptions
  ): Promise<ThreadContext> {
    const currentTokens = this.estimateContextTokens(context);
    
    if (currentTokens <= options.compressionThreshold) {
      return context;
    }

    logger.info(`Optimizing context: ${currentTokens} tokens exceeds threshold ${options.compressionThreshold}`);

    const optimized = { ...context };

    // Apply compression strategies based on retention policy
    switch (options.retentionPolicy) {
      case "smart_compression":
        optimized.chronologicalFlow = await this.compressChronologicalFlow(
          context.chronologicalFlow,
          options
        );
        break;
      
      case "summary_only":
        optimized.chronologicalFlow = await this.createSummaryFlow(
          context.chronologicalFlow,
          options
        );
        break;
      
      case "full":
        // Keep full context but trim less important entries
        optimized.chronologicalFlow = this.trimLowPriorityEntries(
          context.chronologicalFlow,
          options
        );
        break;
    }

    // Update token usage
    optimized.tokenUsage = await this.calculateTokenUsage(
      optimized.chronologicalFlow,
      optimized.keyDecisions,
      optimized.stakeholderMap,
      options
    );

    return optimized;
  }

  /**
   * Format context for Phase 2 analysis (Llama 3.2)
   */
  private formatForPhase2(context: ThreadContext, maxTokens: number): string {
    const sections = [];
    
    // Executive summary (always included)
    sections.push(`THREAD SUMMARY: ${context?.contextSummary?.executiveSummary}`);
    
    // Current status and risks
    sections.push(`STATUS: ${context?.contextSummary?.currentStatus}`);
    if (context?.contextSummary?.keyRisks?.length || 0 > 0) {
      sections.push(`RISKS: ${context?.contextSummary?.keyRisks.slice(0, 3).join(', ')}`);
    }
    
    // Recent context (last 3 emails)
    const recentFlow = context?.chronologicalFlow?.slice(-3);
    if (recentFlow?.length || 0 > 0) {
      sections.push('RECENT ACTIVITY:');
      recentFlow.forEach((entry, index) => {
        sections.push(`${index + 1}. ${entry.sender}: ${entry?.keyPoints?.slice(0, 2).join(', ')}`);
      });
    }
    
    // Key decisions
    if (context?.keyDecisions?.length > 0) {
      const criticalDecisions = context.keyDecisions
        .filter(d => d.impact === 'critical' || d.impact === 'high')
        .slice(-2);
      
      if (criticalDecisions?.length || 0 > 0) {
        sections.push('KEY DECISIONS:');
        criticalDecisions.forEach(decision => {
          sections.push(`- ${decision.description} (${decision.impact})`);
        });
      }
    }
    
    // Business value context
    if (context?.contextSummary?.totalBusinessValue > 0) {
      sections.push(`BUSINESS VALUE: $${context?.contextSummary?.totalBusinessValue}`);
    }

    let formatted = sections.join('\n');
    
    // Ensure we don't exceed token limit
    const estimatedTokens = Math.ceil(formatted?.length || 0 / 4);
    if (estimatedTokens > maxTokens) {
      const targetLength = maxTokens * 4 * 0.9; // 90% of max to be safe
      formatted = formatted.substring(0, targetLength) + '...';
    }
    
    return formatted;
  }

  /**
   * Format context for Phase 3 analysis (Phi-4)
   */
  private formatForPhase3(context: ThreadContext, maxTokens: number): string {
    const sections = [];
    
    // Comprehensive executive summary
    sections.push('=== EXECUTIVE THREAD ANALYSIS ===');
    sections.push(`Summary: ${context?.contextSummary?.executiveSummary}`);
    sections.push(`Business Value: $${context?.contextSummary?.totalBusinessValue}`);
    sections.push(`Confidence: ${Math.round(context?.contextSummary?.confidenceLevel * 100)}%`);
    sections.push(`Timeline Status: ${context?.contextSummary?.timelineStatus}`);
    
    // Complete chronological flow (up to token limit)
    sections.push('\n=== COMPLETE THREAD HISTORY ===');
    context?.chronologicalFlow?.forEach((entry, index) => {
      sections.push(`${index + 1}. [${entry?.timestamp?.toISOString().split('T')[0]}] ${entry.sender}`);
      sections.push(`   Key Points: ${entry?.keyPoints?.join(', ')}`);
      sections.push(`   Business Impact: $${entry?.businessImpact?.financialImpact}, ${entry?.businessImpact?.strategicImportance}`);
    });
    
    // Strategic decisions
    if (context?.keyDecisions?.length > 0) {
      sections.push('\n=== STRATEGIC DECISIONS ===');
      context?.keyDecisions?.forEach((decision, index) => {
        sections.push(`${index + 1}. ${decision.description}`);
        sections.push(`   Decision Maker: ${decision.decisionMaker}`);
        sections.push(`   Impact: ${decision.impact}, Reversibility: ${decision.reversibility}`);
        sections.push(`   Consequences: ${decision?.consequences?.join(', ')}`);
      });
    }
    
    // Stakeholder analysis
    sections.push('\n=== STAKEHOLDER LANDSCAPE ===');
    sections.push(`Decision Makers: ${context?.stakeholderMap?.primaryDecisionMakers?.length || 0}`);
    sections.push(`Technical Contacts: ${context?.stakeholderMap?.technicalContacts?.length || 0}`);
    sections.push(`Financial Approvers: ${context?.stakeholderMap?.financialApprovers?.length || 0}`);
    
    // Context evolution
    if (context?.evolutionTimeline?.length > 0) {
      sections.push('\n=== CONTEXT EVOLUTION ===');
      const significantChanges = context.evolutionTimeline
        .filter(change => change.impact === 'significant' || change.impact === 'critical')
        .slice(-5);
      
      significantChanges.forEach((change, index) => {
        sections.push(`${index + 1}. [${change.changeType}] ${change.description}`);
        sections.push(`   Impact: ${change.impact}`);
        if (change?.businessImplications?.length > 0) {
          sections.push(`   Implications: ${change.businessImplications[0]}`);
        }
      });
    }
    
    // Risk and opportunity analysis
    sections.push('\n=== STRATEGIC ASSESSMENT ===');
    sections.push(`Key Risks: ${context?.contextSummary?.keyRisks.join(', ')}`);
    sections.push(`Opportunities: ${context?.contextSummary?.opportunitiesIdentified.join(', ')}`);
    sections.push(`Next Actions: ${context?.contextSummary?.nextCriticalActions.join(', ')}`);

    let formatted = sections.join('\n');
    
    // Optimize for token limit
    const estimatedTokens = Math.ceil(formatted?.length || 0 / 4);
    if (estimatedTokens > maxTokens) {
      const targetLength = maxTokens * 4 * 0.9;
      formatted = formatted.substring(0, targetLength) + '\n\n[Context truncated due to token limits]';
    }
    
    return formatted;
  }

  // Utility and helper methods...

  private getDefaultOptions(): ThreadContextOptions {
    return {
      maxHistoryEntries: 50,
      compressionThreshold: 6000,
      preserveDecisions: true,
      includeStakeholderHistory: true,
      focusOnBusinessValue: true,
      optimizeForModel: "llama3.2",
      retentionPolicy: "smart_compression"
    };
  }

  private async getExistingContext(chainId: string): Promise<ThreadContext | null> {
    // Try cache first
    if (this?.contextCache?.has(chainId)) {
      return this?.contextCache?.get(chainId)!;
    }

    // Try Redis
    try {
      const cached = await this?.redisService?.getHash(`thread_context:${chainId}`);
      if (cached) {
        const context = JSON.parse(cached.data || '{}') as ThreadContext;
        this?.contextCache?.set(chainId, context);
        return context;
      }
    } catch (error) {
      logger.error(`Failed to retrieve context for chain ${chainId}:`, error as string);
    }

    return null;
  }

  private async cacheThreadContext(context: ThreadContext): Promise<void> {
    // Update in-memory cache
    this?.contextCache?.set(context.chainId, context);

    // Update Redis cache
    try {
      await this?.redisService?.setHash(
        `thread_context:${context.chainId}`,
        { data: JSON.stringify(context) },
        this.defaultTTL
      );
    } catch (error) {
      logger.error(`Failed to cache context for chain ${context.chainId}:`, error as string);
    }
  }

  private estimateContextTokens(context: ThreadContext): number {
    const serialized = JSON.stringify(context);
    return Math.ceil(serialized?.length || 0 / 4);
  }

  // Additional helper methods would be implemented here...
  // These are simplified implementations for the core functionality

  private async extractKeyPoints(email: EmailRecord): Promise<string[]> {
    const text = `${email.subject} ${email.body_text || ''}`;
    // Extract key business points using pattern matching
    const patterns = [
      /\$[\d,]+(?:\.\d{2})?/g, // Dollar amounts
      /\b(?:PO|P\.O\.|po)[\s#-]?\d{4,}/gi, // PO numbers
      /\b(?:deadline|due|urgent|asap)\b[^.!?]*[.!?]/gi, // Urgency
      /\b(?:decision|approve|reject|choose)\b[^.!?]*[.!?]/gi // Decisions
    ];
    
    const keyPoints: string[] = [];
    patterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      keyPoints.push(...matches.slice(0, 2));
    });
    
    return keyPoints.slice(0, 5);
  }

  private async assessBusinessImpact(email: EmailRecord): Promise<BusinessImpact> {
    const text = `${email.subject} ${email.body_text || ''}`.toLowerCase();
    
    // Extract financial impact
    const dollarMatches = text.match(/\$[\d,]+(?:\.\d{2})?/g) || [];
    const financialImpact = dollarMatches.reduce((sum: any, amount: any) => {
      const numValue = parseFloat(amount.replace(/[$,]/g, ''));
      return sum + (isNaN(numValue) ? 0 : numValue);
    }, 0);

    // Determine strategic importance
    let strategicImportance: "critical" | "high" | "medium" | "low" = "medium";
    if (financialImpact > 100000 || /\b(?:critical|urgent|executive)\b/.test(text)) {
      strategicImportance = "critical";
    } else if (financialImpact > 25000 || /\b(?:important|priority)\b/.test(text)) {
      strategicImportance = "high";
    }

    return {
      financialImpact,
      operationalImpact: /\b(?:improve|optimize|streamline)\b/.test(text) ? "positive" : "neutral",
      strategicImportance,
      customerRelationshipImpact: this.assessRelationshipImpact(text),
      timelineImpact: /\b(?:delay|postpone)\b/.test(text) ? "delaying" : "neutral"
    };
  }

  private assessRelationshipImpact(text: string): "strengthening" | "stable" | "straining" {
    const positive = ["thank", "pleased", "satisfied", "excellent"];
    const negative = ["disappointed", "frustrated", "issue", "problem"];
    
    const posCount = positive?.filter(word => text.includes(word)).length;
    const negCount = negative?.filter(word => text.includes(word)).length;
    
    if (posCount > negCount) return "strengthening";
    if (negCount > posCount) return "straining";
    return "stable";
  }

  private assessAnalysisQuality(email: EmailRecord): "high" | "medium" | "low" {
    const hasSubject = !!email.subject && email?.subject?.length > 5;
    const hasBody = !!email.body_text && email?.body_text?.length > 50;
    const hasMetadata = !!email.from_address && !!email.received_time;
    
    if (hasSubject && hasBody && hasMetadata) return "high";
    if ((hasSubject || hasBody) && hasMetadata) return "medium";
    return "low";
  }

  // More helper methods would be implemented...
  private extractDecisionDescription(text: string, match: string): string {
    // Extract context around the decision keyword
    const index = text.indexOf(match.toLowerCase());
    const start = Math.max(0, index - 50);
    const end = Math.min(text?.length || 0, index + 100);
    return text.substring(start, end).trim();
  }

  private assessDecisionImpact(text: string): "critical" | "high" | "medium" | "low" {
    if (/\b(?:critical|urgent|executive|budget|major)\b/.test(text)) return "critical";
    if (/\b(?:important|significant|priority)\b/.test(text)) return "high";
    if (/\b(?:minor|small|routine)\b/.test(text)) return "low";
    return "medium";
  }

  private extractAffectedStakeholders(email: EmailRecord): string[] {
    const stakeholders = [email.from_address];
    if (email.to_addresses) {
      stakeholders.push(...email?.to_addresses?.split(',').map(addr => addr.trim()));
    }
    return [...new Set(stakeholders)];
  }

  private extractConsequences(text: string): string[] {
    const consequences = text.match(/\b(?:result|consequence|impact|effect)\b[^.!?]*[.!?]/gi) || [];
    return consequences.slice(0, 3);
  }

  private assessReversibility(text: string): "reversible" | "partially_reversible" | "irreversible" {
    if (/\b(?:final|permanent|irreversible|committed)\b/.test(text)) return "irreversible";
    if (/\b(?:trial|test|temporary|provisional)\b/.test(text)) return "reversible";
    return "partially_reversible";
  }

  private async createChronologicalEntry(
    email: EmailRecord,
    analysis: Phase1Results | Phase2Results | Phase3Results
  ): Promise<ChronologicalEntry> {
    return {
      emailId: email.id,
      timestamp: new Date(email.received_time),
      sender: email.from_address,
      keyPoints: await this.extractKeyPoints(email),
      businessImpact: await this.assessBusinessImpact(email),
      contextChanges: [],
      analysisQuality: this.assessAnalysisQuality(email)
    };
  }

  private async extractDecisionsFromEmail(
    email: EmailRecord,
    analysis: Phase1Results | Phase2Results | Phase3Results
  ): Promise<BusinessDecision[]> {
    // Implementation would extract decisions from the new email
    return [];
  }

  private async updateStakeholderMap(map: StakeholderMap, email: EmailRecord): Promise<void> {
    // Implementation would update stakeholder information
  }

  private async detectContextChanges(
    context: ThreadContext,
    email: EmailRecord,
    analysis: Phase1Results | Phase2Results | Phase3Results
  ): Promise<ContextChange[]> {
    // Implementation would detect changes in context
    return [];
  }

  private classifyContextChange(changes: ContextChange[]): ContextEvolution["changeType"] {
    // Classify the type of context change
    return "new_requirement";
  }

  private assessChangeImpact(changes: ContextChange[]): ContextEvolution["impact"] {
    // Assess the impact of context changes
    return "moderate";
  }

  // Additional utility methods...
  private findStakeholderInMap(map: StakeholderMap, email: string): Stakeholder | undefined {
    const allStakeholders = [
      ...map.primaryDecisionMakers,
      ...map.technicalContacts,
      ...map.financialApprovers,
      ...map.influencers
    ];
    return allStakeholders.find(s => s.email === email);
  }

  private async analyzeStakeholder(email: string, emails: EmailRecord[]): Promise<Stakeholder> {
    // Analyze stakeholder based on email patterns
    return {
      email,
      role: "unknown",
      organization: email.split('@')[1] || 'unknown',
      influence: "medium",
      responsePattern: "sporadic",
      communicationStyle: "formal",
      decisionAuthority: []
    };
  }

  private categorizeStakeholder(map: StakeholderMap, stakeholder: Stakeholder): void {
    // Categorize stakeholder based on analysis
    map?.influencers?.push(stakeholder);
  }

  private async updateStakeholderAnalysis(stakeholder: Stakeholder, emails: EmailRecord[]): Promise<void> {
    // Update existing stakeholder analysis
  }

  private async detectEvolutionChanges(prevEmail: EmailRecord, currentEmail: EmailRecord): Promise<ContextEvolution[]> {
    // Detect evolution changes between emails
    return [];
  }

  private determineCurrentStatus(flow: ChronologicalEntry[], decisions: BusinessDecision[]): string {
    if (flow?.length || 0 === 0) return "No activity";
    
    const lastEntry = flow[flow?.length || 0 - 1];
    const recentDecisions = decisions?.filter(d => 
      d?.timestamp?.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000 // Last 7 days
    );

    if (recentDecisions?.length || 0 > 0) {
      return `Active - ${recentDecisions?.length || 0} recent decisions`;
    }

    return `Active - last activity from ${lastEntry?.sender || 'Unknown'}`;
  }

  private extractNextActions(flow: ChronologicalEntry[], decisions: BusinessDecision[]): string[] {
    // Extract next actions from recent activity
    const actions: string[] = [];
    
    // Look at recent emails for action items
    const recentEntries = flow.slice(-3);
    recentEntries.forEach(entry => {
      entry?.keyPoints?.forEach(point => {
        if (/\b(?:need|should|must|action|follow.?up)\b/.test(point.toLowerCase())) {
          actions.push(point);
        }
      });
    });

    return actions.slice(0, 5);
  }

  private identifyThreadRisks(flow: ChronologicalEntry[], context: BusinessContext): string[] {
    const risks: string[] = [];
    
    // Look for risk indicators in recent activity
    const recentEntries = flow.slice(-5);
    recentEntries.forEach(entry => {
      if (entry?.businessImpact?.timelineImpact === "delaying") {
        risks.push("Timeline delays detected");
      }
      if (entry?.businessImpact?.customerRelationshipImpact === "straining") {
        risks.push("Customer relationship concerns");
      }
    });

    // Add financial risks
    if (context?.financialContext?.riskLevel === "high" || context?.financialContext?.riskLevel === "critical") {
      risks.push(`Financial risk: ${context?.financialContext?.riskLevel}`);
    }

    return [...new Set(risks)];
  }

  private identifyOpportunities(flow: ChronologicalEntry[], context: BusinessContext): string[] {
    const opportunities: string[] = [];
    
    // Look for positive business impacts
    flow.forEach(entry => {
      if (entry?.businessImpact?.operationalImpact === "positive") {
        opportunities.push("Process improvement opportunity");
      }
      if (entry?.businessImpact?.customerRelationshipImpact === "strengthening") {
        opportunities.push("Relationship strengthening opportunity");
      }
    });

    // Add expansion opportunities from relationship context
    if (context.relationshipContext?.expansionOpportunities?.length || 0 > 0) {
      opportunities.push(...context?.relationshipContext?.expansionOpportunities.slice(0, 2));
    }

    return [...new Set(opportunities)];
  }

  private assessTimelineStatus(flow: ChronologicalEntry[], context: BusinessContext): ThreadSummary["timelineStatus"] {
    const delayingEntries = flow?.filter(entry => entry?.businessImpact?.timelineImpact === "delaying");
    const acceleratingEntries = flow?.filter(entry => entry?.businessImpact?.timelineImpact === "accelerating");
    
    if (delayingEntries?.length || 0 > acceleratingEntries?.length || 0) {
      return delayingEntries?.length || 0 > 2 ? "delayed" : "at_risk";
    }
    
    if (acceleratingEntries?.length || 0 > 0) {
      return "on_track";
    }
    
    return "unknown";
  }

  private calculateThreadConfidence(flow: ChronologicalEntry[], decisions: BusinessDecision[]): number {
    if (flow?.length || 0 === 0) return 0;
    
    const highQualityEntries = flow?.filter(entry => entry.analysisQuality === "high").length;
    const totalEntries = flow?.length || 0;
    const qualityRatio = highQualityEntries / totalEntries;
    
    const decisionConfidence = decisions?.length || 0 > 0 ? 0.9 : 0.7;
    const activityConfidence = Math.min(1, totalEntries / 5); // More activity = higher confidence
    
    return (qualityRatio * 0.4 + decisionConfidence * 0.3 + activityConfidence * 0.3);
  }

  private async calculateTokenUsage(
    flow: ChronologicalEntry[],
    decisions: BusinessDecision[],
    stakeholderMap: StakeholderMap,
    options: ThreadContextOptions
  ): Promise<ThreadTokenUsage> {
    const contextData = { flow, decisions, stakeholderMap };
    const serialized = JSON.stringify(contextData);
    const usedTokens = Math.ceil(serialized?.length || 0 / 4);
    
    const modelCapacity = options.optimizeForModel === "llama3.2" ? 8000 : 16000;
    const totalCapacity = Math.floor(modelCapacity * 0.6); // Reserve 40% for instructions and response
    
    return {
      totalCapacity,
      usedTokens,
      contextCompressionRatio: usedTokens / totalCapacity,
      prioritizedContent: 85, // Percentage of high-priority content
      lastOptimization: new Date()
    };
  }

  private async compressChronologicalFlow(
    flow: ChronologicalEntry[],
    options: ThreadContextOptions
  ): Promise<ChronologicalEntry[]> {
    // Keep most recent entries and high-impact entries
    const recentEntries = flow.slice(-10);
    const highImpactEntries = flow
      .filter(entry => 
        entry?.businessImpact?.strategicImportance === "critical" || 
        entry?.businessImpact?.strategicImportance === "high"
      )
      .filter(entry => !recentEntries.includes(entry))
      .slice(-5);
    
    return [...highImpactEntries, ...recentEntries];
  }

  private async createSummaryFlow(
    flow: ChronologicalEntry[],
    options: ThreadContextOptions
  ): Promise<ChronologicalEntry[]> {
    // Create summary entries for different time periods
    const summaryFlow: ChronologicalEntry[] = [];
    
    // Keep last 3 entries as full detail
    const recentEntries = flow.slice(-3);
    summaryFlow.push(...recentEntries);
    
    // Summarize older entries by time periods
    const olderEntries = flow.slice(0, -3);
    if (olderEntries?.length || 0 > 0) {
      const summaryEntry: ChronologicalEntry = {
        emailId: "summary_older",
        timestamp: olderEntries[0].timestamp,
        sender: "System Summary",
        keyPoints: [`Summary of ${olderEntries?.length || 0} earlier emails`],
        businessImpact: this.aggregateBusinessImpact(olderEntries),
        contextChanges: [],
        analysisQuality: "medium"
      };
      summaryFlow.unshift(summaryEntry);
    }
    
    return summaryFlow;
  }

  private trimLowPriorityEntries(
    flow: ChronologicalEntry[],
    options: ThreadContextOptions
  ): ChronologicalEntry[] {
    // Remove entries with low business impact and low analysis quality
    return flow?.filter(entry => 
      entry.analysisQuality !== "low" || 
      entry?.businessImpact?.strategicImportance !== "low"
    );
  }

  private aggregateBusinessImpact(entries: ChronologicalEntry[]): BusinessImpact {
    const totalFinancial = entries.reduce((sum: any, entry: any) => sum + entry?.businessImpact?.financialImpact, 0);
    const strategicImportance = entries.some(entry => 
      entry?.businessImpact?.strategicImportance === "critical"
    ) ? "critical" : "medium";
    
    return {
      financialImpact: totalFinancial,
      operationalImpact: "neutral",
      strategicImportance,
      customerRelationshipImpact: "stable",
      timelineImpact: "neutral"
    };
  }

  /**
   * Cleanup method to free resources
   */
  async shutdown(): Promise<void> {
    await this?.redisService?.disconnect();
    this?.contextCache?.clear();
    logger.info("ThreadContextManager shutdown complete");
  }
}

// Export singleton instance
export const threadContextManager = new ThreadContextManager();