/**
 * Alerts Management Panel
 * Display and manage monitoring alerts
 */

import React, { useState, useMemo } from 'react';
import type { MonitoringAlert } from '../../services/MonitoringService.js';

interface AlertsPanelProps {
  alerts: MonitoringAlert[];
  onAcknowledge: (alertId: string) => void;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({ 
  alerts, 
  onAcknowledge 
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'acknowledged'>('active');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'performance' | 'error' | 'connection' | 'health'>('all');

  // Filter alerts based on current filters
  const filteredAlerts = useMemo(() => {
    return alerts?.filter(alert => {
      if (filter === 'active' && alert.acknowledged) return false;
      if (filter === 'acknowledged' && !alert.acknowledged) return false;
      if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
      if (typeFilter !== 'all' && alert.type !== typeFilter) return false;
      return true;
    }).sort((a, b) => {
      // Sort by severity, then by timestamp
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [alerts, filter, severityFilter, typeFilter]);

  // Alert statistics
  const alertStats = useMemo(() => {
    const stats = {
      total: alerts?.length || 0,
      active: alerts?.filter(a => !a.acknowledged).length,
      acknowledged: alerts?.filter(a => a.acknowledged).length,
      critical: alerts?.filter(a => a.severity === 'critical' && !a.acknowledged).length,
      high: alerts?.filter(a => a.severity === 'high' && !a.acknowledged).length,
      medium: alerts?.filter(a => a.severity === 'medium' && !a.acknowledged).length,
      low: alerts?.filter(a => a.severity === 'low' && !a.acknowledged).length,
      byType: {
        performance: alerts?.filter(a => a.type === 'performance' && !a.acknowledged).length,
        error: alerts?.filter(a => a.type === 'error' && !a.acknowledged).length,
        connection: alerts?.filter(a => a.type === 'connection' && !a.acknowledged).length,
        health: alerts?.filter(a => a.type === 'health' && !a.acknowledged).length,
      }
    };
    return stats;
  }, [alerts]);

  const getSeverityIcon = (severity: MonitoringAlert['severity']) => {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '🟡';
      case 'low': return '🔵';
      default: return '❓';
    }
  };

  const getTypeIcon = (type: MonitoringAlert['type']) => {
    switch (type) {
      case 'performance': return '⚡';
      case 'error': return '❌';
      case 'connection': return '🔌';
      case 'health': return '❤️';
      default: return '❓';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getSeverityColor = (severity: MonitoringAlert['severity']) => {
    switch (severity) {
      case 'critical': return '#F44336';
      case 'high': return '#FF5722';
      case 'medium': return '#FF9800';
      case 'low': return '#4CAF50';
      default: return '#9E9E9E';
    }
  };

  return (
    <div className="alerts-panel">
      <div className="alerts-header">
        <h2>🚨 Alert Management</h2>
        
        <div className="alerts-controls">
          <div className="control-group">
            <label>Status:</label>
            <select value={filter} onChange={(e: any) => setFilter(e?.target?.value as any)}>
              <option value="all">All Alerts ({alertStats.total})</option>
              <option value="active">Active ({alertStats.active})</option>
              <option value="acknowledged">Acknowledged ({alertStats.acknowledged})</option>
            </select>
          </div>
          
          <div className="control-group">
            <label>Severity:</label>
            <select value={severityFilter} onChange={(e: any) => setSeverityFilter(e?.target?.value as any)}>
              <option value="all">All Severities</option>
              <option value="critical">Critical ({alertStats.critical})</option>
              <option value="high">High ({alertStats.high})</option>
              <option value="medium">Medium ({alertStats.medium})</option>
              <option value="low">Low ({alertStats.low})</option>
            </select>
          </div>
          
          <div className="control-group">
            <label>Type:</label>
            <select value={typeFilter} onChange={(e: any) => setTypeFilter(e?.target?.value as any)}>
              <option value="all">All Types</option>
              <option value="performance">Performance ({alertStats?.byType?.performance})</option>
              <option value="error">Error ({alertStats?.byType?.error})</option>
              <option value="connection">Connection ({alertStats?.byType?.connection})</option>
              <option value="health">Health ({alertStats?.byType?.health})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alert Statistics */}
      <div className="alerts-overview">
        <div className="alert-stat-card critical">
          <div className="alert-stat-icon">🚨</div>
          <div className="alert-stat-content">
            <div className="alert-stat-value">{alertStats.critical}</div>
            <div className="alert-stat-label">Critical</div>
          </div>
        </div>
        
        <div className="alert-stat-card high">
          <div className="alert-stat-icon">⚠️</div>
          <div className="alert-stat-content">
            <div className="alert-stat-value">{alertStats.high}</div>
            <div className="alert-stat-label">High</div>
          </div>
        </div>
        
        <div className="alert-stat-card medium">
          <div className="alert-stat-icon">🟡</div>
          <div className="alert-stat-content">
            <div className="alert-stat-value">{alertStats.medium}</div>
            <div className="alert-stat-label">Medium</div>
          </div>
        </div>
        
        <div className="alert-stat-card low">
          <div className="alert-stat-icon">🔵</div>
          <div className="alert-stat-content">
            <div className="alert-stat-value">{alertStats.low}</div>
            <div className="alert-stat-label">Low</div>
          </div>
        </div>
        
        <div className="alert-stat-card total">
          <div className="alert-stat-icon">📊</div>
          <div className="alert-stat-content">
            <div className="alert-stat-value">{alertStats.active}</div>
            <div className="alert-stat-label">Active</div>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="alerts-list">
        {filteredAlerts?.length || 0 === 0 ? (
          <div className="no-alerts">
            {filter === 'active' ? (
              <div className="no-alerts-content">
                <div className="no-alerts-icon">✅</div>
                <h3>All Good!</h3>
                <p>No active alerts at the moment. Your system is running smoothly.</p>
              </div>
            ) : (
              <div className="no-alerts-content">
                <div className="no-alerts-icon">🔍</div>
                <h3>No Alerts Found</h3>
                <p>No alerts match your current filters.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="alert-items">
            {filteredAlerts?.map(alert => (
              <div 
                key={alert.id} 
                className={`alert-item ${alert.severity} ${alert.acknowledged ? 'acknowledged' : ''}`}
              >
                <div className="alert-main">
                  <div className="alert-header">
                    <div className="alert-icons">
                      <span className="severity-icon">
                        {getSeverityIcon(alert.severity)}
                      </span>
                      <span className="type-icon">
                        {getTypeIcon(alert.type)}
                      </span>
                    </div>
                    
                    <div className="alert-title">
                      <span className="alert-message">{alert.message}</span>
                      <div className="alert-badges">
                        <span 
                          className="severity-badge"
                          style={{ backgroundColor: getSeverityColor(alert.severity) }}
                        >
                          {alert?.severity?.toUpperCase()}
                        </span>
                        <span className="type-badge">
                          {alert.type}
                        </span>
                      </div>
                    </div>
                    
                    <div className="alert-actions">
                      {!alert.acknowledged && (
                        <button 
                          className="acknowledge-btn"
                          onClick={() => onAcknowledge(alert.id)}
                          title="Acknowledge Alert"
                        >
                          ✓ Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="alert-footer">
                    <div className="alert-timestamp">
                      {formatTimestamp(alert.timestamp)}
                    </div>
                    
                    {alert.acknowledged && (
                      <div className="acknowledged-indicator">
                        ✓ Acknowledged
                      </div>
                    )}
                  </div>
                </div>
                
                {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                  <div className="alert-metadata">
                    <div className="metadata-toggle">
                      <details>
                        <summary>View Details</summary>
                        <div className="metadata-content">
                          {Object.entries(alert.metadata).map(([key, value]) => (
                            <div key={key} className="metadata-row">
                              <span className="metadata-key">{key}:</span>
                              <span className="metadata-value">
                                {typeof value === 'object' 
                                  ? JSON.stringify(value, null, 2)
                                  : String(value)
                                }
                              </span>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Alert Management Tips */}
      {alertStats.active > 0 && (
        <div className="alert-tips">
          <h4>💡 Alert Management Tips</h4>
          <div className="tips-grid">
            <div className="tip-item">
              <span className="tip-icon">🚨</span>
              <span>Address critical and high-priority alerts first</span>
            </div>
            <div className="tip-item">
              <span className="tip-icon">🔄</span>
              <span>Acknowledge alerts after investigating to keep the list clean</span>
            </div>
            <div className="tip-item">
              <span className="tip-icon">📊</span>
              <span>Monitor alert patterns to identify recurring issues</span>
            </div>
            <div className="tip-item">
              <span className="tip-icon">⚙️</span>
              <span>Adjust alert thresholds if getting too many false positives</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Real-time Indicator */}
      <div className="alerts-footer">
        <div className="realtime-indicator">
          <span className="pulse-dot"></span>
          <span>Real-time alerts • Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};