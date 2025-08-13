/**
 * Enhanced Input Validation & Sanitization Middleware
 * Prevents injection attacks and ensures data integrity
 * 
 * Security Features:
 * - SQL injection prevention
 * - XSS protection
 * - Command injection prevention
 * - Path traversal prevention
 * - XXE prevention
 * - File upload validation
 * - Data type enforcement
 * - Business logic validation
 */

import { z } from "zod";
import DOMPurify from "isomorphic-dompurify";
import validator from "validator";
import { createHash } from "crypto";
import path from "path";
import { logger } from "../../../utils/logger.js";
import type { Request, Response, NextFunction } from "express";

// Validation constants
const MAX_STRING_LENGTH = 10000;
const MAX_ARRAY_LENGTH = 100;
const MAX_OBJECT_DEPTH = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = {
  image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  document: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  receipt: ["image/jpeg", "image/png", "application/pdf"],
};

// Dangerous patterns to detect
const DANGEROUS_PATTERNS = {
  sqlInjection: [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE|SCRIPT|TRUNCATE)\b)/gi,
    /(-{2}|\/\*|\*\/|;|\||&&|\|\||>|<|=|'|")/g,
    /(0x[0-9a-f]+)/gi,
    /(\bOR\b\s*\d+\s*=\s*\d+)/gi,
    /(\bAND\b\s*\d+\s*=\s*\d+)/gi,
  ],
  xss: [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<embed[^>]*>/gi,
    /<object[^>]*>/gi,
    /data:text\/html/gi,
  ],
  commandInjection: [
    /[;&|`$()]/, 
    /\$\{.*\}/,
    /\$\(.*\)/,
    /`.*`/,
  ],
  pathTraversal: [
    /\.\.\//g,
    /\.\.\\/, 
    /%2e%2e%2f/gi,
    /%252e%252e%252f/gi,
    /\.\./,
  ],
  xxe: [
    /<!DOCTYPE[^>]*>/gi,
    /<!ENTITY[^>]*>/gi,
    /<!\[CDATA\[/gi,
  ],
};

/**
 * Sanitize string input
 */
export function sanitizeString(
  input: string,
  options: {
    maxLength?: number;
    allowHtml?: boolean;
    allowSpecialChars?: boolean;
    trim?: boolean;
  } = {}
): string {
  const {
    maxLength = MAX_STRING_LENGTH,
    allowHtml = false,
    allowSpecialChars = true,
    trim = true,
  } = options;

  let sanitized = input;

  // Trim whitespace
  if (trim) {
    sanitized = sanitized.trim();
  }

  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Remove HTML if not allowed
  if (!allowHtml) {
    sanitized = DOMPurify.sanitize(sanitized, { 
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    });
  } else {
    // Allow safe HTML only
    sanitized = DOMPurify.sanitize(sanitized, {
      ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br"],
      ALLOWED_ATTR: ["href", "title"],
      ALLOWED_PROTOCOLS: ["http", "https", "mailto"],
    });
  }

  // Remove special characters if not allowed
  if (!allowSpecialChars) {
    sanitized = sanitized.replace(/[^\w\s\-.,!?]/g, "");
  }

  // Escape SQL-like patterns
  sanitized = sanitized
    .replace(/'/g, "''")
    .replace(/--/g, "")
    .replace(/\/\*/g, "")
    .replace(/\*\//g, "");

  return sanitized;
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  
  if (!validator.isEmail(trimmed)) {
    throw new Error("Invalid email format");
  }
  
  // Additional validation for common attack patterns
  if (trimmed.includes("..") || trimmed.includes("//")) {
    throw new Error("Invalid email format");
  }
  
  return validator.normalizeEmail(trimmed, {
    gmail_remove_dots: false,
    gmail_remove_subaddress: false,
  }) || trimmed;
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  
  // Check if valid URL
  if (!validator.isURL(trimmed, {
    protocols: ["http", "https"],
    require_protocol: true,
    require_valid_protocol: true,
    allow_fragments: true,
    allow_query_components: true,
  })) {
    throw new Error("Invalid URL format");
  }
  
  // Check for dangerous protocols
  const dangerousProtocols = ["javascript:", "data:", "vbscript:", "file:"];
  const lowerUrl = trimmed.toLowerCase();
  
  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      throw new Error("Dangerous URL protocol");
    }
  }
  
  // Encode special characters
  try {
    const urlObj = new URL(trimmed);
    return urlObj.toString();
  } catch {
    throw new Error("Invalid URL format");
  }
}

/**
 * Validate and sanitize phone number
 */
export function sanitizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  
  if (!validator.isMobilePhone(cleaned, "any")) {
    throw new Error("Invalid phone number");
  }
  
  return cleaned;
}

/**
 * Validate and sanitize file path
 */
export function sanitizeFilePath(filePath: string, basePath?: string): string {
  // Remove null bytes
  let sanitized = filePath.replace(/\0/g, "");
  
  // Check for path traversal
  for (const pattern of DANGEROUS_PATTERNS.pathTraversal) {
    if (pattern.test(sanitized)) {
      throw new Error("Path traversal detected");
    }
  }
  
  // Normalize the path
  const normalized = path.normalize(sanitized);
  
  // If base path provided, ensure file is within it
  if (basePath) {
    const resolvedPath = path.resolve(basePath, normalized);
    const resolvedBase = path.resolve(basePath);
    
    if (!resolvedPath.startsWith(resolvedBase)) {
      throw new Error("Path outside allowed directory");
    }
    
    return resolvedPath;
  }
  
  return normalized;
}

/**
 * Check for dangerous patterns in input
 */
export function detectDangerousPatterns(
  input: string,
  patternType: keyof typeof DANGEROUS_PATTERNS
): boolean {
  const patterns = DANGEROUS_PATTERNS[patternType];
  
  for (const pattern of patterns) {
    if (pattern.test(input)) {
      logger.warn("Dangerous pattern detected", "SECURITY", {
        patternType,
        pattern: pattern.toString(),
        inputLength: input.length,
        inputHash: createHash("sha256").update(input).digest("hex").substring(0, 8),
      });
      return true;
    }
  }
  
  return false;
}

/**
 * Deep sanitize object recursively
 */
export function sanitizeObject(
  obj: any,
  depth: number = 0
): any {
  if (depth > MAX_OBJECT_DEPTH) {
    throw new Error("Object depth exceeds maximum allowed");
  }
  
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === "string") {
    return sanitizeString(obj);
  }
  
  if (typeof obj === "number" || typeof obj === "boolean") {
    return obj;
  }
  
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  if (Array.isArray(obj)) {
    if (obj.length > MAX_ARRAY_LENGTH) {
      throw new Error("Array length exceeds maximum allowed");
    }
    return obj.map(item => sanitizeObject(item, depth + 1));
  }
  
  if (typeof obj === "object") {
    const sanitized: any = {};
    const keys = Object.keys(obj);
    
    if (keys.length > MAX_ARRAY_LENGTH) {
      throw new Error("Object has too many properties");
    }
    
    for (const key of keys) {
      // Sanitize key name
      const sanitizedKey = sanitizeString(key, {
        maxLength: 100,
        allowHtml: false,
        allowSpecialChars: false,
      });
      
      // Sanitize value
      sanitized[sanitizedKey] = sanitizeObject(obj[key], depth + 1);
    }
    
    return sanitized;
  }
  
  // Unknown type, reject
  throw new Error("Invalid data type");
}

/**
 * Validate file upload
 */
export function validateFileUpload(
  file: Express.Multer.File,
  options: {
    allowedTypes?: string[];
    maxSize?: number;
    scanForVirus?: boolean;
  } = {}
): { valid: boolean; error?: string } {
  const {
    allowedTypes = ALLOWED_FILE_TYPES.image,
    maxSize = MAX_FILE_SIZE,
    scanForVirus = true,
  } = options;
  
  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed (${maxSize} bytes)`,
    };
  }
  
  // Check MIME type
  if (!allowedTypes.includes(file.mimetype)) {
    return {
      valid: false,
      error: `File type not allowed: ${file.mimetype}`,
    };
  }
  
  // Check file extension matches MIME type
  const ext = path.extname(file.originalname).toLowerCase();
  const expectedExts: Record<string, string[]> = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/gif": [".gif"],
    "image/webp": [".webp"],
    "application/pdf": [".pdf"],
  };
  
  const validExts = expectedExts[file.mimetype];
  if (validExts && !validExts.includes(ext)) {
    return {
      valid: false,
      error: "File extension does not match MIME type",
    };
  }
  
  // Check for dangerous file names
  const dangerousNames = [
    /\.exe$/i,
    /\.dll$/i,
    /\.scr$/i,
    /\.bat$/i,
    /\.cmd$/i,
    /\.com$/i,
    /\.pif$/i,
    /\.js$/i,
    /\.vbs$/i,
    /\.jar$/i,
  ];
  
  for (const pattern of dangerousNames) {
    if (pattern.test(file.originalname)) {
      return {
        valid: false,
        error: "Dangerous file name detected",
      };
    }
  }
  
  // TODO: Implement virus scanning
  if (scanForVirus) {
    // In production, integrate with antivirus service
    // const scanResult = await antivirusService.scan(file.buffer);
    // if (scanResult.infected) {
    //   return { valid: false, error: "Virus detected" };
    // }
  }
  
  return { valid: true };
}

/**
 * Create Zod schemas with enhanced validation
 */
export const enhancedSchemas = {
  // Email with sanitization
  email: z
    .string()
    .min(1, "Email is required")
    .max(254, "Email too long")
    .transform(sanitizeEmail)
    .refine(val => !detectDangerousPatterns(val, "xss"), {
      message: "Invalid email format",
    }),
  
  // URL with sanitization
  url: z
    .string()
    .min(1, "URL is required")
    .max(2048, "URL too long")
    .transform(sanitizeUrl),
  
  // Phone number with sanitization
  phone: z
    .string()
    .min(10, "Phone number too short")
    .max(15, "Phone number too long")
    .transform(sanitizePhoneNumber),
  
  // Safe string (no HTML, limited special chars)
  safeString: z
    .string()
    .max(1000)
    .transform(val => sanitizeString(val, {
      allowHtml: false,
      allowSpecialChars: true,
    }))
    .refine(val => !detectDangerousPatterns(val, "sqlInjection"), {
      message: "Invalid input detected",
    })
    .refine(val => !detectDangerousPatterns(val, "xss"), {
      message: "Invalid input detected",
    }),
  
  // Product ID validation
  productId: z
    .string()
    .regex(/^[A-Z0-9]{8,12}$/, "Invalid product ID format")
    .refine(val => !detectDangerousPatterns(val, "sqlInjection"), {
      message: "Invalid product ID",
    }),
  
  // Order ID validation
  orderId: z
    .string()
    .regex(/^WM\d{10,15}$/, "Invalid order ID format"),
  
  // Zip code validation
  zipCode: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, "Invalid zip code format"),
  
  // Credit card validation (PCI compliant - never log)
  creditCard: z
    .string()
    .refine(val => validator.isCreditCard(val), {
      message: "Invalid credit card number",
    })
    .transform(val => {
      // Never log credit card numbers
      // Return masked version for display
      return val.substring(0, 4) + "****" + val.substring(val.length - 4);
    }),
  
  // Price validation
  price: z
    .number()
    .positive("Price must be positive")
    .max(1000000, "Price exceeds maximum")
    .multipleOf(0.01, "Price must have at most 2 decimal places"),
  
  // Quantity validation
  quantity: z
    .number()
    .int("Quantity must be an integer")
    .positive("Quantity must be positive")
    .max(99, "Quantity exceeds maximum"),
  
  // Date validation
  date: z
    .string()
    .refine(val => validator.isISO8601(val), {
      message: "Invalid date format",
    })
    .transform(val => new Date(val).toISOString()),
  
  // Array with size limit
  limitedArray: (itemSchema: z.ZodSchema, maxLength = 100) =>
    z.array(itemSchema).max(maxLength, `Array exceeds maximum length of ${maxLength}`),
  
  // Pagination
  pagination: z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    sortBy: z.string().regex(/^[a-zA-Z_]+$/).optional(),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  }),
};

/**
 * Input validation middleware
 */
export function validateInput(schema: z.ZodSchema) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Validate and sanitize input
      const validated = await schema.parseAsync(req.body);
      
      // Replace request body with sanitized data
      req.body = validated;
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn("Input validation failed", "VALIDATION", {
          path: req.path,
          errors: error.errors,
          ip: req.ip,
        });
        
        res.status(400).json({
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: error.errors.map(e => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
        return;
      }
      
      logger.error("Input validation error", "VALIDATION", { error });
      res.status(500).json({
        error: "Validation service error",
        code: "VALIDATION_ERROR",
      });
    }
  };
}

/**
 * Query parameter validation middleware
 */
export function validateQuery(schema: z.ZodSchema) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const validated = await schema.parseAsync(req.query);
      req.query = validated as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: "Query validation failed",
          code: "VALIDATION_ERROR",
          details: error.errors,
        });
        return;
      }
      
      res.status(500).json({
        error: "Validation service error",
        code: "VALIDATION_ERROR",
      });
    }
  };
}

/**
 * Create safe SQL query builder
 */
export class SafeQueryBuilder {
  private query: string = "";
  private params: any[] = [];
  
  select(columns: string[]): this {
    // Validate column names
    const safe = columns.map(col => {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) {
        throw new Error(`Invalid column name: ${col}`);
      }
      return col;
    });
    
    this.query = `SELECT ${safe.join(", ")}`;
    return this;
  }
  
  from(table: string): this {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
      throw new Error(`Invalid table name: ${table}`);
    }
    
    this.query += ` FROM ${table}`;
    return this;
  }
  
  where(condition: string, ...params: any[]): this {
    // Use parameterized queries
    this.query += ` WHERE ${condition}`;
    this.params.push(...params);
    return this;
  }
  
  orderBy(column: string, direction: "ASC" | "DESC" = "ASC"): this {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new Error(`Invalid column name: ${column}`);
    }
    
    this.query += ` ORDER BY ${column} ${direction}`;
    return this;
  }
  
  limit(limit: number): this {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error("Invalid limit value");
    }
    
    this.query += ` LIMIT ${limit}`;
    return this;
  }
  
  build(): { query: string; params: any[] } {
    return {
      query: this.query,
      params: this.params,
    };
  }
}

/**
 * Monitor and log suspicious inputs
 */
export function monitorSuspiciousInput(
  input: any,
  source: string,
  metadata: Record<string, any> = {}
): void {
  const suspicious = [];
  
  // Check for various attack patterns
  if (typeof input === "string") {
    if (detectDangerousPatterns(input, "sqlInjection")) {
      suspicious.push("SQL injection attempt");
    }
    if (detectDangerousPatterns(input, "xss")) {
      suspicious.push("XSS attempt");
    }
    if (detectDangerousPatterns(input, "commandInjection")) {
      suspicious.push("Command injection attempt");
    }
    if (detectDangerousPatterns(input, "pathTraversal")) {
      suspicious.push("Path traversal attempt");
    }
  }
  
  if (suspicious.length > 0) {
    logger.warn("Suspicious input detected", "SECURITY", {
      source,
      patterns: suspicious,
      inputHash: createHash("sha256")
        .update(JSON.stringify(input))
        .digest("hex")
        .substring(0, 16),
      ...metadata,
    });
    
    // In production, trigger security alerts
    // securityService.alert("suspicious_input", { source, patterns: suspicious });
  }
}

/**
 * Export validation utilities
 */
export const validationUtils = {
  sanitizeString,
  sanitizeEmail,
  sanitizeUrl,
  sanitizePhoneNumber,
  sanitizeFilePath,
  sanitizeObject,
  detectDangerousPatterns,
  validateFileUpload,
  monitorSuspiciousInput,
  SafeQueryBuilder,
};