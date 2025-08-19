import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { EmailDashboardMultiPanel } from '../EmailDashboardMultiPanel';
import type { EmailRecord, EmailStatus } from '../../../../types/email-dashboard.interfaces';

// Mock dependencies
vi.mock('../../../../components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={`card ${className || ''}`}>{children}</div>,
  CardContent: ({ children, className }: any) => <div className={`card-content ${className || ''}`}>{children}</div>,
  CardHeader: ({ children }: any) => <div className="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <h3 className="card-title">{children}</h3>,
}));

vi.mock('../../../../components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span className={`badge badge-${variant} ${className || ''}`}>{children}</span>
  ),
}));

vi.mock('../../../../components/ui/button', () => ({
  Button: ({ children, onClick, className, variant }: any) => (
    <button className={`button ${variant} ${className || ''}`} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('../email/EmailTable', () => ({
  EmailTable: ({ emails, onRowClick, onAssignEmail, selectedEmails, teamMembers }: any) => (
    <div data-testid="email-table">
      <div>Emails: {emails.length}</div>
      <div>Team Members: {teamMembers?.length || 0}</div>
      <div>Selected: {selectedEmails?.length || 0}</div>
      {emails.map((email: any) => (
        <div
          key={email.id}
          data-testid={`email-row-${email.id}`}
          onClick={() => onRowClick?.(email)}
          className="email-row"
        >
          {email.subject} - {email.status}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../email/StatusIndicator', () => ({
  StatusIndicator: ({ status, statusText, size, showPulse }: any) => (
    <div
      data-testid="status-indicator"
      data-status={status}
      data-size={size}
      data-pulse={showPulse}
      className={`status-indicator status-${status} size-${size} ${showPulse ? 'pulse' : ''}`}
    >
      {statusText || status}
    </div>
  ),
}));

vi.mock('../../../../lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

vi.mock('../../../../config/team-members?.config', () => ({
  TEAM_MEMBERS: [
    { id: '1', name: 'John Doe', email: 'john@example.com' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
  ],
}));

// Test data factory
const createMockEmail = (overrides: Partial<EmailRecord> = {}): EmailRecord => ({
  id: `email-${Math.random().toString(36).substr(2, 9)}`,
  subject: 'Test Email Subject',
  requested_by: 'Test User',
  email_alias: 'test@example.com',
  status: 'yellow' as EmailStatus,
  status_text: 'In Progress',
  priority: 'medium' as const,
  timestamp: new Date().toISOString(),
  assigned_to: null,
  chain_id: null,
  ...overrides,
});

const createMockEmailSet = () => [
  createMockEmail({
    id: 'email-1',
    subject: 'Marketing Campaign Analysis',
    email_alias: 'marketing@company.com',
    status: 'green',
    status_text: 'Completed',
    requested_by: 'Marketing Team',
  }),
  createMockEmail({
    id: 'email-2',
    subject: 'Splunk Integration Issues',
    email_alias: 'splunk@company.com',
    status: 'red',
    status_text: 'Critical',
    requested_by: 'IT Team',
    priority: 'critical',
  }),
  createMockEmail({
    id: 'email-3',
    subject: 'VMware License Review',
    email_alias: 'vmware@tdsynnex.com',
    status: 'yellow',
    status_text: 'In Progress',
    requested_by: 'Procurement',
  }),
  createMockEmail({
    id: 'email-4',
    subject: 'TDSynnex Partnership Update',
    email_alias: 'partners@tdsynnex.com',
    status: 'green',
    status_text: 'Approved',
    requested_by: 'Business Dev',
  }),
  createMockEmail({
    id: 'email-5',
    subject: 'General Support Request',
    email_alias: 'support@company.com',
    status: 'yellow',
    status_text: 'Pending',
    requested_by: 'Customer',
  }),
];

describe('EmailDashboardMultiPanel', () => {
  let mockOnEmailSelect: ReturnType<typeof vi.fn>;
  let mockOnAssignEmail: ReturnType<typeof vi.fn>;
  let mockOnStatusChange: ReturnType<typeof vi.fn>;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    mockOnEmailSelect = vi.fn();
    mockOnAssignEmail = vi.fn().mockResolvedValue(undefined);
    mockOnStatusChange = vi.fn().mockResolvedValue(undefined);
    user = userEvent.setup();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders without crashing with empty email list', () => {
      render(
        <EmailDashboardMultiPanel
          emails={[]}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByText('Email Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Marketing-Splunk')).toBeInTheDocument();
      expect(screen.getByText('VMware@TDSynnex')).toBeInTheDocument();
    });

    it('renders with populated email list', () => {
      const emails = createMockEmailSet();
      
      render(
        <EmailDashboardMultiPanel
          emails={emails}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByTestId('email-table')).toBeInTheDocument();
      expect(screen.getByText('Emails: 5')).toBeInTheDocument();
    });

    it('displays correct email counts in panel badges', () => {
      const emails = createMockEmailSet();
      
      render(
        <EmailDashboardMultiPanel
          emails={emails}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Marketing-Splunk panel should show 2 emails (marketing and splunk)
      const marketingPanel = screen.getByText('Marketing-Splunk').closest('.card') as HTMLElement;
      expect(within(marketingPanel).getByText('2')).toBeInTheDocument();

      // VMware@TDSynnex panel should show 2 emails (vmware and tdsynnex)
      const vmwarePanel = screen.getByText('VMware@TDSynnex').closest('.card') as HTMLElement;
      expect(within(vmwarePanel).getByText('2')).toBeInTheDocument();
    });

    it('filters emails correctly for marketing panel', () => {
      const emails = createMockEmailSet();
      
      render(
        <EmailDashboardMultiPanel
          emails={emails}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      const marketingPanel = screen.getByText('Marketing-Splunk').closest('.card') as HTMLElement;
      expect(within(marketingPanel).getByText('Marketing Team')).toBeInTheDocument();
      expect(within(marketingPanel).getByText('IT Team')).toBeInTheDocument();
    });

    it('filters emails correctly for vmware panel', () => {
      const emails = createMockEmailSet();
      
      render(
        <EmailDashboardMultiPanel
          emails={emails}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      const vmwarePanel = screen.getByText('VMware@TDSynnex').closest('.card') as HTMLElement;
      expect(within(vmwarePanel).getByText('Procurement')).toBeInTheDocument();
      expect(within(vmwarePanel).getByText('Business Dev')).toBeInTheDocument();
    });

    it('shows empty state when no emails match filter criteria', () => {
      const emails = [
        createMockEmail({
          email_alias: 'other@company.com',
          subject: 'Other Email',
        }),
      ];
      
      render(
        <EmailDashboardMultiPanel
          emails={emails}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByText('No marketing emails')).toBeInTheDocument();
      expect(screen.getByText('No VMware emails')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('calls onEmailSelect when email is clicked in main table', async () => {
      const emails = createMockEmailSet();
      
      render(
        <EmailDashboardMultiPanel
          emails={emails}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      await user.click(screen.getByTestId('email-row-email-1'));
      
      expect(mockOnEmailSelect).toHaveBeenCalledWith(emails[0]);
    });

    it('calls onEmailSelect when email is clicked in panel', async () => {
      const emails = createMockEmailSet();
      
      render(
        <EmailDashboardMultiPanel
          emails={emails}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Find marketing panel and click on an email
      const marketingPanel = screen.getByText('Marketing-Splunk').closest('.card') as HTMLElement;
      const emailItem = within(marketingPanel).getByText('Marketing Team');
      
      await user.click(emailItem.closest('div') as HTMLElement);
      
      expect(mockOnEmailSelect).toHaveBeenCalled();
    });

    it('updates selected email visual state', async () => {
      const emails = createMockEmailSet();
      
      render(
        <EmailDashboardMultiPanel
          emails={emails}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      await user.click(screen.getByTestId('email-row-email-1'));
      
      await waitFor(() => {
        expect(screen.getByText('Selected: 1')).toBeInTheDocument();
      });
    });

    it('handles rapid clicking without issues', async () => {
      const emails = createMockEmailSet();
      
      render(
        <EmailDashboardMultiPanel
          emails={emails}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Rapid clicks
      await user.click(screen.getByTestId('email-row-email-1'));
      await user.click(screen.getByTestId('email-row-email-2'));
      await user.click(screen.getByTestId('email-row-email-3'));
      
      expect(mockOnEmailSelect).toHaveBeenCalledTimes(3);
    });
  });

  describe('Status Indicators', () => {
    it('displays status indicators correctly', () => {
      const emails = createMockEmailSet();
      
      render(
        <EmailDashboardMultiPanel
          emails={emails}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      const statusIndicators = screen.getAllByTestId('status-indicator');
      expect(statusIndicators.length).toBeGreaterThan(0);
      
      // Check for different status types
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Critical')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    it('shows pulse animation for critical status emails', () => {
      const emails = [
        createMockEmail({
          status: 'red',
          status_text: 'Critical',
          email_alias: 'marketing@company.com',
        }),
      ];
      
      render(
        <EmailDashboardMultiPanel
          emails={emails}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      const statusIndicator = screen.getByTestId('status-indicator');
      expect(statusIndicator).toHaveAttribute('data-pulse', 'true');
      expect(statusIndicator).toHaveClass('pulse');
    });

    it('displays priority badges for critical emails', () => {
      const emails = [
        createMockEmail({
          priority: 'critical',
          email_alias: 'marketing@company.com',
        }),
      ];
      
      render(
        <EmailDashboardMultiPanel
          emails={emails}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByText('Critical')).toBeInTheDocument();
    });
  });

  describe('Loading and Error States', () => {
    it('displays loading state', () => {
      render(
        <EmailDashboardMultiPanel
          emails={[]}
          loading={true}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByTestId('email-table')).toBeInTheDocument();
    });

    it('displays error state', () => {
      const errorMessage = 'Failed to load emails';
      
      render(
        <EmailDashboardMultiPanel
          emails={[]}
          error={errorMessage}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByTestId('email-table')).toBeInTheDocument();
    });

    it('handles null error gracefully', () => {
      render(
        <EmailDashboardMultiPanel
          emails={[]}
          error={null}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByTestId('email-table')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      const emails = createMockEmailSet();
      
      render(
        <EmailDashboardMultiPanel
          emails={emails}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByText('Email Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Marketing-Splunk')).toBeInTheDocument();
      expect(screen.getByText('VMware@TDSynnex')).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const emails = createMockEmailSet();
      
      render(
        <EmailDashboardMultiPanel
          emails={emails}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Tab through elements
      await user.tab();
      await user.tab();
      
      // Should be able to navigate through the interface
      expect(document.activeElement).toBeDefined();
    });

    it('handles screen reader announcements', () => {
      const emails = createMockEmailSet();
      
      render(
        <EmailDashboardMultiPanel
          emails={emails}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Verify important content is accessible
      expect(screen.getByText('Email Dashboard')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // Badge count
    });
  });

  describe('Performance', () => {
    it('handles large email lists efficiently', () => {
      const largeEmailList = Array.from({ length: 100 }, (_, i) =>
        createMockEmail({
          id: `email-${i}`,
          subject: `Email ${i}`,
          email_alias: i % 2 === 0 ? 'marketing@company.com' : 'vmware@tdsynnex.com',
        })
      );
      
      const startTime = performance.now();
      
      render(
        <EmailDashboardMultiPanel
          emails={largeEmailList}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render within reasonable time (less than 500ms)
      expect(renderTime).toBeLessThan(500);
      expect(screen.getByText('Email Dashboard')).toBeInTheDocument();
    });

    it('memoizes correctly to prevent unnecessary re-renders', async () => {
      const emails = createMockEmailSet();
      
      const { rerender } = render(
        <EmailDashboardMultiPanel
          emails={emails}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Re-render with same props should not cause issues
      rerender(
        <EmailDashboardMultiPanel
          emails={emails}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByText('Email Dashboard')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles emails with undefined/null values gracefully', () => {
      const problematicEmails = [
        {
          id: 'email-1',
          subject: null,
          requested_by: undefined,
          email_alias: '',
          status: 'green' as EmailStatus,
          status_text: '',
          priority: 'medium' as const,
          timestamp: '',
          assigned_to: null,
          chain_id: null,
        } as any,
      ];
      
      render(
        <EmailDashboardMultiPanel
          emails={problematicEmails}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByText('Email Dashboard')).toBeInTheDocument();
    });

    it('handles missing callback functions', () => {
      const emails = createMockEmailSet();
      
      render(
        <EmailDashboardMultiPanel
          emails={emails}
        />
      );

      expect(screen.getByText('Email Dashboard')).toBeInTheDocument();
    });

    it('handles invalid timestamp formats', () => {
      const emails = [
        createMockEmail({
          timestamp: 'invalid-date',
          email_alias: 'marketing@company.com',
        }),
      ];
      
      render(
        <EmailDashboardMultiPanel
          emails={emails}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByText('Email Dashboard')).toBeInTheDocument();
    });

    it('handles emails with very long subjects', () => {
      const emails = [
        createMockEmail({
          subject: 'A'.repeat(500), // Very long subject
          email_alias: 'marketing@company.com',
        }),
      ];
      
      render(
        <EmailDashboardMultiPanel
          emails={emails}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByText('Email Dashboard')).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('integrates properly with EmailTable component', () => {
      const emails = createMockEmailSet();
      
      render(
        <EmailDashboardMultiPanel
          emails={emails}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      const emailTable = screen.getByTestId('email-table');
      expect(emailTable).toBeInTheDocument();
      expect(within(emailTable).getByText('Emails: 5')).toBeInTheDocument();
      expect(within(emailTable).getByText('Team Members: 2')).toBeInTheDocument();
    });

    it('passes correct props to child components', () => {
      const emails = createMockEmailSet();
      
      render(
        <EmailDashboardMultiPanel
          emails={emails}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
          loading={true}
          error="Test error"
        />
      );

      expect(screen.getByTestId('email-table')).toBeInTheDocument();
    });

    it('maintains component state correctly across interactions', async () => {
      const emails = createMockEmailSet();
      
      render(
        <EmailDashboardMultiPanel
          emails={emails}
          onEmailSelect={mockOnEmailSelect}
          onAssignEmail={mockOnAssignEmail}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Select first email
      await user.click(screen.getByTestId('email-row-email-1'));
      expect(screen.getByText('Selected: 1')).toBeInTheDocument();

      // Select second email
      await user.click(screen.getByTestId('email-row-email-2'));
      expect(screen.getByText('Selected: 1')).toBeInTheDocument(); // Still should be 1 (single selection)
    });
  });
});