/**
 * Prompt Sanitizer Utility
 * Prevents prompt injection attacks in LLM interactions
 * Based on security review recommendations
 */

export class PromptSanitizer {
  // Dangerous patterns that could manipulate LLM behavior
  private static readonly DANGEROUS_PATTERNS = [
    /ignore\s+previous\s+instructions?/gi,
    /disregard\s+all\s+prior/gi,
    /forget\s+everything/gi,
    /system\s*:\s*[\s\S]*$/gim,
    /\[INST\]/gi,
    /<\|im_start\|>/gi,
    /###\s*instruction/gi,
    /you\s+are\s+now/gi,
    /act\s+as\s+if/gi,
    /pretend\s+to\s+be/gi,
    /new\s+directive/gi,
    /override\s+protocol/gi,
    // Prevent attempts to extract system prompts
    /show\s+me\s+your\s+prompt/gi,
    /reveal\s+your\s+instructions/gi,
    /what\s+are\s+your\s+rules/gi,
  ];

  // Maximum prompt length to prevent resource exhaustion
  private static readonly MAX_PROMPT_LENGTH = parseInt(
    process.env.MAX_PROMPT_LENGTH || '10000'
  );

  /**
   * Sanitize user input before sending to LLM
   */
  static sanitizePrompt(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Truncate if too long
    let sanitized = input.slice(0, this.MAX_PROMPT_LENGTH);

    // Remove dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    // Escape special characters that might be interpreted as prompt markers
    sanitized = sanitized
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}');

    // Remove any Unicode control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized;
  }

  /**
   * Check if prompt contains injection attempts
   */
  static detectInjectionAttempt(input: string): boolean {
    if (!input || typeof input !== 'string') {
      return false;
    }

    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(input)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Sanitize email content specifically
   */
  static sanitizeEmailContent(email: {
    subject?: string;
    body?: string;
    sender?: string;
  }): {
    subject: string;
    body: string;
    sender: string;
  } {
    return {
      subject: this.sanitizePrompt(email.subject || ''),
      body: this.sanitizePrompt(email.body || ''),
      sender: this.sanitizePrompt(email.sender || ''),
    };
  }

  /**
   * Create safe prompt with sanitized content
   */
  static createSafePrompt(template: string, variables: Record<string, any>): string {
    let prompt = template;

    // Sanitize all variables before injection
    for (const [key, value] of Object.entries(variables)) {
      const sanitizedValue = typeof value === 'string' 
        ? this.sanitizePrompt(value)
        : String(value);
      
      prompt = prompt.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
        sanitizedValue
      );
    }

    return prompt;
  }
}