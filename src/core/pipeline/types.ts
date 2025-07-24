/**
 * Type definitions for the Three-Stage Pipeline
 */

export interface Email {
  id: string;
  subject: string;
  body: string;
  sender_email: string;
  recipient_emails?: string;
  date_received: string;
  raw_headers?: string;
  message_id?: string;
  in_reply_to?: string;
  thread_id?: string;
  labels?: string;
  attachments?: string;
  is_read?: boolean;
  is_starred?: boolean;
  folder?: string;
  created_at: string;
  updated_at: string;
}

export interface TriageResult {
  emailId: string;
  priorityScore: number;
  workflow: string;
  entities: {
    po_numbers: string[];
    quote_numbers: string[];
    case_numbers: string[];
    part_numbers: string[];
    companies: string[];
  };
  urgencyLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  businessProcess: string;
  processingTime: number;
}

export interface TriageResults {
  all: TriageResult[];
  top5000: Email[];
  top500: Email[];
}

export interface LlamaAnalysisResult {
  emailId: string;
  contextualSummary: string;
  workflowState: string;
  businessProcess: string;
  entities: {
    po_numbers: string[];
    quote_numbers: string[];
    case_numbers: string[];
    part_numbers: string[];
    companies: string[];
  };
  actionItems: Array<{
    task: string;
    details: string;
    assignee?: string;
    deadline?: string;
  }>;
  urgencyLevel: string;
  suggestedResponse: string;
  qualityScore?: number;
  processingTime: number;
  model: string;
  error?: string;
}

export type LlamaAnalysisResults = LlamaAnalysisResult[];

export interface CriticalAnalysisResult {
  emailId: string;
  executiveSummary: string;
  businessImpact: {
    revenue?: string;
    risk?: string;
    opportunity?: string;
  };
  keyStakeholders: string[];
  recommendedActions: Array<{
    action: string;
    priority: "HIGH" | "CRITICAL";
    owner: string;
    deadline: string;
  }>;
  strategicInsights: string;
  modelUsed: string;
  qualityScore?: number;
  processingTime: number;
  fallbackUsed?: boolean;
}

export type CriticalAnalysisResults = CriticalAnalysisResult[];

export interface PipelineResults {
  totalEmails: number;
  stage1Count: number;
  stage2Count: number;
  stage3Count: number;
  executionId: number;
  results: Array<{
    emailId: string;
    stage1: TriageResult;
    stage2: LlamaAnalysisResult | null;
    stage3: CriticalAnalysisResult | null;
    finalScore: number;
    pipelineStage: number;
  }>;
}

export interface PipelineStatus {
  status: "not_running" | "running" | "completed" | "failed";
  executionId?: number;
  id?: number; // Alias for executionId for backward compatibility
  startedAt?: string;
  completedAt?: string;
  stage1Progress?: number;
  stage2Progress?: number;
  stage3Progress?: number;
  stage1_count?: number; // Alias for stage1Progress
  stage2_count?: number; // Alias for stage2Progress
  stage3_count?: number; // Alias for stage3Progress
  estimatedCompletion?: string;
  errorMessage?: string;
  lastProcessedId?: number;
  currentStage?: number;
  processedCount?: number;
}
