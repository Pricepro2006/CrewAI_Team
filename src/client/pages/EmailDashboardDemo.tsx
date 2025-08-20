import React, { useState, useEffect, useCallback } from "react";
import { EmailDashboardMultiPanel } from "../components/dashboard/EmailDashboardMultiPanel.js";
import { useEmailAssignment } from "../hooks/useEmailAssignment.js";
import { api, handleTrpcError } from "../lib/api.js";
import { Button } from "../../components/ui/button.js";
import { Alert, AlertDescription } from "../../components/ui/alert.js";
import { Badge } from "../../components/ui/badge.js";
import type {
  EmailRecord,
  EmailStatus,
  WorkflowState,
} from "../../types/email-dashboard.interfaces.js";

// Sample email data matching the screenshot
const generateSampleEmails = (): EmailRecord[] => {
  const now = new Date();

  return [
    {
      id: "1",
      email_alias: "InsightPartinet@TDSynnex.com",
      requested_by: "John Smith",
      subject: "Firewall Inquiry",
      summary: "Information auto requested",
      status: "red" as EmailStatus,
      status_text: "Critical - Awaiting Response",
      workflow_state: "START_POINT",
      timestamp: new Date(now.getTime() - 1000 * 60 * 30).toISOString(), // 30 min ago
      priority: "critical",
      assignedTo: undefined,
      hasAttachments: false,
      isRead: false,
    },
    {
      id: "2",
      email_alias: "InsightInfoblox@TDSynnex.com",
      requested_by: "Emily Johnson",
      subject: "DNS Protection Quote",
      summary: "Quote requested fork",
      status: "red" as EmailStatus,
      status_text: "Critical - Quote Pending",
      workflow_state: "START_POINT",
      timestamp: new Date(now.getTime() - 1000 * 60 * 45).toISOString(), // 45 min ago
      priority: "high",
      assignedTo: "john-smith",
      hasAttachments: true,
      isRead: true,
    },
    {
      id: "3",
      email_alias: "Marketing-Splunk@TDSynnex.com",
      requested_by: "Michael Brown",
      subject: "Marketing Campaign",
      summary: "Collaboration on mf",
      status: "yellow" as EmailStatus,
      status_text: "In Progress",
      workflow_state: "IN_PROGRESS",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
      priority: "medium",
      assignedTo: "sarah-wilson",
      hasAttachments: false,
      isRead: true,
    },
    {
      id: "4",
      email_alias: "SalesCisco@TDSynnex.com",
      requested_by: "Jennifer Davis",
      subject: "Pricing details",
      summary: "Provide pricing details",
      status: "yellow" as EmailStatus,
      status_text: "In Progress",
      workflow_state: "IN_PROGRESS",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
      priority: "medium",
      assignedTo: "richard-lee",
      hasAttachments: true,
      isRead: true,
    },
    {
      id: "5",
      email_alias: "VMware@TDSynnex.com",
      requested_by: "Daniel Martinez",
      subject: "Support",
      summary: "Support case closure",
      status: "green" as EmailStatus,
      status_text: "Completed",
      workflow_state: "COMPLETION",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
      priority: "low",
      assignedTo: "daniel-martinez",
      hasAttachments: false,
      isRead: true,
    },
    {
      id: "6",
      email_alias: "Sales-PaloAlto@TDSynnex.com",
      requested_by: "Heather Green",
      subject: "Information on firewall systems",
      summary: "Respond with information on firewall systems",
      status: "green" as EmailStatus,
      status_text: "Completed",
      workflow_state: "COMPLETION",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
      priority: "low",
      assignedTo: "jessica-taylor",
      hasAttachments: true,
      isRead: true,
    },
  ];
};

export function EmailDashboardDemo() {
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showSuccessMessage, setShowSuccessMessage] = useState<string | null>(
    null,
  );

  // Use tRPC to fetch emails with proper error handling
  const {
    data: tableData,
    isLoading: loadingEmails,
    error: emailsError,
    refetch,
    isFetching,
  } = api.emails.getTableData.useQuery(
    {
      page: 1,
      pageSize: 100,
      sortBy: "received_date",
      sortOrder: "desc",
    },
    {
      retry: (failureCount, error) => {
        // Retry up to 3 times for network errors only
        if (failureCount < 3 && (!error?.data?.code || error.message?.includes("fetch"))) {
          return true;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 2 * 60 * 1000, // 2 minutes
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  );

  // Transform API data to component format with error handling
  const emails: EmailRecord[] = React.useMemo(() => {
    try {
      if (!tableData?.data?.emails || !Array.isArray(tableData.data.emails)) {
        return [];
      }

      return tableData.data.emails
        .map((email: any): EmailRecord | null => {
          // Validate required fields
          if (!email.id) {
            console.warn('Email record missing ID:', email);
            return null;
          }

          return {
            id: email.id,
            email_alias: email.email_alias || "Unknown Alias",
            requested_by: email.requested_by || "Unknown",
            subject: email.subject || "No Subject",
            summary: email.summary || "No summary",
            status: (email.status || "yellow") as EmailStatus,
            status_text: email.status_text || "Pending",
            workflow_state: (email.workflow_state || "START_POINT") as WorkflowState,
            timestamp: email.received_date || new Date().toISOString(),
            priority: email.priority || "medium",
            assignedTo: email.assigned_to || undefined,
            hasAttachments: Boolean(email.has_attachments),
            isRead: Boolean(email.is_read),
            lastUpdated: email.received_date || email.updated_at || new Date().toISOString(),
          };
        })
        .filter((email): email is EmailRecord => email !== null); // Type-safe filter to remove null entries
    } catch (error) {
      console.error('Error transforming email data:', error);
      return [];
    }
  }, [tableData]);

  // Use email assignment hook with proper async handling
  const {
    assignEmail,
    isAssigning,
    error: assignmentError,
    errorMessage: assignmentErrorMessage,
  } = useEmailAssignment({
    onSuccess: async () => {
      setShowSuccessMessage("Email assigned successfully!");
      try {
        await refetch(); // Refresh the email list
      } catch (error) {
        console.warn('Failed to refresh after assignment:', error);
      }
      // Clear success message after 3 seconds
      setTimeout(() => setShowSuccessMessage(null), 3000);
    },
    onError: (error) => {
      console.error("Assignment failed:", handleTrpcError(error));
    },
  });

  // Handle email assignment with proper error handling
  const handleAssignEmail = useCallback(
    async (emailId: string, assignedTo: string) => {
      if (!emailId) {
        console.error('Email ID is required for assignment');
        return;
      }

      try {
        await assignEmail(emailId, assignedTo || null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Failed to assign email:", errorMessage);
        // Error will be shown in UI through the assignment hook's error state
      }
    },
    [assignEmail],
  );

  // Update email status using tRPC mutation with proper async handling
  const updateEmailMutation = api.emails.updateStatus.useMutation({
    onSuccess: async () => {
      setShowSuccessMessage("Email status updated successfully!");
      try {
        await refetch(); // Refresh the email list
      } catch (error) {
        console.warn('Failed to refresh after status update:', error);
      }
      // Clear success message after 3 seconds
      setTimeout(() => setShowSuccessMessage(null), 3000);
    },
    onError: (error) => {
      const errorMessage = handleTrpcError(error);
      console.error("Status update failed:", errorMessage);
    },
    retry: (failureCount, error) => {
      // Only retry for network errors
      if (failureCount < 2 && (!error?.data?.code || error.message?.includes('fetch'))) {
        return true;
      }
      return false;
    },
  });

  // Handle status change with validation and error handling
  const handleStatusChange = useCallback(
    async (emailId: string, newStatus: EmailStatus) => {
      if (!emailId) {
        console.error('Email ID is required for status update');
        return;
      }

      if (!['red', 'yellow', 'green'].includes(newStatus)) {
        console.error('Invalid status:', newStatus);
        return;
      }

      try {
        await updateEmailMutation.mutateAsync({
          id: emailId,
          status: newStatus,
          status_text:
            newStatus === "red"
              ? "Critical"
              : newStatus === "yellow"
                ? "In Progress"
                : "Completed",
          workflow_state:
            newStatus === "red"
              ? "START_POINT"
              : newStatus === "yellow"
                ? "IN_PROGRESS"
                : "COMPLETION",
        });

        console.log(`Email ${emailId} status changed to ${newStatus}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Failed to update status:", errorMessage);
      }
    },
    [updateEmailMutation],
  );

  // Handle email selection
  const handleEmailSelect = useCallback((email: EmailRecord) => {
    setSelectedEmailId(email.id);
    console.log("Selected email:", email);
  }, []);

  // Manual retry function with proper error handling
  const handleRetry = useCallback(async () => {
    setRetryCount((prev) => prev + 1);
    try {
      const result = await refetch();
      if (result.data) {
        setShowSuccessMessage("Data refreshed successfully!");
        setTimeout(() => setShowSuccessMessage(null), 3000);
      }
    } catch (error) {
      const errorMessage = handleTrpcError(error);
      console.error("Retry failed:", errorMessage);
    }
  }, [refetch]);

  // Calculate loading state - include isFetching for refresh operations
  const loading =
    loadingEmails || isFetching || isAssigning || updateEmailMutation.isPending;

  // Combine errors with user-friendly messages using central error handler
  const error = handleTrpcError(
    emailsError || assignmentError || updateEmailMutation.error
  );

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-[1600px] mx-auto">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Email Dashboard Demo</h1>
              <p className="text-muted-foreground mt-2">
                Multi-panel email tracking system with assignment capabilities
              </p>
            </div>
            <div className="flex items-center gap-4">
              {loading && (
                <Badge variant="secondary" className="animate-pulse">
                  {isFetching ? "Refreshing..." : "Loading..."}
                </Badge>
              )}
              <Button
                onClick={handleRetry}
                variant="outline"
                disabled={loading}
                size="sm"
              >
                Refresh Data
              </Button>
            </div>
          </div>
        </header>

        {/* Success Message */}
        {showSuccessMessage && (
          <Alert className="mb-4 border-green-200 bg-green-50 text-green-800">
            <AlertDescription>{showSuccessMessage}</AlertDescription>
          </Alert>
        )}

        {/* Error Message */}
        {error && (
          <Alert className="mb-4 border-red-200 bg-red-50 text-red-800">
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button
                onClick={handleRetry}
                variant="outline"
                size="sm"
                disabled={loading}
              >
                Try Again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <EmailDashboardMultiPanel
          emails={emails}
          loading={loading}
          error={error}
          onEmailSelect={handleEmailSelect}
          onAssignEmail={handleAssignEmail}
          onStatusChange={handleStatusChange}
        />

        {/* Stats Summary */}
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="bg-card p-4 rounded-lg border">
            <div className="text-2xl font-bold text-destructive">
              {loading ? (
                <div className="h-8 w-8 bg-muted animate-pulse rounded"></div>
              ) : (
                emails?.filter((e: any) => e.status === "red").length
              )}
            </div>
            <div className="text-sm text-muted-foreground">Critical</div>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="text-2xl font-bold text-warning">
              {loading ? (
                <div className="h-8 w-8 bg-muted animate-pulse rounded"></div>
              ) : (
                emails?.filter((e: any) => e.status === "yellow").length
              )}
            </div>
            <div className="text-sm text-muted-foreground">In Progress</div>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="text-2xl font-bold text-success">
              {loading ? (
                <div className="h-8 w-8 bg-muted animate-pulse rounded"></div>
              ) : (
                emails?.filter((e: any) => e.status === "green").length
              )}
            </div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="text-2xl font-bold">
              {loading ? (
                <div className="h-8 w-8 bg-muted animate-pulse rounded"></div>
              ) : (
                emails?.filter((e: any) => !e.assignedTo).length
              )}
            </div>
            <div className="text-sm text-muted-foreground">Unassigned</div>
          </div>
        </div>
      </div>
    </div>
  );
}
