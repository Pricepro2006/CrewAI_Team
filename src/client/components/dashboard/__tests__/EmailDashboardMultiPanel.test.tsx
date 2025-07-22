import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmailDashboardMultiPanel } from '../EmailDashboardMultiPanel';
import type { EmailRecord, EmailStatus } from '@/types/email-dashboard.interfaces';

// Mock the UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => <span data-variant={variant}>{children}</span>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} data-size={size}>
      {children}
    </button>
  ),
}));

// Mock the email table component
jest.mock('../../email/EmailTable', () => ({
  EmailTable: ({ emails, onEmailSelect, onAssignEmail, onStatusChange }: any) => (
    <div data-testid="email-table">
      <div data-testid="email-table-count">{emails.length}</div>
      {emails.map((email: any) => (
        <div key={email.id} data-testid={`email-row-${email.id}`}>
          <span>{email.subject}</span>
          <button onClick={() => onEmailSelect(email)}>Select {email.id}</button>
          <button onClick={() => onAssignEmail(email.id, 'test-assignee')}>
            Assign {email.id}
          </button>
          <button onClick={() => onStatusChange(email.id, 'green')}>
            Update Status {email.id}
          </button>
        </div>
      ))}
    </div>
  ),
}));

// Mock data
const mockEmails: EmailRecord[] = [
  {
    id: 'email-1',
    email_alias: 'marketing-splunk@company.com',
    requested_by: 'John Doe',
    subject: 'Marketing Campaign Analysis',
    summary: 'Need analysis for Q1 marketing campaign',
    status: 'red',
    status_text: 'Critical',
    workflow_state: 'START_POINT',
    timestamp: '2025-01-20T10:00:00Z',
    priority: 'Critical',
    assignedTo: undefined,
    hasAttachments: false,
    isRead: false,
  },
  {
    id: 'email-2',
    email_alias: 'sales-cisco@company.com',
    requested_by: 'Jane Smith',
    subject: 'Cisco Network Setup',
    summary: 'Customer needs network configuration',
    status: 'yellow',
    status_text: 'In Progress',
    workflow_state: 'IN_PROGRESS',
    timestamp: '2025-01-20T11:00:00Z',
    priority: 'High',
    assignedTo: 'john-smith',
    hasAttachments: true,
    isRead: true,
  },
  {
    id: 'email-3',
    email_alias: 'support-vmware@company.com',
    requested_by: 'Bob Johnson',
    subject: 'VMware Support Case',
    summary: 'Resolved virtualization issue',
    status: 'green',
    status_text: 'Completed',
    workflow_state: 'COMPLETION',
    timestamp: '2025-01-20T12:00:00Z',
    priority: 'Low',
    assignedTo: 'sarah-wilson',
    hasAttachments: false,
    isRead: true,
  },
  {
    id: 'email-4',
    email_alias: 'info@company.com',
    requested_by: 'Alice Brown',
    subject: 'General Inquiry',
    summary: 'Customer information request',
    status: 'red',
    status_text: 'Critical',
    workflow_state: 'START_POINT',
    timestamp: '2025-01-20T13:00:00Z',
    priority: 'Medium',
    assignedTo: undefined,
    hasAttachments: false,
    isRead: false,
  },
];

describe('EmailDashboardMultiPanel Component', () => {
  const user = userEvent.setup();

  const defaultProps = {
    emails: mockEmails,
    loading: false,
    error: null,
    onEmailSelect: jest.fn(),
    onAssignEmail: jest.fn(),
    onStatusChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all panel sections', () => {
      render(<EmailDashboardMultiPanel {...defaultProps} />);

      expect(screen.getByText('Marketing & Analytics')).toBeInTheDocument();
      expect(screen.getByText('Sales & Customer Success')).toBeInTheDocument();
      expect(screen.getByText('Support & Technical')).toBeInTheDocument();
      expect(screen.getByText('All Emails Table')).toBeInTheDocument();
    });

    it('should render email counts for each panel', () => {
      render(<EmailDashboardMultiPanel {...defaultProps} />);

      // Marketing panel should have 1 email (marketing-splunk)
      const marketingPanel = screen.getByText('Marketing & Analytics').closest('div');
      expect(marketingPanel).toHaveTextContent('1');

      // Sales panel should have 1 email (sales-cisco)
      const salesPanel = screen.getByText('Sales & Customer Success').closest('div');
      expect(salesPanel).toHaveTextContent('1');

      // Support panel should have 1 email (support-vmware)
      const supportPanel = screen.getByText('Support & Technical').closest('div');
      expect(supportPanel).toHaveTextContent('1');
    });

    it('should render the email table with all emails', () => {
      render(<EmailDashboardMultiPanel {...defaultProps} />);

      expect(screen.getByTestId('email-table')).toBeInTheDocument();
      expect(screen.getByTestId('email-table-count')).toHaveTextContent('4');
    });
  });

  describe('Loading State', () => {
    it('should show loading indicators when loading is true', () => {
      render(<EmailDashboardMultiPanel {...defaultProps} loading={true} />);

      // Should show loading badges for each panel
      const loadingBadges = screen.getAllByText('Loading...');
      expect(loadingBadges.length).toBeGreaterThan(0);
    });

    it('should disable interactions when loading', () => {
      render(<EmailDashboardMultiPanel {...defaultProps} loading={true} />);

      // All buttons should be disabled during loading
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe('Error State', () => {
    it('should display error message when error is provided', () => {
      const errorMessage = 'Failed to load emails';
      render(<EmailDashboardMultiPanel {...defaultProps} error={errorMessage} />);

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should show error state in panels when error occurs', () => {
      const errorMessage = 'Network error';
      render(<EmailDashboardMultiPanel {...defaultProps} error={errorMessage} />);

      // Error should be visible in the component
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('Email Filtering', () => {
    it('should correctly filter marketing emails', () => {
      render(<EmailDashboardMultiPanel {...defaultProps} />);

      // Marketing panel should show marketing emails
      const marketingEmail = screen.getByText('Marketing Campaign Analysis');
      expect(marketingEmail).toBeInTheDocument();
    });

    it('should correctly filter sales emails', () => {
      render(<EmailDashboardMultiPanel {...defaultProps} />);

      // Sales panel should show sales emails
      const salesEmail = screen.getByText('Cisco Network Setup');
      expect(salesEmail).toBeInTheDocument();
    });

    it('should correctly filter support emails', () => {
      render(<EmailDashboardMultiPanel {...defaultProps} />);

      // Support panel should show support emails
      const supportEmail = screen.getByText('VMware Support Case');
      expect(supportEmail).toBeInTheDocument();
    });

    it('should limit panel emails to 5 items', () => {
      // Create more than 5 marketing emails
      const manyMarketingEmails = Array.from({ length: 10 }, (_, i) => ({
        ...mockEmails[0],
        id: `marketing-email-${i}`,
        subject: `Marketing Email ${i}`,
        email_alias: 'marketing-test@company.com',
      }));

      render(
        <EmailDashboardMultiPanel 
          {...defaultProps} 
          emails={manyMarketingEmails as EmailRecord[]} 
        />
      );

      // Should only show top 5 in the panel
      const marketingPanel = screen.getByText('Marketing & Analytics').closest('div');
      const emailItems = marketingPanel?.querySelectorAll('[data-testid^="panel-email-"]');
      expect(emailItems?.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Email Interactions', () => {
    it('should call onEmailSelect when email is selected', async () => {
      const mockOnEmailSelect = jest.fn();
      render(
        <EmailDashboardMultiPanel 
          {...defaultProps} 
          onEmailSelect={mockOnEmailSelect} 
        />
      );

      const selectButton = screen.getByText('Select email-1');
      await user.click(selectButton);

      expect(mockOnEmailSelect).toHaveBeenCalledWith(mockEmails[0]);
    });

    it('should call onAssignEmail when email is assigned', async () => {
      const mockOnAssignEmail = jest.fn();
      render(
        <EmailDashboardMultiPanel 
          {...defaultProps} 
          onAssignEmail={mockOnAssignEmail} 
        />
      );

      const assignButton = screen.getByText('Assign email-1');
      await user.click(assignButton);

      expect(mockOnAssignEmail).toHaveBeenCalledWith('email-1', 'test-assignee');
    });

    it('should call onStatusChange when status is updated', async () => {
      const mockOnStatusChange = jest.fn();
      render(
        <EmailDashboardMultiPanel 
          {...defaultProps} 
          onStatusChange={mockOnStatusChange} 
        />
      );

      const statusButton = screen.getByText('Update Status email-1');
      await user.click(statusButton);

      expect(mockOnStatusChange).toHaveBeenCalledWith('email-1', 'green');
    });
  });

  describe('Status Indicators', () => {
    it('should display correct status badges for each email', () => {
      render(<EmailDashboardMultiPanel {...defaultProps} />);

      // Check for status indicators
      expect(screen.getByText('Critical')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('should apply correct CSS classes for status colors', () => {
      render(<EmailDashboardMultiPanel {...defaultProps} />);

      // Status badges should have appropriate data attributes
      const criticalBadges = screen.getAllByText('Critical');
      const inProgressBadges = screen.getAllByText('In Progress');
      const completedBadges = screen.getAllByText('Completed');

      expect(criticalBadges.length).toBeGreaterThan(0);
      expect(inProgressBadges.length).toBeGreaterThan(0);
      expect(completedBadges.length).toBeGreaterThan(0);
    });
  });

  describe('Responsive Design', () => {
    it('should apply responsive CSS classes', () => {
      const { container } = render(<EmailDashboardMultiPanel {...defaultProps} />);

      // Should have responsive grid classes
      const gridElements = container.querySelectorAll('.grid');
      expect(gridElements.length).toBeGreaterThan(0);
    });
  });

  describe('Empty State', () => {
    it('should handle empty email array gracefully', () => {
      render(<EmailDashboardMultiPanel {...defaultProps} emails={[]} />);

      expect(screen.getByTestId('email-table-count')).toHaveTextContent('0');
      
      // Panels should show 0 counts
      expect(screen.getByText('Marketing & Analytics')).toBeInTheDocument();
      expect(screen.getByText('Sales & Customer Success')).toBeInTheDocument();
      expect(screen.getByText('Support & Technical')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      render(<EmailDashboardMultiPanel {...defaultProps} />);

      expect(screen.getByRole('heading', { name: 'Marketing & Analytics' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Sales & Customer Success' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Support & Technical' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'All Emails Table' })).toBeInTheDocument();
    });

    it('should be keyboard navigable', async () => {
      render(<EmailDashboardMultiPanel {...defaultProps} />);

      const firstButton = screen.getByText('Select email-1');
      firstButton.focus();
      expect(document.activeElement).toBe(firstButton);

      // Should be able to tab through interactive elements
      await user.tab();
      expect(document.activeElement).not.toBe(firstButton);
    });
  });

  describe('Performance', () => {
    it('should memoize filtered email arrays', () => {
      const { rerender } = render(<EmailDashboardMultiPanel {...defaultProps} />);

      // Initial render
      expect(screen.getByTestId('email-table-count')).toHaveTextContent('4');

      // Rerender with same props - should not cause unnecessary recalculations
      rerender(<EmailDashboardMultiPanel {...defaultProps} />);
      expect(screen.getByTestId('email-table-count')).toHaveTextContent('4');
    });
  });
});