import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  AlertTriangle, 
  Activity, 
  Clock, 
  Users, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  Filter,
  Download,
  Settings,
  Eye,
  EyeOff,
  Zap,
  Database,
  Network,
  HardDrive,
  Cpu
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Badge } from '../../components/ui/badge.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select.js';
import { Switch } from '../../components/ui/switch.js';
import { Label } from '../../components/ui/label.js';

// Types for monitoring data
interface MetricData {
  timestamp: string;
  value: number;
  label?: string;
}

interface AlertData {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  component: string;
  timestamp: string;
  resolved: boolean;
}

interface PerformanceMetrics {
  responseTime: MetricData[];
  throughput: MetricData[];
  errorRate: MetricData[];
  memoryUsage: MetricData[];
  cpuUsage: MetricData[];
}

interface GroceryMetrics {
  nlpSuccessRate: number;
  productMatchRate: number;
  priceSuccessRate: number;
  dealDetectionRate: number;
  averageResponseTime: number;
  activeUsers: number;
  totalQueries: number;
  errorCount: number;
}

interface ComponentStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  errorRate: number;
  lastCheck: string;
}

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#6366f1',
  gray: '#6b7280',
};

const SEVERITY_COLORS = {
  info: COLORS.info,
  warning: COLORS.warning,
  error: COLORS.error,
  critical: '#dc2626',
};

export const MonitoringDashboard: React.FC = () => {
  // State management
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedComponent, setSelectedComponent] = useState<string>('all');
  const [hideResolvedAlerts, setHideResolvedAlerts] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Mock data - In real implementation, this would come from your monitoring APIs
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    responseTime: [],
    throughput: [],
    errorRate: [],
    memoryUsage: [],
    cpuUsage: [],
  });

  const [groceryMetrics, setGroceryMetrics] = useState<GroceryMetrics>({
    nlpSuccessRate: 0.92,
    productMatchRate: 0.87,
    priceSuccessRate: 0.95,
    dealDetectionRate: 0.78,
    averageResponseTime: 342,
    activeUsers: 156,
    totalQueries: 2847,
    errorCount: 23,
  });

  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [componentStatuses, setComponentStatuses] = useState<ComponentStatus[]>([]);

  // Generate mock data for demonstration
  const generateMockData = useMemo(() => {
    const now = new Date();
    const timeRangeMs = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    }[timeRange];

    const points = timeRange === '7d' ? 168 : timeRange === '24h' ? 48 : 60;
    const interval = timeRangeMs / points;

    return Array.from({ length: points }, (_, i) => {
      const timestamp = new Date(now.getTime() - timeRangeMs + (i * interval));
      return {
        timestamp: timestamp.toISOString(),
        responseTime: Math.random() * 500 + 200,
        throughput: Math.random() * 100 + 50,
        errorRate: Math.random() * 5,
        memoryUsage: Math.random() * 20 + 60,
        cpuUsage: Math.random() * 30 + 20,
      };
    });
  }, [timeRange]);

  // Mock alerts data
  const mockAlerts: AlertData[] = [
    {
      id: '1',
      type: 'high_response_time',
      severity: 'warning',
      message: 'Average response time exceeded 500ms threshold',
      component: 'walmart_api',
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      resolved: false,
    },
    {
      id: '2',
      type: 'nlp_parsing_error',
      severity: 'error',
      message: 'NLP parsing failure rate increased to 15%',
      component: 'nlp_processor',
      timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      resolved: false,
    },
    {
      id: '3',
      type: 'memory_usage_high',
      severity: 'critical',
      message: 'Memory usage reached 85% of available capacity',
      component: 'system',
      timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
      resolved: true,
    },
  ];

  const mockComponentStatuses: ComponentStatus[] = [
    {
      name: 'Walmart API',
      status: 'degraded',
      responseTime: 445,
      errorRate: 2.3,
      lastCheck: new Date(Date.now() - 30 * 1000).toISOString(),
    },
    {
      name: 'NLP Processor',
      status: 'healthy',
      responseTime: 156,
      errorRate: 0.8,
      lastCheck: new Date(Date.now() - 15 * 1000).toISOString(),
    },
    {
      name: 'Database',
      status: 'healthy',
      responseTime: 23,
      errorRate: 0.1,
      lastCheck: new Date(Date.now() - 10 * 1000).toISOString(),
    },
    {
      name: 'WebSocket Service',
      status: 'healthy',
      responseTime: 12,
      errorRate: 0.0,
      lastCheck: new Date(Date.now() - 20 * 1000).toISOString(),
    },
  ];

  // Update data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (autoRefresh) {
        setLastUpdate(new Date());
        // In real implementation, fetch fresh data from APIs
        setAlerts(mockAlerts);
        setComponentStatuses(mockComponentStatuses);
      }
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      if (hideResolvedAlerts && alert.resolved) return false;
      if (selectedComponent !== 'all' && alert.component !== selectedComponent) return false;
      return true;
    });
  }, [alerts, hideResolvedAlerts, selectedComponent]);

  // Calculate metrics
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.resolved).length;
  const errorAlerts = alerts.filter(a => a.severity === 'error' && !a.resolved).length;
  const warningAlerts = alerts.filter(a => a.severity === 'warning' && !a.resolved).length;
  const healthyComponents = componentStatuses.filter(c => c.status === 'healthy').length;
  const totalComponents = componentStatuses.length;

  // Render methods
  const renderMetricCard = (
    title: string,
    value: string | number,
    icon: React.ReactNode,
    trend?: 'up' | 'down',
    trendValue?: string,
    severity?: 'success' | 'warning' | 'error'
  ) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-2xl font-bold">{value}</p>
              {trend && trendValue && (
                <div className={`flex items-center gap-1 text-sm ${
                  trend === 'up' && severity === 'success' ? 'text-green-600' :
                  trend === 'up' && severity === 'error' ? 'text-red-600' :
                  trend === 'down' && severity === 'success' ? 'text-green-600' :
                  'text-red-600'
                }`}>
                  {trend === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  {trendValue}
                </div>
              )}
            </div>
          </div>
          <div className={`p-2 rounded-lg ${
            severity === 'success' ? 'bg-green-100 text-green-600' :
            severity === 'warning' ? 'bg-yellow-100 text-yellow-600' :
            severity === 'error' ? 'bg-red-100 text-red-600' :
            'bg-blue-100 text-blue-600'
          }`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderAlertsBadge = (severity: AlertData['severity'], count: number) => {
    if (count === 0) return null;
    
    return (
      <Badge 
        variant={severity === 'critical' ? 'destructive' : 
                severity === 'error' ? 'destructive' : 
                severity === 'warning' ? 'secondary' : 'default'}
        className="ml-2"
      >
        {count}
      </Badge>
    );
  };

  const renderComponentStatus = (component: ComponentStatus) => {
    const statusColor = component.status === 'healthy' ? 'text-green-600' :
                       component.status === 'degraded' ? 'text-yellow-600' :
                       'text-red-600';
    
    const statusBg = component.status === 'healthy' ? 'bg-green-100' :
                    component.status === 'degraded' ? 'bg-yellow-100' :
                    'bg-red-100';

    return (
      <div key={component.name} className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${statusBg} ${statusColor}`} />
          <div>
            <p className="font-medium">{component.name}</p>
            <p className="text-sm text-muted-foreground">
              Last check: {new Date(component.lastCheck).toLocaleTimeString()}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm">
            Response: {component.responseTime}ms
          </p>
          <p className="text-sm text-muted-foreground">
            Error: {component.errorRate}%
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Monitoring Dashboard</h1>
          <p className="text-muted-foreground">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="auto-refresh">Auto Refresh</Label>
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
          </div>
          
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">1h</SelectItem>
              <SelectItem value="6h">6h</SelectItem>
              <SelectItem value="24h">24h</SelectItem>
              <SelectItem value="7d">7d</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm">
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>

          <Button variant="outline" size="sm">
            <Download size={16} className="mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {renderMetricCard(
          "Active Users",
          groceryMetrics.activeUsers,
          <Users size={24} />,
          "up",
          "+12%",
          "success"
        )}
        
        {renderMetricCard(
          "Avg Response Time",
          `${groceryMetrics.averageResponseTime}ms`,
          <Clock size={24} />,
          "down",
          "-5%",
          "success"
        )}
        
        {renderMetricCard(
          "Error Rate",
          "2.1%",
          <AlertTriangle size={24} />,
          "up",
          "+0.3%",
          "warning"
        )}
        
        {renderMetricCard(
          "Success Rate",
          "97.9%",
          <Activity size={24} />,
          "up",
          "+0.2%",
          "success"
        )}
      </div>

      {/* Alerts Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Alerts
                {renderAlertsBadge('critical', criticalAlerts)}
                {renderAlertsBadge('error', errorAlerts)}
                {renderAlertsBadge('warning', warningAlerts)}
              </CardTitle>
              <CardDescription>Active alerts and notifications</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="hide-resolved"
                  checked={hideResolvedAlerts}
                  onCheckedChange={setHideResolvedAlerts}
                />
                <Label htmlFor="hide-resolved" className="text-sm">Hide resolved</Label>
              </div>
              <Select value={selectedComponent} onValueChange={setSelectedComponent}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Components</SelectItem>
                  <SelectItem value="walmart_api">Walmart API</SelectItem>
                  <SelectItem value="nlp_processor">NLP Processor</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredAlerts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No alerts matching current filters
              </p>
            ) : (
              filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 border-l-4 rounded-lg ${
                    alert.severity === 'critical' ? 'border-red-500 bg-red-50' :
                    alert.severity === 'error' ? 'border-red-400 bg-red-50' :
                    alert.severity === 'warning' ? 'border-yellow-400 bg-yellow-50' :
                    'border-blue-400 bg-blue-50'
                  } ${alert.resolved ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{alert.component}</Badge>
                        <Badge 
                          variant={alert.severity === 'critical' ? 'destructive' : 
                                  alert.severity === 'error' ? 'destructive' :
                                  alert.severity === 'warning' ? 'secondary' : 'default'}
                        >
                          {alert.severity}
                        </Badge>
                        {alert.resolved && (
                          <Badge variant="outline" className="text-green-600">
                            Resolved
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium">{alert.message}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                    {!alert.resolved && (
                      <Button size="sm" variant="outline">
                        Acknowledge
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Charts and Detailed Metrics */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="grocery">Grocery Metrics</TabsTrigger>
          <TabsTrigger value="system">System Health</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Response Time Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Response Time</CardTitle>
                <CardDescription>Average response time over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={generateMockData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                      formatter={(value: number) => [`${value.toFixed(0)}ms`, 'Response Time']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="responseTime" 
                      stroke={COLORS.primary} 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Error Rate Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Error Rate</CardTitle>
                <CardDescription>Percentage of failed requests</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={generateMockData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Error Rate']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="errorRate" 
                      stroke={COLORS.error} 
                      fill={COLORS.error}
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Throughput Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Throughput</CardTitle>
                <CardDescription>Requests per minute</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={generateMockData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                      formatter={(value: number) => [`${value.toFixed(0)} req/min`, 'Throughput']}
                    />
                    <Bar dataKey="throughput" fill={COLORS.success} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Resource Usage */}
            <Card>
              <CardHeader>
                <CardTitle>Resource Usage</CardTitle>
                <CardDescription>Memory and CPU utilization</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={generateMockData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="memoryUsage" 
                      stroke={COLORS.info} 
                      strokeWidth={2}
                      name="Memory %"
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="cpuUsage" 
                      stroke={COLORS.warning} 
                      strokeWidth={2}
                      name="CPU %"
                      dot={false}
                    />
                    <Legend />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="grocery" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Success Rates */}
            <Card>
              <CardHeader>
                <CardTitle>Success Rates</CardTitle>
                <CardDescription>Success rates across different operations</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      { name: 'NLP Parsing', rate: groceryMetrics.nlpSuccessRate * 100 },
                      { name: 'Product Matching', rate: groceryMetrics.productMatchRate * 100 },
                      { name: 'Price Fetching', rate: groceryMetrics.priceSuccessRate * 100 },
                      { name: 'Deal Detection', rate: groceryMetrics.dealDetectionRate * 100 },
                    ]}
                    layout="horizontal"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis dataKey="name" type="category" />
                    <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'Success Rate']} />
                    <Bar dataKey="rate" fill={COLORS.success} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Query Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Query Distribution</CardTitle>
                <CardDescription>Types of queries processed</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Product Search', value: 45, color: COLORS.primary },
                        { name: 'Price Check', value: 30, color: COLORS.success },
                        { name: 'Deal Discovery', value: 15, color: COLORS.warning },
                        { name: 'Other', value: 10, color: COLORS.gray },
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {[
                        { name: 'Product Search', value: 45, color: COLORS.primary },
                        { name: 'Price Check', value: 30, color: COLORS.success },
                        { name: 'Deal Discovery', value: 15, color: COLORS.warning },
                        { name: 'Other', value: 10, color: COLORS.gray },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>System Health Overview</CardTitle>
              <CardDescription>
                Overall system health: {healthyComponents}/{totalComponents} components healthy
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {renderMetricCard(
                  "Memory Usage",
                  "74%",
                  <HardDrive size={24} />,
                  "up",
                  "+2%",
                  "warning"
                )}
                {renderMetricCard(
                  "CPU Usage",
                  "32%",
                  <Cpu size={24} />,
                  "down",
                  "-5%",
                  "success"
                )}
                {renderMetricCard(
                  "Network I/O",
                  "125 MB/s",
                  <Network size={24} />,
                  "up",
                  "+18%",
                  "success"
                )}
                {renderMetricCard(
                  "Database Connections",
                  "15/50",
                  <Database size={24} />,
                  undefined,
                  undefined,
                  "success"
                )}
                {renderMetricCard(
                  "WebSocket Connections",
                  "234",
                  <Zap size={24} />,
                  "up",
                  "+12",
                  "success"
                )}
                {renderMetricCard(
                  "Cache Hit Rate",
                  "96.2%",
                  <Activity size={24} />,
                  "up",
                  "+1.2%",
                  "success"
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="components">
          <Card>
            <CardHeader>
              <CardTitle>Component Status</CardTitle>
              <CardDescription>Health status of all system components</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {componentStatuses.map(renderComponentStatus)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};