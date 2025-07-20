import React, { useState, useCallback, useMemo } from 'react';
import { CheckCircle, Clock, AlertTriangle, ArrowRight, History, User, Calendar } from 'lucide-react';

/**
 * Status Update Manager Component
 * Implements 2025 best practices for workflow status management
 * Agent 15: Status Management & Workflow Tracking
 */

export type EmailStatus = 'pending' | 'in_progress' | 'under_review' | 'approved' | 'rejected' | 'completed' | 'archived';

export interface StatusTransition {
  from: EmailStatus;
  to: EmailStatus;
  label: string;
  requiresComment?: boolean;
  requiresApproval?: boolean;
  permissions?: string[];
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface StatusHistoryEntry {
  id: string;
  emailId: string;
  fromStatus: EmailStatus | null;
  toStatus: EmailStatus;
  userId: string;
  userName: string;
  userRole: string;
  timestamp: string;
  comment?: string;
  metadata?: Record<string, any>;
  transitionType: 'manual' | 'automatic' | 'scheduled';
  ipAddress?: string;
  userAgent?: string;
}

export interface EmailWorkflowData {
  id: string;
  subject: string;
  currentStatus: EmailStatus;
  assignedTo?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string;
  lastUpdated: string;
  statusHistory: StatusHistoryEntry[];
}

interface StatusUpdateManagerProps {
  emailData: EmailWorkflowData;
  currentUser: {
    id: string;
    name: string;
    role: string;
    permissions: string[];
  };
  onStatusUpdate: (transition: {
    emailId: string;
    fromStatus: EmailStatus;
    toStatus: EmailStatus;
    comment?: string;
    metadata?: Record<string, any>;
  }) => Promise<void>;
  onHistoryView: (emailId: string) => void;
  isUpdating?: boolean;
  className?: string;
}

// Status configuration following 2025 UX patterns
const STATUS_CONFIG: Record<EmailStatus, {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = {
  pending: {
    label: 'Pending',
    color: '#6B7280',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
    icon: Clock,
    description: 'Awaiting initial processing'
  },
  in_progress: {
    label: 'In Progress',
    color: '#F59E0B',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-700',
    icon: Clock,
    description: 'Currently being processed'
  },
  under_review: {
    label: 'Under Review',
    color: '#3B82F6',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    icon: AlertTriangle,
    description: 'Under management review'
  },
  approved: {
    label: 'Approved',
    color: '#10B981',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    icon: CheckCircle,
    description: 'Approved and ready for execution'
  },
  rejected: {
    label: 'Rejected',
    color: '#EF4444',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    icon: AlertTriangle,
    description: 'Rejected - requires attention'
  },
  completed: {
    label: 'Completed',
    color: '#059669',
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-700',
    icon: CheckCircle,
    description: 'Successfully completed'
  },
  archived: {
    label: 'Archived',
    color: '#6B7280',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-500',
    icon: Clock,
    description: 'Archived for reference'
  }
};

// Workflow transitions following state machine principles
const STATUS_TRANSITIONS: StatusTransition[] = [
  {
    from: 'pending',
    to: 'in_progress',
    label: 'Start Processing',
    color: '#F59E0B',
    icon: ArrowRight,
    permissions: ['agent', 'supervisor', 'admin']
  },
  {
    from: 'pending',
    to: 'rejected',
    label: 'Reject Request',
    requiresComment: true,
    color: '#EF4444',
    icon: AlertTriangle,
    permissions: ['supervisor', 'admin']
  },
  {
    from: 'in_progress',
    to: 'under_review',
    label: 'Submit for Review',
    requiresComment: true,
    color: '#3B82F6',
    icon: ArrowRight,
    permissions: ['agent', 'supervisor', 'admin']
  },
  {
    from: 'in_progress',
    to: 'completed',
    label: 'Mark Complete',
    requiresComment: true,
    color: '#059669',
    icon: CheckCircle,
    permissions: ['agent', 'supervisor', 'admin']
  },
  {
    from: 'under_review',
    to: 'approved',
    label: 'Approve',
    requiresComment: true,
    color: '#10B981',
    icon: CheckCircle,
    permissions: ['supervisor', 'admin']
  },
  {
    from: 'under_review',
    to: 'rejected',
    label: 'Reject',
    requiresComment: true,
    color: '#EF4444',
    icon: AlertTriangle,
    permissions: ['supervisor', 'admin']
  },
  {
    from: 'under_review',
    to: 'in_progress',
    label: 'Return for Revision',
    requiresComment: true,
    color: '#F59E0B',
    icon: ArrowRight,
    permissions: ['supervisor', 'admin']
  },
  {
    from: 'approved',
    to: 'completed',
    label: 'Execute & Complete',
    color: '#059669',
    icon: CheckCircle,
    permissions: ['agent', 'supervisor', 'admin']
  },
  {
    from: 'rejected',
    to: 'in_progress',
    label: 'Reprocess',
    requiresComment: true,
    color: '#F59E0B',
    icon: ArrowRight,
    permissions: ['supervisor', 'admin']
  },
  {
    from: 'completed',
    to: 'archived',
    label: 'Archive',
    color: '#6B7280',
    icon: Clock,
    permissions: ['admin']
  }
];

export const StatusUpdateManager: React.FC<StatusUpdateManagerProps> = ({
  emailData,
  currentUser,
  onStatusUpdate,
  onHistoryView,
  isUpdating = false,
  className = ''
}) => {
  const [selectedTransition, setSelectedTransition] = useState<StatusTransition | null>(null);
  const [comment, setComment] = useState('');
  const [showTransitionDialog, setShowTransitionDialog] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Get available transitions for current status
  const availableTransitions = useMemo(() => {
    return STATUS_TRANSITIONS.filter(transition => {
      const hasValidFrom = transition.from === emailData.currentStatus;
      const hasPermission = !transition.permissions || 
        transition.permissions.some(permission => currentUser.permissions.includes(permission));
      return hasValidFrom && hasPermission;
    });
  }, [emailData.currentStatus, currentUser.permissions]);

  // Get current status configuration
  const currentStatusConfig = STATUS_CONFIG[emailData.currentStatus];

  // Handle transition selection
  const handleTransitionSelect = useCallback((transition: StatusTransition) => {
    setSelectedTransition(transition);
    setComment('');
    setShowTransitionDialog(true);
  }, []);

  // Handle status update
  const handleStatusUpdate = useCallback(async () => {
    if (!selectedTransition) return;

    if (selectedTransition.requiresComment && !comment.trim()) {
      alert('Comment is required for this transition');
      return;
    }

    try {
      await onStatusUpdate({
        emailId: emailData.id,
        fromStatus: emailData.currentStatus,
        toStatus: selectedTransition.to,
        comment: comment.trim() || undefined,
        metadata: {
          transitionId: `${selectedTransition.from}_to_${selectedTransition.to}`,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      });

      setShowTransitionDialog(false);
      setSelectedTransition(null);
      setComment('');
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update status. Please try again.');
    }
  }, [selectedTransition, comment, emailData, onStatusUpdate]);

  // Format timestamp for display
  const formatTimestamp = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
      relative: getRelativeTime(date)
    };
  }, []);

  // Get relative time
  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'text-green-600 bg-green-50',
      medium: 'text-yellow-600 bg-yellow-50',
      high: 'text-orange-600 bg-orange-50',
      critical: 'text-red-600 bg-red-50'
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  return (
    <div className={`status-update-manager bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${currentStatusConfig.bgColor}`}>
              <currentStatusConfig.icon className={`w-4 h-4 ${currentStatusConfig.textColor}`} />
              <span className={`text-sm font-medium ${currentStatusConfig.textColor}`}>
                {currentStatusConfig.label}
              </span>
            </div>
            <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(emailData.priority)}`}>
              {emailData.priority.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
              title="View History"
            >
              <History className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 truncate">
            {emailData.subject}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {currentStatusConfig.description}
          </p>
        </div>

        {/* Metadata */}
        <div className="mt-3 flex items-center space-x-4 text-sm text-gray-500">
          {emailData.assignedTo && (
            <div className="flex items-center space-x-1">
              <User className="w-4 h-4" />
              <span>Assigned to {emailData.assignedTo}</span>
            </div>
          )}
          {emailData.dueDate && (
            <div className="flex items-center space-x-1">
              <Calendar className="w-4 h-4" />
              <span>Due {formatTimestamp(emailData.dueDate).relative}</span>
            </div>
          )}
          <div>
            Last updated {formatTimestamp(emailData.lastUpdated).relative}
          </div>
        </div>
      </div>

      {/* Status Transitions */}
      {availableTransitions.length > 0 && (
        <div className="p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Available Actions</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {availableTransitions.map((transition) => (
              <button
                key={`${transition.from}_to_${transition.to}`}
                onClick={() => handleTransitionSelect(transition)}
                disabled={isUpdating}
                className="flex items-center space-x-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  borderColor: `${transition.color}30`,
                  backgroundColor: `${transition.color}05`
                }}
              >
                <span style={{ color: transition.color }}>
                  <transition.icon className="w-4 h-4 flex-shrink-0" />
                </span>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-gray-900">
                    {transition.label}
                  </div>
                  <div className="text-xs text-gray-500">
                    → {STATUS_CONFIG[transition.to].label}
                    {transition.requiresComment && ' (requires comment)'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent History Preview */}
      {!showHistory && emailData.statusHistory.length > 0 && (
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-900">Recent Activity</h4>
            <button
              onClick={() => setShowHistory(true)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View All ({emailData.statusHistory.length})
            </button>
          </div>
          <div className="space-y-2">
            {emailData.statusHistory.slice(0, 3).map((entry) => (
              <div key={entry.id} className="flex items-center space-x-3 text-sm">
                <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-gray-600" />
                </div>
                <div className="flex-1">
                  <span className="font-medium text-gray-900">{entry.userName}</span>
                  <span className="text-gray-600"> changed status to </span>
                  <span className="font-medium" style={{ color: STATUS_CONFIG[entry.toStatus].color }}>
                    {STATUS_CONFIG[entry.toStatus].label}
                  </span>
                  <div className="text-gray-500">
                    {formatTimestamp(entry.timestamp).relative}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full History */}
      {showHistory && (
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-900">Status History</h4>
            <button
              onClick={() => setShowHistory(false)}
              className="text-sm text-gray-600 hover:text-gray-700"
            >
              Hide
            </button>
          </div>
          <div className="space-y-4">
            {emailData.statusHistory.map((entry, index) => {
              const isLast = index === emailData.statusHistory.length - 1;
              return (
                <div key={entry.id} className="relative">
                  {!isLast && (
                    <div className="absolute left-4 top-8 w-0.5 h-6 bg-gray-200" />
                  )}
                  <div className="flex space-x-3">
                    <div 
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ 
                        backgroundColor: `${STATUS_CONFIG[entry.toStatus].color}20`,
                        color: STATUS_CONFIG[entry.toStatus].color
                      }}
                    >
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">{entry.userName}</span>
                        <span className="text-gray-600">•</span>
                        <span className="text-sm text-gray-600">{entry.userRole}</span>
                        <span className="text-gray-600">•</span>
                        <span className="text-sm text-gray-500">
                          {entry.transitionType}
                        </span>
                      </div>
                      <div className="mt-1">
                        {entry.fromStatus && (
                          <span className="text-sm text-gray-600">
                            Changed from {STATUS_CONFIG[entry.fromStatus].label} to{' '}
                          </span>
                        )}
                        <span 
                          className="text-sm font-medium"
                          style={{ color: STATUS_CONFIG[entry.toStatus].color }}
                        >
                          {STATUS_CONFIG[entry.toStatus].label}
                        </span>
                      </div>
                      {entry.comment && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                          "{entry.comment}"
                        </div>
                      )}
                      <div className="mt-2 text-xs text-gray-500">
                        {formatTimestamp(entry.timestamp).date} at {formatTimestamp(entry.timestamp).time}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Status Transition Dialog */}
      {showTransitionDialog && selectedTransition && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {selectedTransition.label}
            </h3>
            <div className="mb-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>Change status from</span>
                <span 
                  className="px-2 py-1 rounded font-medium"
                  style={{ 
                    backgroundColor: `${currentStatusConfig.color}20`,
                    color: currentStatusConfig.color
                  }}
                >
                  {currentStatusConfig.label}
                </span>
                <span>to</span>
                <span 
                  className="px-2 py-1 rounded font-medium"
                  style={{ 
                    backgroundColor: `${selectedTransition.color}20`,
                    color: selectedTransition.color
                  }}
                >
                  {STATUS_CONFIG[selectedTransition.to].label}
                </span>
              </div>
            </div>

            {selectedTransition.requiresComment && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comment {selectedTransition.requiresComment && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Enter a comment explaining this status change..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowTransitionDialog(false)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusUpdate}
                disabled={isUpdating || (selectedTransition.requiresComment && !comment.trim())}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: selectedTransition.color }}
              >
                {isUpdating ? 'Updating...' : selectedTransition.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusUpdateManager;