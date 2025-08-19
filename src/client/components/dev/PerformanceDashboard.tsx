import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card.js";
import { Button } from "../../../components/ui/button.js";
import { Badge } from "../../../components/ui/badge.js";
import { performanceTracker } from "../../hooks/usePerformanceMonitor.js";
import { cacheUtils, queryMetrics } from "../../lib/queryClient.js";
import { useTRPCPerformanceMonitor } from "../../hooks/useOptimizedTRPC.js";

// Only render in development mode
const IS_DEV = process.env.NODE_ENV === "development";

interface PerformanceStats {
  cacheStats: {
    totalQueries: number;
    activeQueries: number;
    staleQueries: number;
    errorQueries: number;
    cacheSize: number;
  };
  renderStats: {
    averageRenderTime: number;
    slowComponents: string[];
    totalMetrics: number;
  };
  queryStats: {
    slowQueries: [string, number][];
    failedQueries: [string, number][];
  };
}

export const PerformanceDashboard: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  
  const { getCacheStats, clearCache, prefetchCriticalData } = useTRPCPerformanceMonitor();

  // Don't render in production
  if (!IS_DEV) {
    return null;
  }

  const refreshStats = () => {
    const rawCacheStats = getCacheStats();
    // Transform cache stats to match expected interface
    const cacheStats = {
      totalQueries: rawCacheStats.queries + rawCacheStats.mutations,
      activeQueries: rawCacheStats.activeQueries,
      staleQueries: rawCacheStats.staleQueries,
      errorQueries: rawCacheStats.errorQueries,
      cacheSize: 0, // Not available from tRPC utils, provide default
    };
    const renderStats = {
      averageRenderTime: performanceTracker.getAverageRenderTime(),
      slowComponents: performanceTracker.getSlowComponents(),
      totalMetrics: performanceTracker.getMetrics().length,
    };
    const queryStats = {
      slowQueries: queryMetrics.getSlowQueries(),
      failedQueries: queryMetrics.getFailedQueries(),
    };

    setStats({ cacheStats, renderStats, queryStats });
  };

  useEffect(() => {
    if (isVisible) {
      refreshStats();
      const interval = setInterval(refreshStats, 2000); // Refresh every 2 seconds
      setRefreshInterval(interval);
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [isVisible]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleClearCache = () => {
    clearCache();
    queryMetrics.reset();
    performanceTracker.reset();
    refreshStats();
  };

  const handlePrefetchCritical = async () => {
    try {
      await prefetchCriticalData();
      refreshStats();
    } catch (error) {
      console.error("Failed to prefetch critical data:", error);
    }
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsVisible(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg"
          size="sm"
        >
          📊 Perf
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-96 overflow-auto">
      <Card className="shadow-xl border-purple-200 bg-white">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Performance Monitor</CardTitle>
            <Button
              onClick={() => setIsVisible(false)}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
            >
              ✕
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats && (
            <>
              {/* Cache Stats */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Query Cache</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Total: <Badge variant="secondary">{stats?.cacheStats?.totalQueries}</Badge></div>
                  <div>Active: <Badge variant="secondary">{stats?.cacheStats?.activeQueries}</Badge></div>
                  <div>Stale: <Badge variant="outline">{stats?.cacheStats?.staleQueries}</Badge></div>
                  <div>Errors: <Badge variant="destructive">{stats?.cacheStats?.errorQueries}</Badge></div>
                </div>
                <div className="mt-1 text-xs">
                  Cache Size: <Badge variant="secondary">{formatBytes(stats?.cacheStats?.cacheSize)}</Badge>
                </div>
              </div>

              {/* Render Stats */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Render Performance</h4>
                <div className="text-xs space-y-1">
                  <div>Avg Render: <Badge variant="secondary">{stats?.renderStats?.averageRenderTime.toFixed(2)}ms</Badge></div>
                  <div>Total Metrics: <Badge variant="secondary">{stats?.renderStats?.totalMetrics}</Badge></div>
                  {stats?.renderStats?.slowComponents?.length || 0 > 0 && (
                    <div>
                      <div className="text-red-600 font-medium">Slow Components:</div>
                      {stats?.renderStats?.slowComponents.slice(0, 3).map(component => (
                        <Badge key={component} variant="destructive" className="text-xs mr-1">
                          {component}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Query Performance */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Query Performance</h4>
                <div className="text-xs space-y-1">
                  {stats?.queryStats?.slowQueries?.length || 0 > 0 && (
                    <div>
                      <div className="text-orange-600 font-medium">Slow Queries:</div>
                      {stats?.queryStats?.slowQueries.slice(0, 2).map(([key, duration]) => (
                        <div key={key} className="truncate">
                          <Badge variant="outline" className="text-xs">
                            {duration.toFixed(0)}ms
                          </Badge> {key.slice(key.lastIndexOf(",") + 1, -2)}
                        </div>
                      ))}
                    </div>
                  )}
                  {stats?.queryStats?.failedQueries?.length || 0 > 0 && (
                    <div>
                      <div className="text-red-600 font-medium">Failed Queries:</div>
                      {stats?.queryStats?.failedQueries.slice(0, 2).map(([key, count]) => (
                        <div key={key} className="truncate">
                          <Badge variant="destructive" className="text-xs">
                            {count}x
                          </Badge> {key.slice(key.lastIndexOf(",") + 1, -2)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={handleClearCache}
                  size="sm"
                  variant="outline"
                  className="text-xs flex-1"
                >
                  Clear Cache
                </Button>
                <Button
                  onClick={handlePrefetchCritical}
                  size="sm"
                  variant="outline"
                  className="text-xs flex-1"
                >
                  Prefetch
                </Button>
              </div>

              {/* Performance Tips */}
              <div className="text-xs text-gray-600">
                <div className="font-medium">Tips:</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>Keep render times under 16ms for 60fps</li>
                  <li>Monitor cache size and clear when needed</li>
                  <li>Prefetch data for better UX</li>
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};