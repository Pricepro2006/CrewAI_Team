import React from 'react';
import { 
  CheckCircleIcon, 
  ClockIcon, 
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';
import type { IEMSEmail, EmailStatus } from '@/types/iems-email.types';
import './EmailAliasSection.css';

interface EmailAliasSectionProps {
  emails: IEMSEmail[];
  onStatusUpdate: (emailId: string, status: EmailStatus, statusText?: string) => void;
}

export const EmailAliasSection: React.FC<EmailAliasSectionProps> = ({ emails, onStatusUpdate }) => {
  const getStatusIcon = (status: EmailStatus) => {
    switch (status) {
      case 'red':
        return <ExclamationTriangleIcon className="email-status-icon email-status-icon--red" />;
      case 'yellow':
        return <ClockIcon className="email-status-icon email-status-icon--yellow" />;
      case 'green':
        return <CheckCircleIcon className="email-status-icon email-status-icon--green" />;
    }
  };

  const handleStatusChange = (emailId: string, newStatus: EmailStatus) => {
    const statusTexts: Record<EmailStatus, string> = {
      red: 'Urgent - Requires immediate attention',
      yellow: 'In Progress - Being handled',
      green: 'Completed - No action needed'
    };
    
    onStatusUpdate(emailId, newStatus, statusTexts[newStatus]);
  };

  return (
    <div className="email-alias-section">
      <div className="section-header">
        <h2 className="section-title">Email Alias</h2>
        <span className="section-count">{emails.length} emails</span>
      </div>
      
      <div className="section-table">
        <div className="table-header">
          <div className="table-header-cell table-header-cell--alias">Email Alias</div>
          <div className="table-header-cell table-header-cell--requestor">Requested By</div>
          <div className="table-header-cell table-header-cell--subject">Subject</div>
          <div className="table-header-cell table-header-cell--summary">Summary</div>
          <div className="table-header-cell table-header-cell--status">Status</div>
        </div>
        
        <div className="table-body">
          {emails.length === 0 ? (
            <div className="table-empty">
              <p>No emails in this category</p>
            </div>
          ) : (
            emails.map((email) => (
              <div key={email.id} className="table-row">
                <div className="table-cell table-cell--alias">
                  <div className="email-alias-name">{email.emailAlias}</div>
                </div>
                
                <div className="table-cell table-cell--requestor">
                  <div className="requestor-name">{email.requestedBy}</div>
                </div>
                
                <div className="table-cell table-cell--subject">
                  <div className="email-subject" title={email.subject}>
                    {email.subject}
                    {email.hasAttachments && (
                      <span className="attachment-indicator" title="Has attachments">📎</span>
                    )}
                  </div>
                </div>
                
                <div className="table-cell table-cell--summary">
                  <div className="email-summary" title={email.summary}>
                    {email.summary}
                  </div>
                </div>
                
                <div className="table-cell table-cell--status">
                  <div className="status-container">
                    <button
                      className={`status-button status-button--${email.status}`}
                      onClick={() => {
                        // Cycle through statuses: red -> yellow -> green -> red
                        const nextStatus: Record<EmailStatus, EmailStatus> = {
                          red: 'yellow',
                          yellow: 'green',
                          green: 'red'
                        };
                        handleStatusChange(email.id, nextStatus[email.status]);
                      }}
                      title={email.statusText || 'Click to change status'}
                    >
                      {getStatusIcon(email.status)}
                      <span className="status-text">{email.status}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};