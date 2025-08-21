/**
 * PromptOptimizer - Optimizes prompts for token efficiency and clarity
 */

export class PromptOptimizer {
  private maxTokens: number;
  private compressionRatio: number;

  constructor(maxTokens: number = 2000, compressionRatio: number = 0.8) {
    this.maxTokens = maxTokens;
    this.compressionRatio = compressionRatio;
  }

  /**
   * Optimize a prompt by removing redundancy and improving clarity
   */
  optimize(prompt: string): string {
    let optimized = prompt;
    
    // Remove excessive whitespace
    optimized = optimized.replace(/\s+/g, ' ').trim();
    
    // Remove redundant phrases
    optimized = this.removeRedundancy(optimized);
    
    // Compress if too long
    if (this.estimateTokens(optimized) > this.maxTokens) {
      optimized = this.compress(optimized);
    }
    
    return optimized;
  }

  /**
   * Remove redundant phrases
   */
  private removeRedundancy(text: string): string {
    const redundantPhrases = [
      /please note that/gi,
      /it is important to note that/gi,
      /as mentioned before/gi,
      /as previously stated/gi,
      /in other words/gi,
    ];
    
    let cleaned = text;
    redundantPhrases.forEach(phrase => {
      cleaned = cleaned.replace(phrase, '');
    });
    
    return cleaned;
  }

  /**
   * Compress text to fit within token limits
   */
  private compress(text: string): string {
    const targetLength = Math.floor(text.length * this.compressionRatio);
    
    if (text.length <= targetLength) {
      return text;
    }
    
    // Split into sentences and prioritize
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const prioritized = sentences.sort((a, b) => {
      // Prioritize sentences with key terms
      const keyTerms = ['required', 'must', 'critical', 'important', 'action'];
      const scoreA = keyTerms.filter(term => a.toLowerCase().includes(term)).length;
      const scoreB = keyTerms.filter(term => b.toLowerCase().includes(term)).length;
      return scoreB - scoreA;
    });
    
    // Take most important sentences up to target length
    let compressed = '';
    for (const sentence of prioritized) {
      if ((compressed + sentence).length <= targetLength) {
        compressed += sentence + ' ';
      } else {
        break;
      }
    }
    
    return compressed.trim() || text.substring(0, targetLength);
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token per 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Batch optimize multiple prompts
   */
  batchOptimize(prompts: string[]): string[] {
    return prompts.map(prompt => this.optimize(prompt));
  }

  /**
   * Create a context-aware prompt
   */
  createContextualPrompt(base: string, context: Record<string, any>): string {
    let prompt = base;
    
    // Add context information
    const contextStr = Object.entries(context)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('\n');
    
    prompt = `Context:\n${contextStr}\n\n${prompt}`;
    
    return this.optimize(prompt);
  }
}

// Export singleton instance
export const promptOptimizer = new PromptOptimizer();

export default PromptOptimizer;