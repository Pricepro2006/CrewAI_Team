import * as React from "react";
import { cn } from "../../utils/cn.js";

export interface CalendarProps {
  className?: string;
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  disabled?: boolean;
}

/**
 * Calendar placeholder component
 * TODO: Implement with react-day-picker or similar library
 */
export function Calendar({
  className,
  selected,
  onSelect,
  disabled,
}: CalendarProps) {
  return (
    <div className={cn("p-3", className)}>
      <div className="space-y-4">
        <div className="text-center text-sm font-medium">
          {selected ? selected.toLocaleDateString() : "Select a date"}
        </div>
        <div className="text-xs text-muted-foreground">
          Calendar component placeholder
        </div>
      </div>
    </div>
  );
}
