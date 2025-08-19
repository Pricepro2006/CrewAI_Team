/**
 * Shared Types for Client Hooks
 * Provides consistent TypeScript interfaces across all hooks
 */

import type { TRPCClientError } from "@trpc/client";
import type { AppRouter } from "../../api/trpc/router.js";
import type { WalmartProduct, GroceryList, CartItem } from "../../types/walmart-grocery.js";
import type { TeamMember } from "../../config/team-members.config.js";

// Common hook patterns
export interface UseQueryResult<T = unknown> {
  data: T | undefined;
  isLoading: boolean;
  error: TRPCClientError<AppRouter> | null;
  isError: boolean;
  refetch: () => Promise<{ data: T | undefined }>;
}

export interface UseMutationResult<TInput = unknown, TOutput = unknown> {
  mutate: (input: TInput) => void;
  mutateAsync: (input: TInput) => Promise<TOutput>;
  isPending: boolean;
  error: TRPCClientError<AppRouter> | null;
  data: TOutput | undefined;
  isError: boolean;
  reset: () => void;
}

// Email Assignment Hook Types
export interface UseEmailAssignmentOptions {
  onSuccess?: (data: unknown) => void;
  onError?: (error: unknown) => void;
}

export interface UseEmailAssignmentReturn {
  teamMembers: TeamMember[];
  workloadData: unknown;
  isLoading: boolean;
  isAssigning: boolean;
  assignEmail: (emailId: string, assignedTo: string | null) => Promise<void>;
  bulkAssignEmails: (emailIds: string[], assignedTo: string | null) => Promise<void>;
  getAssignmentSuggestions: (emailId: string) => Promise<unknown[]>;
  getTeamMemberById: (memberId: string) => TeamMember | undefined;
  getAssignedMemberName: (assignedTo?: string) => string;
  error: unknown;
  errorMessage: string;
  refetchTeamMembers: () => Promise<{ data: TeamMember[] }>;
  refetchWorkload: () => Promise<{ data: unknown }>;
}

// Walmart Hooks Types
export interface WalmartSearchOptions {
  query: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  dietary?: string[];
  limit?: number;
  offset?: number;
}

export interface UseWalmartSearchReturn {
  search: (options: WalmartSearchOptions) => Promise<void>;
  results: WalmartProduct[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  clearResults: () => void;
}

export interface UseWalmartProductSearchReturn {
  search: (params: {
    query: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    limit?: number;
  }) => Promise<void>;
  searchResults: {
    products: WalmartProduct[];
    total: number;
  };
  isSearching: boolean;
  error: TRPCClientError<AppRouter> | null;
}

export interface UseCartReturn {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  addItem: (product: WalmartProduct, quantity?: number) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  isInCart: (productId: string) => boolean;
  getItemQuantity: (productId: string) => number;
  loading: boolean;
  error: string | null;
}

// Optimized tRPC Hook Types
export interface EmailFilters {
  status?: ("red" | "yellow" | "green")[];
  emailAlias?: string[];
  workflowState?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[];
  priority?: ("critical" | "high" | "medium" | "low")[];
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface TableParams {
  page: number;
  pageSize: number;
  sortBy: "received_date" | "subject" | "requested_by" | "status" | "priority";
  sortOrder: "asc" | "desc";
  filters?: EmailFilters;
  search?: string;
  refreshKey?: number;
}

export interface UseOptimizedEmailsReturn {
  data: unknown[];
  isLoading: boolean;
  error: TRPCClientError<AppRouter> | null;
  errorMessage: string;
  isError: boolean;
  refetch: () => Promise<{ data: unknown[] }>;
  updateEmail: (input: unknown) => void;
  updateEmailAsync: (input: unknown) => Promise<unknown>;
  isUpdating: boolean;
  updateError: TRPCClientError<AppRouter> | null;
  updateErrorMessage: string;
  prefetchEmailDetail: (emailId: string) => Promise<void>;
  totalCount: number;
}

export interface DashboardMetrics {
  totalProcessingTime: number;
  averageResponseTime: number;
  efficiency: number;
  totalEmails: number;
  processedEmails: number;
  pendingEmails: number;
  criticalCount?: number;
  inProgressCount?: number;
  completedCount?: number;
}

export interface UseOptimizedDashboardMetricsReturn {
  data: DashboardMetrics;
  isLoading: boolean;
  error: TRPCClientError<AppRouter> | null;
  errorMessage: string;
  isError: boolean;
  refetch: () => Promise<{ data: DashboardMetrics }>;
}

export interface UseOptimizedEmailSearchReturn {
  data: unknown[];
  isLoading: boolean;
  error: TRPCClientError<AppRouter> | null;
  errorMessage: string;
  isError: boolean;
  refetch: () => Promise<{ data: unknown[] }>;
  totalCount: number;
  searchMetadata: unknown;
  isSearchValid: boolean;
}

export interface UseOptimizedEmailBatchReturn {
  batchUpdate: (input: unknown) => void;
  batchDelete: (input: unknown) => void;
  isBatchUpdating: boolean;
  isBatchDeleting: boolean;
  batchUpdateAsync: (input: unknown) => Promise<unknown>;
  batchDeleteAsync: (input: unknown) => Promise<unknown>;
  batchUpdateError: TRPCClientError<AppRouter> | null;
  batchDeleteError: TRPCClientError<AppRouter> | null;
  batchUpdateErrorMessage: string;
  batchDeleteErrorMessage: string;
}

export interface UseOptimizedWalmartProductsReturn {
  data: WalmartProduct[];
  isLoading: boolean;
  error: TRPCClientError<AppRouter> | null;
  errorMessage: string;
  isError: boolean;
  searchProducts: (query: string) => Promise<{
    success: boolean;
    products: WalmartProduct[];
    error?: string;
  }>;
  metadata: unknown;
}

// Performance Monitor Types
export interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  timestamp: number;
  props?: unknown;
}

export interface UsePerformanceMonitorOptions {
  componentName: string;
  enabled?: boolean;
  threshold?: number;
  logToConsole?: boolean;
}

export interface UsePerformanceMonitorReturn {
  logCurrentMetrics: () => void;
  renderCount: number;
  performanceTracker: {
    addMetric: (metric: PerformanceMetrics) => void;
    subscribe: (observer: (metrics: PerformanceMetrics) => void) => () => void;
    getMetrics: () => PerformanceMetrics[];
    getAverageRenderTime: (componentName?: string) => number;
    getSlowComponents: (threshold?: number) => string[];
    reset: () => void;
  };
}

// Report Generation Types
export interface FilterCondition {
  field: string;
  operator: string;
  value: unknown;
}

export interface ReportField {
  id: string;
  name: string;
  type: string;
  source: string;
  format?: (value: unknown) => string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  sections: unknown[];
  layout: string;
  styling: unknown;
  metadata: {
    author: string;
    createdAt: string;
    updatedAt: string;
    version: string;
    tags: string[];
  };
  isPublic: boolean;
  isDefault: boolean;
}

export interface GeneratedReport {
  id: string;
  templateId: string;
  name: string;
  format: "pdf" | "excel" | "csv" | "html";
  generatedAt: string;
  generatedBy: string;
  fileSize: number;
  downloadUrl?: string;
  status: "generating" | "completed" | "failed";
  error?: string;
  metadata: {
    dataSnapshot: string;
    filters: FilterCondition[];
    recordCount: number;
  };
}

// Audit Trail Types
export interface AuditEvent {
  id: string;
  entityType: "email" | "user" | "system" | "workflow";
  entityId: string;
  action: string;
  userId: string;
  userName: string;
  userRole: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  details: {
    before?: unknown;
    after?: unknown;
    changes?: Array<{
      field: string;
      oldValue: unknown;
      newValue: unknown;
    }>;
    metadata?: Record<string, unknown>;
  };
  severity: "low" | "medium" | "high" | "critical";
  category: "authentication" | "authorization" | "data_change" | "system" | "workflow" | "security";
  source: "web" | "api" | "system" | "automation";
  tags?: string[];
}

export interface AuditFilter {
  entityType?: string[];
  action?: string[];
  userId?: string[];
  severity?: string[];
  category?: string[];
  source?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  searchQuery?: string;
  tags?: string[];
}

export interface AuditMetrics {
  totalEvents: number;
  eventsByCategory: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  eventsByUser: Record<string, number>;
  recentActivity: number;
  securityEvents: number;
  failedActions: number;
}

// Common error handling
export interface ErrorHandlerOptions {
  showToast?: boolean;
  logToConsole?: boolean;
  retryable?: boolean;
}

export type ErrorHandler = (error: TRPCClientError<AppRouter> | Error, options?: ErrorHandlerOptions) => void;

// Hook configuration options
export interface HookOptions {
  enabled?: boolean;
  onSuccess?: (data: unknown) => void;
  onError?: ErrorHandler;
  retry?: boolean | number;
  retryDelay?: number;
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
}

// Re-export commonly used types
export type { TRPCClientError, AppRouter, WalmartProduct, GroceryList, CartItem, TeamMember };