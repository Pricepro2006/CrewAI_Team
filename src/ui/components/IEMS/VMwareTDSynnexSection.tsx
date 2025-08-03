import React from "react";
import {
  EyeIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import type {
  IEMSEmail,
  EmailStatus,
} from "../../../types/iems-email.types";
import "./VMwareTDSynnexSection.css";

interface VMwareTDSynnexSectionProps {
  emails: IEMSEmail[];
  onAction: (emailId: string, action: string, data?: any) => void;
}

export const VMwareTDSynnexSection: React.FC<VMwareTDSynnexSectionProps> = ({
  emails,
  onAction,
}) => {
  const getStatusIcon = (status: EmailStatus) => {
    switch (status) {
      case "red":
        return (
          <ExclamationTriangleIcon className="status-icon status-icon--red" />
        );
      case "yellow":
        return <ClockIcon className="status-icon status-icon--yellow" />;
      case "green":
        return <CheckCircleIcon className="status-icon status-icon--green" />;
    }
  };

  const handleViewCase = (email: IEMSEmail) => {
    onAction(email.id, "viewCase", {
      emailSubject: email.subject,
      caseData: email.rawData,
    });
  };

  return (
    <div className="vmware-tdsynnex-section">
      <div className="section-header">
        <h2 className="section-title">VMware / TD SYNNEX</h2>
        <span className="section-count">{emails.length} emails</span>
      </div>

      <div className="section-table">
        <div className="table-header">
          <div className="table-header-cell table-header-cell--alias">
            Email Alias
          </div>
          <div className="table-header-cell table-header-cell--requestor">
            Requested By
          </div>
          <div className="table-header-cell table-header-cell--subject">
            Subject
          </div>
          <div className="table-header-cell table-header-cell--summary">
            Summary
          </div>
          <div className="table-header-cell table-header-cell--status">
            Status
          </div>
          <div className="table-header-cell table-header-cell--action">
            Action
          </div>
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
                      <span
                        className="attachment-indicator"
                        title="Has attachments"
                      >
                        📎
                      </span>
                    )}
                  </div>
                </div>

                <div className="table-cell table-cell--summary">
                  <div className="email-summary" title={email.summary}>
                    {email.summary}
                  </div>
                </div>

                <div className="table-cell table-cell--status">
                  <div className="status-display">
                    {getStatusIcon(email.status)}
                    <span
                      className={`status-text status-text--${email.status}`}
                    >
                      {email.statusText || email.status}
                    </span>
                  </div>
                </div>

                <div className="table-cell table-cell--action">
                  {email.action && (
                    <button
                      className="action-button"
                      onClick={() => handleViewCase(email)}
                      title="View support case details"
                    >
                      <EyeIcon className="action-icon" />
                      <span>{email.action}</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
