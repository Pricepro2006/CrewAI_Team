/**
 * Email Dashboard API Contract
 * Defines the API interface between frontend and backend
 * for the new table-based email dashboard
 */

import { z } from 'zod';

// =====================================================
// Enums and Constants
// =====================================================

export const EmailStatusEnum = z.enum(['red', 'yellow', 'green']);
export type EmailStatus = z.infer<typeof EmailStatusEnum>;

export const WorkflowStateEnum = z.enum(['START_POINT', 'IN_PROGRESS', 'COMPLETION']);
export type WorkflowState = z.infer<typeof WorkflowStateEnum>;

export const PriorityEnum = z.enum(['Critical', 'High', 'Medium', 'Low']);
export type Priority = z.infer<typeof PriorityEnum>;

export const SortDirectionEnum = z.enum(['asc', 'desc']);
export type SortDirection = z.infer<typeof SortDirectionEnum>;

export const ExportFormatEnum = z.enum(['csv', 'excel', 'pdf']);
export type ExportFormat = z.infer<typeof ExportFormatEnum>;

// =====================================================
// Core Data Models
// =====================================================

// Email entity schema
export const EmailEntitySchema = z.object({
  po_numbers: z.array(z.string()).optional(),
  quote_numbers: z.array(z.string()).optional(),
  case_numbers: z.array(z.string()).optional(),
  part_numbers: z.array(z.string()).optional(),
  customers: z.array(z.string()).optional(),
  order_references: z.array(z.string()).optional(),
});

// Email record schema
export const EmailRecordSchema = z.object({
  id: z.string(),
  email_alias: z.string(),
  requested_by: z.string(),
  subject: z.string(),
  summary: z.string(),
  status: EmailStatusEnum,
  status_text: z.string(),
  workflow_state: WorkflowStateEnum,
  timestamp: z.string().datetime(),
  priority: PriorityEnum.optional(),
  workflow_type: z.string().optional(),
  entities: EmailEntitySchema.optional(),
  // Extended fields
  isRead: z.boolean().optional(),
  hasAttachments: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  lastUpdated: z.string().datetime().optional(),
});

export type EmailRecord = z.infer<typeof EmailRecordSchema>;

// Dashboard statistics schema
export const DashboardStatsSchema = z.object({
  total: z.number(),
  byStatus: z.object({
    red: z.number(),
    yellow: z.number(),
    green: z.number(),
  }),
  byWorkflowState: z.object({
    START_POINT: z.number(),
    IN_PROGRESS: z.number(),
    COMPLETION: z.number(),
  }),
  byPriority: z.object({
    Critical: z.number(),
    High: z.number(),
    Medium: z.number(),
    Low: z.number(),
  }),
  todayCount: z.number(),
  weekCount: z.number(),
  averageResponseTime: z.number().optional(),
});

export type DashboardStats = z.infer<typeof DashboardStatsSchema>;

// =====================================================
// Request/Response Schemas
// =====================================================

// List emails request
export const ListEmailsRequestSchema = z.object({
  // Pagination
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
  
  // Filtering
  search: z.string().optional(),
  emailAliases: z.array(z.string()).optional(),
  requesters: z.array(z.string()).optional(),
  statuses: z.array(EmailStatusEnum).optional(),
  workflowStates: z.array(WorkflowStateEnum).optional(),
  workflowTypes: z.array(z.string()).optional(),
  priorities: z.array(PriorityEnum).optional(),
  dateRange: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
  }).optional(),
  hasAttachments: z.boolean().optional(),
  isRead: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  
  // Sorting
  sortBy: z.string().optional(),
  sortDirection: SortDirectionEnum.optional(),
});

export type ListEmailsRequest = z.infer<typeof ListEmailsRequestSchema>;

// List emails response
export const ListEmailsResponseSchema = z.object({
  emails: z.array(EmailRecordSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
  stats: DashboardStatsSchema,
});

export type ListEmailsResponse = z.infer<typeof ListEmailsResponseSchema>;

// Get email by ID response
export const GetEmailResponseSchema = EmailRecordSchema.extend({
  bodyText: z.string().optional(),
  bodyHtml: z.string().optional(),
  recipients: z.array(z.object({
    type: z.enum(['to', 'cc', 'bcc']),
    name: z.string().optional(),
    email: z.string(),
  })).optional(),
  attachments: z.array(z.object({
    id: z.string(),
    filename: z.string(),
    contentType: z.string().optional(),
    size: z.number(),
  })).optional(),
  analysis: z.object({
    quickAnalysis: z.any().optional(),
    deepAnalysis: z.any().optional(),
    actionItems: z.array(z.any()).optional(),
  }).optional(),
  relatedEmails: z.array(z.string()).optional(),
});

export type GetEmailResponse = z.infer<typeof GetEmailResponseSchema>;

// Update email request
export const UpdateEmailRequestSchema = z.object({
  status: EmailStatusEnum.optional(),
  statusText: z.string().optional(),
  workflowState: WorkflowStateEnum.optional(),
  priority: PriorityEnum.optional(),
  isRead: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  summary: z.string().optional(),
});

export type UpdateEmailRequest = z.infer<typeof UpdateEmailRequestSchema>;

// Bulk update request
export const BulkUpdateEmailsRequestSchema = z.object({
  emailIds: z.array(z.string()),
  updates: UpdateEmailRequestSchema,
});

export type BulkUpdateEmailsRequest = z.infer<typeof BulkUpdateEmailsRequestSchema>;

// Export emails request
export const ExportEmailsRequestSchema = z.object({
  format: ExportFormatEnum,
  filters: ListEmailsRequestSchema.omit({ page: true, pageSize: true }).optional(),
  columns: z.array(z.string()).optional(),
});

export type ExportEmailsRequest = z.infer<typeof ExportEmailsRequestSchema>;

// Get filter options response
export const GetFilterOptionsResponseSchema = z.object({
  emailAliases: z.array(z.string()),
  requesters: z.array(z.string()),
  statuses: z.array(z.object({
    value: EmailStatusEnum,
    label: z.string(),
    color: z.string(),
    count: z.number(),
  })),
  workflowStates: z.array(z.object({
    value: WorkflowStateEnum,
    label: z.string(),
    count: z.number(),
  })),
  workflowTypes: z.array(z.object({
    value: z.string(),
    label: z.string(),
    count: z.number(),
  })),
  priorities: z.array(z.object({
    value: PriorityEnum,
    label: z.string(),
    count: z.number(),
  })),
  tags: z.array(z.string()),
});

export type GetFilterOptionsResponse = z.infer<typeof GetFilterOptionsResponseSchema>;

// Filter preset schemas
export const FilterPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  filters: ListEmailsRequestSchema.omit({ page: true, pageSize: true, sortBy: true, sortDirection: true }),
  isDefault: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type FilterPreset = z.infer<typeof FilterPresetSchema>;

export const CreateFilterPresetRequestSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  filters: ListEmailsRequestSchema.omit({ page: true, pageSize: true, sortBy: true, sortDirection: true }),
  isDefault: z.boolean().optional(),
});

export type CreateFilterPresetRequest = z.infer<typeof CreateFilterPresetRequestSchema>;

// =====================================================
// WebSocket Event Schemas
// =====================================================

export const EmailUpdateEventSchema = z.object({
  type: z.literal('email.update'),
  data: EmailRecordSchema,
});

export const EmailCreateEventSchema = z.object({
  type: z.literal('email.create'),
  data: EmailRecordSchema,
});

export const EmailDeleteEventSchema = z.object({
  type: z.literal('email.delete'),
  data: z.object({
    id: z.string(),
  }),
});

export const StatsUpdateEventSchema = z.object({
  type: z.literal('stats.update'),
  data: DashboardStatsSchema.partial(),
});

export const WebSocketEventSchema = z.discriminatedUnion('type', [
  EmailUpdateEventSchema,
  EmailCreateEventSchema,
  EmailDeleteEventSchema,
  StatsUpdateEventSchema,
]);

export type WebSocketEvent = z.infer<typeof WebSocketEventSchema>;

// =====================================================
// Error Response Schema
// =====================================================

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// =====================================================
// API Endpoints Definition
// =====================================================

export const API_ENDPOINTS = {
  // Email endpoints
  listEmails: {
    method: 'GET' as const,
    path: '/api/emails',
    request: ListEmailsRequestSchema,
    response: ListEmailsResponseSchema,
  },
  getEmail: {
    method: 'GET' as const,
    path: '/api/emails/:id',
    response: GetEmailResponseSchema,
  },
  updateEmail: {
    method: 'PATCH' as const,
    path: '/api/emails/:id',
    request: UpdateEmailRequestSchema,
    response: EmailRecordSchema,
  },
  bulkUpdateEmails: {
    method: 'PATCH' as const,
    path: '/api/emails/bulk',
    request: BulkUpdateEmailsRequestSchema,
    response: z.object({ updated: z.number() }),
  },
  deleteEmail: {
    method: 'DELETE' as const,
    path: '/api/emails/:id',
    response: z.object({ success: z.boolean() }),
  },
  
  // Export endpoints
  exportEmails: {
    method: 'POST' as const,
    path: '/api/emails/export',
    request: ExportEmailsRequestSchema,
    response: z.object({ url: z.string() }),
  },
  
  // Filter endpoints
  getFilterOptions: {
    method: 'GET' as const,
    path: '/api/emails/filter-options',
    response: GetFilterOptionsResponseSchema,
  },
  listFilterPresets: {
    method: 'GET' as const,
    path: '/api/filter-presets',
    response: z.array(FilterPresetSchema),
  },
  createFilterPreset: {
    method: 'POST' as const,
    path: '/api/filter-presets',
    request: CreateFilterPresetRequestSchema,
    response: FilterPresetSchema,
  },
  updateFilterPreset: {
    method: 'PATCH' as const,
    path: '/api/filter-presets/:id',
    request: CreateFilterPresetRequestSchema.partial(),
    response: FilterPresetSchema,
  },
  deleteFilterPreset: {
    method: 'DELETE' as const,
    path: '/api/filter-presets/:id',
    response: z.object({ success: z.boolean() }),
  },
  
  // Statistics endpoints
  getDashboardStats: {
    method: 'GET' as const,
    path: '/api/emails/stats',
    response: DashboardStatsSchema,
  },
  
  // WebSocket endpoint
  websocket: {
    path: '/ws/emails',
    events: WebSocketEventSchema,
  },
} as const;

// =====================================================
// tRPC Router Type Definition
// =====================================================

export type EmailDashboardRouter = {
  email: {
    list: {
      input: ListEmailsRequest;
      output: ListEmailsResponse;
    };
    getById: {
      input: string;
      output: GetEmailResponse;
    };
    update: {
      input: { id: string; data: UpdateEmailRequest };
      output: EmailRecord;
    };
    bulkUpdate: {
      input: BulkUpdateEmailsRequest;
      output: { updated: number };
    };
    delete: {
      input: string;
      output: { success: boolean };
    };
    export: {
      input: ExportEmailsRequest;
      output: { url: string };
    };
    getFilterOptions: {
      output: GetFilterOptionsResponse;
    };
    getStats: {
      output: DashboardStats;
    };
  };
  filterPreset: {
    list: {
      output: FilterPreset[];
    };
    create: {
      input: CreateFilterPresetRequest;
      output: FilterPreset;
    };
    update: {
      input: { id: string; data: Partial<CreateFilterPresetRequest> };
      output: FilterPreset;
    };
    delete: {
      input: string;
      output: { success: boolean };
    };
  };
};