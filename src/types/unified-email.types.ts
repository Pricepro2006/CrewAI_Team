// Unified Email Dashboard Types

export type ViewMode = 'list' | 'analytics' | 'agents';

export type WorkflowState = 'START_POINT' | 'IN_PROGRESS' | 'COMPLETION';

export type EmailPriority = 'low' | 'medium' | 'high' | 'critical';

export type EmailStatus = 'unread' | 'read' | 'processing' | 'resolved' | 'escalated';

export interface UnifiedEmailData {
  id: string;
  messageId: string;
  graphResourceId?: string;
  
  // Basic email fields
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  from: string;
  to: string[];
  cc?: string[];
  receivedAt: string;
  
  // Analysis results
  analysis?: {
    summary: string;
    sentiment: string;
    intent: string;
    topics: string[];
  };
  
  // Workflow information
  workflowState: WorkflowState;
  workflowType?: string;
  workflowChainId?: string;
  isWorkflowComplete: boolean;
  workflowConfidence?: number;
  
  // Entity extraction
  entities?: {
    people: string[];
    organizations: string[];
    products: string[];
    orderNumbers: string[];
    trackingNumbers: string[];
    dates: string[];
    amounts: string[];
  };
  
  // Categorization
  priority: EmailPriority;
  status: EmailStatus;
  category?: string;
  tags?: string[];
  
  // Agent assignment
  agentAssignment?: {
    agentId: string;
    agentName: string;
    assignedAt: string;
    status: 'assigned' | 'processing' | 'completed';
    progress?: number;
    actions?: AgentAction[];
  };
  
  // Metadata
  hasAttachments: boolean;
  isRead: boolean;
  conversationId?: string;
  processingDuration?: number;
  responseTime?: number;
}

export interface AgentAction {
  type: string;
  description: string;
  timestamp: string;
  result?: any;
}

export interface FilterConfig {
  search: string;
  emailAliases: string[];
  requesters: string[];
  statuses: EmailStatus[];
  workflowStates: WorkflowState[];
  workflowTypes: string[];
  priorities: EmailPriority[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  hasAttachments?: boolean;
  isRead?: boolean;
  tags: string[];
  assignedAgents: string[];
}

export interface DashboardMetrics {
  totalEmails: number;
  todaysEmails: number;
  workflowCompletion: number; // Percentage
  avgResponseTime: number; // Hours
  criticalAlerts: Alert[];
  agentUtilization: number; // Percentage
  pendingAssignment: number;
  urgentCount: number;
  processedToday?: number;
}

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
}

export interface WorkflowAnalytics {
  completeChains: number;
  partialChains: number;
  brokenChains: number;
  totalChains: number;
  workflowTypes: WorkflowTypeStats[];
  bottlenecks: BottleneckInfo[];
  recommendations: Recommendation[];
}

export interface WorkflowTypeStats {
  type: string;
  count: number;
  completePercentage: number;
  avgCompletionTime?: number; // Hours
}

export interface BottleneckInfo {
  stage: string;
  count: number;
  avgDelayHours: number;
  impactedWorkflows: string[];
}

export interface Recommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  effort?: string;
  timeline?: string;
}

export interface AgentInfo {
  id: string;
  name: string;
  type: 'sales' | 'support' | 'order' | 'general';
  status: 'available' | 'busy' | 'offline';
  currentLoad: number;
  maxCapacity: number;
  specialties: string[];
  performance?: AgentPerformance;
}

export interface AgentPerformance {
  totalAssigned: number;
  totalCompleted: number;
  avgResponseTime: number; // Minutes
  satisfactionScore?: number; // 0-5
  accuracyRate?: number; // Percentage
}

export interface EmailUpdate {
  type: 'email.processed' | 'email.updated' | 'email.assigned' | 'workflow.completed';
  emailId: string;
  data: any;
  timestamp: string;
}

// API Response types
export interface GetEmailsResponse {
  emails: UnifiedEmailData[];
  total: number;
  page: number;
  pageSize: number;
  todaysCount: number;
  urgentCount: number;
  pendingAssignmentCount: number;
}

export interface GetAnalyticsResponse {
  workflowCompletion: number;
  avgResponseTime: number;
  criticalAlerts: Alert[];
  agentUtilization: number;
  workflowData?: WorkflowAnalytics;
  agents?: AgentInfo[];
  agentPerformance?: Record<string, AgentPerformance>;
  trends?: TrendData;
}

export interface TrendData {
  emailVolume: TimeSeriesData[];
  responseTime: TimeSeriesData[];
  workflowCompletion: TimeSeriesData[];
  agentUtilization: TimeSeriesData[];
}

export interface TimeSeriesData {
  timestamp: string;
  value: number;
}