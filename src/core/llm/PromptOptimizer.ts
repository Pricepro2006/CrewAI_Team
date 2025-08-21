/**
 * Prompt Optimizer - Reduces token count while maintaining quality
 */

export class PromptOptimizer {
  private static readonly MAX_CONTEXT_LENGTH = 500; // Limit context to speed up processing
  private static readonly MAX_PROMPT_LENGTH = 1000; // Keep prompts concise
  
  /**
   * Optimize a prompt for faster LLM processing
   */
  static optimize(prompt: string, context?: string): string {
    // Remove excessive whitespace and formatting
    let optimized = prompt.replace(/\s+/g, ' ').trim();
    
    // Truncate context if too long
    if (context) {
      const truncatedContext = this.truncateContext(context);
      optimized = optimized.replace(/\${context}/g, truncatedContext);
    }
    
    // Remove verbose instructions
    optimized = this.simplifyInstructions(optimized);
    
    // Ensure prompt doesn't exceed max length
    if (optimized.length > this.MAX_PROMPT_LENGTH) {
      optimized = optimized.substring(0, this.MAX_PROMPT_LENGTH) + '...';
    }
    
    return optimized;
  }
  
  /**
   * Create a simplified prompt for system questions
   */
  static createSystemPrompt(question: string): string {
    return `Answer concisely: ${question}
    
Available agents: ResearchAgent, CodeAgent, DataAnalysisAgent, WriterAgent, ToolExecutorAgent
Available tools: Web search, code generation, data analysis, content writing, web scraping
Capabilities: Multi-agent coordination, RAG-enhanced responses, real-time processing`;
  }
  
  /**
   * Create a fast prompt for general questions
   */
  static createQuickPrompt(task: string, agentType: string): string {
    return `${agentType} task: ${task}
Provide a direct, helpful response.`;
  }
  
  private static truncateContext(context: string): string {
    if (context.length <= this.MAX_CONTEXT_LENGTH) {
      return context;
    }
    
    // Take first and last parts to preserve context
    const halfLength = Math.floor(this.MAX_CONTEXT_LENGTH / 2);
    return context.substring(0, halfLength) + 
           '...[truncated]...' + 
           context.substring(context.length - halfLength);
  }
  
  private static simplifyInstructions(prompt: string): string {
    // Remove verbose instruction patterns
    const verbosePatterns = [
      /Please provide a detailed.*?\./g,
      /Ensure that you.*?\./g,
      /It is important to.*?\./g,
      /Make sure to.*?\./g,
      /You should.*?\./g,
      /Create a well-structured.*?\./g,
      /Use appropriate.*?\./g,
    ];
    
    let simplified = prompt;
    for (const pattern of verbosePatterns) {
      simplified = simplified.replace(pattern, '');
    }
    
    return simplified;
  }
  
  /**
   * Estimate token count (rough approximation)
   */
  static estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
}