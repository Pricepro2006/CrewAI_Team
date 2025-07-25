/**
 * Stage 1: Pattern Triage
 * Initial analysis and pattern recognition stage
 */

import { logger } from '../../utils/logger';
import { PipelineContext, PipelineStage, StageProcessor } from './types';

export interface PatternTriageResult {
  patterns: string[];
  confidence: number;
  category: string;
  priority: 'low' | 'medium' | 'high';
  metadata: Record<string, any>;
  all?: any[];
  top5000?: any[];
  top500?: any[];
}

export class Stage1PatternTriage implements StageProcessor {
  
  /**
   * Process pattern triage stage
   */
  async process(context: PipelineContext, stage: PipelineStage): Promise<PatternTriageResult> {
    try {
      logger.info(`Processing Stage 1: Pattern Triage for ${context.name}`, 'STAGE1_TRIAGE');

      // Simulate pattern analysis
      const patterns = this.analyzePatterns(context);
      const confidence = this.calculateConfidence(patterns);
      const category = this.categorizeContent(patterns);
      const priority = this.determinePriority(confidence, category);

      const result: PatternTriageResult = {
        patterns,
        confidence,
        category,
        priority,
        metadata: {
          processedAt: new Date().toISOString(),
          stage: 'pattern-triage',
          version: '1.0.0'
        }
      };

      logger.info(`Stage 1 completed: Found ${patterns.length} patterns with ${confidence}% confidence`, 'STAGE1_TRIAGE');
      
      return result;

    } catch (error) {
      logger.error(`Stage 1 failed: ${error}`, 'STAGE1_TRIAGE');
      throw error;
    }
  }

  /**
   * Analyze patterns in content
   */
  private analyzePatterns(context: PipelineContext): string[] {
    const patterns: string[] = [];

    // Basic pattern detection logic
    if (context.metadata?.content) {
      const content = context.metadata.content.toLowerCase();
      
      if (content.includes('email')) patterns.push('email-communication');
      if (content.includes('meeting')) patterns.push('meeting-request');
      if (content.includes('urgent')) patterns.push('urgent-priority');
      if (content.includes('deadline')) patterns.push('deadline-sensitive');
      if (content.includes('document')) patterns.push('document-request');
    }

    return patterns.length > 0 ? patterns : ['general-content'];
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(patterns: string[]): number {
    if (patterns.length === 0) return 0;
    if (patterns.includes('general-content')) return 50;
    
    // Higher confidence for more specific patterns
    return Math.min(95, 60 + (patterns.length * 10));
  }

  /**
   * Categorize content based on patterns
   */
  private categorizeContent(patterns: string[]): string {
    if (patterns.includes('email-communication')) return 'communication';
    if (patterns.includes('meeting-request')) return 'scheduling';
    if (patterns.includes('document-request')) return 'documentation';
    if (patterns.includes('urgent-priority')) return 'priority';
    
    return 'general';
  }

  /**
   * Determine processing priority
   */
  private determinePriority(confidence: number, category: string): 'low' | 'medium' | 'high' {
    if (category === 'priority' || confidence > 90) return 'high';
    if (confidence > 70 || category === 'communication') return 'medium';
    return 'low';
  }
}

/**
 * Export default instance
 */
export const defaultStage1 = new Stage1PatternTriage();
export default Stage1PatternTriage;
