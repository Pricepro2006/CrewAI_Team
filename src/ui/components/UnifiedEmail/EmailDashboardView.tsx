import React from "react";
import {
  ChartBarIcon,
  ClockIcon,
  EnvelopeIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from "@heroicons/react/24/outline";
import type { DashboardMetrics } from "../../../types/unified-email.types";
import "./EmailDashboardView.css";

interface EmailDashboardViewProps {
  metrics?: DashboardMetrics;
}

export const EmailDashboardView: React.FC<EmailDashboardViewProps> = ({
  metrics,
}) => {
  const defaultMetrics: DashboardMetrics = {
    totalEmails: 2847,
    todaysEmails: 156,
    workflowCompletion: 87.5,
    avgResponseTime: 2.3,
    urgentCount: 12,
    pendingAssignment: 24,
    agentUtilization: 78,
    criticalAlerts: [],
    processedToday: 132,
  };

  const data = metrics || defaultMetrics;

  // Sample data for charts
  const weeklyData = [
    { day: "Mon", emails: 145, processed: 138 },
    { day: "Tue", emails: 162, processed: 155 },
    { day: "Wed", emails: 158, processed: 152 },
    { day: "Thu", emails: 171, processed: 164 },
    { day: "Fri", emails: 156, processed: 132 },
    { day: "Sat", emails: 89, processed: 87 },
    { day: "Sun", emails: 72, processed: 70 },
  ];

  const categoryData = [
    { category: "Quote Requests", count: 456, percentage: 32 },
    { category: "Support Tickets", count: 342, percentage: 24 },
    { category: "General Inquiries", count: 285, percentage: 20 },
    { category: "Sales Leads", count: 214, percentage: 15 },
    { category: "Other", count: 128, percentage: 9 },
  ];

  const agentPerformance = [
    { name: "John Miller", emails: 234, avgTime: 1.8, satisfaction: 94 },
    { name: "Sarah Wilson", emails: 198, avgTime: 2.1, satisfaction: 92 },
    { name: "Michael Chen", emails: 187, avgTime: 2.4, satisfaction: 89 },
    { name: "Emily Davis", emails: 165, avgTime: 2.2, satisfaction: 91 },
    { name: "David Lee", emails: 143, avgTime: 2.5, satisfaction: 88 },
  ];

  return (
    <div className="email-dashboard-view">
      {/* Key Metrics Grid */}
      <div className="dashboard-metrics-grid">
        <div className="metric-card primary">
          <div className="metric-icon">
            <EnvelopeIcon />
          </div>
          <div className="metric-content">
            <h3 className="metric-value">
              {data.totalEmails.toLocaleString()}
            </h3>
            <p className="metric-label">Total Emails</p>
            <div className="metric-trend positive">
              <ArrowTrendingUpIcon />
              <span>+12% from last month</span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <ArrowTrendingUpIcon />
          </div>
          <div className="metric-content">
            <h3 className="metric-value">{data.todaysEmails}</h3>
            <p className="metric-label">Today's Emails</p>
            <div className="metric-trend neutral">
              <span>Average daily volume</span>
            </div>
          </div>
        </div>

        <div className="metric-card success">
          <div className="metric-icon">
            <CheckCircleIcon />
          </div>
          <div className="metric-content">
            <h3 className="metric-value">{data.workflowCompletion}%</h3>
            <p className="metric-label">Workflow Completion</p>
            <div className="metric-trend positive">
              <ArrowTrendingUpIcon />
              <span>+5.2% improvement</span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <ClockIcon />
          </div>
          <div className="metric-content">
            <h3 className="metric-value">{data.avgResponseTime}h</h3>
            <p className="metric-label">Avg Response Time</p>
            <div className="metric-trend positive">
              <ArrowTrendingDownIcon />
              <span>-18% faster</span>
            </div>
          </div>
        </div>

        <div className="metric-card warning">
          <div className="metric-icon">
            <ExclamationTriangleIcon />
          </div>
          <div className="metric-content">
            <h3 className="metric-value">{data.urgentCount}</h3>
            <p className="metric-label">Urgent/Critical</p>
            <div className="metric-trend negative">
              <span>Requires attention</span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <UserGroupIcon />
          </div>
          <div className="metric-content">
            <h3 className="metric-value">{data.agentUtilization}%</h3>
            <p className="metric-label">Agent Utilization</p>
            <div className="metric-trend neutral">
              <span>Optimal range</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="dashboard-charts-row">
        {/* Weekly Volume Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Weekly Email Volume</h3>
            <div className="chart-legend">
              <span className="legend-item received">Received</span>
              <span className="legend-item processed">Processed</span>
            </div>
          </div>
          <div className="chart-content">
            <div className="bar-chart">
              {weeklyData.map((day) => (
                <div key={day.day} className="bar-group">
                  <div className="bar-container">
                    <div
                      className="bar received"
                      style={{ height: `${(day.emails / 200) * 100}%` }}
                    >
                      <span className="bar-value">{day.emails}</span>
                    </div>
                    <div
                      className="bar processed"
                      style={{ height: `${(day.processed / 200) * 100}%` }}
                    >
                      <span className="bar-value">{day.processed}</span>
                    </div>
                  </div>
                  <span className="bar-label">{day.day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Email Categories</h3>
            <span className="chart-subtitle">Last 30 days</span>
          </div>
          <div className="chart-content">
            <div className="category-list">
              {categoryData.map((category) => (
                <div key={category.category} className="category-item">
                  <div className="category-info">
                    <span className="category-name">{category.category}</span>
                    <span className="category-count">{category.count}</span>
                  </div>
                  <div className="category-bar">
                    <div
                      className="category-fill"
                      style={{ width: `${category.percentage}%` }}
                    />
                  </div>
                  <span className="category-percentage">
                    {category.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Agent Performance Table */}
      <div className="performance-section">
        <div className="section-header">
          <h3>Agent Performance</h3>
          <button className="view-all-btn">View All Agents</button>
        </div>
        <div className="performance-table">
          <table>
            <thead>
              <tr>
                <th>Agent Name</th>
                <th>Emails Handled</th>
                <th>Avg Response Time</th>
                <th>Satisfaction Score</th>
                <th>Performance</th>
              </tr>
            </thead>
            <tbody>
              {agentPerformance.map((agent) => (
                <tr key={agent.name}>
                  <td className="agent-name">
                    <div className="agent-avatar">
                      {agent.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    {agent.name}
                  </td>
                  <td className="text-center">{agent.emails}</td>
                  <td className="text-center">{agent.avgTime}h</td>
                  <td className="text-center">
                    <span
                      className={`satisfaction-score ${agent.satisfaction >= 90 ? "high" : "medium"}`}
                    >
                      {agent.satisfaction}%
                    </span>
                  </td>
                  <td>
                    <div className="performance-bar">
                      <div
                        className="performance-fill"
                        style={{ width: `${agent.satisfaction}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="activity-section">
        <div className="section-header">
          <h3>Recent Activity</h3>
          <span className="activity-badge">Live</span>
        </div>
        <div className="activity-feed">
          <div className="activity-item">
            <div className="activity-icon success">
              <CheckCircleIcon />
            </div>
            <div className="activity-content">
              <p className="activity-text">
                Quote request #4892 completed by Sarah Wilson
              </p>
              <span className="activity-time">2 minutes ago</span>
            </div>
          </div>
          <div className="activity-item">
            <div className="activity-icon warning">
              <ExclamationTriangleIcon />
            </div>
            <div className="activity-content">
              <p className="activity-text">
                Urgent support ticket received from VMware@TDSynnex
              </p>
              <span className="activity-time">5 minutes ago</span>
            </div>
          </div>
          <div className="activity-item">
            <div className="activity-icon info">
              <UserGroupIcon />
            </div>
            <div className="activity-content">
              <p className="activity-text">
                John Miller assigned to handle Fortinet inquiry
              </p>
              <span className="activity-time">12 minutes ago</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
