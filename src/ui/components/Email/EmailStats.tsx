import React from "react";
import {
  ChartBarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  TruckIcon,
  DocumentTextIcon,
  UserGroupIcon,
  CogIcon,
} from "@heroicons/react/24/outline";

export interface EmailStatsProps {
  stats?: {
    totalEmails: number;
    workflowDistribution: Record<string, number>;
    slaCompliance: Record<string, number>;
    averageProcessingTime: number;
  };
  loading?: boolean;
}

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  description?: string;
  color?: "default" | "success" | "warning" | "danger";
  format?: "number" | "percentage" | "time";
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  description,
  color = "default",
  format = "number",
}) => {
  const formatValue = (val: number | string) => {
    if (typeof val === "string") return val;

    switch (format) {
      case "percentage":
        return `${val.toFixed(1)}%`;
      case "time":
        return val < 1000 ? `${val}ms` : `${(val / 1000).toFixed(1)}s`;
      default:
        return val.toLocaleString();
    }
  };

  return (
    <div className={`email-stats__card email-stats__card--${color}`}>
      <div className="email-stats__card-header">
        <div className="email-stats__card-icon">{icon}</div>
        <div className="email-stats__card-title">{title}</div>
      </div>
      <div className="email-stats__card-value">{formatValue(value)}</div>
      {description && (
        <div className="email-stats__card-description">{description}</div>
      )}
    </div>
  );
};

export const EmailStats: React.FC<EmailStatsProps> = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="email-stats">
        <div className="email-stats__header">
          <h2>Email Analytics</h2>
          <p>Loading analytics...</p>
        </div>
        <div className="email-stats__grid">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="email-stats__card email-stats__card--loading"
            >
              <div className="email-stats__card-skeleton"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="email-stats">
        <div className="email-stats__header">
          <h2>Email Analytics</h2>
          <p>No data available</p>
        </div>
      </div>
    );
  }

  // Calculate workflow percentages
  const totalWorkflowEmails = Object.values(stats.workflowDistribution).reduce(
    (sum, count) => sum + count,
    0,
  );
  const workflowPercentages = Object.entries(stats.workflowDistribution).map(
    ([workflow, count]) => ({
      workflow,
      count,
      percentage:
        totalWorkflowEmails > 0 ? (count / totalWorkflowEmails) * 100 : 0,
    }),
  );

  // Calculate SLA compliance rate
  const totalSLAEmails = Object.values(stats.slaCompliance).reduce(
    (sum, count) => sum + count,
    0,
  );
  const onTrackEmails = stats.slaCompliance["on-track"] || 0;
  const slaComplianceRate =
    totalSLAEmails > 0 ? (onTrackEmails / totalSLAEmails) * 100 : 0;

  // Top workflow categories
  const topWorkflows = workflowPercentages
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return (
    <div className="email-stats">
      <div className="email-stats__header">
        <h2>
          <ChartBarIcon className="email-stats__header-icon" />
          Email Analytics
        </h2>
        <p>TD SYNNEX Workflow Distribution & Performance</p>
      </div>

      {/* Overview Cards */}
      <div className="email-stats__grid">
        <StatCard
          title="Total Emails"
          value={stats.totalEmails}
          icon={<DocumentTextIcon />}
          description="All analyzed emails"
        />

        <StatCard
          title="Avg Processing Time"
          value={stats.averageProcessingTime}
          icon={<ClockIcon />}
          description="End-to-end analysis time"
          format="time"
        />

        <StatCard
          title="SLA Compliance"
          value={slaComplianceRate}
          icon={<CheckCircleIcon />}
          description="Emails within SLA"
          color={
            slaComplianceRate >= 95
              ? "success"
              : slaComplianceRate >= 80
                ? "warning"
                : "danger"
          }
          format="percentage"
        />

        <StatCard
          title="Overdue Items"
          value={stats.slaCompliance["overdue"] || 0}
          icon={<ExclamationTriangleIcon />}
          description="Past SLA deadline"
          color="danger"
        />

        <StatCard
          title="At Risk"
          value={stats.slaCompliance["at-risk"] || 0}
          icon={<ExclamationTriangleIcon />}
          description="Approaching SLA deadline"
          color="warning"
        />

        <StatCard
          title="On Track"
          value={stats.slaCompliance["on-track"] || 0}
          icon={<CheckCircleIcon />}
          description="Within SLA timeline"
          color="success"
        />
      </div>

      {/* Workflow Distribution */}
      <div className="email-stats__workflows">
        <h3>Top Workflow Categories</h3>
        <div className="email-stats__workflow-list">
          {topWorkflows?.map(({ workflow, count, percentage }) => {
            const getWorkflowIcon = (workflowName: string) => {
              switch (workflowName) {
                case "Order Management":
                  return <DocumentTextIcon />;
                case "Shipping/Logistics":
                  return <TruckIcon />;
                case "Customer Support":
                  return <UserGroupIcon />;
                default:
                  return <CogIcon />;
              }
            };

            return (
              <div key={workflow} className="email-stats__workflow-item">
                <div className="email-stats__workflow-header">
                  <div className="email-stats__workflow-icon">
                    {getWorkflowIcon(workflow)}
                  </div>
                  <div className="email-stats__workflow-info">
                    <div className="email-stats__workflow-name">{workflow}</div>
                    <div className="email-stats__workflow-count">
                      {count} emails ({percentage.toFixed(1)}%)
                    </div>
                  </div>
                </div>
                <div className="email-stats__workflow-bar">
                  <div
                    className="email-stats__workflow-progress"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SLA Breakdown */}
      <div className="email-stats__sla-breakdown">
        <h3>SLA Status Distribution</h3>
        <div className="email-stats__sla-grid">
          <div className="email-stats__sla-item email-stats__sla-item--success">
            <div className="email-stats__sla-value">
              {stats.slaCompliance["on-track"] || 0}
            </div>
            <div className="email-stats__sla-label">On Track</div>
          </div>
          <div className="email-stats__sla-item email-stats__sla-item--warning">
            <div className="email-stats__sla-value">
              {stats.slaCompliance["at-risk"] || 0}
            </div>
            <div className="email-stats__sla-label">At Risk</div>
          </div>
          <div className="email-stats__sla-item email-stats__sla-item--danger">
            <div className="email-stats__sla-value">
              {stats.slaCompliance["overdue"] || 0}
            </div>
            <div className="email-stats__sla-label">Overdue</div>
          </div>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="email-stats__insights">
        <h3>Performance Insights</h3>
        <div className="email-stats__insights-list">
          {slaComplianceRate >= 98 && (
            <div className="email-stats__insight email-stats__insight--success">
              <CheckCircleIcon className="email-stats__insight-icon" />
              Excellent SLA compliance rate of {slaComplianceRate.toFixed(1)}%
            </div>
          )}

          {stats.averageProcessingTime < 2000 && (
            <div className="email-stats__insight email-stats__insight--success">
              <ClockIcon className="email-stats__insight-icon" />
              Fast processing time averaging{" "}
              {(stats.averageProcessingTime / 1000).toFixed(1)}s
            </div>
          )}

          {(stats.slaCompliance["overdue"] || 0) > 0 && (
            <div className="email-stats__insight email-stats__insight--warning">
              <ExclamationTriangleIcon className="email-stats__insight-icon" />
              {stats.slaCompliance["overdue"]} emails are overdue - review high
              priority items
            </div>
          )}

          {topWorkflows[0] && topWorkflows[0].percentage > 85 && (
            <div className="email-stats__insight email-stats__insight--info">
              <ChartBarIcon className="email-stats__insight-icon" />
              {topWorkflows[0].workflow} dominates with{" "}
              {topWorkflows[0].percentage.toFixed(1)}% of emails
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
