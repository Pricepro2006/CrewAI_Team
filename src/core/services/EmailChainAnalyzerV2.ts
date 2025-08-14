/**
 * Email Chain Analyzer V2 - Refactored to use Repository Pattern
 *
 * Analyzes email chains to detect workflow completeness and patterns
 * Uses adaptive analysis based on chain characteristics
 */

import { EventEmitter } from "events";
import { Logger } from "../../utils/logger.js";
import { withUnitOfWork, type UnitOfWork as IUnitOfWork } from "../../database/UnitOfWork.js";
import type {
  EmailRecord,
  EmailPriority,
  AnalysisStatus,
} from "../../types/EmailTypes.js";
import {
  ChainType,
  ChainStage,
} from "../../types/ChainTypes.js";
import type {
  EmailChain,
  ChainCompleteness,
} from "../../types/ChainTypes.js";

const logger = Logger.getInstance();
const COMPONENT = "EmailChainAnalyzerV2";

// ============================================
// TYPE DEFINITIONS
// ============================================

interface ChainAnalysisResult {
  chain_id: string;
  conversation_id?: string;
  is_complete: boolean;
  completeness_score: number;
  chain_type: ChainType;
  workflow_state: string;
  missing_stages?: ChainStage[];
  key_entities?: Array<{
    type: string;
    value: string;
    count: number;
    first_seen: Date;
    last_seen: Date;
  }>;
}

interface EmailWithThread {
  id: string;
  subject: string;
  body_text?: string;
  body_preview?: string;
  sender_email: string;
  received_time: Date | string;  // Support both Date and string formats
  thread_emails?: EmailRecord[];
}

// ============================================
// ANALYZER CLASS
// ============================================

export class EmailChainAnalyzerV2 extends EventEmitter {
  constructor() {
    super();
  }

  /**
   * Analyze an email chain for completeness and patterns
   */
  async analyzeChain(email: EmailWithThread): Promise<ChainAnalysisResult> {
    return withUnitOfWork(async (uow) => {
      try {
        const startTime = Date.now();

        // Get thread emails from repository if not provided
        let threadEmails = email.thread_emails || [];

        if (threadEmails.length === 0 && email.id) {
          const emailRecord = await uow.emails.findById(email.id);
          if (emailRecord?.conversation_id) {
            threadEmails = await uow.emails.findByConversationId(
              emailRecord.conversation_id,
            );
          }
        }

        if (threadEmails.length === 0) {
          // Single email, not part of a chain
          return this.createSingleEmailResult(email);
        }

        // Sort emails by received time
        threadEmails.sort(
          (a, b) =>
            this.getDateValue(a.received_time).getTime() -
            this.getDateValue(b.received_time).getTime(),
        );

        // Detect chain type
        const chainType = this.detectChainType(threadEmails);

        // Analyze workflow stages
        const stages = this.detectWorkflowStages(threadEmails, chainType);

        // Calculate completeness
        const completeness = this.calculateCompleteness(stages, chainType);

        // Extract key entities across the chain
        const keyEntities = this.extractKeyEntities(threadEmails);

        // Determine workflow state
        const workflowState = this.determineWorkflowState(stages, completeness);

        // Check for existing chain in repository
        const conversationId = threadEmails[0]?.conversation_id || email.id;
        const existingChains = await uow.chains.findAll({ conversation_id: conversationId } as Partial<EmailChain>);
        const existingChain = existingChains.length > 0 ? existingChains[0] : null;

        const result: ChainAnalysisResult = {
          chain_id: existingChain?.chain_id || this.generateChainId(),
          conversation_id: conversationId,
          is_complete: completeness.is_complete,
          completeness_score: completeness.score,
          chain_type: chainType,
          workflow_state: workflowState,
          missing_stages: completeness.missing_stages,
          key_entities: keyEntities,
        };

        // Update or create chain in repository
        const firstEmail = threadEmails[0];
        const lastEmail = threadEmails[threadEmails.length - 1];

        const chainData: EmailChain = {
          id: existingChain?.id || "",
          chain_id: result.chain_id,
          conversation_id: conversationId,
          email_ids: threadEmails.map((e) => e.id),
          email_count: threadEmails.length,
          chain_type: chainType,
          completeness_score: completeness.score,
          is_complete: completeness.is_complete,
          missing_stages: completeness.missing_stages,
          start_time: firstEmail ? this.getDateValue(firstEmail.received_time) : new Date(),
          end_time: lastEmail ? this.getDateValue(lastEmail.received_time) : new Date(),
          duration_hours: 0,
          participants: this.extractParticipants(threadEmails),
          key_entities: keyEntities,
          workflow_state: workflowState,
          created_at: existingChain?.created_at || new Date(),
          last_analyzed: new Date(),
        };

        // Calculate duration
        chainData.duration_hours =
          (chainData.end_time.getTime() - chainData.start_time.getTime()) /
          (1000 * 60 * 60);

        // Upsert chain
        await uow.chains.upsert(chainData);

        // Emit analysis complete event
        const analysisTime = Date.now() - startTime;
        this.emit("chain:analyzed", {
          chainId: result.chain_id,
          completeness: completeness.score,
          analysisTime,
        });

        logger.info(
          `Chain analysis complete: ${result.chain_id} (${completeness.score}% complete)`,
        );

        return result;
      } catch (error) {
        logger.error("Chain analysis failed", COMPONENT, {}, error as Error);
        throw error;
      }
    });
  }

  /**
   * Create result for single email (not part of chain)
   */
  private createSingleEmailResult(email: EmailWithThread): ChainAnalysisResult {
    return {
      chain_id: this.generateChainId(),
      is_complete: false,
      completeness_score: 10, // Single email = 10% complete
      chain_type: ChainType.UNKNOWN,
      workflow_state: "initiated",
      missing_stages: [
        ChainStage.IN_PROGRESS,
        ChainStage.REVIEW,
        ChainStage.COMPLETION,
      ],
    };
  }

  /**
   * Detect the type of email chain
   */
  private detectChainType(emails: EmailRecord[]): ChainType {
    const allText = emails
      .map((e) => `${e.subject} ${e.body_text || ""}`)
      .join(" ")
      .toLowerCase();

    // Check for quote patterns
    if (allText.match(/quote|pricing|quotation|rfq/gi)) {
      return ChainType.QUOTE_REQUEST;
    }

    // Check for order patterns
    if (allText.match(/order|purchase|p\.?o\.?|invoice/gi)) {
      return ChainType.ORDER_PROCESSING;
    }

    // Check for support patterns
    if (allText.match(/ticket|issue|problem|support|help|case/gi)) {
      return ChainType.SUPPORT_TICKET;
    }

    // Check for project patterns
    if (allText.match(/project|timeline|milestone|deliverable/gi)) {
      return ChainType.PROJECT_DISCUSSION;
    }

    // Check for general inquiry patterns
    if (allText.match(/information|inquiry|question|interested/gi)) {
      return ChainType.GENERAL_INQUIRY;
    }

    return ChainType.UNKNOWN;
  }

  /**
   * Detect workflow stages present in the chain
   */
  private detectWorkflowStages(
    emails: EmailRecord[],
    chainType: ChainType,
  ): ChainStage[] {
    const stages: Set<ChainStage> = new Set();

    emails.forEach((email, index) => {
      const text = `${email.subject} ${email.body_text || ""}`.toLowerCase();

      // START stage - first email or initiation keywords
      if (
        index === 0 ||
        text.match(/request|inquiry|need|looking for|interested/gi)
      ) {
        stages.add(ChainStage.START);
      }

      // IN_PROGRESS stage - middle communications
      if (index > 0 && index < emails.length - 1) {
        stages.add(ChainStage.IN_PROGRESS);
      }

      // REVIEW stage - approval/review keywords
      if (text.match(/review|approve|confirm|verify|check/gi)) {
        stages.add(ChainStage.REVIEW);
      }

      // COMPLETION stage - closing keywords
      if (text.match(/complete|done|closed|resolved|thank you|delivered/gi)) {
        stages.add(ChainStage.COMPLETION);
      }
    });

    return Array.from(stages);
  }

  /**
   * Calculate chain completeness based on stages
   */
  private calculateCompleteness(
    presentStages: ChainStage[],
    chainType: ChainType,
  ): ChainCompleteness {
    // Define required stages by chain type
    const requiredStages = this.getRequiredStages(chainType);

    // Calculate what percentage of required stages are present
    const presentCount = presentStages.filter((stage) =>
      requiredStages.includes(stage),
    ).length;

    const score = Math.round((presentCount / requiredStages.length) * 100);

    // Find missing stages
    const missingStages = requiredStages.filter(
      (stage) => !presentStages.includes(stage),
    );

    return {
      score,
      is_complete: missingStages.length === 0,
      missing_stages: missingStages,
      confidence: score / 100,
    };
  }

  /**
   * Get required stages for chain type
   */
  private getRequiredStages(chainType: ChainType): ChainStage[] {
    switch (chainType) {
      case ChainType.QUOTE_REQUEST:
        return [
          ChainStage.START,
          ChainStage.IN_PROGRESS,
          ChainStage.REVIEW,
          ChainStage.COMPLETION,
        ];

      case ChainType.ORDER_PROCESSING:
        return [
          ChainStage.START,
          ChainStage.IN_PROGRESS,
          ChainStage.COMPLETION,
        ];

      case ChainType.SUPPORT_TICKET:
        return [
          ChainStage.START,
          ChainStage.IN_PROGRESS,
          ChainStage.COMPLETION,
        ];

      case ChainType.PROJECT_DISCUSSION:
        return [ChainStage.START, ChainStage.IN_PROGRESS, ChainStage.REVIEW];

      default:
        return [ChainStage.START, ChainStage.COMPLETION];
    }
  }

  /**
   * Extract key entities from email chain
   */
  private extractKeyEntities(emails: EmailRecord[]): Array<{
    type: string;
    value: string;
    count: number;
    first_seen: Date;
    last_seen: Date;
  }> {
    const entityMap = new Map<
      string,
      {
        type: string;
        count: number;
        first_seen: Date;
        last_seen: Date;
      }
    >();

    emails.forEach((email) => {
      const text = `${email.subject} ${email.body_text || ""}`;

      // Extract PO numbers
      const poNumbers = text.match(/\b(PO|P\.O\.|po)[\s#-]?\d{4,}/gi) || [];
      poNumbers.forEach((po) => {
        const key = `po:${po}`;
        this.updateEntityMap(entityMap, key, "po_number", this.getDateValue(email.received_time));
      });

      // Extract quote numbers
      const quotes = text.match(/\b(quote|QT|qt)[\s#-]?\d{4,}/gi) || [];
      quotes.forEach((quote) => {
        const key = `quote:${quote}`;
        this.updateEntityMap(
          entityMap,
          key,
          "quote_number",
          this.getDateValue(email.received_time),
        );
      });

      // Extract case numbers
      const cases = text.match(/\b(case|CS|cs)[\s#-]?\d{4,}/gi) || [];
      cases.forEach((caseNum) => {
        const key = `case:${caseNum}`;
        this.updateEntityMap(
          entityMap,
          key,
          "case_number",
          this.getDateValue(email.received_time),
        );
      });
    });

    // Convert map to array
    return Array.from(entityMap.entries()).map(([value, data]) => ({
      type: data.type,
      value: value.split(":")[1] || "",
      count: data.count,
      first_seen: data.first_seen,
      last_seen: data.last_seen,
    }));
  }

  /**
   * Update entity map helper
   */
  private updateEntityMap(
    map: Map<string, any>,
    key: string,
    type: string,
    receivedTime: Date,
  ): void {
    const existing = map.get(key);
    if (existing) {
      existing.count++;
      existing.last_seen = receivedTime;
    } else {
      map.set(key, {
        type,
        count: 1,
        first_seen: receivedTime,
        last_seen: receivedTime,
      });
    }
  }

  /**
   * Extract participants from email chain
   */
  private extractParticipants(emails: EmailRecord[]): string[] {
    const participants = new Set<string>();

    emails.forEach((email) => {
      participants.add(email.from_address);

      // Add recipients
      if (email.to_addresses) {
        email.to_addresses
          .split(",")
          .forEach((addr) => participants.add(addr.trim()));
      }
    });

    return Array.from(participants);
  }

  /**
   * Determine workflow state based on stages and completeness
   */
  private determineWorkflowState(
    stages: ChainStage[],
    completeness: ChainCompleteness,
  ): string {
    if (completeness.is_complete) {
      return "completed";
    }

    if (stages.includes(ChainStage.REVIEW)) {
      return "pending_review";
    }

    if (stages.includes(ChainStage.IN_PROGRESS)) {
      return "in_progress";
    }

    if (stages.includes(ChainStage.START)) {
      return "initiated";
    }

    return "unknown";
  }

  /**
   * Generate unique chain ID
   */
  private generateChainId(): string {
    return `chain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Helper method to convert Date or string to Date object
   */
  private getDateValue(value: Date | string | undefined): Date {
    if (!value) {
      return new Date();
    }
    if (value instanceof Date) {
      return value;
    }
    return new Date(value);
  }

  /**
   * Get chain statistics from repository
   */
  async getChainStatistics(): Promise<any> {
    return withUnitOfWork(async (uow) => {
      return await uow.chains.getChainStatistics();
    });
  }

  /**
   * Find chains needing reanalysis
   */
  async findChainsNeedingReanalysis(
    hoursOld: number = 24,
  ): Promise<EmailChain[]> {
    return withUnitOfWork(async (uow) => {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - hoursOld);

      return await uow.chains.findChainsNeedingReanalysis(cutoffDate);
    });
  }
}
