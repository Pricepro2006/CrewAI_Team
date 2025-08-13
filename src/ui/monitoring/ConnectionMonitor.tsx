/**
 * Connection Monitor Component
 * Real-time display of WebSocket and HTTP connections
 */

import React, { useState, useMemo } from 'react';
import { ConnectionInfo } from '../../services/MonitoringService';

interface ConnectionMonitorProps {
  connections: ConnectionInfo[];
}

interface ConnectionStats {
  total: number;
  active: number;
  websocket: number;
  http: number;
  database: number;
  disconnected: number;
  errors: number;
}

export const ConnectionMonitor: React.FC<ConnectionMonitorProps> = ({ connections }) => {
  const [filter, setFilter] = useState<'all' | 'websocket' | 'http' | 'database'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'connected' | 'disconnected' | 'error'>('all');

  // Calculate connection statistics
  const stats: ConnectionStats = useMemo(() => {
    return connections.reduce((acc, conn) => {
      acc.total++;
      
      if (conn.status === 'connected') acc.active++;
      if (conn.status === 'disconnected') acc.disconnected++;
      if (conn.status === 'error') acc.errors++;
      
      if (conn.type === 'websocket') acc.websocket++;
      if (conn.type === 'http') acc.http++;
      if (conn.type === 'database') acc.database++;
      
      return acc;
    }, {
      total: 0,
      active: 0,
      websocket: 0,
      http: 0,
      database: 0,
      disconnected: 0,
      errors: 0
    });
  }, [connections]);

  // Filter connections
  const filteredConnections = useMemo(() => {
    return connections.filter(conn => {
      if (filter !== 'all' && conn.type !== filter) return false;
      if (statusFilter !== 'all' && conn.status !== statusFilter) return false;
      return true;
    });
  }, [connections, filter, statusFilter]);

  const getConnectionIcon = (type: ConnectionInfo['type']) => {
    switch (type) {
      case 'websocket': return '🔌';
      case 'http': return '🌐';
      case 'database': return '💾';
      default: return '❓';
    }
  };

  const getStatusIcon = (status: ConnectionInfo['status']) => {
    switch (status) {
      case 'connected': return '✅';
      case 'disconnected': return '⚪';
      case 'error': return '❌';
      default: return '❓';
    }
  };

  const getStatusColor = (status: ConnectionInfo['status']) => {
    switch (status) {
      case 'connected': return '#4CAF50';
      case 'disconnected': return '#9E9E9E';
      case 'error': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const formatDuration = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diff = now.getTime() - then.getTime();
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatLastActivity = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diff = now.getTime() - then.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div className="connection-monitor">
      <div className="connection-header">
        <h2>🔌 Connection Monitor</h2>
        
        <div className="connection-controls">
          <div className="filter-group">
            <label>Type:</label>
            <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
              <option value="all">All Types ({stats.total})</option>
              <option value="websocket">WebSocket ({stats.websocket})</option>
              <option value="http">HTTP ({stats.http})</option>
              <option value="database">Database ({stats.database})</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Status:</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
              <option value="all">All Status</option>
              <option value="connected">Connected ({stats.active})</option>
              <option value="disconnected">Disconnected ({stats.disconnected})</option>
              <option value="error">Error ({stats.errors})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Connection Statistics */}
      <div className="connection-stats">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total</div>
          </div>
        </div>
        
        <div className="stat-card active">
          <div className="stat-icon">🟢</div>
          <div className="stat-content">
            <div className="stat-value">{stats.active}</div>
            <div className="stat-label">Active</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">🔌</div>
          <div className="stat-content">
            <div className="stat-value">{stats.websocket}</div>
            <div className="stat-label">WebSocket</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">🌐</div>
          <div className="stat-content">
            <div className="stat-value">{stats.http}</div>
            <div className="stat-label">HTTP</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">💾</div>
          <div className="stat-content">
            <div className="stat-value">{stats.database}</div>
            <div className="stat-label">Database</div>
          </div>
        </div>
        
        {stats.errors > 0 && (
          <div className="stat-card error">
            <div className="stat-icon">❌</div>
            <div className="stat-content">
              <div className="stat-value">{stats.errors}</div>
              <div className="stat-label">Errors</div>
            </div>
          </div>
        )}
      </div>

      {/* Connection List */}
      <div className="connection-list">
        {filteredConnections.length === 0 ? (
          <div className="no-connections">
            <p>No connections match the current filters</p>
          </div>
        ) : (
          filteredConnections.map(connection => (
            <div 
              key={connection.id} 
              className={`connection-item ${connection.status}`}
            >
              <div className="connection-main">
                <div className="connection-info">
                  <div className="connection-header-row">
                    <span className="connection-icon">
                      {getConnectionIcon(connection.type)}
                    </span>
                    <span className="connection-id">{connection.id}</span>
                    <span className="connection-type-badge">{connection.type}</span>
                  </div>
                  
                  <div className="connection-details">
                    <span className="connection-status">
                      {getStatusIcon(connection.status)}
                      <span style={{ color: getStatusColor(connection.status) }}>
                        {connection.status.toUpperCase()}
                      </span>
                    </span>
                    
                    <span className="connection-duration">
                      Connected: {formatDuration(connection.connectedAt)}
                    </span>
                    
                    <span className="connection-activity">
                      Last activity: {formatLastActivity(connection.lastActivity)}
                    </span>
                  </div>
                </div>
                
                {connection.metadata && Object.keys(connection.metadata).length > 0 && (
                  <div className="connection-metadata">
                    <div className="metadata-header">Metadata:</div>
                    <div className="metadata-content">
                      {Object.entries(connection.metadata).map(([key, value]) => (
                        <div key={key} className="metadata-item">
                          <span className="metadata-key">{key}:</span>
                          <span className="metadata-value">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {connection.status === 'error' && connection.metadata?.error && (
                  <div className="connection-error">
                    <div className="error-header">Error:</div>
                    <div className="error-message">{connection.metadata.error}</div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Real-time Updates Indicator */}
      <div className="realtime-indicator">
        <span className="pulse-dot"></span>
        <span>Real-time updates • Last updated: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
};