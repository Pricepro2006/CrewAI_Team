import React, { useState, useCallback, useMemo } from "react";
import {
  Filter,
  Download,
  BarChart3,
  Settings,
  Users,
  Zap,
} from "lucide-react";

// Import our advanced components
import { AdvancedFilterPanel } from "../table/AdvancedFilterPanel";
import {
  StatusUpdateManager,
  type EmailStatus,
  type EmailWorkflowData,
} from "../status/StatusUpdateManager";
import {
  DataExportManager,
  type ExportColumn,
} from "../export/DataExportManager";
import { StatusDistributionChart } from "../charts/StatusDistributionChart";
import { WorkflowTimelineChart } from "../charts/WorkflowTimelineChart";
import { SLATrackingDashboard } from "../charts/SLATrackingDashboard";

// Import hooks
import {
  useAdvancedFiltering,
  type FilterRule,
} from "../../hooks/useAdvancedFiltering";
import { useAuditTrail } from "../../hooks/useAuditTrail";
import { useReportGeneration } from "../../hooks/useReportGeneration";

/**
 * Advanced Email Dashboard
 * Integrates all GROUP 4 features: Advanced Filtering, Status Management, and Export/Reporting
 * Implements 2025 best practices for enterprise dashboards
 */

interface EmailRecord {
  id: string;
  emailAlias: string;
  requestedBy: string;
  subject: string;
  summary: string;
  status: EmailStatus;
  priority: "low" | "medium" | "high" | "critical";
  assignedTo?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  metadata: Record<string, any>;
}

interface AdvancedEmailDashboardProps {
  emails: EmailRecord[];
  currentUser: {
    id: string;
    name: string;
    role: string;
    permissions: string[];
  };
  onEmailStatusUpdate: (
    emailId: string,
    fromStatus: EmailStatus,
    toStatus: EmailStatus,
    comment?: string,
  ) => Promise<void>;
  onRefresh: () => Promise<void>;
  className?: string;
}

export const AdvancedEmailDashboard: React.FC<AdvancedEmailDashboardProps> = ({
  emails,
  currentUser,
  onEmailStatusUpdate,
  onRefresh,
  className = "",
}) => {
  // State management
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null);
  const [activeView, setActiveView] = useState<
    "table" | "analytics" | "workflow"
  >("table");
  const [showFilters, setShowFilters] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Advanced filtering
  const {
    filterRules,
    globalFilter,
    columnFilters,
    filterStats,
    addFilterRule,
    updateFilterRule,
    removeFilterRule,
    setGlobalFilter,
    clearAllFilters,
  } = useAdvancedFiltering({
    storageKey: "emailDashboard_advancedFilters",
    debounceMs: 300,
  });

  // Audit trail
  const {
    logStatusChange,
    logUserAction,
    metrics: auditMetrics,
  } = useAuditTrail({
    autoRefresh: true,
    refreshInterval: 30000,
    enableRealTime: true,
  });

  // Report generation
  const {
    generateReport,
    templates,
    statistics: reportStats,
  } = useReportGeneration({
    autoSave: true,
    enableScheduling: true,
  });

  // Define columns for filtering and export
  const columns = useMemo(
    () => [
      {
        id: "emailAlias",
        label: "Email Alias",
        field: "emailAlias",
        type: "text" as const,
        included: true,
      },
      {
        id: "requestedBy",
        label: "Requested By",
        field: "requestedBy",
        type: "text" as const,
        included: true,
      },
      {
        id: "subject",
        label: "Subject",
        field: "subject",
        type: "text" as const,
        included: true,
      },
      {
        id: "summary",
        label: "Summary",
        field: "summary",
        type: "text" as const,
        included: true,
      },
      {
        id: "status",
        label: "Status",
        field: "status",
        type: "status" as const,
        options: [
          "pending",
          "in_progress",
          "under_review",
          "approved",
          "rejected",
          "completed",
          "archived",
        ],
        included: true,
      },
      {
        id: "priority",
        label: "Priority",
        field: "priority",
        type: "text" as const,
        options: ["low", "medium", "high", "critical"],
        included: true,
      },
      {
        id: "assignedTo",
        label: "Assigned To",
        field: "assignedTo",
        type: "text" as const,
        included: true,
      },
      {
        id: "createdAt",
        label: "Created",
        field: "createdAt",
        type: "date" as const,
        included: true,
      },
      {
        id: "updatedAt",
        label: "Updated",
        field: "updatedAt",
        type: "date" as const,
        included: true,
      },
    ],
    [],
  );

  // Filter emails based on current filters
  const filteredEmails = useMemo(() => {
    let filtered = [...emails];

    // Apply global search
    if (globalFilter) {
      const searchTerm = globalFilter.toLowerCase();
      filtered = filtered?.filter(
        (email: any) =>
          email?.emailAlias?.toLowerCase().includes(searchTerm) ||
          email?.requestedBy?.toLowerCase().includes(searchTerm) ||
          email?.subject?.toLowerCase().includes(searchTerm) ||
          email?.summary?.toLowerCase().includes(searchTerm) ||
          email?.status?.toLowerCase().includes(searchTerm),
      );
    }

    // Apply advanced filter rules
    filterRules
      .filter((rule: any) => rule.enabled)
      .forEach((rule: any) => {
        filtered = filtered?.filter((email: any) => {
          const value = email[rule.column as keyof EmailRecord];
          const stringValue = String(value || "").toLowerCase();

          switch (rule.operator) {
            case "contains":
              return (
                rule.value !== undefined &&
                stringValue.includes(String(rule.value).toLowerCase())
              );
            case "equals":
              return (
                rule.value !== undefined &&
                stringValue === String(rule.value).toLowerCase()
              );
            case "startsWith":
              return (
                rule.value !== undefined &&
                stringValue.startsWith(String(rule.value).toLowerCase())
              );
            case "endsWith":
              return (
                rule.value !== undefined &&
                stringValue.endsWith(String(rule.value).toLowerCase())
              );
            case "in":
              return (
                Array.isArray(rule.value) && rule?.value?.includes(String(value))
              );
            case "notIn":
              return (
                Array.isArray(rule.value) && !rule?.value?.includes(String(value))
              );
            default:
              return true;
          }
        });
      });

    return filtered;
  }, [emails, globalFilter, filterRules]);

  // Calculate dashboard metrics
  const dashboardMetrics = useMemo(() => {
    const statusCounts = filteredEmails.reduce(
      (acc, email) => {
        acc[email.status] = (acc[email.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const priorityCounts = filteredEmails.reduce(
      (acc, email) => {
        acc[email.priority] = (acc[email.priority] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Convert to red/yellow/green for charts
    const redCount = (statusCounts.rejected || 0) + (statusCounts.pending || 0);
    const yellowCount =
      (statusCounts.in_progress || 0) + (statusCounts.under_review || 0);
    const greenCount =
      (statusCounts.approved || 0) + (statusCounts.completed || 0);

    return {
      total: filteredEmails?.length || 0,
      statusDistribution: {
        red: redCount,
        yellow: yellowCount,
        green: greenCount,
      },
      statusCounts,
      priorityCounts,
      overdue: filteredEmails?.filter(
        (email: any) => email.dueDate && new Date(email.dueDate) < new Date(),
      ).length,
    };
  }, [filteredEmails]);

  // Handle status update with audit logging
  const handleStatusUpdate = useCallback(
    async (transition: {
      emailId: string;
      fromStatus: EmailStatus;
      toStatus: EmailStatus;
      comment?: string;
      metadata?: Record<string, any>;
    }) => {
      try {
        // Update status via parent callback
        await onEmailStatusUpdate(
          transition.emailId,
          transition.fromStatus,
          transition.toStatus,
          transition.comment,
        );

        // Log the status change for audit trail
        await logStatusChange(
          transition.emailId,
          transition.fromStatus,
          transition.toStatus,
          transition.comment,
          transition.metadata,
        );

        // Log user action
        await logUserAction(
          "status_update",
          "email",
          transition.emailId,
          {
            fromStatus: transition.fromStatus,
            toStatus: transition.toStatus,
            comment: transition.comment,
          },
          "medium",
        );
      } catch (error) {
        console.error("Status update failed:", error);
        throw error;
      }
    },
    [onEmailStatusUpdate, logStatusChange, logUserAction],
  );

  // Handle export
  const handleExport = useCallback(
    async (exportData: {
      data: any[];
      columns: ExportColumn[];
      format: "csv" | "xlsx" | "pdf";
      filename: string;
      options: any;
    }) => {
      try {
        // Log export action
        await logUserAction(
          "data_export",
          "email",
          "bulk",
          {
            format: exportData.format,
            recordCount: exportData?.data?.length,
            filename: exportData.filename,
          },
          "low",
        );

        console.log("Export completed:", exportData);
      } catch (error) {
        console.error("Export logging failed:", error);
      }
    },
    [logUserAction],
  );

  // Generate timeline data for charts
  const timelineData = useMemo(() => {
    // Group emails by day for the last 30 days
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split("T")[0];
    }).reverse();

    return last30Days?.map((date: any) => {
      const dayEmails = emails?.filter(
        (email: any) => email.createdAt?.split("T")[0] === date,
      );

      return {
        timestamp: date as string, // date is always defined from the array generation above
        totalEmails: dayEmails?.length || 0,
        completedEmails: dayEmails?.filter((e: any) => e.status === "completed")
          .length,
        criticalEmails: dayEmails?.filter((e: any) => e.priority === "critical")
          .length,
        averageProcessingTime: dayEmails?.length || 0 > 0 ? 2 * 60 * 60 * 1000 : 0, // Mock 2 hours
      };
    });
  }, [emails]);

  // Generate SLA data
  const slaData = useMemo(() => {
    const overallSLA = {
      onTrack: dashboardMetrics?.statusCounts?.completed || 0,
      atRisk: dashboardMetrics?.statusCounts?.under_review || 0,
      overdue: dashboardMetrics.overdue,
      totalItems: filteredEmails?.length || 0,
    };

    const priorityBreakdown = [
      {
        priority: "Critical" as const,
        slaThreshold: 4,
        onTrack: filteredEmails?.filter(
          (e: any) => e.priority === "critical" && e.status === "completed",
        ).length,
        atRisk: filteredEmails?.filter(
          (e: any) => e.priority === "critical" && e.status === "under_review",
        ).length,
        overdue: filteredEmails?.filter(
          (e: any) =>
            e.priority === "critical" &&
            e.dueDate &&
            new Date(e.dueDate) < new Date(),
        ).length,
        averageTime: 3 * 60 * 60 * 1000, // 3 hours
      },
      {
        priority: "High" as const,
        slaThreshold: 8,
        onTrack: filteredEmails?.filter(
          (e: any) => e.priority === "high" && e.status === "completed",
        ).length,
        atRisk: filteredEmails?.filter(
          (e: any) => e.priority === "high" && e.status === "under_review",
        ).length,
        overdue: filteredEmails?.filter(
          (e: any) =>
            e.priority === "high" &&
            e.dueDate &&
            new Date(e.dueDate) < new Date(),
        ).length,
        averageTime: 6 * 60 * 60 * 1000, // 6 hours
      },
      {
        priority: "Medium" as const,
        slaThreshold: 24,
        onTrack: filteredEmails?.filter(
          (e: any) => e.priority === "medium" && e.status === "completed",
        ).length,
        atRisk: filteredEmails?.filter(
          (e: any) => e.priority === "medium" && e.status === "under_review",
        ).length,
        overdue: filteredEmails?.filter(
          (e: any) =>
            e.priority === "medium" &&
            e.dueDate &&
            new Date(e.dueDate) < new Date(),
        ).length,
        averageTime: 12 * 60 * 60 * 1000, // 12 hours
      },
      {
        priority: "Low" as const,
        slaThreshold: 72,
        onTrack: filteredEmails?.filter(
          (e: any) => e.priority === "low" && e.status === "completed",
        ).length,
        atRisk: filteredEmails?.filter(
          (e: any) => e.priority === "low" && e.status === "under_review",
        ).length,
        overdue: filteredEmails?.filter(
          (e: any) =>
            e.priority === "low" &&
            e.dueDate &&
            new Date(e.dueDate) < new Date(),
        ).length,
        averageTime: 24 * 60 * 60 * 1000, // 24 hours
      },
    ];

    return { overallSLA, priorityBreakdown };
  }, [filteredEmails, dashboardMetrics]);

  return (
    <div
      className={`advanced-email-dashboard bg-gray-50 min-h-screen ${className}`}
    >
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Email Dashboard
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Advanced filtering, status management, and reporting
            </p>
          </div>

          <div className="flex items-center space-x-4">
            {/* View Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              {[
                { id: "table", label: "Table", icon: Filter },
                { id: "analytics", label: "Analytics", icon: BarChart3 },
                { id: "workflow", label: "Workflow", icon: Zap },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveView(id as any)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeView === id
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
              {filterStats.totalFilters > 0 && (
                <span className="bg-blue-400 text-white text-xs px-2 py-1 rounded-full">
                  {filterStats.totalFilters}
                </span>
              )}
            </button>

            <DataExportManager
              data={filteredEmails}
              columns={columns}
              onExport={handleExport}
              defaultFilename="email_dashboard_export"
            />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">
                  Total Emails
                </p>
                <p className="text-3xl font-bold text-blue-700">
                  {dashboardMetrics.total}
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Completed</p>
                <p className="text-3xl font-bold text-green-700">
                  {dashboardMetrics?.statusCounts?.completed || 0}
                </p>
              </div>
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600 font-medium">
                  In Progress
                </p>
                <p className="text-3xl font-bold text-yellow-700">
                  {(dashboardMetrics?.statusCounts?.in_progress || 0) +
                    (dashboardMetrics?.statusCounts?.under_review || 0)}
                </p>
              </div>
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
              </div>
            </div>
          </div>

          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">Overdue</p>
                <p className="text-3xl font-bold text-red-700">
                  {dashboardMetrics.overdue}
                </p>
              </div>
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <AdvancedFilterPanel
          columns={columns}
          onFilterChange={(rules: any) => {
            // Update filter rules
            rules.forEach((rule: any) => addFilterRule(rule));
          }}
          onPresetSave={(preset: any) => {
            console.log("Save preset:", preset);
          }}
          onPresetLoad={(preset: any) => {
            console.log("Load preset:", preset);
          }}
          onPresetDelete={(presetId: any) => {
            console.log("Delete preset:", presetId);
          }}
          presets={[]}
          globalSearch={globalFilter}
          onGlobalSearchChange={setGlobalFilter}
          isOpen={showFilters}
          onToggle={() => setShowFilters(!showFilters)}
          className="mx-6 mt-4"
        />
      )}

      {/* Main Content */}
      <div className="p-6">
        {activeView === "table" && (
          <div className="space-y-6">
            {/* Email Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Email Records
                </h2>
                <p className="text-sm text-gray-600">
                  {filteredEmails?.length || 0} of {emails?.length || 0} emails
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email Alias
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Requested By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Subject
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Priority
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredEmails.slice(0, 10).map((email: any) => (
                      <tr key={email.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {email.emailAlias}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {email.requestedBy}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                          {email.subject}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              email.status === "completed"
                                ? "bg-green-100 text-green-800"
                                : email.status === "in_progress"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : email.status === "rejected"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {email?.status?.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              email.priority === "critical"
                                ? "bg-red-100 text-red-800"
                                : email.priority === "high"
                                  ? "bg-orange-100 text-orange-800"
                                  : email.priority === "medium"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-green-100 text-green-800"
                            }`}
                          >
                            {email.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button
                            onClick={() => setSelectedEmail(email)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeView === "analytics" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StatusDistributionChart
              data={dashboardMetrics.statusDistribution}
              totalEmails={dashboardMetrics.total}
              title="Status Distribution"
              chartType="doughnut"
            />

            <WorkflowTimelineChart
              data={timelineData}
              timeRange="30d"
              title="Email Processing Timeline"
              showProcessingTime={true}
            />

            <div className="lg:col-span-2">
              <SLATrackingDashboard
                overallSLA={slaData.overallSLA}
                priorityBreakdown={slaData.priorityBreakdown}
                title="SLA Performance Tracking"
                complianceTarget={95}
              />
            </div>
          </div>
        )}

        {activeView === "workflow" && selectedEmail && (
          <div className="max-w-4xl mx-auto">
            <StatusUpdateManager
              emailData={{
                id: selectedEmail.id,
                subject: selectedEmail.subject,
                currentStatus: selectedEmail.status,
                assignedTo: selectedEmail.assignedTo,
                priority: selectedEmail.priority,
                dueDate: selectedEmail.dueDate,
                lastUpdated: selectedEmail.updatedAt,
                statusHistory: [], // Would be populated from API
              }}
              currentUser={currentUser}
              onStatusUpdate={handleStatusUpdate}
              onHistoryView={(emailId: any) => {
                console.log("View history for:", emailId);
              }}
            />
          </div>
        )}

        {activeView === "workflow" && !selectedEmail && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              Select an email from the table view to manage its workflow
            </p>
            <button
              onClick={() => setActiveView("table")}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Go to Table View
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedEmailDashboard;
