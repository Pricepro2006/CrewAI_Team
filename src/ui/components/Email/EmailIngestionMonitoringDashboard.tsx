import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card.js';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../../components/ui/tabs.js';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../../../components/ui/alert.js';
import { Badge } from '../../../components/ui/badge.js';
import { Progress } from '../../../components/ui/progress.js';
import { Button } from '../../../components/ui/button.js';
import {
  AlertCircle,
  Activity,
  Database,
  Server,
  Clock,
  TrendingUp,
  Users,
  Mail,
  // Queue, -- Not available in lucide-react
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  RefreshCw,
  Download,
  Upload,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
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
  // RechartsTooltipPayload, -- No longer exported
} from 'recharts';
import type {
  IngestionMetrics,
  IngestionSource,
  QueueStatus,
  HealthStatus,
  IngestionBatchResult,
} from '../../../core/services/EmailIngestionService.js';

// =====================================================
// Types and Interfaces
// =====================================================

interface WebSocketIngestionEvent {
  type: 'ingestion:progress' | 'ingestion:batch_progress' | 'ingestion:health' | 'email:ingested';
  data: any;
}

interface DashboardState {
  metrics: IngestionMetrics | null;
  queueStatus: QueueStatus | null;
  healthStatus: HealthStatus | null;
  recentBatches: IngestionBatchResult[];
  isConnected: boolean;
  lastUpdate: Date | null;
}

interface ThroughputDataPoint {
  timestamp: string;
  lastMinute: number;
  lastHour: number;
  last24Hours: number;
}

// =====================================================
// Constants
// =====================================================

const REFRESH_INTERVAL = 30000; // 30 seconds
const MAX_BATCH_HISTORY = 10;
const THROUGHPUT_HISTORY_SIZE = 20;

const sourceColors: Record<IngestionSource, string> = {
  json_file: '#3b82f6',
  database: '#10b981',
  microsoft_graph: '#f59e0b',
  gmail_api: '#ef4444',
  webhook: '#8b5cf6',
};

const statusColors = {
  healthy: '#22c55e',
  degraded: '#f59e0b',
  failing: '#ef4444',
};

// =====================================================
// Main Component
// =====================================================

export const EmailIngestionMonitoringDashboard: React.FC = () => {
  const [state, setState] = useState<DashboardState>({
    metrics: null,
    queueStatus: null,
    healthStatus: null,
    recentBatches: [],
    isConnected: false,
    lastUpdate: null,
  });
  
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [throughputHistory, setThroughputHistory] = useState<ThroughputDataPoint[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);

  // =====================================================
  // WebSocket Connection Management
  // =====================================================

  const connectWebSocket = useCallback(() => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const websocket = new WebSocket(wsUrl);

      websocket.onopen = () => {
        console.log('EmailIngestion WebSocket connected');
        setState(prev => ({ ...prev, isConnected: true }));
        
        // Subscribe to ingestion events
        websocket.send(JSON.stringify({
          type: 'subscribe',
          channels: [
            'ingestion:progress',
            'ingestion:batch_progress',
            'ingestion:health',
            'email:ingested'
          ]
        }));
      };

      websocket.onmessage = (event) => {
        try {
          const message: WebSocketIngestionEvent = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('WebSocket message parsing error:', error);
        }
      };

      websocket.onclose = () => {
        console.log('EmailIngestion WebSocket disconnected');
        setState(prev => ({ ...prev, isConnected: false }));
        
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (autoRefresh) {
            connectWebSocket();
          }
        }, 3000);
      };

      websocket.onerror = (error) => {
        console.error('EmailIngestion WebSocket error:', error);
      };

      setWs(websocket);
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [autoRefresh]);

  // =====================================================
  // WebSocket Event Handlers
  // =====================================================

  const handleWebSocketMessage = useCallback((message: WebSocketIngestionEvent) => {
    switch (message.type) {
      case 'ingestion:health':
        setState(prev => ({
          ...prev,
          healthStatus: message.data,
          lastUpdate: new Date(),
        }));
        break;

      case 'email:ingested':
        // Update real-time metrics
        setState(prev => {
          if (!prev.metrics) return prev;
          
          return {
            ...prev,
            metrics: {
              ...prev.metrics,
              totalIngested: prev.metrics.totalIngested + 1,
            },
            lastUpdate: new Date(),
          };
        });
        break;

      case 'ingestion:batch_progress':
        // Handle batch progress updates
        console.log('Batch progress:', message.data);
        break;

      default:
        console.log('Unhandled WebSocket message:', message);
    }
  }, []);

  // =====================================================
  // Data Fetching
  // =====================================================

  const fetchIngestionData = useCallback(async () => {
    try {
      // Simulate API calls - replace with actual tRPC calls
      const [metricsRes, queueRes, healthRes] = await Promise.all([
        fetch('/api/ingestion/metrics').then(r => r.json()),
        fetch('/api/ingestion/queue-status').then(r => r.json()),
        fetch('/api/ingestion/health').then(r => r.json()),
      ]);

      setState(prev => ({
        ...prev,
        metrics: metricsRes.data,
        queueStatus: queueRes.data,
        healthStatus: healthRes.data,
        lastUpdate: new Date(),
      }));

      // Update throughput history
      if (metricsRes.data) {
        setThroughputHistory(prev => {
          const newPoint: ThroughputDataPoint = {
            timestamp: new Date().toISOString(),
            lastMinute: metricsRes.data.throughput.lastMinute,
            lastHour: metricsRes.data.throughput.lastHour,
            last24Hours: metricsRes.data.throughput.last24Hours,
          };
          
          const updated = [...prev, newPoint];
          return updated.slice(-THROUGHPUT_HISTORY_SIZE);
        });
      }
    } catch (error) {
      console.error('Failed to fetch ingestion data:', error);
    }
  }, []);

  // =====================================================
  // Effects
  // =====================================================

  useEffect(() => {
    if (autoRefresh) {
      connectWebSocket();
      fetchIngestionData();
      
      const interval = setInterval(fetchIngestionData, REFRESH_INTERVAL);
      return () => {
        clearInterval(interval);
        if (ws) {
          ws.close();
        }
      };
    }
    return undefined; // Explicit return when autoRefresh is false
  }, [autoRefresh, connectWebSocket, fetchIngestionData, ws]);

  // =====================================================
  // Action Handlers
  // =====================================================

  const handlePauseIngestion = async () => {
    try {
      await fetch('/api/ingestion/pause', { method: 'POST' });
      await fetchIngestionData();
    } catch (error) {
      console.error('Failed to pause ingestion:', error);
    }
  };

  const handleResumeIngestion = async () => {
    try {
      await fetch('/api/ingestion/resume', { method: 'POST' });
      await fetchIngestionData();
    } catch (error) {
      console.error('Failed to resume ingestion:', error);
    }
  };

  const handleRetryFailed = async () => {
    try {
      await fetch('/api/ingestion/retry-failed', { method: 'POST' });
      await fetchIngestionData();
    } catch (error) {
      console.error('Failed to retry failed jobs:', error);
    }
  };

  const handleManualRefresh = () => {
    fetchIngestionData();
  };

  // =====================================================
  // Computed Values
  // =====================================================

  const overallHealthStatus = useMemo(() => {
    if (!state.healthStatus) return 'unknown';
    return state.healthStatus.healthy ? 'healthy' : 
           state.healthStatus.status === 'degraded' ? 'degraded' : 'failing';
  }, [state.healthStatus]);

  const queueHealthIndicator = useMemo(() => {
    if (!state.queueStatus) return 'unknown';
    
    const { waiting, failed } = state.queueStatus;
    if (failed > 100) return 'failing';
    if (waiting > 1000 || failed > 10) return 'degraded';
    return 'healthy';
  }, [state.queueStatus]);

  const sourceDistributionData = useMemo(() => {
    if (!state.metrics?.bySource) return [];
    
    return Object.entries(state.metrics.bySource).map(([source, count]) => ({
      name: source.replace('_', ' ').toUpperCase(),
      value: count,
      fill: sourceColors[source as IngestionSource] || '#6b7280',
    }));
  }, [state.metrics]);

  // =====================================================
  // Render
  // =====================================================

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Email Ingestion Monitoring</h2>
          <p className="text-muted-foreground">
            Real-time monitoring of email ingestion pipeline
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Badge 
            variant="outline" 
            className={`gap-1 ${state.isConnected ? 'text-green-600' : 'text-red-600'}`}
          >
            <Activity className="w-3 h-3" />
            {state.isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          
          {state.lastUpdate && (
            <Badge variant="outline" className="gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(state.lastUpdate, { addSuffix: true })}
            </Badge>
          )}
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {autoRefresh ? 'Pause' : 'Resume'}
          </Button>
          
          <Button size="sm" onClick={handleManualRefresh}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Health Alert */}
      <Alert
        className={`border-2 ${
          overallHealthStatus === 'healthy' ? 'border-green-500' :
          overallHealthStatus === 'degraded' ? 'border-yellow-500' : 'border-red-500'
        }`}
      >
        <AlertCircle
          className={`h-4 w-4 ${
            overallHealthStatus === 'healthy' ? 'text-green-500' :
            overallHealthStatus === 'degraded' ? 'text-yellow-500' : 'text-red-500'
          }`}
        />
        <AlertTitle>
          Ingestion Pipeline Status: {overallHealthStatus.toUpperCase()}
        </AlertTitle>
        <AlertDescription>
          {state.healthStatus?.components && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
              <div>
                <span className="font-medium">Queue:</span>{' '}
                <Badge variant={state.healthStatus.components.queue.healthy ? 'default' : 'destructive'}>
                  {state.healthStatus.components.queue.healthy ? 'Healthy' : 'Degraded'}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Redis:</span>{' '}
                <Badge variant={state.healthStatus.components.redis.healthy ? 'default' : 'destructive'}>
                  {state.healthStatus.components.redis.healthy ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Database:</span>{' '}
                <Badge variant={state.healthStatus.components.database.healthy ? 'default' : 'destructive'}>
                  {state.healthStatus.components.database.healthy ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Auto-Pull:</span>{' '}
                <Badge variant={state.healthStatus.components.autoPull.healthy ? 'default' : 'secondary'}>
                  {state.healthStatus.components.autoPull.healthy ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          )}
        </AlertDescription>
      </Alert>

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="throughput">Throughput</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-500" />
                  <CardTitle className="text-base">Total Ingested</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {state.metrics?.totalIngested.toLocaleString() || 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  All-time total
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <CardTitle className="text-base">Processing Rate</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {state.metrics?.throughput.lastMinute || 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  emails/minute
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-orange-500" />
                  <CardTitle className="text-base">Queue Size</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {state.metrics?.currentQueueSize || 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  pending emails
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-500" />
                  <CardTitle className="text-base">Avg Processing</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(state.metrics?.averageProcessingTime || 0)}ms
                </div>
                <div className="text-sm text-muted-foreground">
                  per email
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Throughput Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Processing Throughput</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={throughputHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => format(new Date(value), 'HH:mm')}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => format(new Date(value), 'MMM dd, HH:mm:ss')}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="lastMinute" 
                      stroke="#3b82f6" 
                      name="Last Minute"
                      strokeWidth={2}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="lastHour" 
                      stroke="#10b981" 
                      name="Last Hour"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Queue Tab */}
        <TabsContent value="queue" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Queue Status</CardTitle>
                  <Badge
                    variant={
                      queueHealthIndicator === 'healthy' ? 'default' :
                      queueHealthIndicator === 'degraded' ? 'secondary' : 'destructive'
                    }
                  >
                    {queueHealthIndicator}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Waiting:</span>
                  <span className="font-medium">{state.queueStatus?.waiting || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Active:</span>
                  <span className="font-medium">{state.queueStatus?.active || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Completed:</span>
                  <span className="font-medium">{state.queueStatus?.completed || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Failed:</span>
                  <span className="font-medium text-red-600">{state.queueStatus?.failed || 0}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Queue Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={state.queueStatus?.paused ? handleResumeIngestion : handlePauseIngestion}
                  className="w-full"
                >
                  {state.queueStatus?.paused ? (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Resume Queue
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4 mr-2" />
                      Pause Queue
                    </>
                  )}
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRetryFailed}
                  className="w-full"
                  disabled={!state.queueStatus?.failed}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry Failed ({state.queueStatus?.failed || 0})
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Duplicates Detected</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {state.metrics?.duplicatesDetected.toLocaleString() || 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  Prevented duplicate processing
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Throughput Tab */}
        <TabsContent value="throughput" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Last Minute</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {state.metrics?.throughput.lastMinute || 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  emails processed
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Last Hour</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {state.metrics?.throughput.lastHour || 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  emails processed
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Last 24 Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">
                  {state.metrics?.throughput.last24Hours || 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  emails processed
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Throughput History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={throughputHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => format(new Date(value), 'HH:mm')}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => format(new Date(value), 'MMM dd, HH:mm:ss')}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="lastMinute" 
                      stackId="1"
                      stroke="#3b82f6" 
                      fill="#3b82f6"
                      fillOpacity={0.3}
                      name="Per Minute"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sources Tab */}
        <TabsContent value="sources" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Source Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sourceDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {sourceDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Source Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(state.metrics?.bySource || {}).map(([source, count]) => (
                    <div key={source} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: sourceColors[source as IngestionSource] }}
                        />
                        <span className="text-sm capitalize">
                          {source.replace('_', ' ')}
                        </span>
                      </div>
                      <Badge variant="secondary">{count.toLocaleString()}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Errors Tab */}
        <TabsContent value="errors" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Failed Ingestions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {state.metrics?.failedIngestions || 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total failures
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {state.metrics ? 
                    (((state.metrics.totalIngested - state.metrics.failedIngestions) / 
                      Math.max(state.metrics.totalIngested, 1)) * 100).toFixed(1) : 0}%
                </div>
                <div className="text-sm text-muted-foreground">
                  Processing success rate
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Errors */}
          {state.metrics?.errors && state.metrics.errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Errors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {state.metrics.errors.slice(0, 10).map((error, index) => (
                    <div
                      key={index}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-muted rounded"
                    >
                      <div className="flex-1">
                        <div className="font-mono text-sm text-red-600">
                          {error.error}
                        </div>
                        <div className="text-xs text-muted-foreground capitalize">
                          Source: {error.source.replace('_', ' ')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 sm:mt-0">
                        <Badge variant="secondary">{error.count}x</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(error.timestamp, { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};