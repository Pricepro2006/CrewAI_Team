/**
 * Business Search Prompt Enhancer
 * Optimizes search prompts for business intelligence extraction
 */
export class BusinessSearchPromptEnhancer {
    static instance;
    static getInstance() {
        if (!BusinessSearchPromptEnhancer.instance) {
            BusinessSearchPromptEnhancer.instance = new BusinessSearchPromptEnhancer();
        }
        return BusinessSearchPromptEnhancer.instance;
    }
    enhancePrompt(basePrompt, context) {
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
    buildSystemPrompt(context) {
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
    buildUserPrompt(basePrompt, context) {
        let enhancedPrompt = basePrompt;
        if (context.entities && context?.entities?.length > 0) {
            enhancedPrompt += `\n\nPay special attention to these entities: ${context?.entities?.join(', ')}`;
        }
        if (context.metadata) {
            enhancedPrompt += `\n\nAdditional context: ${JSON.stringify(context.metadata)}`;
        }
        return enhancedPrompt;
    }
    getOptimizations(context) {
        const optimizations = [];
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
    isAlreadyEnhanced(prompt) {
        const enhancementMarkers = [
            'You are an expert business intelligence analyst',
            'Pay special attention to these entities:',
            'Additional context:',
            'This is time-sensitive',
            'Focus on high-impact findings'
        ];
        return enhancementMarkers.some(marker => prompt.includes(marker));
    }
    enhance(prompt, options) {
        const defaultContext = {
            domain: 'general',
            priority: options?.priorityThreshold || 'medium',
            entities: [],
            metadata: {}
        };
        return this.enhancePrompt(prompt, defaultContext);
    }
}
