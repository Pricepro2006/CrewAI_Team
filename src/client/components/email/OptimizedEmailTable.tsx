import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { VirtualizedEmailTable } from "../virtualized/VirtualizedEmailTable";
import { EmailTable } from "./EmailTable";
import { DebouncedSearchInput } from "../search/DebouncedSearchInput";
import { DashboardSkeleton } from "../loading/SkeletonLoader";
import { useOptimizedEmails, useOptimizedEmailSearch } from "../../hooks/useOptimizedTRPC";
import { usePerformanceMonitor } from "../../hooks/usePerformanceMonitor";
import { useDebounce } from "../../hooks/useDebounce";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { cn } from "../../../lib/utils";
import type { EmailRecord } from "../../../types/email-dashboard.interfaces";

interface OptimizedEmailTableProps {
  className?: string;
  useVirtualScrolling?: boolean;
  virtualScrollHeight?: number;
  enableSearch?: boolean;
  enableBulkActions?: boolean;
  initialFilters?: Record<string, any>;
  onEmailSelect?: (email: EmailRecord) => void;
  teamMembers?: Array<{ id: string; name: string; email: string; role?: string; avatar?: string }>;
}

export const OptimizedEmailTable = React.memo<OptimizedEmailTableProps>(({
  className,
  useVirtualScrolling = false,
  virtualScrollHeight = 600,
  enableSearch = true,
  enableBulkActions = true,
  initialFilters = {},
  onEmailSelect,
  teamMembers = [],
}) => {
  // Performance monitoring
  usePerformanceMonitor({
    componentName: "OptimizedEmailTable",
    enabled: process.env.NODE_ENV === "development",
  });

  // Local state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: "asc" | "desc" } | null>(null);
  
  // Debounce search term to avoid excessive API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  
  // Optimized data fetching
  const {
    data: emailResponse,
    isLoading,
    error,
    updateEmail,
    isUpdating,
    prefetchEmailDetail,
  } = useOptimizedEmails(filters);
  
  // Extract emails array from response
  const emails = useMemo(() => {
    if (!emailResponse) return [];
    if (Array.isArray(emailResponse)) return emailResponse;
    if ((emailResponse as any).data?.emails) return (emailResponse as any).data.emails;
    if ((emailResponse as any).data) return Array.isArray((emailResponse as any).data) ? (emailResponse as any).data : [];
    return [];
  }, [emailResponse]);

  // Search results (only when search is active)
  const {
    data: searchResponse,
    isLoading: isSearching,
  } = useOptimizedEmailSearch(debouncedSearchTerm, debouncedSearchTerm.length >= 2);
  
  // Extract search results array from response
  const searchResults = useMemo(() => {
    if (!searchResponse) return [];
    if (Array.isArray(searchResponse)) return searchResponse;
    if ((searchResponse as any).data?.emails) return (searchResponse as any).data.emails;
    if ((searchResponse as any).data) return Array.isArray((searchResponse as any).data) ? (searchResponse as any).data : [];
    return [];
  }, [searchResponse]);

  // Determine which data to use
  const displayEmails = useMemo(() => {
    let emailsToDisplay = debouncedSearchTerm.length >= 2 ? searchResults : emails;
    
    // Apply sorting if configured
    if (sortConfig) {
      emailsToDisplay = [...emailsToDisplay].sort((a, b) => {
        const aValue = a[sortConfig.field as keyof EmailRecord];
        const bValue = b[sortConfig.field as keyof EmailRecord];
        
        if (!aValue && !bValue) return 0;
        if (!aValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (!bValue) return sortConfig.direction === "asc" ? 1 : -1;
        
        const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        return sortConfig.direction === "asc" ? comparison : -comparison;
      });
    }
    
    return emailsToDisplay;
  }, [emails, searchResults, debouncedSearchTerm, sortConfig]);

  // Callbacks
  const handleSearchChange = useCallback((query: string) => {
    setSearchTerm(query);
  }, []);

  const handleEmailSelect = useCallback((email: EmailRecord) => {
    onEmailSelect?.(email);
    // Prefetch email details for better UX
    prefetchEmailDetail(email.id);
  }, [onEmailSelect, prefetchEmailDetail]);

  const handleBulkAssign = useCallback(async (assignee: string) => {
    if (selectedEmails.length === 0) return;
    
    try {
      await Promise.all(
        selectedEmails.map(emailId =>
          updateEmail({ emailId, newState: 'IN_PROGRESS' } as any)
        )
      );
      setSelectedEmails([]);
    } catch (error) {
      console.error("Failed to bulk assign emails:", error);
    }
  }, [selectedEmails, updateEmail]);

  const handleSort = useCallback((field: string) => {
    setSortConfig(current => ({
      field,
      direction: current?.field === field && current.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  // Loading state
  if (isLoading && !emails) {
    return (
      <div className={cn("space-y-4", className)}>
        {enableSearch && (
          <div className="flex justify-between items-center">
            <div className="w-96 h-10 bg-gray-200 rounded animate-pulse" />
            <div className="flex gap-2">
              <div className="w-24 h-8 bg-gray-200 rounded animate-pulse" />
              <div className="w-24 h-8 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        )}
        <DashboardSkeleton />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="text-red-500 text-lg mb-2">⚠️ Error Loading Emails</div>
            <p className="text-gray-600 mb-4">{error.message || "Failed to load emails"}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isLoadingData = isLoading || isSearching;
  const totalEmails = displayEmails.length;
  const selectedCount = selectedEmails.length;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search and Actions Bar */}
      {(enableSearch || enableBulkActions) && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {enableSearch && (
            <div className="flex-1 max-w-md">
              <DebouncedSearchInput
                onSearch={handleSearchChange}
                placeholder="Search emails by subject, sender, or content..."
                debounceMs={300}
                minLength={2}
                showClearButton
              />
            </div>
          )}
          
          <div className="flex items-center gap-3">
            {/* Email count */}
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {isLoadingData ? "Loading..." : `${totalEmails} email${totalEmails !== 1 ? "s" : ""}`}
            </Badge>
            
            {/* Bulk actions */}
            {enableBulkActions && selectedCount > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {selectedCount} selected
                </Badge>
                {teamMembers.length > 0 && (
                  <select
                    onChange={(e) => e.target.value && handleBulkAssign(e.target.value)}
                    className="text-sm border border-gray-300 rounded px-2 py-1"
                    defaultValue=""
                  >
                    <option value="">Assign to...</option>
                    {teamMembers.map(member => (
                      <option key={member.id} value={member.name}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
            
            {/* Loading indicator */}
            {isLoadingData && (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
            )}
          </div>
        </div>
      )}

      {/* Email Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span>
              {debouncedSearchTerm ? `Search: "${debouncedSearchTerm}"` : "Email Dashboard"}
            </span>
            {sortConfig && (
              <Badge variant="outline" className="text-xs">
                Sorted by {sortConfig.field} {sortConfig.direction === "asc" ? "↑" : "↓"}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {useVirtualScrolling && totalEmails > 100 ? (
            <VirtualizedEmailTable
              emails={displayEmails}
              height={virtualScrollHeight}
              onRowClick={handleEmailSelect}
              selectedEmailId={selectedEmails[0]}
              loading={isLoadingData}
            />
          ) : (
            <EmailTable
              emails={displayEmails}
              loading={isLoadingData}
              error={error?.message || null}
              selectedEmails={selectedEmails}
              teamMembers={teamMembers}
              onRowClick={handleEmailSelect}
              onEmailsSelect={setSelectedEmails}
              onSort={(column, direction) => setSortConfig({ field: column, direction })}
              className="border-0"
            />
          )}
        </CardContent>
      </Card>

      {/* Performance indicator */}
      {process.env.NODE_ENV === "development" && (
        <div className="text-xs text-gray-500 flex justify-between">
          <span>
            Rendering {totalEmails} emails 
            {useVirtualScrolling && totalEmails > 100 && " (virtualized)"}
          </span>
          <span>
            {selectedCount > 0 && `${selectedCount} selected`}
            {isUpdating && " • Updating..."}
          </span>
        </div>
      )}
    </div>
  );
});

OptimizedEmailTable.displayName = "OptimizedEmailTable";