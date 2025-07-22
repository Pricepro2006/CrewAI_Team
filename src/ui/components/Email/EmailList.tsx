import React, { useState, useEffect } from 'react';
import {
  EnvelopeIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  TagIcon,
  CalendarIcon,
  UserIcon,
  PaperClipIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';

export interface EmailListProps {
  emails: Email[];
  loading?: boolean;
  selectedEmails: string[];
  onEmailSelect: (selectedIds: string[]) => void;
  onEmailAction: () => void;
  filters?: any;
}

export interface Email {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  receivedDateTime: string;
  isRead: boolean;
  hasAttachments: boolean;
  bodyPreview?: string;
  analysis?: {
    quick_workflow?: string;
    quick_priority?: string;
    quick_confidence?: number;
    deep_workflow_primary?: string;
    action_summary?: string;
    action_sla_status?: string;
    workflow_state?: string;
    entities_po_numbers?: string;
    entities_quote_numbers?: string;
    entities_case_numbers?: string;
    business_impact_satisfaction?: string;
    contextual_summary?: string;
  };
}

interface EmailRowProps {
  email: Email;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onToggleDetail: () => void;
  showDetail: boolean;
}

const EmailRow: React.FC<EmailRowProps> = ({
  email,
  selected,
  onSelect,
  onToggleDetail,
  showDetail
}) => {
  const formatReceivedTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'Critical':
        return 'email-list__priority--critical';
      case 'High':
        return 'email-list__priority--high';
      case 'Medium':
        return 'email-list__priority--medium';
      case 'Low':
        return 'email-list__priority--low';
      default:
        return 'email-list__priority--default';
    }
  };

  const getWorkflowColor = (workflow?: string) => {
    switch (workflow) {
      case 'Order Management':
        return 'email-list__workflow--order';
      case 'Shipping/Logistics':
        return 'email-list__workflow--shipping';
      case 'Quote Processing':
        return 'email-list__workflow--quote';
      case 'Customer Support':
        return 'email-list__workflow--support';
      case 'Deal Registration':
        return 'email-list__workflow--deal';
      case 'Approval Workflows':
        return 'email-list__workflow--approval';
      default:
        return 'email-list__workflow--default';
    }
  };

  const getSLAStatusColor = (status?: string) => {
    switch (status) {
      case 'on-track':
        return 'email-list__sla--success';
      case 'at-risk':
        return 'email-list__sla--warning';
      case 'overdue':
        return 'email-list__sla--danger';
      default:
        return 'email-list__sla--default';
    }
  };

  const extractEntities = (email: Email) => {
    const entities = [];
    
    if (email.analysis?.entities_po_numbers) {
      try {
        const poNumbers = JSON.parse(email.analysis.entities_po_numbers);
        if (poNumbers.length > 0) {
          entities.push({ type: 'PO', value: poNumbers[0].value || poNumbers[0] });
        }
      } catch {
        // Ignore parsing errors
      }
    }
    
    if (email.analysis?.entities_quote_numbers) {
      try {
        const quoteNumbers = JSON.parse(email.analysis.entities_quote_numbers);
        if (quoteNumbers.length > 0) {
          entities.push({ type: 'Quote', value: quoteNumbers[0].value || quoteNumbers[0] });
        }
      } catch {
        // Ignore parsing errors
      }
    }
    
    if (email.analysis?.entities_case_numbers) {
      try {
        const caseNumbers = JSON.parse(email.analysis.entities_case_numbers);
        if (caseNumbers.length > 0) {
          entities.push({ type: 'Case', value: caseNumbers[0].value || caseNumbers[0] });
        }
      } catch {
        // Ignore parsing errors
      }
    }
    
    return entities;
  };

  const entities = extractEntities(email);

  return (
    <div className={`email-list__row ${selected ? 'email-list__row--selected' : ''} ${!email.isRead ? 'email-list__row--unread' : ''}`}>
      <div className="email-list__row-main" onClick={onToggleDetail}>
        <div className="email-list__row-checkbox">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect(e.target.checked);
            }}
            className="email-list__checkbox"
          />
        </div>

        <div className="email-list__row-content">
          <div className="email-list__row-header">
            <div className="email-list__row-sender">
              <UserIcon className="email-list__row-sender-icon" />
              <span className="email-list__row-sender-name">
                {email.from.emailAddress.name || email.from.emailAddress.address}
              </span>
              {email.hasAttachments && (
                <PaperClipIcon className="email-list__row-attachment-icon" />
              )}
            </div>
            
            <div className="email-list__row-metadata">
              <div className="email-list__row-time">
                <CalendarIcon className="email-list__row-time-icon" />
                {formatReceivedTime(email.receivedDateTime)}
              </div>
              
              {!email.isRead && (
                <div className="email-list__row-unread-badge">
                  <EyeSlashIcon className="email-list__row-unread-icon" />
                  Unread
                </div>
              )}
            </div>
          </div>

          <div className="email-list__row-subject">
            <span className="email-list__row-subject-text">{email.subject}</span>
            <div className="email-list__row-expand">
              {showDetail ? (
                <ChevronDownIcon className="email-list__row-expand-icon" />
              ) : (
                <ChevronRightIcon className="email-list__row-expand-icon" />
              )}
            </div>
          </div>

          <div className="email-list__row-tags">
            {email.analysis?.quick_priority && (
              <div className={`email-list__tag email-list__tag--priority ${getPriorityColor(email.analysis.quick_priority)}`}>
                {email.analysis.quick_priority}
              </div>
            )}
            
            {email.analysis?.deep_workflow_primary && (
              <div className={`email-list__tag email-list__tag--workflow ${getWorkflowColor(email.analysis.deep_workflow_primary)}`}>
                {email.analysis.deep_workflow_primary}
              </div>
            )}
            
            {email.analysis?.action_sla_status && (
              <div className={`email-list__tag email-list__tag--sla ${getSLAStatusColor(email.analysis.action_sla_status)}`}>
                SLA: {email.analysis.action_sla_status}
              </div>
            )}
            
            {email.analysis?.workflow_state && (
              <div className="email-list__tag email-list__tag--state">
                {email.analysis.workflow_state}
              </div>
            )}
          </div>

          {entities.length > 0 && (
            <div className="email-list__row-entities">
              {entities.map((entity, index) => (
                <div key={index} className="email-list__entity">
                  <TagIcon className="email-list__entity-icon" />
                  <span className="email-list__entity-type">{entity.type}:</span>
                  <span className="email-list__entity-value">{entity.value}</span>
                </div>
              ))}
            </div>
          )}

          {email.analysis?.action_summary && (
            <div className="email-list__row-action">
              <div className="email-list__row-action-summary">
                {email.analysis.action_summary}
              </div>
            </div>
          )}
        </div>
      </div>

      {showDetail && (
        <div className="email-list__row-detail">
          <div className="email-list__row-detail-content">
            {email.bodyPreview && (
              <div className="email-list__row-preview">
                <h4>Preview</h4>
                <p>{email.bodyPreview}</p>
              </div>
            )}
            
            {email.analysis?.contextual_summary && (
              <div className="email-list__row-summary">
                <h4>Analysis Summary</h4>
                <p>{email.analysis.contextual_summary}</p>
              </div>
            )}
            
            {email.analysis?.quick_confidence && (
              <div className="email-list__row-confidence">
                <h4>Confidence Score</h4>
                <div className="email-list__confidence-bar">
                  <div 
                    className="email-list__confidence-fill"
                    style={{ width: `${email.analysis.quick_confidence * 100}%` }}
                  />
                </div>
                <span className="email-list__confidence-value">
                  {(email.analysis.quick_confidence * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const EmailList: React.FC<EmailListProps> = ({
  emails,
  loading,
  selectedEmails,
  onEmailSelect,
  onEmailAction,
  filters
}) => {
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onEmailSelect(emails.map(email => email.id));
    } else {
      onEmailSelect([]);
    }
  };

  const handleEmailSelect = (emailId: string, selected: boolean) => {
    if (selected) {
      onEmailSelect([...selectedEmails, emailId]);
    } else {
      onEmailSelect(selectedEmails.filter(id => id !== emailId));
    }
  };

  const handleToggleDetail = (emailId: string) => {
    const newExpanded = new Set(expandedEmails);
    if (newExpanded.has(emailId)) {
      newExpanded.delete(emailId);
    } else {
      newExpanded.add(emailId);
    }
    setExpandedEmails(newExpanded);
  };

  if (loading) {
    return (
      <div className="email-list">
        <div className="email-list__header">
          <h3>Loading emails...</h3>
        </div>
        <div className="email-list__loading">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="email-list__row email-list__row--skeleton">
              <div className="email-list__skeleton"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!emails || emails.length === 0) {
    return (
      <div className="email-list">
        <div className="email-list__header">
          <h3>No emails found</h3>
          <p>Try adjusting your filters or search criteria</p>
        </div>
      </div>
    );
  }

  const isAllSelected = emails.length > 0 && selectedEmails.length === emails.length;
  const isPartialSelected = selectedEmails.length > 0 && selectedEmails.length < emails.length;

  return (
    <div className="email-list">
      <div className="email-list__header">
        <div className="email-list__header-controls">
          <div className="email-list__select-all">
            <input
              type="checkbox"
              checked={isAllSelected}
              ref={input => {
                if (input) input.indeterminate = isPartialSelected;
              }}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="email-list__checkbox"
            />
            <label>
              {isAllSelected ? 'Deselect All' : 'Select All'}
              {selectedEmails.length > 0 && ` (${selectedEmails.length})`}
            </label>
          </div>
          
          <div className="email-list__count">
            {emails.length} email{emails.length !== 1 ? 's' : ''}
            {filters && Object.keys(filters).length > 0 && ' (filtered)'}
          </div>
        </div>
      </div>

      <div className="email-list__content">
        {emails.map(email => (
          <EmailRow
            key={email.id}
            email={email}
            selected={selectedEmails.includes(email.id)}
            onSelect={(selected) => handleEmailSelect(email.id, selected)}
            onToggleDetail={() => handleToggleDetail(email.id)}
            showDetail={expandedEmails.has(email.id)}
          />
        ))}
      </div>

      {emails.length >= 50 && (
        <div className="email-list__footer">
          <p>Showing first 50 emails. Use filters to narrow results.</p>
        </div>
      )}
    </div>
  );
};