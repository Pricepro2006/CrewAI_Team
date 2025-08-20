/**
 * Node.js-compatible sanitization fallback
 * Provides server-side sanitization when DOMPurify is unavailable
 */

import { logger } from './logger.js';

/**
 * Simple HTML sanitization for Node.js environment
 * This is a fallback when isomorphic-dompurify has issues
 */
export function sanitizeHtmlFallback(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    // Remove script tags and content
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    // Remove dangerous attributes
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    // Remove javascript: protocols
    .replace(/javascript:/gi, '')
    // Remove data: URLs that could contain scripts
    .replace(/data:text\/html[^"']*/gi, '')
    // Remove style tags that could contain CSS injection
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    // Remove iframe, embed, object tags
    .replace(/<(iframe|embed|object)[^>]*>.*?<\/\1>/gis, '')
    // Remove form elements that could be used for attacks
    .replace(/<(form|input|textarea|select|button)[^>]*>.*?<\/\1>/gis, '')
    .replace(/<(form|input|textarea|select|button)[^>]*\/?>/gis, '')
    // Remove meta refresh that could redirect
    .replace(/<meta[^>]*http-equiv\s*=\s*["']refresh["'][^>]*>/gi, '');
}

/**
 * Remove all HTML tags (aggressive sanitization)
 */
export function stripHtml(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .replace(/&lt;/g, '<')  // Decode HTML entities
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .trim();
}

/**
 * Sanitize string for use in SQL queries (prevent SQL injection)
 */
export function sanitizeForSql(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/'/g, "''")     // Escape single quotes
    .replace(/"/g, '""')     // Escape double quotes
    .replace(/\\/g, '\\\\')  // Escape backslashes
    .replace(/\x00/g, '')    // Remove null bytes
    .replace(/\n/g, '\\n')   // Escape newlines
    .replace(/\r/g, '\\r')   // Escape carriage returns
    .replace(/\x1a/g, '\\Z'); // Escape ctrl+Z
}

/**
 * Safe JSON parsing with fallback
 */
export function safeJsonParse<T>(input: string, fallback: T): T {
  try {
    return JSON.parse(input);
  } catch (error) {
    logger.warn('JSON parse failed, using fallback', 'SANITIZER', {
      error: error instanceof Error ? error.message : 'Unknown error',
      inputLength: input?.length || 0
    });
    return fallback;
  }
}

/**
 * Sanitize file path to prevent directory traversal
 */
export function sanitizeFilePath(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') {
    return '';
  }

  return filePath
    .replace(/\.\./g, '')     // Remove parent directory references
    .replace(/[<>:"|?*]/g, '') // Remove invalid filename characters (Windows)
    .replace(/\0/g, '')       // Remove null bytes
    .replace(/\\/g, '/')      // Normalize path separators
    .replace(/\/+/g, '/')     // Remove duplicate slashes
    .replace(/^\/+/, '')      // Remove leading slashes
    .trim();
}

/**
 * Validate and sanitize email address
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return '';
  }

  // Basic email sanitization
  const sanitized = email
    .trim()
    .toLowerCase()
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/\s+/g, ''); // Remove all whitespace

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) {
    throw new Error('Invalid email format');
  }

  return sanitized;
}

/**
 * Enhanced sanitization with multiple strategies
 */
export class NodeSanitizer {
  /**
   * Sanitize with fallback strategy
   */
  static sanitize(input: string, options: {
    allowHtml?: boolean;
    aggressive?: boolean;
  } = {}): string {
    const { allowHtml = false, aggressive = false } = options;

    try {
      // Try to use DOMPurify first
      const DOMPurify = require('isomorphic-dompurify');
      
      if (allowHtml) {
        return DOMPurify.sanitize(input, {
          ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
          ALLOWED_ATTR: ['href', 'title']
        });
      } else {
        return DOMPurify.sanitize(input, {
          ALLOWED_TAGS: [],
          ALLOWED_ATTR: [],
          KEEP_CONTENT: true
        });
      }
    } catch (error) {
      logger.warn('DOMPurify unavailable, using fallback sanitizer', 'SANITIZER', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Fallback to manual sanitization
      if (aggressive) {
        return stripHtml(input);
      } else if (allowHtml) {
        return sanitizeHtmlFallback(input);
      } else {
        return stripHtml(input);
      }
    }
  }

  /**
   * Validate input against dangerous patterns
   */
  static validateSafe(input: string): boolean {
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:text\/html/i,
      /<iframe/i,
      /<embed/i,
      /<object/i
    ];

    return !dangerousPatterns.some(pattern => pattern.test(input));
  }
}

export default NodeSanitizer;