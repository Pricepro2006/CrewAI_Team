/**
 * Unit Tests for Service Health Dashboard Component
 * Tests monitoring display, alerts, and real-time status updates
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HealthDashboard } from '../../../src/ui/components/HealthDashboard.js';

// Mock Chart.js for performance charts
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />
}));

// Mock tRPC API
vi.mock('../../../src/utils/trpc.js', () => ({
  api: {
    healthCheck: {
      getSystemStatus: {
        useQuery: vi.fn()
      },
      getServiceMetrics: {
        useQuery: vi.fn()
      },
      getDatabaseHealth: {
        useQuery: vi.fn()
      },
      getPerformanceMetrics: {
        useQuery: vi.fn()
      }
    }
  }
}));

// Mock WebSocket hook for real-time updates
vi.mock('../../../src/ui/hooks/useEnhancedWebSocket.js', () => ({
  useEnhancedWebSocket: () => ({
    isConnected: true,
    lastMessage: null,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    send: vi.fn()
  })
}));

describe('Service Health Dashboard Component', () => {
  let queryClient: QueryClient;
  let user: any;

  const mockSystemStatus = {
    overall: 'healthy',
    services: {
      'walmart-nlp': {
        status: 'healthy',
        responseTime: 120,
        uptime: 99.9,
        lastCheck: new Date().toISOString(),
        version: '1.0.0'
      },
      'pricing-service': {
        status: 'healthy',
        responseTime: 80,
        uptime: 99.95,
        lastCheck: new Date().toISOString(),
        version: '1.2.1'
      },
      'cache-service': {
        status: 'degraded',
        responseTime: 300,
        uptime: 98.5,
        lastCheck: new Date().toISOString(),
        version: '2.1.0',
        issues: ['High memory usage', 'Increased response time']
      },
      'websocket-gateway': {
        status: 'down',
        responseTime: null,
        uptime: 0,
        lastCheck: new Date().toISOString(),
        version: '1.5.2',
        error: 'Connection timeout'
      }
    },
    timestamp: new Date().toISOString()
  };

  const mockMetrics = {
    cpu: {
      usage: 65.5,
      cores: 8,
      history: Array.from({ length: 24 }, (_, i) => ({
        time: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
        value: 60 + Math.random() * 20
      }))
    },
    memory: {
      usage: 78.2,
      total: 16384,
      used: 12800,
      history: Array.from({ length: 24 }, (_, i) => ({
        time: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
        value: 70 + Math.random() * 15
      }))
    },
    network: {
      inbound: 125.6,
      outbound: 89.3,
      connections: 1247
    },
    requests: {
      total: 98750,
      successful: 97842,
      failed: 908,
      rps: 156.7,
      history: Array.from({ length: 24 }, (_, i) => ({
        time: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
        total: 8000 + Math.random() * 2000,
        successful: 7800 + Math.random() * 1800,
        failed: 50 + Math.random() * 100
      }))
    }
  };

  const mockDatabaseHealth = {
    status: 'healthy',
    connections: {
      active: 25,
      idle: 15,
      max: 100
    },
    performance: {
      avgQueryTime: 45.2,
      slowQueries: 3,
      deadlocks: 0
    },
    storage: {
      size: '2.5GB',
      growth: '12MB/day',
      freeSpace: '85%'
    }
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    user = userEvent.setup();

    // Mock API responses
    const { api } = require('../../../src/utils/trpc.js');
    api.healthCheck.getSystemStatus.useQuery.mockReturnValue({
      data: mockSystemStatus,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn()
    });

    api.healthCheck.getServiceMetrics.useQuery.mockReturnValue({
      data: mockMetrics,
      isLoading: false,
      isError: false,
      error: null
    });

    api.healthCheck.getDatabaseHealth.useQuery.mockReturnValue({
      data: mockDatabaseHealth,
      isLoading: false,
      isError: false,
      error: null
    });

    api.healthCheck.getPerformanceMetrics.useQuery.mockReturnValue({
      data: mockMetrics,
      isLoading: false,
      isError: false,
      error: null
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <HealthDashboard {...props} />
      </QueryClientProvider>
    );
  };

  describe('Basic Rendering and Layout', () => {
    it('should render main dashboard sections', () => {
      renderComponent();
      
      expect(screen.getByTestId('system-overview')).toBeInTheDocument();
      expect(screen.getByTestId('service-status')).toBeInTheDocument();
      expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
      expect(screen.getByTestId('database-health')).toBeInTheDocument();
    });

    it('should display overall system status', () => {
      renderComponent();
      
      expect(screen.getByText(/system status: healthy/i)).toBeInTheDocument();
      expect(screen.getByTestId('status-indicator')).toHaveClass('status-healthy');
    });

    it('should show last updated timestamp', () => {
      renderComponent();
      
      expect(screen.getByText(/last updated/i)).toBeInTheDocument();
      expect(screen.getByTestId('last-updated')).toBeInTheDocument();
    });

    it('should display auto-refresh indicator', () => {
      renderComponent();
      
      expect(screen.getByTestId('auto-refresh')).toBeInTheDocument();
      expect(screen.getByText(/auto-refresh: on/i)).toBeInTheDocument();
    });
  });

  describe('Service Status Display', () => {
    it('should display all service statuses', () => {
      renderComponent();
      
      expect(screen.getByText(/walmart-nlp/i)).toBeInTheDocument();
      expect(screen.getByText(/pricing-service/i)).toBeInTheDocument();
      expect(screen.getByText(/cache-service/i)).toBeInTheDocument();
      expect(screen.getByText(/websocket-gateway/i)).toBeInTheDocument();
    });

    it('should show healthy service indicators', () => {
      renderComponent();
      
      const healthyServices = screen.getAllByTestId('service-healthy');
      expect(healthyServices).toHaveLength(2); // walmart-nlp and pricing-service
    });

    it('should show degraded service warnings', () => {
      renderComponent();
      
      const degradedService = screen.getByTestId('service-degraded');
      expect(degradedService).toBeInTheDocument();
      expect(screen.getByText(/high memory usage/i)).toBeInTheDocument();
      expect(screen.getByText(/increased response time/i)).toBeInTheDocument();
    });

    it('should show down service alerts', () => {
      renderComponent();
      
      const downService = screen.getByTestId('service-down');
      expect(downService).toBeInTheDocument();
      expect(screen.getByText(/connection timeout/i)).toBeInTheDocument();
    });

    it('should display service response times', () => {
      renderComponent();
      
      expect(screen.getByText(/120ms/i)).toBeInTheDocument(); // walmart-nlp
      expect(screen.getByText(/80ms/i)).toBeInTheDocument(); // pricing-service
      expect(screen.getByText(/300ms/i)).toBeInTheDocument(); // cache-service
    });

    it('should display service uptime percentages', () => {
      renderComponent();
      
      expect(screen.getByText(/99\.9%/i)).toBeInTheDocument(); // walmart-nlp
      expect(screen.getByText(/99\.95%/i)).toBeInTheDocument(); // pricing-service
      expect(screen.getByText(/98\.5%/i)).toBeInTheDocument(); // cache-service
    });

    it('should show service versions', () => {
      renderComponent();
      
      expect(screen.getByText(/v1\.0\.0/i)).toBeInTheDocument();
      expect(screen.getByText(/v1\.2\.1/i)).toBeInTheDocument();
      expect(screen.getByText(/v2\.1\.0/i)).toBeInTheDocument();
    });
  });

  describe('Performance Metrics Charts', () => {
    it('should render CPU usage chart', () => {
      renderComponent();
      
      expect(screen.getByTestId('cpu-chart')).toBeInTheDocument();
      expect(screen.getByText(/cpu usage: 65\.5%/i)).toBeInTheDocument();
    });

    it('should render memory usage chart', () => {
      renderComponent();
      
      expect(screen.getByTestId('memory-chart')).toBeInTheDocument();
      expect(screen.getByText(/memory usage: 78\.2%/i)).toBeInTheDocument();
      expect(screen.getByText(/12\.8gb \/ 16\.4gb/i)).toBeInTheDocument();
    });

    it('should render network metrics', () => {
      renderComponent();
      
      expect(screen.getByTestId('network-metrics')).toBeInTheDocument();
      expect(screen.getByText(/125\.6 mb\/s in/i)).toBeInTheDocument();
      expect(screen.getByText(/89\.3 mb\/s out/i)).toBeInTheDocument();
      expect(screen.getByText(/1247 connections/i)).toBeInTheDocument();
    });

    it('should render request metrics chart', () => {
      renderComponent();
      
      expect(screen.getByTestId('requests-chart')).toBeInTheDocument();
      expect(screen.getByText(/98,750 total/i)).toBeInTheDocument();
      expect(screen.getByText(/156\.7 rps/i)).toBeInTheDocument();
    });

    it('should show error rate indicators', () => {
      renderComponent();
      
      const errorRate = (908 / 98750) * 100;
      expect(screen.getByText(new RegExp(`${errorRate.toFixed(2)}%`, 'i'))).toBeInTheDocument();
    });

    it('should render historical performance charts', () => {
      renderComponent();
      
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });

  describe('Database Health Monitoring', () => {
    it('should display database status', () => {
      renderComponent();
      
      expect(screen.getByText(/database: healthy/i)).toBeInTheDocument();
    });

    it('should show connection pool metrics', () => {
      renderComponent();
      
      expect(screen.getByText(/25 active/i)).toBeInTheDocument();
      expect(screen.getByText(/15 idle/i)).toBeInTheDocument();
      expect(screen.getByText(/100 max/i)).toBeInTheDocument();
    });

    it('should display query performance metrics', () => {
      renderComponent();
      
      expect(screen.getByText(/45\.2ms avg/i)).toBeInTheDocument();
      expect(screen.getByText(/3 slow queries/i)).toBeInTheDocument();
      expect(screen.getByText(/0 deadlocks/i)).toBeInTheDocument();
    });

    it('should show storage information', () => {
      renderComponent();
      
      expect(screen.getByText(/2\.5gb size/i)).toBeInTheDocument();
      expect(screen.getByText(/12mb\/day growth/i)).toBeInTheDocument();
      expect(screen.getByText(/85% free/i)).toBeInTheDocument();
    });
  });

  describe('Real-time Updates and WebSocket Integration', () => {
    it('should connect to WebSocket for real-time updates', () => {
      renderComponent();
      
      const { useEnhancedWebSocket } = require('../../../src/ui/hooks/useEnhancedWebSocket.js');
      expect(useEnhancedWebSocket).toHaveBeenCalled();
    });

    it('should update metrics when WebSocket message received', async () => {
      const mockWebSocket = require('../../../src/ui/hooks/useEnhancedWebSocket.js');
      mockWebSocket.useEnhancedWebSocket.mockReturnValue({
        isConnected: true,
        lastMessage: {
          type: 'metrics_update',
          data: {
            ...mockMetrics,
            cpu: { ...mockMetrics.cpu, usage: 75.3 }
          }
        },
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        send: vi.fn()
      });

      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/75\.3%/i)).toBeInTheDocument();
      });
    });

    it('should show WebSocket connection status', () => {
      renderComponent();
      
      expect(screen.getByTestId('websocket-status')).toBeInTheDocument();
      expect(screen.getByTestId('websocket-status')).toHaveClass('connected');
    });

    it('should handle WebSocket disconnection', () => {
      const mockWebSocket = require('../../../src/ui/hooks/useEnhancedWebSocket.js');
      mockWebSocket.useEnhancedWebSocket.mockReturnValue({
        isConnected: false,
        lastMessage: null,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        send: vi.fn()
      });

      renderComponent();
      
      expect(screen.getByTestId('websocket-status')).toHaveClass('disconnected');
      expect(screen.getByText(/real-time updates unavailable/i)).toBeInTheDocument();
    });
  });

  describe('Alert System and Notifications', () => {
    it('should show critical alerts for down services', () => {
      renderComponent();
      
      expect(screen.getByTestId('critical-alert')).toBeInTheDocument();
      expect(screen.getByText(/websocket-gateway is down/i)).toBeInTheDocument();
    });

    it('should show warning alerts for degraded services', () => {
      renderComponent();
      
      expect(screen.getByTestId('warning-alert')).toBeInTheDocument();
      expect(screen.getByText(/cache-service performance degraded/i)).toBeInTheDocument();
    });

    it('should display alert severity levels', () => {
      renderComponent();
      
      expect(screen.getByTestId('alert-critical')).toBeInTheDocument();
      expect(screen.getByTestId('alert-warning')).toBeInTheDocument();
    });

    it('should show alert timestamps', () => {
      renderComponent();
      
      const alerts = screen.getAllByTestId(/alert-timestamp/);
      expect(alerts.length).toBeGreaterThan(0);
    });

    it('should allow dismissing alerts', async () => {
      renderComponent();
      
      const dismissButton = screen.getByRole('button', { name: /dismiss alert/i });
      await user.click(dismissButton);
      
      await waitFor(() => {
        expect(screen.queryByTestId('warning-alert')).not.toBeInTheDocument();
      });
    });

    it('should show alert summary counts', () => {
      renderComponent();
      
      expect(screen.getByText(/1 critical/i)).toBeInTheDocument();
      expect(screen.getByText(/1 warning/i)).toBeInTheDocument();
    });
  });

  describe('Interactive Features and Controls', () => {
    it('should toggle auto-refresh on/off', async () => {
      renderComponent();
      
      const autoRefreshToggle = screen.getByRole('switch', { name: /auto-refresh/i });
      await user.click(autoRefreshToggle);
      
      expect(screen.getByText(/auto-refresh: off/i)).toBeInTheDocument();
    });

    it('should manually refresh data', async () => {
      const { api } = require('../../../src/utils/trpc.js');
      const mockRefetch = vi.fn();
      api.healthCheck.getSystemStatus.useQuery.mockReturnValue({
        data: mockSystemStatus,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch
      });

      renderComponent();
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await user.click(refreshButton);
      
      expect(mockRefetch).toHaveBeenCalled();
    });

    it('should filter services by status', async () => {
      renderComponent();
      
      const filterSelect = screen.getByLabelText(/filter by status/i);
      await user.selectOptions(filterSelect, 'degraded');
      
      await waitFor(() => {
        expect(screen.getByText(/cache-service/i)).toBeInTheDocument();
        expect(screen.queryByText(/walmart-nlp/i)).not.toBeInTheDocument();
      });
    });

    it('should change time range for metrics', async () => {
      renderComponent();
      
      const timeRangeSelect = screen.getByLabelText(/time range/i);
      await user.selectOptions(timeRangeSelect, '1h');
      
      await waitFor(() => {
        const { api } = require('../../../src/utils/trpc.js');
        expect(api.healthCheck.getPerformanceMetrics.useQuery).toHaveBeenCalledWith(
          expect.objectContaining({ timeRange: '1h' })
        );
      });
    });

    it('should expand service details', async () => {
      renderComponent();
      
      const expandButton = screen.getByRole('button', { name: /expand walmart-nlp details/i });
      await user.click(expandButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('service-details')).toBeInTheDocument();
        expect(screen.getByText(/detailed metrics/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading States and Error Handling', () => {
    it('should show loading skeletons while fetching data', () => {
      const { api } = require('../../../src/utils/trpc.js');
      api.healthCheck.getSystemStatus.useQuery.mockReturnValue({
        data: null,
        isLoading: true,
        isError: false,
        error: null,
        refetch: vi.fn()
      });

      renderComponent();
      
      expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
    });

    it('should handle API errors gracefully', () => {
      const { api } = require('../../../src/utils/trpc.js');
      api.healthCheck.getSystemStatus.useQuery.mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
        error: { message: 'Failed to fetch system status' },
        refetch: vi.fn()
      });

      renderComponent();
      
      expect(screen.getByText(/failed to load dashboard/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should show empty state when no data available', () => {
      const { api } = require('../../../src/utils/trpc.js');
      api.healthCheck.getSystemStatus.useQuery.mockReturnValue({
        data: { services: {}, overall: 'unknown' },
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn()
      });

      renderComponent();
      
      expect(screen.getByText(/no services configured/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      renderComponent();
      
      expect(screen.getByRole('main', { name: /health dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /system overview/i })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /service status/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderComponent();
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      
      await user.tab();
      expect(refreshButton).toHaveFocus();
      
      await user.keyboard('{Enter}');
      // Should trigger refresh
    });

    it('should announce status changes to screen readers', async () => {
      renderComponent();
      
      // Simulate status change
      const { api } = require('../../../src/utils/trpc.js');
      api.healthCheck.getSystemStatus.useQuery.mockReturnValue({
        data: {
          ...mockSystemStatus,
          services: {
            ...mockSystemStatus.services,
            'websocket-gateway': {
              ...mockSystemStatus.services['websocket-gateway'],
              status: 'healthy'
            }
          }
        },
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn()
      });

      await waitFor(() => {
        const announcement = screen.getByRole('status');
        expect(announcement).toHaveTextContent(/websocket-gateway is now healthy/i);
      });
    });

    it('should have sufficient color contrast for status indicators', () => {
      renderComponent();
      
      const healthyIndicator = screen.getByTestId('service-healthy');
      const degradedIndicator = screen.getByTestId('service-degraded');
      const downIndicator = screen.getByTestId('service-down');
      
      expect(healthyIndicator).toHaveClass('bg-green-500');
      expect(degradedIndicator).toHaveClass('bg-yellow-500');
      expect(downIndicator).toHaveClass('bg-red-500');
    });
  });

  describe('Performance and Optimization', () => {
    it('should virtualize large metrics lists', () => {
      renderComponent();
      
      expect(screen.getByTestId('virtual-metrics-list')).toBeInTheDocument();
    });

    it('should debounce auto-refresh updates', async () => {
      renderComponent();
      
      // Should not refresh too frequently
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 30000); // 30 seconds
    });

    it('should pause updates when tab is not visible', () => {
      renderComponent();
      
      // Simulate tab becoming hidden
      Object.defineProperty(document, 'hidden', {
        value: true,
        configurable: true
      });
      
      const visibilityEvent = new Event('visibilitychange');
      document.dispatchEvent(visibilityEvent);
      
      // Auto-refresh should be paused
      expect(screen.getByText(/auto-refresh: paused/i)).toBeInTheDocument();
    });
  });
});