/**
 * Pipeline Types
 * Core type definitions for the pipeline system
 */

export interface PipelineStage {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  progress?: number;
  results?: any;
  error?: string;
}

export interface PipelineContext {
  id: string;
  name: string;
  description?: string;
  stages: PipelineStage[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  metadata?: Record<string, any>;
}

export interface PipelineSummary {
  totalProcessed: number;
  executionTime: number;
  success: boolean;
  message?: string;
}

export interface PipelineExecutionResult {
  success: boolean;
  context: PipelineContext;
  results?: any;
  error?: string;
  duration?: number;
  stage2Count?: number;
  stage3Count?: number;
  stage1Count?: number;
  totalEmails?: number;
  summary?: PipelineSummary;
  stage1Results?: any;
  stage2Results?: any;
  stage3Results?: any;
}

export interface StageProcessor {
  process(context: PipelineContext, stage: PipelineStage): Promise<any>;
}

export interface PipelineConfig {
  maxConcurrentStages?: number;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  stage2Limit?: number;
  stage3Limit?: number;
  batchSize?: number;
  mockMode?: boolean;
  resumeFromCheckpoint?: boolean;
  maxConcurrency?: number;
}

/**
 * Email processing types
 */
export interface Email {
  id: string;
  subject: string;
  body: string;
  sender: string;
  recipient: string;
  timestamp: Date;
  attachments?: string[];
  priority?: 'low' | 'medium' | 'high';
  status?: 'unread' | 'read' | 'processed';
}

export interface CriticalAnalysisResult {
  id: string;
  emailId: string;
  confidence: number;
  categories: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  keyPhrases: string[];
  entities: {
    type: string;
    value: string;
    confidence: number;
  }[];
  summary: string;
  timestamp: Date;
}

export interface CriticalAnalysisResults {
  results: CriticalAnalysisResult[];
  totalProcessed: number;
  averageConfidence: number;
  timestamp: Date;
}

/**
 * Pipeline status object with detailed progress information
 */
export interface PipelineStatusInfo {
  status: 'pending' | 'running' | 'completed' | 'failed';
  stage1Progress: number;
  stage1_count: number;
  stage2Progress: number;
  stage2_count: number;
  stage3Progress: number;
  stage3_count: number;
  currentStage?: string;
  totalProgress?: number;
}

/**
 * Export common pipeline types
 */
export type PipelineStatus = 'pending' | 'running' | 'completed' | 'failed';
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed';
