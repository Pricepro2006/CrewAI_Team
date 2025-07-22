import React from "react";
import type { UnifiedEmailData } from "@/types/unified-email.types";

interface EmailListViewProps {
  emails: UnifiedEmailData[];
  onEmailSelect: (email: UnifiedEmailData) => void;
  selectedEmailId?: string;
}

export const EmailListView: React.FC<EmailListViewProps> = ({
  emails,
  onEmailSelect,
  selectedEmailId,
}) => {
  return (
    <div className="email-list-view">
      <div className="email-list-header">
        <h3>Emails ({emails.length})</h3>
      </div>
      <div className="email-list-content">
        {emails.map((email) => (
          <div
            key={email.id}
            className={`email-list-item ${selectedEmailId === email.id ? "selected" : ""}`}
            onClick={() => onEmailSelect(email)}
          >
            <div className="email-from">{email.from}</div>
            <div className="email-subject">{email.subject}</div>
            <div className="email-preview">
              {email.bodyText?.substring(0, 100)}...
            </div>
            <div className="email-meta">
              <span className="email-status">{email.status}</span>
              <span className="email-priority">{email.priority}</span>
              <span className="email-date">
                {new Date(email.receivedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
