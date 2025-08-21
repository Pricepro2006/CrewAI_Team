/**
 * Security Configuration for llama.cpp Integration
 * Implements defense-in-depth security controls
 */

import { z } from 'zod';
import { resolve, normalize } from 'path';
import { existsSync, statSync } from 'fs';

// Security constants
export const SECURITY_LIMITS = {
  MAX_PROMPT_LENGTH: 10000,
  MAX_RESPONSE_LENGTH: 50000,
  MAX_CONTEXT_SIZE: 16384,
  MAX_BATCH_SIZE: 2048,
  MAX_THREADS: 16,
  MIN_THREADS: 1,
  MAX_TEMPERATURE: 2.0,
  MIN_TEMPERATURE: 0.0,
  MAX_TOP_K: 100,
  MIN_TOP_K: 1,
  MAX_TOP_P: 1.0,
  MIN_TOP_P: 0.0,
  MAX_TOKENS: 4096,
  MIN_TOKENS: 1,
  REQUEST_TIMEOUT_MS: 60000,
  MAX_CONCURRENT_REQUESTS: 10,
  RATE_LIMIT_PER_MINUTE: 60,
  MAX_MODEL_SIZE_GB: 20,
  MAX_MEMORY_GB: 32,
  ALLOWED_HOSTS: ['127.0.0.1', 'localhost'],
  ALLOWED_PORTS: [8081],
  BLOCKED_PATTERNS: [
    /\.\.\//, // Path traversal
    /\.\.\\/, // Windows path traversal
    /[;&|`$()<>]/, // Shell metacharacters
    /[\x00-\x1F\x7F]/, // Control characters
    /<script/i, // XSS attempts
    /javascript:/i, // JavaScript protocol
    /data:text\/html/i, // Data URI XSS
    /on\w+\s*=/i, // Event handlers
  ]
};

// Validation schemas
export const ModelConfigSchema = z.object({
  filename: z.string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9._-]+\.gguf$/),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  contextWindow: z.number()
    .min(128)
    .max(SECURITY_LIMITS.MAX_CONTEXT_SIZE),
  temperature: z.number()
    .min(SECURITY_LIMITS.MIN_TEMPERATURE)
    .max(SECURITY_LIMITS.MAX_TEMPERATURE),
  quantization: z.string().regex(/^Q[0-9]_K_[SM]$/),
  threads: z.number()
    .min(SECURITY_LIMITS.MIN_THREADS)
    .max(SECURITY_LIMITS.MAX_THREADS)
    .optional(),
  gpuLayers: z.number().min(0).max(100).optional()
});

export const GenerateOptionsSchema = z.object({
  temperature: z.number()
    .min(SECURITY_LIMITS.MIN_TEMPERATURE)
    .max(SECURITY_LIMITS.MAX_TEMPERATURE)
    .optional(),
  maxTokens: z.number()
    .min(SECURITY_LIMITS.MIN_TOKENS)
    .max(SECURITY_LIMITS.MAX_TOKENS)
    .optional(),
  topK: z.number()
    .min(SECURITY_LIMITS.MIN_TOP_K)
    .max(SECURITY_LIMITS.MAX_TOP_K)
    .optional(),
  topP: z.number()
    .min(SECURITY_LIMITS.MIN_TOP_P)
    .max(SECURITY_LIMITS.MAX_TOP_P)
    .optional(),
  repeatPenalty: z.number().min(0.0).max(2.0).optional(),
  seed: z.number().optional(),
  systemPrompt: z.string().max(1000).optional()
});

export const EmailAnalysisRequestSchema = z.object({
  emailId: z.string().uuid(),
  subject: z.string().max(500),
  body: z.string().max(10000),
  chainId: z.string().uuid().optional(),
  stage: z.union([z.literal(1), z.literal(2), z.literal(3)])
});

// Security utilities
export class SecurityValidator {
  /**
   * Validate and sanitize file paths
   */
  static validatePath(basePath: string, filename: string): string {
    // Remove any path traversal attempts
    const sanitizedFilename = filename
      .replace(/\.\.\//g, '')
      .replace(/\.\.\\/, '')
      .replace(/[^a-zA-Z0-9._?-]/g, '_');
    
    const fullPath = normalize(resolve(basePath, sanitizedFilename));
    const resolvedBase = resolve(basePath);
    
    // Ensure the resolved path is within the base directory
    if (!fullPath.startsWith(resolvedBase)) {
      throw new Error('Security: Path traversal attempt detected');
    }
    
    // Check if file exists and is not a symlink
    if (existsSync(fullPath)) {
      const stats = statSync(fullPath);
      if (stats.isSymbolicLink()) {
        throw new Error('Security: Symbolic links are not allowed');
      }
      if (!stats.isFile()) {
        throw new Error('Security: Path must point to a regular file');
      }
      // Check file size limit
      const sizeGB = stats.size / (1024 * 1024 * 1024);
      if (sizeGB > SECURITY_LIMITS.MAX_MODEL_SIZE_GB) {
        throw new Error(`Security: Model file exceeds size limit of ${SECURITY_LIMITS.MAX_MODEL_SIZE_GB}GB`);
      }
    }
    
    return fullPath;
  }

  /**
   * Sanitize text input to prevent injection attacks
   */
  static sanitizeText(input: string, maxLength: number = SECURITY_LIMITS.MAX_PROMPT_LENGTH): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    // Check for blocked patterns
    for (const pattern of SECURITY_LIMITS.BLOCKED_PATTERNS) {
      if (pattern.test(input)) {
        throw new Error('Security: Input contains blocked patterns');
      }
    }
    
    // Remove dangerous characters and limit length
    return input
      .replace(/[;&|`$()<>]/g, '') // Shell metacharacters
      .replace(/[\x00-\x1F\x7F]/g, '') // Control characters
      .replace(/<script.*?>.*?<\/script>/gi, '') // Script tags
      .replace(/javascript:/gi, '') // JavaScript protocol
      .replace(/on\w+\s*=/gi, '') // Event handlers
      .substring(0, maxLength);
  }

  /**
   * Validate host and port
   */
  static validateNetworkBinding(host: string, port: number): void {
    if (!SECURITY_LIMITS.ALLOWED_HOSTS.includes(host)) {
      throw new Error(`Security: Host ${host} is not allowed. Use localhost only.`);
    }
    
    if (!SECURITY_LIMITS.ALLOWED_PORTS.includes(port)) {
      throw new Error(`Security: Port ${port} is not allowed. Use port 8081.`);
    }
  }

  /**
   * Validate environment variables
   */
  static validateEnvVar(value: string | undefined, name: string, validator: z.ZodType<any>): any {
    if (!value) {
      return undefined;
    }
    
    try {
      return validator.parse(value);
    } catch (error) {
      console.warn(`Security: Invalid environment variable ${name}, using default`);
      return undefined;
    }
  }

  /**
   * Rate limiting check (simple in-memory implementation)
   */
  private static requestCounts = new Map<string, { count: number; resetTime: number }>();
  
  static checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const limit = SECURITY_LIMITS.RATE_LIMIT_PER_MINUTE;
    const window = 60000; // 1 minute
    
    const record = this.requestCounts.get(clientId);
    
    if (!record || now > record.resetTime) {
      this.requestCounts.set(clientId, {
        count: 1,
        resetTime: now + window
      });
      return true;
    }
    
    if (record.count >= limit) {
      return false;
    }
    
    record.count++;
    return true;
  }

  /**
   * Clean up old rate limit records
   */
  static cleanupRateLimits(): void {
    const now = Date.now();
    for (const [clientId, record] of this.requestCounts.entries()) {
      if (now > record.resetTime) {
        this.requestCounts.delete(clientId);
      }
    }
  }
}

// Resource limiter
export class ResourceLimiter {
  private static activeRequests = 0;
  private static memoryUsageGB = 0;
  
  /**
   * Check if resources are available
   */
  static async checkResources(estimatedMemoryGB: number = 1): Promise<boolean> {
    // Check concurrent request limit
    if (this.activeRequests >= SECURITY_LIMITS.MAX_CONCURRENT_REQUESTS) {
      return false;
    }
    
    // Check memory limit
    if (this.memoryUsageGB + estimatedMemoryGB > SECURITY_LIMITS.MAX_MEMORY_GB) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Acquire resources for a request
   */
  static acquireResources(estimatedMemoryGB: number = 1): void {
    this.activeRequests++;
    this.memoryUsageGB += estimatedMemoryGB;
  }
  
  /**
   * Release resources after request completion
   */
  static releaseResources(estimatedMemoryGB: number = 1): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    this.memoryUsageGB = Math.max(0, this.memoryUsageGB - estimatedMemoryGB);
  }
  
  /**
   * Get current resource usage
   */
  static getUsage(): { requests: number; memoryGB: number } {
    return {
      requests: this.activeRequests,
      memoryGB: this.memoryUsageGB
    };
  }
}

// Audit logger
export class SecurityAuditLogger {
  private static logs: Array<{
    timestamp: Date;
    level: 'info' | 'warn' | 'error';
    event: string;
    details: any;
  }> = [];
  
  /**
   * Log security event
   */
  static log(level: 'info' | 'warn' | 'error', event: string, details: any = {}): void {
    const entry = {
      timestamp: new Date(),
      level,
      event,
      details
    };
    
    this.logs.push(entry);
    
    // Keep only last 1000 entries
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }
    
    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[SECURITY ${level.toUpperCase()}] ${event}`, details);
    }
  }
  
  /**
   * Get recent security events
   */
  static getRecentEvents(count: number = 100): typeof SecurityAuditLogger.logs {
    return this.logs.slice(-count);
  }
  
  /**
   * Clear audit logs
   */
  static clear(): void {
    this.logs = [];
  }
}

// Export security middleware
export function createSecurityMiddleware() {
  return {
    validatePath: SecurityValidator.validatePath,
    sanitizeText: SecurityValidator.sanitizeText,
    validateNetworkBinding: SecurityValidator.validateNetworkBinding,
    checkRateLimit: SecurityValidator.checkRateLimit,
    checkResources: ResourceLimiter.checkResources,
    acquireResources: ResourceLimiter.acquireResources,
    releaseResources: ResourceLimiter.releaseResources,
    auditLog: SecurityAuditLogger.log
  };
}

// Periodic cleanup task
setInterval(() => {
  SecurityValidator.cleanupRateLimits();
}, 60000); // Run every minute

export default {
  SECURITY_LIMITS,
  SecurityValidator,
  ResourceLimiter,
  SecurityAuditLogger,
  createSecurityMiddleware,
  // Schemas
  ModelConfigSchema,
  GenerateOptionsSchema,
  EmailAnalysisRequestSchema
};