import React, { useRef, useEffect } from "react";
import { Chart, type ChartConfiguration } from "chart.js/auto";

/**
 * Base Chart Component for Email Dashboard Analytics
 * Implements 2025 best practices for data visualization
 */
interface ChartBaseProps {
  type: "bar" | "line" | "doughnut" | "pie" | "radar" | "polarArea";
  data: any;
  options?: any;
  height?: number;
  width?: number;
  className?: string;
  onChartClick?: (event: any, elements: any[]) => void;
  refreshKey?: string | number; // For triggering chart updates
}

export const ChartBase: React.FC<ChartBaseProps> = ({
  type,
  data,
  options = {},
  height = 300,
  width,
  className = "",
  onChartClick,
  refreshKey,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  // Default chart options following 2025 design principles
  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            family: "Inter, system-ui, sans-serif",
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "#ffffff",
        bodyColor: "#ffffff",
        borderColor: "#374151",
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        padding: 12,
        titleFont: {
          family: "Inter, system-ui, sans-serif",
          size: 14,
          weight: "600",
        },
        bodyFont: {
          family: "Inter, system-ui, sans-serif",
          size: 13,
        },
      },
    },
    scales:
      type === "bar" || type === "line"
        ? {
            x: {
              grid: {
                color: "rgba(107, 114, 128, 0.1)",
                borderColor: "rgba(107, 114, 128, 0.2)",
              },
              ticks: {
                font: {
                  family: "Inter, system-ui, sans-serif",
                  size: 11,
                },
                color: "#6B7280",
              },
            },
            y: {
              grid: {
                color: "rgba(107, 114, 128, 0.1)",
                borderColor: "rgba(107, 114, 128, 0.2)",
              },
              ticks: {
                font: {
                  family: "Inter, system-ui, sans-serif",
                  size: 11,
                },
                color: "#6B7280",
              },
            },
          }
        : {},
    onClick: onChartClick
      ? (event: any, elements: any[]) => {
          onChartClick(event, elements);
        }
      : undefined,
    animation: {
      duration: 750,
      easing: "easeInOutQuart",
    },
  };

  // Merge default options with provided options
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    plugins: {
      ...defaultOptions.plugins,
      ...options.plugins,
    },
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    // Destroy existing chart
    if (chartRef.current) {
      chartRef?.current?.destroy();
    }

    // Create new chart
    const config: ChartConfiguration = {
      type,
      data,
      options: mergedOptions,
    };

    chartRef.current = new Chart(canvasRef.current, config);

    // Cleanup function
    return () => {
      if (chartRef.current) {
        chartRef?.current?.destroy();
        chartRef.current = null;
      }
    };
  }, [type, data, refreshKey]);

  // Update chart when data changes
  useEffect(() => {
    if (chartRef.current && chartRef?.current?.data !== data) {
      chartRef?.current?.data = data;
      chartRef?.current?.update("active");
    }
  }, [data]);

  return (
    <div
      className={`chart-container ${className}`}
      style={{ height, width: width || "100%" }}
    >
      <canvas ref={canvasRef} role="img" aria-label={`${type} chart`} />
    </div>
  );
};

// Color schemes for consistent theming
export const CHART_COLORS = {
  // TD SYNNEX Brand Colors
  primary: "#00539B",
  secondary: "#00AEEF",
  accent: "#F47920",

  // Status Colors
  red: "#EF4444",
  yellow: "#F59E0B",
  green: "#10B981",

  // Extended Palette
  blue: "#3B82F6",
  indigo: "#6366F1",
  purple: "#8B5CF6",
  pink: "#EC4899",
  gray: "#6B7280",

  // Gradient variants
  gradients: {
    primary: "linear-gradient(135deg, #00539B 0%, #00AEEF 100%)",
    status: "linear-gradient(135deg, #EF4444 0%, #F59E0B 50%, #10B981 100%)",
    blue: "linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)",
  },
};

// Common chart configurations
export const CHART_CONFIGS = {
  statusDistribution: {
    backgroundColor: [
      CHART_COLORS.red,
      CHART_COLORS.yellow,
      CHART_COLORS.green,
    ],
    borderColor: [CHART_COLORS.red, CHART_COLORS.yellow, CHART_COLORS.green],
    borderWidth: 2,
  },

  workflowTimeline: {
    backgroundColor: CHART_COLORS.primary,
    borderColor: CHART_COLORS.secondary,
    borderWidth: 2,
    fill: false,
    tension: 0.4,
  },

  slaTracking: {
    backgroundColor: [
      "rgba(239, 68, 68, 0.8)", // Overdue
      "rgba(245, 158, 11, 0.8)", // At Risk
      "rgba(16, 185, 129, 0.8)", // On Track
    ],
    borderColor: [CHART_COLORS.red, CHART_COLORS.yellow, CHART_COLORS.green],
    borderWidth: 1,
  },
};

export default ChartBase;
