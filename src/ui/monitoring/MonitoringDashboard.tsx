/**
 * Real-time Monitoring Dashboard for Local Development
 * 
 * Features:
 * - WebSocket connection status
 * - API performance metrics
 * - Database query monitoring
 * - System health indicators
 * - Interactive charts and logs
 */

import React, { useState, useEffect, useRef } from 'react';
import type { 
  MonitoringMetric, 
  ConnectionInfo, 
  PerformanceMetric, 
  DatabaseQuery, 
  SystemHealth, 
  MonitoringAlert 
} from '../../services/MonitoringService.js';
import { MetricsChart } from './MetricsChart.js';
import { ConnectionMonitor } from './ConnectionMonitor.js';
import { PerformancePanel } from './PerformancePanel.js';
import { DatabasePanel } from './DatabasePanel.js';
import { AlertsPanel } from './AlertsPanel.js';
import { SystemHealthIndicator } from './SystemHealthIndicator.js';
import './MonitoringDashboard.css';

interface DashboardData {
  connections: ConnectionInfo[];
  recentMetrics: MonitoringMetric[];
  recentPerformance: PerformanceMetric[];
  recentQueries: DatabaseQuery[];
  alerts: MonitoringAlert[];
  systemStats: {
    totalConnections: number;
    activeConnections: number;
    totalMetrics: number;
    recentErrors: number;
  };
}

interface MonitoringDashboardProps {
  wsUrl?: string;
}

export const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({ 
  wsUrl = 'ws://localhost:3002/monitoring' 
}) => {
  // State
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [selectedPanel, setSelectedPanel] = useState<'overview' | 'connections' | 'performance' | 'database' | 'alerts'>('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket connection
  useEffect(() => {
    if (autoRefresh) {
      connectWebSocket();
    } else if (wsRef.current) {
      wsRef?.current?.close();
    }

    return () => {
      if (wsRef.current) {
        wsRef?.current?.close();
      }
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [wsUrl, autoRefresh]);

  // Auto-refresh timer
  useEffect(() => {
    if (autoRefresh && !wsRef.current) {
      refreshTimerRef.current = setInterval(fetchDashboardData, refreshInterval);
    } else if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [autoRefresh, refreshInterval]);

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        setConnectionStatus('connected');
        console.log('Monitoring WebSocket connected');
        
        // Request initial data
        ws.send(JSON.stringify({ type: 'get_dashboard_data' }));
        ws.send(JSON.stringify({ type: 'get_health_status' }));
      };

      ws.onmessage = (event: any) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'dashboard_data':
              setDashboardData(message.data);
              break;
            case 'health_status':
              setSystemHealth(message.data);
              break;
            case 'metric':
              // Update metrics in real-time
              if (dashboardData) {
                setDashboardData(prev => ({
                  ...prev!,
                  recentMetrics: [message.data, ...prev!.recentMetrics.slice(0, 49)]
                }));
              }
              break;
            case 'alert':
              // Add new alert
              if (dashboardData) {
                setDashboardData(prev => ({
                  ...prev!,
                  alerts: [message.data, ...prev!.alerts]
                }));
              }
              break;
            case 'performance':
              // Add performance data
              if (dashboardData) {
                setDashboardData(prev => ({
                  ...prev!,
                  recentPerformance: [message.data, ...prev!.recentPerformance.slice(0, 49)]
                }));
              }
              break;
            case 'database_query':
              // Add query data
              if (dashboardData) {
                setDashboardData(prev => ({
                  ...prev!,
                  recentQueries: [message.data, ...prev!.recentQueries.slice(0, 49)]
                }));
              }
              break;
            case 'connection_change':
              // Update connection status
              if (dashboardData) {
                setDashboardData(prev => {
                  const connections = [...prev!.connections];
                  const index = connections.findIndex(c => c.id === message?.data?.id);
                  if (index >= 0) {
                    connections[index] = message.data;
                  } else {
                    connections.push(message.data);
                  }
                  return { ...prev!, connections };
                });
              }
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        console.log('Monitoring WebSocket disconnected');
        
        // Attempt reconnection after 3 seconds
        if (autoRefresh) {
          setTimeout(() => {
            if (autoRefresh) {
              connectWebSocket();
            }
          }, 3000);
        }
      };

      ws.onerror = (error: any) => {
        console.error('Monitoring WebSocket error:', error);
        setConnectionStatus('disconnected');
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setConnectionStatus('disconnected');
    }
  };

  const fetchDashboardData = async () => {
    try {
      const [dashboardResponse, healthResponse] = await Promise.all([
        fetch('/api/monitoring/dashboard'),
        fetch('/api/monitoring/health')
      ]);

      if (dashboardResponse.ok) {
        const data = await dashboardResponse.json();
        setDashboardData(data);
      }

      if (healthResponse.ok) {
        const health = await healthResponse.json();
        setSystemHealth(health);
      }
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/monitoring/alerts/${alertId}/acknowledge`, {
        method: 'POST'
      });
      
      if (response.ok && dashboardData) {
        setDashboardData(prev => ({
          ...prev!,
          alerts: prev!.alerts?.map(alert => 
            alert.id === alertId ? { ...alert, acknowledged: true } : alert
          )
        }));
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#4CAF50';
      case 'connecting': return '#FF9800';
      case 'disconnected': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  if (!dashboardData) {
    return (
      <div className="monitoring-dashboard loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading monitoring dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="monitoring-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <h1>🔍 Development Monitoring Dashboard</h1>
        
        <div className="header-controls">
          <div className="connection-indicator">
            <div 
              className="status-dot" 
              style={{ backgroundColor: getConnectionStatusColor() }}
            ></div>
            <span>{connectionStatus}</span>
          </div>
          
          <div className="refresh-controls">
            <label>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e: any) => setAutoRefresh(e?.target?.checked)}
              />
              Auto-refresh
            </label>
            
            <select
              value={refreshInterval}
              onChange={(e: any) => setRefreshInterval(Number(e?.target?.value))}
              disabled={!autoRefresh}
            >
              <option value={1000}>1s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
              <option value={30000}>30s</option>
            </select>
            
            <button onClick={fetchDashboardData} disabled={autoRefresh}>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* System Health Bar */}
      {systemHealth && (
        <SystemHealthIndicator 
          health={systemHealth}
          stats={dashboardData.systemStats}
        />
      )}

      {/* Navigation */}
      <div className="dashboard-nav">
        {[
          { key: 'overview', label: '📊 Overview', count: null },
          { key: 'connections', label: '🔌 Connections', count: dashboardData?.systemStats?.activeConnections },
          { key: 'performance', label: '⚡ Performance', count: dashboardData?.recentPerformance?.length },
          { key: 'database', label: '💾 Database', count: dashboardData?.recentQueries?.length },
          { key: 'alerts', label: '🚨 Alerts', count: dashboardData?.alerts?.filter(a => !a.acknowledged).length }
        ].map(({ key, label, count }) => (
          <button
            key={key}
            className={`nav-button ${selectedPanel === key ? 'active' : ''}`}
            onClick={() => setSelectedPanel(key as any)}
          >
            {label}
            {count !== null && count > 0 && (
              <span className="badge">{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="dashboard-content">
        {selectedPanel === 'overview' && (
          <div className="overview-panel">
            <div className="overview-grid">
              <div className="overview-card">
                <h3>🔌 Connections</h3>
                <div className="card-stats">
                  <div className="stat-item">
                    <span className="stat-value">{dashboardData?.systemStats?.activeConnections}</span>
                    <span className="stat-label">Active</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{dashboardData?.systemStats?.totalConnections}</span>
                    <span className="stat-label">Total</span>
                  </div>
                </div>
              </div>
              
              <div className="overview-card">
                <h3>⚡ Performance</h3>
                <div className="card-stats">
                  <div className="stat-item">
                    <span className="stat-value">
                      {dashboardData?.recentPerformance?.length > 0 ? 
                        Math.round(dashboardData?.recentPerformance?.reduce((sum: any, p: any) => sum + p.responseTime, 0) / dashboardData?.recentPerformance?.length) : 0}ms
                    </span>
                    <span className="stat-label">Avg Response</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{dashboardData?.recentPerformance?.length}</span>
                    <span className="stat-label">Recent Requests</span>
                  </div>
                </div>
              </div>
              
              <div className="overview-card">
                <h3>💾 Database</h3>
                <div className="card-stats">
                  <div className="stat-item">
                    <span className="stat-value">
                      {dashboardData?.recentQueries?.length > 0 ? 
                        Math.round(dashboardData?.recentQueries?.reduce((sum: any, q: any) => sum + q.executionTime, 0) / dashboardData?.recentQueries?.length) : 0}ms
                    </span>
                    <span className="stat-label">Avg Query Time</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{dashboardData?.recentQueries?.length}</span>
                    <span className="stat-label">Recent Queries</span>
                  </div>
                </div>
              </div>
              
              <div className="overview-card">
                <h3>🚨 Alerts</h3>
                <div className="card-stats">
                  <div className="stat-item">
                    <span className="stat-value">{dashboardData?.alerts?.filter(a => !a.acknowledged).length}</span>
                    <span className="stat-label">Active</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{dashboardData?.systemStats?.recentErrors}</span>
                    <span className="stat-label">Recent Errors</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Recent Metrics Chart */}
            <div className="overview-chart">
              <MetricsChart 
                metrics={dashboardData.recentMetrics} 
                title="Recent System Metrics"
                height={300}
              />
            </div>
          </div>
        )}

        {selectedPanel === 'connections' && (
          <ConnectionMonitor connections={dashboardData.connections} />
        )}

        {selectedPanel === 'performance' && (
          <PerformancePanel 
            performanceData={dashboardData.recentPerformance}
            metrics={dashboardData?.recentMetrics?.filter(m => m?.name?.includes('api.'))}
          />
        )}

        {selectedPanel === 'database' && (
          <DatabasePanel 
            queries={dashboardData.recentQueries}
            metrics={dashboardData?.recentMetrics?.filter(m => m?.name?.includes('db.'))}
          />
        )}

        {selectedPanel === 'alerts' && (
          <AlertsPanel 
            alerts={dashboardData.alerts}
            onAcknowledge={acknowledgeAlert}
          />
        )}
      </div>
    </div>
  );
};

export default MonitoringDashboard;