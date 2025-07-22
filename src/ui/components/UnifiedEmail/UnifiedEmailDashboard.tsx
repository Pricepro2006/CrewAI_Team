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
} from "@heroicons/react/24/outline";
import { api } from "@/lib/trpc";
import { useWebSocket } from "@/ui/hooks/useWebSocket";
import { MetricsBar } from "./MetricsBar";
import { EmailListView } from "./EmailListView";
import { AnalyticsView } from "./AnalyticsView";
import { AgentView } from "./AgentView";
import { StatusLegend } from "./StatusLegend";
import type {
  UnifiedEmailData,
  ViewMode,
  FilterConfig,
} from "@/types/unified-email.types";
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

export const UnifiedEmailDashboard: React.FC<UnifiedEmailDashboardProps> = ({
  className,
  initialView = "list",
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterConfig>(defaultFilters);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Fetch unified email data with all enrichments
  const { data: emailData, refetch: refetchEmails } = (
    api.emails as any
  ).getTableData.useQuery({
    ...filters,
    includeAnalysis: true,
    includeWorkflowState: true,
    includeAgentInfo: true,
  });

  // Analytics data with workflow metrics
  const { data: analytics, refetch: refetchAnalytics } = (
    api.emails as any
  ).getAnalytics.useQuery({
    includeWorkflowMetrics: true,
    includeAgentMetrics: true,
    includeTrends: true,
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

  // Calculate critical metrics
  const metrics = useMemo(
    () => ({
      totalEmails: emailData?.total || 0,
      todaysEmails: emailData?.todaysCount || 0,
      workflowCompletion: analytics?.workflowCompletion || 3.5,
      avgResponseTime: analytics?.avgResponseTime || 4.3,
      criticalAlerts: analytics?.criticalAlerts || [],
      agentUtilization: analytics?.agentUtilization || 0,
      pendingAssignment: emailData?.pendingAssignmentCount || 0,
      urgentCount: emailData?.urgentCount || 0,
    }),
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
            <ChartBarIcon className="unified-dashboard__nav-icon" />
            Analytics
          </button>
          <button
            className={`unified-dashboard__nav-btn ${viewMode === "agents" ? "active" : ""}`}
            onClick={() => setViewMode("agents")}
            title="Agent Management"
          >
            <UserGroupIcon className="unified-dashboard__nav-icon" />
            Agents
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
        {viewMode === "list" && (
          <EmailListView
            emails={emailData?.emails || []}
            onEmailSelect={(email) => setSelectedEmails([email.id])}
            selectedEmailId={selectedEmails[0]}
          />
        )}

        {viewMode === "analytics" && (
          <AnalyticsView analytics={analytics || null} />
        )}

        {viewMode === "agents" && (
          <AgentView
            agents={analytics?.agents || []}
            agentPerformance={analytics?.agentPerformance}
          />
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
