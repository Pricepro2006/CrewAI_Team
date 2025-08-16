/**
 * SimpleLLMProvider - Fallback provider for when llama.cpp is unavailable
 * Uses template-based responses for testing and development
 */

import { LlamaCppResponse, LlamaCppGenerateOptions } from "./SafeLlamaCppProvider.js";

export class SimpleLLMProvider {
  private templates: Map<string, string[]>;
  
  constructor() {
    this.templates = new Map([
      ['analyze', [
        'Analysis complete: Found 3 key patterns in the data.',
        'Based on my analysis, there are several important factors to consider.',
        'The analysis reveals interesting insights about the subject.',
      ]],
      ['summarize', [
        'Summary: The main points include key findings and recommendations.',
        'In summary, the document covers essential topics and provides valuable insights.',
        'Key takeaways: Important concepts have been identified and explained.',
      ]],
      ['email', [
        'This email appears to be about business communication.',
        'The email contains important information regarding the project.',
        'Email analysis: Professional tone, clear objectives stated.',
      ]],
      ['research', [
        'Research findings indicate several relevant points on this topic.',
        'Based on available information, here are the key research insights.',
        'The research shows promising results in this area.',
      ]],
      ['code', [
        'Here is a code solution that addresses the requirements.',
        'The implementation follows best practices and design patterns.',
        'Code generated successfully with appropriate error handling.',
      ]],
      ['write', [
        'The content has been crafted to meet the specified requirements.',
        'Here is the written response addressing your needs.',
        'The text has been composed with clarity and purpose.',
      ]],
      ['default', [
        'I understand your request and have processed it accordingly.',
        'Based on the input provided, here is my response.',
        'The task has been completed as requested.',
      ]]
    ]);
  }

  /**
   * Detect the type of request from the prompt
   */
  private detectRequestType(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('analyze') || lowerPrompt.includes('analysis')) {
      return 'analyze';
    }
    if (lowerPrompt.includes('summarize') || lowerPrompt.includes('summary')) {
      return 'summarize';
    }
    if (lowerPrompt.includes('email')) {
      return 'email';
    }
    if (lowerPrompt.includes('research') || lowerPrompt.includes('find')) {
      return 'research';
    }
    if (lowerPrompt.includes('code') || lowerPrompt.includes('function') || lowerPrompt.includes('implement')) {
      return 'code';
    }
    if (lowerPrompt.includes('write') || lowerPrompt.includes('draft')) {
      return 'write';
    }
    
    return 'default';
  }

  /**
   * Generate a response based on templates
   */
  public async generate(
    prompt: string,
    options: LlamaCppGenerateOptions = {}
  ): Promise<LlamaCppResponse> {
    const startTime = Date.now();
    
    // Detect request type
    const requestType = this.detectRequestType(prompt);
    const templates = this.templates.get(requestType) || this.templates.get('default')!;
    
    // Select a random template
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    // Add context-specific details
    let response = template;
    
    if (options.systemPrompt) {
      response = `[System: ${options.systemPrompt}]\n\n${response}`;
    }
    
    // Add some dynamic elements based on the prompt
    if (prompt.includes('?')) {
      response += '\n\nTo answer your specific question: Yes, this is feasible with the right approach.';
    }
    
    if (prompt.match(/\d+/)) {
      const numbers = prompt.match(/\d+/g);
      response += `\n\nRegarding the values ${numbers?.join(', ')}: These have been taken into consideration.`;
    }
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const duration = Date.now() - startTime;
    const tokens = response.split(/\s+/).length;
    
    return {
      model: 'simple-fallback',
      created_at: new Date().toISOString(),
      response: response,
      done: true,
      tokensGenerated: tokens,
      tokensPerSecond: tokens / (duration / 1000),
      totalDuration: duration,
      evalDuration: duration,
    };
  }

  /**
   * Initialize the provider (no-op for simple provider)
   */
  public async initialize(): Promise<void> {
    // No initialization needed
    return Promise.resolve();
  }

  /**
   * Check if ready (always true for simple provider)
   */
  public isReady(): boolean {
    return true;
  }

  /**
   * Clean up (no-op for simple provider)
   */
  public async cleanup(): Promise<void> {
    // No cleanup needed
    return Promise.resolve();
  }

  /**
   * Get model info
   */
  public getModelInfo(): {
    model: string;
    contextSize: number;
    loaded: boolean;
    processCount: number;
  } {
    return {
      model: 'simple-fallback',
      contextSize: 4096,
      loaded: true,
      processCount: 0,
    };
  }
}

// Export singleton instance
export const simpleLLMProvider = new SimpleLLMProvider();

export default SimpleLLMProvider;