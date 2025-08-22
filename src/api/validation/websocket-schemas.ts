/**
 * WebSocket Message Validation Schemas
 * Comprehensive Zod schemas for validating WebSocket messages and preventing injection attacks
 */

import { z } from 'zod';

// Common validation patterns
const SafeStringSchema = z.string()
  .max(1000)
  .refine(
    (val) => !/<script|javascript:|data:|vbscript:|on\w+\s*=/i.test(val),
    { message: 'Potentially dangerous content detected' }
  );

const UserIdSchema = z.string()
  .min(1, 'User ID cannot be empty')
  .max(50, 'User ID too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'User ID contains invalid characters');

const SessionIdSchema = z.string()
  .min(10, 'Session ID too short')
  .max(100, 'Session ID too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Session ID contains invalid characters');

const TimestampSchema = z.string()
  .refine((val) => !isNaN(Date.parse(val)), 'Invalid timestamp format')
  .refine((val) => {
    const date = new Date(val);
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    
    return date >= fiveMinutesAgo && date <= fiveMinutesFromNow;
  }, 'Timestamp too old or in the future');

// Base message schema
const BaseMessageSchema = z.object({
  type: z.string().min(1, 'Message type required'),
  timestamp: TimestampSchema.optional(),
  correlationId: z.string().uuid().optional(),
});

// Authentication message schema
export const AuthMessageSchema = BaseMessageSchema.extend({
  type: z.literal('auth'),
  data: z.object({
    token: z.string()
      .min(10, 'Token too short')
      .max(2000, 'Token too long')
      .optional(),
    userId: UserIdSchema.optional(),
    sessionId: SessionIdSchema.optional(),
  }),
});

// Subscription message schema
export const SubscriptionMessageSchema = BaseMessageSchema.extend({
  type: z.literal('subscribe'),
  data: z.object({
    events: z.array(
      z.enum([
        'nlp_processing',
        'nlp_result', 
        'cart_update',
        'price_update',
        'product_match',
        'deal_notification',
        'order_status'
      ])
    ).min(1, 'At least one event type required')
     .max(10, 'Too many subscription events'),
    filters: z.record(z.string(), z.unknown()).optional(),
  }),
});

// Unsubscription message schema
export const UnsubscriptionMessageSchema = BaseMessageSchema.extend({
  type: z.literal('unsubscribe'),
  data: z.object({
    events: z.array(z.string()).optional(),
    subscriptionId: z.string().uuid().optional(),
  }),
});

// Ping/Heartbeat message schema
export const PingMessageSchema = BaseMessageSchema.extend({
  type: z.literal('ping'),
  data: z.object({
    timestamp: z.number().optional(),
  }).optional(),
});

// Query/Search message schema
export const QueryMessageSchema = BaseMessageSchema.extend({
  type: z.literal('query'),
  data: z.object({
    query: z.string()
      .min(1, 'Query cannot be empty')
      .max(500, 'Query too long')
      .refine(
        (val) => !/<script|javascript:|data:|vbscript:|on\w+\s*=/i.test(val),
        { message: 'Potentially dangerous content detected' }
      ),
    filters: z.record(z.string(), z.unknown()).optional(),
    limit: z.number().min(1).max(100).optional(),
    offset: z.number().min(0).optional(),
  }),
});

// Product search message schema
export const ProductSearchMessageSchema = BaseMessageSchema.extend({
  type: z.literal('product_search'),
  data: z.object({
    query: z.string()
      .min(1, 'Search query required')
      .max(200, 'Search query too long')
      .refine(
        (val) => !/<script|javascript:|data:|vbscript:|on\w+\s*=/i.test(val),
        { message: 'Potentially dangerous content detected' }
      ),
    category: z.string().max(50).optional(),
    zipCode: z.string()
      .regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format')
      .optional(),
    priceRange: z.object({
      min: z.number().min(0),
      max: z.number().min(0),
    }).optional(),
    limit: z.number().min(1).max(50).default(10),
  }),
});

// Cart operation message schema
export const CartOperationMessageSchema = BaseMessageSchema.extend({
  type: z.literal('cart_operation'),
  data: z.object({
    operation: z.enum(['add', 'remove', 'update', 'clear']),
    productId: z.string()
      .min(1, 'Product ID required')
      .max(50, 'Product ID too long')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid product ID format')
      .optional(),
    quantity: z.number().min(0).max(1000).optional(),
    options: z.record(z.string(), z.unknown()).optional(),
  }),
});

// Price alert message schema
export const PriceAlertMessageSchema = BaseMessageSchema.extend({
  type: z.literal('price_alert'),
  data: z.object({
    productId: z.string()
      .min(1, 'Product ID required')
      .max(50, 'Product ID too long'),
    targetPrice: z.number().min(0.01, 'Price must be positive'),
    alertType: z.enum(['below', 'above', 'change']),
    enabled: z.boolean().optional(),
  }),
});

// NLP processing message schema
export const NLPMessageSchema = BaseMessageSchema.extend({
  type: z.literal('nlp_message'),
  data: z.object({
    message: z.string()
      .min(1, 'Message cannot be empty')
      .max(2000, 'Message too long')
      .refine(
        (val) => !/<script|javascript:|data:|vbscript:|on\w+\s*=/i.test(val),
        { message: 'Potentially dangerous content detected' }
      ),
    context: z.object({
      conversationId: z.string().uuid().optional(),
      previousMessages: z.array(SafeStringSchema).max(10).optional(),
    }).optional(),
    options: z.object({
      includeProducts: z.boolean().optional(),
      includePrices: z.boolean().optional(),
      includeDeals: z.boolean().optional(),
    }).optional(),
  }),
});

// Error report message schema
export const ErrorReportMessageSchema = BaseMessageSchema.extend({
  type: z.literal('error_report'),
  data: z.object({
    error: z.object({
      code: z.string().max(50),
      message: SafeStringSchema.max(500),
      context: z.record(z.string(), z.unknown()).optional(),
    }),
    userAgent: z.string().max(500).optional(),
    url: z.string().url().optional(),
  }),
});

// Configuration message schema
export const ConfigMessageSchema = BaseMessageSchema.extend({
  type: z.literal('config'),
  data: z.object({
    setting: z.enum(['notifications', 'auto_suggestions', 'price_alerts']),
    value: z.unknown(),
  }),
});

// Union of all inbound message schemas
export const InboundMessageSchema = z.discriminatedUnion('type', [
  AuthMessageSchema,
  SubscriptionMessageSchema,
  UnsubscriptionMessageSchema,
  PingMessageSchema,
  QueryMessageSchema,
  ProductSearchMessageSchema,
  CartOperationMessageSchema,
  PriceAlertMessageSchema,
  NLPMessageSchema,
  ErrorReportMessageSchema,
  ConfigMessageSchema,
]);

// Outbound message schemas (server to client)
export const OutboundNLPProcessingSchema = z.object({
  type: z.literal('nlp_processing'),
  data: z.object({
    message: z.string(),
    clientId: z.string().optional(),
    features: z.array(z.string()).optional(),
    processingTime: z.number().optional(),
  }),
  timestamp: z.string(),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
});

export const OutboundNLPResultSchema = z.object({
  type: z.literal('nlp_result'),
  data: z.object({
    response: z.string(),
    products: z.array(z.unknown()).optional(),
    suggestions: z.array(z.string()).optional(),
    deals: z.array(z.unknown()).optional(),
    confidence: z.number().min(0).max(1).optional(),
  }),
  timestamp: z.string(),
  correlationId: z.string().uuid().optional(),
});

export const OutboundErrorSchema = z.object({
  type: z.literal('error'),
  data: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    recoverable: z.boolean().optional(),
  }),
  timestamp: z.string(),
  correlationId: z.string().uuid().optional(),
});

// Union of all outbound message schemas
export const OutboundMessageSchema = z.discriminatedUnion('type', [
  OutboundNLPProcessingSchema,
  OutboundNLPResultSchema,
  OutboundErrorSchema,
]);

// Type exports
export type InboundMessage = z.infer<typeof InboundMessageSchema>;
export type OutboundMessage = z.infer<typeof OutboundMessageSchema>;
export type AuthMessage = z.infer<typeof AuthMessageSchema>;
export type SubscriptionMessage = z.infer<typeof SubscriptionMessageSchema>;
export type ProductSearchMessage = z.infer<typeof ProductSearchMessageSchema>;
export type NLPMessage = z.infer<typeof NLPMessageSchema>;
export type CartOperationMessage = z.infer<typeof CartOperationMessageSchema>;

/**
 * Validate inbound message with detailed error reporting
 */
export function validateInboundMessage(data: unknown): {
  success: boolean;
  data?: InboundMessage;
  error?: {
    message: string;
    details: z.ZodError['errors'];
  };
} {
  try {
    const result = InboundMessageSchema.safeParse(data);
    
    if (result.success) {
      return { success: true, data: result.data };
    }
    
    return {
      success: false,
      error: {
        message: 'Message validation failed',
        details: result.error.errors,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: 'Validation error',
        details: [],
      },
    };
  }
}

/**
 * Validate outbound message before sending
 */
export function validateOutboundMessage(data: unknown): {
  success: boolean;
  data?: OutboundMessage;
  error?: string;
} {
  try {
    const result = OutboundMessageSchema.safeParse(data);
    
    if (result.success) {
      return { success: true, data: result.data };
    }
    
    return {
      success: false,
      error: result.error.errors.map(e => e.message).join(', '),
    };
  } catch (error) {
    return {
      success: false,
      error: 'Validation error occurred',
    };
  }
}

/**
 * Sanitize message data for logging (remove sensitive information)
 */
export function sanitizeMessageForLogging(message: any): any {
  const sensitiveFields = ['token', 'password', 'authorization', 'secret', 'key'];
  
  function sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = sanitizeObject(value);
        }
      }
      return sanitized;
    }
    
    return obj;
  }
  
  return sanitizeObject(message);
}