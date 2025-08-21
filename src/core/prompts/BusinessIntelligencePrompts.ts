/**
 * Business Intelligence Prompts
 * Structured prompts for business analysis and intelligence extraction
 */

export const BusinessIntelligencePrompts = {
  /**
   * Extract key business metrics from email content
   */
  extractMetrics: `
    Analyze the following email and extract key business metrics:
    - Revenue figures
    - Order quantities
    - Customer information
    - Product details
    - Timeline/dates
    - Business impact
    
    Email content: {content}
    
    Return as structured JSON with the following fields:
    - revenue: number or null
    - orderCount: number or null
    - customerName: string or null
    - products: string[]
    - dates: string[]
    - impact: 'high' | 'medium' | 'low'
  `,

  /**
   * Identify business entities
   */
  identifyEntities: `
    Extract the following business entities from the email:
    - Purchase order numbers
    - Quote numbers
    - Case/ticket numbers
    - Part/product numbers
    - Company names
    - Contact names
    
    Email content: {content}
    
    Return as structured JSON with arrays for each entity type.
  `,

  /**
   * Analyze business context
   */
  analyzeContext: `
    Analyze the business context of this email thread:
    - What is the main business purpose?
    - What actions are required?
    - What is the urgency level?
    - What are the dependencies?
    
    Email thread: {thread}
    
    Return a structured analysis with actionable insights.
  `,

  /**
   * Generate business summary
   */
  generateSummary: `
    Create a concise business summary of this email:
    - Key points (max 3)
    - Required actions
    - Business impact
    - Next steps
    
    Email content: {content}
    
    Keep the summary under 200 words and focus on business value.
  `,

  /**
   * Detect patterns
   */
  detectPatterns: `
    Identify recurring patterns in these emails:
    - Common issues
    - Frequent requests
    - Trending topics
    - Seasonal patterns
    
    Emails: {emails}
    
    Return pattern analysis with frequency and significance.
  `
};

/**
 * Prompt template builder
 */
export class PromptBuilder {
  private template: string;
  private variables: Record<string, any> = {};

  constructor(template: string) {
    this.template = template;
  }

  /**
   * Set a variable value
   */
  set(key: string, value: any): this {
    this.variables[key] = value;
    return this;
  }

  /**
   * Build the final prompt
   */
  build(): string {
    let prompt = this.template;
    
    Object.entries(this.variables).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      const replacement = typeof value === 'object' 
        ? JSON.stringify(value, null, 2)
        : String(value);
      
      prompt = prompt.replace(new RegExp(placeholder, 'g'), replacement);
    });
    
    return prompt.trim();
  }
}

/**
 * Create a prompt from template
 */
export function createPrompt(template: string, variables: Record<string, any>): string {
  const builder = new PromptBuilder(template);
  
  Object.entries(variables).forEach(([key, value]) => {
    builder.set(key, value);
  });
  
  return builder.build();
}

/**
 * Business analysis prompt configurations
 */
export const PromptConfigs = {
  maxTokens: 2000,
  temperature: 0.7,
  topP: 0.9,
  
  // Specific configurations per prompt type
  metrics: {
    maxTokens: 500,
    temperature: 0.3,
    structured: true
  },
  
  entities: {
    maxTokens: 300,
    temperature: 0.2,
    structured: true
  },
  
  summary: {
    maxTokens: 400,
    temperature: 0.5,
    structured: false
  }
};

export default BusinessIntelligencePrompts;

// Export aliases for backward compatibility
export const biPromptBuilder = PromptBuilder;

// Response parser for structured responses
export const biResponseParser = {
  parseMetrics: (response: string) => {
    try {
      return JSON.parse(response);
    } catch {
      return null;
    }
  },
  
  parseEntities: (response: string) => {
    try {
      return JSON.parse(response);
    } catch {
      return null;
    }
  },
  
  parseSummary: (response: string) => {
    return response.trim();
  }
};