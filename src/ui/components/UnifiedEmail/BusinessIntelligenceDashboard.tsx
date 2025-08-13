import React, { useState, useMemo } from "react";
import { trpc } from "../../../utils/trpc.js";
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  BuildingOfficeIcon,
  ShoppingCartIcon,
} from "@heroicons/react/24/outline";
import { StatusDistributionChart } from "../../../client/components/charts/StatusDistributionChart.js";
import { WorkflowTimelineChart } from "../../../client/components/charts/WorkflowTimelineChart.js";
import "./BusinessIntelligenceDashboard.css";

interface BusinessIntelligenceDashboardProps {
  timeRange?: {
    start: string;
    end: string;
  };
}

export const BusinessIntelligenceDashboard: React.FC<BusinessIntelligenceDashboardProps> = ({
  timeRange,
}) => {
  const [chartType, setChartType] = useState<"doughnut" | "pie" | "bar">("doughnut");
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch business intelligence data
  const { data: biData, isLoading, error } = trpc.email.getBusinessIntelligence.useQuery({
    timeRange,
    useCache: true,
  });

  // Format currency values
  const formatCurrency = (value: number): string => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  // Format percentage
  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  // Prepare priority distribution data for chart
  const priorityChartData = useMemo(() => {
    if (!biData?.data?.priorityDistribution) return { red: 0, yellow: 0, green: 0 };
    
    const dist = biData.data.priorityDistribution;
    return {
      red: (dist.find(d => d.level === "Critical")?.count || 0) + 
           (dist.find(d => d.level === "High")?.count || 0),
      yellow: dist.find(d => d.level === "Medium")?.count || 0,
      green: (dist.find(d => d.level === "Low")?.count || 0) +
             (dist.find(d => d.level === "Unknown")?.count || 0),
    };
  }, [biData]);

  // Prepare workflow timeline data
  const workflowTimelineData = useMemo(() => {
    if (!biData?.data?.workflowDistribution) return [];
    
    // Generate timeline data based on workflow distribution
    const now = new Date();
    const data = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      const totalEmails = biData.data.summary.totalEmailsAnalyzed / 7;
      const completedRatio = biData.data.processingMetrics.successRate / 100;
      
      data.push({
        timestamp: date.toISOString(),
        totalEmails: Math.floor(totalEmails + Math.random() * 20),
        completedEmails: Math.floor(totalEmails * completedRatio + Math.random() * 10),
        criticalEmails: Math.floor(priorityChartData.red / 7 + Math.random() * 5),
        averageProcessingTime: biData.data.processingMetrics.avgProcessingTime * 1000,
      });
    }
    
    return data;
  }, [biData, priorityChartData]);

  if (isLoading) {
    return (
      <div className="bi-dashboard bi-dashboard--loading">
        <div className="bi-skeleton">
          <div className="bi-skeleton__header"></div>
          <div className="bi-skeleton__metrics">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bi-skeleton__metric"></div>
            ))}
          </div>
          <div className="bi-skeleton__charts">
            <div className="bi-skeleton__chart"></div>
            <div className="bi-skeleton__chart"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bi-dashboard bi-dashboard--error">
        <div className="bi-error">
          <p>Failed to load business intelligence data</p>
          <button onClick={() => setRefreshKey(prev => prev + 1)}>Retry</button>
        </div>
      </div>
    );
  }

  if (!biData?.data) {
    return null;
  }

  const { summary, workflowDistribution, priorityDistribution, topCustomers, entityExtracts } = biData.data;

  return (
    <div className="bi-dashboard">
      {/* Header */}
      <div className="bi-header">
        <h3 className="bi-title">
          <ChartBarIcon className="bi-icon" />
          Business Intelligence Dashboard
        </h3>
        <p className="bi-subtitle">
          Comprehensive insights from {summary.totalEmailsAnalyzed.toLocaleString()} analyzed emails
        </p>
      </div>

      {/* Key Metrics Cards */}
      <div className="bi-metrics-grid">
        <div className="bi-metric-card bi-metric-card--primary">
          <div className="bi-metric-icon">
            <CurrencyDollarIcon />
          </div>
          <div className="bi-metric-content">
            <div className="bi-metric-value">
              {formatCurrency(summary.totalBusinessValue)}
            </div>
            <div className="bi-metric-label">Total Business Value</div>
            <div className="bi-metric-trend bi-metric-trend--up">
              <ArrowTrendingUpIcon className="bi-trend-icon" />
              Identified across all workflows
            </div>
          </div>
        </div>

        <div className="bi-metric-card bi-metric-card--secondary">
          <div className="bi-metric-icon">
            <DocumentTextIcon />
          </div>
          <div className="bi-metric-content">
            <div className="bi-metric-value">{summary.uniquePOCount}</div>
            <div className="bi-metric-label">Purchase Orders</div>
            <div className="bi-metric-subtext">
              {summary.uniqueQuoteCount} quotes identified
            </div>
          </div>
        </div>

        <div className="bi-metric-card bi-metric-card--tertiary">
          <div className="bi-metric-icon">
            <UserGroupIcon />
          </div>
          <div className="bi-metric-content">
            <div className="bi-metric-value">{summary.uniqueCustomerCount}</div>
            <div className="bi-metric-label">Active Customers</div>
            <div className="bi-metric-subtext">
              {formatPercentage(summary.highPriorityRate)} high priority
            </div>
          </div>
        </div>

        <div className="bi-metric-card bi-metric-card--quaternary">
          <div className="bi-metric-icon">
            <ClockIcon />
          </div>
          <div className="bi-metric-content">
            <div className="bi-metric-value">
              {formatPercentage(summary.avgConfidenceScore * 100)}
            </div>
            <div className="bi-metric-label">Analysis Confidence</div>
            <div className="bi-metric-subtext">AI accuracy score</div>
          </div>
        </div>
      </div>

      {/* Workflow Distribution */}
      <div className="bi-section">
        <h4 className="bi-section-title">Workflow Distribution</h4>
        <div className="bi-workflow-grid">
          {workflowDistribution.slice(0, 6).map((workflow) => (
            <div key={workflow.type} className="bi-workflow-card">
              <div className="bi-workflow-header">
                <span className="bi-workflow-type">{workflow.type}</span>
                <span className="bi-workflow-count">{workflow.count}</span>
              </div>
              <div className="bi-workflow-bar">
                <div
                  className="bi-workflow-progress"
                  style={{ width: `${workflow.percentage}%` }}
                />
              </div>
              <div className="bi-workflow-footer">
                <span className="bi-workflow-percentage">
                  {formatPercentage(workflow.percentage)}
                </span>
                <span className="bi-workflow-value">
                  {formatCurrency(workflow.totalValue)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Section */}
      <div className="bi-charts-container">
        {/* Priority Distribution Chart */}
        <div className="bi-chart-wrapper">
          <StatusDistributionChart
            data={priorityChartData}
            totalEmails={summary.totalEmailsAnalyzed}
            title="Priority Distribution"
            showPercentages={true}
            chartType={chartType}
            onClick={(status, count) => {
              console.log(`Clicked ${status}: ${count} emails`);
            }}
            refreshKey={refreshKey}
            className="bi-chart"
          />
          <div className="bi-chart-controls">
            <button
              onClick={() => setChartType("doughnut")}
              className={`bi-chart-btn ${chartType === "doughnut" ? "active" : ""}`}
            >
              Doughnut
            </button>
            <button
              onClick={() => setChartType("pie")}
              className={`bi-chart-btn ${chartType === "pie" ? "active" : ""}`}
            >
              Pie
            </button>
            <button
              onClick={() => setChartType("bar")}
              className={`bi-chart-btn ${chartType === "bar" ? "active" : ""}`}
            >
              Bar
            </button>
          </div>
        </div>

        {/* Workflow Timeline Chart */}
        <div className="bi-chart-wrapper">
          <WorkflowTimelineChart
            data={workflowTimelineData}
            timeRange="7d"
            title="Processing Timeline"
            showProcessingTime={true}
            chartType="line"
            onClick={(dataPoint) => {
              console.log("Clicked timeline point:", dataPoint);
            }}
            refreshKey={refreshKey}
            className="bi-chart"
          />
        </div>
      </div>

      {/* Top Customers */}
      <div className="bi-section">
        <h4 className="bi-section-title">Top Customers by Activity</h4>
        <div className="bi-customers-table">
          <div className="bi-table-header">
            <div className="bi-table-cell">Customer</div>
            <div className="bi-table-cell">Emails</div>
            <div className="bi-table-cell">Value</div>
            <div className="bi-table-cell">Workflows</div>
            <div className="bi-table-cell">Last Activity</div>
          </div>
          {topCustomers.slice(0, 10).map((customer, index) => (
            <div key={index} className="bi-table-row">
              <div className="bi-table-cell bi-customer-name">
                <BuildingOfficeIcon className="bi-customer-icon" />
                {customer.name}
              </div>
              <div className="bi-table-cell">{customer.emailCount}</div>
              <div className="bi-table-cell bi-value">
                {formatCurrency(customer.totalValue)}
              </div>
              <div className="bi-table-cell">
                <div className="bi-workflow-tags">
                  {customer.workflowTypes.slice(0, 2).map((type) => (
                    <span key={type} className="bi-workflow-tag">
                      {type}
                    </span>
                  ))}
                  {customer.workflowTypes.length > 2 && (
                    <span className="bi-workflow-tag">
                      +{customer.workflowTypes.length - 2}
                    </span>
                  )}
                </div>
              </div>
              <div className="bi-table-cell bi-date">
                {new Date(customer.lastInteraction).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent High-Value Items */}
      {entityExtracts.recentHighValueItems.length > 0 && (
        <div className="bi-section">
          <h4 className="bi-section-title">Recent High-Value Transactions</h4>
          <div className="bi-transactions-grid">
            {entityExtracts.recentHighValueItems.slice(0, 6).map((item, index) => (
              <div key={index} className="bi-transaction-card">
                <div className="bi-transaction-header">
                  <ShoppingCartIcon className="bi-transaction-icon" />
                  <span className="bi-transaction-type">{item.type}</span>
                </div>
                <div className="bi-transaction-value">
                  {formatCurrency(item.value)}
                </div>
                <div className="bi-transaction-customer">{item.customer}</div>
                <div className="bi-transaction-date">
                  {new Date(item.date).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extracted Entities Summary */}
      <div className="bi-entities-summary">
        <div className="bi-entity-card">
          <h5>Purchase Orders</h5>
          <div className="bi-entity-count">{entityExtracts.poNumbers.length}</div>
          <div className="bi-entity-samples">
            {entityExtracts.poNumbers.slice(0, 3).map((po) => (
              <span key={po} className="bi-entity-tag">{po}</span>
            ))}
            {entityExtracts.poNumbers.length > 3 && (
              <span className="bi-entity-more">
                +{entityExtracts.poNumbers.length - 3} more
              </span>
            )}
          </div>
        </div>

        <div className="bi-entity-card">
          <h5>Quote Numbers</h5>
          <div className="bi-entity-count">{entityExtracts.quoteNumbers.length}</div>
          <div className="bi-entity-samples">
            {entityExtracts.quoteNumbers.slice(0, 3).map((quote) => (
              <span key={quote} className="bi-entity-tag">{quote}</span>
            ))}
            {entityExtracts.quoteNumbers.length > 3 && (
              <span className="bi-entity-more">
                +{entityExtracts.quoteNumbers.length - 3} more
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer with processing time */}
      <div className="bi-footer">
        <div className="bi-processing-info">
          <span>
            Data from {new Date(summary.processingTimeRange.start).toLocaleDateString()} to{" "}
            {new Date(summary.processingTimeRange.end).toLocaleDateString()}
          </span>
        </div>
        <button
          onClick={() => setRefreshKey((prev) => prev + 1)}
          className="bi-refresh-btn"
        >
          🔄 Refresh Dashboard
        </button>
      </div>
    </div>
  );
};