/**
 * Stage 3 Critical Analysis
 * Performs critical analysis on processed emails
 */

import { logger } from '../../utils/logger';
import type { 
  Email, 
  CriticalAnalysisResult, 
  CriticalAnalysisResults,
  StageProcessor,
  PipelineContext,
  PipelineStage
} from './types';

export class Stage3CriticalAnalysis implements StageProcessor {
  constructor() {
    logger.debug('Stage3CriticalAnalysis initialized', 'STAGE3_CRITICAL_ANALYSIS');
  }

  async process(context: PipelineContext, stage: PipelineStage): Promise<CriticalAnalysisResults> {
    logger.info('Starting Stage 3 Critical Analysis', 'STAGE3_CRITICAL_ANALYSIS');

    try {
      const emails = this.extractEmails(context);
      
      if (!emails || emails.length === 0) {
        logger.warn('No emails found for critical analysis', 'STAGE3_CRITICAL_ANALYSIS');
        return this.createEmptyResults();
      }

      const results: CriticalAnalysisResult[] = [];
      let totalConfidence = 0;

      for (const email of emails) {
        const analysisResult = await this.analyzeEmail(email);
        results.push(analysisResult);
        totalConfidence += analysisResult.confidence;
      }

      const finalResults: CriticalAnalysisResults = {
        results,
        totalProcessed: results.length,
        averageConfidence: results.length > 0 ? totalConfidence / results.length : 0,
        timestamp: new Date()
      };

      logger.info(`Critical analysis completed: ${results.length} emails processed`, 'STAGE3_CRITICAL_ANALYSIS');
      return finalResults;

    } catch (error) {
      logger.error(`Critical analysis failed: ${error}`, 'STAGE3_CRITICAL_ANALYSIS');
      throw error;
    }
  }

  private extractEmails(context: PipelineContext): Email[] {
    if (context.metadata?.emails) {
      return context.metadata.emails;
    }

    for (const stage of context.stages) {
      if (stage.results?.emails) {
        return stage.results.emails;
      }
    }

    return [];
  }

  private async analyzeEmail(email: Email): Promise<CriticalAnalysisResult> {
    logger.debug(`Analyzing email: ${email.id}`, 'STAGE3_CRITICAL_ANALYSIS');

    const analysis: CriticalAnalysisResult = {
      id: `analysis_${email.id}_${Date.now()}`,
      emailId: email.id,
      confidence: this.calculateConfidence(email),
      categories: this.extractCategories(email),
      sentiment: this.analyzeSentiment(email),
      urgency: this.assessUrgency(email),
      keyPhrases: this.extractKeyPhrases(email),
      entities: this.extractEntities(email),
      summary: this.generateSummary(email),
      timestamp: new Date()
    };

    return analysis;
  }

  private calculateConfidence(email: Email): number {
    let confidence = 0.5;

    if (email.subject && email.subject.length > 5) {
      confidence += 0.1;
    }
    
    if (email.body && email.body.length > 50) {
      confidence += 0.2;
    }

    if (email.sender && email.sender.includes('@')) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private extractCategories(email: Email): string[] {
    const categories: string[] = [];
    const content = `${email.subject} ${email.body}`.toLowerCase();

    if (content.includes('urgent') || content.includes('asap')) {
      categories.push('urgent');
    }
    if (content.includes('meeting') || content.includes('schedule')) {
      categories.push('meeting');
    }
    if (content.includes('invoice') || content.includes('payment')) {
      categories.push('financial');
    }
    if (content.includes('support') || content.includes('help')) {
      categories.push('support');
    }

    return categories.length > 0 ? categories : ['general'];
  }

  private analyzeSentiment(email: Email): 'positive' | 'negative' | 'neutral' {
    const content = `${email.subject} ${email.body}`.toLowerCase();
    
    const positiveKeywords = ['great', 'excellent', 'good', 'thanks', 'appreciate'];
    const negativeKeywords = ['problem', 'issue', 'urgent', 'error', 'failed'];

    const positiveScore = positiveKeywords.reduce((score, keyword) => 
      score + (content.includes(keyword) ? 1 : 0), 0);
    const negativeScore = negativeKeywords.reduce((score, keyword) => 
      score + (content.includes(keyword) ? 1 : 0), 0);

    if (positiveScore > negativeScore) return 'positive';
    if (negativeScore > positiveScore) return 'negative';
    return 'neutral';
  }

  private assessUrgency(email: Email): 'low' | 'medium' | 'high' | 'critical' {
    const content = `${email.subject} ${email.body}`.toLowerCase();
    
    if (content.includes('critical') || content.includes('emergency')) {
      return 'critical';
    }
    if (content.includes('urgent') || content.includes('asap')) {
      return 'high';
    }
    if (content.includes('soon') || content.includes('priority')) {
      return 'medium';
    }
    
    return 'low';
  }

  private extractKeyPhrases(email: Email): string[] {
    const content = `${email.subject} ${email.body}`;
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    return sentences.slice(0, 3).map(s => s.trim());
  }

  private extractEntities(email: Email): { type: string; value: string; confidence: number; }[] {
    const entities: { type: string; value: string; confidence: number; }[] = [];
    const content = `${email.subject} ${email.body}`;

    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = content.match(emailRegex) || [];
    emails.forEach(email => {
      entities.push({ type: 'email', value: email, confidence: 0.9 });
    });

    const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
    const phones = content.match(phoneRegex) || [];
    phones.forEach(phone => {
      entities.push({ type: 'phone', value: phone, confidence: 0.8 });
    });

    return entities;
  }

  private generateSummary(email: Email): string {
    const maxLength = 200;
    let summary = email.body || email.subject || '';
    
    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength - 3) + '...';
    }
    
    return summary || 'No content available for summary';
  }

  private createEmptyResults(): CriticalAnalysisResults {
    return {
      results: [],
      totalProcessed: 0,
      averageConfidence: 0,
      timestamp: new Date()
    };
  }
}

export default Stage3CriticalAnalysis;