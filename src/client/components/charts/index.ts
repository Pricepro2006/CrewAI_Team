/**
 * Chart Components for Email Dashboard Analytics
 * Agent 13: Data Visualization Expert
 */

// Base chart component and utilities
export { ChartBase, CHART_COLORS, CHART_CONFIGS } from './ChartBase.js';

// Specific chart components
export { StatusDistributionChart } from './StatusDistributionChart.js';
export { WorkflowTimelineChart } from './WorkflowTimelineChart.js';
export { SLATrackingDashboard } from './SLATrackingDashboard.js';

// Export default chart configurations for easy reuse
export const DEFAULT_CHART_THEMES = {
  tdSynnex: {
    primary: '#00539B',
    secondary: '#00AEEF',
    accent: '#F47920',
    background: '#FFFFFF',
    text: '#1F2937'
  },
  
  status: {
    critical: '#EF4444',
    warning: '#F59E0B',
    success: '#10B981',
    info: '#3B82F6'
  }
};

// Chart type definitions for TypeScript support
export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
  metadata?: Record<string, any>;
}

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
  category?: string;
  metadata?: Record<string, any>;
}

export interface ChartTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  grid?: string;
  border?: string;
}

// Common chart options factory functions
export const createBarChartOptions = (theme: ChartTheme) => ({
  responsive: true,
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        color: theme.text,
        font: {
          family: 'Inter, system-ui, sans-serif'
        }
      }
    }
  },
  scales: {
    x: {
      grid: {
        color: theme.grid || 'rgba(107, 114, 128, 0.1)'
      },
      ticks: {
        color: theme.text
      }
    },
    y: {
      grid: {
        color: theme.grid || 'rgba(107, 114, 128, 0.1)'
      },
      ticks: {
        color: theme.text
      }
    }
  }
});

export const createLineChartOptions = (theme: ChartTheme) => ({
  responsive: true,
  interaction: {
    mode: 'index' as const,
    intersect: false
  },
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        color: theme.text,
        font: {
          family: 'Inter, system-ui, sans-serif'
        }
      }
    }
  },
  scales: {
    x: {
      display: true,
      grid: {
        color: theme.grid || 'rgba(107, 114, 128, 0.1)'
      },
      ticks: {
        color: theme.text
      }
    },
    y: {
      display: true,
      grid: {
        color: theme.grid || 'rgba(107, 114, 128, 0.1)'
      },
      ticks: {
        color: theme.text
      }
    }
  }
});

export const createDoughnutChartOptions = (theme: ChartTheme) => ({
  responsive: true,
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        color: theme.text,
        font: {
          family: 'Inter, system-ui, sans-serif'
        },
        usePointStyle: true,
        padding: 20
      }
    }
  }
});