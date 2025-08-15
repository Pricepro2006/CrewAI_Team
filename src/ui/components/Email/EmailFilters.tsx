import React from "react";
import {
  XMarkIcon,
  CalendarIcon,
  FunnelIcon,
  TagIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

export interface EmailFiltersProps {
  filters: {
    workflow?: string;
    priority?: string;
    status?: string;
    slaStatus?: string;
    search?: string;
    dateRange?: {
      start: Date;
      end: Date;
    };
  };
  onFilterChange: (filters: any) => void;
  onClear: () => void;
}

export const EmailFilters: React.FC<EmailFiltersProps> = ({
  filters,
  onFilterChange,
  onClear,
}) => {
  const workflowOptions = [
    "Order Management",
    "Shipping/Logistics",
    "Quote Processing",
    "Customer Support",
    "Deal Registration",
    "Approval Workflows",
    "Renewal Processing",
    "Vendor Management",
  ];

  const priorityOptions = ["Critical", "High", "Medium", "Low"];

  const statusOptions = [
    "New",
    "In Review",
    "In Progress",
    "Pending External",
    "Completed",
    "Archived",
  ];

  const slaStatusOptions = ["on-track", "at-risk", "overdue"];

  const hasActiveFilters = Object.keys(filters).some((key: any) => {
    const value = filters[key as keyof typeof filters];
    return value !== undefined && value !== "" && value !== null;
  });

  const formatDateForInput = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  const handleDateRangeChange = (type: "start" | "end", value: string) => {
    const date = new Date(value);
    const currentRange = filters.dateRange || {
      start: new Date(),
      end: new Date(),
    };

    onFilterChange({
      dateRange: {
        ...currentRange,
        [type]: date,
      },
    });
  };

  return (
    <div className="email-filters">
      <div className="email-filters__header">
        <h3>
          <FunnelIcon className="email-filters__header-icon" />
          Filter Emails
        </h3>
        {hasActiveFilters && (
          <button onClick={onClear} className="email-filters__clear-btn">
            <XMarkIcon className="email-filters__clear-icon" />
            Clear All
          </button>
        )}
      </div>

      <div className="email-filters__content">
        {/* Workflow Filter */}
        <div className="email-filters__section">
          <label className="email-filters__label">
            <TagIcon className="email-filters__label-icon" />
            Workflow Category
          </label>
          <select
            value={filters.workflow || ""}
            onChange={(e: any) =>
              onFilterChange({ workflow: e?.target?.value || undefined })
            }
            className="email-filters__select"
          >
            <option value="">All Workflows</option>
            {workflowOptions?.map((workflow: any) => (
              <option key={workflow} value={workflow}>
                {workflow}
              </option>
            ))}
          </select>
        </div>

        {/* Priority Filter */}
        <div className="email-filters__section">
          <label className="email-filters__label">
            <ExclamationTriangleIcon className="email-filters__label-icon" />
            Priority Level
          </label>
          <select
            value={filters.priority || ""}
            onChange={(e: any) =>
              onFilterChange({ priority: e?.target?.value || undefined })
            }
            className="email-filters__select"
          >
            <option value="">All Priorities</option>
            {priorityOptions?.map((priority: any) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="email-filters__section">
          <label className="email-filters__label">
            <ClockIcon className="email-filters__label-icon" />
            Workflow Status
          </label>
          <select
            value={filters.status || ""}
            onChange={(e: any) =>
              onFilterChange({ status: e?.target?.value || undefined })
            }
            className="email-filters__select"
          >
            <option value="">All Statuses</option>
            {statusOptions?.map((status: any) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        {/* SLA Status Filter */}
        <div className="email-filters__section">
          <label className="email-filters__label">
            <ExclamationTriangleIcon className="email-filters__label-icon" />
            SLA Status
          </label>
          <select
            value={filters.slaStatus || ""}
            onChange={(e: any) =>
              onFilterChange({ slaStatus: e?.target?.value || undefined })
            }
            className="email-filters__select"
          >
            <option value="">All SLA Status</option>
            {slaStatusOptions?.map((status: any) => (
              <option key={status} value={status}>
                {status === "on-track"
                  ? "On Track"
                  : status === "at-risk"
                    ? "At Risk"
                    : status === "overdue"
                      ? "Overdue"
                      : status}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range Filter */}
        <div className="email-filters__section">
          <label className="email-filters__label">
            <CalendarIcon className="email-filters__label-icon" />
            Date Range
          </label>
          <div className="email-filters__date-range">
            <div className="email-filters__date-input">
              <label htmlFor="start-date" className="email-filters__date-label">
                From
              </label>
              <input
                id="start-date"
                type="date"
                value={
                  filters.dateRange?.start
                    ? formatDateForInput(filters?.dateRange?.start)
                    : ""
                }
                onChange={(e: any) => handleDateRangeChange("start", e?.target?.value)}
                className="email-filters__date-field"
              />
            </div>
            <div className="email-filters__date-input">
              <label htmlFor="end-date" className="email-filters__date-label">
                To
              </label>
              <input
                id="end-date"
                type="date"
                value={
                  filters.dateRange?.end
                    ? formatDateForInput(filters?.dateRange?.end)
                    : ""
                }
                onChange={(e: any) => handleDateRangeChange("end", e?.target?.value)}
                className="email-filters__date-field"
              />
            </div>
          </div>
        </div>

        {/* Quick Filters */}
        <div className="email-filters__section">
          <label className="email-filters__label">Quick Filters</label>
          <div className="email-filters__quick-filters">
            <button
              onClick={() =>
                onFilterChange({
                  slaStatus: "overdue",
                  priority: undefined,
                  workflow: undefined,
                })
              }
              className={`email-filters__quick-btn ${filters.slaStatus === "overdue" ? "email-filters__quick-btn--active" : ""}`}
            >
              Overdue Items
            </button>

            <button
              onClick={() =>
                onFilterChange({
                  priority: "Critical",
                  slaStatus: undefined,
                  workflow: undefined,
                })
              }
              className={`email-filters__quick-btn ${filters.priority === "Critical" ? "email-filters__quick-btn--active" : ""}`}
            >
              Critical Priority
            </button>

            <button
              onClick={() =>
                onFilterChange({
                  workflow: "Order Management",
                  priority: undefined,
                  slaStatus: undefined,
                })
              }
              className={`email-filters__quick-btn ${filters.workflow === "Order Management" ? "email-filters__quick-btn--active" : ""}`}
            >
              Order Management
            </button>

            <button
              onClick={() =>
                onFilterChange({
                  status: "New",
                  priority: undefined,
                  slaStatus: undefined,
                  workflow: undefined,
                })
              }
              className={`email-filters__quick-btn ${filters.status === "New" ? "email-filters__quick-btn--active" : ""}`}
            >
              New Emails
            </button>
          </div>
        </div>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="email-filters__active">
          <h4>Active Filters:</h4>
          <div className="email-filters__active-list">
            {filters.workflow && (
              <div className="email-filters__active-item">
                <span>Workflow: {filters.workflow}</span>
                <button onClick={() => onFilterChange({ workflow: undefined })}>
                  <XMarkIcon className="email-filters__active-remove" />
                </button>
              </div>
            )}

            {filters.priority && (
              <div className="email-filters__active-item">
                <span>Priority: {filters.priority}</span>
                <button onClick={() => onFilterChange({ priority: undefined })}>
                  <XMarkIcon className="email-filters__active-remove" />
                </button>
              </div>
            )}

            {filters.status && (
              <div className="email-filters__active-item">
                <span>Status: {filters.status}</span>
                <button onClick={() => onFilterChange({ status: undefined })}>
                  <XMarkIcon className="email-filters__active-remove" />
                </button>
              </div>
            )}

            {filters.slaStatus && (
              <div className="email-filters__active-item">
                <span>SLA: {filters.slaStatus}</span>
                <button
                  onClick={() => onFilterChange({ slaStatus: undefined })}
                >
                  <XMarkIcon className="email-filters__active-remove" />
                </button>
              </div>
            )}

            {filters.dateRange && (
              <div className="email-filters__active-item">
                <span>
                  Date Range: {filters?.dateRange?.start.toLocaleDateString()} -{" "}
                  {filters?.dateRange?.end.toLocaleDateString()}
                </span>
                <button
                  onClick={() => onFilterChange({ dateRange: undefined })}
                >
                  <XMarkIcon className="email-filters__active-remove" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
