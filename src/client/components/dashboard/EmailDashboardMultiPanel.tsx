import React, { useState, useCallback, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { EmailTable } from "../email/EmailTable.js";
import { StatusIndicator } from "../email/StatusIndicator.js";
import { cn } from "../../../lib/utils.js";
import { TEAM_MEMBERS } from "../../../config/team-members.config.js";
import type {
  EmailRecord,
  EmailStatus,
  Priority,
} from "../../../types/email-dashboard.interfaces.js";

interface EmailDashboardMultiPanelProps {
  emails: EmailRecord[];
  loading?: boolean;
  error?: string | null;
  onEmailSelect?: (email: EmailRecord) => void;
  onAssignEmail?: (emailId: string, assignedTo: string) => Promise<void>;
  onStatusChange?: (emailId: string, newStatus: EmailStatus) => Promise<void>;
  className?: string;
}

interface PanelEmailItem {
  id: string;
  alias: string;
  requester: string;
  subject: string;
  status: EmailStatus;
  statusText: string;
  timestamp: string;
}

export function EmailDashboardMultiPanel({
  emails,
  loading = false,
  error = null,
  onEmailSelect,
  onAssignEmail,
  onStatusChange,
  className,
}: EmailDashboardMultiPanelProps) {
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  // Filter emails by specific aliases for panels
  const marketingEmails = useMemo(
    () =>
      emails
        .filter(
          (email) =>
            email.email_alias.toLowerCase().includes("marketing") ||
            email.email_alias.toLowerCase().includes("splunk"),
        )
        .slice(0, 5), // Show top 5
    [emails],
  );

  const vmwareEmails = useMemo(
    () =>
      emails
        .filter(
          (email) =>
            email.email_alias.toLowerCase().includes("vmware") ||
            email.email_alias.toLowerCase().includes("tdsynnex"),
        )
        .slice(0, 5), // Show top 5
    [emails],
  );

  const handleEmailClick = useCallback(
    (email: EmailRecord) => {
      setSelectedEmailId(email.id);
      onEmailSelect?.(email);
    },
    [onEmailSelect],
  );

  const renderPanelItem = (email: EmailRecord) => (
    <div
      key={email.id}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
        "hover:bg-muted/50",
        selectedEmailId === email.id && "bg-muted",
      )}
      onClick={() => handleEmailClick(email)}
    >
      <StatusIndicator
        status={email.status}
        statusText={email.status_text}
        size="sm"
        showPulse={email.status === "red"}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {email.requested_by}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(email.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {email.subject}
        </p>
      </div>
      {email.priority === "critical" && (
        <Badge variant="destructive" className="text-xs">
          Critical
        </Badge>
      )}
    </div>
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main Email Table */}
      <Card>
        <CardHeader>
          <CardTitle>Email Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <EmailTable
            emails={emails}
            loading={loading}
            error={error}
            teamMembers={TEAM_MEMBERS}
            onRowClick={handleEmailClick}
            onAssignEmail={onAssignEmail}
            selectedEmails={selectedEmailId ? [selectedEmailId] : []}
            className="border-0"
          />
        </CardContent>
      </Card>

      {/* Secondary Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Marketing-Splunk Panel */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Marketing-Splunk</CardTitle>
              <Badge variant="secondary">{marketingEmails.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {marketingEmails.length > 0 ? (
              marketingEmails.map(renderPanelItem)
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No marketing emails
              </p>
            )}
          </CardContent>
        </Card>

        {/* VMware@TDSynnex Panel */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">VMware@TDSynnex</CardTitle>
              <Badge variant="secondary">{vmwareEmails.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {vmwareEmails.length > 0 ? (
              vmwareEmails.map(renderPanelItem)
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No VMware emails
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
