import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card.js";
import { Progress } from "../../components/ui/progress.js";
import { Badge } from "../../components/ui/badge.js";
import { Alert, AlertDescription } from "../../components/ui/alert.js";
import {
  BarChart3,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { api as trpc } from "../../lib/trpc.js";

interface RateLimitMetrics {
  totalRequests: number;
  rateLimitedRequests: number;
  percentageRateLimited: string;
  averageLatency: number;
  circuitBreakerStatus: "closed" | "open" | "half-open";
  windowResets: {
    webSearch: string;
    businessSearch: string;
    premium: string;
  };
}

export const RateLimitMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<RateLimitMetrics | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch metrics using tRPC
  const { data, refetch, isLoading, error } = (
    trpc as any
  ).metrics.getRateLimitMetrics.useQuery(undefined, {
    refetchInterval: autoRefresh ? 5000 : false,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (data) {
      setMetrics(data);
    }
  }, [data]);

  const getCircuitBreakerColor = (status: string) => {
    switch (status) {
      case "closed":
        return "text-green-500";
      case "open":
        return "text-red-500";
      case "half-open":
        return "text-yellow-500";
      default:
        return "text-gray-500";
    }
  };

  const getCircuitBreakerIcon = (status: string) => {
    switch (status) {
      case "closed":
        return <CheckCircle2 className="w-4 h-4" />;
      case "open":
        return <XCircle className="w-4 h-4" />;
      case "half-open":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getRateLimitSeverity = (percentage: number) => {
    if (percentage >= 20) return "destructive";
    if (percentage >= 10) return "warning";
    return "success";
  };

  if (isLoading && !metrics) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">
            Loading rate limit metrics...
          </span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load rate limit metrics: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!metrics) return null;

  const rateLimitPercentage = parseFloat(metrics.percentageRateLimited);
  const isHighRateLimit = rateLimitPercentage >= 10;

  return (
    <div className="space-y-4">
      {/* Header with Auto-refresh Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          Rate Limit Monitor
        </h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-600">Auto-refresh</span>
          </label>
          <button
            onClick={() => refetch()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Alert for High Rate Limiting */}
      {isHighRateLimit && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            High rate limiting detected: {metrics.percentageRateLimited} of
            requests are being rate limited. Consider scaling up or optimizing
            query patterns.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Requests */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.totalRequests.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-1">All WebSearch requests</p>
          </CardContent>
        </Card>

        {/* Rate Limited Requests */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Rate Limited
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {metrics.rateLimitedRequests.toLocaleString()}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={getRateLimitSeverity(rateLimitPercentage)}>
                {metrics.percentageRateLimited}
              </Badge>
              {rateLimitPercentage > 15 ? (
                <TrendingUp className="w-3 h-3 text-red-500" />
              ) : (
                <TrendingDown className="w-3 h-3 text-green-500" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Average Latency */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Avg Latency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.averageLatency.toFixed(0)}ms
            </div>
            <Progress
              value={Math.min((metrics.averageLatency / 2000) * 100, 100)}
              className="mt-2"
            />
          </CardContent>
        </Card>

        {/* Circuit Breaker Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Circuit Breaker
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`flex items-center gap-2 ${getCircuitBreakerColor(metrics.circuitBreakerStatus)}`}
            >
              {getCircuitBreakerIcon(metrics.circuitBreakerStatus)}
              <span className="text-lg font-semibold capitalize">
                {metrics.circuitBreakerStatus}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {metrics.circuitBreakerStatus === "open"
                ? "Requests bypassing enhancement"
                : "Normal operation"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Window Reset Times */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rate Limit Windows</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-600">Web Search</p>
              <p className="text-xs text-gray-500">
                Resets: {metrics.windowResets.webSearch}
              </p>
              <Progress value={75} className="h-2" />
              <p className="text-xs text-gray-400">100 requests / 15 min</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-600">
                Business Search
              </p>
              <p className="text-xs text-gray-500">
                Resets: {metrics.windowResets.businessSearch}
              </p>
              <Progress value={50} className="h-2" />
              <p className="text-xs text-gray-400">30 requests / 5 min</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-600">Premium</p>
              <p className="text-xs text-gray-500">
                Resets: {metrics.windowResets.premium}
              </p>
              <Progress value={20} className="h-2" />
              <p className="text-xs text-gray-400">500 requests / 15 min</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {metrics.rateLimitedRequests > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-gray-600">
                  {metrics.rateLimitedRequests} requests rate limited in current
                  period
                </span>
              </div>
            )}
            {metrics.circuitBreakerStatus === "open" && (
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-yellow-500" />
                <span className="text-gray-600">
                  Circuit breaker is open - enhancement bypassed
                </span>
              </div>
            )}
            {metrics.averageLatency > 1500 && (
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                <span className="text-gray-600">
                  High latency detected: {metrics.averageLatency.toFixed(0)}ms
                  average
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
