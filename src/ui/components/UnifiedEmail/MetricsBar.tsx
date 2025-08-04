import React from "react";
import {
  EnvelopeIcon,
  ChartBarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from "@heroicons/react/24/outline";
import type { DashboardMetrics } from "../../../types/unified-email.types.js";

interface MetricsBarProps {
  metrics: DashboardMetrics;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  status?: "good" | "warning" | "critical" | "normal";
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  tooltip?: string;
  onClick?: () => void;
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  icon,
  status = "normal",
  trend,
  trendValue,
  tooltip,
  onClick,
}) => {
  const statusClasses = {
    good: "metric-card--good",
    warning: "metric-card--warning",
    critical: "metric-card--critical",
    normal: "metric-card--normal",
  };

  return (
    <div
      className={`metric-card ${statusClasses[status]} ${onClick ? "metric-card--clickable" : ""}`}
      onClick={onClick}
      title={tooltip}
    >
      {icon && <div className="metric-card__icon">{icon}</div>}
      <div className="metric-card__content">
        <div className="metric-card__value">
          {value}
          {trend && (
            <span className={`metric-card__trend metric-card__trend--${trend}`}>
              {trend === "up" ? (
                <ArrowTrendingUpIcon />
              ) : (
                <ArrowTrendingDownIcon />
              )}
              {trendValue && <span>{trendValue}</span>}
            </span>
          )}
        </div>
        <div className="metric-card__label">{label}</div>
      </div>
    </div>
  );
};

export const MetricsBar: React.FC<MetricsBarProps> = ({ metrics }) => {
  // Determine workflow completion status
  const getWorkflowStatus = (completion: number) => {
    if (completion < 10) return "critical";
    if (completion < 30) return "warning";
    if (completion > 50) return "good";
    return "normal";
  };

  // Determine response time status
  const getResponseTimeStatus = (hours: number) => {
    if (hours > 8) return "critical";
    if (hours > 4) return "warning";
    if (hours <= 2) return "good";
    return "normal";
  };

  return (
    <div className="metrics-bar">
      <div className="metrics-bar__grid">
        {/* Total Emails */}
        <MetricCard
          label="Total Emails"
          value={metrics.totalEmails.toLocaleString()}
          icon={<EnvelopeIcon />}
          tooltip="Total emails in the system"
        />

        {/* Today's Emails */}
        <MetricCard
          label="Today's Emails"
          value={metrics.todaysEmails.toLocaleString()}
          icon={<EnvelopeIcon />}
          trend={metrics.todaysEmails > 100 ? "up" : "down"}
          tooltip="Emails received today"
        />

        {/* Workflow Completion - Critical Metric */}
        <MetricCard
          label="Workflow Completion"
          value={`${metrics.workflowCompletion.toFixed(1)}%`}
          icon={<ChartBarIcon />}
          status={getWorkflowStatus(metrics.workflowCompletion)}
          tooltip="Percentage of emails with complete workflow chains (Start → In Progress → Completion)"
          trend={metrics.workflowCompletion > 3.5 ? "up" : "down"}
          trendValue={metrics.workflowCompletion > 3.5 ? "+" : "-"}
        />

        {/* Average Response Time */}
        <MetricCard
          label="Avg Response Time"
          value={`${metrics.avgResponseTime.toFixed(1)}h`}
          icon={<ClockIcon />}
          status={getResponseTimeStatus(metrics.avgResponseTime)}
          tooltip="Average time to first response"
          trend={metrics.avgResponseTime < 4.3 ? "up" : "down"}
        />

        {/* Urgent/Critical */}
        <MetricCard
          label="Urgent/Critical"
          value={metrics.urgentCount}
          icon={<ExclamationTriangleIcon />}
          status={
            metrics.urgentCount > 10
              ? "critical"
              : metrics.urgentCount > 5
                ? "warning"
                : "normal"
          }
          tooltip="Number of urgent or critical emails requiring immediate attention"
        />

        {/* Pending Assignment */}
        <MetricCard
          label="Pending Assignment"
          value={metrics.pendingAssignment}
          icon={<UserGroupIcon />}
          status={metrics.pendingAssignment > 20 ? "warning" : "normal"}
          tooltip="Emails waiting to be assigned to an agent"
        />

        {/* Agent Utilization */}
        <MetricCard
          label="Agent Utilization"
          value={`${metrics.agentUtilization}%`}
          icon={<UserGroupIcon />}
          status={
            metrics.agentUtilization > 90
              ? "warning"
              : metrics.agentUtilization < 50
                ? "warning"
                : "good"
          }
          tooltip="Percentage of agent capacity currently in use"
        />

        {/* Processed Today */}
        <MetricCard
          label="Processed Today"
          value={metrics.processedToday || 0}
          icon={<CheckCircleIcon />}
          status="good"
          tooltip="Emails successfully processed today"
        />
      </div>

      {/* Critical Alerts Section */}
      {metrics.criticalAlerts && metrics.criticalAlerts.length > 0 && (
        <div className="metrics-bar__alerts">
          {metrics.criticalAlerts.map((alert, index) => (
            <div key={index} className="metrics-bar__alert">
              <ExclamationTriangleIcon className="metrics-bar__alert-icon" />
              <span>{alert.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
