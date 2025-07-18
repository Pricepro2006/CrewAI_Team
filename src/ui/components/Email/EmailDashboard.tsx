import React, { useState, useEffect } from 'react';
import { 
  EnvelopeIcon, 
  ChartBarIcon, 
  ClockIcon, 
  ExclamationTriangleIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { trpc } from '../../utils/trpc';
import { EmailList } from './EmailList';
import { EmailStats } from './EmailStats';
import { EmailFilters } from './EmailFilters';
import { EmailCompose } from './EmailCompose';
import './EmailDashboard.css';

export interface EmailDashboardProps {
  className?: string;
}

export interface EmailFilters {
  workflow?: string;
  priority?: string;
  status?: string;
  slaStatus?: string;
  search?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface EmailStats {
  totalEmails: number;
  workflowDistribution: Record<string, number>;
  slaCompliance: Record<string, number>;
  averageProcessingTime: number;
  todayStats: {
    received: number;
    processed: number;
    overdue: number;
    critical: number;
  };
}

export const EmailDashboard: React.FC<EmailDashboardProps> = ({ className }) => {
  const [filters, setFilters] = useState<EmailFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [realTimeUpdates, setRealTimeUpdates] = useState<any[]>([]);

  // Fetch email analytics
  const { data: emailStats, isLoading: statsLoading } = trpc.emails.getAnalytics.useQuery({
    refreshKey
  });

  // Fetch filtered emails
  const { data: emails, isLoading: emailsLoading, refetch: refetchEmails } = trpc.emails.getList.useQuery({
    ...filters,
    limit: 50
  });

  // WebSocket subscription for real-time updates
  const emailUpdatesSubscription = trpc.emails.subscribeToEmailUpdates.useSubscription({
    types: ['email.analyzed', 'email.state_changed', 'email.sla_alert', 'email.analytics_updated']
  }, {
    onData: (update) => {
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

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<EmailFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
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
    
    return emails.reduce((acc, email) => {
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
            className="email-dashboard__action-btn email-dashboard__action-btn--secondary"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FunnelIcon className="email-dashboard__action-icon" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          
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
            stats={emailStats}
            loading={statsLoading}
          />
        </div>

        {/* Main Email Interface */}
        <div className="email-dashboard__main">
          {/* Search Bar */}
          <div className="email-dashboard__search">
            <div className="email-dashboard__search-input">
              <MagnifyingGlassIcon className="email-dashboard__search-icon" />
              <input
                type="text"
                placeholder="Search emails by subject, sender, or content..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange({ search: e.target.value })}
                className="email-dashboard__search-field"
              />
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="email-dashboard__filters">
              <EmailFilters
                filters={filters}
                onFilterChange={handleFilterChange}
                onClear={() => setFilters({})}
              />
            </div>
          )}

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

          {/* Email List */}
          <div className="email-dashboard__list">
            <EmailList
              emails={emails || []}
              loading={emailsLoading}
              selectedEmails={selectedEmails}
              onEmailSelect={setSelectedEmails}
              onEmailAction={refetchEmails}
              filters={filters}
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