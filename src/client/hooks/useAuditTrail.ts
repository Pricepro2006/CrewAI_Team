import { useState, useCallback, useEffect, useMemo } from 'react';

/**
 * Audit Trail Hook
 * Implements 2025 best practices for comprehensive audit logging
 * Agent 15: Status Management & Workflow Tracking
 */

export interface AuditEvent {
  id: string;
  entityType: 'email' | 'user' | 'system' | 'workflow';
  entityId: string;
  action: string;
  userId: string;
  userName: string;
  userRole: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  details: {
    before?: any;
    after?: any;
    changes?: Array<{
      field: string;
      oldValue: any;
      newValue: any;
    }>;
    metadata?: Record<string, any>;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'authentication' | 'authorization' | 'data_change' | 'system' | 'workflow' | 'security';
  source: 'web' | 'api' | 'system' | 'automation';
  tags?: string[];
}

export interface AuditFilter {
  entityType?: string[];
  action?: string[];
  userId?: string[];
  severity?: string[];
  category?: string[];
  source?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  searchQuery?: string;
  tags?: string[];
}

export interface AuditMetrics {
  totalEvents: number;
  eventsByCategory: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  eventsByUser: Record<string, number>;
  recentActivity: number; // Events in last 24h
  securityEvents: number;
  failedActions: number;
}

interface UseAuditTrailOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
  maxCachedEvents?: number;
  enableRealTime?: boolean;
}

export const useAuditTrail = (options: UseAuditTrailOptions = {}) => {
  const { 
    autoRefresh = false, 
    refreshInterval = 30000,
    maxCachedEvents = 1000,
    enableRealTime = false
  } = options;

  // State management
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filter, setFilter] = useState<AuditFilter>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  // Generate unique event ID
  const generateEventId = useCallback(() => {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Get current user context (would be from auth context in real app)
  const getCurrentUserContext = useCallback(() => {
    // This would normally come from your auth context
    return {
      userId: 'current_user_id',
      userName: 'Current User',
      userRole: 'agent',
      sessionId: sessionStorage.getItem('sessionId') || 'unknown',
      ipAddress: 'unknown', // Would be determined server-side
      userAgent: navigator.userAgent
    };
  }, []);

  // Log audit event
  const logEvent = useCallback(async (eventData: Omit<AuditEvent, 'id' | 'timestamp' | 'userId' | 'userName' | 'userRole' | 'userAgent' | 'sessionId'>) => {
    const userContext = getCurrentUserContext();
    
    const event: AuditEvent = {
      id: generateEventId(),
      timestamp: new Date().toISOString(),
      userId: userContext.userId,
      userName: userContext.userName,
      userRole: userContext.userRole,
      userAgent: userContext.userAgent,
      sessionId: userContext.sessionId,
      ipAddress: userContext.ipAddress,
      ...eventData
    };

    try {
      // In a real application, this would be an API call
      // await auditAPI.logEvent(event);
      
      // For now, add to local state (simulating successful API call)
      setEvents(prevEvents => {
        const newEvents = [event, ...prevEvents];
        // Keep only the most recent events to prevent memory issues
        return newEvents.slice(0, maxCachedEvents);
      });

      // Also send to console for development
      console.log('Audit Event Logged:', event);
      
      return event;
    } catch (error) {
      console.error('Failed to log audit event:', error);
      setError('Failed to log audit event');
      throw error;
    }
  }, [generateEventId, getCurrentUserContext, maxCachedEvents]);

  // Log status change event
  const logStatusChange = useCallback(async (emailId: string, fromStatus: string, toStatus: string, comment?: string, metadata?: Record<string, any>) => {
    return logEvent({
      entityType: 'email',
      entityId: emailId,
      action: 'status_change',
      severity: 'medium',
      category: 'workflow',
      source: 'web',
      details: {
        before: { status: fromStatus },
        after: { status: toStatus },
        changes: [{
          field: 'status',
          oldValue: fromStatus,
          newValue: toStatus
        }],
        metadata: {
          comment,
          ...metadata
        }
      },
      tags: ['status_change', 'workflow', fromStatus, toStatus]
    });
  }, [logEvent]);

  // Log user action event
  const logUserAction = useCallback(async (action: string, entityType: string, entityId: string, details?: any, severity: AuditEvent['severity'] = 'low') => {
    return logEvent({
      entityType: entityType as AuditEvent['entityType'],
      entityId,
      action,
      severity,
      category: 'data_change',
      source: 'web',
      details: details || {},
      tags: [action, entityType]
    });
  }, [logEvent]);

  // Log security event
  const logSecurityEvent = useCallback(async (action: string, severity: AuditEvent['severity'] = 'high', details?: any) => {
    return logEvent({
      entityType: 'system',
      entityId: 'security',
      action,
      severity,
      category: 'security',
      source: 'system',
      details: details || {},
      tags: ['security', action]
    });
  }, [logEvent]);

  // Log authentication event
  const logAuthEvent = useCallback(async (action: string, success: boolean, details?: any) => {
    return logEvent({
      entityType: 'user',
      entityId: getCurrentUserContext().userId,
      action,
      severity: success ? 'low' : 'high',
      category: 'authentication',
      source: 'web',
      details: {
        success,
        ...details
      },
      tags: ['authentication', action, success ? 'success' : 'failure']
    });
  }, [logEvent, getCurrentUserContext]);

  // Filter events based on current filter
  const filteredEvents = useMemo(() => {
    let filtered = [...events];

    // Apply filters
    if (filter.entityType?.length) {
      filtered = filtered.filter(event => filter.entityType!.includes(event.entityType));
    }

    if (filter.action?.length) {
      filtered = filtered.filter(event => filter.action!.includes(event.action));
    }

    if (filter.userId?.length) {
      filtered = filtered.filter(event => filter.userId!.includes(event.userId));
    }

    if (filter.severity?.length) {
      filtered = filtered.filter(event => filter.severity!.includes(event.severity));
    }

    if (filter.category?.length) {
      filtered = filtered.filter(event => filter.category!.includes(event.category));
    }

    if (filter.source?.length) {
      filtered = filtered.filter(event => filter.source!.includes(event.source));
    }

    if (filter.dateRange) {
      const startDate = new Date(filter.dateRange.start);
      const endDate = new Date(filter.dateRange.end);
      filtered = filtered.filter(event => {
        const eventDate = new Date(event.timestamp);
        return eventDate >= startDate && eventDate <= endDate;
      });
    }

    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      filtered = filtered.filter(event => 
        event.action.toLowerCase().includes(query) ||
        event.userName.toLowerCase().includes(query) ||
        event.entityId.toLowerCase().includes(query) ||
        JSON.stringify(event.details).toLowerCase().includes(query) ||
        event.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (filter.tags?.length) {
      filtered = filtered.filter(event => 
        event.tags?.some(tag => filter.tags!.includes(tag))
      );
    }

    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [events, filter]);

  // Calculate audit metrics
  const metrics = useMemo((): AuditMetrics => {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const eventsByCategory = events.reduce((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const eventsBySeverity = events.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const eventsByUser = events.reduce((acc, event) => {
      acc[event.userName] = (acc[event.userName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const recentActivity = events.filter(event => 
      new Date(event.timestamp) >= last24h
    ).length;

    const securityEvents = events.filter(event => 
      event.category === 'security' || event.severity === 'critical'
    ).length;

    const failedActions = events.filter(event => 
      event.details.success === false ||
      event.tags?.includes('failure') ||
      event.action.includes('failed')
    ).length;

    return {
      totalEvents: events.length,
      eventsByCategory,
      eventsBySeverity,
      eventsByUser,
      recentActivity,
      securityEvents,
      failedActions
    };
  }, [events]);

  // Export audit data
  const exportAuditData = useCallback((format: 'json' | 'csv' = 'json', events?: AuditEvent[]) => {
    const exportEvents = events || filteredEvents;
    
    if (format === 'json') {
      const dataStr = JSON.stringify(exportEvents, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit_log_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else if (format === 'csv') {
      const headers = ['ID', 'Timestamp', 'Entity Type', 'Entity ID', 'Action', 'User', 'Role', 'Severity', 'Category', 'Source', 'Details'];
      const csvData = [
        headers.join(','),
        ...exportEvents.map(event => [
          event.id,
          event.timestamp,
          event.entityType,
          event.entityId,
          event.action,
          event.userName,
          event.userRole,
          event.severity,
          event.category,
          event.source,
          JSON.stringify(event.details).replace(/"/g, '""')
        ].map(field => `"${field}"`).join(','))
      ].join('\n');

      const dataBlob = new Blob([csvData], { type: 'text/csv' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }, [filteredEvents]);

  // Refresh events (would normally fetch from API)
  const refreshEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // In a real application, this would be an API call
      // const newEvents = await auditAPI.getEvents(filter);
      // setEvents(newEvents);
      
      setLastRefresh(new Date().toISOString());
    } catch (error) {
      console.error('Failed to refresh audit events:', error);
      setError('Failed to refresh audit events');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(refreshEvents, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, refreshEvents]);

  // Get events for specific entity
  const getEntityEvents = useCallback((entityType: string, entityId: string) => {
    return events.filter(event => 
      event.entityType === entityType && event.entityId === entityId
    ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [events]);

  // Search events
  const searchEvents = useCallback((query: string) => {
    setFilter(prev => ({ ...prev, searchQuery: query }));
  }, []);

  // Clear filter
  const clearFilter = useCallback(() => {
    setFilter({});
  }, []);

  return {
    // State
    events: filteredEvents,
    allEvents: events,
    filter,
    isLoading,
    error,
    lastRefresh,
    metrics,
    
    // Event logging functions
    logEvent,
    logStatusChange,
    logUserAction,
    logSecurityEvent,
    logAuthEvent,
    
    // Filter and search functions
    setFilter,
    searchEvents,
    clearFilter,
    
    // Utility functions
    refreshEvents,
    exportAuditData,
    getEntityEvents,
    
    // Admin functions
    generateEventId,
    getCurrentUserContext
  };
};

export type { AuditEvent, AuditFilter, AuditMetrics };