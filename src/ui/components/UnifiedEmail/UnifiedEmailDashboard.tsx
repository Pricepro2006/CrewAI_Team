import React, { useState, useEffect, useMemo } from "react";
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
import { api } from "../../../lib/trpc.js";
import { useWebSocket } from "../../hooks/useWebSocket.js";
import { MetricsBar } from "./MetricsBar.js";
import { EmailListView } from "./EmailListView.js";
import { EmailDashboardView } from "./EmailDashboardView.js";
import { AnalyticsView } from "./AnalyticsView.js";
import { AgentView } from "./AgentView.js";
import { StatusLegend } from "./StatusLegend.js";
import { BusinessIntelligenceDashboard } from "./BusinessIntelligenceDashboard.js";
import type {
  UnifiedEmailData,
  ViewMode,
  FilterConfig,
  DashboardMetrics,
  WorkflowState,
  EmailPriority,
  EmailStatus,
} from "../../../types/unified-email.types.js";
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
const convertToUnifiedEmailData = (apiEmail: any): UnifiedEmailData => ({
  id: apiEmail.id,
  messageId: apiEmail.id,
  subject: apiEmail.subject,
  bodyText: apiEmail.summary || '',
  from: apiEmail.requested_by,
  to: [apiEmail.email_alias],
  receivedAt: apiEmail.received_date,
  workflowState: apiEmail.workflow_state as WorkflowState,
  isWorkflowComplete: apiEmail.workflow_state === 'COMPLETED',
  priority: apiEmail.priority as EmailPriority,
  status: apiEmail.status as EmailStatus,
  tags: [],
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

  // Fetch unified email data with all enrichments
  const { data: emailData, refetch: refetchEmails } = api.emails.getTableData.useQuery({
    page: 1,
    pageSize: 50,
    sortBy: "received_date",
    sortOrder: "desc",
    filters: {
      status: filters.statuses as any[],
      emailAlias: filters.emailAliases,
      workflowState: filters.workflowStates as any[],
      priority: filters.priorities as any[],
      dateRange: filters.dateRange?.start && filters.dateRange?.end ? {
        start: filters.dateRange.start.toISOString(),
        end: filters.dateRange.end.toISOString(),
      } : undefined,
    },
    search: filters.search,
  });

  // Analytics data with workflow metrics
  const { data: analytics, refetch: refetchAnalytics } = api.emails.getAnalytics.useQuery({
    refreshKey: Date.now(),
  });

  // Real-time updates via WebSocket
  useWebSocket({
    onConnect: () => {
      console.log("WebSocket connected");
    },
    onDisconnect: () => {
      console.log("WebSocket disconnected");
    },
    onError: (error) => {
      console.error("WebSocket error:", error);
    },
  });

  // Manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchEmails(), refetchAnalytics()]);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

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
    [emailData, analytics],
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
            Critical: Only {metrics.workflowCompletion.toFixed(1)}% of workflows
            have complete chains. This impacts visibility and tracking across{" "}
            {metrics.totalEmails.toLocaleString()} emails.
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
            emails={Array.isArray(emailData?.data?.emails) 
              ? emailData.data.emails.map(convertToUnifiedEmailData) 
              : []
            }
            onEmailSelect={(email) => setSelectedEmails([email.id])}
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
              emails={(Array.isArray(emailData?.data?.emails) ? emailData.data.emails : [])
                .filter((e: any) => e.workflow_state === "IN_PROGRESS")
                .map(convertToUnifiedEmailData)
              }
              onEmailSelect={(email: UnifiedEmailData) =>
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
