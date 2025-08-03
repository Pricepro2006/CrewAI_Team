/**
 * Email Dashboard TypeScript Interfaces
 * Defines all types and interfaces for the new table-based email dashboard
 */

// Core email record interface matching IEMS data structure
export interface EmailRecord {
  id: string;
  email_alias: string;
  requested_by: string;
  subject: string;
  summary: string;
  status: EmailStatus;
  status_text: string;
  workflow_state: WorkflowState;
  timestamp: string;
  priority?: Priority;
  workflow_type?: string;
  entities?: EmailEntities;
  // Extended fields for dashboard functionality
  isRead?: boolean;
  hasAttachments?: boolean;
  tags?: string[];
  assignedTo?: string;
  dueDate?: string;
  lastUpdated?: string;
}

// Status types
export type EmailStatus = "red" | "yellow" | "green";

export interface StatusOption {
  value: EmailStatus;
  label: string;
  color: string;
  description: string;
}

// Workflow states
export type WorkflowState = "START_POINT" | "IN_PROGRESS" | "COMPLETION";

// Priority levels
export type Priority = "critical" | "high" | "medium" | "low";

// Email entities
export interface EmailEntities {
  po_numbers?: string[];
  quote_numbers?: string[];
  case_numbers?: string[];
  part_numbers?: string[];
  customers?: string[];
  order_references?: string[];
}

// Filter configuration
export interface FilterConfig {
  search: string;
  emailAliases: string[];
  requesters: string[];
  statuses: EmailStatus[];
  workflowStates: WorkflowState[];
  workflowTypes: string[];
  priorities: Priority[];
  dateRange: DateRange;
  hasAttachments?: boolean;
  isRead?: boolean;
  tags?: string[];
}

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

// Sorting configuration
export interface SortConfig {
  column: SortableColumn;
  direction: SortDirection;
}

export type SortableColumn =
  | "timestamp"
  | "email_alias"
  | "requested_by"
  | "subject"
  | "status"
  | "priority"
  | "workflow_type";

export type SortDirection = "asc" | "desc";

// Pagination configuration
export interface PaginationConfig {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// Component Props Interfaces

export interface EmailTableProps {
  emails: EmailRecord[];
  loading?: boolean;
  error?: string | null;
  selectedEmails?: string[];
  sortConfig?: SortConfig;
  onEmailSelect?: (emailId: string) => void;
  onEmailsSelect?: (emailIds: string[]) => void;
  onSort?: (column: SortableColumn, direction: SortDirection) => void;
  onRowClick?: (email: EmailRecord) => void;
  className?: string;
}

export interface StatusIndicatorProps {
  status: EmailStatus;
  statusText: string;
  size?: "sm" | "md" | "lg";
  showPulse?: boolean;
  showTooltip?: boolean;
  className?: string;
}

export interface TableToolbarProps {
  onSearch: (query: string) => void;
  onFilter: (filters: FilterConfig) => void;
  onExport: (format: ExportFormat) => void;
  onRefresh?: () => void;
  filters: FilterConfig;
  totalResults: number;
  loading?: boolean;
  className?: string;
}

export type ExportFormat = "csv" | "excel" | "pdf";

export interface FilterPanelProps {
  filters: FilterConfig;
  onFilterChange: (filters: FilterConfig) => void;
  onReset?: () => void;
  availableOptions: FilterOptions;
  className?: string;
}

export interface FilterOptions {
  emailAliases: string[];
  requesters: string[];
  statuses: StatusOption[];
  workflowStates: WorkflowState[];
  workflowTypes: string[];
  priorities: Priority[];
  tags: string[];
}

export interface DashboardStatsProps {
  totalEmails: number;
  criticalCount: number;
  inProgressCount: number;
  completedCount: number;
  todayCount?: number;
  weekCount?: number;
  onStatClick?: (statType: StatType) => void;
  loading?: boolean;
  className?: string;
}

export type StatType =
  | "total"
  | "critical"
  | "inProgress"
  | "completed"
  | "today"
  | "week";

export interface EmailDetailsProps {
  email: EmailRecord;
  onClose: () => void;
  onStatusChange?: (newStatus: EmailStatus) => void;
  onAssign?: (userId: string) => void;
  onAddTag?: (tag: string) => void;
  onRemoveTag?: (tag: string) => void;
  loading?: boolean;
  className?: string;
}

// State Management Interfaces

export interface EmailDashboardState {
  emails: EmailRecord[];
  loading: boolean;
  error: string | null;
  filters: FilterConfig;
  sorting: SortConfig;
  pagination: PaginationConfig;
  selectedEmails: string[];
  activeEmail: EmailRecord | null;
  stats: DashboardStats;
  lastRefresh: Date | null;
}

export interface DashboardStats {
  total: number;
  byStatus: {
    red: number;
    yellow: number;
    green: number;
  };
  byWorkflowState: {
    START_POINT: number;
    IN_PROGRESS: number;
    COMPLETION: number;
  };
  byPriority: {
    Critical: number;
    High: number;
    Medium: number;
    Low: number;
  };
  todayCount: number;
  weekCount: number;
  averageResponseTime?: number;
}

// API Response Interfaces

export interface EmailsApiResponse {
  emails: EmailRecord[];
  total: number;
  page: number;
  pageSize: number;
  stats: DashboardStats;
}

export interface EmailApiError {
  code: string;
  message: string;
  details?: unknown;
}

// Action Interfaces

export interface EmailAction {
  id: string;
  type: EmailActionType;
  label: string;
  icon?: string;
  handler: (email: EmailRecord) => void | Promise<void>;
  condition?: (email: EmailRecord) => boolean;
}

export type EmailActionType =
  | "reply"
  | "forward"
  | "assign"
  | "changeStatus"
  | "addTag"
  | "archive"
  | "delete"
  | "markAsRead"
  | "markAsUnread"
  | "print"
  | "export";

// Table Column Configuration

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string | number;
  minWidth?: string | number;
  maxWidth?: string | number;
  align?: "left" | "center" | "right";
  render?: (value: any, record: EmailRecord) => React.ReactNode;
  className?: string;
}

// Filter Preset Interface

export interface FilterPreset {
  id: string;
  name: string;
  description?: string;
  filters: Partial<FilterConfig>;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

// WebSocket Event Interfaces

export interface EmailUpdateEvent {
  type: "update";
  email: EmailRecord;
}

export interface EmailDeleteEvent {
  type: "delete";
  emailId: string;
}

export interface EmailCreateEvent {
  type: "create";
  email: EmailRecord;
}

export interface StatsUpdateEvent {
  type: "stats";
  stats: Partial<DashboardStats>;
}

export type EmailWebSocketEvent =
  | EmailUpdateEvent
  | EmailDeleteEvent
  | EmailCreateEvent
  | StatsUpdateEvent;

// Utility Types

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type ValueOf<T> = T[keyof T];

// Constants

export const EMAIL_STATUS_CONFIG: Record<EmailStatus, StatusOption> = {
  red: {
    value: "red",
    label: "Critical",
    color: "#DC2626",
    description: "Requires immediate attention",
  },
  yellow: {
    value: "yellow",
    label: "In Progress",
    color: "#F59E0B",
    description: "Currently being processed",
  },
  green: {
    value: "green",
    label: "Completed",
    color: "#10B981",
    description: "Successfully completed",
  },
};

export const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; color: string; order: number }
> = {
  critical: { label: "Critical", color: "#DC2626", order: 1 },
  high: { label: "High", color: "#F59E0B", order: 2 },
  medium: { label: "Medium", color: "#3B82F6", order: 3 },
  low: { label: "Low", color: "#6B7280", order: 4 },
};

export const DEFAULT_PAGINATION: PaginationConfig = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0,
};

export const DEFAULT_SORT: SortConfig = {
  column: "timestamp",
  direction: "desc",
};

export const DEFAULT_FILTERS: FilterConfig = {
  search: "",
  emailAliases: [],
  requesters: [],
  statuses: [],
  workflowStates: [],
  workflowTypes: [],
  priorities: [],
  dateRange: {
    start: null,
    end: null,
  },
  hasAttachments: undefined,
  isRead: undefined,
  tags: [],
};
