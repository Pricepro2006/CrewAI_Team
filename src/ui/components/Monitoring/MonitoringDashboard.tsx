import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.js";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../../components/ui/tabs.js";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert.js";
import { Badge } from "../../../components/ui/badge.js";
import { Progress } from "../../../components/ui/progress.js";
import { Button } from "../../../components/ui/button.js";
import { trpc } from "../../utils/trpc.js";
import {
  AlertCircle,
  Activity,
  Database,
  Server,
  Clock,
  TrendingUp,
  Users,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  services: {
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
  criticalServicesDown: string[];
}

interface ServiceHealth {
  service: string;
  status: "healthy" | "degraded" | "unhealthy";
  lastCheck: string;
  latency?: number;
  error?: string;
}

interface ErrorStats {
  total: number;
  bySeverity: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  errorRate: number;
  topErrors: Array<{
    type: string;
    count: number;
    lastSeen: string;
  }>;
}

interface SystemMetrics {
  cpu: {
    usage: string;
    count: number;
    loadAverage: {
      "1m": string;
      "5m": string;
      "15m": string;
    };
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usage: string;
  };
  process: {
    uptime: number;
    pid: number;
    memory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
  };
}

const severityColors = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
  critical: "#991b1b",
};

const statusColors = {
  healthy: "#22c55e",
  degraded: "#f59e0b",
  unhealthy: "#ef4444",
};

export const MonitoringDashboard: React.FC = () => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds

  // Fetch monitoring data
  const {
    data: healthData,
    isLoading: healthLoading,
    refetch: refetchHealth,
  } = trpc.monitoring.health.useQuery(undefined, {
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  const { data: detailedHealth, refetch: refetchDetailedHealth } =
    trpc.monitoring.healthDetailed.useQuery(undefined, {
      refetchInterval: autoRefresh ? refreshInterval : false,
    });

  const { data: metrics, refetch: refetchMetrics } =
    trpc.monitoring.metrics.useQuery(undefined, {
      refetchInterval: autoRefresh ? refreshInterval : false,
    });

  const { data: errorStats, refetch: refetchErrors } =
    trpc.monitoring.errorStats.useQuery(
      { window: 3600000 },
      {
        refetchInterval: autoRefresh ? refreshInterval : false,
      },
    );

  const { data: performanceStats, refetch: refetchPerformance } =
    trpc.monitoring.performance.useQuery(
      { window: 300000 },
      {
        refetchInterval: autoRefresh ? refreshInterval : false,
      },
    );

  const { data: slowOps, refetch: refetchSlowOps } =
    trpc.monitoring.slowOperations.useQuery(
      { limit: 10 },
      {
        refetchInterval: autoRefresh ? refreshInterval : false,
      },
    );

  const forceHealthCheck = trpc.monitoring.forceHealthCheck.useMutation({
    onSuccess: () => {
      refetchHealth();
      refetchDetailedHealth();
    },
  });

  // Manual refresh
  const handleManualRefresh = () => {
    refetchHealth();
    refetchDetailedHealth();
    refetchMetrics();
    refetchErrors();
    refetchPerformance();
    refetchSlowOps();
  };

  // Format uptime
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  // Prepare chart data
  const errorSeverityData = errorStats
    ? Object.entries(errorStats.stats.bySeverity).map(([severity, count]) => ({
        name: severity.charAt(0).toUpperCase() + severity.slice(1),
        value: count,
        fill: severityColors[severity as keyof typeof severityColors],
      }))
    : [];

  const performanceData = performanceStats
    ? Object.entries(performanceStats.stats).map(
        ([operation, data]: [string, any]) => ({
          operation,
          avg: Math.round(data.avg),
          p95: Math.round(data.p95),
          p99: Math.round(data.p99),
        }),
      )
    : [];

  if (healthLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Loading monitoring data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">System Monitoring</h2>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Clock className="w-3 h-3" />
            {autoRefresh
              ? `Auto-refresh: ${refreshInterval / 1000}s`
              : "Manual refresh"}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? "Disable" : "Enable"} Auto-refresh
          </Button>
          <Button size="sm" onClick={handleManualRefresh}>
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Overall Health Status */}
      {healthData && (
        <Alert
          className={`border-2 ${
            healthData.status === "healthy"
              ? "border-green-500"
              : healthData.status === "degraded"
                ? "border-yellow-500"
                : "border-red-500"
          }`}
        >
          <AlertCircle
            className={`h-4 w-4 ${
              healthData.status === "healthy"
                ? "text-green-500"
                : healthData.status === "degraded"
                  ? "text-yellow-500"
                  : "text-red-500"
            }`}
          />
          <AlertTitle>
            System Status: {healthData.status.toUpperCase()}
          </AlertTitle>
          <AlertDescription className="mt-2">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="font-medium">Healthy Services:</span>{" "}
                {healthData.services.healthy}
              </div>
              <div>
                <span className="font-medium">Degraded Services:</span>{" "}
                {healthData.services.degraded}
              </div>
              <div>
                <span className="font-medium">Unhealthy Services:</span>{" "}
                {healthData.services.unhealthy}
              </div>
            </div>
            {healthData.criticalServicesDown.length > 0 && (
              <div className="mt-2 text-red-600">
                <span className="font-medium">Critical services down:</span>{" "}
                {healthData.criticalServicesDown.join(", ")}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="health" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
        </TabsList>

        {/* Health Tab */}
        <TabsContent value="health" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {detailedHealth &&
              Object.entries(detailedHealth.services).map(
                ([service, health]: [string, ServiceHealth]) => (
                  <Card key={service}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">{service}</CardTitle>
                        <Badge
                          variant={
                            health.status === "healthy"
                              ? "default"
                              : health.status === "degraded"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {health.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Last Check:
                          </span>
                          <span>
                            {formatDistanceToNow(new Date(health.lastCheck), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        {health.latency && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Latency:
                            </span>
                            <span>{health.latency}ms</span>
                          </div>
                        )}
                        {health.error && (
                          <div className="text-red-600 text-xs mt-2">
                            Error: {health.error}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ),
              )}
          </div>

          <div className="flex justify-center">
            <Button
              onClick={() => forceHealthCheck.mutate()}
              disabled={forceHealthCheck.isLoading}
            >
              {forceHealthCheck.isLoading
                ? "Running..."
                : "Run Health Check Now"}
            </Button>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Operation Performance (ms)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="operation"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avg" fill="#8884d8" name="Average" />
                    <Bar dataKey="p95" fill="#82ca9d" name="95th Percentile" />
                    <Bar dataKey="p99" fill="#ffc658" name="99th Percentile" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {slowOps && slowOps.operations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Slowest Operations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {slowOps.operations.map((op: any, index: number) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-2 bg-muted rounded"
                    >
                      <span className="font-mono text-sm">{op.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(op.startTime), "HH:mm:ss")}
                        </span>
                        <Badge variant="secondary">
                          {Math.round(op.duration)}ms
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Errors Tab */}
        <TabsContent value="errors" className="space-y-4">
          {errorStats && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Total Errors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {errorStats.stats.total}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {errorStats.stats.errorRate.toFixed(2)} errors/min
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      Handled vs Unhandled
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm">
                      <span>Handled: {errorStats.stats.handled}</span>
                      <span>Unhandled: {errorStats.stats.unhandled}</span>
                    </div>
                    <Progress
                      value={
                        (errorStats.stats.handled / errorStats.stats.total) *
                        100
                      }
                      className="mt-2"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Error Severity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={errorSeverityData}
                            cx="50%"
                            cy="50%"
                            innerRadius={30}
                            outerRadius={50}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {errorSeverityData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {errorStats.stats.topErrors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Top Errors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {errorStats.stats.topErrors.map((error, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center p-2 bg-muted rounded"
                        >
                          <span className="font-mono text-sm">
                            {error.type}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{error.count}</Badge>
                            <span className="text-xs text-muted-foreground">
                              Last:{" "}
                              {formatDistanceToNow(new Date(error.lastSeen), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-4">
          {metrics && metrics.system && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">CPU Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">Usage</span>
                        <span className="text-sm font-medium">
                          {metrics.system.cpu.usage}%
                        </span>
                      </div>
                      <Progress value={parseFloat(metrics.system.cpu.usage)} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">1m:</span>{" "}
                        {metrics.system.cpu.loadAverage["1m"]}
                      </div>
                      <div>
                        <span className="text-muted-foreground">5m:</span>{" "}
                        {metrics.system.cpu.loadAverage["5m"]}
                      </div>
                      <div>
                        <span className="text-muted-foreground">15m:</span>{" "}
                        {metrics.system.cpu.loadAverage["15m"]}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Memory Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">System Memory</span>
                        <span className="text-sm font-medium">
                          {metrics.system.memory.usage}%
                        </span>
                      </div>
                      <Progress
                        value={parseFloat(metrics.system.memory.usage)}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{metrics.system.memory.used} MB used</span>
                        <span>{metrics.system.memory.total} MB total</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="text-sm font-medium mb-1">
                        Process Memory
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Heap:</span>{" "}
                          {metrics.system.process.memory.heapUsed}/
                          {metrics.system.process.memory.heapTotal} MB
                        </div>
                        <div>
                          <span className="text-muted-foreground">RSS:</span>{" "}
                          {metrics.system.process.memory.rss} MB
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Process Info</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">PID:</span>
                      <span className="font-mono">
                        {metrics.system.process.pid}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Uptime:</span>
                      <span>{formatUptime(metrics.system.process.uptime)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  <CardTitle className="text-base">Database</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Badge
                  variant={
                    healthData?.services.database === "connected"
                      ? "default"
                      : "destructive"
                  }
                >
                  {healthData?.services.database || "Unknown"}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  <CardTitle className="text-base">Llama.cpp</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Badge
                  variant={
                    healthData?.services.llama === "connected"
                      ? "default"
                      : "destructive"
                  }
                >
                  {healthData?.services.llama || "Unknown"}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  <CardTitle className="text-base">ChromaDB</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Badge
                  variant={
                    healthData?.services.chromadb === "connected"
                      ? "default"
                      : healthData?.services.chromadb === "not_configured"
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {healthData?.services.chromadb || "Unknown"}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  <CardTitle className="text-base">Rate Limiting</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Badge variant="default">
                  {healthData?.services.rateLimit || "Unknown"}
                </Badge>
                <div className="text-xs text-muted-foreground mt-1">
                  Backend: {healthData?.services.redis || "Unknown"}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
