import React, { useMemo } from "react";
import { ChartBase, CHART_COLORS, CHART_CONFIGS } from "./ChartBase.js";

/**
 * Status Distribution Chart Component
 * Shows email status breakdown (Red/Yellow/Green) with interactive features
 */
interface StatusDistributionChartProps {
  data: {
    red: number;
    yellow: number;
    green: number;
  };
  totalEmails: number;
  title?: string;
  showPercentages?: boolean;
  chartType?: "doughnut" | "pie" | "bar";
  onClick?: (status: "red" | "yellow" | "green", count: number) => void;
  refreshKey?: string | number;
  className?: string;
}

export const StatusDistributionChart: React.FC<
  StatusDistributionChartProps
> = ({
  data,
  totalEmails,
  title = "Email Status Distribution",
  showPercentages = true,
  chartType = "doughnut",
  onClick,
  refreshKey,
  className = "",
}) => {
  // Calculate percentages and format labels
  const chartData = useMemo(() => {
    const statusData = [
      {
        label: "Critical (Red)",
        value: data.red,
        color: CHART_COLORS.red,
        key: "red" as const,
      },
      {
        label: "In Progress (Yellow)",
        value: data.yellow,
        color: CHART_COLORS.yellow,
        key: "yellow" as const,
      },
      {
        label: "Completed (Green)",
        value: data.green,
        color: CHART_COLORS.green,
        key: "green" as const,
      },
    ];

    const labels = statusData ? statusData.map((item: any) => {
      if (showPercentages && totalEmails > 0) {
        const percentage = ((item.value / totalEmails) * 100).toFixed(1);
        return `${item.label} (${percentage}%)`;
      }
      return item.label;
    }) : [];

    return {
      labels,
      datasets: [
        {
          label: "Email Count",
          data: statusData ? statusData.map((item: any) => item.value) : [],
          backgroundColor:
            chartType === "bar"
              ? statusData ? statusData.map((item: any) => `${item.color}CC`) : [] // Add transparency for bars
              : statusData ? statusData.map((item: any) => item.color) : [],
          borderColor: statusData ? statusData.map((item: any) => item.color) : [],
          borderWidth: chartType === "doughnut" || chartType === "pie" ? 2 : 1,
          hoverBackgroundColor: statusData ? statusData.map((item: any) => item.color) : [],
          hoverBorderColor: statusData ? statusData.map((item: any) => item.color) : [],
          hoverBorderWidth: 3,
          // Custom data for click handling
          statusKeys: statusData ? statusData.map((item: any) => item.key) : [],
        },
      ],
    };
  }, [data, totalEmails, showPercentages, chartType]);

  // Chart options with customizations
  const chartOptions = useMemo(() => {
    const baseOptions = {
      plugins: {
        title: {
          display: true,
          text: title,
          font: {
            family: "Inter, system-ui, sans-serif",
            size: 16,
            weight: "600",
          },
          color: "#1F2937",
          padding: {
            bottom: 20,
          },
        },
        legend: {
          position: chartType === "bar" ? "top" : "right",
          align: "center",
          labels: {
            usePointStyle: true,
            padding: 15,
            font: {
              family: "Inter, system-ui, sans-serif",
              size: 12,
            },
            generateLabels: function (chart: any) {
              const data = chart?.data;
              if (data?.labels?.length && data?.datasets?.length) {
                return data.labels.map((label: string, i: number) => {
                  const dataset = data.datasets[0];
                  const value = dataset.data[i];
                  return {
                    text: `${label}: ${value}`,
                    fillStyle: dataset.backgroundColor[i],
                    strokeStyle: dataset.borderColor[i],
                    lineWidth: dataset.borderWidth,
                    pointStyle: "circle",
                    hidden: false,
                    index: i,
                  };
                });
              }
              return [];
            },
          },
        },
        tooltip: {
          callbacks: {
            label: function (context: any) {
              const label = context.label || "";
              const value = context.parsed || context.raw;
              const percentage =
                totalEmails > 0
                  ? ((value / totalEmails) * 100).toFixed(1)
                  : "0";
              return `${label}: ${value} emails (${percentage}%)`;
            },
          },
        },
      },
    };

    // Add specific options for different chart types
    if (chartType === "doughnut") {
      return {
        ...baseOptions,
        cutout: "60%",
        plugins: {
          ...baseOptions.plugins,
          doughnutCenterText: {
            display: true,
            text: `${totalEmails}\nTotal Emails`,
            color: "#1F2937",
            font: {
              family: "Inter, system-ui, sans-serif",
              size: 14,
              weight: "600",
            },
          },
        },
      };
    }

    if (chartType === "bar") {
      return {
        ...baseOptions,
        indexAxis: "x" as const,
        scales: {
          x: {
            title: {
              display: true,
              text: "Email Status",
              font: {
                family: "Inter, system-ui, sans-serif",
                size: 12,
                weight: "500",
              },
            },
          },
          y: {
            title: {
              display: true,
              text: "Number of Emails",
              font: {
                family: "Inter, system-ui, sans-serif",
                size: 12,
                weight: "500",
              },
            },
            beginAtZero: true,
          },
        },
      };
    }

    return baseOptions;
  }, [title, chartType, totalEmails]);

  // Handle chart click events
  const handleChartClick = (event: any, elements: any[]) => {
    if (onClick && elements && elements.length > 0) {
      const elementIndex = elements[0].index;
      const dataset = chartData.datasets[0];
      if (dataset && dataset.statusKeys) {
        const statusKeys = dataset.statusKeys;
        const status = statusKeys[elementIndex];
        const count = dataset.data[elementIndex];
        if (status !== undefined && count !== undefined) {
          onClick(status, count);
        }
      }
    }
  };

  return (
    <div
      className={`status-distribution-chart bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}
    >
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <div className="text-sm text-gray-500">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 mb-6">
          <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="text-2xl font-bold text-red-600">{data.red}</div>
            <div className="text-sm text-red-700">Critical</div>
            <div className="text-xs text-red-500">
              {totalEmails > 0
                ? `${((data.red / totalEmails) * 100).toFixed(1)}%`
                : "0%"}
            </div>
          </div>

          <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="text-2xl font-bold text-yellow-600">
              {data.yellow}
            </div>
            <div className="text-sm text-yellow-700">In Progress</div>
            <div className="text-xs text-yellow-500">
              {totalEmails > 0
                ? `${((data.yellow / totalEmails) * 100).toFixed(1)}%`
                : "0%"}
            </div>
          </div>

          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="text-2xl font-bold text-green-600">
              {data.green}
            </div>
            <div className="text-sm text-green-700">Completed</div>
            <div className="text-xs text-green-500">
              {totalEmails > 0
                ? `${((data.green / totalEmails) * 100).toFixed(1)}%`
                : "0%"}
            </div>
          </div>
        </div>
      </div>

      <ChartBase
        type={chartType}
        data={chartData}
        options={chartOptions}
        onChartClick={handleChartClick}
        refreshKey={refreshKey}
        height={chartType === "bar" ? 300 : 400}
        className="chart-responsive"
      />

      {/* Chart Type Selector */}
      <div className="flex justify-center mt-4 space-x-2">
        <button
          onClick={() => {
            /* Chart type switching would be handled by parent */
          }}
          className={`px-3 py-1 text-xs rounded-md transition-colors ${
            chartType === "doughnut"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
          title="Doughnut Chart"
        >
          🍩
        </button>
        <button
          onClick={() => {
            /* Chart type switching would be handled by parent */
          }}
          className={`px-3 py-1 text-xs rounded-md transition-colors ${
            chartType === "pie"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
          title="Pie Chart"
        >
          📊
        </button>
        <button
          onClick={() => {
            /* Chart type switching would be handled by parent */
          }}
          className={`px-3 py-1 text-xs rounded-md transition-colors ${
            chartType === "bar"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
          title="Bar Chart"
        >
          📈
        </button>
      </div>
    </div>
  );
};

export default StatusDistributionChart;
