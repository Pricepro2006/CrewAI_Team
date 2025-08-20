/**
 * LLM Context Extractor
 * Extracts client identification context from Express requests for proper rate limiting
 * This ensures each client gets their own rate limit quota instead of sharing a global pool
 */

import type { Request } from 'express';
import type { LlamaCppRequestContext } from '../../core/llm/LlamaCppHttpProvider.js';
import { logger } from '../../utils/logger.js';
import crypto from 'crypto';

/**
 * Extract client context from Express request for LLM rate limiting
 * Priority: authenticated userId > sessionId > IP address
 */
export function extractLLMContext(req: Request): LlamaCppRequestContext {
  const context: LlamaCppRequestContext = {};
  
  // Extract authenticated user ID from JWT or session
  // @ts-ignore - user might be added by auth middleware
  if (req.user?.id) {
    // @ts-ignore
    context.userId = String(req.user.id);
  } else if (req.headers.authorization) {
    // Try to extract user ID from JWT token if not already parsed
    try {
      const token = req.headers.authorization.replace('Bearer ', '');
      // In production, properly verify and decode the JWT
      // This is a simplified example
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      if (payload.sub || payload.userId) {
        context.userId = String(payload.sub || payload.userId);
      }
    } catch (error) {
      // Invalid token, will fall back to other identification methods
      logger.debug('Could not extract user ID from JWT', 'LLM_CONTEXT');
    }
  }
  
  // Extract session ID if available
  // @ts-ignore - session might be added by session middleware
  if (req.session?.id) {
    // @ts-ignore
    context.sessionId = String(req.session.id);
  } else if (req.cookies?.sessionId) {
    context.sessionId = req.cookies.sessionId;
  } else if (req.headers['x-session-id']) {
    context.sessionId = String(req.headers['x-session-id']);
  }
  
  // Extract IP address with proper handling of proxies
  context.ip = extractClientIp(req);
  
  // Log context extraction for debugging (without sensitive data)
  logger.debug('Extracted LLM context', 'LLM_CONTEXT', {
    hasUserId: !!context.userId,
    hasSessionId: !!context.sessionId,
    hasIp: !!context.ip,
    ipPrefix: context.ip ? context.ip.substring(0, 8) + '...' : undefined
  });
  
  return context;
}

/**
 * Extract real client IP address handling various proxy scenarios
 */
export function extractClientIp(req: Request): string {
  // Priority order for IP extraction
  const ipSources = [
    // CloudFlare
    req.headers['cf-connecting-ip'],
    // Standard forwarded header
    req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim(),
    // Real IP header (nginx)
    req.headers['x-real-ip'],
    // Client IP header
    req.headers['x-client-ip'],
    // Express parsed IP (handles some proxies)
    req.ip,
    // Socket connection IP
    req.socket?.remoteAddress,
    // Connection remote address (deprecated but fallback)
    // @ts-ignore
    req.connection?.remoteAddress
  ];
  
  // Find first valid IP
  for (const ip of ipSources) {
    if (ip && typeof ip === 'string' && ip !== '::1' && ip !== '::ffff:127.0.0.1') {
      // Normalize IPv6 localhost to IPv4
      if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') {
        return '127.0.0.1';
      }
      // Handle IPv4-mapped IPv6 addresses
      if (ip.startsWith('::ffff:')) {
        return ip.substring(7);
      }
      return ip;
    }
  }
  
  // Default fallback
  return '127.0.0.1';
}

/**
 * Generate a stable anonymous session ID from request fingerprint
 * Used when no session ID is available but we want consistent rate limiting
 */
export function generateAnonymousSessionId(req: Request): string {
  // Create fingerprint from stable request characteristics
  const fingerprint = [
    req.headers['user-agent'] || 'unknown',
    req.headers['accept-language'] || 'unknown',
    req.headers['accept-encoding'] || 'unknown',
    extractClientIp(req)
  ].join('|');
  
  // Generate stable hash
  return 'anon_' + crypto
    .createHash('sha256')
    .update(fingerprint)
    .digest('hex')
    .substring(0, 16);
}

/**
 * Middleware to automatically attach LLM context to requests
 */
export function attachLLMContext(req: Request, _res: Response, next: Function) {
  // @ts-ignore - adding custom property
  req.llmContext = extractLLMContext(req);
  
  // Generate anonymous session if no identification available
  // @ts-ignore
  if (!req.llmContext.userId && !req.llmContext.sessionId) {
    // @ts-ignore
    req.llmContext.sessionId = generateAnonymousSessionId(req);
  }
  
  next();
}

/**
 * Helper to create LLM options with context from request
 */
export function createLLMOptionsWithContext(
  req: Request,
  options: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    ...options,
    context: extractLLMContext(req)
  };
}

// Export types for use in route handlers
export type { LlamaCppRequestContext };