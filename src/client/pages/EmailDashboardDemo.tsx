import React, { useState, useEffect, useCallback } from 'react';
import { EmailDashboardMultiPanel } from '../components/dashboard/EmailDashboardMultiPanel';
import { useEmailAssignment } from '../hooks/useEmailAssignment';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import type { EmailRecord, EmailStatus, WorkflowState } from '@/types/email-dashboard.interfaces';

// Sample email data matching the screenshot
const generateSampleEmails = (): EmailRecord[] => {
  const now = new Date();
  
  return [
    {
      id: '1',
      email_alias: 'InsightPartinet@TDSynnex.com',
      requested_by: 'John Smith',
      subject: 'Firewall Inquiry',
      summary: 'Information auto requested',
      status: 'red' as EmailStatus,
      status_text: 'Critical - Awaiting Response',
      workflow_state: 'START_POINT',
      timestamp: new Date(now.getTime() - 1000 * 60 * 30).toISOString(), // 30 min ago
      priority: 'Critical',
      assignedTo: undefined,
      hasAttachments: false,
      isRead: false,
    },
    {
      id: '2',
      email_alias: 'InsightInfoblox@TDSynnex.com',
      requested_by: 'Emily Johnson',
      subject: 'DNS Protection Quote',
      summary: 'Quote requested fork',
      status: 'red' as EmailStatus,
      status_text: 'Critical - Quote Pending',
      workflow_state: 'START_POINT',
      timestamp: new Date(now.getTime() - 1000 * 60 * 45).toISOString(), // 45 min ago
      priority: 'High',
      assignedTo: 'john-smith',
      hasAttachments: true,
      isRead: true,
    },
    {
      id: '3',
      email_alias: 'Marketing-Splunk@TDSynnex.com',
      requested_by: 'Michael Brown',
      subject: 'Marketing Campaign',
      summary: 'Collaboration on mf',
      status: 'yellow' as EmailStatus,
      status_text: 'In Progress',
      workflow_state: 'IN_PROGRESS',
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
      priority: 'Medium',
      assignedTo: 'sarah-wilson',
      hasAttachments: false,
      isRead: true,
    },
    {
      id: '4',
      email_alias: 'SalesCisco@TDSynnex.com',
      requested_by: 'Jennifer Davis',
      subject: 'Pricing details',
      summary: 'Provide pricing details',
      status: 'yellow' as EmailStatus,
      status_text: 'In Progress',
      workflow_state: 'IN_PROGRESS',
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
      priority: 'Medium',
      assignedTo: 'richard-lee',
      hasAttachments: true,
      isRead: true,
    },
    {
      id: '5',
      email_alias: 'VMware@TDSynnex.com',
      requested_by: 'Daniel Martinez',
      subject: 'Support',
      summary: 'Support case closure',
      status: 'green' as EmailStatus,
      status_text: 'Completed',
      workflow_state: 'COMPLETION',
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
      priority: 'Low',
      assignedTo: 'daniel-martinez',
      hasAttachments: false,
      isRead: true,
    },
    {
      id: '6',
      email_alias: 'Sales-PaloAlto@TDSynnex.com',
      requested_by: 'Heather Green',
      subject: 'Information on firewall systems',
      summary: 'Respond with information on firewall systems',
      status: 'green' as EmailStatus,
      status_text: 'Completed',
      workflow_state: 'COMPLETION',
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
      priority: 'Low',
      assignedTo: 'jessica-taylor',
      hasAttachments: true,
      isRead: true,
    },
  ];
};

export function EmailDashboardDemo() {
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showSuccessMessage, setShowSuccessMessage] = useState<string | null>(null);
  
  // Use tRPC to fetch emails with table data endpoint
  const { 
    data: tableData, 
    isLoading: loadingEmails, 
    error: emailsError, 
    refetch,
    isFetching
  } = trpc.emails.getTableData.useQuery({
    page: 1,
    pageSize: 100,
    sortBy: 'received_date',
    sortOrder: 'desc',
  }, {
    retry: (failureCount, error) => {
      // Retry up to 3 times for network errors
      if (failureCount < 3 && error?.message?.includes('fetch')) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });

  // Transform API data to component format
  const emails: EmailRecord[] = React.useMemo(() => {
    if (!tableData?.data?.emails) return [];
    
    return tableData.data.emails.map(email => ({
      id: email.id,
      email_alias: email.email_alias,
      requested_by: email.requested_by || 'Unknown',
      subject: email.subject || 'No Subject',
      summary: email.summary || 'No summary',
      status: (email.status || 'yellow') as EmailStatus,
      status_text: email.status_text || 'Pending',
      workflow_state: (email.workflow_state || 'START_POINT') as WorkflowState,
      timestamp: email.received_date,
      priority: email.priority || 'Medium',
      assignedTo: undefined as string | undefined, // This field doesn't exist in the API response
      hasAttachments: email.has_attachments || false,
      isRead: email.is_read || false,
      lastUpdated: email.received_date,
    }));
  }, [tableData]);

  // Use email assignment hook
  const {
    assignEmail,
    isAssigning,
    error: assignmentError,
  } = useEmailAssignment({
    onSuccess: () => {
      setShowSuccessMessage('Email assigned successfully!');
      refetch(); // Refresh the email list
      // Clear success message after 3 seconds
      setTimeout(() => setShowSuccessMessage(null), 3000);
    },
    onError: (error) => {
      console.error('Assignment failed:', error);
      // Error is handled in the error display logic below
    },
  });

  // Handle email assignment
  const handleAssignEmail = useCallback(async (emailId: string, assignedTo: string) => {
    try {
      await assignEmail(emailId, assignedTo || null);
    } catch (err) {
      console.error('Failed to assign email:', err);
    }
  }, [assignEmail]);

  // Update email status using tRPC mutation
  const updateEmailMutation = trpc.emails.updateStatus.useMutation({
    onSuccess: () => {
      setShowSuccessMessage('Email status updated successfully!');
      refetch(); // Refresh the email list
      // Clear success message after 3 seconds
      setTimeout(() => setShowSuccessMessage(null), 3000);
    },
    onError: (error) => {
      console.error('Status update failed:', error);
      // Error is handled in the error display logic below
    },
  });

  // Handle status change
  const handleStatusChange = useCallback(async (emailId: string, newStatus: EmailStatus) => {
    try {
      await updateEmailMutation.mutateAsync({
        id: emailId,
        status: newStatus,
        status_text: newStatus === 'red' ? 'Critical' : 
                    newStatus === 'yellow' ? 'In Progress' : 'Completed',
        workflow_state: newStatus === 'red' ? 'START_POINT' :
                       newStatus === 'yellow' ? 'IN_PROGRESS' : 'COMPLETION',
      });
      
      console.log(`Email ${emailId} status changed to ${newStatus}`);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }, [updateEmailMutation]);

  // Handle email selection
  const handleEmailSelect = useCallback((email: EmailRecord) => {
    setSelectedEmailId(email.id);
    console.log('Selected email:', email);
  }, []);

  // Manual retry function
  const handleRetry = useCallback(async () => {
    setRetryCount(prev => prev + 1);
    try {
      await refetch();
      setShowSuccessMessage('Data refreshed successfully!');
      setTimeout(() => setShowSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Retry failed:', error);
    }
  }, [refetch]);

  // Calculate loading state - include isFetching for refresh operations
  const loading = loadingEmails || isFetching || isAssigning || updateEmailMutation.isLoading;
  
  // Combine errors with user-friendly messages
  const getErrorMessage = (error: any): string | null => {
    if (!error) return null;
    
    // Handle tRPC errors
    if (error?.data?.zodError) {
      return 'Invalid data format. Please check your input.';
    }
    
    if (error?.data?.code === 'UNAUTHORIZED') {
      return 'You are not authorized to perform this action.';
    }
    
    if (error?.data?.code === 'NOT_FOUND') {
      return 'The requested email was not found.';
    }
    
    if (error?.data?.code === 'BAD_REQUEST') {
      return 'Invalid request. Please check your input.';
    }
    
    // Handle network errors
    if (error?.message?.includes('fetch')) {
      return 'Network error. Please check your connection and try again.';
    }
    
    // Handle timeout errors
    if (error?.message?.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    
    // Default error message
    return error?.message || 'An unexpected error occurred. Please try again.';
  };
  
  const error = getErrorMessage(emailsError) || 
                getErrorMessage(assignmentError) || 
                getErrorMessage(updateEmailMutation.error);

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
                  {isFetching ? 'Refreshing...' : 'Loading...'}
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
                emails.filter(e => e.status === 'red').length
              )}
            </div>
            <div className="text-sm text-muted-foreground">Critical</div>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="text-2xl font-bold text-warning">
              {loading ? (
                <div className="h-8 w-8 bg-muted animate-pulse rounded"></div>
              ) : (
                emails.filter(e => e.status === 'yellow').length
              )}
            </div>
            <div className="text-sm text-muted-foreground">In Progress</div>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="text-2xl font-bold text-success">
              {loading ? (
                <div className="h-8 w-8 bg-muted animate-pulse rounded"></div>
              ) : (
                emails.filter(e => e.status === 'green').length
              )}
            </div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="text-2xl font-bold">
              {loading ? (
                <div className="h-8 w-8 bg-muted animate-pulse rounded"></div>
              ) : (
                emails.filter(e => !e.assignedTo).length
              )}
            </div>
            <div className="text-sm text-muted-foreground">Unassigned</div>
          </div>
        </div>
      </div>
    </div>
  );
}