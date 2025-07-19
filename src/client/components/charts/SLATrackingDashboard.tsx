import React, { useMemo } from 'react';
import { ChartBase, CHART_COLORS } from './ChartBase';

/**
 * SLA Tracking Dashboard Component
 * Comprehensive SLA monitoring with multiple visualizations
 */
interface SLAData {
  onTrack: number;
  atRisk: number;
  overdue: number;
  totalItems: number;
}

interface SLABreakdown {
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  slaThreshold: number; // in hours
  onTrack: number;
  atRisk: number;
  overdue: number;
  averageTime: number; // in milliseconds
}

interface SLATrackingDashboardProps {
  overallSLA: SLAData;
  priorityBreakdown: SLABreakdown[];
  title?: string;
  showTrends?: boolean;
  complianceTarget?: number; // Target compliance percentage (e.g., 95)
  refreshKey?: string | number;
  onDrillDown?: (priority: string, status: 'onTrack' | 'atRisk' | 'overdue') => void;
  className?: string;
}

export const SLATrackingDashboard: React.FC<SLATrackingDashboardProps> = ({
  overallSLA,
  priorityBreakdown,
  title = 'SLA Tracking Dashboard',
  showTrends = true,
  complianceTarget = 95,
  refreshKey,
  onDrillDown,
  className = ''
}) => {
  // Calculate overall compliance metrics
  const overallMetrics = useMemo(() => {
    const compliance = overallSLA.totalItems > 0 
      ? ((overallSLA.onTrack / overallSLA.totalItems) * 100).toFixed(1)
      : '0';
    
    const atRiskRate = overallSLA.totalItems > 0 
      ? ((overallSLA.atRisk / overallSLA.totalItems) * 100).toFixed(1)
      : '0';
    
    const overdueRate = overallSLA.totalItems > 0 
      ? ((overallSLA.overdue / overallSLA.totalItems) * 100).toFixed(1)
      : '0';

    const isCompliant = parseFloat(compliance) >= complianceTarget;

    return {
      compliance: parseFloat(compliance),
      complianceText: compliance,
      atRiskRate,
      overdueRate,
      isCompliant,
      status: isCompliant ? 'Compliant' : 'Non-Compliant'
    };
  }, [overallSLA, complianceTarget]);

  // Overall SLA chart data
  const overallChartData = useMemo(() => ({
    labels: ['On Track', 'At Risk', 'Overdue'],
    datasets: [{
      label: 'SLA Status',
      data: [overallSLA.onTrack, overallSLA.atRisk, overallSLA.overdue],
      backgroundColor: [CHART_COLORS.green, CHART_COLORS.yellow, CHART_COLORS.red],
      borderColor: [CHART_COLORS.green, CHART_COLORS.yellow, CHART_COLORS.red],
      borderWidth: 2,
      hoverBackgroundColor: [CHART_COLORS.green, CHART_COLORS.yellow, CHART_COLORS.red],
      hoverBorderWidth: 3
    }]
  }), [overallSLA]);

  // Priority breakdown chart data
  const priorityChartData = useMemo(() => {
    const priorities = priorityBreakdown.map(item => item.priority);
    
    return {
      labels: priorities,
      datasets: [
        {
          label: 'On Track',
          data: priorityBreakdown.map(item => item.onTrack),
          backgroundColor: `${CHART_COLORS.green}CC`,
          borderColor: CHART_COLORS.green,
          borderWidth: 1,
          stack: 'stack0'
        },
        {
          label: 'At Risk',
          data: priorityBreakdown.map(item => item.atRisk),
          backgroundColor: `${CHART_COLORS.yellow}CC`,
          borderColor: CHART_COLORS.yellow,
          borderWidth: 1,
          stack: 'stack0'
        },
        {
          label: 'Overdue',
          data: priorityBreakdown.map(item => item.overdue),
          backgroundColor: `${CHART_COLORS.red}CC`,
          borderColor: CHART_COLORS.red,
          borderWidth: 1,
          stack: 'stack0'
        }
      ]
    };
  }, [priorityBreakdown]);

  // Compliance gauge data (using doughnut chart)
  const complianceGaugeData = useMemo(() => {
    const compliance = overallMetrics.compliance;
    const remaining = 100 - compliance;
    
    return {
      labels: ['Compliant', 'Non-Compliant'],
      datasets: [{
        data: [compliance, remaining],
        backgroundColor: [
          compliance >= complianceTarget ? CHART_COLORS.green : CHART_COLORS.yellow,
          '#E5E7EB'
        ],
        borderColor: [
          compliance >= complianceTarget ? CHART_COLORS.green : CHART_COLORS.yellow,
          '#E5E7EB'
        ],
        borderWidth: 2,
        circumference: 180,
        rotation: 270,
        cutout: '75%'
      }]
    };
  }, [overallMetrics.compliance, complianceTarget]);

  // Chart options
  const chartOptions = {
    overall: {
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: {
            padding: 20,
            usePointStyle: true
          }
        },
        tooltip: {
          callbacks: {
            label: function(context: any) {
              const value = context.raw;
              const total = overallSLA.totalItems;
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
              return `${context.label}: ${value} (${percentage}%)`;
            }
          }
        }
      }
    },
    
    priority: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top' as const
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          callbacks: {
            title: function(tooltipItems: any[]) {
              return `${tooltipItems[0].label} Priority`;
            },
            afterBody: function(tooltipItems: any[]) {
              if (tooltipItems.length > 0) {
                const priorityIndex = tooltipItems[0].dataIndex;
                const priority = priorityBreakdown[priorityIndex];
                const total = priority.onTrack + priority.atRisk + priority.overdue;
                const avgHours = (priority.averageTime / (1000 * 60 * 60)).toFixed(1);
                
                return [
                  '',
                  `Total: ${total} items`,
                  `SLA Threshold: ${priority.slaThreshold}h`,
                  `Avg Processing: ${avgHours}h`
                ];
              }
              return [];
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          title: {
            display: true,
            text: 'Priority Level'
          }
        },
        y: {
          stacked: true,
          title: {
            display: true,
            text: 'Number of Items'
          },
          beginAtZero: true
        }
      }
    },

    gauge: {
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: false
        }
      },
      maintainAspectRatio: false
    }
  };

  // Handle chart clicks for drill-down
  const handleOverallClick = (event: any, elements: any[]) => {
    if (onDrillDown && elements.length > 0) {
      const elementIndex = elements[0].index;
      const statuses = ['onTrack', 'atRisk', 'overdue'] as const;
      onDrillDown('All', statuses[elementIndex]);
    }
  };

  const handlePriorityClick = (event: any, elements: any[]) => {
    if (onDrillDown && elements.length > 0) {
      const elementIndex = elements[0].dataIndex;
      const datasetIndex = elements[0].datasetIndex;
      const priority = priorityBreakdown[elementIndex].priority;
      const statuses = ['onTrack', 'atRisk', 'overdue'] as const;
      onDrillDown(priority, statuses[datasetIndex]);
    }
  };

  return (
    <div className={`sla-tracking-dashboard bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <div className="flex items-center space-x-4">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              overallMetrics.isCompliant 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {overallMetrics.status}
            </div>
            <div className="text-sm text-gray-500">
              Target: {complianceTarget}%
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="text-sm text-blue-600 font-medium">Total Items</div>
          <div className="text-3xl font-bold text-blue-700">{overallSLA.totalItems}</div>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="text-sm text-green-600 font-medium">Compliance</div>
          <div className="text-3xl font-bold text-green-700">{overallMetrics.complianceText}%</div>
          <div className="text-xs text-green-600">{overallSLA.onTrack} on track</div>
        </div>
        
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <div className="text-sm text-yellow-600 font-medium">At Risk</div>
          <div className="text-3xl font-bold text-yellow-700">{overallMetrics.atRiskRate}%</div>
          <div className="text-xs text-yellow-600">{overallSLA.atRisk} items</div>
        </div>
        
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="text-sm text-red-600 font-medium">Overdue</div>
          <div className="text-3xl font-bold text-red-700">{overallMetrics.overdueRate}%</div>
          <div className="text-xs text-red-600">{overallSLA.overdue} items</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overall SLA Distribution */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Overall Distribution</h4>
          <ChartBase
            type="doughnut"
            data={overallChartData}
            options={chartOptions.overall}
            onChartClick={handleOverallClick}
            height={250}
            refreshKey={refreshKey}
          />
        </div>

        {/* Compliance Gauge */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Compliance Gauge</h4>
          <div style={{ height: '200px', position: 'relative' }}>
            <ChartBase
              type="doughnut"
              data={complianceGaugeData}
              options={chartOptions.gauge}
              height={200}
              refreshKey={refreshKey}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {overallMetrics.complianceText}%
                </div>
                <div className="text-sm text-gray-600">Compliance</div>
              </div>
            </div>
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-md font-semibold text-gray-900 mb-4">By Priority</h4>
          <ChartBase
            type="bar"
            data={priorityChartData}
            options={chartOptions.priority}
            onChartClick={handlePriorityClick}
            height={250}
            refreshKey={refreshKey}
          />
        </div>
      </div>

      {/* Detailed Priority Table */}
      <div className="mt-8">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Priority Breakdown Details</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SLA Threshold
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  On Track
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  At Risk
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Overdue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Processing
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Compliance %
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {priorityBreakdown.map((item) => {
                const total = item.onTrack + item.atRisk + item.overdue;
                const compliance = total > 0 ? ((item.onTrack / total) * 100).toFixed(1) : '0';
                const avgHours = (item.averageTime / (1000 * 60 * 60)).toFixed(1);
                
                return (
                  <tr key={item.priority} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        item.priority === 'Critical' ? 'bg-red-100 text-red-800' :
                        item.priority === 'High' ? 'bg-orange-100 text-orange-800' :
                        item.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {item.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.slaThreshold}h
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                      {item.onTrack}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600 font-medium">
                      {item.atRisk}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                      {item.overdue}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {avgHours}h
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${
                        parseFloat(compliance) >= complianceTarget ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {compliance}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Items */}
      {overallSLA.overdue > 0 && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Immediate Action Required
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>
                  You have {overallSLA.overdue} overdue items that require immediate attention.
                  <button 
                    onClick={() => onDrillDown && onDrillDown('All', 'overdue')}
                    className="ml-2 font-medium text-red-800 underline hover:text-red-900"
                  >
                    View details →
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SLATrackingDashboard;