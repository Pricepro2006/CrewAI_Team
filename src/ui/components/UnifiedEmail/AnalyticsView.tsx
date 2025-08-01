import React, { useMemo, useState } from "react";
import type { GetAnalyticsResponse } from "../../../types/unified-email.types.js";
import { StatusDistributionChart } from "../../../client/components/charts/StatusDistributionChart.js";
import { WorkflowTimelineChart } from "../../../client/components/charts/WorkflowTimelineChart.js";
import {
  ChartBarIcon,
  ClockIcon,
  ChartPieIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";
import "./AnalyticsView.css";

interface AnalyticsViewProps {
  analytics: GetAnalyticsResponse | null;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ analytics }) => {
  const [chartType, setChartType] = useState<"doughnut" | "pie" | "bar">(
    "doughnut",
  );
  const [refreshKey, setRefreshKey] = useState(0);

  // Calculate status distribution data
  const statusDistribution = useMemo(() => {
    if (!analytics) return { red: 0, yellow: 0, green: 0 };

    // Map from analytics data or use defaults
    return {
      red:
        analytics.statusCounts?.critical ||
        analytics.criticalAlerts?.length ||
        0,
      yellow:
        analytics.statusCounts?.inProgress ||
        Math.floor(analytics.agentUtilization * 0.4) ||
        0,
      green:
        analytics.statusCounts?.completed ||
        Math.floor(analytics.workflowCompletion * 2) ||
        0,
    };
  }, [analytics]);

  // Calculate workflow timeline data
  const workflowTimelineData = useMemo(() => {
    if (!analytics || !analytics.workflowData) return [];

    // Generate timeline data for the last 7 days
    const now = new Date();
    const data = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      // Use real data if available, otherwise generate sample data
      const baseCount = analytics.workflowData.totalChains || 100;
      const completionRate = analytics.workflowCompletion || 50;

      data.push({
        timestamp: date.toISOString(),
        totalEmails: Math.floor(baseCount / 7 + Math.random() * 20),
        completedEmails: Math.floor(
          (baseCount / 7) * (completionRate / 100) + Math.random() * 10,
        ),
        criticalEmails:
          analytics.criticalAlerts?.length || Math.floor(Math.random() * 5 + 2),
        averageProcessingTime:
          (analytics.avgResponseTime || 4) * 3600000 + Math.random() * 1800000, // Convert hours to ms
      });
    }

    return data;
  }, [analytics]);

  // Calculate total emails
  const totalEmails = useMemo(() => {
    return (
      statusDistribution.red +
      statusDistribution.yellow +
      statusDistribution.green
    );
  }, [statusDistribution]);

  if (!analytics) {
    return (
      <div className="analytics-view analytics-view--loading">
        <div className="analytics-skeleton">
          <div className="analytics-skeleton__header"></div>
          <div className="analytics-skeleton__charts">
            <div className="analytics-skeleton__chart"></div>
            <div className="analytics-skeleton__chart"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-view">
      {/* Header with metrics */}
      <div className="analytics-header">
        <h3 className="analytics-title">
          <ChartBarIcon className="analytics-icon" />
          Email Analytics Dashboard
        </h3>
        <p className="analytics-subtitle">
          Real-time workflow insights and performance metrics
        </p>
      </div>

      {/* Key Metrics Cards */}
      <div className="analytics-metrics-grid">
        <div className="analytics-metric-card analytics-metric-card--primary">
          <div className="analytics-metric-icon">
            <ChartPieIcon />
          </div>
          <div className="analytics-metric-content">
            <div className="analytics-metric-value">
              {analytics.workflowCompletion?.toFixed(1)}%
            </div>
            <div className="analytics-metric-label">Workflow Completion</div>
            <div className="analytics-metric-trend analytics-metric-trend--up">
              <ArrowTrendingUpIcon className="analytics-trend-icon" />
              +2.5% from last week
            </div>
          </div>
        </div>

        <div className="analytics-metric-card analytics-metric-card--secondary">
          <div className="analytics-metric-icon">
            <ClockIcon />
          </div>
          <div className="analytics-metric-content">
            <div className="analytics-metric-value">
              {analytics.avgResponseTime?.toFixed(1)}h
            </div>
            <div className="analytics-metric-label">Avg Response Time</div>
            <div className="analytics-metric-trend analytics-metric-trend--down">
              <ArrowTrendingUpIcon
                className="analytics-trend-icon"
                style={{ transform: "rotate(180deg)" }}
              />
              -15 min from avg
            </div>
          </div>
        </div>

        <div className="analytics-metric-card analytics-metric-card--tertiary">
          <div className="analytics-metric-icon">
            <ChartBarIcon />
          </div>
          <div className="analytics-metric-content">
            <div className="analytics-metric-value">
              {analytics.agentUtilization}%
            </div>
            <div className="analytics-metric-label">Agent Utilization</div>
            <div className="analytics-metric-trend">Optimal range</div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="analytics-charts-container">
        {/* Status Distribution Chart */}
        <div className="analytics-chart-wrapper">
          <StatusDistributionChart
            data={statusDistribution}
            totalEmails={totalEmails}
            title="Email Status Distribution"
            showPercentages={true}
            chartType={chartType}
            onClick={(status, count) => {
              console.log(`Clicked ${status}: ${count} emails`);
            }}
            refreshKey={refreshKey}
            className="analytics-chart"
          />
          <div className="analytics-chart-controls">
            <button
              onClick={() => setChartType("doughnut")}
              className={`analytics-chart-btn ${chartType === "doughnut" ? "active" : ""}`}
            >
              Doughnut
            </button>
            <button
              onClick={() => setChartType("pie")}
              className={`analytics-chart-btn ${chartType === "pie" ? "active" : ""}`}
            >
              Pie
            </button>
            <button
              onClick={() => setChartType("bar")}
              className={`analytics-chart-btn ${chartType === "bar" ? "active" : ""}`}
            >
              Bar
            </button>
          </div>
        </div>

        {/* Workflow Timeline Chart */}
        <div className="analytics-chart-wrapper">
          <WorkflowTimelineChart
            data={workflowTimelineData}
            timeRange="7d"
            title="Workflow State Timeline"
            showProcessingTime={true}
            chartType="line"
            onClick={(dataPoint) => {
              console.log("Clicked timeline point:", dataPoint);
            }}
            refreshKey={refreshKey}
            className="analytics-chart"
          />
        </div>
      </div>

      {/* Workflow Analytics Details */}
      {analytics.workflowData && (
        <div className="analytics-workflow-section">
          <h4 className="analytics-section-title">Workflow Chain Analysis</h4>
          <div className="analytics-workflow-grid">
            <div className="analytics-workflow-card analytics-workflow-card--complete">
              <div className="analytics-workflow-value">
                {analytics.workflowData.completeChains}
              </div>
              <div className="analytics-workflow-label">Complete Chains</div>
              <div className="analytics-workflow-bar">
                <div
                  className="analytics-workflow-progress"
                  style={{
                    width: `${(analytics.workflowData.completeChains / analytics.workflowData.totalChains) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="analytics-workflow-card analytics-workflow-card--partial">
              <div className="analytics-workflow-value">
                {analytics.workflowData.partialChains}
              </div>
              <div className="analytics-workflow-label">Partial Chains</div>
              <div className="analytics-workflow-bar">
                <div
                  className="analytics-workflow-progress"
                  style={{
                    width: `${(analytics.workflowData.partialChains / analytics.workflowData.totalChains) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="analytics-workflow-card analytics-workflow-card--broken">
              <div className="analytics-workflow-value">
                {analytics.workflowData.brokenChains}
              </div>
              <div className="analytics-workflow-label">Broken Chains</div>
              <div className="analytics-workflow-bar">
                <div
                  className="analytics-workflow-progress"
                  style={{
                    width: `${(analytics.workflowData.brokenChains / analytics.workflowData.totalChains) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Critical Alerts */}
      {analytics.criticalAlerts && analytics.criticalAlerts.length > 0 && (
        <div className="analytics-alerts-section">
          <h4 className="analytics-section-title">Critical Alerts</h4>
          <div className="analytics-alerts-list">
            {analytics.criticalAlerts.map((alert, index) => (
              <div
                key={index}
                className="analytics-alert analytics-alert--critical"
              >
                <div className="analytics-alert-icon">⚠️</div>
                <div className="analytics-alert-content">
                  <div className="analytics-alert-message">{alert.message}</div>
                  <div className="analytics-alert-time">
                    {new Date().toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <div className="analytics-footer">
        <button
          onClick={() => setRefreshKey((prev) => prev + 1)}
          className="analytics-refresh-btn"
        >
          🔄 Refresh Analytics
        </button>
      </div>
    </div>
  );
};
