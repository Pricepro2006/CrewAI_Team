/**
 * Enhanced Path Validation Module
 * Comprehensive protection against path traversal attacks
 * Including double-encoded paths, unicode bypasses, and null bytes
 */

import * as path from 'path';
import * as fs from 'fs';
import { createHash } from 'crypto';
import { logger } from '../logger.js';

interface PathValidationOptions {
  allowSymlinks?: boolean;
  maxPathLength?: number;
  allowedExtensions?: string[];
  blockedExtensions?: string[];
  basePath?: string;
  strict?: boolean;
}

const DEFAULT_OPTIONS: Required<PathValidationOptions> = {
  allowSymlinks: false,
  maxPathLength: 4096,
  allowedExtensions: [],
  blockedExtensions: ['.exe', '.dll', '.scr', '.bat', '.cmd', '.com', '.pif', '.js', '.vbs', '.jar', '.sh', '.bash'],
  basePath: process.cwd(),
  strict: true
};

// Dangerous path patterns - comprehensive list
const DANGEROUS_PATTERNS = [
  // Basic traversal
  /\.\./,
  /\.\.\\/,
  
  // URL encoded traversal
  /%2e%2e%2f/gi,
  /%2e%2e%5c/gi,
  
  // Double URL encoding
  /%252e%252e%252f/gi,
  /%252e%252e%255c/gi,
  
  // Unicode/UTF-8 encoding attempts
  /\\u002e\\u002e/gi,
  /\\x2e\\x2e/gi,
  
  // Mixed encoding
  /\.%2e\//gi,
  /%2e\.\//gi,
  
  // Windows specific
  /\.\.[\\\/]/,
  /[\\\/]\.\.[\\\/]/,
  
  // Null byte injection
  /\x00/,
  /%00/,
  
  // Alternative data streams (Windows)
  /:/,
  
  // UNC paths
  /^\\\\[^\\]/,
  /^\/\/[^\/]/,
];

// Reserved filenames (Windows)
const RESERVED_NAMES = [
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
];

export class PathValidator {
  private options: Required<PathValidationOptions>;
  private validationCache: Map<string, boolean> = new Map();
  private readonly MAX_CACHE_SIZE = 1000;

  constructor(options: PathValidationOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Comprehensive path validation
   */
  public validatePath(inputPath: string): { valid: boolean; sanitized?: string; error?: string } {
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(inputPath);
      if (this.validationCache.has(cacheKey)) {
        return { valid: this.validationCache.get(cacheKey)!, sanitized: this.normalizePath(inputPath) };
      }

      // Step 1: Basic validation
      if (!inputPath || typeof inputPath !== 'string') {
        return { valid: false, error: 'Invalid path: must be a non-empty string' };
      }

      // Step 2: Length check
      if (inputPath.length > this.options.maxPathLength) {
        return { valid: false, error: `Path exceeds maximum length of ${this.options.maxPathLength}` };
      }

      // Step 3: Decode and normalize multiple times to catch double encoding
      let decodedPath = inputPath;
      for (let i = 0; i < 3; i++) {
        try {
          const prev = decodedPath;
          decodedPath = decodeURIComponent(decodedPath);
          decodedPath = decodedPath.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => 
            String.fromCharCode(parseInt(code, 16))
          );
          decodedPath = decodedPath.replace(/\\x([0-9a-fA-F]{2})/g, (_, code) => 
            String.fromCharCode(parseInt(code, 16))
          );
          if (prev === decodedPath) break;
        } catch {
          // If decoding fails, path might be malformed
          return { valid: false, error: 'Malformed path encoding detected' };
        }
      }

      // Step 4: Check for dangerous patterns
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(decodedPath) || pattern.test(inputPath)) {
          logger.warn('Dangerous path pattern detected', 'PATH_VALIDATION', {
            pattern: pattern.toString(),
            pathHash: createHash('sha256').update(inputPath).digest('hex').substring(0, 8)
          });
          return { valid: false, error: 'Path contains dangerous patterns' };
        }
      }

      // Step 5: Check for reserved names (Windows)
      const basenameParts = path.basename(decodedPath).toUpperCase().split('.');
      const basename = basenameParts[0];
      if (basename && RESERVED_NAMES.includes(basename)) {
        return { valid: false, error: 'Path contains reserved system name' };
      }

      // Step 6: Normalize and resolve path
      const normalized = this.normalizePath(decodedPath);
      
      // Step 7: Ensure path is within base directory
      if (this.options.basePath) {
        const resolved = path.resolve(this.options.basePath, normalized);
        const baseResolved = path.resolve(this.options.basePath);
        
        if (!resolved.startsWith(baseResolved)) {
          logger.warn('Path traversal attempt detected', 'PATH_VALIDATION', {
            attemptedPath: inputPath,
            resolvedPath: resolved,
            basePath: baseResolved
          });
          return { valid: false, error: 'Path is outside allowed directory' };
        }
      }

      // Step 8: Check file extension
      const ext = path.extname(normalized).toLowerCase();
      
      if (this.options.blockedExtensions.length > 0 && 
          this.options.blockedExtensions.includes(ext)) {
        return { valid: false, error: `File extension ${ext} is not allowed` };
      }
      
      if (this.options.allowedExtensions.length > 0 && 
          ext && !this.options.allowedExtensions.includes(ext)) {
        return { valid: false, error: `File extension ${ext} is not in allowed list` };
      }

      // Step 9: Check for symlinks if not allowed
      if (!this.options.allowSymlinks && fs.existsSync(normalized)) {
        try {
          const stats = fs.lstatSync(normalized);
          if (stats.isSymbolicLink()) {
            return { valid: false, error: 'Symbolic links are not allowed' };
          }
        } catch (err) {
          // File doesn't exist or can't be accessed, which is okay for validation
        }
      }

      // Step 10: Additional strict mode checks
      if (this.options.strict) {
        // Check for hidden files
        const parts = normalized.split(path.sep);
        for (const part of parts) {
          if (part.startsWith('.') && part !== '.' && part !== '..') {
            return { valid: false, error: 'Hidden files/directories not allowed in strict mode' };
          }
        }

        // Check for special characters
        if (/[<>:"|?*]/.test(normalized)) {
          return { valid: false, error: 'Special characters not allowed in strict mode' };
        }
      }

      // Cache the result
      this.updateCache(cacheKey, true);

      return { valid: true, sanitized: normalized };

    } catch (error) {
      logger.error('Path validation error', 'PATH_VALIDATION', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return { valid: false, error: 'Path validation failed' };
    }
  }

  /**
   * Validate multiple paths
   */
  public validatePaths(paths: string[]): Map<string, { valid: boolean; error?: string }> {
    const results = new Map<string, { valid: boolean; error?: string }>();
    
    for (const inputPath of paths) {
      const result = this.validatePath(inputPath);
      results.set(inputPath, { valid: result.valid, error: result.error });
    }
    
    return results;
  }

  /**
   * Normalize path safely
   */
  private normalizePath(inputPath: string): string {
    // Remove null bytes
    let cleaned = inputPath.replace(/\x00/g, '');
    
    // Remove multiple slashes
    cleaned = cleaned.replace(/[\/\\]+/g, path.sep);
    
    // Remove trailing slashes except for root
    if (cleaned.length > 1 && cleaned.endsWith(path.sep)) {
      cleaned = cleaned.slice(0, -1);
    }
    
    // Normalize the path
    return path.normalize(cleaned);
  }

  /**
   * Generate cache key for path
   */
  private getCacheKey(inputPath: string): string {
    return createHash('sha256')
      .update(inputPath)
      .update(JSON.stringify(this.options))
      .digest('hex');
  }

  /**
   * Update validation cache with LRU eviction
   */
  private updateCache(key: string, value: boolean): void {
    if (this.validationCache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entry (FIFO for simplicity)
      const firstKey = this.validationCache.keys().next().value;
      if (firstKey !== undefined) {
        this.validationCache.delete(firstKey);
      }
    }
    this.validationCache.set(key, value);
  }

  /**
   * Clear validation cache
   */
  public clearCache(): void {
    this.validationCache.clear();
  }

  /**
   * Create a safe file path within base directory
   */
  public createSafePath(filename: string, subdirectory?: string): string | null {
    const validation = this.validatePath(filename);
    if (!validation.valid) {
      return null;
    }

    let safePath = this.options.basePath;
    
    if (subdirectory) {
      const subValidation = this.validatePath(subdirectory);
      if (!subValidation.valid || !subValidation.sanitized) {
        return null;
      }
      safePath = path.join(safePath, subValidation.sanitized);
    }
    
    if (!validation.sanitized) {
      return null;
    }
    
    return path.join(safePath, validation.sanitized);
  }

  /**
   * Check if path is safe for reading
   */
  public async canRead(inputPath: string): Promise<boolean> {
    const validation = this.validatePath(inputPath);
    if (!validation.valid || !validation.sanitized) {
      return false;
    }

    try {
      await fs.promises.access(validation.sanitized, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if path is safe for writing
   */
  public async canWrite(inputPath: string): Promise<boolean> {
    const validation = this.validatePath(inputPath);
    if (!validation.valid || !validation.sanitized) {
      return false;
    }

    const dir = path.dirname(validation.sanitized);
    try {
      await fs.promises.access(dir, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance with default options
export const pathValidator = new PathValidator();

// Export validation function for convenience
export function validatePath(inputPath: string, options?: PathValidationOptions): { 
  valid: boolean; 
  sanitized?: string; 
  error?: string 
} {
  const validator = new PathValidator(options);
  return validator.validatePath(inputPath);
}

// Export middleware for Express
export function pathValidationMiddleware(options?: PathValidationOptions) {
  const validator = new PathValidator(options);
  
  return (req: any, res: any, next: any) => {
    // Validate all path-like parameters
    const pathParams = [
      req.params?.path,
      req.params?.filename,
      req.query?.path,
      req.query?.file,
      req.body?.path,
      req.body?.filename,
      req.body?.filePath
    ].filter(Boolean);

    for (const pathParam of pathParams) {
      const result = validator.validatePath(pathParam);
      if (!result.valid) {
        logger.warn('Path validation failed in middleware', 'SECURITY', {
          path: pathParam,
          error: result.error,
          ip: req.ip
        });
        
        return res.status(400).json({
          error: 'Invalid path',
          code: 'PATH_VALIDATION_ERROR',
          message: result.error
        });
      }
    }

    next();
  };
}