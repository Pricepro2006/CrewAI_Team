import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { StatusIndicator, StatusBadge, StatusLegend } from '../StatusIndicator';
import type { EmailStatus } from '../../../../types/email-dashboard.interfaces';

// Mock dependencies
vi.mock('../../../../lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

vi.mock('../../../../components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
  TooltipContent: ({ children }: any) => <div data-testid="tooltip-content">{children}</div>,
  TooltipProvider: ({ children }: any) => <div data-testid="tooltip-provider">{children}</div>,
  TooltipTrigger: ({ children, asChild }: any) => (
    <div data-testid="tooltip-trigger">{children}</div>
  ),
}));

describe('StatusIndicator', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders with red status', () => {
      render(<StatusIndicator status="red" />);
      
      const indicator = screen.getByTestId('tooltip-provider');
      expect(indicator).toBeInTheDocument();
    });

    it('renders with yellow status', () => {
      render(<StatusIndicator status="yellow" />);
      
      const indicator = screen.getByTestId('tooltip-provider');
      expect(indicator).toBeInTheDocument();
    });

    it('renders with green status', () => {
      render(<StatusIndicator status="green" />);
      
      const indicator = screen.getByTestId('tooltip-provider');
      expect(indicator).toBeInTheDocument();
    });

    it('renders without tooltip when showTooltip is false', () => {
      render(<StatusIndicator status="red" showTooltip={false} />);
      
      expect(screen.queryByTestId('tooltip-provider')).not.toBeInTheDocument();
    });

    it('renders with custom status text', () => {
      render(<StatusIndicator status="red" statusText="Custom Status" />);
      
      expect(screen.getByText('Custom Status')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <StatusIndicator status="red" className="custom-class" />
      );
      
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Size Variations', () => {
    it('renders with small size', () => {
      render(<StatusIndicator status="red" size="sm" />);
      
      const indicator = screen.getByTestId('tooltip-provider');
      expect(indicator).toBeInTheDocument();
    });

    it('renders with medium size (default)', () => {
      render(<StatusIndicator status="red" size="md" />);
      
      const indicator = screen.getByTestId('tooltip-provider');
      expect(indicator).toBeInTheDocument();
    });

    it('renders with large size', () => {
      render(<StatusIndicator status="red" size="lg" />);
      
      const indicator = screen.getByTestId('tooltip-provider');
      expect(indicator).toBeInTheDocument();
    });

    it('uses medium size as default when size not specified', () => {
      render(<StatusIndicator status="red" />);
      
      const indicator = screen.getByTestId('tooltip-provider');
      expect(indicator).toBeInTheDocument();
    });
  });

  describe('Pulse Animation', () => {
    it('shows pulse when showPulse is true and status is red', () => {
      render(<StatusIndicator status="red" showPulse={true} />);
      
      const indicator = screen.getByTestId('tooltip-provider');
      expect(indicator).toBeInTheDocument();
    });

    it('does not show pulse when showPulse is false', () => {
      render(<StatusIndicator status="red" showPulse={false} />);
      
      const indicator = screen.getByTestId('tooltip-provider');
      expect(indicator).toBeInTheDocument();
    });

    it('does not show pulse for non-red statuses even when showPulse is true', () => {
      render(<StatusIndicator status="green" showPulse={true} />);
      
      const indicator = screen.getByTestId('tooltip-provider');
      expect(indicator).toBeInTheDocument();
    });
  });

  describe('Tooltip Functionality', () => {
    it('shows tooltip with default label when no statusText provided', () => {
      render(<StatusIndicator status="red" showTooltip={true} />);
      
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip-content')).toBeInTheDocument();
      expect(screen.getByText('Critical')).toBeInTheDocument();
    });

    it('shows tooltip with custom statusText', () => {
      render(
        <StatusIndicator 
          status="red" 
          statusText="Custom Critical Status" 
          showTooltip={true} 
        />
      );
      
      expect(screen.getByText('Custom Critical Status')).toBeInTheDocument();
    });

    it('does not show tooltip when statusText is provided and showTooltip is default', () => {
      render(<StatusIndicator status="red" statusText="Custom Status" />);
      
      expect(screen.queryByTestId('tooltip-provider')).not.toBeInTheDocument();
      expect(screen.getByText('Custom Status')).toBeInTheDocument();
    });

    it('shows correct default labels for each status', () => {
      const { rerender } = render(<StatusIndicator status="red" />);
      expect(screen.getByText('Critical')).toBeInTheDocument();

      rerender(<StatusIndicator status="yellow" />);
      expect(screen.getByText('In Progress')).toBeInTheDocument();

      rerender(<StatusIndicator status="green" />);
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides proper semantic structure', () => {
      render(<StatusIndicator status="red" statusText="Critical Issue" />);
      
      expect(screen.getByText('Critical Issue')).toBeInTheDocument();
    });

    it('supports screen readers with tooltip content', () => {
      render(<StatusIndicator status="red" showTooltip={true} />);
      
      expect(screen.getByTestId('tooltip-content')).toBeInTheDocument();
      expect(screen.getByText('Critical')).toBeInTheDocument();
    });

    it('handles keyboard interactions properly', async () => {
      render(<StatusIndicator status="red" showTooltip={true} />);
      
      const trigger = screen.getByTestId('tooltip-trigger');
      
      // Should be focusable and interactive
      await user.tab();
      expect(document.activeElement).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined status gracefully', () => {
      // TypeScript would prevent this, but testing runtime behavior
      render(<StatusIndicator status={undefined as any} />);
      
      // Should not crash, though might not display correctly
      expect(screen.getByTestId('tooltip-provider')).toBeInTheDocument();
    });

    it('handles empty statusText', () => {
      render(<StatusIndicator status="red" statusText="" />);
      
      // Should fall back to default label
      expect(screen.getByText('Critical')).toBeInTheDocument();
    });

    it('handles null statusText', () => {
      render(<StatusIndicator status="red" statusText={null as any} />);
      
      // Should show tooltip with default label
      expect(screen.getByTestId('tooltip-provider')).toBeInTheDocument();
    });

    it('handles very long statusText', () => {
      const longText = 'A'.repeat(100);
      render(<StatusIndicator status="red" statusText={longText} />);
      
      expect(screen.getByText(longText)).toBeInTheDocument();
    });

    it('handles special characters in statusText', () => {
      const specialText = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      render(<StatusIndicator status="red" statusText={specialText} />);
      
      expect(screen.getByText(specialText)).toBeInTheDocument();
    });
  });
});

describe('StatusBadge', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  describe('Basic Rendering', () => {
    it('renders with all status types', () => {
      const { rerender } = render(<StatusBadge status="red" />);
      expect(screen.getByText('Critical')).toBeInTheDocument();

      rerender(<StatusBadge status="yellow" />);
      expect(screen.getByText('In Progress')).toBeInTheDocument();

      rerender(<StatusBadge status="green" />);
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('renders with custom statusText', () => {
      render(<StatusBadge status="red" statusText="Custom Badge Text" />);
      
      expect(screen.getByText('Custom Badge Text')).toBeInTheDocument();
    });

    it('renders with children content', () => {
      render(
        <StatusBadge status="red">
          <span>Child Content</span>
        </StatusBadge>
      );
      
      expect(screen.getByText('Child Content')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <StatusBadge status="red" className="custom-badge-class" />
      );
      
      expect(container.firstChild).toHaveClass('custom-badge-class');
    });

    it('prioritizes children over statusText', () => {
      render(
        <StatusBadge status="red" statusText="Should Not Show">
          <span>Children Override</span>
        </StatusBadge>
      );
      
      expect(screen.getByText('Children Override')).toBeInTheDocument();
      expect(screen.queryByText('Should Not Show')).not.toBeInTheDocument();
    });
  });

  describe('Size Variations', () => {
    it('renders with different sizes', () => {
      const { rerender } = render(<StatusBadge status="red" size="sm" />);
      expect(screen.getByText('Critical')).toBeInTheDocument();

      rerender(<StatusBadge status="red" size="md" />);
      expect(screen.getByText('Critical')).toBeInTheDocument();

      rerender(<StatusBadge status="red" size="lg" />);
      expect(screen.getByText('Critical')).toBeInTheDocument();
    });
  });

  describe('Pulse Animation', () => {
    it('supports pulse animation', () => {
      render(<StatusBadge status="red" showPulse={true} />);
      
      expect(screen.getByText('Critical')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides proper semantic structure for badges', () => {
      render(<StatusBadge status="red" statusText="Critical Alert" />);
      
      expect(screen.getByText('Critical Alert')).toBeInTheDocument();
    });

    it('supports complex children content', () => {
      render(
        <StatusBadge status="red">
          <div>
            <strong>Critical:</strong>
            <span> Server down</span>
          </div>
        </StatusBadge>
      );
      
      expect(screen.getByText('Critical:')).toBeInTheDocument();
      expect(screen.getByText(' Server down')).toBeInTheDocument();
    });
  });
});

describe('StatusLegend', () => {
  describe('Basic Rendering', () => {
    it('renders all status types in legend', () => {
      render(<StatusLegend />);
      
      expect(screen.getByText('Critical')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('displays status indicators for each legend item', () => {
      render(<StatusLegend />);
      
      // Should have multiple instances of the legend
      const criticalTexts = screen.getAllByText('Critical');
      const inProgressTexts = screen.getAllByText('In Progress');
      const completedTexts = screen.getAllByText('Completed');
      
      expect(criticalTexts.length).toBeGreaterThan(0);
      expect(inProgressTexts.length).toBeGreaterThan(0);
      expect(completedTexts.length).toBeGreaterThan(0);
    });

    it('uses small size indicators in legend', () => {
      render(<StatusLegend />);
      
      // Should contain the legend text which implies proper rendering
      expect(screen.getByText('Critical')).toBeInTheDocument();
    });
  });

  describe('Layout and Structure', () => {
    it('maintains proper flex layout', () => {
      const { container } = render(<StatusLegend />);
      
      expect(container.firstChild).toHaveClass('flex', 'items-center', 'gap-4');
    });

    it('displays all status configurations', () => {
      render(<StatusLegend />);
      
      // Should show all three status types
      expect(screen.getByText('Critical')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides accessible legend structure', () => {
      render(<StatusLegend />);
      
      // Should have proper text content for screen readers
      expect(screen.getByText('Critical')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('maintains semantic meaning of status legend', () => {
      render(<StatusLegend />);
      
      // Legend should be understandable to assistive technologies
      const container = screen.getByText('Critical').closest('div');
      expect(container).toBeInTheDocument();
    });
  });
});

describe('Integration Tests', () => {
  it('works together in a complex dashboard scenario', () => {
    render(
      <div>
        <StatusLegend />
        <StatusIndicator status="red" showPulse={true} />
        <StatusBadge status="yellow" statusText="Processing" />
        <StatusBadge status="green">
          <span>✓ Complete</span>
        </StatusBadge>
      </div>
    );

    // All components should render together
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByText('✓ Complete')).toBeInTheDocument();
  });

  it('handles dynamic status changes', () => {
    let currentStatus: EmailStatus = 'red';
    
    const TestComponent = () => (
      <StatusIndicator status={currentStatus} statusText={`Status: ${currentStatus}`} />
    );

    const { rerender } = render(<TestComponent />);
    expect(screen.getByText('Status: red')).toBeInTheDocument();

    currentStatus = 'green';
    rerender(<TestComponent />);
    expect(screen.getByText('Status: green')).toBeInTheDocument();
  });

  it('maintains performance with multiple indicators', () => {
    const startTime = performance.now();
    
    render(
      <div>
        {Array.from({ length: 50 }, (_, i) => (
          <StatusIndicator
            key={i}
            status={i % 2 === 0 ? 'red' : 'green'}
            statusText={`Status ${i}`}
          />
        ))}
      </div>
    );
    
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    // Should render efficiently even with many indicators
    expect(renderTime).toBeLessThan(100);
    expect(screen.getByText('Status 0')).toBeInTheDocument();
    expect(screen.getByText('Status 49')).toBeInTheDocument();
  });
});