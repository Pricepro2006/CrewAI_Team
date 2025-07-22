import React from "react";
import type { GetAnalyticsResponse } from "@/types/unified-email.types";

interface AnalyticsViewProps {
  analytics: GetAnalyticsResponse | null;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ analytics }) => {
  if (!analytics) {
    return <div>Loading analytics...</div>;
  }

  return (
    <div className="analytics-view">
      <h3>Analytics Overview</h3>

      <div className="analytics-grid">
        <div className="analytics-card">
          <h4>Workflow Completion</h4>
          <div className="metric">
            {analytics.workflowCompletion?.toFixed(1)}%
          </div>
        </div>

        <div className="analytics-card">
          <h4>Avg Response Time</h4>
          <div className="metric">{analytics.avgResponseTime?.toFixed(1)}h</div>
        </div>

        <div className="analytics-card">
          <h4>Agent Utilization</h4>
          <div className="metric">{analytics.agentUtilization}%</div>
        </div>
      </div>

      {analytics.criticalAlerts && analytics.criticalAlerts.length > 0 && (
        <div className="critical-alerts">
          <h4>Critical Alerts</h4>
          {analytics.criticalAlerts.map((alert, index) => (
            <div key={index} className="alert">
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {analytics.workflowData && (
        <div className="workflow-analytics">
          <h4>Workflow Analytics</h4>
          <div className="workflow-stats">
            <div>Complete Chains: {analytics.workflowData.completeChains}</div>
            <div>Partial Chains: {analytics.workflowData.partialChains}</div>
            <div>Broken Chains: {analytics.workflowData.brokenChains}</div>
            <div>Total Chains: {analytics.workflowData.totalChains}</div>
          </div>
        </div>
      )}
    </div>
  );
};
