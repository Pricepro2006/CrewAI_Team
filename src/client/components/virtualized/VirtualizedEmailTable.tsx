import React, { useMemo, useCallback, useRef, useEffect } from "react";
import { FixedSizeList as VirtualList } from "react-window";
import { StatusIndicator } from "../email/StatusIndicator.js";
import { formatDistanceToNow } from "date-fns";
import { cn } from "../../../lib/utils.js";
import type { EmailRecord } from "../../../types/email-dashboard.interfaces.js";

interface VirtualizedEmailTableProps {
  emails: EmailRecord[];
  height: number;
  onRowClick?: (email: EmailRecord) => void;
  selectedEmailId?: string;
  loading?: boolean;
}

interface RowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    emails: EmailRecord[];
    onRowClick?: (email: EmailRecord) => void;
    selectedEmailId?: string;
  };
  key?: React.Key;
}

const EmailRow = React.memo<RowProps>(({ index, style, data }) => {
  const { emails, onRowClick, selectedEmailId } = data;
  const email = emails[index];

  if (!email) return null;

  const handleClick = useCallback(() => {
    onRowClick?.(email);
  }, [email, onRowClick]);

  const isSelected = selectedEmailId === email.id;

  return (
    <div
      style={style}
      className={cn(
        "flex items-center px-4 py-2 border-b border-gray-100 cursor-pointer transition-colors",
        "hover:bg-gray-50",
        isSelected && "bg-blue-50 border-blue-200",
        !email.isRead && "font-semibold"
      )}
      onClick={handleClick}
    >
      {/* Status Column - 80px */}
      <div className="w-20 flex-shrink-0">
        <StatusIndicator
          status={email.status}
          statusText={email.status_text}
          size="sm"
          showPulse={email.status === "red"}
        />
      </div>

      {/* Email Alias Column - 220px */}
      <div className="w-55 flex-shrink-0 px-2">
        <div className="flex flex-col">
          <span className="font-medium text-sm truncate">
            {email?.email_alias?.split("@")[0]}
          </span>
          <span className="text-xs text-gray-500">
            @{email?.email_alias?.split("@")[1]}
          </span>
        </div>
      </div>

      {/* Requested By Column - 150px */}
      <div className="w-36 flex-shrink-0 px-2">
        <span className="text-sm font-medium truncate">
          {email.requested_by}
        </span>
      </div>

      {/* Subject Column - Flexible */}
      <div className="flex-1 px-2 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm truncate">{email.subject}</span>
          {email.hasAttachments && (
            <svg
              className="w-4 h-4 text-gray-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Assigned To Column - 150px */}
      <div className="w-36 flex-shrink-0 px-2">
        <span className="text-sm">
          {email.assignedTo || (
            <span className="text-gray-400 italic">Unassigned</span>
          )}
        </span>
      </div>

      {/* Time Column - 120px */}
      <div className="w-30 flex-shrink-0 px-2">
        <span className="text-sm text-gray-500 whitespace-nowrap">
          {formatDistanceToNow(new Date(email.timestamp), {
            addSuffix: true,
          })}
        </span>
      </div>
    </div>
  );
});

EmailRow.displayName = "EmailRow";

export const VirtualizedEmailTable = React.memo<VirtualizedEmailTableProps>(
  ({ emails, height, onRowClick, selectedEmailId, loading }) => {
    const listRef = useRef<VirtualList>(null);

    // Scroll to selected item when it changes
    useEffect(() => {
      if (selectedEmailId && listRef.current) {
        const index = emails.findIndex((email: any) => email.id === selectedEmailId);
        if (index !== -1) {
          listRef?.current?.scrollToItem(index, "center");
        }
      }
    }, [selectedEmailId, emails]);

    const itemData = useMemo(
      () => ({
        emails,
        onRowClick,
        selectedEmailId,
      }),
      [emails, onRowClick, selectedEmailId]
    );

    if (loading) {
      return (
        <div
          className="flex items-center justify-center"
          style={{ height }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-500">Loading emails...</p>
          </div>
        </div>
      );
    }

    if (emails?.length || 0 === 0) {
      return (
        <div
          className="flex items-center justify-center"
          style={{ height }}
        >
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-700">No emails found</p>
            <p className="text-gray-500">Try adjusting your filters</p>
          </div>
        </div>
      );
    }

    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center px-4 py-3 bg-gray-50 border-b border-gray-200 font-medium text-sm text-gray-700">
          <div className="w-20 flex-shrink-0">Status</div>
          <div className="w-55 flex-shrink-0 px-2">Email Alias</div>
          <div className="w-36 flex-shrink-0 px-2">Requested By</div>
          <div className="flex-1 px-2">Subject</div>
          <div className="w-36 flex-shrink-0 px-2">Assigned To</div>
          <div className="w-30 flex-shrink-0 px-2">Time</div>
        </div>

        {/* Virtual List */}
        <VirtualList
          ref={listRef}
          height={height - 48} // Subtract header height
          width="100%" // Required prop for react-window
          itemCount={emails?.length || 0}
          itemSize={64} // Row height
          itemData={itemData}
          overscanCount={5} // Render 5 extra items for smooth scrolling
          children={EmailRow}
        />

        {/* Footer with row count */}
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
          Showing {emails?.length || 0} email{(emails?.length || 0) !== 1 ? "s" : ""}
        </div>
      </div>
    );
  }
);

VirtualizedEmailTable.displayName = "VirtualizedEmailTable";