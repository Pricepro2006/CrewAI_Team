import React, { useMemo } from 'react';
import { ChartBase, CHART_COLORS } from './ChartBase.js';

/**
 * Workflow Timeline Chart Component
 * Shows email processing trends over time with multiple metrics
 */
interface TimelineDataPoint {
  timestamp: string;
  totalEmails: number;
  completedEmails: number;
  criticalEmails: number;
  averageProcessingTime?: number;
}

interface WorkflowTimelineChartProps {
  data: TimelineDataPoint[];
  timeRange: '24h' | '7d' | '30d' | '90d';
  title?: string;
  showProcessingTime?: boolean;
  chartType?: 'line' | 'bar' | 'area';
  onClick?: (dataPoint: TimelineDataPoint) => void;
  refreshKey?: string | number;
  className?: string;
}

export const WorkflowTimelineChart: React.FC<WorkflowTimelineChartProps> = ({
  data,
  timeRange,
  title = 'Email Workflow Timeline',
  showProcessingTime = true,
  chartType = 'line',
  onClick,
  refreshKey,
  className = ''
}) => {
  // Process data for chart
  const chartData = useMemo(() => {
    const labels = data.map(point => {
      const date = new Date(point.timestamp);
      switch (timeRange) {
        case '24h':
          return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        case '7d':
          return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        case '30d':
        case '90d':
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        default:
          return date.toLocaleDateString('en-US');
      }
    });

    const datasets = [
      {
        label: 'Total Emails',
        data: data.map(point => point.totalEmails),
        backgroundColor: chartType === 'area' ? `${CHART_COLORS.primary}20` : CHART_COLORS.primary,
        borderColor: CHART_COLORS.primary,
        borderWidth: 2,
        fill: chartType === 'area',
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: CHART_COLORS.primary,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2
      },
      {
        label: 'Completed Emails',
        data: data.map(point => point.completedEmails),
        backgroundColor: chartType === 'area' ? `${CHART_COLORS.green}20` : CHART_COLORS.green,
        borderColor: CHART_COLORS.green,
        borderWidth: 2,
        fill: chartType === 'area',
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: CHART_COLORS.green,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2
      },
      {
        label: 'Critical Emails',
        data: data.map(point => point.criticalEmails),
        backgroundColor: chartType === 'area' ? `${CHART_COLORS.red}20` : CHART_COLORS.red,
        borderColor: CHART_COLORS.red,
        borderWidth: 2,
        fill: chartType === 'area',
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: CHART_COLORS.red,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2
      }
    ];

    // Add processing time dataset if enabled
    if (showProcessingTime && data.some(point => point.averageProcessingTime !== undefined)) {
      datasets.push({
        label: 'Avg Processing Time (min)',
        data: data.map(point => point.averageProcessingTime ? point.averageProcessingTime / 60000 : 0),
        backgroundColor: CHART_COLORS.secondary,
        borderColor: CHART_COLORS.secondary,
        borderWidth: 2,
        fill: false,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: CHART_COLORS.secondary,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        ...(chartType === 'line' ? { yAxisID: 'y1' } : {}) // Only add yAxisID for line charts
      } as any);
    }

    return { labels, datasets };
  }, [data, timeRange, chartType, showProcessingTime]);

  // Chart options
  const chartOptions = useMemo(() => {
    const baseOptions: any = {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `${title} - ${timeRange.toUpperCase()}`,
          font: {
            family: 'Inter, system-ui, sans-serif',
            size: 16,
            weight: '600'
          },
          color: '#1F2937',
          padding: { bottom: 20 }
        },
        legend: {
          position: 'top' as const,
          align: 'end' as const,
          labels: {
            usePointStyle: true,
            padding: 20,
            font: {
              family: 'Inter, system-ui, sans-serif',
              size: 11
            }
          }
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          callbacks: {
            title: function(tooltipItems: any[]) {
              if (tooltipItems.length > 0) {
                const dataIndex = tooltipItems[0].dataIndex;
                const originalData = data[dataIndex];
                if (originalData) {
                  return new Date(originalData.timestamp).toLocaleString();
                }
              }
              return '';
            },
            label: function(context: any) {
              const label = context.dataset.label || '';
              const value = context.parsed.y;
              
              if (label.includes('Processing Time')) {
                return `${label}: ${value.toFixed(2)} minutes`;
              }
              return `${label}: ${value} emails`;
            },
            afterBody: function(tooltipItems: any[]) {
              if (tooltipItems.length > 0) {
                const dataIndex = tooltipItems[0].dataIndex;
                const originalData = data[dataIndex];
                
                if (originalData) {
                  const completionRate = originalData.totalEmails > 0 
                    ? ((originalData.completedEmails / originalData.totalEmails) * 100).toFixed(1)
                    : '0';
                  
                  return [
                    '',
                    `Completion Rate: ${completionRate}%`,
                    `Critical Rate: ${originalData.totalEmails > 0 
                      ? ((originalData.criticalEmails / originalData.totalEmails) * 100).toFixed(1)
                      : '0'
                    }%`
                  ];
                }
              }
              return [];
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: getTimeAxisLabel(timeRange),
            font: {
              family: 'Inter, system-ui, sans-serif',
              size: 12,
              weight: '500'
            }
          },
          grid: {
            color: 'rgba(107, 114, 128, 0.1)'
          }
        },
        y: {
          type: 'linear' as const,
          display: true,
          position: 'left' as const,
          title: {
            display: true,
            text: 'Number of Emails',
            font: {
              family: 'Inter, system-ui, sans-serif',
              size: 12,
              weight: '500'
            }
          },
          grid: {
            color: 'rgba(107, 114, 128, 0.1)'
          },
          beginAtZero: true
        }
      },
      interaction: {
        mode: 'nearest' as const,
        axis: 'x' as const,
        intersect: false
      }
    };

    // Add secondary y-axis for processing time if needed
    if (showProcessingTime && data.some(point => point.averageProcessingTime !== undefined)) {
      baseOptions.scales.y1 = {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Processing Time (minutes)',
          font: {
            family: 'Inter, system-ui, sans-serif',
            size: 12,
            weight: '500'
          }
        },
        grid: {
          drawOnChartArea: false
        },
        beginAtZero: true
      };
    }

    return baseOptions;
  }, [title, timeRange, showProcessingTime, data]);

  // Handle chart click events
  const handleChartClick = (event: any, elements: any[]) => {
    if (onClick && elements.length > 0) {
      const elementIndex = elements[0].index;
      const dataPoint = data[elementIndex];
      if (dataPoint) {
        onClick(dataPoint);
      }
    }
  };

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (data.length === 0) return null;

    const totalEmails = data.reduce((sum, point) => sum + point.totalEmails, 0);
    const totalCompleted = data.reduce((sum, point) => sum + point.completedEmails, 0);
    const totalCritical = data.reduce((sum, point) => sum + point.criticalEmails, 0);
    
    const avgProcessingTime = showProcessingTime && data.some(point => point.averageProcessingTime)
      ? data
          .filter(point => point.averageProcessingTime !== undefined)
          .reduce((sum, point) => sum + (point.averageProcessingTime || 0), 0) / 
        data.filter(point => point.averageProcessingTime !== undefined).length
      : null;

    return {
      totalEmails,
      completionRate: totalEmails > 0 ? (totalCompleted / totalEmails * 100).toFixed(1) : '0',
      criticalRate: totalEmails > 0 ? (totalCritical / totalEmails * 100).toFixed(1) : '0',
      avgProcessingTime: avgProcessingTime ? (avgProcessingTime / 60000).toFixed(2) : null
    };
  }, [data, showProcessingTime]);

  return (
    <div className={`workflow-timeline-chart bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <div className="text-sm text-gray-500">
            {data.length} data points
          </div>
        </div>

        {/* Summary Statistics */}
        {summaryStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-600 font-medium">Total Emails</div>
              <div className="text-2xl font-bold text-blue-700">{summaryStats.totalEmails}</div>
            </div>
            
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <div className="text-sm text-green-600 font-medium">Completion Rate</div>
              <div className="text-2xl font-bold text-green-700">{summaryStats.completionRate}%</div>
            </div>
            
            <div className="bg-red-50 p-3 rounded-lg border border-red-200">
              <div className="text-sm text-red-600 font-medium">Critical Rate</div>
              <div className="text-2xl font-bold text-red-700">{summaryStats.criticalRate}%</div>
            </div>
            
            {summaryStats.avgProcessingTime && (
              <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                <div className="text-sm text-orange-600 font-medium">Avg Processing</div>
                <div className="text-2xl font-bold text-orange-700">{summaryStats.avgProcessingTime}m</div>
              </div>
            )}
          </div>
        )}
      </div>

      <ChartBase
        type={chartType === 'area' ? 'line' : chartType}
        data={chartData}
        options={chartOptions}
        onChartClick={handleChartClick}
        refreshKey={refreshKey}
        height={400}
        className="chart-responsive"
      />

      {/* Time Range Selector */}
      <div className="flex justify-center mt-4 space-x-2">
        {(['24h', '7d', '30d', '90d'] as const).map((range) => (
          <button
            key={range}
            onClick={() => {/* Time range switching would be handled by parent */}}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              timeRange === range 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {range.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
};

// Helper function to get time axis label
function getTimeAxisLabel(timeRange: string): string {
  switch (timeRange) {
    case '24h': return 'Time of Day';
    case '7d': return 'Day of Week';
    case '30d': return 'Date (Last 30 Days)';
    case '90d': return 'Date (Last 90 Days)';
    default: return 'Time';
  }
}

export default WorkflowTimelineChart;