/**
 * Circuit Breaker Dashboard Component
 * 
 * Real-time monitoring dashboard for circuit breaker states, metrics, and health status
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.js';
import { Badge } from '../../components/ui/badge.js';
import { Button } from '../../components/ui/button.js';
import { Alert, AlertDescription } from '../../components/ui/alert.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs.js';
import { Progress } from '../../components/ui/progress.js';
import './CircuitBreakerDashboard.css';

interface CircuitBreakerStats {
  name: string;
  state: 'closed' | 'open' | 'half-open';
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rejectedRequests: number;
  averageResponseTime: number;
  errorRate: number;
  uptime: number;
  lastError?: string;
}

interface BulkheadStats {
  service: string;
  maxConcurrent: number;
  currentActive: number;
  queueSize: number;
  totalRequests: number;
  totalRejected: number;
  averageWaitTime: number;
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, {
    circuitBreakers: Record<string, CircuitBreakerStats>;
    bulkhead: BulkheadStats;
  }>;
  deadLetterQueue: {
    total: number;
    byService: Record<string, number>;
  };
}

interface DeadLetterItem {
  id: string;
  service: string;
  operation: string;
  error: string;
  timestamp: string;
  retryCount: number;
  maxRetries: number;
}

const CircuitBreakerDashboard: React.FC = () => {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [deadLetterItems, setDeadLetterItems] = useState<DeadLetterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedService, setSelectedService] = useState<string>('all');

  // Fetch system health data
  const fetchSystemHealth = async () => {
    try {
      const response = await fetch('/api/circuit-breaker/health');
      if (!response.ok) throw new Error('Failed to fetch system health');
      const data = await response.json();
      setSystemHealth(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch dead letter queue items
  const fetchDeadLetterItems = async () => {
    try {
      const response = await fetch('/api/circuit-breaker/dead-letter-queue');
      if (!response.ok) throw new Error('Failed to fetch dead letter queue');
      const data = await response.json();
      setDeadLetterItems(data);
    } catch (err) {
      console.error('Failed to fetch dead letter queue:', err);
    }
  };

  // Manual circuit breaker control
  const resetCircuitBreaker = async (service: string, operation?: string) => {
    try {
      const url = operation 
        ? `/api/circuit-breaker/reset/${service}/${operation}`
        : `/api/circuit-breaker/reset/${service}`;
      
      const response = await fetch(url, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to reset circuit breaker');
      
      await fetchSystemHealth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset circuit breaker');
    }
  };

  const forceOpen = async (service: string, operation?: string) => {
    try {
      const url = operation
        ? `/api/circuit-breaker/force-open/${service}/${operation}`
        : `/api/circuit-breaker/force-open/${service}`;
      
      const response = await fetch(url, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to force circuit breaker open');
      
      await fetchSystemHealth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to force circuit breaker open');
    }
  };

  const retryDeadLetterItem = async (id: string) => {
    try {
      const response = await fetch(`/api/circuit-breaker/retry/${id}`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to retry item');
      
      await fetchDeadLetterItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry item');
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    fetchSystemHealth();
    fetchDeadLetterItems();

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchSystemHealth();
        fetchDeadLetterItems();
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getStateColor = (state: string) => {
    switch (state) {
      case 'closed': return 'success';
      case 'half-open': return 'warning';
      case 'open': return 'destructive';
      default: return 'secondary';
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'success';
      case 'degraded': return 'warning';
      case 'unhealthy': return 'destructive';
      default: return 'secondary';
    }
  };

  const formatUptime = (uptime: number) => {
    const hours = Math.floor(uptime / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  if (loading) {
    return (
      <div className="circuit-breaker-dashboard">
        <div className="loading-spinner">Loading circuit breaker data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="circuit-breaker-dashboard">
        <Alert variant="destructive">
          <AlertDescription>Error: {error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!systemHealth) {
    return (
      <div className="circuit-breaker-dashboard">
        <Alert>
          <AlertDescription>No circuit breaker data available</AlertDescription>
        </Alert>
      </div>
    );
  }

  const services = Object.keys(systemHealth.services);
  const filteredServices = selectedService === 'all' 
    ? services 
    : services.filter(service => service === selectedService);

  return (
    <div className="circuit-breaker-dashboard">
      <div className="dashboard-header">
        <h1>Circuit Breaker Dashboard</h1>
        <div className="dashboard-controls">
          <select 
            value={selectedService} 
            onChange={(e) => setSelectedService(e.target.value)}
            className="service-selector"
          >
            <option value="all">All Services</option>
            {services.map(service => (
              <option key={service} value={service}>{service}</option>
            ))}
          </select>
          <Button 
            variant="outline" 
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'active' : ''}
          >
            Auto Refresh {autoRefresh ? '●' : '○'}
          </Button>
          <Button onClick={fetchSystemHealth}>Refresh Now</Button>
        </div>
      </div>

      <div className="system-overview">
        <Card className="overview-card">
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>Overall circuit breaker system status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="health-indicator">
              <Badge variant={getHealthColor(systemHealth.overall)}>
                {systemHealth.overall.toUpperCase()}
              </Badge>
              <div className="health-stats">
                <span>{services.length} Services</span>
                <span>{systemHealth.deadLetterQueue.total} Pending Operations</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {systemHealth.deadLetterQueue.total > 0 && (
          <Alert variant="warning" className="dlq-alert">
            <AlertDescription>
              {systemHealth.deadLetterQueue.total} operations in dead letter queue require attention
            </AlertDescription>
          </Alert>
        )}
      </div>

      <Tabs defaultValue="circuit-breakers" className="dashboard-tabs">
        <TabsList>
          <TabsTrigger value="circuit-breakers">Circuit Breakers</TabsTrigger>
          <TabsTrigger value="bulkheads">Bulkheads</TabsTrigger>
          <TabsTrigger value="dead-letter-queue">Dead Letter Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="circuit-breakers" className="circuit-breakers-tab">
          <div className="service-grid">
            {filteredServices.map(serviceName => {
              const service = systemHealth.services[serviceName];
              const circuitBreakers = Object.entries(service.circuitBreakers);
              
              return (
                <Card key={serviceName} className="service-card">
                  <CardHeader>
                    <CardTitle className="service-title">
                      {serviceName.charAt(0).toUpperCase() + serviceName.slice(1)} Service
                    </CardTitle>
                    <CardDescription>
                      {circuitBreakers.length} Circuit Breaker{circuitBreakers.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="circuit-breakers-list">
                      {circuitBreakers.map(([name, stats]) => (
                        <div key={name} className="circuit-breaker-item">
                          <div className="cb-header">
                            <span className="cb-name">{name.replace(`${serviceName}_`, '')}</span>
                            <Badge variant={getStateColor(stats.state)}>
                              {stats.state}
                            </Badge>
                          </div>
                          
                          <div className="cb-metrics">
                            <div className="metric">
                              <span className="label">Requests</span>
                              <span className="value">{stats.totalRequests.toLocaleString()}</span>
                            </div>
                            <div className="metric">
                              <span className="label">Success Rate</span>
                              <span className="value">
                                {stats.totalRequests > 0 
                                  ? `${((stats.successfulRequests / stats.totalRequests) * 100).toFixed(1)}%`
                                  : 'N/A'
                                }
                              </span>
                            </div>
                            <div className="metric">
                              <span className="label">Avg Response</span>
                              <span className="value">{formatDuration(stats.averageResponseTime)}</span>
                            </div>
                            <div className="metric">
                              <span className="label">Uptime</span>
                              <span className="value">{formatUptime(stats.uptime)}</span>
                            </div>
                          </div>

                          {stats.totalRequests > 0 && (
                            <div className="cb-progress">
                              <Progress 
                                value={(stats.successfulRequests / stats.totalRequests) * 100}
                                className="success-rate-progress"
                              />
                            </div>
                          )}

                          {stats.lastError && (
                            <div className="cb-error">
                              <small>Last Error: {stats.lastError}</small>
                            </div>
                          )}

                          <div className="cb-actions">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => resetCircuitBreaker(serviceName, name.replace(`${serviceName}_`, ''))}
                              disabled={stats.state === 'closed'}
                            >
                              Reset
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              onClick={() => forceOpen(serviceName, name.replace(`${serviceName}_`, ''))}
                              disabled={stats.state === 'open'}
                            >
                              Force Open
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="bulkheads" className="bulkheads-tab">
          <div className="bulkhead-grid">
            {filteredServices.map(serviceName => {
              const bulkhead = systemHealth.services[serviceName].bulkhead;
              const utilizationPercent = (bulkhead.currentActive / bulkhead.maxConcurrent) * 100;
              
              return (
                <Card key={serviceName} className="bulkhead-card">
                  <CardHeader>
                    <CardTitle>{serviceName.charAt(0).toUpperCase() + serviceName.slice(1)}</CardTitle>
                    <CardDescription>Concurrent Request Management</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bulkhead-metrics">
                      <div className="utilization-chart">
                        <div className="chart-title">Resource Utilization</div>
                        <Progress value={utilizationPercent} className="utilization-progress" />
                        <div className="chart-labels">
                          <span>{bulkhead.currentActive} active</span>
                          <span>{bulkhead.maxConcurrent} max</span>
                        </div>
                      </div>
                      
                      <div className="bulkhead-stats">
                        <div className="stat">
                          <span className="label">Queue Size</span>
                          <span className="value">{bulkhead.queueSize}</span>
                        </div>
                        <div className="stat">
                          <span className="label">Total Requests</span>
                          <span className="value">{bulkhead.totalRequests.toLocaleString()}</span>
                        </div>
                        <div className="stat">
                          <span className="label">Rejected</span>
                          <span className="value">{bulkhead.totalRejected.toLocaleString()}</span>
                        </div>
                        <div className="stat">
                          <span className="label">Avg Wait Time</span>
                          <span className="value">{formatDuration(bulkhead.averageWaitTime)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="dead-letter-queue" className="dlq-tab">
          <Card>
            <CardHeader>
              <CardTitle>Dead Letter Queue</CardTitle>
              <CardDescription>
                Failed operations waiting for retry ({deadLetterItems.length} items)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {deadLetterItems.length === 0 ? (
                <div className="empty-state">
                  <p>No items in dead letter queue</p>
                </div>
              ) : (
                <div className="dlq-items">
                  {deadLetterItems.map(item => (
                    <div key={item.id} className="dlq-item">
                      <div className="dlq-header">
                        <span className="dlq-service">{item.service}</span>
                        <span className="dlq-operation">{item.operation}</span>
                        <span className="dlq-timestamp">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="dlq-error">
                        {item.error}
                      </div>
                      
                      <div className="dlq-footer">
                        <span className="dlq-retries">
                          Retries: {item.retryCount}/{item.maxRetries}
                        </span>
                        <Button 
                          size="sm" 
                          onClick={() => retryDeadLetterItem(item.id)}
                        >
                          Retry Now
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CircuitBreakerDashboard;