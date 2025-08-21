/**
 * Business Search Prompt Enhancer
 * Optimizes search prompts for business intelligence extraction
 */

export interface SearchContext {
  domain: 'email' | 'customer' | 'order' | 'general';
  priority: 'low' | 'medium' | 'high' | 'critical';
  entities?: string[];
  metadata?: Record<string, unknown>;
}

export interface EnhancedPrompt {
  system: string;
  user: string;
  context: SearchContext;
  optimizations: string[];
}

export interface BusinessSearchEnhancementOptions {
  enableEntityExtraction?: boolean;
  enableSentimentAnalysis?: boolean;
  enableWorkflowDetection?: boolean;
  maxContextLength?: number;
  priorityThreshold?: 'low' | 'medium' | 'high' | 'critical';
}

export class BusinessSearchPromptEnhancer {
  private static instance: BusinessSearchPromptEnhancer;

  static getInstance(): BusinessSearchPromptEnhancer {
    if (!BusinessSearchPromptEnhancer.instance) {
      BusinessSearchPromptEnhancer.instance = new BusinessSearchPromptEnhancer();
    }
    return BusinessSearchPromptEnhancer.instance;
  }

  enhancePrompt(basePrompt: string, context: SearchContext): EnhancedPrompt {
    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = this.buildUserPrompt(basePrompt, context);
    const optimizations = this.getOptimizations(context);

    return {
      system: systemPrompt,
      user: userPrompt,
      context,
      optimizations
    };
  }

  private buildSystemPrompt(context: SearchContext): string {
    const baseSystem = `You are an expert business intelligence analyst specializing in ${context.domain} analysis.`;
    
    const domainSpecific = {
      email: 'Focus on communication patterns, action items, and business relationships.',
      customer: 'Analyze customer behavior, preferences, and business value.',
      order: 'Extract order details, fulfillment status, and financial implications.',
      general: 'Provide comprehensive business insights across all domains.'
    };

    const priorityGuidance = {
      critical: 'This is time-sensitive. Prioritize immediate action items and escalation paths.',
      high: 'Focus on high-impact findings and strategic recommendations.',
      medium: 'Provide balanced analysis with actionable insights.',
      low: 'Conduct thorough analysis with detailed documentation.'
    };

    return `${baseSystem} ${domainSpecific[context.domain]} ${priorityGuidance[context.priority]}`;
  }

  private buildUserPrompt(basePrompt: string, context: SearchContext): string {
    let enhancedPrompt = basePrompt;

    if (context.entities && context?.entities?.length > 0) {
      enhancedPrompt += `\n\nPay special attention to these entities: ${context?.entities?.join(', ')}`;
    }

    if (context.metadata) {
      enhancedPrompt += `\n\nAdditional context: ${JSON.stringify(context.metadata)}`;
    }

    return enhancedPrompt;
  }

  private getOptimizations(context: SearchContext): string[] {
    const optimizations: string[] = [];

    switch (context.domain) {
      case 'email':
        optimizations.push('entity_extraction', 'sentiment_analysis', 'workflow_detection');
        break;
      case 'customer':
        optimizations.push('value_assessment', 'relationship_mapping', 'risk_analysis');
        break;
      case 'order':
        optimizations.push('financial_analysis', 'fulfillment_tracking', 'exception_detection');
        break;
      default:
        optimizations.push('comprehensive_analysis');
    }

    if (context.priority === 'critical') {
      optimizations.push('fast_processing', 'escalation_flagging');
    }

    return optimizations;
  }

  isAlreadyEnhanced(prompt: string): boolean {
    const enhancementMarkers = [
      'You are an expert business intelligence analyst',
      'Pay special attention to these entities:',
      'Additional context:',
      'This is time-sensitive',
      'Focus on high-impact findings'
    ];
    
    return enhancementMarkers.some(marker => prompt.includes(marker));
  }

  enhance(prompt: string, options?: BusinessSearchEnhancementOptions): EnhancedPrompt {
    const defaultContext: SearchContext = {
      domain: 'general',
      priority: options?.priorityThreshold || 'medium',
      entities: [],
      metadata: {}
    };

    return this.enhancePrompt(prompt, defaultContext);
  }
}