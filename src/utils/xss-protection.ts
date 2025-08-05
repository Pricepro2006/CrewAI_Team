/**
 * Comprehensive XSS Protection Utility
 * Provides context-aware sanitization and encoding for preventing XSS attacks
 */

import DOMPurify from 'isomorphic-dompurify';
import { z } from 'zod';
import { logger } from './logger';

/**
 * XSS attack vectors to protect against
 */
const XSS_VECTORS = {
  // JavaScript URL protocols
  jsProtocols: /^(javascript|data|vbscript|blob|file):/i,
  
  // Event handlers
  eventHandlers: /on\w+\s*=/gi,
  
  // Dangerous tags
  dangerousTags: /<(script|iframe|object|embed|link|style|base|meta|import|form)/gi,
  
  // CSS expressions
  cssExpressions: /expression\s*\(/gi,
  
  // SVG/MathML dangerous elements
  svgDangerous: /<(animate|set|animateTransform|handler)/gi,
  
  // Angular/Vue expressions
  templateExpressions: /\{\{.*?\}\}/g,
  
  // DOM clobbering
  idAndNameClobbering: /^(document|window|location|top|self|parent)/i,
};

/**
 * Context-specific encoding functions
 */
export const XSSEncoder = {
  /**
   * HTML entity encoding for text content
   */
  html(text: string): string {
    if (!text || typeof text !== 'string') return '';
    
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .replace(/`/g, '&#x60;')
      .replace(/=/g, '&#x3D;');
  },
  
  /**
   * JavaScript string encoding
   */
  javascript(text: string): string {
    if (!text || typeof text !== 'string') return '';
    
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/\f/g, '\\f')
      .replace(/\v/g, '\\v')
      .replace(/\0/g, '\\0')
      .replace(/</g, '\\x3C')
      .replace(/>/g, '\\x3E')
      .replace(/&/g, '\\x26')
      .replace(/=/g, '\\x3D')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  },
  
  /**
   * CSS value encoding
   */
  css(text: string): string {
    if (!text || typeof text !== 'string') return '';
    
    return text.replace(/[^a-zA-Z0-9 ]/g, (char) => {
      const hex = char.charCodeAt(0).toString(16);
      return '\\' + ('000000' + hex).slice(-6);
    });
  },
  
  /**
   * URL encoding
   */
  url(text: string): string {
    if (!text || typeof text !== 'string') return '';
    
    try {
      return encodeURIComponent(text);
    } catch (e) {
      logger.warn('URL encoding failed', 'XSS_PROTECTION', { error: e });
      return '';
    }
  },
  
  /**
   * HTML attribute encoding
   */
  attribute(text: string): string {
    if (!text || typeof text !== 'string') return '';
    
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\//g, '&#x2F;')
      .replace(/=/g, '&#x3D;')
      .replace(/`/g, '&#x60;')
      .replace(/\x00/g, '&#x00;');
  },
};

/**
 * DOMPurify configuration for different contexts
 */
const DOMPURIFY_CONFIGS = {
  // Strict: Remove all potentially dangerous content
  strict: {
    ALLOWED_TAGS: ['p', 'br', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                   'blockquote', 'code', 'pre', 'em', 'strong', 'u', 's', 'strike',
                   'ul', 'ol', 'li', 'hr', 'a', 'img'],
    ALLOWED_ATTR: ['class', 'id', 'href', 'src', 'alt', 'title', 'target'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  },
  
  // Moderate: Allow some formatting but no scripts
  moderate: {
    ALLOWED_TAGS: ['p', 'br', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                   'blockquote', 'code', 'pre', 'em', 'strong', 'u', 's', 'strike',
                   'ul', 'ol', 'li', 'hr', 'a', 'img', 'table', 'thead', 'tbody',
                   'tr', 'td', 'th', 'caption', 'col', 'colgroup'],
    ALLOWED_ATTR: ['class', 'id', 'href', 'src', 'alt', 'title', 'target', 'style',
                   'width', 'height', 'colspan', 'rowspan'],
    ALLOW_DATA_ATTR: true,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  },
  
  // Minimal: Only basic text formatting
  minimal: {
    ALLOWED_TAGS: ['p', 'br', 'em', 'strong'],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style'],
  },
};

export type SanitizationLevel = 'strict' | 'moderate' | 'minimal';

/**
 * Main XSS protection class
 */
export class XSSProtection {
  private static instance: XSSProtection;
  
  /**
   * Get singleton instance
   */
  static getInstance(): XSSProtection {
    if (!this.instance) {
      this.instance = new XSSProtection();
    }
    return this.instance;
  }
  
  /**
   * Sanitize HTML content with DOMPurify
   */
  sanitizeHTML(content: string, level: SanitizationLevel = 'strict'): string {
    if (!content || typeof content !== 'string') return '';
    
    try {
      const config = DOMPURIFY_CONFIGS[level];
      const clean = DOMPurify.sanitize(content, config);
      
      // Additional checks after DOMPurify
      if (this.containsDangerousPatterns(clean)) {
        logger.warn('Dangerous patterns detected after sanitization', 'XSS_PROTECTION', {
          level,
          contentLength: content.length,
        });
        return this.stripAllHTML(clean);
      }
      
      return clean;
    } catch (error) {
      logger.error('HTML sanitization failed', 'XSS_PROTECTION', { error });
      return this.stripAllHTML(content);
    }
  }
  
  /**
   * Sanitize content for specific contexts
   */
  sanitizeForContext(content: string, context: 'html' | 'attribute' | 'javascript' | 'css' | 'url'): string {
    if (!content || typeof content !== 'string') return '';
    
    switch (context) {
      case 'html':
        return this.sanitizeHTML(content);
      case 'attribute':
        return XSSEncoder.attribute(content);
      case 'javascript':
        return XSSEncoder.javascript(content);
      case 'css':
        return XSSEncoder.css(content);
      case 'url':
        return this.sanitizeURL(content);
      default:
        return XSSEncoder.html(content);
    }
  }
  
  /**
   * Sanitize URLs to prevent javascript: and data: URIs
   */
  sanitizeURL(url: string): string {
    if (!url || typeof url !== 'string') return '';
    
    const trimmed = url.trim();
    
    // Check for dangerous protocols
    if (XSS_VECTORS.jsProtocols.test(trimmed)) {
      logger.warn('Dangerous URL protocol detected', 'XSS_PROTECTION', {
        protocol: trimmed.split(':')[0],
      });
      return '';
    }
    
    // Validate URL structure
    try {
      const parsed = new URL(trimmed, 'http://localhost');
      
      // Only allow http(s) and relative URLs
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return '';
      }
      
      // Encode the URL
      return XSSEncoder.url(trimmed);
    } catch (e) {
      // If not a valid URL, encode it as a relative path
      return XSSEncoder.url(trimmed);
    }
  }
  
  /**
   * Validate and sanitize user input based on expected type
   */
  sanitizeInput(input: unknown, schema?: z.ZodSchema): any {
    // If schema provided, use it for validation and transformation
    if (schema) {
      try {
        return schema.parse(input);
      } catch (error) {
        logger.warn('Input validation failed', 'XSS_PROTECTION', { error });
        throw error;
      }
    }
    
    // Default string sanitization
    if (typeof input === 'string') {
      return this.sanitizeString(input);
    }
    
    // Recursively sanitize objects
    if (typeof input === 'object' && input !== null) {
      return this.sanitizeObject(input);
    }
    
    return input;
  }
  
  /**
   * Sanitize a plain string (no HTML)
   */
  sanitizeString(str: string): string {
    if (!str || typeof str !== 'string') return '';
    
    // Remove null bytes
    let clean = str.replace(/\0/g, '');
    
    // Remove Unicode direction override characters
    clean = clean.replace(/[\u202A-\u202E\u2066-\u2069]/g, '');
    
    // Normalize whitespace
    clean = clean.replace(/[\r\n\t]+/g, ' ').trim();
    
    // Check for template injection attempts
    if (XSS_VECTORS.templateExpressions.test(clean)) {
      clean = clean.replace(XSS_VECTORS.templateExpressions, '');
    }
    
    return clean;
  }
  
  /**
   * Recursively sanitize object properties
   */
  private sanitizeObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeInput(item));
    }
    
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize the key itself
      const cleanKey = this.sanitizeString(key);
      
      // Skip if key is dangerous (DOM clobbering)
      if (XSS_VECTORS.idAndNameClobbering.test(cleanKey)) {
        logger.warn('Dangerous object key detected', 'XSS_PROTECTION', { key });
        continue;
      }
      
      // Recursively sanitize the value
      sanitized[cleanKey] = this.sanitizeInput(value);
    }
    
    return sanitized;
  }
  
  /**
   * Check if content contains dangerous patterns
   */
  private containsDangerousPatterns(content: string): boolean {
    return (
      XSS_VECTORS.eventHandlers.test(content) ||
      XSS_VECTORS.jsProtocols.test(content) ||
      XSS_VECTORS.cssExpressions.test(content) ||
      XSS_VECTORS.svgDangerous.test(content)
    );
  }
  
  /**
   * Strip all HTML tags (fallback for highly suspicious content)
   */
  private stripAllHTML(content: string): string {
    return content.replace(/<[^>]*>/g, '');
  }
  
  /**
   * Create a Content Security Policy header value
   */
  generateCSP(options: {
    nonce?: string;
    reportUri?: string;
    upgradeInsecureRequests?: boolean;
  } = {}): string {
    const directives = [
      "default-src 'self'",
      `script-src 'self' ${options.nonce ? `'nonce-${options.nonce}'` : "'unsafe-inline'"}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' ws: wss:",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ];
    
    if (options.upgradeInsecureRequests) {
      directives.push('upgrade-insecure-requests');
    }
    
    if (options.reportUri) {
      directives.push(`report-uri ${options.reportUri}`);
    }
    
    return directives.join('; ');
  }
}

/**
 * Zod schemas for common input validation
 */
export const XSSSchemas = {
  // Safe string with XSS protection
  safeString: z.string().transform((str) => {
    const xss = XSSProtection.getInstance();
    return xss.sanitizeString(str);
  }),
  
  // HTML content with sanitization
  htmlContent: z.string().transform((str) => {
    const xss = XSSProtection.getInstance();
    return xss.sanitizeHTML(str);
  }),
  
  // URL with validation
  safeURL: z.string().transform((str) => {
    const xss = XSSProtection.getInstance();
    return xss.sanitizeURL(str);
  }),
  
  // Email with XSS protection
  safeEmail: z.string().email().transform((str) => {
    const xss = XSSProtection.getInstance();
    return xss.sanitizeString(str);
  }),
  
  // Safe identifier (alphanumeric + limited chars)
  safeId: z.string()
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid characters in identifier')
    .max(100),
};

// Export singleton instance
export const xssProtection = XSSProtection.getInstance();