/**
 * Stage 1: Pattern-Based Triage
 * Uses the iteration script patterns for rapid email classification
 */

import { logger } from "../../utils/logger.js";
import { MODEL_CONFIG } from "../../config/models.config.js";
import type { Email, TriageResult, TriageResults } from "./types.js";

export class Stage1PatternTriage {
  // Entity extraction patterns (90% accuracy from 6 iterations)
  private readonly PO_PATTERNS = [
    /\b(?:PO|P\.O\.?|Purchase Order)\s*[#:]?\s*(\d{8,})/gi,
    /\b(?:BO|B\.O\.?|Book Order)\s*[#:]?\s*(\d+)/gi,
    /\b(?:SO|S\.O\.?|Sales Order)\s*[#:]?\s*(\d+)/gi,
    /\b(?:WO|W\.O\.?|Work Order)\s*[#:]?\s*(\d+)/gi,
    /\bLYPO[-#]?\s*(\d+)/gi,
  ];

  private readonly QUOTE_PATTERNS = [
    /\bFTQ[-]\w+/gi,
    /\bQ[-]\d+[-]\w+/gi,
    /\bF5Q[-]\w+/gi,
    /\bQuote\s*[#:]?\s*(\w+)/gi,
  ];

  private readonly CASE_PATTERNS = [
    /\bCAS[-]\d+[-]\w+/gi,
    /\b(?:case|ticket)\s*[#:]?\s*(\d+)/gi,
    /\bSR[-]\d+/gi,
  ];

  private readonly PART_PATTERNS = [
    /\b[A-Z0-9]{4,}(?:#[A-Z]{2,4})?/g,
    /\bSKU\s*[#:]?\s*([A-Z0-9]+)/gi,
    /\bPN\s*[#:]?\s*([A-Z0-9]+)/gi,
  ];

  private readonly URGENCY_KEYWORDS = {
    CRITICAL: [
      "urgent",
      "critical",
      "emergency",
      "asap",
      "immediately",
      "escalation",
    ],
    HIGH: ["priority", "important", "soon", "quickly", "expedite"],
    MEDIUM: ["update", "follow up", "check", "review"],
    LOW: ["fyi", "information", "reference"],
  };

  private readonly WORKFLOW_PATTERNS = {
    COMPLETION: [
      "completed",
      "done",
      "finished",
      "shipped",
      "delivered",
      "resolved",
    ],
    IN_PROGRESS: [
      "processing",
      "working on",
      "in progress",
      "pending",
      "reviewing",
    ],
    WAITING: ["waiting", "need", "require", "missing", "blocked"],
    START_POINT: ["new", "request", "inquiry", "quote request", "please"],
  };

  /**
   * Process all emails through pattern-based triage
   */
  async process(emails: Email[]): Promise<TriageResults> {
    const startTime = Date.now();
    const batchSize = MODEL_CONFIG.batchSizes.pattern;
    const results: TriageResult[] = [];

    logger.info(
      `Starting pattern triage for ${emails.length} emails`,
      "STAGE1",
    );

    // Process in batches
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchResults = await this.processBatch(batch);
      results.push(...batchResults);

      // Progress logging
      const processed = Math.min(i + batchSize, emails.length);
      const progress = ((processed / emails.length) * 100).toFixed(1);
      logger.info(
        `Stage 1 Progress: ${processed}/${emails.length} (${progress}%)`,
        "STAGE1",
      );
    }

    const totalTime = (Date.now() - startTime) / 1000;
    logger.info(
      `Pattern triage completed in ${totalTime.toFixed(2)}s`,
      "STAGE1",
    );

    // Prioritize emails
    return this.prioritizeEmails(results, emails);
  }

  /**
   * Process a batch of emails
   */
  private async processBatch(emails: Email[]): Promise<TriageResult[]> {
    return emails.map((email) => this.analyzeEmail(email));
  }

  /**
   * Analyze a single email using patterns
   */
  private analyzeEmail(email: Email): TriageResult {
    const startTime = Date.now();
    const text = `${email.subject} ${email.body}`;

    // Extract entities
    const entities = {
      po_numbers: this.extractPatterns(text, this.PO_PATTERNS),
      quote_numbers: this.extractPatterns(text, this.QUOTE_PATTERNS),
      case_numbers: this.extractPatterns(text, this.CASE_PATTERNS),
      part_numbers: this.extractPartNumbers(text),
      companies: this.extractCompanies(text),
    };

    // Determine urgency
    const urgencyLevel = this.determineUrgency(text);

    // Determine workflow state
    const workflow = this.determineWorkflow(text);

    // Determine business process
    const businessProcess = this.determineBusinessProcess(entities, text);

    // Calculate priority score
    const priorityScore = this.calculatePriorityScore(
      entities,
      urgencyLevel,
      workflow,
    );

    const processingTime = (Date.now() - startTime) / 1000;

    return {
      emailId: email.id,
      priorityScore,
      workflow,
      entities,
      urgencyLevel,
      businessProcess,
      processingTime,
    };
  }

  /**
   * Extract patterns from text
   */
  private extractPatterns(text: string, patterns: RegExp[]): string[] {
    const results = new Set<string>();

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        results.add(match[1] || match[0]);
      }
    }

    return Array.from(results);
  }

  /**
   * Extract part numbers with special handling
   */
  private extractPartNumbers(text: string): string[] {
    const parts = new Set<string>();

    // Standard part patterns
    const firstPattern = this.PART_PATTERNS[0];
    if (!firstPattern) return [];
    const matches = text.matchAll(firstPattern);
    for (const match of matches) {
      const part = match[0];
      // Filter out common false positives
      if (part.length >= 5 && !this.isCommonWord(part)) {
        parts.add(part);
      }
    }

    // SKU and PN patterns
    this.extractPatterns(text, this.PART_PATTERNS.slice(1)).forEach((p) =>
      parts.add(p),
    );

    return Array.from(parts);
  }

  /**
   * Extract company names
   */
  private extractCompanies(text: string): string[] {
    const companies = new Set<string>();
    const suffixes = [
      "INC",
      "LLC",
      "CORP",
      "LTD",
      "CO",
      "COMPANY",
      "CORPORATION",
    ];

    // Look for company patterns
    const pattern = new RegExp(
      `\\b([A-Z][\\w\\s&]+?)\\s*(${suffixes.join("|")})\\b`,
      "gi",
    );
    const matches = text.matchAll(pattern);

    for (const match of matches) {
      companies.add(match[0].trim());
    }

    // Also check for known companies (could be loaded from config)
    const knownCompanies = ["TD SYNNEX", "HP", "Dell", "Microsoft", "Cisco"];
    for (const company of knownCompanies) {
      if (text.includes(company)) {
        companies.add(company);
      }
    }

    return Array.from(companies);
  }

  /**
   * Determine urgency level
   */
  private determineUrgency(
    text: string,
  ): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
    const lowerText = text.toLowerCase();

    for (const [level, keywords] of Object.entries(this.URGENCY_KEYWORDS)) {
      if (keywords.some((keyword) => lowerText.includes(keyword))) {
        return level as any;
      }
    }

    return "MEDIUM";
  }

  /**
   * Determine workflow state
   */
  private determineWorkflow(text: string): string {
    const lowerText = text.toLowerCase();

    for (const [state, patterns] of Object.entries(this.WORKFLOW_PATTERNS)) {
      if (patterns.some((pattern) => lowerText.includes(pattern))) {
        return state;
      }
    }

    return "START_POINT";
  }

  /**
   * Determine business process
   */
  private determineBusinessProcess(entities: any, text: string): string {
    if (entities.po_numbers.length > 0) {
      return "Order Management";
    }
    if (entities.quote_numbers.length > 0) {
      return "Quote Processing";
    }
    if (entities.case_numbers.length > 0) {
      return "Support Case";
    }
    if (
      text.toLowerCase().includes("ship") ||
      text.toLowerCase().includes("freight")
    ) {
      return "Shipping & Logistics";
    }

    return "General Inquiry";
  }

  /**
   * Calculate priority score (0-100)
   */
  private calculatePriorityScore(
    entities: any,
    urgency: string,
    workflow: string,
  ): number {
    let score = 0;

    // Urgency weight (0-40)
    const urgencyScores = { CRITICAL: 40, HIGH: 30, MEDIUM: 20, LOW: 10 };
    score += urgencyScores[urgency as keyof typeof urgencyScores] || 20;

    // Entity weight (0-30)
    const entityCount =
      entities.po_numbers.length +
      entities.quote_numbers.length +
      entities.case_numbers.length;
    score += Math.min(entityCount * 10, 30);

    // Workflow weight (0-20)
    const workflowScores = {
      WAITING: 20,
      IN_PROGRESS: 15,
      START_POINT: 10,
      COMPLETION: 5,
    };
    score += workflowScores[workflow as keyof typeof workflowScores] || 10;

    // Business value weight (0-10)
    if (entities.po_numbers.length > 0) score += 10;
    else if (entities.quote_numbers.length > 0) score += 8;
    else if (entities.case_numbers.length > 0) score += 6;

    return Math.min(score, 100);
  }

  /**
   * Check if a string is a common word (to filter false positives)
   */
  private isCommonWord(word: string): boolean {
    const common = ["FROM", "SENT", "DATE", "TIME", "EMAIL", "SUBJECT"];
    return common.includes(word.toUpperCase());
  }

  /**
   * Prioritize emails based on scores
   */
  private prioritizeEmails(
    results: TriageResult[],
    emails: Email[],
  ): TriageResults {
    // Sort by priority score (descending)
    const sorted = results.sort((a, b) => b.priorityScore - a.priorityScore);

    // Create email map for quick lookup
    const emailMap = new Map(emails.map((e) => [e.id, e]));

    // Get top emails (adjusted for CPU inference practicality)
    const top5000Ids = sorted.slice(0, 1000).map((r) => r.emailId); // Now top 1000
    const top500Ids = sorted.slice(0, 100).map((r) => r.emailId); // Now top 100

    return {
      all: sorted,
      top5000: top5000Ids.map((id) => emailMap.get(id)!).filter(Boolean), // Actually top 1000
      top500: top500Ids.map((id) => emailMap.get(id)!).filter(Boolean), // Actually top 100
    };
  }
}
