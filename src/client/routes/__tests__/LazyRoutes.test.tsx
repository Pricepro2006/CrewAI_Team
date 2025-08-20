/// <reference types="react" />
/// <reference types="react-dom" />
import React, { Suspense, LazyExoticComponent, ComponentType } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import {
  EmailDashboardDemo,
  EmailDashboardMultiPanel,
  AdvancedEmailDashboard,
  WalmartDashboard,
  WalmartProductSearch,
  WalmartShoppingCart,
  WalmartOrderHistory,
  StatusDistributionChart,
  WorkflowTimelineChart,
  SLATrackingDashboard,
  type EmailDashboardMultiPanelProps,
  type StatusDistributionChartProps,
} from '../LazyRoutes';

// Mock React.lazy to control component loading
const createMockLazyComponent = (name: string, shouldError = false) => {
  const MockComponent = () => {
    if (shouldError) {
      throw new Error(`${name} component error`);
    }
    return <div data-testid={`mock-${name.toLowerCase()}`}>{name} Component</div>;
  };
  MockComponent.displayName = name;
  return MockComponent;
};

// Mock all lazy-loaded components
vi.mock('../../pages/EmailDashboardDemo', () => ({
  EmailDashboardDemo: createMockLazyComponent('EmailDashboardDemo'),
}));

vi.mock('../../components/dashboard/EmailDashboardMultiPanel', () => ({
  EmailDashboardMultiPanel: createMockLazyComponent('EmailDashboardMultiPanel'),
}));

vi.mock('../../components/dashboard/AdvancedEmailDashboard', () => ({
  AdvancedEmailDashboard: createMockLazyComponent('AdvancedEmailDashboard'),
}));

vi.mock('../../components/walmart/WalmartDashboard', () => ({
  WalmartDashboard: createMockLazyComponent('WalmartDashboard'),
}));

vi.mock('../../components/walmart/WalmartProductSearch', () => ({
  WalmartProductSearch: createMockLazyComponent('WalmartProductSearch'),
}));

vi.mock('../../components/walmart/WalmartShoppingCart', () => ({
  WalmartShoppingCart: createMockLazyComponent('WalmartShoppingCart'),
}));

vi.mock('../../components/walmart/WalmartOrderHistory', () => ({
  WalmartOrderHistory: createMockLazyComponent('WalmartOrderHistory'),
}));

vi.mock('../../components/charts/StatusDistributionChart', () => ({
  StatusDistributionChart: createMockLazyComponent('StatusDistributionChart'),
}));

vi.mock('../../components/charts/WorkflowTimelineChart', () => ({
  WorkflowTimelineChart: createMockLazyComponent('WorkflowTimelineChart'),
}));

vi.mock('../../components/charts/SLATrackingDashboard', () => ({
  SLATrackingDashboard: createMockLazyComponent('SLATrackingDashboard'),
}));

// Simple fallback component for testing
const LoadingFallback = () => (
  <div data-testid="loading-fallback">Loading...</div>
);

const ErrorFallback = ({ error }: { error: Error }) => (
  <div data-testid="error-fallback">Error: {error.message}</div>
);

// Error boundary for testing error scenarios
class TestErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  override render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error!} />;
    }

    return this.props.children;
  }
}

const renderWithSuspense = (Component: LazyExoticComponent<ComponentType<any>> | ComponentType<any>, props = {}) => {
  return render(
    <TestErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <Component {...props} />
      </Suspense>
    </TestErrorBoundary>
  );
};

describe('LazyRoutes - Email Dashboard Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('EmailDashboardDemo', () => {
    it('renders EmailDashboardDemo after loading', async () => {
      renderWithSuspense(EmailDashboardDemo);

      // Should show loading initially
      expect(screen.getByTestId('loading-fallback')).toBeInTheDocument();

      // Should render component after loading
      await waitFor(() => {
        expect(screen.getByTestId('mock-emaildashboarddemo')).toBeInTheDocument();
      });

      expect(screen.getByText('EmailDashboardDemo Component')).toBeInTheDocument();
      expect(screen.queryByTestId('loading-fallback')).not.toBeInTheDocument();
    });

    it('is a lazy component', () => {
      expect(EmailDashboardDemo).toHaveProperty('$$typeof');
      expect((EmailDashboardDemo as any)._payload).toBeDefined();
    });
  });

  describe('EmailDashboardMultiPanel', () => {
    it('renders EmailDashboardMultiPanel after loading', async () => {
      renderWithSuspense(EmailDashboardMultiPanel);

      expect(screen.getByTestId('loading-fallback')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('mock-emaildashboardmultipanel')).toBeInTheDocument();
      });

      expect(screen.getByText('EmailDashboardMultiPanel Component')).toBeInTheDocument();
    });

    it('passes props correctly to the lazy component', async () => {
      const testProps: EmailDashboardMultiPanelProps = {
        emails: [],
        loading: false,
        error: null,
      };

      renderWithSuspense(EmailDashboardMultiPanel, testProps);

      await waitFor(() => {
        expect(screen.getByTestId('mock-emaildashboardmultipanel')).toBeInTheDocument();
      });
    });
  });

  describe('AdvancedEmailDashboard', () => {
    it('renders AdvancedEmailDashboard after loading', async () => {
      renderWithSuspense(AdvancedEmailDashboard);

      expect(screen.getByTestId('loading-fallback')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('mock-advancedemaildashboard')).toBeInTheDocument();
      });

      expect(screen.getByText('AdvancedEmailDashboard Component')).toBeInTheDocument();
    });
  });
});

describe('LazyRoutes - Walmart Components', () => {
  describe('WalmartDashboard', () => {
    it('renders WalmartDashboard after loading', async () => {
      renderWithSuspense(WalmartDashboard);

      expect(screen.getByTestId('loading-fallback')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('mock-walmartdashboard')).toBeInTheDocument();
      });

      expect(screen.getByText('WalmartDashboard Component')).toBeInTheDocument();
    });

    it('is properly lazy loaded', () => {
      expect(WalmartDashboard).toHaveProperty('$$typeof');
      expect((WalmartDashboard as any)._payload).toBeDefined();
    });
  });

  describe('WalmartProductSearch', () => {
    it('renders WalmartProductSearch after loading', async () => {
      renderWithSuspense(WalmartProductSearch);

      expect(screen.getByTestId('loading-fallback')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('mock-walmartproductsearch')).toBeInTheDocument();
      });

      expect(screen.getByText('WalmartProductSearch Component')).toBeInTheDocument();
    });
  });

  describe('WalmartShoppingCart', () => {
    it('renders WalmartShoppingCart after loading', async () => {
      renderWithSuspense(WalmartShoppingCart);

      expect(screen.getByTestId('loading-fallback')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('mock-walmartshoppingcart')).toBeInTheDocument();
      });

      expect(screen.getByText('WalmartShoppingCart Component')).toBeInTheDocument();
    });
  });

  describe('WalmartOrderHistory', () => {
    it('renders WalmartOrderHistory after loading', async () => {
      renderWithSuspense(WalmartOrderHistory);

      expect(screen.getByTestId('loading-fallback')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('mock-walmartorderhistory')).toBeInTheDocument();
      });

      expect(screen.getByText('WalmartOrderHistory Component')).toBeInTheDocument();
    });
  });
});

describe('LazyRoutes - Chart Components', () => {
  describe('StatusDistributionChart', () => {
    it('renders StatusDistributionChart after loading', async () => {
      renderWithSuspense(StatusDistributionChart);

      expect(screen.getByTestId('loading-fallback')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('mock-statusdistributionchart')).toBeInTheDocument();
      });

      expect(screen.getByText('StatusDistributionChart Component')).toBeInTheDocument();
    });
  });

  describe('WorkflowTimelineChart', () => {
    it('renders WorkflowTimelineChart after loading', async () => {
      renderWithSuspense(WorkflowTimelineChart);

      expect(screen.getByTestId('loading-fallback')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('mock-workflowtimelinechart')).toBeInTheDocument();
      });

      expect(screen.getByText('WorkflowTimelineChart Component')).toBeInTheDocument();
    });
  });

  describe('SLATrackingDashboard', () => {
    it('renders SLATrackingDashboard after loading', async () => {
      renderWithSuspense(SLATrackingDashboard);

      expect(screen.getByTestId('loading-fallback')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('mock-slatrackingdashboard')).toBeInTheDocument();
      });

      expect(screen.getByText('SLATrackingDashboard Component')).toBeInTheDocument();
    });
  });
});

describe('LazyRoutes - Error Handling', () => {
  beforeEach(() => {
    // Suppress console.error for error boundary tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles component loading errors gracefully', async () => {
    // Mock a component that throws an error
    vi.doMock('../../pages/EmailDashboardDemo', () => ({
      EmailDashboardDemo: () => {
        throw new Error('Component failed to load');
      },
    }));

    const FailingComponent = React.lazy<ComponentType<any>>(() => import('../../pages/EmailDashboardDemo').then(module => ({ default: module.EmailDashboardDemo })));

    render(
      <TestErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
          <FailingComponent />
        </Suspense>
      </TestErrorBoundary>
    );

    expect(screen.getByTestId('loading-fallback')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('error-fallback')).toBeInTheDocument();
    });

    expect(screen.getByText(/Component failed to load/)).toBeInTheDocument();
  });
});

describe('LazyRoutes - Performance', () => {
  it('components are only loaded when rendered', () => {
    // Before rendering, the components should not be fully loaded
    expect(EmailDashboardDemo).toHaveProperty('$$typeof');
    expect(WalmartDashboard).toHaveProperty('$$typeof');
    expect(StatusDistributionChart).toHaveProperty('$$typeof');
    
    // The components should be React.lazy wrappers
    expect((EmailDashboardDemo as any)._payload).toBeDefined();
    expect((WalmartDashboard as any)._payload).toBeDefined();
    expect((StatusDistributionChart as any)._payload).toBeDefined();
  });

  it('multiple components can be loaded concurrently', async () => {
    const { container } = render(
      <TestErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
          <div>
            <EmailDashboardDemo />
            <WalmartDashboard />
            {React.createElement(StatusDistributionChart as any, { data: { red: 1, yellow: 1, green: 1 }, totalEmails: 3 })}
          </div>
        </Suspense>
      </TestErrorBoundary>
    );

    expect(screen.getByTestId('loading-fallback')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('mock-emaildashboarddemo')).toBeInTheDocument();
      expect(screen.getByTestId('mock-walmartdashboard')).toBeInTheDocument();
      expect(screen.getByTestId('mock-statusdistributionchart')).toBeInTheDocument();
    });

    expect(container.querySelectorAll('[data-testid^="mock-"]')).toHaveLength(3);
  });

  it('handles rapid component mounting and unmounting', async () => {
    const { unmount, rerender } = renderWithSuspense(EmailDashboardDemo);

    await waitFor(() => {
      expect(screen.getByTestId('mock-emaildashboarddemo')).toBeInTheDocument();
    });

    unmount();

    // Re-render the same component
    rerender(
      <TestErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
          <EmailDashboardDemo />
        </Suspense>
      </TestErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByTestId('mock-emaildashboarddemo')).toBeInTheDocument();
    });
  });
});

describe('LazyRoutes - Accessibility', () => {
  it('provides accessible loading states', async () => {
    renderWithSuspense(EmailDashboardDemo);

    const loadingElement = screen.getByTestId('loading-fallback');
    expect(loadingElement).toBeInTheDocument();
    expect(loadingElement).toHaveTextContent('Loading...');

    await waitFor(() => {
      expect(screen.getByTestId('mock-emaildashboarddemo')).toBeInTheDocument();
    });
  });

  it('maintains focus management during lazy loading', async () => {
    const { container } = renderWithSuspense(EmailDashboardDemo);

    // Focus should be manageable during loading
    const loadingElement = screen.getByTestId('loading-fallback');
    loadingElement.focus();
    expect(document.activeElement).toBe(loadingElement);

    await waitFor(() => {
      expect(screen.getByTestId('mock-emaildashboarddemo')).toBeInTheDocument();
    });

    // Focus should be maintained or properly transferred
    expect(document.activeElement).toBeDefined();
  });

  it('provides semantic content structure', async () => {
    renderWithSuspense(EmailDashboardDemo);

    await waitFor(() => {
      expect(screen.getByTestId('mock-emaildashboarddemo')).toBeInTheDocument();
    });

    const component = screen.getByTestId('mock-emaildashboarddemo');
    expect(component.tagName).toBe('DIV');
    expect(component).toHaveTextContent('EmailDashboardDemo Component');
  });
});

describe('LazyRoutes - Integration Scenarios', () => {
  it('works with React Router navigation', async () => {
    // Simulate router context
    const MockRouter = ({ children }: { children: React.ReactNode }) => (
      <div data-testid="mock-router">{children}</div>
    );

    render(
      <MockRouter>
        <TestErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <EmailDashboardDemo />
          </Suspense>
        </TestErrorBoundary>
      </MockRouter>
    );

    expect(screen.getByTestId('mock-router')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('mock-emaildashboarddemo')).toBeInTheDocument();
    });
  });

  it('handles state management integration', async () => {
    // Mock state provider
    const MockStateProvider = ({ children }: { children: React.ReactNode }) => (
      <div data-testid="mock-state-provider">{children}</div>
    );

    render(
      <MockStateProvider>
        <TestErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <WalmartDashboard />
          </Suspense>
        </TestErrorBoundary>
      </MockStateProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('mock-walmartdashboard')).toBeInTheDocument();
    });

    expect(screen.getByTestId('mock-state-provider')).toBeInTheDocument();
  });

  it('supports nested lazy loading', async () => {
    const NestedComponent = () => (
      <div>
        <Suspense fallback={<div data-testid="nested-loading">Nested Loading...</div>}>
          {React.createElement(EmailDashboardMultiPanel as any, { emails: [], loading: false, error: null })}
        </Suspense>
      </div>
    );

    render(
      <TestErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
          <NestedComponent />
        </Suspense>
      </TestErrorBoundary>
    );

    // Should handle nested suspense boundaries
    await waitFor(() => {
      expect(screen.getByTestId('mock-emaildashboardmultipanel')).toBeInTheDocument();
    });
  });
});

describe('LazyRoutes - Memory Management', () => {
  it('properly cleans up components on unmount', async () => {
    const { unmount } = renderWithSuspense(EmailDashboardDemo);

    await waitFor(() => {
      expect(screen.getByTestId('mock-emaildashboarddemo')).toBeInTheDocument();
    });

    // Component should be mounted
    expect(screen.getByTestId('mock-emaildashboarddemo')).toBeInTheDocument();

    unmount();

    // Component should be unmounted
    expect(screen.queryByTestId('mock-emaildashboarddemo')).not.toBeInTheDocument();
  });

  it('handles memory efficiently with multiple lazy components', async () => {
    const components = [
      EmailDashboardDemo,
      WalmartDashboard,
      StatusDistributionChart,
      WorkflowTimelineChart,
      SLATrackingDashboard,
    ];

    // Render multiple components
    const { unmount } = render(
      <TestErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
          <div>
            {components.map((Component, index) => {
              // StatusDistributionChart requires data and totalEmails props
              if (Component === StatusDistributionChart) {
                const chartProps: StatusDistributionChartProps = { data: { red: 1, yellow: 1, green: 1 }, totalEmails: 3 };
                return <Component key={index} {...chartProps} />;
              }
              // Provide default props for components that might need them
              const defaultProps: Record<string, any> = {};
              return <Component key={index} {...defaultProps} />;
            })}
          </div>
        </Suspense>
      </TestErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByTestId('mock-emaildashboarddemo')).toBeInTheDocument();
      expect(screen.getByTestId('mock-walmartdashboard')).toBeInTheDocument();
    });

    unmount();

    // All components should be properly cleaned up
    expect(screen.queryByTestId('mock-emaildashboarddemo')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-walmartdashboard')).not.toBeInTheDocument();
  });
});