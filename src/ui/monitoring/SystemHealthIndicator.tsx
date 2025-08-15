/**
 * System Health Indicator Component
 * Shows overall system status with key metrics
 */

import React from 'react';
import type { SystemHealth, ServiceHealth } from '../../services/MonitoringService.js';

interface SystemHealthIndicatorProps {
  health: SystemHealth;
  stats: {
    totalConnections: number;
    activeConnections: number;
    totalMetrics: number;
    recentErrors: number;
  };
}

export const SystemHealthIndicator: React.FC<SystemHealthIndicatorProps> = ({
  health,
  stats
}) => {
  const getHealthColor = (status: SystemHealth['status']) => {
    switch (status) {
      case 'healthy': return '#4CAF50';
      case 'degraded': return '#FF9800';
      case 'critical': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getHealthIcon = (status: SystemHealth['status']) => {
    switch (status) {
      case 'healthy': return '✅';
      case 'degraded': return '⚠️';
      case 'critical': return '🚨';
      default: return '❓';
    }
  };

  const formatMemory = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatCPU = (usage: number) => {
    return `${(usage * 100).toFixed(1)}%`;
  };

  const getMemoryStatus = (memoryBytes: number) => {
    const memoryMB = memoryBytes / (1024 * 1024);
    if (memoryMB > 500) return 'critical';
    if (memoryMB > 300) return 'degraded';
    return 'healthy';
  };

  const getConnectionStatus = (active: number, total: number) => {
    if (total === 0) return 'degraded';
    const ratio = active / total;
    if (ratio < 0.5) return 'degraded';
    return 'healthy';
  };

  return (
    <div className="system-health-indicator">
      <div className="health-main">
        <div className="health-status">
          <div className="health-icon">
            {getHealthIcon(health.status)}
          </div>
          <div className="health-text">
            <div className="health-label">System Status</div>
            <div 
              className="health-value"
              style={{ color: getHealthColor(health.status) }}
            >
              {health.status.toUpperCase()}
            </div>
          </div>
        </div>

        <div className="health-metrics">
          <div className="health-metric">
            <div className="metric-icon">💾</div>
            <div className="metric-content">
              <div className="metric-label">Memory</div>
              <div 
                className={`metric-value ${getMemoryStatus(health.metrics.memory)}`}
              >
                {formatMemory(health.metrics.memory)}
              </div>
            </div>
          </div>

          <div className="health-metric">
            <div className="metric-icon">🖥️</div>
            <div className="metric-content">
              <div className="metric-label">CPU</div>
              <div className="metric-value">
                {formatCPU(health.metrics.cpu)}
              </div>
            </div>
          </div>

          <div className="health-metric">
            <div className="metric-icon">🔌</div>
            <div className="metric-content">
              <div className="metric-label">Connections</div>
              <div 
                className={`metric-value ${getConnectionStatus(stats.activeConnections, stats.totalConnections)}`}
              >
                {stats.activeConnections}/{stats.totalConnections}
              </div>
            </div>
          </div>

          <div className="health-metric">
            <div className="metric-icon">📊</div>
            <div className="metric-content">
              <div className="metric-label">Metrics</div>
              <div className="metric-value">
                {stats.totalMetrics.toLocaleString()}
              </div>
            </div>
          </div>

          {stats.recentErrors > 0 && (
            <div className="health-metric error">
              <div className="metric-icon">❌</div>
              <div className="metric-content">
                <div className="metric-label">Recent Errors</div>
                <div className="metric-value critical">
                  {stats.recentErrors}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Service Health Details */}
      <div className="service-health">
        <div className="service-health-title">Services:</div>
        <div className="service-health-list">
          {Object.entries(health.services).map(([serviceName, serviceHealth]: [string, ServiceHealth]) => (
            <div key={serviceName} className="service-health-item">
              <div 
                className="service-indicator"
                style={{ backgroundColor: getHealthColor(serviceHealth.status) }}
                title={`${serviceName}: ${serviceHealth.status}`}
              ></div>
              <span className="service-name">{serviceName}</span>
              {serviceHealth.responseTime !== undefined && (
                <span className="service-timing">
                  {serviceHealth.responseTime}ms
                </span>
              )}
              {serviceHealth.error && (
                <span className="service-error" title={serviceHealth.error}>
                  ⚠️
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Health Summary */}
      <div className="health-summary">
        <div className="summary-item">
          <span className="summary-label">Services:</span>
          <span className="summary-value">
            {Object.values(health.services).filter((s: ServiceHealth) => s.status === 'healthy').length}/
            {Object.values(health.services).length} healthy
          </span>
        </div>
        
        <div className="summary-item">
          <span className="summary-label">Last Check:</span>
          <span className="summary-value">
            {new Date(health.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
};