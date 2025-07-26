/**
 * Output sanitizer for LLM responses
 * Removes sensitive information and ensures clean output with XSS protection
 */

import { xssProtection, XSSEncoder } from './xss-protection';

export interface SanitizedOutput {
  content: string;
  metadata?: {
    sanitized: boolean;
    removedItems?: string[];
    warnings?: string[];
    xssProtected?: boolean;
  };
}

/**
 * Sanitize LLM output to remove sensitive information and ensure clean responses
 */
export function sanitizeLLMOutput(content: string): SanitizedOutput {
  if (!content || typeof content !== 'string') {
    return {
      content: '',
      metadata: {
        sanitized: false,
        warnings: ['Empty or invalid input']
      }
    };
  }

  let sanitized = content;
  const removedItems: string[] = [];
  const warnings: string[] = [];

  // Remove common sensitive patterns
  const sensitivePatterns = [
    // API keys and tokens
    {
      pattern: /\b[A-Za-z0-9_-]{32,}\b/g,
      name: 'potential_api_key',
      replacement: '[REDACTED_API_KEY]'
    },
    // Email addresses (optionally remove or mask)
    {
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      name: 'email_address',
      replacement: '[EMAIL_REDACTED]'
    },
    // URLs with sensitive parameters
    {
      pattern: /https?:\/\/[^\s]+[?&](key|token|secret|password)=[^\s&]+/gi,
      name: 'sensitive_url',
      replacement: '[SENSITIVE_URL_REDACTED]'
    },
    // Credit card numbers (basic pattern)
    {
      pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
      name: 'credit_card',
      replacement: '[CREDIT_CARD_REDACTED]'
    },
    // Phone numbers (basic US format)
    {
      pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      name: 'phone_number',
      replacement: '[PHONE_REDACTED]'
    }
  ];

  // Apply sanitization patterns
  for (const { pattern, name, replacement } of sensitivePatterns) {
    const matches = sanitized.match(pattern);
    if (matches) {
      removedItems.push(name);
      sanitized = sanitized.replace(pattern, replacement);
    }
  }

  // Remove internal system tags that might leak
  const systemTags = [
    /<think>.*?<\/think>/gs,
    /<internal>.*?<\/internal>/gs,
    /<system>.*?<\/system>/gs,
    /<debug>.*?<\/debug>/gs,
    /\[INTERNAL:.*?\]/gs,
    /\[DEBUG:.*?\]/gs
  ];

  for (const tag of systemTags) {
    if (tag.test(sanitized)) {
      removedItems.push('internal_tags');
      sanitized = sanitized.replace(tag, '');
    }
  }

  // Clean up excessive whitespace
  sanitized = sanitized.replace(/\n\s*\n\s*\n/g, '\n\n'); // Remove triple+ newlines
  sanitized = sanitized.replace(/[ \t]+/g, ' '); // Replace multiple spaces/tabs with single space
  sanitized = sanitized.trim();

  // Apply XSS protection
  const xssProtected = xssProtection.sanitizeString(sanitized);
  if (xssProtected !== sanitized) {
    removedItems.push('xss_patterns');
    sanitized = xssProtected;
  }

  // Check for remaining potential issues
  if (sanitized.includes('OPENAI_API_KEY') || sanitized.includes('sk-')) {
    warnings.push('Potential OpenAI API key detected');
  }

  if (sanitized.includes('Bearer ')) {
    warnings.push('Potential Bearer token detected');
  }

  // Validate output length
  if (sanitized.length > 10000) {
    warnings.push('Output is unusually long');
  }

  return {
    content: sanitized,
    metadata: {
      sanitized: removedItems.length > 0,
      removedItems,
      warnings,
      xssProtected: removedItems.includes('xss_patterns')
    }
  };
}

/**
 * Quick sanitization for simple cases
 */
export function quickSanitize(content: string): string {
  return sanitizeLLMOutput(content).content;
}

/**
 * Sanitize and validate JSON output
 */
export function sanitizeJSONOutput(content: string): { valid: boolean; content: string; parsed?: any } {
  const sanitized = sanitizeLLMOutput(content);
  
  try {
    const parsed = JSON.parse(sanitized.content);
    return {
      valid: true,
      content: sanitized.content,
      parsed
    };
  } catch (error) {
    return {
      valid: false,
      content: sanitized.content
    };
  }
}

/**
 * Sanitize output for specific contexts with comprehensive XSS protection
 */
export function sanitizeForContext(content: string, context: 'email' | 'web' | 'api' | 'general' | 'html' | 'markdown'): SanitizedOutput {
  const result = sanitizeLLMOutput(content);
  
  switch (context) {
    case 'email':
      // Additional email-specific sanitization
      result.content = result.content.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_PROTECTED]');
      // Apply strict HTML sanitization for email content
      result.content = xssProtection.sanitizeHTML(result.content, 'minimal');
      result.metadata = { ...result.metadata, xssProtected: true };
      break;
      
    case 'web':
      // Web-specific sanitization with DOMPurify
      result.content = xssProtection.sanitizeHTML(result.content, 'strict');
      result.metadata = { ...result.metadata, xssProtected: true };
      break;
      
    case 'html':
      // HTML content with moderate sanitization (allows more formatting)
      result.content = xssProtection.sanitizeHTML(result.content, 'moderate');
      result.metadata = { ...result.metadata, xssProtected: true };
      break;
      
    case 'markdown':
      // Markdown content - sanitize while preserving markdown syntax
      // First sanitize dangerous patterns, then allow markdown
      result.content = xssProtection.sanitizeString(result.content);
      // Preserve markdown but encode HTML entities within
      result.content = result.content.replace(/<([^>]+)>/g, (match, tag) => {
        // Allow markdown image syntax
        if (tag.startsWith('!')) return match;
        // Encode other HTML tags
        return XSSEncoder.html(match);
      });
      result.metadata = { ...result.metadata, xssProtected: true };
      break;
      
    case 'api':
      // API-specific sanitization (more aggressive)
      result.content = result.content.replace(/\b[A-Za-z0-9_-]{20,}\b/g, '[TOKEN_REDACTED]');
      // Ensure no HTML in API responses unless explicitly needed
      result.content = xssProtection.sanitizeString(result.content);
      result.metadata = { ...result.metadata, xssProtected: true };
      break;
      
    case 'general':
    default:
      // Use string sanitization for general content
      result.content = xssProtection.sanitizeString(result.content);
      result.metadata = { ...result.metadata, xssProtected: true };
      break;
  }
  
  return result;
}

/**
 * Sanitize content based on detected content type
 */
export function autoSanitize(content: string): SanitizedOutput {
  // Detect content type
  const hasHTML = /<[^>]*>/.test(content);
  const hasMarkdown = /^#{1,6}\s|^\*{1,2}[^*]+\*{1,2}|^\[.+\]\(.+\)|^```/m.test(content);
  const hasEmail = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/i.test(content);
  
  if (hasHTML) {
    return sanitizeForContext(content, 'html');
  } else if (hasMarkdown) {
    return sanitizeForContext(content, 'markdown');
  } else if (hasEmail) {
    return sanitizeForContext(content, 'email');
  } else {
    return sanitizeForContext(content, 'general');
  }
}