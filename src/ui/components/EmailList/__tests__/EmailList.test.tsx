/**
 * EmailList Component Test Suite
 * Tests email list functionality and filtering
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import "@testing-library/jest-dom";

// Mock EmailList component
interface Email {
  id: string;
  subject: string;
  sender: string;
  recipient: string;
  status: "red" | "yellow" | "green";
  priority: "High" | "Medium" | "Low";
  timestamp: string;
  isRead: boolean;
  hasAttachments: boolean;
}

interface EmailListProps {
  emails: Email[];
  loading?: boolean;
  error?: string;
  onEmailSelect?: (email: Email) => void;
  onStatusChange?: (emailId: string, status: Email["status"]) => void;
  onMarkAsRead?: (emailId: string) => void;
  selectedEmailId?: string;
}

const EmailList: React.FC<EmailListProps> = ({
  emails,
  loading = false,
  error,
  onEmailSelect,
  onStatusChange,
  onMarkAsRead,
  selectedEmailId,
}) => {
  const [sortBy, setSortBy] = React.useState<"timestamp" | "priority" | "subject">("timestamp");
  const [filterStatus, setFilterStatus] = React.useState<"all" | Email["status"]>("all");
  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredAndSortedEmails = React.useMemo(() => {
    const filtered = emails?.filter((email: any) => {
      const matchesSearch = 
        email?.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email?.sender?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === "all" || email.status === filterStatus;
      return matchesSearch && matchesStatus;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "timestamp":
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        case "priority": {
          const priorityOrder = { "High": 3, "Medium": 2, "Low": 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        case "subject":
          return a?.subject?.localeCompare(b.subject);
        default:
          return 0;
      }
    });
  }, [emails, searchTerm, filterStatus, sortBy]);

  if (loading) {
    return (
      <div data-testid="email-list-loading" className="loading">
        Loading emails...
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="email-list-error" className="error">
        Error: {error}
      </div>
    );
  }

  return (
    <div data-testid="email-list" className="email-list">
      <div className="email-list-controls">
        <input
          type="text"
          placeholder="Search emails..."
          value={searchTerm}
          onChange={(e: any) => setSearchTerm(e?.target?.value)}
          data-testid="email-search"
        />
        <select
          value={filterStatus}
          onChange={(e: any) => setFilterStatus(e?.target?.value as any)}
          data-testid="status-filter"
        >
          <option value="all">All Status</option>
          <option value="red">Critical</option>
          <option value="yellow">In Progress</option>
          <option value="green">Completed</option>
        </select>
        <select
          value={sortBy}
          onChange={(e: any) => setSortBy(e?.target?.value as any)}
          data-testid="sort-select"
        >
          <option value="timestamp">Sort by Date</option>
          <option value="priority">Sort by Priority</option>
          <option value="subject">Sort by Subject</option>
        </select>
      </div>

      <div className="email-count" data-testid="email-count">
        Showing {filteredAndSortedEmails?.length || 0} of {emails?.length || 0} emails
      </div>

      {filteredAndSortedEmails?.length || 0 === 0 ? (
        <div data-testid="no-emails" className="no-emails">
          No emails found matching your criteria
        </div>
      ) : (
        <div className="emails-container" data-testid="emails-container">
          {filteredAndSortedEmails?.map((email: any) => (
            <div
              key={email.id}
              className={`email-item ${email.id === selectedEmailId ? "selected" : ""} ${!email.isRead ? "unread" : ""}`}
              data-testid={`email-item-${email.id}`}
              onClick={() => onEmailSelect?.(email)}
            >
              <div className="email-header">
                <span className={`status-indicator ${email.status}`} data-testid={`status-${email.id}`}>
                  {email.status}
                </span>
                <span className={`priority-badge ${email?.priority?.toLowerCase()}`} data-testid={`priority-${email.id}`}>
                  {email.priority}
                </span>
                {email.hasAttachments && (
                  <span className="attachment-icon" data-testid={`attachment-${email.id}`}>📎</span>
                )}
                {!email.isRead && (
                  <span className="unread-indicator" data-testid={`unread-${email.id}`}>●</span>
                )}
              </div>
              
              <div className="email-content">
                <h4 className="email-subject" data-testid={`subject-${email.id}`}>
                  {email.subject}
                </h4>
                <p className="email-sender" data-testid={`sender-${email.id}`}>
                  From: {email.sender}
                </p>
                <p className="email-recipient" data-testid={`recipient-${email.id}`}>
                  To: {email.recipient}
                </p>
                <p className="email-timestamp" data-testid={`timestamp-${email.id}`}>
                  {new Date(email.timestamp).toLocaleDateString()}
                </p>
              </div>

              <div className="email-actions" onClick={(e: any) => e.stopPropagation()}>
                <select
                  value={email.status}
                  onChange={(e: any) => onStatusChange?.(email.id, e?.target?.value as Email["status"])}
                  data-testid={`status-select-${email.id}`}
                >
                  <option value="red">Critical</option>
                  <option value="yellow">In Progress</option>
                  <option value="green">Completed</option>
                </select>
                
                {!email.isRead && (
                  <button
                    onClick={() => onMarkAsRead?.(email.id)}
                    data-testid={`mark-read-${email.id}`}
                    className="mark-read-btn"
                  >
                    Mark as Read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

describe("EmailList Component", () => {
  const mockEmails: Email[] = [
    {
      id: "email-1",
      subject: "Important Meeting",
      sender: "john@example.com",
      recipient: "team@example.com",
      status: "red",
      priority: "High",
      timestamp: "2025-01-20T10:00:00Z",
      isRead: false,
      hasAttachments: true,
    },
    {
      id: "email-2",
      subject: "Weekly Report",
      sender: "manager@example.com",
      recipient: "team@example.com",
      status: "yellow",
      priority: "Medium",
      timestamp: "2025-01-19T14:30:00Z",
      isRead: true,
      hasAttachments: false,
    },
    {
      id: "email-3",
      subject: "Project Update",
      sender: "dev@example.com",
      recipient: "team@example.com",
      status: "green",
      priority: "Low",
      timestamp: "2025-01-18T09:15:00Z",
      isRead: true,
      hasAttachments: false,
    },
  ];

  it("should render email list correctly", () => {
    render(<EmailList emails={mockEmails} />);

    expect(screen.getByTestId("email-list")).toBeInTheDocument();
    expect(screen.getByTestId("emails-container")).toBeInTheDocument();
    expect(screen.getByTestId("email-count")).toHaveTextContent("Showing 3 of 3 emails");

    // Check if all emails are rendered
    mockEmails.forEach((email: any) => {
      expect(screen.getByTestId(`email-item-${email.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`subject-${email.id}`)).toHaveTextContent(email.subject);
      expect(screen.getByTestId(`sender-${email.id}`)).toHaveTextContent(`From: ${email.sender}`);
    });
  });

  it("should show loading state", () => {
    render(<EmailList emails={[]} loading={true} />);

    expect(screen.getByTestId("email-list-loading")).toBeInTheDocument();
    expect(screen.getByText("Loading emails...")).toBeInTheDocument();
    expect(screen.queryByTestId("email-list")).not.toBeInTheDocument();
  });

  it("should show error state", () => {
    render(<EmailList emails={[]} error="Failed to load emails" />);

    expect(screen.getByTestId("email-list-error")).toBeInTheDocument();
    expect(screen.getByText("Error: Failed to load emails")).toBeInTheDocument();
    expect(screen.queryByTestId("email-list")).not.toBeInTheDocument();
  });

  it("should filter emails by search term", async () => {
    render(<EmailList emails={mockEmails} />);

    const searchInput = screen.getByTestId("email-search");
    fireEvent.change(searchInput, { target: { value: "meeting" } });

    await waitFor(() => {
      expect(screen.getByTestId("email-count")).toHaveTextContent("Showing 1 of 3 emails");
      expect(screen.getByTestId("email-item-email-1")).toBeInTheDocument();
      expect(screen.queryByTestId("email-item-email-2")).not.toBeInTheDocument();
    });
  });

  it("should filter emails by status", async () => {
    render(<EmailList emails={mockEmails} />);

    const statusFilter = screen.getByTestId("status-filter");
    fireEvent.change(statusFilter, { target: { value: "red" } });

    await waitFor(() => {
      expect(screen.getByTestId("email-count")).toHaveTextContent("Showing 1 of 3 emails");
      expect(screen.getByTestId("email-item-email-1")).toBeInTheDocument();
      expect(screen.queryByTestId("email-item-email-2")).not.toBeInTheDocument();
    });
  });

  it("should sort emails by different criteria", async () => {
    render(<EmailList emails={mockEmails} />);

    const sortSelect = screen.getByTestId("sort-select");
    
    // Sort by subject
    fireEvent.change(sortSelect, { target: { value: "subject" } });

    await waitFor(() => {
      const emailItems = screen.getAllByTestId(/^email-item-/);
      // "Important Meeting" should come first alphabetically
      expect(emailItems[0]).toHaveAttribute("data-testid", "email-item-email-1");
    });
  });

  it("should handle email selection", () => {
    const onEmailSelect = vi.fn();
    render(<EmailList emails={mockEmails} onEmailSelect={onEmailSelect} />);

    fireEvent.click(screen.getByTestId("email-item-email-1"));

    expect(onEmailSelect).toHaveBeenCalledWith(mockEmails[0]);
  });

  it("should handle status change", () => {
    const onStatusChange = vi.fn();
    render(<EmailList emails={mockEmails} onStatusChange={onStatusChange} />);

    const statusSelect = screen.getByTestId("status-select-email-1");
    fireEvent.change(statusSelect, { target: { value: "green" } });

    expect(onStatusChange).toHaveBeenCalledWith("email-1", "green");
  });

  it("should handle mark as read", () => {
    const onMarkAsRead = vi.fn();
    render(<EmailList emails={mockEmails} onMarkAsRead={onMarkAsRead} />);

    fireEvent.click(screen.getByTestId("mark-read-email-1"));

    expect(onMarkAsRead).toHaveBeenCalledWith("email-1");
  });

  it("should show unread indicators", () => {
    render(<EmailList emails={mockEmails} />);

    // Email 1 is unread
    expect(screen.getByTestId("unread-email-1")).toBeInTheDocument();
    expect(screen.getByTestId("mark-read-email-1")).toBeInTheDocument();

    // Email 2 is read
    expect(screen.queryByTestId("unread-email-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mark-read-email-2")).not.toBeInTheDocument();
  });

  it("should show attachment indicators", () => {
    render(<EmailList emails={mockEmails} />);

    // Email 1 has attachments
    expect(screen.getByTestId("attachment-email-1")).toBeInTheDocument();

    // Email 2 does not have attachments
    expect(screen.queryByTestId("attachment-email-2")).not.toBeInTheDocument();
  });

  it("should highlight selected email", () => {
    render(<EmailList emails={mockEmails} selectedEmailId="email-2" />);

    const selectedEmail = screen.getByTestId("email-item-email-2");
    expect(selectedEmail).toHaveClass("selected");

    const unselectedEmail = screen.getByTestId("email-item-email-1");
    expect(unselectedEmail).not.toHaveClass("selected");
  });

  it("should prevent event propagation on actions", () => {
    const onEmailSelect = vi.fn();
    const onStatusChange = vi.fn();
    
    render(
      <EmailList
        emails={mockEmails}
        onEmailSelect={onEmailSelect}
        onStatusChange={onStatusChange}
      />
    );

    const statusSelect = screen.getByTestId("status-select-email-1");
    fireEvent.change(statusSelect, { target: { value: "green" } });

    expect(onStatusChange).toHaveBeenCalledWith("email-1", "green");
    expect(onEmailSelect).not.toHaveBeenCalled();
  });

  it("should show no emails message when filtered list is empty", async () => {
    render(<EmailList emails={mockEmails} />);

    const searchInput = screen.getByTestId("email-search");
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });

    await waitFor(() => {
      expect(screen.getByTestId("no-emails")).toBeInTheDocument();
      expect(screen.getByText("No emails found matching your criteria")).toBeInTheDocument();
      expect(screen.queryByTestId("emails-container")).not.toBeInTheDocument();
    });
  });

  it("should search by sender as well as subject", async () => {
    render(<EmailList emails={mockEmails} />);

    const searchInput = screen.getByTestId("email-search");
    fireEvent.change(searchInput, { target: { value: "john" } });

    await waitFor(() => {
      expect(screen.getByTestId("email-count")).toHaveTextContent("Showing 1 of 3 emails");
      expect(screen.getByTestId("email-item-email-1")).toBeInTheDocument();
    });
  });

  it("should be case-insensitive for search", async () => {
    render(<EmailList emails={mockEmails} />);

    const searchInput = screen.getByTestId("email-search");
    fireEvent.change(searchInput, { target: { value: "MEETING" } });

    await waitFor(() => {
      expect(screen.getByTestId("email-count")).toHaveTextContent("Showing 1 of 3 emails");
      expect(screen.getByTestId("email-item-email-1")).toBeInTheDocument();
    });
  });
});