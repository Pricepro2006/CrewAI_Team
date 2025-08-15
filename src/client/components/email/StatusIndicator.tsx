import React from "react";
import { cn } from "../../../lib/utils.js";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../components/ui/tooltip.js";
import type { EmailStatus } from "../../../types/email-dashboard?.interfaces.js";

interface StatusIndicatorProps {
  status: EmailStatus;
  statusText?: string;
  size?: "sm" | "md" | "lg";
  showPulse?: boolean;
  showTooltip?: boolean;
  className?: string;
}

const statusConfig: Record<
  EmailStatus,
  { color: string; bgColor: string; label: string }
> = {
  red: {
    color: "bg-red-500",
    bgColor: "bg-red-100",
    label: "Critical",
  },
  yellow: {
    color: "bg-yellow-500",
    bgColor: "bg-yellow-100",
    label: "In Progress",
  },
  green: {
    color: "bg-green-500",
    bgColor: "bg-green-100",
    label: "Completed",
  },
};

const sizeConfig = {
  sm: {
    container: "h-4 w-4",
    dot: "h-2 w-2",
    text: "text-xs",
    gap: "gap-1",
  },
  md: {
    container: "h-5 w-5",
    dot: "h-3 w-3",
    text: "text-sm",
    gap: "gap-2",
  },
  lg: {
    container: "h-6 w-6",
    dot: "h-4 w-4",
    text: "text-base",
    gap: "gap-2",
  },
};

export function StatusIndicator({
  status,
  statusText,
  size = "md",
  showPulse = false,
  showTooltip = true,
  className,
}: StatusIndicatorProps) {
  const config = statusConfig[status];
  const sizeStyles = sizeConfig[size];
  const displayText = statusText || config.label;

  const indicator = (
    <div className={cn("flex items-center", sizeStyles.gap, className)}>
      <div
        className={cn(
          "relative flex items-center justify-center",
          sizeStyles.container,
        )}
      >
        {showPulse && status === "red" && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              config.color,
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex rounded-full",
            sizeStyles.dot,
            config.color,
          )}
        />
      </div>
      {statusText && (
        <span className={cn("font-medium", sizeStyles.text)}>
          {displayText}
        </span>
      )}
    </div>
  );

  if (showTooltip && !statusText) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{indicator}</TooltipTrigger>
          <TooltipContent>
            <p>{displayText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return indicator;
}

// Compound component for status badges
interface StatusBadgeProps extends Omit<StatusIndicatorProps, "showTooltip"> {
  children?: React.ReactNode;
}

export function StatusBadge({
  status,
  statusText,
  size = "md",
  showPulse = false,
  className,
  children,
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const sizeStyles = sizeConfig[size];

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5",
        config.bgColor,
        className,
      )}
    >
      <StatusIndicator
        status={status}
        size={size}
        showPulse={showPulse}
        showTooltip={false}
      />
      <span
        className={cn(
          "ml-1.5 font-medium",
          sizeStyles.text,
          status === "red"
            ? "text-red-800"
            : status === "yellow"
              ? "text-yellow-800"
              : "text-green-800",
        )}
      >
        {children || statusText || config.label}
      </span>
    </div>
  );
}

// Status legend component for dashboard
export function StatusLegend() {
  return (
    <div className="flex items-center gap-4">
      {Object.entries(statusConfig).map(([status, config]) => (
        <div key={status} className="flex items-center gap-2">
          <StatusIndicator
            status={status as EmailStatus}
            size="sm"
            showTooltip={false}
          />
          <span className="text-sm text-muted-foreground">{config.label}</span>
        </div>
      ))}
    </div>
  );
}
