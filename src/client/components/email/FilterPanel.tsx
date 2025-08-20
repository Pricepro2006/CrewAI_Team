import React, { useState, useCallback } from "react";
import { X, Filter, Search, Calendar, Tag, User, Mail } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Badge } from "../../../components/ui/badge";
import { Checkbox } from "../../../components/ui/checkbox";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { Separator } from "../../../components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "../../../components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import {
  DateRangePicker,
  type DateRange,
} from "../../../components/ui/date-range-picker";
import { StatusIndicator } from "./StatusIndicator";
import type {
  EmailStatus,
  WorkflowState,
  Priority,
  FilterConfig,
  FilterOptions,
  StatusOption,
} from "../../../types/email-dashboard.interfaces";

interface FilterPanelProps {
  filters: FilterConfig;
  filterOptions: FilterOptions;
  onFiltersChange: (filters: FilterConfig) => void;
  onReset: () => void;
  activeFilterCount?: number;
}

const workflowStateLabels: Record<WorkflowState, string> = {
  START_POINT: "Start Point",
  IN_PROGRESS: "In Progress",
  COMPLETION: "Completion",
};

const priorityLabels: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function FilterPanel({
  filters,
  filterOptions,
  onFiltersChange,
  onReset,
  activeFilterCount = 0,
}: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<FilterConfig>(filters);

  const handleFilterChange = useCallback(
    (key: keyof FilterConfig, value: any) => {
      setLocalFilters((prev: any) => ({
        ...prev,
        [key]: value,
      }));
    },
    [],
  );

  const handleApplyFilters = useCallback(() => {
    onFiltersChange(localFilters);
    setIsOpen(false);
  }, [localFilters, onFiltersChange]);

  const handleReset = useCallback(() => {
    const resetFilters: FilterConfig = {
      search: "",
      emailAliases: [],
      requesters: [],
      statuses: [],
      workflowStates: [],
      workflowTypes: [],
      priorities: [],
      dateRange: {
        start: null,
        end: null,
      },
      hasAttachments: undefined,
      isRead: undefined,
      tags: [],
    };
    setLocalFilters(resetFilters);
    onReset();
  }, [onReset]);

  const toggleArrayFilter = useCallback(
    (key: keyof FilterConfig, value: string) => {
      const currentValues = (localFilters[key] as string[]) || [];
      const newValues = currentValues.includes(value)
        ? currentValues?.filter((v: any) => v !== value)
        : [...currentValues, value];
      handleFilterChange(key, newValues);
    },
    [localFilters, handleFilterChange],
  );

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Filter className="mr-2 h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge
              variant="destructive"
              className="ml-2 h-5 min-w-[20px] rounded-full px-1 text-xs"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Filter Emails</SheetTitle>
          <SheetDescription>
            Refine your email list using multiple filter criteria
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-200px)] pr-4">
          <div className="space-y-6 py-4">
            {/* Search */}
            <div className="space-y-2">
              <Label htmlFor="search" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Search
              </Label>
              <Input
                id="search"
                placeholder="Search emails..."
                value={localFilters.search || ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleFilterChange("search", e.target.value)
                }
              />
            </div>

            <Separator />

            {/* Status Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" />
                Status
              </Label>
              <div className="space-y-2">
                {filterOptions?.statuses?.map((status: any) => (
                  <div
                    key={status.value}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={`status-${status.value}`}
                      checked={
                        localFilters.statuses?.includes(status.value) || false
                      }
                      onCheckedChange={() =>
                        toggleArrayFilter("statuses", status.value)
                      }
                    />
                    <label
                      htmlFor={`status-${status.value}`}
                      className="flex items-center justify-between w-full cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <StatusIndicator
                          status={status.value}
                          size="sm"
                          showTooltip={false}
                        />
                        <span className="text-sm font-medium">
                          {status.label}
                        </span>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Workflow State Filter */}
            <div className="space-y-2">
              <Label>Workflow State</Label>
              <div className="space-y-2">
                {filterOptions?.workflowStates?.map((state: any) => (
                  <div key={state} className="flex items-center space-x-2">
                    <Checkbox
                      id={`workflow-${state}`}
                      checked={
                        localFilters.workflowStates?.includes(state) || false
                      }
                      onCheckedChange={() =>
                        toggleArrayFilter("workflowStates", state)
                      }
                    />
                    <label
                      htmlFor={`workflow-${state}`}
                      className="flex items-center justify-between w-full cursor-pointer"
                    >
                      <span className="text-sm font-medium">
                        {workflowStateLabels[state as WorkflowState]}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Priority Filter */}
            <div className="space-y-2">
              <Label>Priority</Label>
              <div className="space-y-2">
                {filterOptions?.priorities?.map((priority: any) => (
                  <div key={priority} className="flex items-center space-x-2">
                    <Checkbox
                      id={`priority-${priority}`}
                      checked={
                        localFilters.priorities?.includes(priority) || false
                      }
                      onCheckedChange={() =>
                        toggleArrayFilter("priorities", priority)
                      }
                    />
                    <label
                      htmlFor={`priority-${priority}`}
                      className="flex items-center justify-between w-full cursor-pointer"
                    >
                      <span className="text-sm font-medium">
                        {priorityLabels[priority as Priority]}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Email Aliases Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Aliases
              </Label>
              <Select
                value={localFilters.emailAliases?.[0] || ""}
                onValueChange={(value: string) =>
                  handleFilterChange("emailAliases", value ? [value] : [])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All email aliases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All email aliases</SelectItem>
                  {filterOptions?.emailAliases?.map((alias: any) => (
                    <SelectItem key={alias} value={alias}>
                      {alias}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Requester Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Requested By
              </Label>
              <Select
                value={localFilters.requesters?.[0] || ""}
                onValueChange={(value: string) =>
                  handleFilterChange("requesters", value ? [value] : [])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All requesters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All requesters</SelectItem>
                  {filterOptions?.requesters?.map((requester: any) => (
                    <SelectItem key={requester} value={requester}>
                      {requester}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Date Range Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date Range
              </Label>
              <DateRangePicker
                value={
                  localFilters?.dateRange?.start || localFilters?.dateRange?.end
                    ? {
                        from: localFilters?.dateRange?.start || undefined,
                        to: localFilters?.dateRange?.end || undefined,
                      }
                    : undefined
                }
                onChange={(dateRange: any) => {
                  handleFilterChange("dateRange", {
                    start: dateRange?.from || null,
                    end: dateRange?.to || null,
                  });
                }}
              />
            </div>

            <Separator />

            {/* Additional Filters */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has-attachments"
                  checked={localFilters.hasAttachments === true}
                  onCheckedChange={(checked) =>
                    handleFilterChange(
                      "hasAttachments",
                      checked === true ? true : undefined,
                    )
                  }
                />
                <label
                  htmlFor="has-attachments"
                  className="text-sm font-medium cursor-pointer"
                >
                  Has attachments
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="unread-only"
                  checked={localFilters.isRead === false}
                  onCheckedChange={(checked) =>
                    handleFilterChange(
                      "isRead",
                      checked === true ? false : undefined,
                    )
                  }
                />
                <label
                  htmlFor="unread-only"
                  className="text-sm font-medium cursor-pointer"
                >
                  Unread only
                </label>
              </div>
            </div>

            {/* Tags Filter */}
            {filterOptions?.tags?.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Tags
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {filterOptions?.tags?.map((tag: any) => (
                      <Badge
                        key={tag}
                        variant={
                          localFilters.tags?.includes(tag)
                            ? "default"
                            : "outline"
                        }
                        className="cursor-pointer"
                        onClick={() => toggleArrayFilter("tags", tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="absolute bottom-0 left-0 right-0 border-t bg-background p-4">
          <Button variant="outline" onClick={handleReset}>
            Reset All
          </Button>
          <Button onClick={handleApplyFilters}>Apply Filters</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Quick filter buttons for common filters
export function QuickFilters({
  onFilterChange,
}: {
  onFilterChange: (filters: Partial<FilterConfig>) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onFilterChange({ statuses: ["red"] })}
      >
        <StatusIndicator status="red" size="sm" showTooltip={false} />
        <span className="ml-2">Critical</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onFilterChange({ workflowStates: ["START_POINT"] })}
      >
        New Requests
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onFilterChange({ isRead: false })}
      >
        Unread
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onFilterChange({ hasAttachments: true })}
      >
        With Attachments
      </Button>
    </div>
  );
}
