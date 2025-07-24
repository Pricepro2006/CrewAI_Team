import React, { useState, useEffect, useMemo } from "react";
import { trpc } from "../../App";
import { EmailStats } from "./EmailStats";
import { EmailCompose } from "./EmailCompose";
import "./EmailDashboard.css";

export interface EmailDashboardProps {
  className?: string;
}

// Email interfaces
interface EmailRecord {
  id: string;
  email_alias: string;
  requested_by: string;
  subject: string;
  summary: string;
  status: "red" | "yellow" | "green";
  status_text: string;
  workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
  timestamp: string;
  priority?: "Critical" | "High" | "Medium" | "Low";
  workflow_type?: string;
  entities?: any;
  isRead?: boolean;
  hasAttachments?: boolean;
  tags?: string[];
}

interface FilterConfig {
  search: string;
  emailAliases: string[];
  requesters: string[];
  statuses: ("red" | "yellow" | "green")[];
  workflowStates: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[];
  workflowTypes: string[];
  priorities: ("Critical" | "High" | "Medium" | "Low")[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  hasAttachments?: boolean;
  isRead?: boolean;
  tags: string[];
}

interface FilterOptions {
  emailAliases: string[];
  requesters: string[];
  statuses: Array<{
    value: "red" | "yellow" | "green";
    label: string;
    color: string;
    description: string;
  }>;
  workflowStates: readonly ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[];
  workflowTypes: string[];
  priorities: readonly ("Critical" | "High" | "Medium" | "Low")[];
  tags: string[];
}

// Map existing email data to new EmailRecord format
function mapEmailToRecord(email: any): EmailRecord {
  const analysis = email.analysis || {};
  const workflowState =
    analysis.workflow_state === "New"
      ? "START_POINT"
      : analysis.workflow_state === "In Progress"
        ? "IN_PROGRESS"
        : "COMPLETION";

  const status =
    analysis.quick_priority === "Critical" ||
    analysis.action_sla_status === "overdue"
      ? "red"
      : workflowState === "IN_PROGRESS"
        ? "yellow"
        : "green";

  const statusText =
    analysis.quick_priority === "Critical"
      ? "Critical"
      : analysis.action_sla_status === "overdue"
        ? "Overdue"
        : workflowState === "START_POINT"
          ? "New Request"
          : workflowState === "IN_PROGRESS"
            ? "Processing"
            : "Completed";

  return {
    id: email.id,
    email_alias:
      email.to?.split("@")[0] + "@tdsynnex.com" || "unknown@tdsynnex.com",
    requested_by: email.from?.split("<")[0]?.trim() || "Unknown",
    subject: email.subject || "No Subject",
    summary:
      analysis.quick_summary || email.bodyPreview || "No summary available",
    status,
    status_text: statusText,
    workflow_state: workflowState,
    timestamp: email.receivedDateTime,
    priority: analysis.quick_priority || "Medium",
    workflow_type: analysis.workflow_type || "General",
    entities: analysis.entities,
    isRead: email.isRead,
    hasAttachments: email.hasAttachments,
  };
}

export const EmailDashboard: React.FC<EmailDashboardProps> = ({
  className,
}) => {
  const [filters, setFilters] = useState<FilterConfig>({
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
  });
  const [showCompose, setShowCompose] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [realTimeUpdates, setRealTimeUpdates] = useState<
    Array<{
      type:
        | "email.analyzed"
        | "email.state_changed"
        | "email.sla_alert"
        | "email.analytics_updated";
      data: any;
    }>
  >([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch email analytics
  const { data: emailStats, isLoading: statsLoading } =
    trpc.emails.getAnalytics.useQuery({
      refreshKey,
    });

  // Fetch filtered emails
  const sanitizedFilters = {
    ...filters,
    dateRange:
      filters.dateRange.start && filters.dateRange.end
        ? {
            start: filters.dateRange.start,
            end: filters.dateRange.end,
          }
        : undefined,
  };

  const {
    data: emails,
    isLoading: emailsLoading,
    refetch: refetchEmails,
  } = trpc.emails.getList.useQuery({
    ...sanitizedFilters,
    limit: 50,
  });

  // WebSocket subscription for real-time updates
  const emailUpdatesSubscription =
    trpc.emails.subscribeToEmailUpdates.useSubscription(
      {
        types: [
          "email.analyzed",
          "email.state_changed",
          "email.sla_alert",
          "email.analytics_updated",
        ],
      },
      {
        onData: (update: any) => {
          setRealTimeUpdates((prev) => [...prev.slice(-99), update]); // Keep last 100 updates

          // Handle different types of updates
          switch (update.type) {
            case "email.analyzed": {
              // Refresh email list when new analysis is complete
              setRefreshKey((prev) => prev + 1);
              refetchEmails();
              break;
            }
            case "email.state_changed": {
              // Refresh email list when state changes
              refetchEmails();
              break;
            }
            case "email.analytics_updated": {
              // Refresh analytics when updated
              setRefreshKey((prev) => prev + 1);
              break;
            }
            case "email.sla_alert": {
              // Show SLA alert notification
              console.log("SLA Alert:", update.data);
              break;
            }
          }
        },
        onError: (error) => {
          console.error("WebSocket subscription error:", error);
        },
      },
    );

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey((prev) => prev + 1);
      refetchEmails();
    }, 30000);
    return () => clearInterval(interval);
  }, [refetchEmails]);

  // Convert emails to EmailRecord format
  const emailRecords = useMemo(() => {
    if (!emails) return [];
    // Handle both direct array and wrapped response
    const emailData = Array.isArray(emails) ? emails : emails.data || [];
    return emailData.map(mapEmailToRecord);
  }, [emails]);

  // Generate filter options from current data
  const filterOptions = useMemo<FilterOptions>(() => {
    if (!emailRecords)
      return {
        emailAliases: [],
        requesters: [],
        statuses: [],
        workflowStates: [],
        workflowTypes: [],
        priorities: [],
        tags: [],
      };

    const emailAliases = [...new Set(emailRecords.map((e) => e.email_alias))];
    const requesters = [...new Set(emailRecords.map((e) => e.requested_by))];
    const workflowTypes = [
      ...new Set(emailRecords.map((e) => e.workflow_type).filter(Boolean)),
    ];
    const tags = [...new Set(emailRecords.flatMap((e) => e.tags || []))];

    const statusCounts = { red: 0, yellow: 0, green: 0 };
    const workflowStateCounts = {
      START_POINT: 0,
      IN_PROGRESS: 0,
      COMPLETION: 0,
    };
    const priorityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };

    emailRecords.forEach((email) => {
      statusCounts[email.status]++;
      workflowStateCounts[email.workflow_state]++;
      if (email.priority)
        priorityCounts[email.priority as keyof typeof priorityCounts]++;
    });

    return {
      emailAliases,
      requesters,
      statuses: [
        {
          value: "red" as const,
          label: "Critical",
          color: "red",
          description: "Critical/urgent emails requiring immediate attention",
        },
        {
          value: "yellow" as const,
          label: "In Progress",
          color: "yellow",
          description: "Emails currently being processed",
        },
        {
          value: "green" as const,
          label: "Completed",
          color: "green",
          description: "Successfully completed emails",
        },
      ],
      workflowStates: ["START_POINT", "IN_PROGRESS", "COMPLETION"] as const,
      workflowTypes: workflowTypes.filter((t): t is string => t !== undefined),
      priorities: ["Critical", "High", "Medium", "Low"] as const,
      tags,
    };
  }, [emailRecords]);

  // Handle filter changes
  const handleFilterChange = (newFilters: FilterConfig) => {
    setFilters(newFilters);
  };

  // Handle email selection
  const handleEmailSelect = (emailId: string) => {
    setSelectedEmails((prev) =>
      prev.includes(emailId)
        ? prev.filter((id) => id !== emailId)
        : [...prev, emailId],
    );
  };

  const handleEmailsSelect = (emailIds: string[]) => {
    setSelectedEmails(emailIds);
  };

  // Handle email row click
  const handleEmailClick = (email: EmailRecord) => {
    // Navigate to email detail view or open modal
    console.log("Email clicked:", email);
  };

  // Manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchEmails();
    setRefreshKey((prev) => prev + 1);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Handle bulk actions
  const handleBulkAction = async (action: string, emailIds: string[]) => {
    try {
      switch (action) {
        case "mark-read":
          // TODO: Implement bulk mark as read
          break;
        case "archive":
          // TODO: Implement bulk archive
          break;
        case "priority-high":
          // TODO: Implement bulk priority change
          break;
        default:
          console.warn("Unknown bulk action:", action);
      }

      // Refresh data after action
      refetchEmails();
      setSelectedEmails([]);
    } catch (error) {
      console.error("Bulk action failed:", error);
    }
  };

  // Calculate quick stats for today
  const todayStats = React.useMemo(() => {
    if (!emails) return { received: 0, processed: 0, overdue: 0, critical: 0 };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Handle both direct array and wrapped response
    const emailData = Array.isArray(emails) ? emails : emails.data || [];

    return emailData.reduce(
      (
        acc: {
          received: number;
          processed: number;
          overdue: number;
          critical: number;
        },
        email: any,
      ) => {
        const emailDate = new Date(email.receivedDateTime);
        emailDate.setHours(0, 0, 0, 0);

        if (emailDate.getTime() === today.getTime()) {
          acc.received++;
          if (email.analysis?.workflow_state !== "New") acc.processed++;
          if (email.analysis?.action_sla_status === "overdue") acc.overdue++;
          if (email.analysis?.quick_priority === "Critical") acc.critical++;
        }

        return acc;
      },
      { received: 0, processed: 0, overdue: 0, critical: 0 },
    );
  }, [emails]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.emailAliases?.length) count += filters.emailAliases.length;
    if (filters.requesters?.length) count += filters.requesters.length;
    if (filters.statuses?.length) count += filters.statuses.length;
    if (filters.workflowStates?.length) count += filters.workflowStates.length;
    if (filters.priorities?.length) count += filters.priorities.length;
    if (filters.dateRange) count++;
    if (filters.hasAttachments !== undefined) count++;
    if (filters.isRead !== undefined) count++;
    if (filters.tags?.length) count += filters.tags.length;
    return count;
  }, [filters]);

  return (
    <div className={`email-dashboard ${className || ""}`}>
      <div className="email-dashboard__header">
        <div className="email-dashboard__title">
          <h1>
            <svg
              className="email-dashboard__title-icon"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M22 6L12 13L2 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Email Dashboard
          </h1>
          <p className="email-dashboard__subtitle">
            Real-time Email Analysis & Workflow Management
          </p>
        </div>

        <div className="email-dashboard__actions">
          <button
            className={`email-dashboard__action-btn email-dashboard__action-btn--secondary ${isRefreshing ? "animate-spin" : ""}`}
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <svg
              className="email-dashboard__action-icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1 4V10H7M23 20V14H17M20.49 9A9 9 0 1 0 5.64 5.64L1 10M23 14L18.36 18.36A9 9 0 0 1 3.51 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Refresh
          </button>

          <button
            className="email-dashboard__action-btn email-dashboard__action-btn--primary"
            onClick={() => setShowCompose(true)}
          >
            <svg
              className="email-dashboard__action-icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <line
                x1="12"
                y1="5"
                x2="12"
                y2="19"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line
                x1="5"
                y1="12"
                x2="19"
                y2="12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Compose Email
          </button>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="email-dashboard__quick-stats">
        <div className="email-dashboard__stat">
          <div className="email-dashboard__stat-value">
            {todayStats.received}
          </div>
          <div className="email-dashboard__stat-label">Today&apos;s Emails</div>
        </div>
        <div className="email-dashboard__stat">
          <div className="email-dashboard__stat-value">
            {todayStats.processed}
          </div>
          <div className="email-dashboard__stat-label">Processed</div>
        </div>
        <div className="email-dashboard__stat">
          <div className="email-dashboard__stat-value email-dashboard__stat-value--warning">
            {todayStats.overdue}
          </div>
          <div className="email-dashboard__stat-label">Overdue</div>
        </div>
        <div className="email-dashboard__stat">
          <div className="email-dashboard__stat-value email-dashboard__stat-value--critical">
            {todayStats.critical}
          </div>
          <div className="email-dashboard__stat-label">Critical</div>
        </div>
      </div>

      <div className="email-dashboard__content">
        {/* Analytics Section */}
        <div className="email-dashboard__analytics">
          <EmailStats
            stats={
              emailStats && "data" in emailStats ? emailStats.data : emailStats
            }
            loading={statsLoading}
          />
        </div>

        {/* Main Email Interface */}
        <div className="email-dashboard__main">
          {/* Search Bar */}
          <div className="email-dashboard__controls">
            <div className="email-dashboard__search">
              <div className="email-dashboard__search-input">
                <svg
                  className="email-dashboard__search-icon"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    cx="11"
                    cy="11"
                    r="8"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M21 21L16.65 16.65"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Search emails by subject, sender, or content..."
                  value={filters.search || ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleFilterChange({ ...filters, search: e.target.value })
                  }
                  className="email-dashboard__search-field"
                />
              </div>
            </div>

            {/* Status Legend */}
            <div className="email-dashboard__status-legend">
              <span className="status-indicator status-indicator--red">
                Critical/Urgent
              </span>
              <span className="status-indicator status-indicator--yellow">
                In Progress
              </span>
              <span className="status-indicator status-indicator--green">
                Completed
              </span>
            </div>
          </div>

          {/* Quick Filter Buttons */}
          <div className="email-dashboard__quick-filters">
            <button
              className={`quick-filter-btn ${filters.priorities.includes("Critical") ? "active" : ""}`}
              onClick={() => {
                const newPriorities = filters.priorities.includes("Critical")
                  ? filters.priorities.filter((p) => p !== "Critical")
                  : [...filters.priorities, "Critical"];
                handleFilterChange({ ...filters, priorities: newPriorities });
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
              Critical Only
            </button>
            <button
              className={`quick-filter-btn ${filters.isRead === false ? "active" : ""}`}
              onClick={() => {
                handleFilterChange({
                  ...filters,
                  isRead: filters.isRead === false ? undefined : false,
                });
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M22 6L12 13L2 6"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
              Unread
            </button>
            <button
              className={`quick-filter-btn ${filters.hasAttachments ? "active" : ""}`}
              onClick={() => {
                handleFilterChange({
                  ...filters,
                  hasAttachments: filters.hasAttachments ? undefined : true,
                });
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M21.44 11.05L12.25 20.24C11.1216 21.3734 9.58897 22.0129 7.99 22.0129C6.39103 22.0129 4.8584 21.3734 3.725 20.24C2.59161 19.1066 1.95209 17.574 1.95209 15.975C1.95209 14.376 2.59161 12.8434 3.725 11.71L14.04 1.39C14.7911 0.638947 15.7987 0.201492 16.8554 0.162228C17.9121 0.122964 18.9502 0.484613 19.755 1.17588C20.5598 1.86716 20.9729 2.82863 20.9996 3.84C21.0262 4.85137 20.6648 5.83432 19.9 6.56L9.585 16.88C9.18643 17.2906 8.63303 17.522 8.05388 17.522C7.47472 17.522 6.92132 17.2906 6.5227 16.88C6.12408 16.4694 5.91559 15.9136 5.94703 15.3409C5.97847 14.7682 6.24742 14.2248 6.695 13.82L16.01 4.51"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Has Attachments
            </button>
          </div>

          {/* Bulk Actions */}
          {selectedEmails.length > 0 && (
            <div className="email-dashboard__bulk-actions">
              <div className="email-dashboard__bulk-count">
                {selectedEmails.length} email
                {selectedEmails.length !== 1 ? "s" : ""} selected
              </div>
              <div className="email-dashboard__bulk-buttons">
                <button
                  onClick={() => handleBulkAction("mark-read", selectedEmails)}
                  className="email-dashboard__bulk-btn"
                >
                  Mark as Read
                </button>
                <button
                  onClick={() => handleBulkAction("archive", selectedEmails)}
                  className="email-dashboard__bulk-btn"
                >
                  Archive
                </button>
                <button
                  onClick={() =>
                    handleBulkAction("priority-high", selectedEmails)
                  }
                  className="email-dashboard__bulk-btn"
                >
                  Set High Priority
                </button>
              </div>
            </div>
          )}

          {/* Email Table */}
          <div className="email-dashboard__table">
            {emailsLoading ? (
              <div className="email-dashboard__loading">
                <div className="spinner"></div>
                <p>Loading emails from database...</p>
              </div>
            ) : emailRecords.length === 0 ? (
              <div className="email-dashboard__empty">
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.3"
                  />
                  <path
                    d="M22 6L12 13L2 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.3"
                  />
                </svg>
                <p>No emails found</p>
                <p className="email-dashboard__empty-hint">
                  Emails will appear here as they are processed
                </p>
              </div>
            ) : (
              <table className="email-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={
                          selectedEmails.length === emailRecords.length &&
                          emailRecords.length > 0
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleEmailsSelect(
                              emailRecords.map((email) => email.id),
                            );
                          } else {
                            handleEmailsSelect([]);
                          }
                        }}
                      />
                    </th>
                    <th>Status</th>
                    <th>Subject</th>
                    <th>From</th>
                    <th>Email Alias</th>
                    <th>Priority</th>
                    <th>Workflow</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {emailRecords.map((email) => (
                    <tr
                      key={email.id}
                      className={`email-row ${!email.isRead ? "unread" : ""}`}
                      onClick={() => handleEmailClick(email)}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedEmails.includes(email.id)}
                          onChange={() => handleEmailSelect(email.id)}
                        />
                      </td>
                      <td>
                        <span
                          className={`status-dot status-dot--${email.status}`}
                          title={email.status_text}
                        >
                          {email.status === "red" && "●"}
                          {email.status === "yellow" && "●"}
                          {email.status === "green" && "●"}
                        </span>
                      </td>
                      <td className="email-subject">
                        <div className="email-subject-wrapper">
                          <span className="email-subject-text">
                            {email.subject}
                          </span>
                          <div className="email-summary">{email.summary}</div>
                        </div>
                      </td>
                      <td>{email.requested_by}</td>
                      <td className="email-alias">{email.email_alias}</td>
                      <td>
                        <span
                          className={`priority-badge priority-badge--${email.priority?.toLowerCase() || "medium"}`}
                        >
                          {email.priority || "Medium"}
                        </span>
                      </td>
                      <td>
                        <span className="workflow-type">
                          {email.workflow_type || "General"}
                        </span>
                        <span
                          className={`workflow-state workflow-state--${email.workflow_state.toLowerCase()}`}
                        >
                          {email.workflow_state === "START_POINT" && "New"}
                          {email.workflow_state === "IN_PROGRESS" &&
                            "In Progress"}
                          {email.workflow_state === "COMPLETION" && "Completed"}
                        </span>
                      </td>
                      <td className="email-date">
                        {new Date(email.timestamp).toLocaleDateString()}
                        <div className="email-time">
                          {new Date(email.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <EmailCompose
          onClose={() => setShowCompose(false)}
          onSend={() => {
            setShowCompose(false);
            refetchEmails();
          }}
        />
      )}
    </div>
  );
};
