import React, { useState } from 'react';
import { 
  UserIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import type { IEMSEmail } from '@/types/iems-email.types';
import './MarketingSplunkSection.css';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  available: boolean;
}

interface MarketingSplunkSectionProps {
  emails: IEMSEmail[];
  teamMembers: TeamMember[];
  onAssign: (emailId: string, assigneeId: string, assigneeName: string) => void;
}

export const MarketingSplunkSection: React.FC<MarketingSplunkSectionProps> = ({ 
  emails, 
  teamMembers, 
  onAssign 
}) => {
  const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());

  const toggleDropdown = (emailId: string) => {
    setOpenDropdowns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  const handleAssign = (emailId: string, member: TeamMember) => {
    onAssign(emailId, member.id, member.name);
    setOpenDropdowns(prev => {
      const newSet = new Set(prev);
      newSet.delete(emailId);
      return newSet;
    });
  };

  const availableMembers = teamMembers.filter(m => m.available);

  return (
    <div className="marketing-splunk-section">
      <div className="section-header">
        <h2 className="section-title">Marketing / Splunk</h2>
        <span className="section-count">{emails.length} emails</span>
      </div>
      
      <div className="section-table">
        <div className="table-header">
          <div className="table-header-cell table-header-cell--alias">Email Alias</div>
          <div className="table-header-cell table-header-cell--requestor">Requested By</div>
          <div className="table-header-cell table-header-cell--subject">Subject</div>
          <div className="table-header-cell table-header-cell--summary">Summary</div>
          <div className="table-header-cell table-header-cell--status">Status</div>
          <div className="table-header-cell table-header-cell--assigned">Assigned To</div>
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
                  <div className={`status-badge status-badge--${email.status}`}>
                    <span className="status-dot" />
                    <span className="status-text">{email.statusText || email.status}</span>
                  </div>
                </div>
                
                <div className="table-cell table-cell--assigned">
                  <div className="assignment-container">
                    {email.assignedTo ? (
                      <div className="assigned-member">
                        <UserIcon className="assigned-icon" />
                        <span className="assigned-name">{email.assignedTo}</span>
                      </div>
                    ) : (
                      <div className="assignment-dropdown">
                        <button
                          className="assignment-button"
                          onClick={() => toggleDropdown(email.id)}
                        >
                          <span>Assign</span>
                          <ChevronDownIcon className="dropdown-icon" />
                        </button>
                        
                        {openDropdowns.has(email.id) && (
                          <div className="dropdown-menu">
                            <div className="dropdown-header">Select Team Member</div>
                            {availableMembers.length === 0 ? (
                              <div className="dropdown-empty">No available members</div>
                            ) : (
                              availableMembers.map(member => (
                                <button
                                  key={member.id}
                                  className="dropdown-item"
                                  onClick={() => handleAssign(email.id, member)}
                                >
                                  <UserIcon className="dropdown-item-icon" />
                                  <div className="dropdown-item-content">
                                    <div className="dropdown-item-name">{member.name}</div>
                                    <div className="dropdown-item-email">{member.email}</div>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
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