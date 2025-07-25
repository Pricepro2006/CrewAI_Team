/**
 * Pipeline Orchestrator
 * Manages and coordinates pipeline execution
 */

import { logger } from '../../utils/logger';
import { 
  PipelineContext, 
  PipelineStage, 
  PipelineExecutionResult, 
  StageProcessor,
  PipelineConfig,
  PipelineStatus,
  PipelineStatusInfo,
  PipelineSummary
} from './types';

export class PipelineOrchestrator {
  private processors: Map<string, StageProcessor> = new Map();
  private config: PipelineConfig;
  private currentStatus: PipelineStatusInfo = {
    status: 'pending',
    stage1Progress: 0,
    stage1_count: 0,
    stage2Progress: 0,
    stage2_count: 0,
    stage3Progress: 0,
    stage3_count: 0,
    totalProgress: 0
  };

  constructor(config: PipelineConfig = {}) {
    this.config = {
      maxConcurrentStages: 3,
      timeout: 300000, // 5 minutes
      retryCount: 3,
      retryDelay: 1000,
      ...config
    };
  }

  /**
   * Register a stage processor
   */
  registerProcessor(stageId: string, processor: StageProcessor): void {
    this.processors.set(stageId, processor);
    logger.debug(`Registered processor for stage: ${stageId}`, 'PIPELINE_ORCHESTRATOR');
  }

  /**
   * Execute a pipeline
   */
  async execute(context: PipelineContext): Promise<PipelineExecutionResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting pipeline execution: ${context.name}`, 'PIPELINE_ORCHESTRATOR');
      
      context.status = 'running';
      context.startTime = new Date();
      
      // Update status
      this.currentStatus.status = 'running';
      this.currentStatus.currentStage = context.stages[0]?.id;

      // Execute stages sequentially for now
      for (let i = 0; i < context.stages.length; i++) {
        const stage = context.stages[i];
        if (!stage) {
          logger.warn(`Stage at index ${i} is undefined`, 'PIPELINE_ORCHESTRATOR');
          continue;
        }
        
        this.currentStatus.currentStage = stage.id;
        
        await this.executeStage(context, stage);
        
        // Update progress based on stage
        if (stage.id === 'stage1') {
          this.currentStatus.stage1Progress = stage.progress || 0;
          this.currentStatus.stage1_count = this.currentStatus.stage1_count + 1;
        } else if (stage.id === 'stage2') {
          this.currentStatus.stage2Progress = stage.progress || 0;
          this.currentStatus.stage2_count = this.currentStatus.stage2_count + 1;
        } else if (stage.id === 'stage3') {
          this.currentStatus.stage3Progress = stage.progress || 0;
          this.currentStatus.stage3_count = this.currentStatus.stage3_count + 1;
        }
        
        this.currentStatus.totalProgress = Math.round(((i + 1) / context.stages.length) * 100);
        
        if (stage.status === 'failed') {
          context.status = 'failed';
          this.currentStatus.status = 'failed';
          break;
        }
      }

      if (context.status !== 'failed') {
        context.status = 'completed';
        this.currentStatus.status = 'completed';
        this.currentStatus.totalProgress = 100;
      }

      context.endTime = new Date();
      const duration = Date.now() - startTime;

      logger.info(`Pipeline execution ${context.status}: ${context.name} (${duration}ms)`, 'PIPELINE_ORCHESTRATOR');

      return {
        success: context.status === 'completed',
        context,
        duration,
        stage1Count: this.currentStatus.stage1_count,
        stage2Count: this.currentStatus.stage2_count,
        stage3Count: this.currentStatus.stage3_count,
        totalEmails: this.currentStatus.stage1_count + this.currentStatus.stage2_count + this.currentStatus.stage3_count,
        summary: {
          totalProcessed: this.currentStatus.stage1_count + this.currentStatus.stage2_count + this.currentStatus.stage3_count,
          executionTime: duration,
          success: true,
          message: `Pipeline completed with ${context.stages.length} stages`
        },
        stage1Results: context.stages.find(s => s.id === 'stage1')?.results || [],
        stage2Results: context.stages.find(s => s.id === 'stage2')?.results || [],
        stage3Results: context.stages.find(s => s.id === 'stage3')?.results || []
      };

    } catch (error) {
      context.status = 'failed';
      this.currentStatus.status = 'failed';
      context.endTime = new Date();
      const duration = Date.now() - startTime;

      logger.error(`Pipeline execution failed: ${error}`, 'PIPELINE_ORCHESTRATOR');

      return {
        success: false,
        context,
        error: error instanceof Error ? error.message : String(error),
        duration,
        stage1Count: this.currentStatus.stage1_count,
        stage2Count: this.currentStatus.stage2_count,
        stage3Count: this.currentStatus.stage3_count,
        totalEmails: this.currentStatus.stage1_count + this.currentStatus.stage2_count + this.currentStatus.stage3_count,
        summary: {
          totalProcessed: this.currentStatus.stage1_count + this.currentStatus.stage2_count + this.currentStatus.stage3_count,
          executionTime: duration,
          success: false,
          message: `Pipeline failed: ${error instanceof Error ? error.message : String(error)}`
        },
        stage1Results: context.stages.find(s => s.id === 'stage1')?.results || [],
        stage2Results: context.stages.find(s => s.id === 'stage2')?.results || [],
        stage3Results: context.stages.find(s => s.id === 'stage3')?.results || []
      };
    }
  }

  /**
   * Execute a single stage
   */
  private async executeStage(context: PipelineContext, stage: PipelineStage): Promise<void> {
    const processor = this.processors.get(stage.id);
    
    if (!processor) {
      throw new Error(`No processor registered for stage: ${stage.id}`);
    }

    try {
      logger.debug(`Executing stage: ${stage.name}`, 'PIPELINE_ORCHESTRATOR');
      
      stage.status = 'running';
      stage.startTime = new Date();
      stage.progress = 0;

      const results = await processor.process(context, stage);
      
      stage.results = results;
      stage.status = 'completed';
      stage.progress = 100;
      stage.endTime = new Date();

      logger.debug(`Stage completed: ${stage.name}`, 'PIPELINE_ORCHESTRATOR');

    } catch (error) {
      stage.status = 'failed';
      stage.error = error instanceof Error ? error.message : String(error);
      stage.endTime = new Date();

      logger.error(`Stage failed: ${stage.name} - ${stage.error}`, 'PIPELINE_ORCHESTRATOR');
      throw error;
    }
  }

  /**
   * Get pipeline status
   */
  getStatus(): PipelineStatusInfo {
    return { ...this.currentStatus };
  }

  /**
   * Get pipeline status for specific context (legacy method)
   */
  getContextStatus(context: PipelineContext): PipelineStatus {
    return context.status;
  }

  /**
   * Cancel pipeline execution
   */
  async cancel(context: PipelineContext): Promise<void> {
    context.status = 'failed';
    logger.info(`Pipeline cancelled: ${context.name}`, 'PIPELINE_ORCHESTRATOR');
  }

  /**
   * Run a three-stage pipeline with specific configuration
   */
  async runThreeStagePipeline(config: PipelineConfig = {}): Promise<PipelineExecutionResult> {
    const pipelineContext: PipelineContext = {
      id: `three-stage-${Date.now()}`,
      name: 'Three Stage Pipeline',
      description: 'Three-stage pipeline execution',
      status: 'pending',
      stages: [
        {
          id: 'stage1',
          name: 'Stage 1 - Initial Processing',
          description: 'First stage of processing',
          status: 'pending'
        },
        {
          id: 'stage2',
          name: 'Stage 2 - Analysis',
          description: 'Second stage analysis',
          status: 'pending'
        },
        {
          id: 'stage3',
          name: 'Stage 3 - Final Processing',
          description: 'Final stage processing',
          status: 'pending'
        }
      ]
    };

    // Update orchestrator config with provided config
    const mergedConfig = { ...this.config, ...config };
    const originalConfig = this.config;
    this.config = mergedConfig;

    try {
      const result = await this.execute(pipelineContext);
      return result;
    } finally {
      // Restore original config
      this.config = originalConfig;
    }
  }

  /**
   * Get all emails (for testing)
   */
  async getAllEmails(): Promise<any[]> {
    // Default implementation returns empty array
    // Can be overridden by tests
    return [];
  }

  /**
   * Stage 1 processor (for testing)
   */
  get stage1() {
    return {
      process: async (emails: any[]) => {
        logger.info(`Stage 1 processing ${emails.length} emails`, 'PIPELINE_ORCHESTRATOR');
        // Mock processing
        return emails.map(email => ({
          ...email,
          processed: true,
          stage: 'stage1'
        }));
      }
    };
  }

  /**
   * Save consolidated results (for testing)
   */
  async saveConsolidatedResults(results: any[]): Promise<void> {
    logger.info(`Saving ${results.length} consolidated results`, 'PIPELINE_ORCHESTRATOR');
    // Mock implementation
  }
}

/**
 * Export a default instance
 */
export const defaultOrchestrator = new PipelineOrchestrator();
export default PipelineOrchestrator;
