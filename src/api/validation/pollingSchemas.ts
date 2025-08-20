/**
 * Validation Schemas for Polling Router
 * Comprehensive Zod schemas for polling data validation
 */

import { z } from 'zod';

// ============================================================================
// Core Polling Schemas
// ============================================================================

export const PollingDataSchema = z.object({
  version: z.number().min(0, 'Version must be non-negative'),
  timestamp: z.number().min(0, 'Timestamp must be non-negative'),
  data: z.any().nullable(),
  hasChanges: z.boolean(),
  nextPollInterval: z.number().min(1000).max(60000).optional() // 1s to 60s
});

// ============================================================================
// Walmart Polling Schemas
// ============================================================================

export const WalmartGroceryItemSchema = z.object({
  id: z.string().min(1, 'Item ID is required'),
  name: z.string().min(1, 'Item name is required'),
  quantity: z.number().min(0, 'Quantity must be non-negative'),
  price: z.number().nullable(),
  category: z.string().nullable(),
  updatedAt: z.string()
});

export const WalmartPollingDataSchema = z.object({
  groceryList: z.array(WalmartGroceryItemSchema).max(1000, 'Maximum 1000 items allowed'),
  cartTotal: z.number().min(0, 'Cart total must be non-negative'),
  recommendations: z.array(z.any()).max(100, 'Maximum 100 recommendations'),
  deals: z.array(z.any()).max(100, 'Maximum 100 deals'),
  lastNlpResult: z.any().nullable()
});

// ============================================================================
// Email Polling Schemas
// ============================================================================

export const EmailItemSchema = z.object({
  id: z.string().min(1, 'Email ID is required'),
  subject: z.string().max(500, 'Subject too long'),
  from: z.string().email('Invalid email address').or(z.string()),
  timestamp: z.string(),
  hasAttachments: z.boolean(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'NORMAL', 'LOW']).optional()
});

export const ProcessingStatusSchema = z.object({
  inProgress: z.number().min(0, 'Count must be non-negative'),
  completed: z.number().min(0, 'Count must be non-negative'),
  failed: z.number().min(0, 'Count must be non-negative')
});

export const EmailPollingDataSchema = z.object({
  unreadCount: z.number().min(0, 'Count must be non-negative'),
  totalCount: z.number().min(0, 'Count must be non-negative'),
  recentEmails: z.array(EmailItemSchema).max(100, 'Maximum 100 recent emails'),
  processingStatus: ProcessingStatusSchema
});

// ============================================================================
// Deal Polling Schemas
// ============================================================================

export const DealItemSchema = z.object({
  id: z.string().min(1, 'Deal ID is required'),
  deal_base: z.string().optional(),
  customer_name: z.string().optional(),
  product_id: z.string().optional(),
  end_date: z.string(),
  price: z.number().optional(),
  quantity: z.number().optional()
});

export const DealPollingDataSchema = z.object({
  deals: z.array(DealItemSchema).max(500, 'Maximum 500 deals'),
  timestamp: z.number().min(0),
  expiringCount: z.number().min(0, 'Count must be non-negative')
});

// ============================================================================
// Request Schemas
// ============================================================================

export const PollWalmartRequestSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  sessionId: z.string().optional(),
  lastVersion: z.number().min(0).optional(),
  includeDetails: z.boolean().default(true)
});

export const PollEmailRequestSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  lastVersion: z.number().min(0).optional(),
  limit: z.number().min(1).max(100).default(10)
});

export const PollDealRequestSchema = z.object({
  customerId: z.string().optional(),
  productIds: z.array(z.string()).max(100, 'Maximum 100 product IDs').optional(),
  lastVersion: z.number().min(0).optional()
});

export const LongPollRequestSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  lastVersion: z.number().min(0, 'Version must be non-negative'),
  timeout: z.number().min(1000).max(60000).default(30000) // 1s to 60s
});

export const BatchPollRequestSchema = z.object({
  requests: z.array(z.object({
    key: z.string().min(1, 'Key is required'),
    lastVersion: z.number().min(0).optional()
  })).max(50, 'Maximum 50 batch requests')
});

// ============================================================================
// Response Schemas
// ============================================================================

export const PollingStatusSchema = z.object({
  status: z.record(z.string(), z.object({
    version: z.number().min(0),
    hasData: z.boolean(),
    lastUpdate: z.number().nullable()
  })),
  timestamp: z.number().min(0)
});

export const BatchPollResponseSchema = z.object({
  responses: z.record(z.string(), z.object({
    version: z.number().min(0),
    timestamp: z.number().min(0),
    data: z.any().nullable(),
    hasChanges: z.boolean()
  })),
  timestamp: z.number().min(0),
  nextPollInterval: z.number().min(1000).max(60000)
});

export const ForceRefreshResponseSchema = z.object({
  success: z.boolean(),
  newVersion: z.number().min(0),
  timestamp: z.number().min(0)
});

// ============================================================================
// Type Exports
// ============================================================================

export type PollingData = z.infer<typeof PollingDataSchema>;
export type WalmartPollingData = z.infer<typeof WalmartPollingDataSchema>;
export type EmailPollingData = z.infer<typeof EmailPollingDataSchema>;
export type DealPollingData = z.infer<typeof DealPollingDataSchema>;
export type ProcessingStatus = z.infer<typeof ProcessingStatusSchema>;
export type PollingStatus = z.infer<typeof PollingStatusSchema>;
export type BatchPollResponse = z.infer<typeof BatchPollResponseSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create default polling data
 */
export function createDefaultPollingData(): PollingData {
  return {
    version: 0,
    timestamp: Date.now(),
    data: null,
    hasChanges: false,
    nextPollInterval: 5000
  };
}

/**
 * Create default processing status
 */
export function createDefaultProcessingStatus(): ProcessingStatus {
  return {
    inProgress: 0,
    completed: 0,
    failed: 0
  };
}

/**
 * Validate polling interval
 */
export function validatePollInterval(interval: number): number {
  const MIN_INTERVAL = 1000; // 1 second
  const MAX_INTERVAL = 60000; // 60 seconds
  return Math.max(MIN_INTERVAL, Math.min(MAX_INTERVAL, interval));
}