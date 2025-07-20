import React, { useState, useEffect, useMemo } from 'react';
import { 
  EnvelopeIcon, 
  ChartBarIcon, 
  ClockIcon, 
  ExclamationTriangleIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { trpc } from '../../utils/trpc';
import { EmailTable } from '@/client/components/email/EmailTable';
import { FilterPanel, QuickFilters } from '@/client/components/email/FilterPanel';
import { StatusLegend } from '@/client/components/email/StatusIndicator';
import { EmailStats } from './EmailStats';
import { EmailCompose } from './EmailCompose';
import type { EmailRecord, FilterConfig, FilterOptions } from '@/types/email-dashboard.interfaces';
import './EmailDashboard.css';

export interface EmailDashboardProps {
  className?: string;
}

// Map existing email data to new EmailRecord format
function mapEmailToRecord(email: any): EmailRecord {
  const analysis = email.analysis || {};
  const workflowState = analysis.workflow_state === 'New' ? 'START_POINT' : 
                       analysis.workflow_state === 'In Progress' ? 'IN_PROGRESS' : 
                       'COMPLETION';
  
  const status = analysis.quick_priority === 'Critical' || analysis.action_sla_status === 'overdue' ? 'red' :
                 workflowState === 'IN_PROGRESS' ? 'yellow' : 'green';
  
  const statusText = analysis.quick_priority === 'Critical' ? 'Critical' :
                     analysis.action_sla_status === 'overdue' ? 'Overdue' :
                     workflowState === 'START_POINT' ? 'New Request' :
                     workflowState === 'IN_PROGRESS' ? 'Processing' : 'Completed';

  return {
    id: email.id,
    email_alias: email.to?.split('@')[0] + '@tdsynnex.com' || 'unknown@tdsynnex.com',
    requested_by: email.from?.split('<')[0]?.trim() || 'Unknown',
    subject: email.subject || 'No Subject',
    summary: analysis.quick_summary || email.bodyPreview || 'No summary available',
    status,
    status_text: statusText,
    workflow_state: workflowState,
    timestamp: email.receivedDateTime,
    priority: analysis.quick_priority || 'Medium',
    workflow_type: analysis.workflow_type || 'General',
    entities: analysis.entities,
    isRead: email.isRead,
    hasAttachments: email.hasAttachments,
  };
}

export const EmailDashboard: React.FC<EmailDashboardProps> = ({ className }) => {
  const [filters, setFilters] = useState<FilterConfig>({
    search: '',
    emailAliases: [],
    requesters: [],
    statuses: [],
    workflowStates: [],
    workflowTypes: [],
    priorities: [],
    dateRange: {
      start: null,
      end: null
    },
    hasAttachments: undefined,
    isRead: undefined,
    tags: []
  });
  const [showCompose, setShowCompose] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [realTimeUpdates, setRealTimeUpdates] = useState<Array<{
    type: 'email.analyzed' | 'email.state_changed' | 'email.sla_alert' | 'email.analytics_updated';
    data: any;
  }>>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch email analytics
  const { data: emailStats, isLoading: statsLoading } = trpc.emails.getAnalytics.useQuery({
    refreshKey
  });

  // Fetch filtered emails
  const sanitizedFilters = {
    ...filters,
    dateRange: filters.dateRange.start && filters.dateRange.end ? {
      start: filters.dateRange.start,
      end: filters.dateRange.end
    } : undefined
  };
  
  const { data: emails, isLoading: emailsLoading, refetch: refetchEmails } = trpc.emails.getList.useQuery({
    ...sanitizedFilters,
    limit: 50
  });

  // WebSocket subscription for real-time updates
  const emailUpdatesSubscription = trpc.emails.subscribeToEmailUpdates.useSubscription({
    types: ['email.analyzed', 'email.state_changed', 'email.sla_alert', 'email.analytics_updated']
  }, {
    onData: (update: any) => {
      setRealTimeUpdates(prev => [...prev.slice(-99), update]); // Keep last 100 updates
      
      // Handle different types of updates
      switch (update.type) {
        case 'email.analyzed':
          // Refresh email list when new analysis is complete
          setRefreshKey(prev => prev + 1);
          refetchEmails();
          break;
        case 'email.state_changed':
          // Refresh email list when state changes
          refetchEmails();
          break;
        case 'email.analytics_updated':
          // Refresh analytics when updated
          setRefreshKey(prev => prev + 1);
          break;
        case 'email.sla_alert':
          // Show SLA alert notification
          console.log('SLA Alert:', update.data);
          break;
      }
    },
    onError: (error) => {
      console.error('WebSocket subscription error:', error);
    }
  });

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
      refetchEmails();
    }, 30000);
    return () => clearInterval(interval);
  }, [refetchEmails]);

  // Convert emails to EmailRecord format
  const emailRecords = useMemo(() => {
    if (!emails) return [];
    // Handle both direct array and wrapped response
    const emailData = Array.isArray(emails) ? emails : emails.data || [];
    return emailData.map(mapEmailToRecord);
  }, [emails]);

  // Generate filter options from current data
  const filterOptions = useMemo<FilterOptions>(() => {
    if (!emailRecords) return {
      emailAliases: [],
      requesters: [],
      statuses: [],
      workflowStates: [],
      workflowTypes: [],
      priorities: [],
      tags: []
    };

    const emailAliases = [...new Set(emailRecords.map(e => e.email_alias))];
    const requesters = [...new Set(emailRecords.map(e => e.requested_by))];
    const workflowTypes = [...new Set(emailRecords.map(e => e.workflow_type).filter(Boolean))];
    const tags = [...new Set(emailRecords.flatMap(e => e.tags || []))];

    const statusCounts = { red: 0, yellow: 0, green: 0 };
    const workflowStateCounts = { START_POINT: 0, IN_PROGRESS: 0, COMPLETION: 0 };
    const priorityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };

    emailRecords.forEach(email => {
      statusCounts[email.status]++;
      workflowStateCounts[email.workflow_state]++;
      if (email.priority) priorityCounts[email.priority as keyof typeof priorityCounts]++;
    });

    return {
      emailAliases,
      requesters,
      statuses: [
        { value: 'red' as const, label: 'Critical', color: 'red', description: 'Critical/urgent emails requiring immediate attention' },
        { value: 'yellow' as const, label: 'In Progress', color: 'yellow', description: 'Emails currently being processed' },
        { value: 'green' as const, label: 'Completed', color: 'green', description: 'Successfully completed emails' }
      ],
      workflowStates: ['START_POINT', 'IN_PROGRESS', 'COMPLETION'] as const,
      workflowTypes: workflowTypes.filter((t): t is string => t !== undefined),
      priorities: ['Critical', 'High', 'Medium', 'Low'] as const,
      tags
    };
  }, [emailRecords]);

  // Handle filter changes
  const handleFilterChange = (newFilters: FilterConfig) => {
    setFilters(newFilters);
  };

  // Handle email selection
  const handleEmailSelect = (emailId: string) => {
    setSelectedEmails(prev => 
      prev.includes(emailId) 
        ? prev.filter(id => id !== emailId)
        : [...prev, emailId]
    );
  };

  const handleEmailsSelect = (emailIds: string[]) => {
    setSelectedEmails(emailIds);
  };

  // Handle email row click
  const handleEmailClick = (email: EmailRecord) => {
    // Navigate to email detail view or open modal
    console.log('Email clicked:', email);
  };

  // Manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchEmails();
    setRefreshKey(prev => prev + 1);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Handle bulk actions
  const handleBulkAction = async (action: string, emailIds: string[]) => {
    try {
      switch (action) {
        case 'mark-read':
          // TODO: Implement bulk mark as read
          break;
        case 'archive':
          // TODO: Implement bulk archive
          break;
        case 'priority-high':
          // TODO: Implement bulk priority change
          break;
        default:
          console.warn('Unknown bulk action:', action);
      }
      
      // Refresh data after action
      refetchEmails();
      setSelectedEmails([]);
    } catch (error) {
      console.error('Bulk action failed:', error);
    }
  };

  // Calculate quick stats for today
  const todayStats = React.useMemo(() => {
    if (!emails) return { received: 0, processed: 0, overdue: 0, critical: 0 };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Handle both direct array and wrapped response
    const emailData = Array.isArray(emails) ? emails : emails.data || [];
    
    return emailData.reduce((acc: { received: number; processed: number; overdue: number; critical: number }, email: any) => {
      const emailDate = new Date(email.receivedDateTime);
      emailDate.setHours(0, 0, 0, 0);
      
      if (emailDate.getTime() === today.getTime()) {
        acc.received++;
        if (email.analysis?.workflow_state !== 'New') acc.processed++;
        if (email.analysis?.action_sla_status === 'overdue') acc.overdue++;
        if (email.analysis?.quick_priority === 'Critical') acc.critical++;
      }
      
      return acc;
    }, { received: 0, processed: 0, overdue: 0, critical: 0 });
  }, [emails]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.emailAliases?.length) count += filters.emailAliases.length;
    if (filters.requesters?.length) count += filters.requesters.length;
    if (filters.statuses?.length) count += filters.statuses.length;
    if (filters.workflowStates?.length) count += filters.workflowStates.length;
    if (filters.priorities?.length) count += filters.priorities.length;
    if (filters.dateRange) count++;
    if (filters.hasAttachments !== undefined) count++;
    if (filters.isRead !== undefined) count++;
    if (filters.tags?.length) count += filters.tags.length;
    return count;
  }, [filters]);

  return (
    <div className={`email-dashboard ${className || ''}`}>
      <div className="email-dashboard__header">
        <div className="email-dashboard__title">
          <h1>
            <EnvelopeIcon className="email-dashboard__title-icon" />
            Email Dashboard
          </h1>
          <p className="email-dashboard__subtitle">
            TD SYNNEX Workflow Analysis & Management
          </p>
        </div>
        
        <div className="email-dashboard__actions">
          <button 
            className={`email-dashboard__action-btn email-dashboard__action-btn--secondary ${isRefreshing ? 'animate-spin' : ''}`}
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <ArrowPathIcon className="email-dashboard__action-icon" />
            Refresh
          </button>
          
          <FilterPanel
            filters={filters}
            filterOptions={filterOptions}
            onFiltersChange={handleFilterChange}
            onReset={() => setFilters({
              search: '',
              emailAliases: [],
              requesters: [],
              statuses: [],
              workflowStates: [],
              workflowTypes: [],
              priorities: [],
              dateRange: {
                start: null,
                end: null
              },
              hasAttachments: undefined,
              isRead: undefined,
              tags: []
            })}
            activeFilterCount={activeFilterCount}
          />
          
          <button 
            className="email-dashboard__action-btn email-dashboard__action-btn--primary"
            onClick={() => setShowCompose(true)}
          >
            <PlusIcon className="email-dashboard__action-icon" />
            Compose Email
          </button>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="email-dashboard__quick-stats">
        <div className="email-dashboard__stat">
          <div className="email-dashboard__stat-value">{todayStats.received}</div>
          <div className="email-dashboard__stat-label">Today's Emails</div>
        </div>
        <div className="email-dashboard__stat">
          <div className="email-dashboard__stat-value">{todayStats.processed}</div>
          <div className="email-dashboard__stat-label">Processed</div>
        </div>
        <div className="email-dashboard__stat">
          <div className="email-dashboard__stat-value email-dashboard__stat-value--warning">
            {todayStats.overdue}
          </div>
          <div className="email-dashboard__stat-label">Overdue</div>
        </div>
        <div className="email-dashboard__stat">
          <div className="email-dashboard__stat-value email-dashboard__stat-value--critical">
            {todayStats.critical}
          </div>
          <div className="email-dashboard__stat-label">Critical</div>
        </div>
      </div>

      <div className="email-dashboard__content">
        {/* Analytics Section */}
        <div className="email-dashboard__analytics">
          <EmailStats 
            stats={emailStats && 'data' in emailStats ? emailStats.data : emailStats}
            loading={statsLoading}
          />
        </div>

        {/* Main Email Interface */}
        <div className="email-dashboard__main">
          {/* Search Bar and Quick Filters */}
          <div className="email-dashboard__controls">
            <div className="email-dashboard__search">
              <div className="email-dashboard__search-input">
                <MagnifyingGlassIcon className="email-dashboard__search-icon" />
                <input
                  type="text"
                  placeholder="Search emails by subject, sender, or content..."
                  value={filters.search || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange({ ...filters, search: e.target.value })}
                  className="email-dashboard__search-field"
                />
              </div>
            </div>
            
            {/* Status Legend */}
            <div className="email-dashboard__status-legend">
              <StatusLegend />
            </div>
          </div>

          {/* Quick Filter Buttons */}
          <div className="email-dashboard__quick-filters">
            <QuickFilters 
              onFilterChange={(quickFilters) => handleFilterChange({ ...filters, ...quickFilters })}
            />
          </div>

          {/* Bulk Actions */}
          {selectedEmails.length > 0 && (
            <div className="email-dashboard__bulk-actions">
              <div className="email-dashboard__bulk-count">
                {selectedEmails.length} email{selectedEmails.length !== 1 ? 's' : ''} selected
              </div>
              <div className="email-dashboard__bulk-buttons">
                <button
                  onClick={() => handleBulkAction('mark-read', selectedEmails)}
                  className="email-dashboard__bulk-btn"
                >
                  Mark as Read
                </button>
                <button
                  onClick={() => handleBulkAction('archive', selectedEmails)}
                  className="email-dashboard__bulk-btn"
                >
                  Archive
                </button>
                <button
                  onClick={() => handleBulkAction('priority-high', selectedEmails)}
                  className="email-dashboard__bulk-btn"
                >
                  Set High Priority
                </button>
              </div>
            </div>
          )}

          {/* Email Table */}
          <div className="email-dashboard__table">
            <EmailTable
              emails={emailRecords}
              loading={emailsLoading}
              error={null}
              selectedEmails={selectedEmails}
              onEmailSelect={handleEmailSelect}
              onEmailsSelect={handleEmailsSelect}
              onRowClick={handleEmailClick}
              className="email-dashboard__table-component"
            />
          </div>
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <EmailCompose
          onClose={() => setShowCompose(false)}
          onSend={() => {
            setShowCompose(false);
            refetchEmails();
          }}
        />
      )}
    </div>
  );
};