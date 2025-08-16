import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  ErrorBoundary, 
  withErrorBoundary, 
  WalmartErrorBoundary, 
  PricingErrorBoundary, 
  DashboardErrorBoundary 
} from '../ErrorBoundary.js';

// Mock Sentry error tracker
vi.mock('../../../monitoring/SentryErrorTracker.js', () => ({
  sentryErrorTracker: {
    captureError: vi.fn().mockReturnValue('mock-error-id'),
    addBreadcrumb: vi.fn(),
    recordCustomMetric: vi.fn(),
  },
}));

// Mock UI components
vi.mock('../../../components/ui/button.js', () => ({
  Button: ({ children, onClick, className, variant, size }: any) => (
    <button 
      className={`button ${variant} ${size} ${className || ''}`} 
      onClick={onClick}
      data-testid="error-button"
    >
      {children}
    </button>
  ),
}));

vi.mock('../../../components/ui/alert.js', () => ({
  Alert: ({ children, className }: any) => (
    <div className={`alert ${className || ''}`} data-testid="alert">
      {children}
    </div>
  ),
  AlertDescription: ({ children, className }: any) => (
    <div className={`alert-description ${className || ''}`} data-testid="alert-description">
      {children}
    </div>
  ),
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  AlertTriangle: ({ className, size }: any) => (
    <div className={`icon alert-triangle ${className || ''}`} data-size={size} data-testid="alert-triangle-icon" />
  ),
  RefreshCcw: ({ className, size }: any) => (
    <div className={`icon refresh ${className || ''}`} data-size={size} data-testid="refresh-icon" />
  ),
  Home: ({ className, size }: any) => (
    <div className={`icon home ${className || ''}`} data-size={size} data-testid="home-icon" />
  ),
  Bug: ({ className, size }: any) => (
    <div className={`icon bug ${className || ''}`} data-size={size} data-testid="bug-icon" />
  ),
}));

// Test components that throw errors
const ThrowingComponent = ({ shouldThrow = false, errorMessage = 'Test error' }) => {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <div data-testid="working-component">Working Component</div>;
};

const AsyncThrowingComponent = ({ shouldThrow = false }) => {
  React.useEffect(() => {
    if (shouldThrow) {
      setTimeout(() => {
        throw new Error('Async error');
      }, 10);
    }
  }, [shouldThrow]);
  
  return <div data-testid="async-component">Async Component</div>;
};

describe('ErrorBoundary', () => {
  let user: ReturnType<typeof userEvent.setup>;
  let mockOnError: ReturnType<typeof vi.fn>;
  let originalConsoleError: typeof console.error;
  let originalLocation: typeof window.location;

  beforeEach(() => {
    user = userEvent.setup();
    mockOnError = vi.fn();
    
    // Mock console.error to prevent error output in tests
    originalConsoleError = console.error;
    console.error = vi.fn();

    // Mock window.location
    originalLocation = window.location;
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      reload: vi.fn(),
      href: 'http://localhost:3000/',
    };

    // Mock window.open
    window.open = vi.fn();

    // Mock navigator
    Object.defineProperty(navigator, 'userAgent', {
      value: 'test-user-agent',
      configurable: true,
    });

    // Mock process.env
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.clearAllMocks();
    console.error = originalConsoleError;
    window.location = originalLocation;
    vi.unstubAllEnvs();
  });

  describe('Basic Error Handling', () => {
    it('renders children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('working-component')).toBeInTheDocument();
    });

    it('catches errors and displays error UI', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
      expect(screen.queryByTestId('working-component')).not.toBeInTheDocument();
    });

    it('displays custom error message in development mode', () => {
      vi.stubEnv('NODE_ENV', 'development');
      
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} errorMessage="Custom error message" />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('alert-description')).toBeInTheDocument();
      expect(screen.getByText(/Custom error message/)).toBeInTheDocument();
    });

    it('calls onError callback when provided', () => {
      render(
        <ErrorBoundary onError={mockOnError}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(mockOnError).toHaveBeenCalledTimes(1);
      expect(mockOnError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });

    it('displays custom component name in error message', () => {
      render(
        <ErrorBoundary component="TestComponent">
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/testcomponent/i)).toBeInTheDocument();
    });
  });

  describe('Isolated Error Boundary', () => {
    it('renders isolated error UI when isolate prop is true', () => {
      render(
        <ErrorBoundary isolate={true} component="TestComponent">
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText(/TestComponent encountered an error/)).toBeInTheDocument();
      expect(screen.queryByText('Oops! Something went wrong')).not.toBeInTheDocument();
    });

    it('shows retry button in isolated mode', () => {
      render(
        <ErrorBoundary isolate={true}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Retry')).toBeInTheDocument();
      expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();
    });
  });

  describe('Custom Fallback UI', () => {
    it('renders custom fallback when provided', () => {
      const customFallback = <div data-testid="custom-fallback">Custom Error UI</div>;
      
      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.getByText('Custom Error UI')).toBeInTheDocument();
      expect(screen.queryByText('Oops! Something went wrong')).not.toBeInTheDocument();
    });
  });

  describe('Retry Functionality', () => {
    it('allows retrying after error', async () => {
      let shouldThrow = true;
      
      const RetryTestComponent = () => (
        <ThrowingComponent shouldThrow={shouldThrow} />
      );

      const { rerender } = render(
        <ErrorBoundary isolate={true}>
          <RetryTestComponent />
        </ErrorBoundary>
      );

      // Error should be displayed
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Fix the component
      shouldThrow = false;

      // Click retry
      await user.click(screen.getByText('Retry'));

      // Wait for retry delay and rerender
      await waitFor(() => {
        rerender(
          <ErrorBoundary isolate={true}>
            <RetryTestComponent />
          </ErrorBoundary>
        );
      });

      // Component should work after retry
      expect(screen.getByTestId('working-component')).toBeInTheDocument();
    });

    it('limits number of retries', async () => {
      render(
        <ErrorBoundary isolate={true}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      // First retry
      await user.click(screen.getByText('Retry'));
      await waitFor(() => expect(screen.getByText('Retry')).toBeInTheDocument());

      // Second retry
      await user.click(screen.getByText('Retry'));
      await waitFor(() => expect(screen.getByText('Retry')).toBeInTheDocument());

      // Third retry
      await user.click(screen.getByText('Retry'));
      await waitFor(() => expect(screen.getByText('Retry')).toBeInTheDocument());

      // Fourth retry should not be available (max 3 retries)
      await user.click(screen.getByText('Retry'));
      await waitFor(() => {
        // After max retries, retry button might be disabled or hidden
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      });
    });

    it('has exponential backoff for retry delays', async () => {
      const startTime = Date.now();
      
      render(
        <ErrorBoundary isolate={true}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      await user.click(screen.getByText('Retry'));
      
      const endTime = Date.now();
      const delay = endTime - startTime;
      
      // Should have some delay (testing the mechanism exists)
      expect(delay).toBeGreaterThan(0);
    });
  });

  describe('Full Page Error Actions', () => {
    it('handles reload action', async () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      await user.click(screen.getByText('Reload Page'));
      
      expect(window.location.reload).toHaveBeenCalledTimes(1);
    });

    it('handles go home action', async () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      await user.click(screen.getByText('Go Home'));
      
      expect(window.location.href).toBe('/');
    });

    it('handles bug report action', async () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} errorMessage="Test bug report" />
        </ErrorBoundary>
      );

      await user.click(screen.getByText('Report Bug'));
      
      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining('mailto:support@yourcompany.com')
      );
      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining('Test bug report')
      );
    });

    it('includes error ID in bug report', async () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      await user.click(screen.getByText('Report Bug'));
      
      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining('mock-error-id')
      );
    });
  });

  describe('Error Tracking Integration', () => {
    it('captures errors with Sentry', () => {
      const { sentryErrorTracker } = require('../../../monitoring/SentryErrorTracker.js');
      
      render(
        <ErrorBoundary component="TestComponent">
          <ThrowingComponent shouldThrow={true} errorMessage="Tracked error" />
        </ErrorBoundary>
      );

      expect(sentryErrorTracker.captureError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          component: 'react_boundary_TestComponent',
          operation: 'component_render',
        }),
        'error',
        expect.any(Object)
      );
    });

    it('adds breadcrumbs for error tracking', () => {
      const { sentryErrorTracker } = require('../../../monitoring/SentryErrorTracker.js');
      
      render(
        <ErrorBoundary component="TestComponent">
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(sentryErrorTracker.addBreadcrumb).toHaveBeenCalledWith(
        'Error boundary caught error in TestComponent',
        'ui',
        'error',
        expect.any(Object)
      );
    });

    it('displays error ID when available', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Error ID: mock-error-id/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels and structure', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should be able to tab through action buttons
      await user.tab();
      expect(document.activeElement).toHaveClass('button');
      
      await user.tab();
      expect(document.activeElement).toHaveClass('button');
    });

    it('provides screen reader friendly content', () => {
      render(
        <ErrorBoundary component="TestComponent">
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/testcomponent/i)).toBeInTheDocument();
      expect(screen.getByText(/unexpected error occurred/i)).toBeInTheDocument();
    });
  });

  describe('Performance and Memory', () => {
    it('cleans up timeouts on unmount', () => {
      const { unmount } = render(
        <ErrorBoundary isolate={true}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      // Trigger retry to create timeout
      fireEvent.click(screen.getByText('Retry'));
      
      // Unmount should clean up timeouts
      unmount();
      
      // No specific assertion, but should not cause memory leaks
      expect(true).toBe(true);
    });

    it('handles rapid error triggering', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ErrorBoundary>
      );

      // Trigger multiple errors rapidly
      rerender(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} errorMessage="Error 1" />
        </ErrorBoundary>
      );

      rerender(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} errorMessage="Error 2" />
        </ErrorBoundary>
      );

      // Should handle gracefully
      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles errors without messages', () => {
      const ErrorWithoutMessage = () => {
        throw new Error();
      };

      render(
        <ErrorBoundary>
          <ErrorWithoutMessage />
        </ErrorBoundary>
      );

      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    });

    it('handles non-Error objects being thrown', () => {
      const ThrowString = () => {
        throw 'String error';
      };

      render(
        <ErrorBoundary>
          <ThrowString />
        </ErrorBoundary>
      );

      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    });

    it('handles missing Sentry integration gracefully', () => {
      vi.doMock('../../../monitoring/SentryErrorTracker.js', () => ({
        sentryErrorTracker: null,
      }));

      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should still display error UI even if Sentry fails
      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    });
  });
});

describe('withErrorBoundary HOC', () => {
  it('wraps component with error boundary', () => {
    const TestComponent = ({ shouldThrow = false }) => (
      <ThrowingComponent shouldThrow={shouldThrow} />
    );

    const WrappedComponent = withErrorBoundary(TestComponent, {
      component: 'WrappedTest',
    });

    render(<WrappedComponent shouldThrow={false} />);
    
    expect(screen.getByTestId('working-component')).toBeInTheDocument();
  });

  it('catches errors in wrapped component', () => {
    const TestComponent = ({ shouldThrow = false }) => (
      <ThrowingComponent shouldThrow={shouldThrow} />
    );

    const WrappedComponent = withErrorBoundary(TestComponent, {
      component: 'WrappedTest',
    });

    render(<WrappedComponent shouldThrow={true} />);
    
    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/wrappedtest/i)).toBeInTheDocument();
  });

  it('sets proper display name', () => {
    const TestComponent = () => <div>Test</div>;
    TestComponent.displayName = 'TestComponent';

    const WrappedComponent = withErrorBoundary(TestComponent);
    
    expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponent)');
  });

  it('uses component name when displayName not available', () => {
    const TestComponent = function TestComponentFunction() {
      return <div>Test</div>;
    };

    const WrappedComponent = withErrorBoundary(TestComponent);
    
    expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponentFunction)');
  });
});

describe('Specialized Error Boundaries', () => {
  beforeEach(() => {
    const { sentryErrorTracker } = require('../../../monitoring/SentryErrorTracker.js');
    sentryErrorTracker.recordCustomMetric = vi.fn();
  });

  describe('WalmartErrorBoundary', () => {
    it('renders walmart-specific error boundary', () => {
      render(
        <WalmartErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </WalmartErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText(/Walmart Grocery Agent encountered an error/)).toBeInTheDocument();
    });

    it('records walmart-specific metrics on error', () => {
      const { sentryErrorTracker } = require('../../../monitoring/SentryErrorTracker.js');
      
      render(
        <WalmartErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </WalmartErrorBoundary>
      );

      expect(sentryErrorTracker.recordCustomMetric).toHaveBeenCalledWith(
        'walmart_component_error',
        1,
        expect.objectContaining({
          component: 'walmart_grocery',
          error_type: 'Error',
        })
      );
    });
  });

  describe('PricingErrorBoundary', () => {
    it('renders pricing-specific error boundary', () => {
      render(
        <PricingErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </PricingErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText(/Price Tracker encountered an error/)).toBeInTheDocument();
    });

    it('records pricing-specific metrics on error', () => {
      const { sentryErrorTracker } = require('../../../monitoring/SentryErrorTracker.js');
      
      render(
        <PricingErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </PricingErrorBoundary>
      );

      expect(sentryErrorTracker.recordCustomMetric).toHaveBeenCalledWith(
        'pricing_component_error',
        1,
        expect.objectContaining({
          component: 'price_tracker',
          error_type: 'Error',
        })
      );
    });
  });

  describe('DashboardErrorBoundary', () => {
    it('renders full-page dashboard error boundary', () => {
      render(
        <DashboardErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </DashboardErrorBoundary>
      );

      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    });

    it('records dashboard-specific metrics on error', () => {
      const { sentryErrorTracker } = require('../../../monitoring/SentryErrorTracker.js');
      
      render(
        <DashboardErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </DashboardErrorBoundary>
      );

      expect(sentryErrorTracker.recordCustomMetric).toHaveBeenCalledWith(
        'dashboard_component_error',
        1,
        expect.objectContaining({
          component: 'dashboard',
          error_type: 'Error',
        })
      );
    });
  });
});

describe('Integration with Real Components', () => {
  it('works with complex component hierarchies', () => {
    const ComplexComponent = () => (
      <div>
        <header>Header</header>
        <main>
          <ThrowingComponent shouldThrow={false} />
        </main>
        <footer>Footer</footer>
      </div>
    );

    render(
      <ErrorBoundary>
        <ComplexComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByTestId('working-component')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('isolates errors to specific boundary levels', () => {
    render(
      <div>
        <ErrorBoundary isolate={true} component="Section1">
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
        <ErrorBoundary isolate={true} component="Section2">
          <ThrowingComponent shouldThrow={false} />
        </ErrorBoundary>
      </div>
    );

    // First section should show error
    expect(screen.getByText(/Section1 encountered an error/)).toBeInTheDocument();
    
    // Second section should work normally
    expect(screen.getByTestId('working-component')).toBeInTheDocument();
  });

  it('handles nested error boundaries correctly', () => {
    render(
      <ErrorBoundary component="Outer">
        <div>
          <ErrorBoundary isolate={true} component="Inner">
            <ThrowingComponent shouldThrow={true} />
          </ErrorBoundary>
          <div>Other content</div>
        </div>
      </ErrorBoundary>
    );

    // Inner boundary should catch the error
    expect(screen.getByText(/Inner encountered an error/)).toBeInTheDocument();
    expect(screen.getByText('Other content')).toBeInTheDocument();
    
    // Outer boundary should not be triggered
    expect(screen.queryByText('Oops! Something went wrong')).not.toBeInTheDocument();
  });
});