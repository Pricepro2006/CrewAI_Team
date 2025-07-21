import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTRPCMsw } from 'msw-trpc';
import { setupServer } from 'msw/node';
import { trpc } from '@/utils/trpc';
import { httpBatchLink } from '@trpc/client';
import { EmailDashboardDemo } from '../EmailDashboardDemo';
import type { AppRouter } from '../../../api/trpc/router';

// Mock the EmailDashboardMultiPanel component
jest.mock('../../components/dashboard/EmailDashboardMultiPanel', () => ({
  EmailDashboardMultiPanel: ({ 
    emails, 
    loading, 
    error, 
    onEmailSelect, 
    onAssignEmail, 
    onStatusChange 
  }: any) => (
    <div data-testid="email-dashboard-multi-panel">
      <div data-testid="loading-state">{loading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="error-state">{error || 'No Error'}</div>
      <div data-testid="email-count">{emails.length}</div>
      {emails.map((email: any) => (
        <div key={email.id} data-testid={`email-${email.id}`}>
          <span>{email.subject}</span>
          <button onClick={() => onEmailSelect(email)}>Select</button>
          <button onClick={() => onAssignEmail(email.id, 'john-smith')}>Assign</button>
          <button onClick={() => onStatusChange(email.id, 'green')}>Complete</button>
        </div>
      ))}
    </div>
  ),
}));

// Mock data
const mockEmailsData = {
  success: true,
  data: {
    emails: [
      {
        id: 'email-1',
        email_alias: 'test@company.com',
        requested_by: 'John Doe',
        subject: 'Test Email 1',
        summary: 'Test summary 1',
        status: 'red' as const,
        status_text: 'Critical',
        workflow_state: 'START_POINT' as const,
        timestamp: '2025-01-20T10:00:00Z',
        priority: 'High' as const,
        assignedTo: undefined,
        has_attachments: false,
        is_read: false,
        received_date: '2025-01-20T10:00:00Z',
      },
      {
        id: 'email-2',
        email_alias: 'test2@company.com',
        requested_by: 'Jane Smith',
        subject: 'Test Email 2',
        summary: 'Test summary 2',
        status: 'yellow' as const,
        status_text: 'In Progress',
        workflow_state: 'IN_PROGRESS' as const,
        timestamp: '2025-01-20T11:00:00Z',
        priority: 'Medium' as const,
        assignedTo: 'john-smith',
        has_attachments: true,
        is_read: true,
        received_date: '2025-01-20T11:00:00Z',
      },
    ],
    totalCount: 2,
    page: 1,
    pageSize: 100,
  },
};

const mockTeamMembers = [
  {
    id: 'john-smith',
    name: 'John Smith',
    email: 'john.smith@company.com',
    role: 'Senior Engineer',
    teams: ['engineering'],
  },
];

// Setup MSW
const mswTrpc = createTRPCMsw<AppRouter>();
const server = setupServer(
  mswTrpc.emails.getTableData.query(() => {
    return mockEmailsData;
  }),
  mswTrpc.emails.updateStatus.mutation(() => {
    return { success: true, message: 'Status updated successfully' };
  }),
  mswTrpc.emailAssignment.getTeamMembers.query(() => {
    return mockTeamMembers;
  }),
  mswTrpc.emailAssignment.assignEmail.mutation(() => {
    return { success: true, message: 'Email assigned successfully' };
  }),
  mswTrpc.emailAssignment.getWorkloadDistribution.query(() => {
    return [];
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Test wrapper component
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const trpcClient = trpc.createClient({
    links: [
      httpBatchLink({
        url: 'http://localhost:3000/api/trpc',
      }),
    ],
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
};

describe('EmailDashboardDemo Component', () => {
  const user = userEvent.setup();
  const Wrapper = createWrapper();

  describe('Rendering', () => {
    it('should render the dashboard header', async () => {
      render(<EmailDashboardDemo />, { wrapper: Wrapper });

      expect(screen.getByText('Email Dashboard Demo')).toBeInTheDocument();
      expect(
        screen.getByText('Multi-panel email tracking system with assignment capabilities')
      ).toBeInTheDocument();
    });

    it('should render refresh button', async () => {
      render(<EmailDashboardDemo />, { wrapper: Wrapper });

      expect(screen.getByText('Refresh Data')).toBeInTheDocument();
    });

    it('should render email dashboard multi-panel', async () => {
      render(<EmailDashboardDemo />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('email-dashboard-multi-panel')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading indicator when data is loading', async () => {
      render(<EmailDashboardDemo />, { wrapper: Wrapper });

      // Initially loading
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should show email count when data loads', async () => {
      render(<EmailDashboardDemo />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('email-count')).toHaveTextContent('2');
      });
    });

    it('should show refreshing indicator when refetching', async () => {
      render(<EmailDashboardDemo />, { wrapper: Wrapper });

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toHaveTextContent('Not Loading');
      });

      // Click refresh
      const refreshButton = screen.getByText('Refresh Data');
      await user.click(refreshButton);

      // Should show refreshing state briefly
      expect(screen.getByText('Refreshing...')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when email fetch fails', async () => {
      // Override handler to return error
      server.use(
        mswTrpc.emails.getTableData.query(() => {
          throw new Error('Network error occurred');
        })
      );

      render(<EmailDashboardDemo />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });

      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('should allow retrying after error', async () => {
      let shouldError = true;

      // Override handler to error first, then succeed
      server.use(
        mswTrpc.emails.getTableData.query(() => {
          if (shouldError) {
            shouldError = false;
            throw new Error('Network error occurred');
          }
          return mockEmailsData;
        })
      );

      render(<EmailDashboardDemo />, { wrapper: Wrapper });

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });

      // Click retry
      const retryButton = screen.getByText('Try Again');
      await user.click(retryButton);

      // Should load successfully
      await waitFor(() => {
        expect(screen.getByTestId('email-count')).toHaveTextContent('2');
      });
    });
  });

  describe('Success Messages', () => {
    it('should show success message after successful email assignment', async () => {
      render(<EmailDashboardDemo />, { wrapper: Wrapper });

      // Wait for emails to load
      await waitFor(() => {
        expect(screen.getByTestId('email-count')).toHaveTextContent('2');
      });

      // Click assign button
      const assignButton = screen.getAllByText('Assign')[0];
      await user.click(assignButton);

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText('Email assigned successfully!')).toBeInTheDocument();
      });
    });

    it('should show success message after successful status update', async () => {
      render(<EmailDashboardDemo />, { wrapper: Wrapper });

      // Wait for emails to load
      await waitFor(() => {
        expect(screen.getByTestId('email-count')).toHaveTextContent('2');
      });

      // Click complete button
      const completeButton = screen.getAllByText('Complete')[0];
      await user.click(completeButton);

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText('Email status updated successfully!')).toBeInTheDocument();
      });
    });

    it('should show success message after manual refresh', async () => {
      render(<EmailDashboardDemo />, { wrapper: Wrapper });

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toHaveTextContent('Not Loading');
      });

      // Click refresh
      const refreshButton = screen.getByText('Refresh Data');
      await user.click(refreshButton);

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText('Data refreshed successfully!')).toBeInTheDocument();
      });
    });
  });

  describe('Statistics Display', () => {
    it('should display correct email statistics', async () => {
      render(<EmailDashboardDemo />, { wrapper: Wrapper });

      // Wait for emails to load
      await waitFor(() => {
        expect(screen.getByTestId('email-count')).toHaveTextContent('2');
      });

      // Check statistics (based on mock data: 1 red, 1 yellow, 0 green, 1 unassigned)
      const statsCards = screen.getAllByText('1');
      expect(statsCards).toHaveLength(3); // Critical, Unassigned, and potentially others

      // Verify specific stats are present
      expect(screen.getByText('Critical')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Unassigned')).toBeInTheDocument();
    });

    it('should show loading skeletons for statistics while loading', async () => {
      render(<EmailDashboardDemo />, { wrapper: Wrapper });

      // Should show loading skeletons
      const loadingSkeletons = screen.getAllByRole('generic').filter(
        el => el.classList.contains('animate-pulse')
      );
      expect(loadingSkeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Email Interactions', () => {
    it('should handle email selection', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      render(<EmailDashboardDemo />, { wrapper: Wrapper });

      // Wait for emails to load
      await waitFor(() => {
        expect(screen.getByTestId('email-count')).toHaveTextContent('2');
      });

      // Click select button
      const selectButton = screen.getAllByText('Select')[0];
      await user.click(selectButton);

      expect(consoleSpy).toHaveBeenCalledWith('Selected email:', expect.objectContaining({
        id: 'email-1',
        subject: 'Test Email 1',
      }));

      consoleSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', async () => {
      render(<EmailDashboardDemo />, { wrapper: Wrapper });

      // Check for main heading
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Email Dashboard Demo');

      // Check for buttons
      expect(screen.getByRole('button', { name: 'Refresh Data' })).toBeInTheDocument();
    });

    it('should be keyboard navigable', async () => {
      render(<EmailDashboardDemo />, { wrapper: Wrapper });

      const refreshButton = screen.getByText('Refresh Data');
      
      // Focus should be able to reach the button
      refreshButton.focus();
      expect(document.activeElement).toBe(refreshButton);
    });
  });
});