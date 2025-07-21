import React, { useState, useEffect } from 'react';
import { 
  EnvelopeIcon, 
  ClockIcon, 
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { trpc } from '../../utils/trpc';
import { EmailAliasSection } from './EmailAliasSection';
import { MarketingSplunkSection } from './MarketingSplunkSection';
import { VMwareTDSynnexSection } from './VMwareTDSynnexSection';
import type { CategorizedEmails } from '@/types/iems-email.types';
import './IEMSDashboard.css';

export interface IEMSDashboardProps {
  className?: string;
}

export const IEMSDashboard: React.FC<IEMSDashboardProps> = ({ className }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch categorized emails
  const { data: categorizedEmails, isLoading, refetch } = trpc.iemsEmails.getCategorizedEmails.useQuery({
    limit: 20,
    refresh: refreshKey > 0
  });

  // Fetch analytics
  const { data: analytics } = trpc.iemsEmails.getAnalytics.useQuery();

  // Fetch team members
  const { data: teamMembers } = trpc.iemsEmails.getTeamMembers.useQuery();

  // WebSocket subscription for real-time updates
  const emailUpdatesSubscription = trpc.ws.subscribeToUpdates.useSubscription({
    types: ['email.statusUpdated', 'email.assigned', 'email.actionPerformed']
  }, {
    onData: (update: any) => {
      console.log('Real-time update:', update);
      // Refresh data on updates
      refetch();
    },
    onError: (error) => {
      console.error('WebSocket subscription error:', error);
    }
  });

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  // Manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshKey(prev => prev + 1);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Calculate quick stats
  const quickStats = React.useMemo(() => {
    if (!analytics) return { total: 0, urgent: 0, pending: 0, avgResponseTime: '0h' };
    
    return {
      total: analytics.totalEmails,
      urgent: analytics.urgentCount,
      pending: analytics.pendingAssignments,
      avgResponseTime: analytics.avgResponseTime > 0 
        ? `${Math.round(analytics.avgResponseTime / 60)}h`
        : '0h'
    };
  }, [analytics]);

  // Handle status update
  const updateEmailStatus = trpc.iemsEmails.updateEmailStatus.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      console.error('Failed to update email status:', error);
    }
  });

  // Handle email assignment
  const assignEmail = trpc.iemsEmails.assignEmail.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      console.error('Failed to assign email:', error);
    }
  });

  // Handle email action
  const performEmailAction = trpc.iemsEmails.performEmailAction.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      console.error('Failed to perform email action:', error);
    }
  });

  return (
    <div className={`iems-dashboard ${className || ''}`}>
      {/* Header */}
      <div className="iems-dashboard__header">
        <div className="iems-dashboard__title">
          <h1>
            <EnvelopeIcon className="iems-dashboard__title-icon" />
            IEMS Email Dashboard
          </h1>
          <p className="iems-dashboard__subtitle">
            TD SYNNEX Intelligent Email Management System
          </p>
        </div>
        
        <div className="iems-dashboard__actions">
          <button 
            className={`iems-dashboard__action-btn iems-dashboard__action-btn--secondary ${isRefreshing ? 'animate-spin' : ''}`}
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <ArrowPathIcon className="iems-dashboard__action-icon" />
            Refresh
          </button>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="iems-dashboard__quick-stats">
        <div className="iems-dashboard__stat">
          <div className="iems-dashboard__stat-value">{quickStats.total}</div>
          <div className="iems-dashboard__stat-label">Total Emails</div>
        </div>
        <div className="iems-dashboard__stat">
          <div className="iems-dashboard__stat-value iems-dashboard__stat-value--critical">
            {quickStats.urgent}
          </div>
          <div className="iems-dashboard__stat-label">Urgent</div>
        </div>
        <div className="iems-dashboard__stat">
          <div className="iems-dashboard__stat-value iems-dashboard__stat-value--warning">
            {quickStats.pending}
          </div>
          <div className="iems-dashboard__stat-label">Pending Assignment</div>
        </div>
        <div className="iems-dashboard__stat">
          <ClockIcon className="iems-dashboard__stat-icon" />
          <div className="iems-dashboard__stat-value">{quickStats.avgResponseTime}</div>
          <div className="iems-dashboard__stat-label">Avg Response Time</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="iems-dashboard__content">
        {isLoading ? (
          <div className="iems-dashboard__loading">
            <div className="iems-dashboard__loading-spinner" />
            <p>Loading emails...</p>
          </div>
        ) : categorizedEmails ? (
          <div className="iems-dashboard__sections">
            {/* Email Alias Section */}
            <EmailAliasSection
              emails={categorizedEmails.emailAlias}
              onStatusUpdate={(emailId, status, statusText) => {
                updateEmailStatus.mutate({ emailId, status, statusText });
              }}
            />

            {/* Marketing/Splunk Section */}
            <MarketingSplunkSection
              emails={categorizedEmails.marketingSplunk}
              teamMembers={teamMembers || []}
              onAssign={(emailId, assigneeId, assigneeName) => {
                assignEmail.mutate({ emailId, assigneeId, assigneeName });
              }}
            />

            {/* VMware/TD SYNNEX Section */}
            <VMwareTDSynnexSection
              emails={categorizedEmails.vmwareTDSynnex}
              onAction={(emailId, action, data) => {
                performEmailAction.mutate({ emailId, action, data });
              }}
            />
          </div>
        ) : (
          <div className="iems-dashboard__empty">
            <EnvelopeIcon className="iems-dashboard__empty-icon" />
            <p>No emails to display</p>
          </div>
        )}
      </div>

      {/* Status Legend */}
      <div className="iems-dashboard__legend">
        <div className="iems-dashboard__legend-item">
          <span className="iems-dashboard__legend-dot iems-dashboard__legend-dot--red" />
          <span>Urgent/Critical</span>
        </div>
        <div className="iems-dashboard__legend-item">
          <span className="iems-dashboard__legend-dot iems-dashboard__legend-dot--yellow" />
          <span>In Progress</span>
        </div>
        <div className="iems-dashboard__legend-item">
          <span className="iems-dashboard__legend-dot iems-dashboard__legend-dot--green" />
          <span>Completed</span>
        </div>
      </div>
    </div>
  );
};