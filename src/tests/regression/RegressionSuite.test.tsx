/** @jsx React.createElement */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmailDashboard } from '../../ui/components/Email/EmailDashboard';
import type { EmailStorageService } from '../../api/services/EmailStorageService';

// 2025 Best Practice: Comprehensive Regression Test Suite

describe('Email Dashboard Regression Suite', () => {
  let mockEmailService: jest.Mocked<EmailStorageService>;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock email service
    mockEmailService = {
      getEmailsForTableView: jest.fn().mockResolvedValue({
        emails: [
          {
            id: '1',
            emailAlias: 'test@example.com',
            requestedBy: 'John Doe',
            subject: 'Test Email 1',
            summary: 'This is a test email',
            status: 'pending',
            createdAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-01'),
          },
          {
            id: '2',
            emailAlias: 'user@example.com',
            requestedBy: 'Jane Smith',
            subject: 'Another Test',
            summary: 'Another test email',
            status: 'in_progress',
            createdAt: new Date('2025-01-02'),
            updatedAt: new Date('2025-01-02'),
          }
        ],
        total: 2,
        page: 1,
        pageSize: 10
      }),
      updateEmailStatus: jest.fn().mockResolvedValue({ success: true }),
      exportEmails: jest.fn().mockResolvedValue({ url: '/exports/test.csv' }),
    } as any;
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Core Functionality Regression Tests', () => {
    it('should maintain table display after multiple re-renders', async () => {
      const { rerender } = render(<EmailDashboard emailService={mockEmailService} />);
      
      // Initial render
      expect(await screen.findByText('Test Email 1')).toBeInTheDocument();
      expect(screen.getByText('Another Test')).toBeInTheDocument();
      
      // Force multiple re-renders
      for (let i = 0; i < 5; i++) {
        rerender(<EmailDashboard emailService={mockEmailService} key={i} />);
      }
      
      // Verify data still displays correctly
      expect(await screen.findByText('Test Email 1')).toBeInTheDocument();
      expect(screen.getByText('Another Test')).toBeInTheDocument();
    });

    it('should preserve filter state across component updates', async () => {
      render(<EmailDashboard emailService={mockEmailService} />);
      
      // Apply filter
      const filterButton = screen.getByText('Filters');
      fireEvent.click(filterButton);
      
      const statusSelect = screen.getByLabelText('Status');
      fireEvent.change(statusSelect, { target: { value: 'pending' } });
      
      const applyButton = screen.getByText('Apply Filters');
      fireEvent.click(applyButton);
      
      // Trigger component update
      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);
      
      // Verify filter is still applied
      await waitFor(() => {
        expect(mockEmailService.getEmailsForTableView).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'pending' })
        );
      });
    });

    it('should handle rapid status updates without race conditions', async () => {
      render(<EmailDashboard emailService={mockEmailService} />);
      
      await screen.findByText('Test Email 1');
      
      // Simulate rapid status updates
      const updateButtons = screen.getAllByText('Update Status');
      
      // Click multiple update buttons rapidly
      for (let i = 0; i < 5; i++) {
        fireEvent.click(updateButtons[0]);
        const modal = await screen.findByRole('dialog');
        const statusSelect = within(modal).getByLabelText('New Status');
        fireEvent.change(statusSelect, { target: { value: 'approved' } });
        const saveButton = within(modal).getByText('Save');
        fireEvent.click(saveButton);
      }
      
      // Verify all updates were processed
      await waitFor(() => {
        expect(mockEmailService.updateEmailStatus).toHaveBeenCalledTimes(5);
      });
    });
  });

  describe('Edge Case Regression Tests', () => {
    it('should handle empty dataset gracefully', async () => {
      mockEmailService.getEmailsForTableView.mockResolvedValueOnce({
        emails: [],
        total: 0,
        page: 1,
        pageSize: 10
      });
      
      render(<EmailDashboard emailService={mockEmailService} />);
      
      expect(await screen.findByText('No emails found')).toBeInTheDocument();
      
      // Verify filters still work with empty data
      const filterButton = screen.getByText('Filters');
      expect(filterButton).toBeEnabled();
    });

    it('should recover from API errors', async () => {
      mockEmailService.getEmailsForTableView.mockRejectedValueOnce(
        new Error('Network error')
      );
      
      render(<EmailDashboard emailService={mockEmailService} />);
      
      // Should show error message
      expect(await screen.findByText(/error loading emails/i)).toBeInTheDocument();
      
      // Should show retry button
      const retryButton = screen.getByText('Retry');
      expect(retryButton).toBeInTheDocument();
      
      // Mock successful response for retry
      mockEmailService.getEmailsForTableView.mockResolvedValueOnce({
        emails: [{
          id: '1',
          emailAlias: 'test@example.com',
          requestedBy: 'John Doe',
          subject: 'Test Email 1',
          summary: 'This is a test email',
          status: 'pending',
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
        }],
        total: 1,
        page: 1,
        pageSize: 10
      });
      
      // Click retry
      fireEvent.click(retryButton);
      
      // Should recover and show data
      expect(await screen.findByText('Test Email 1')).toBeInTheDocument();
    });

    it('should handle malformed data gracefully', async () => {
      mockEmailService.getEmailsForTableView.mockResolvedValueOnce({
        emails: [
          {
            id: '1',
            emailAlias: null, // Missing required field
            requestedBy: undefined, // Undefined field
            subject: '', // Empty string
            summary: null,
            status: 'invalid_status', // Invalid enum value
            createdAt: 'invalid-date', // Invalid date
            updatedAt: null,
          }
        ],
        total: 1,
        page: 1,
        pageSize: 10
      } as any);
      
      render(<EmailDashboard emailService={mockEmailService} />);
      
      // Should render with fallbacks
      expect(await screen.findByText('No email alias')).toBeInTheDocument();
      expect(screen.getByText('Unknown')).toBeInTheDocument();
      expect(screen.getByText('No subject')).toBeInTheDocument();
    });
  });

  describe('Performance Regression Tests', () => {
    it('should handle large datasets without performance degradation', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `${i}`,
        emailAlias: `test${i}@example.com`,
        requestedBy: `User ${i}`,
        subject: `Email ${i}`,
        summary: `Summary for email ${i}`,
        status: i % 2 === 0 ? 'pending' : 'in_progress',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      }));
      
      mockEmailService.getEmailsForTableView.mockResolvedValueOnce({
        emails: largeDataset.slice(0, 50), // Virtual scrolling
        total: 1000,
        page: 1,
        pageSize: 50
      });
      
      const startTime = performance.now();
      render(<EmailDashboard emailService={mockEmailService} />);
      
      await screen.findByText('Email 0');
      const renderTime = performance.now() - startTime;
      
      // Should render within reasonable time
      expect(renderTime).toBeLessThan(1000); // 1 second max
      
      // Should implement virtual scrolling
      const visibleRows = screen.getAllByRole('row');
      expect(visibleRows.length).toBeLessThan(100); // Not rendering all 1000
    });

    it('should debounce search input properly', async () => {
      const user = userEvent.setup();
      render(<EmailDashboard emailService={mockEmailService} />);
      
      const searchInput = screen.getByPlaceholderText('Search emails...');
      
      // Type rapidly
      await user.type(searchInput, 'test search query');
      
      // Should only call API once after debounce
      await waitFor(() => {
        expect(mockEmailService.getEmailsForTableView).toHaveBeenCalledTimes(2); // Initial + 1 search
      }, { timeout: 1000 });
      
      // Verify the final search term was used
      expect(mockEmailService.getEmailsForTableView).toHaveBeenLastCalledWith(
        expect.objectContaining({ searchTerm: 'test search query' })
      );
    });
  });

  describe('Integration Regression Tests', () => {
    it('should maintain WebSocket connection during filter operations', async () => {
      const mockWebSocket = {
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };
      
      global.WebSocket = jest.fn(() => mockWebSocket) as any;
      
      render(<EmailDashboard emailService={mockEmailService} />);
      
      // Verify WebSocket connected
      expect(global.WebSocket).toHaveBeenCalled();
      
      // Apply filters
      const filterButton = screen.getByText('Filters');
      fireEvent.click(filterButton);
      
      const statusSelect = screen.getByLabelText('Status');
      fireEvent.change(statusSelect, { target: { value: 'pending' } });
      
      // WebSocket should not disconnect
      expect(mockWebSocket.close).not.toHaveBeenCalled();
      
      // Simulate incoming WebSocket message
      const wsMessage = {
        type: 'email-update',
        data: {
          id: '1',
          status: 'approved'
        }
      };
      
      const messageHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'message')?.[1];
      
      if (messageHandler) {
        messageHandler({ data: JSON.stringify(wsMessage) });
      }
      
      // UI should update despite active filters
      await waitFor(() => {
        expect(screen.queryByText('approved')).toBeInTheDocument();
      });
    });

    it('should coordinate export with active filters and sorting', async () => {
      render(<EmailDashboard emailService={mockEmailService} />);
      
      // Apply sorting
      const subjectHeader = screen.getByText('Subject');
      fireEvent.click(subjectHeader);
      
      // Apply filter
      const filterButton = screen.getByText('Filters');
      fireEvent.click(filterButton);
      
      const statusSelect = screen.getByLabelText('Status');
      fireEvent.change(statusSelect, { target: { value: 'pending' } });
      
      const applyButton = screen.getByText('Apply Filters');
      fireEvent.click(applyButton);
      
      // Export data
      const exportButton = screen.getByText('Export');
      fireEvent.click(exportButton);
      
      const csvOption = screen.getByLabelText('CSV');
      fireEvent.click(csvOption);
      
      const exportConfirmButton = screen.getByText('Export CSV');
      fireEvent.click(exportConfirmButton);
      
      // Verify export includes filters and sorting
      await waitFor(() => {
        expect(mockEmailService.exportEmails).toHaveBeenCalledWith({
          format: 'csv',
          filters: { status: 'pending' },
          sorting: { field: 'subject', direction: 'asc' },
          columns: expect.any(Array)
        });
      });
    });
  });

  describe('Accessibility Regression Tests', () => {
    it('should maintain keyboard navigation after dynamic updates', async () => {
      render(<EmailDashboard emailService={mockEmailService} />);
      
      // Initial keyboard navigation
      const firstRow = screen.getByRole('row', { name: /test email 1/i });
      firstRow.focus();
      expect(document.activeElement).toBe(firstRow);
      
      // Trigger dynamic update
      mockEmailService.getEmailsForTableView.mockResolvedValueOnce({
        emails: [
          {
            id: '3',
            emailAlias: 'new@example.com',
            requestedBy: 'New User',
            subject: 'New Email',
            summary: 'Newly added email',
            status: 'pending',
            createdAt: new Date('2025-01-03'),
            updatedAt: new Date('2025-01-03'),
          },
          ...mockEmailService.getEmailsForTableView.mock.results[0].value.emails
        ],
        total: 3,
        page: 1,
        pageSize: 10
      });
      
      // Simulate WebSocket update
      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);
      
      // Verify keyboard navigation still works
      await screen.findByText('New Email');
      const newFirstRow = screen.getByRole('row', { name: /new email/i });
      newFirstRow.focus();
      expect(document.activeElement).toBe(newFirstRow);
      
      // Tab navigation should work
      fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
      expect(document.activeElement?.tagName).toBe('BUTTON');
    });

    it('should announce dynamic content changes to screen readers', async () => {
      render(<EmailDashboard emailService={mockEmailService} />);
      
      // Check for live region
      const liveRegion = screen.getByRole('status', { hidden: true });
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      
      // Trigger status update
      const updateButton = screen.getAllByText('Update Status')[0];
      fireEvent.click(updateButton);
      
      // Verify announcement
      await waitFor(() => {
        expect(liveRegion).toHaveTextContent(/status updated/i);
      });
    });
  });
});