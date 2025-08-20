import React from "react";
import {
  ExclamationTriangleIcon,
  ChartPieIcon,
  ArrowPathIcon,
  DocumentMagnifyingGlassIcon,
  LightBulbIcon,
} from "@heroicons/react/24/outline";
import { Card } from "../../../components/ui/card.js";
import { api } from "../../../lib/trpc.js";

interface WorkflowAnalyticsProps {
  className?: string;
}

interface WorkflowChainData {
  completeChains: number;
  partialChains: number;
  brokenChains: number;
  totalChains: number;
  workflowTypes: Array<{
    type: string;
    count: number;
    completePercentage: number;
  }>;
  bottlenecks: Array<{
    stage: string;
    count: number;
    avgDelayHours: number;
  }>;
  recommendations: Array<{
    priority: "critical" | "high" | "medium";
    title: string;
    description: string;
    impact: string;
  }>;
}

export const WorkflowAnalytics: React.FC<WorkflowAnalyticsProps> = ({
  className,
}) => {
  const { data, isLoading } = (api.emails as any).getStats.useQuery();

  if (isLoading) {
    return (
      <div className="workflow-analytics workflow-analytics--loading">
        <div className="loading-spinner" />
        <p>Analyzing workflow patterns...</p>
      </div>
    );
  }

  const workflowData = (data?.data || data) as WorkflowChainData;

  // Calculate percentages
  const completePercentage = (
    (workflowData.completeChains / workflowData.totalChains) *
    100
  ).toFixed(1);
  const partialPercentage = (
    (workflowData.partialChains / workflowData.totalChains) *
    100
  ).toFixed(1);
  const brokenPercentage = (
    (workflowData.brokenChains / workflowData.totalChains) *
    100
  ).toFixed(1);

  return (
    <div className={`workflow-analytics ${className || ""}`}>
      {/* Critical Alert Header */}
      <div className="workflow-analytics__header">
        <div className="workflow-analytics__alert">
          <ExclamationTriangleIcon className="workflow-analytics__alert-icon" />
          <div>
            <h2>Critical Workflow Issue Detected</h2>
            <p>
              Only <strong>{completePercentage}%</strong> of workflows have
              complete chains (Start → In Progress → Completion). This
              significantly impacts visibility and tracking.
            </p>
          </div>
        </div>
      </div>

      <div className="workflow-analytics__grid">
        {/* Chain Completeness Overview */}
        <Card className="workflow-analytics__card workflow-analytics__card--overview">
          <div className="card-header">
            <ChartPieIcon className="card-icon" />
            <h3>Workflow Chain Analysis</h3>
          </div>
          <div className="card-content">
            <div className="workflow-stats">
              <div className="workflow-stat workflow-stat--complete">
                <div className="workflow-stat__value">
                  {completePercentage}%
                </div>
                <div className="workflow-stat__label">Complete Chains</div>
                <div className="workflow-stat__count">
                  ({workflowData?.completeChains?.toLocaleString()} workflows)
                </div>
              </div>
              <div className="workflow-stat workflow-stat--partial">
                <div className="workflow-stat__value">{partialPercentage}%</div>
                <div className="workflow-stat__label">Partial Chains</div>
                <div className="workflow-stat__count">
                  ({workflowData?.partialChains?.toLocaleString()} workflows)
                </div>
              </div>
              <div className="workflow-stat workflow-stat--broken">
                <div className="workflow-stat__value">{brokenPercentage}%</div>
                <div className="workflow-stat__label">Broken Chains</div>
                <div className="workflow-stat__count">
                  ({workflowData?.brokenChains?.toLocaleString()} workflows)
                </div>
              </div>
            </div>

            {/* Visual representation */}
            <div className="workflow-bar">
              <div
                className="workflow-bar__segment workflow-bar__segment--complete"
                style={{ width: `${completePercentage}%` }}
                title={`Complete: ${completePercentage}%`}
              />
              <div
                className="workflow-bar__segment workflow-bar__segment--partial"
                style={{ width: `${partialPercentage}%` }}
                title={`Partial: ${partialPercentage}%`}
              />
              <div
                className="workflow-bar__segment workflow-bar__segment--broken"
                style={{ width: `${brokenPercentage}%` }}
                title={`Broken: ${brokenPercentage}%`}
              />
            </div>
          </div>
        </Card>

        {/* Workflow Types Breakdown */}
        <Card className="workflow-analytics__card">
          <div className="card-header">
            <DocumentMagnifyingGlassIcon className="card-icon" />
            <h3>Workflow Types</h3>
          </div>
          <div className="card-content">
            <div className="workflow-types">
              {workflowData?.workflowTypes?.map((type: any) => (
                <div key={type.type} className="workflow-type">
                  <div className="workflow-type__header">
                    <span className="workflow-type__name">{type.type}</span>
                    <span className="workflow-type__count">
                      {type?.count?.toLocaleString()}
                    </span>
                  </div>
                  <div className="workflow-type__completion">
                    <div className="workflow-type__bar">
                      <div
                        className="workflow-type__bar-fill"
                        style={{ width: `${type.completePercentage}%` }}
                      />
                    </div>
                    <span className="workflow-type__percentage">
                      {type?.completePercentage?.toFixed(1)}% complete
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Bottleneck Analysis */}
        <Card className="workflow-analytics__card">
          <div className="card-header">
            <ArrowPathIcon className="card-icon" />
            <h3>Process Bottlenecks</h3>
          </div>
          <div className="card-content">
            <div className="bottlenecks">
              {workflowData?.bottlenecks?.map((bottleneck: any) => (
                <div key={bottleneck.stage} className="bottleneck">
                  <div className="bottleneck__info">
                    <span className="bottleneck__stage">
                      {bottleneck.stage}
                    </span>
                    <span className="bottleneck__count">
                      {bottleneck?.count?.toLocaleString()} stuck
                    </span>
                  </div>
                  <div className="bottleneck__delay">
                    <span className="bottleneck__delay-label">Avg delay:</span>
                    <span className="bottleneck__delay-value">
                      {bottleneck?.avgDelayHours?.toFixed(1)}h
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Recommendations */}
        <Card className="workflow-analytics__card workflow-analytics__card--recommendations">
          <div className="card-header">
            <LightBulbIcon className="card-icon" />
            <h3>Critical Recommendations</h3>
          </div>
          <div className="card-content">
            <div className="recommendations">
              {workflowData.recommendations
                .filter((rec: any) => rec.priority === "critical")
                .map((rec, index) => (
                  <div
                    key={index}
                    className={`recommendation recommendation--${rec.priority}`}
                  >
                    <div className="recommendation__header">
                      <span className="recommendation__priority">
                        {rec?.priority?.toUpperCase()}
                      </span>
                      <h4>{rec.title}</h4>
                    </div>
                    <p className="recommendation__description">
                      {rec.description}
                    </p>
                    <div className="recommendation__impact">
                      <strong>Expected Impact:</strong> {rec.impact}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Detailed Insights */}
      <div className="workflow-analytics__insights">
        <h3>Key Insights</h3>
        <div className="insights-grid">
          <div className="insight">
            <h4>Root Causes</h4>
            <ul>
              <li>
                Multi-channel communication causing workflow fragmentation
              </li>
              <li>Inconsistent reference numbers across email chains</li>
              <li>Manual processes outside email system</li>
              <li>Lack of automated workflow tracking</li>
            </ul>
          </div>
          <div className="insight">
            <h4>Business Impact</h4>
            <ul>
              <li>Reduced visibility into order status</li>
              <li>Increased response times</li>
              <li>Difficulty tracking customer requests</li>
              <li>Manual effort to reconstruct workflows</li>
            </ul>
          </div>
          <div className="insight">
            <h4>Quick Wins</h4>
            <ul>
              <li>Implement unified reference number system</li>
              <li>Create email templates with tracking fields</li>
              <li>Set up automated status updates</li>
              <li>Train team on workflow best practices</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
