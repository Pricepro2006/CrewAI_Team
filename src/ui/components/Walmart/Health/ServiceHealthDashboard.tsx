/**
 * Service Health Dashboard Component
 * Comprehensive monitoring and visualization of Walmart Grocery Agent services
 * Real-time health metrics, performance monitoring, and alert management
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Server,
  Zap,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Settings,
  Eye,
  BarChart3,
  AlertCircle
} from 'lucide-react';
import { ServiceHealth, SystemHealth, PerformanceMetrics } from '../types/WalmartTypes';
import { api } from '../../../utils/trpc';
import './Health.css';

interface ServiceHealthDashboardProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
  showDetails?: boolean;
  className?: string;
}

interface AlertRule {
  id: string;
  service: string;
  metric: 'latency' | 'uptime' | 'errorRate' | 'status';
  operator: 'gt' | 'lt' | 'eq';
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
}

interface ServiceAlert {
  id: string;
  service: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
}

const SERVICE_ENDPOINTS = {
  'nlp-service': 'http://localhost:3008/health',
  'pricing-service': 'http://localhost:3007/health',
  'cache-service': 'http://localhost:3006/health',
  'grocery-service': 'http://localhost:3005/health',
  'deal-engine': 'http://localhost:3009/health',
  'memory-monitor': 'http://localhost:3010/health',
  'websocket-gateway': 'ws://localhost:8080/health'
};

export const ServiceHealthDashboard: React.FC<ServiceHealthDashboardProps> = ({
  autoRefresh = true,
  refreshInterval = 10000, // 10 seconds
  showDetails = true,
  className = ''
}) => {
  // State management
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [alerts, setAlerts] = useState<ServiceAlert[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [showSettings, setShowSettings] = useState(false);
  
  // Health check mutation
  const healthCheckMutation = api.health.checkSystem.useMutation({
    onSuccess: (data) => {
      setSystemHealth(data);
      setServices(data.services);
      checkAlerts(data.services);
      setIsRefreshing(false);
      setLastRefresh(new Date());
    },
    onError: (error) => {
      console.error('Health check failed:', error);
      setIsRefreshing(false);
    }
  });
  
  /**
   * Refresh health data
   */
  const refreshHealth = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await healthCheckMutation.mutateAsync({});
    } catch (error) {
      console.error('Failed to refresh health data:', error);
      setIsRefreshing(false);
    }
  }, [isRefreshing, healthCheckMutation]);
  
  /**
   * Check for alerts based on service health
   */
  const checkAlerts = useCallback((serviceHealths: ServiceHealth[]) => {
    const newAlerts: ServiceAlert[] = [];
    
    serviceHealths.forEach(service => {
      alertRules.forEach(rule => {
        if (!rule.enabled || rule.service !== service.service) return;
        
        let triggerAlert = false;
        let alertMessage = '';
        
        switch (rule.metric) {
          case 'status':
            if (service.status === 'down' && rule.operator === 'eq' && rule.threshold === 0) {
              triggerAlert = true;
              alertMessage = `${service.service} is down`;
            }
            break;
            
          case 'latency':
            if (rule.operator === 'gt' && service.latency > rule.threshold) {
              triggerAlert = true;
              alertMessage = `${service.service} latency (${service.latency}ms) exceeds threshold (${rule.threshold}ms)`;
            }
            break;
            
          case 'uptime':
            if (rule.operator === 'lt' && service.uptime < rule.threshold) {
              triggerAlert = true;
              alertMessage = `${service.service} uptime (${service.uptime}%) below threshold (${rule.threshold}%)`;
            }
            break;
        }
        
        if (triggerAlert) {
          // Check if alert already exists and is not resolved
          const existingAlert = alerts.find(alert => 
            alert.service === service.service && 
            alert.message === alertMessage && 
            !alert.resolvedAt
          );
          
          if (!existingAlert) {
            newAlerts.push({
              id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              service: service.service,
              message: alertMessage,
              severity: rule.severity,
              timestamp: new Date(),
              acknowledged: false
            });
          }
        }
      });
    });
    
    if (newAlerts.length > 0) {
      setAlerts(prev => [...prev, ...newAlerts]);
    }
  }, [alertRules, alerts]);
  
  /**
   * Acknowledge alert
   */
  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, acknowledged: true }
        : alert
    ));
  }, []);
  
  /**
   * Resolve alert
   */
  const resolveAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, resolvedAt: new Date() }
        : alert
    ));
  }, []);
  
  /**
   * Get service status color
   */
  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'healthy': return '#10b981';
      case 'degraded': return '#f59e0b';
      case 'down': return '#ef4444';
      default: return '#6b7280';
    }
  }, []);
  
  /**
   * Get service status icon
   */
  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle size={20} />;
      case 'degraded': return <AlertTriangle size={20} />;
      case 'down': return <AlertCircle size={20} />;
      default: return <Clock size={20} />;
    }
  }, []);
  
  /**
   * Calculate overall system status
   */
  const overallStatus = useMemo(() => {
    if (!systemHealth) return 'unknown';
    return systemHealth.overall;
  }, [systemHealth]);
  
  /**
   * Get active alerts
   */
  const activeAlerts = useMemo(() => {
    return alerts.filter(alert => !alert.resolvedAt);
  }, [alerts]);
  
  /**
   * Group alerts by severity
   */
  const alertsBySeverity = useMemo(() => {
    const grouped = activeAlerts.reduce((acc, alert) => {
      if (!acc[alert.severity]) acc[alert.severity] = [];
      acc[alert.severity].push(alert);
      return acc;
    }, {} as Record<string, ServiceAlert[]>);
    
    return grouped;
  }, [activeAlerts]);
  
  /**
   * Auto refresh effect
   */
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoRefresh) {
      interval = setInterval(refreshHealth, refreshInterval);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval, refreshHealth]);
  
  /**
   * Initial health check
   */
  useEffect(() => {
    refreshHealth();
  }, []);
  
  /**
   * Load default alert rules
   */
  useEffect(() => {
    const defaultRules: AlertRule[] = [
      {
        id: '1',
        service: 'nlp-service',
        metric: 'latency',
        operator: 'gt',
        threshold: 5000,
        severity: 'high',
        enabled: true
      },
      {
        id: '2',
        service: 'pricing-service',
        metric: 'uptime',
        operator: 'lt',
        threshold: 95,
        severity: 'medium',
        enabled: true
      },
      {
        id: '3',
        service: 'websocket-gateway',
        metric: 'status',
        operator: 'eq',
        threshold: 0,
        severity: 'critical',
        enabled: true
      }
    ];
    
    setAlertRules(defaultRules);
  }, []);
  
  return (
    <div className={`service-health-dashboard ${className}`}>
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div className="header-title">
          <Activity size={24} />
          <h1>System Health Dashboard</h1>
        </div>
        
        <div className="header-actions">
          <div className="last-refresh">
            <Clock size={14} />
            <span>Last updated: {lastRefresh.toLocaleTimeString()}</span>
          </div>
          
          <button
            onClick={refreshHealth}
            disabled={isRefreshing}
            className={`refresh-button ${isRefreshing ? 'refreshing' : ''}`}
          >
            <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
            Refresh
          </button>
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="settings-button"
          >
            <Settings size={16} />
            Settings
          </button>
        </div>
      </div>
      
      {/* System Overview */}
      <div className="system-overview">
        <div className={`status-card overall-status status-${overallStatus}`}>
          <div className="status-icon" style={{ color: getStatusColor(overallStatus) }}>
            {getStatusIcon(overallStatus)}
          </div>
          <div className="status-content">
            <h2>System Status</h2>
            <p className="status-text">{overallStatus.toUpperCase()}</p>
            {systemHealth && (
              <p className="status-subtitle">
                {services.filter(s => s.status === 'healthy').length} of {services.length} services healthy
              </p>
            )}
          </div>
        </div>
        
        <div className="metrics-summary">
          <div className="metric-card">
            <h3>Active Alerts</h3>
            <div className="metric-value">{activeAlerts.length}</div>
            <div className="metric-breakdown">
              {Object.entries(alertsBySeverity).map(([severity, alerts]) => (
                <span key={severity} className={`severity-count severity-${severity}`}>
                  {alerts.length} {severity}
                </span>
              ))}
            </div>
          </div>
          
          <div className="metric-card">
            <h3>Avg Response Time</h3>
            <div className="metric-value">
              {services.length > 0 
                ? Math.round(services.reduce((sum, s) => sum + s.latency, 0) / services.length)
                : 0
              }ms
            </div>
            <div className="metric-trend">
              <TrendingUp size={12} />
              <span>+12ms from last hour</span>
            </div>
          </div>
          
          <div className="metric-card">
            <h3>Overall Uptime</h3>
            <div className="metric-value">
              {services.length > 0 
                ? (services.reduce((sum, s) => sum + s.uptime, 0) / services.length).toFixed(1)
                : 0
              }%
            </div>
            <div className="metric-trend positive">
              <TrendingUp size={12} />
              <span>+0.2% from yesterday</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div className="alerts-section">
          <h2>Active Alerts ({activeAlerts.length})</h2>
          <div className="alerts-list">
            {activeAlerts.map(alert => (
              <div key={alert.id} className={`alert-item severity-${alert.severity}`}>
                <div className="alert-icon">
                  <AlertTriangle size={16} />
                </div>
                <div className="alert-content">
                  <div className="alert-header">
                    <h4>{alert.service}</h4>
                    <span className="alert-time">{alert.timestamp.toLocaleTimeString()}</span>
                  </div>
                  <p className="alert-message">{alert.message}</p>
                </div>
                <div className="alert-actions">
                  {!alert.acknowledged && (
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="acknowledge-button"
                    >
                      Acknowledge
                    </button>
                  )}
                  <button
                    onClick={() => resolveAlert(alert.id)}
                    className="resolve-button"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Services Grid */}
      <div className="services-section">
        <h2>Services ({services.length})</h2>
        <div className="services-grid">
          {services.map(service => (
            <div
              key={service.service}
              className={`service-card status-${service.status} ${
                selectedService === service.service ? 'selected' : ''
              }`}
              onClick={() => setSelectedService(
                selectedService === service.service ? null : service.service
              )}
            >
              <div className="service-header">
                <div className="service-icon" style={{ color: getStatusColor(service.status) }}>
                  {getStatusIcon(service.status)}
                </div>
                <div className="service-info">
                  <h3>{service.service}</h3>
                  <p className="service-status">{service.status}</p>
                </div>
                <button className="expand-button">
                  <Eye size={14} />
                </button>
              </div>
              
              <div className="service-metrics">
                <div className="metric">
                  <span className="metric-label">Latency</span>
                  <span className="metric-value">{service.latency}ms</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Uptime</span>
                  <span className="metric-value">{service.uptime}%</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Last Check</span>
                  <span className="metric-value">
                    {new Date(service.lastCheck).toLocaleTimeString()}
                  </span>
                </div>
              </div>
              
              {service.errors && service.errors.length > 0 && (
                <div className="service-errors">
                  <h4>Recent Errors:</h4>
                  <ul>
                    {service.errors.slice(0, 3).map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {selectedService === service.service && showDetails && (
                <div className="service-details">
                  <div className="details-grid">
                    <div className="detail-item">
                      <span className="detail-label">Endpoint</span>
                      <span className="detail-value">
                        {SERVICE_ENDPOINTS[service.service as keyof typeof SERVICE_ENDPOINTS] || 'N/A'}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Memory Usage</span>
                      <span className="detail-value">142 MB</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">CPU Usage</span>
                      <span className="detail-value">23%</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Requests/min</span>
                      <span className="detail-value">1,247</span>
                    </div>
                  </div>
                  
                  <div className="service-actions">
                    <button className="action-button">
                      <BarChart3 size={14} />
                      View Metrics
                    </button>
                    <button className="action-button">
                      <Activity size={14} />
                      View Logs
                    </button>
                    <button className="action-button danger">
                      <RefreshCw size={14} />
                      Restart
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Settings Panel */}
      {showSettings && (
        <div className="settings-panel">
          <div className="settings-header">
            <h3>Dashboard Settings</h3>
            <button
              onClick={() => setShowSettings(false)}
              className="close-button"
            >
              ×
            </button>
          </div>
          
          <div className="settings-content">
            <div className="setting-group">
              <h4>Auto Refresh</h4>
              <label className="setting-item">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                <span>Enable auto refresh</span>
              </label>
              <div className="setting-item">
                <label>Refresh interval (seconds):</label>
                <input
                  type="number"
                  value={refreshInterval / 1000}
                  onChange={(e) => setRefreshInterval(Number(e.target.value) * 1000)}
                  min="5"
                  max="300"
                />
              </div>
            </div>
            
            <div className="setting-group">
              <h4>Display Options</h4>
              <label className="setting-item">
                <input
                  type="checkbox"
                  checked={showDetails}
                  onChange={(e) => setShowDetails(e.target.checked)}
                />
                <span>Show service details</span>
              </label>
            </div>
            
            <div className="setting-group">
              <h4>Alert Rules</h4>
              <div className="alert-rules-list">
                {alertRules.map(rule => (
                  <div key={rule.id} className="alert-rule-item">
                    <label className="setting-item">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(e) => {
                          setAlertRules(prev => prev.map(r => 
                            r.id === rule.id ? { ...r, enabled: e.target.checked } : r
                          ));
                        }}
                      />
                      <span>{rule.service} {rule.metric} {rule.operator} {rule.threshold}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};