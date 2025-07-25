/** @jsx React.createElement */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmailDashboard } from "../../ui/components/Email/EmailDashboard";
import type { EmailStorageService } from "../../api/services/EmailStorageService";

// 2025 Best Practice: Comprehensive Regression Test Suite

describe("Email Dashboard Regression Suite", () => {
  let mockEmailService: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock email service
    mockEmailService = {
      getEmailsForTableView: vi.fn().mockResolvedValue({
        emails: [
          {
            id: "1",
            email_alias: "test@example.com",
            requested_by: "John Doe",
            subject: "Test Email 1",
            summary: "This is a test email",
            status: "pending",
            status_text: "Pending",
            workflow_state: "START_POINT",
            priority: "medium",
            received_date: "2025-01-01",
            is_read: false,
            has_attachments: false,
          },
          {
            id: "2",
            email_alias: "user@example.com",
            requested_by: "Jane Smith",
            subject: "Another Test",
            summary: "Another test email",
            status: "in_progress",
            status_text: "In Progress",
            workflow_state: "IN_PROGRESS",
            priority: "high",
            received_date: "2025-01-02",
            is_read: true,
            has_attachments: false,
          },
        ],
        totalCount: 2,
        totalPages: 1,
        page: 1,
        pageSize: 10,
      }),
      updateEmailStatus: vi.fn().mockResolvedValue({ success: true }),
      exportEmails: vi.fn().mockResolvedValue({ url: "/exports/test.csv" }),
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Core Functionality Regression Tests", () => {
    it("should maintain table display after multiple re-renders", async () => {
      const { rerender } = render(<EmailDashboard />);

      // Initial render
      expect(await screen.findByText("Test Email 1")).toBeInTheDocument();
      expect(screen.getByText("Another Test")).toBeInTheDocument();

      // Force multiple re-renders
      for (let i = 0; i < 5; i++) {
        rerender(<EmailDashboard key={i} />);
      }

      // Verify data still displays correctly
      expect(await screen.findByText("Test Email 1")).toBeInTheDocument();
      expect(screen.getByText("Another Test")).toBeInTheDocument();
    });

    it("should preserve filter state across component updates", async () => {
      render(<EmailDashboard />);

      // Apply filter
      const filterButton = screen.getByText("Filters");
      fireEvent.click(filterButton);

      const statusSelect = screen.getByLabelText("Status");
      fireEvent.change(statusSelect, { target: { value: "pending" } });

      const applyButton = screen.getByText("Apply Filters");
      fireEvent.click(applyButton);

      // Trigger component update
      const refreshButton = screen.getByText("Refresh");
      fireEvent.click(refreshButton);

      // Verify filter is still applied
      await waitFor(() => {
        expect(mockEmailService.getEmailsForTableView).toHaveBeenCalledWith(
          expect.objectContaining({ status: "pending" }),
        );
      });
    });

    it("should handle rapid status updates without race conditions", async () => {
      render(<EmailDashboard />);

      await screen.findByText("Test Email 1");

      // Simulate rapid status updates
      const updateButtons = screen.getAllByText("Update Status");

      // Click multiple update buttons rapidly
      for (let i = 0; i < 5; i++) {
        if (updateButtons[0]) {
          fireEvent.click(updateButtons[0]);
        }
        const modal = await screen.findByRole("dialog");
        const statusSelect = within(modal).getByLabelText("New Status");
        fireEvent.change(statusSelect, { target: { value: "approved" } });
        const saveButton = within(modal).getByText("Save");
        fireEvent.click(saveButton);
      }

      // Verify all updates were processed
      await waitFor(() => {
        expect(mockEmailService.updateEmailStatus).toHaveBeenCalledTimes(5);
      });
    });
  });

  describe("Edge Case Regression Tests", () => {
    it("should handle empty dataset gracefully", async () => {
      mockEmailService.getEmailsForTableView.mockResolvedValueOnce({
        emails: [],
        total: 0,
        page: 1,
        pageSize: 10,
      });

      render(<EmailDashboard />);

      expect(await screen.findByText("No emails found")).toBeInTheDocument();

      // Verify filters still work with empty data
      const filterButton = screen.getByText("Filters");
      expect(filterButton).toBeEnabled();
    });

    it("should recover from API errors", async () => {
      mockEmailService.getEmailsForTableView.mockRejectedValueOnce(
        new Error("Network error"),
      );

      render(<EmailDashboard />);

      // Should show error message
      expect(
        await screen.findByText(/error loading emails/i),
      ).toBeInTheDocument();

      // Should show retry button
      const retryButton = screen.getByText("Retry");
      expect(retryButton).toBeInTheDocument();

      // Mock successful response for retry
      mockEmailService.getEmailsForTableView.mockResolvedValueOnce({
        emails: [
          {
            id: "1",
            email_alias: "test@example.com",
            requested_by: "John Doe",
            subject: "Test Email 1",
            summary: "This is a test email",
            status: "pending",
            status_text: "Pending",
            workflow_state: "START_POINT",
            priority: "medium",
            received_date: "2025-01-01",
            is_read: false,
            has_attachments: false,
          },
        ],
        totalCount: 1,
        totalPages: 1,
        page: 1,
        pageSize: 10,
      });

      // Click retry
      fireEvent.click(retryButton);

      // Should recover and show data
      expect(await screen.findByText("Test Email 1")).toBeInTheDocument();
    });

    it("should handle malformed data gracefully", async () => {
      mockEmailService.getEmailsForTableView.mockResolvedValueOnce({
        emails: [
          {
            id: "1",
            email_alias: null, // Missing required field
            requested_by: undefined, // Undefined field
            subject: "", // Empty string
            summary: null,
            status: "invalid_status", // Invalid enum value
            status_text: "Invalid Status",
            workflow_state: "START_POINT",
            priority: "medium",
            received_date: "invalid-date",
            is_read: false,
            has_attachments: false,
          },
        ],
        totalCount: 1,
        totalPages: 1,
        page: 1,
        pageSize: 10,
      } as any);

      render(<EmailDashboard />);

      // Should render with fallbacks
      expect(await screen.findByText("No email alias")).toBeInTheDocument();
      expect(screen.getByText("Unknown")).toBeInTheDocument();
      expect(screen.getByText("No subject")).toBeInTheDocument();
    });
  });

  describe("Performance Regression Tests", () => {
    it("should handle large datasets without performance degradation", async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `${i}`,
        email_alias: `test${i}@example.com`,
        requested_by: `User ${i}`,
        subject: `Email ${i}`,
        summary: `Summary for email ${i}`,
        status: i % 2 === 0 ? "pending" : "in_progress",
        status_text: i % 2 === 0 ? "Pending" : "In Progress",
        workflow_state: i % 2 === 0 ? "START_POINT" : "IN_PROGRESS",
        priority: "medium",
        received_date: "2025-01-01",
        is_read: false,
        has_attachments: false,
      }));

      mockEmailService.getEmailsForTableView.mockResolvedValueOnce({
        emails: largeDataset.slice(0, 50), // Virtual scrolling
        totalCount: 1000,
        totalPages: 20,
        page: 1,
        pageSize: 50,
      });

      const startTime = performance.now();
      render(<EmailDashboard />);

      await screen.findByText("Email 0");
      const renderTime = performance.now() - startTime;

      // Should render within reasonable time
      expect(renderTime).toBeLessThan(1000); // 1 second max

      // Should implement virtual scrolling
      const visibleRows = screen.getAllByRole("row");
      expect(visibleRows.length).toBeLessThan(100); // Not rendering all 1000
    });

    it("should debounce search input properly", async () => {
      const user = userEvent.setup();
      render(<EmailDashboard />);

      const searchInput = screen.getByPlaceholderText("Search emails...");

      // Type rapidly
      await user.type(searchInput, "test search query");

      // Should only call API once after debounce
      await waitFor(
        () => {
          expect(mockEmailService.getEmailsForTableView).toHaveBeenCalledTimes(
            2,
          ); // Initial + 1 search
        },
        { timeout: 1000 },
      );

      // Verify the final search term was used
      expect(mockEmailService.getEmailsForTableView).toHaveBeenLastCalledWith(
        expect.objectContaining({ searchTerm: "test search query" }),
      );
    });
  });

  describe("Integration Regression Tests", () => {
    it("should maintain WebSocket connection during filter operations", async () => {
      const mockWebSocket = {
        send: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      global.WebSocket = vi.fn(() => mockWebSocket) as any;

      render(<EmailDashboard />);

      // Verify WebSocket connected
      expect(global.WebSocket).toHaveBeenCalled();

      // Apply filters
      const filterButton = screen.getByText("Filters");
      fireEvent.click(filterButton);

      const statusSelect = screen.getByLabelText("Status");
      fireEvent.change(statusSelect, { target: { value: "pending" } });

      // WebSocket should not disconnect
      expect(mockWebSocket.close).not.toHaveBeenCalled();

      // Simulate incoming WebSocket message
      const wsMessage = {
        type: "email-update",
        data: {
          id: "1",
          status: "approved",
        },
      };

      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        (call) => call[0] === "message",
      )?.[1];

      if (messageHandler) {
        messageHandler({ data: JSON.stringify(wsMessage) });
      }

      // UI should update despite active filters
      await waitFor(() => {
        expect(screen.queryByText("approved")).toBeInTheDocument();
      });
    });

    it("should coordinate export with active filters and sorting", async () => {
      render(<EmailDashboard />);

      // Apply sorting
      const subjectHeader = screen.getByText("Subject");
      fireEvent.click(subjectHeader);

      // Apply filter
      const filterButton = screen.getByText("Filters");
      fireEvent.click(filterButton);

      const statusSelect = screen.getByLabelText("Status");
      fireEvent.change(statusSelect, { target: { value: "pending" } });

      const applyButton = screen.getByText("Apply Filters");
      fireEvent.click(applyButton);

      // Export data
      const exportButton = screen.getByText("Export");
      fireEvent.click(exportButton);

      const csvOption = screen.getByLabelText("CSV");
      fireEvent.click(csvOption);

      const exportConfirmButton = screen.getByText("Export CSV");
      fireEvent.click(exportConfirmButton);

      // Verify export includes filters and sorting
      await waitFor(() => {
        expect(mockEmailService.exportEmails).toHaveBeenCalledWith({
          format: "csv",
          filters: { status: "pending" },
          sorting: { field: "subject", direction: "asc" },
          columns: expect.any(Array),
        });
      });
    });
  });

  describe("Accessibility Regression Tests", () => {
    it("should maintain keyboard navigation after dynamic updates", async () => {
      render(<EmailDashboard />);

      // Initial keyboard navigation
      const firstRow = screen.getByRole("row", { name: /test email 1/i });
      firstRow.focus();
      expect(document.activeElement).toBe(firstRow);

      // Trigger dynamic update
      mockEmailService.getEmailsForTableView.mockResolvedValueOnce({
        emails: [
          {
            id: "3",
            email_alias: "new@example.com",
            requested_by: "New User",
            subject: "New Email",
            summary: "Newly added email",
            status: "pending",
            status_text: "Pending",
            workflow_state: "START_POINT",
            priority: "medium",
            received_date: "2025-01-03",
            is_read: false,
            has_attachments: false,
          },
          ...mockEmailService.getEmailsForTableView.mock.results[0].value
            .emails,
        ],
        totalCount: 3,
        totalPages: 1,
        page: 1,
        pageSize: 10,
      });

      // Simulate WebSocket update
      const refreshButton = screen.getByText("Refresh");
      fireEvent.click(refreshButton);

      // Verify keyboard navigation still works
      await screen.findByText("New Email");
      const newFirstRow = screen.getByRole("row", { name: /new email/i });
      newFirstRow.focus();
      expect(document.activeElement).toBe(newFirstRow);

      // Tab navigation should work
      fireEvent.keyDown(document.activeElement!, { key: "Tab" });
      expect(document.activeElement?.tagName).toBe("BUTTON");
    });

    it("should announce dynamic content changes to screen readers", async () => {
      render(<EmailDashboard />);

      // Check for live region
      const liveRegion = screen.getByRole("status", { hidden: true });
      expect(liveRegion).toHaveAttribute("aria-live", "polite");

      // Trigger status update
      const updateButtons = screen.getAllByText("Update Status");
      if (updateButtons[0]) {
        fireEvent.click(updateButtons[0]);
      }

      // Verify announcement
      await waitFor(() => {
        expect(liveRegion).toHaveTextContent(/status updated/i);
      });
    });
  });
});
