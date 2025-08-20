import React from "react";
import { cn } from "../../../lib/utils.js";

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, width, height }) => (
  <div
    className={cn(
      "animate-pulse bg-gray-200 rounded",
      className
    )}
    style={{ width, height }}
  />
);

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = 6,
  className,
}) => (
  <div className={cn("space-y-3", className)}>
    {/* Header skeleton */}
    <div className="flex space-x-3 p-4 bg-gray-50 rounded-lg">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
    
    {/* Rows skeleton */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="flex space-x-3 p-4 border border-gray-100 rounded-lg">
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton
            key={colIndex}
            className={cn(
              "h-4",
              colIndex === 0 ? "w-8" : "flex-1"
            )}
          />
        ))}
      </div>
    ))}
  </div>
);

interface CardSkeletonProps {
  hasHeader?: boolean;
  contentLines?: number;
  className?: string;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({
  hasHeader = true,
  contentLines = 3,
  className,
}) => (
  <div className={cn("border border-gray-200 rounded-lg p-4 space-y-3", className)}>
    {hasHeader && (
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
    )}
    
    <div className="space-y-2">
      {Array.from({ length: contentLines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === contentLines - 1 ? "w-3/4" : "w-full"
          )}
        />
      ))}
    </div>
  </div>
);

interface DashboardSkeletonProps {
  className?: string;
}

export const DashboardSkeleton: React.FC<DashboardSkeletonProps> = ({ className }) => (
  <div className={cn("space-y-6", className)}>
    {/* Main table skeleton */}
    <div className="border border-gray-200 rounded-lg p-6">
      <div className="mb-4">
        <Skeleton className="h-7 w-48" />
      </div>
      <TableSkeleton rows={8} columns={6} />
    </div>

    {/* Secondary panels */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <CardSkeleton contentLines={5} />
      <CardSkeleton contentLines={5} />
    </div>
  </div>
);

interface EmailListSkeletonProps {
  items?: number;
  className?: string;
}

export const EmailListSkeleton: React.FC<EmailListSkeletonProps> = ({
  items = 5,
  className,
}) => (
  <div className={cn("space-y-3", className)}>
    {Array.from({ length: items }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
        <Skeleton className="w-6 h-6 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-3 w-full" />
        </div>
        <Skeleton className="w-16 h-5 rounded-full" />
      </div>
    ))}
  </div>
);