import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  EnvelopeIcon,
  ChartBarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  ArrowPathIcon,
  Cog6ToothIcon,
  FunnelIcon,
  ArrowTrendingUpIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";
import { api } from "../../../client/lib/api";
import { useWebSocketSingleton } from "../../hooks/useWebSocketSingleton";
import { MetricsBar } from "./MetricsBar";
import { EmailListView } from "./EmailListView";
import { EmailDashboardView } from "./EmailDashboardView";
import { AnalyticsView } from "./AnalyticsView";
import { AgentView } from "./AgentView";
import { StatusLegend } from "./StatusLegend";
import { BusinessIntelligenceDashboard } from "./BusinessIntelligenceDashboard";
import type { UnifiedEmailData, ViewMode, WorkflowState, EmailPriority, EmailStatus } from "../../../types/index";

interface FilterConfig {
  search: string;
  emailAliases: string[];
  requesters: string[];
  statuses: string[];
  workflowStates: string[];
  workflowTypes: string[];
  priorities: string[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  hasAttachments: boolean | undefined;
  isRead: boolean | undefined;
  tags: string[];
  assignedAgents: string[];
}

interface DashboardMetrics {
  totalEmails: number;
  todaysEmails: number;
  workflowCompletion: number;
  avgResponseTime: number;
  criticalAlerts: Array<{
    id: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: Date;
  }>;
  agentUtilization: number;
  pendingAssignment: number;
  urgentCount: number;
  processedToday?: number;
}
import "./UnifiedEmailDashboard.css";

interface UnifiedEmailDashboardProps {
  className?: string;
  initialView?: ViewMode;
}

const defaultFilters: FilterConfig = {
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
  assignedAgents: [],
};

// Helper function to convert API email to UnifiedEmailData
interface ApiEmailData {
  id: string;
  subject: string;
  summary?: string;
  requested_by: string;
  email_alias: string;
  received_date: string;
  workflow_state: WorkflowState;
  priority: EmailPriority;
  status: EmailStatus;
  has_attachments?: boolean;
  is_read?: boolean;
}

const convertToUnifiedEmailData = (apiEmail: ApiEmailData): UnifiedEmailData => ({
  id: apiEmail.id,
  messageId: apiEmail.id,
  subject: apiEmail.subject,
  bodyText: apiEmail.summary || '',
  from: apiEmail.requested_by,
  to: [apiEmail.email_alias],
  receivedAt: apiEmail.received_date,
  workflowState: apiEmail.workflow_state,
  isWorkflowComplete: apiEmail.workflow_state === 'COMPLETION',
  priority: apiEmail.priority,
  status: apiEmail.status,
  tags: undefined,
  hasAttachments: apiEmail.has_attachments || false,
  isRead: apiEmail.is_read || false,
});

export const UnifiedEmailDashboard: React.FC<UnifiedEmailDashboardProps> = ({
  className,
  initialView = "dashboard",
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterConfig>(defaultFilters);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Fetch unified email data with all enrichments and proper error handling
  const { data: emailData, refetch: refetchEmails } = api?.emails?.getTableData?.useQuery?.({
    page: 1,
    pageSize: 50,
    sortBy: "received_date",
    sortOrder: "desc",
    filters: {
      status: filters.statuses as EmailStatus[],
      emailAlias: filters.emailAliases,
      workflowState: filters.workflowStates as WorkflowState[],
      priority: filters.priorities as EmailPriority[],
      dateRange: filters.dateRange?.start && filters.dateRange?.end ? {
        start: filters?.dateRange?.start.toISOString(),
        end: filters?.dateRange?.end.toISOString(),
      } : undefined,
    },
    search: filters.search,
  }) || { data: null, refetch: async () => {} };

  // Analytics data with workflow metrics and proper error handling
  const { data: analytics, refetch: refetchAnalytics } = api?.emails?.getAnalytics?.useQuery?.({
    refreshKey: Date.now(),
  }) || { data: null, refetch: async () => {} };

  // Memoize WebSocket callbacks to prevent unnecessary re-renders
  const onConnect = useCallback(() => {
    console.log("WebSocket connected");
  }, []);

  const onDisconnect = useCallback(() => {
    console.log("WebSocket disconnected");
  }, []);

  const onError = useCallback((error: Error | unknown) => {
    console.error("WebSocket error:", error);
  }, []);

  // Real-time updates via WebSocket with stable singleton connection
  const { isConnected, connect, disconnect } = useWebSocketSingleton({
    autoConnect: true,
    subscriberId: 'unified-email-dashboard',
    onConnect,
    onDisconnect,  
    onError,
  });

  // Manual refresh - memoized to prevent unnecessary re-renders
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchEmails(), refetchAnalytics()]);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [refetchEmails, refetchAnalytics]);

  // Calculate critical metrics with robust null checking
  const metrics = useMemo<DashboardMetrics>(
    () => {
      const emailDataResult = emailData?.data;
      const analyticsResult = analytics?.data;
      
      return {
        totalEmails: emailDataResult?.totalCount ?? 0,
        todaysEmails: emailDataResult?.emails?.filter((e: any) => {
          const today = new Date().toDateString();
          return new Date(e.received_date).toDateString() === today;
        }).length ?? 0,
        workflowCompletion: analyticsResult?.averageProcessingTime ?? 3.5,
        avgResponseTime: analyticsResult?.averageProcessingTime ?? 4.3,
        criticalAlerts: [],
        agentUtilization: 0,
        pendingAssignment: emailDataResult?.emails?.filter((e: any) => e.status === 'pending_assignment').length ?? 0,
        urgentCount: emailDataResult?.emails?.filter((e: any) => e.priority === 'high' || e.priority === 'critical').length ?? 0,
      };
    },
    [emailData?.data, analytics?.data], // More specific dependencies
  );

  return (
    <div className={`unified-dashboard ${className || ""}`}>
      {/* Header */}
      <div className="unified-dashboard__header">
        <div className="unified-dashboard__title">
          <h1>
            <EnvelopeIcon className="unified-dashboard__title-icon" />
            Unified Email Management System
          </h1>
          <p className="unified-dashboard__subtitle">
            Intelligent email processing with comprehensive workflow analysis
          </p>
        </div>

        <div className="unified-dashboard__nav">
          <button
            className={`unified-dashboard__nav-btn ${viewMode === "dashboard" ? "active" : ""}`}
            onClick={() => setViewMode("dashboard")}
            title="Dashboard"
          >
            <ChartBarIcon className="unified-dashboard__nav-icon" />
            Dashboard
          </button>
          <button
            className={`unified-dashboard__nav-btn ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
            title="Email List"
          >
            <EnvelopeIcon className="unified-dashboard__nav-icon" />
            Emails
          </button>
          <button
            className={`unified-dashboard__nav-btn ${viewMode === "analytics" ? "active" : ""}`}
            onClick={() => setViewMode("analytics")}
            title="Analytics"
          >
            <ArrowTrendingUpIcon className="unified-dashboard__nav-icon" />
            Analytics
          </button>
          <button
            className={`unified-dashboard__nav-btn ${viewMode === "business-intelligence" ? "active" : ""}`}
            onClick={() => setViewMode("business-intelligence")}
            title="Business Intelligence"
          >
            <CurrencyDollarIcon className="unified-dashboard__nav-icon" />
            BI Insights
          </button>
          <button
            className={`unified-dashboard__nav-btn ${viewMode === "workflows" ? "active" : ""}`}
            onClick={() => setViewMode("workflows")}
            title="Workflow Tracking"
          >
            <ClockIcon className="unified-dashboard__nav-icon" />
            Workflows
          </button>
          <button
            className={`unified-dashboard__nav-btn ${viewMode === "agents" ? "active" : ""}`}
            onClick={() => setViewMode("agents")}
            title="Agent Management"
          >
            <UserGroupIcon className="unified-dashboard__nav-icon" />
            Agents
          </button>
          <button
            className={`unified-dashboard__nav-btn ${viewMode === "settings" ? "active" : ""}`}
            onClick={() => setViewMode("settings")}
            title="Settings"
          >
            <Cog6ToothIcon className="unified-dashboard__nav-icon" />
            Settings
          </button>
        </div>

        <div className="unified-dashboard__actions">
          <button
            className={`unified-dashboard__action-btn ${isRefreshing ? "animate-spin" : ""}`}
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh"
          >
            <ArrowPathIcon className="unified-dashboard__action-icon" />
          </button>
          <button
            className="unified-dashboard__action-btn"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <Cog6ToothIcon className="unified-dashboard__action-icon" />
          </button>
        </div>
      </div>

      {/* Critical Alert Banner */}
      {metrics.workflowCompletion < 10 && (
        <div className="unified-dashboard__alert unified-dashboard__alert--critical">
          <ExclamationTriangleIcon className="unified-dashboard__alert-icon" />
          <span>
            Critical: Only {metrics?.workflowCompletion?.toFixed(1)}% of workflows
            have complete chains. This impacts visibility and tracking across{" "}
            {metrics?.totalEmails?.toLocaleString()} emails.
          </span>
        </div>
      )}

      {/* Metrics Bar */}
      <MetricsBar metrics={metrics} />

      {/* Main Content Area */}
      <div className="unified-dashboard__content">
        {viewMode === "dashboard" && <EmailDashboardView metrics={metrics} />}

        {viewMode === "list" && (
          <EmailListView
            emails={(Array.isArray(emailData?.data?.emails) 
              ? emailData?.data?.emails?.map(convertToUnifiedEmailData) 
              : []) as any
            }
            onEmailSelect={(email: any) => setSelectedEmails([email.id])}
            selectedEmailId={selectedEmails[0]}
          />
        )}

        {viewMode === "analytics" && (
          <AnalyticsView analytics={analytics?.data as any || analytics || null} />
        )}

        {viewMode === "business-intelligence" && (
          <BusinessIntelligenceDashboard />
        )}

        {viewMode === "workflows" && (
          <div className="workflow-view">
            <h2>Workflow Tracking</h2>
            <EmailListView
              emails={(Array.isArray(emailData?.data?.emails) ? emailData?.data?.emails : [])
                .filter((e: any) => e.workflow_state === "IN_PROGRESS")
                .map(convertToUnifiedEmailData) as any
              }
              onEmailSelect={(email: any) =>
                setSelectedEmails([email.id])
              }
              selectedEmailId={selectedEmails[0]}
            />
          </div>
        )}

        {viewMode === "agents" && (
          <AgentView
            agents={[]}
            agentPerformance={{}}
          />
        )}

        {viewMode === "settings" && (
          <div className="settings-view">
            <h2>Email Management Settings</h2>
            <div className="settings-content">
              <div className="settings-section">
                <h3>Email Aliases</h3>
                <p>Configure email aliases and routing rules</p>
              </div>
              <div className="settings-section">
                <h3>Workflow Configuration</h3>
                <p>Set up workflow automation and triggers</p>
              </div>
              <div className="settings-section">
                <h3>Agent Assignment</h3>
                <p>Manage agent assignments and workload distribution</p>
              </div>
              <div className="settings-section">
                <h3>Notifications</h3>
                <p>Configure email alerts and notifications</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status Legend */}
      <StatusLegend />

      {/* Settings Panel (if shown) */}
      {showSettings && (
        <div className="unified-dashboard__settings">
          {/* Settings content */}
        </div>
      )}
    </div>
  );
};
