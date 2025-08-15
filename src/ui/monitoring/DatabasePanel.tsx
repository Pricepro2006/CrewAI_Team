/**
 * Database Monitoring Panel
 * Query performance, slow queries, and database health
 */

import React, { useMemo, useState } from 'react';
import type { DatabaseQuery, MonitoringMetric } from '../../services/MonitoringService.js';
import { MetricsChart } from './MetricsChart.js';

interface DatabasePanelProps {
  queries: DatabaseQuery[];
  metrics: MonitoringMetric[];
}

interface DatabaseStats {
  database: string;
  totalQueries: number;
  averageTime: number;
  slowQueries: number;
  errorCount: number;
  recentQueries: DatabaseQuery[];
}

export const DatabasePanel: React.FC<DatabasePanelProps> = ({
  queries,
  metrics
}) => {
  const [selectedDatabase, setSelectedDatabase] = useState<string>('all');
  const [slowQueryThreshold, setSlowQueryThreshold] = useState<number>(100); // 100ms
  const [timeWindow, setTimeWindow] = useState<number>(300000); // 5 minutes

  // Calculate database statistics
  const databaseStats = useMemo(() => {
    const now = Date.now();
    const cutoffTime = now - timeWindow;

    // Filter recent queries
    const recentQueries = queries.filter(q => 
      new Date(q.timestamp).getTime() > cutoffTime
    );

    // Group by database
    const grouped = new Map<string, DatabaseQuery[]>();
    recentQueries.forEach(query => {
      if (!grouped.has(query.database)) {
        grouped.set(query.database, []);
      }
      grouped.get(query.database)!.push(query);
    });

    // Calculate stats for each database
    const stats: DatabaseStats[] = [];
    for (const [database, dbQueries] of grouped.entries()) {
      const executionTimes = dbQueries.map(q => q.executionTime);
      const slowQueries = dbQueries.filter(q => q.executionTime > slowQueryThreshold);
      const errorCount = dbQueries.filter(q => q.error).length;

      stats.push({
        database,
        totalQueries: dbQueries.length,
        averageTime: executionTimes.length > 0 ? 
          executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length : 0,
        slowQueries: slowQueries.length,
        errorCount,
        recentQueries: dbQueries.slice(-10) // Last 10 queries
      });
    }

    return stats.sort((a, b) => b.totalQueries - a.totalQueries);
  }, [queries, timeWindow, slowQueryThreshold]);

  // Overall database performance
  const overallStats = useMemo(() => {
    const now = Date.now();
    const cutoffTime = now - timeWindow;
    const recentQueries = queries.filter(q => 
      new Date(q.timestamp).getTime() > cutoffTime
    );

    if (recentQueries.length === 0) {
      return {
        totalQueries: 0,
        averageTime: 0,
        slowQueries: 0,
        errorCount: 0,
        qps: 0 // queries per second
      };
    }

    const executionTimes = recentQueries.map(q => q.executionTime);
    const slowQueries = recentQueries.filter(q => q.executionTime > slowQueryThreshold);
    const errorCount = recentQueries.filter(q => q.error).length;

    return {
      totalQueries: recentQueries.length,
      averageTime: executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length,
      slowQueries: slowQueries.length,
      errorCount,
      qps: recentQueries.length / (timeWindow / 1000)
    };
  }, [queries, timeWindow, slowQueryThreshold]);

  // Filter queries for selected database
  const filteredQueries = useMemo(() => {
    if (selectedDatabase === 'all') return queries;
    return queries.filter(q => q.database === selectedDatabase);
  }, [queries, selectedDatabase]);

  // Convert query data to metrics for charting
  const chartMetrics = useMemo(() => {
    return filteredQueries.map((query, index) => ({
      id: query.id,
      name: 'query_time',
      value: query.executionTime,
      timestamp: query.timestamp,
      tags: {
        database: query.database,
        error: query.error ? 'true' : 'false'
      },
      type: 'timer' as const,
      unit: 'ms'
    }));
  }, [filteredQueries]);

  const formatDuration = (ms: number) => {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatSQL = (sql: string) => {
    // Basic SQL formatting for readability
    return sql
      .replace(/\bSELECT\b/gi, '\nSELECT')
      .replace(/\bFROM\b/gi, '\nFROM')
      .replace(/\bWHERE\b/gi, '\nWHERE')
      .replace(/\bAND\b/gi, '\n  AND')
      .replace(/\bOR\b/gi, '\n  OR')
      .replace(/\bORDER BY\b/gi, '\nORDER BY')
      .replace(/\bGROUP BY\b/gi, '\nGROUP BY')
      .replace(/\bHAVING\b/gi, '\nHAVING')
      .replace(/\bLIMIT\b/gi, '\nLIMIT')
      .trim();
  };

  const getSeverityColor = (executionTime: number, error?: string) => {
    if (error) return '#F44336';
    if (executionTime > slowQueryThreshold * 10) return '#F44336'; // Very slow
    if (executionTime > slowQueryThreshold) return '#FF9800'; // Slow
    if (executionTime > slowQueryThreshold * 0.5) return '#FFC107'; // Medium
    return '#4CAF50'; // Fast
  };

  return (
    <div className="database-panel">
      <div className="database-header">
        <h2>💾 Database Performance Monitor</h2>
        
        <div className="database-controls">
          <div className="control-group">
            <label>Time Window:</label>
            <select 
              value={timeWindow} 
              onChange={(e) => setTimeWindow(Number(e.target.value))}
            >
              <option value={60000}>1 minute</option>
              <option value={300000}>5 minutes</option>
              <option value={900000}>15 minutes</option>
              <option value={3600000}>1 hour</option>
            </select>
          </div>
          
          <div className="control-group">
            <label>Database:</label>
            <select 
              value={selectedDatabase} 
              onChange={(e) => setSelectedDatabase(e.target.value)}
            >
              <option value="all">All Databases</option>
              {databaseStats.map(stat => (
                <option key={stat.database} value={stat.database}>
                  {stat.database} ({stat.totalQueries})
                </option>
              ))}
            </select>
          </div>
          
          <div className="control-group">
            <label>Slow Query Threshold:</label>
            <select 
              value={slowQueryThreshold} 
              onChange={(e) => setSlowQueryThreshold(Number(e.target.value))}
            >
              <option value={50}>50ms</option>
              <option value={100}>100ms</option>
              <option value={200}>200ms</option>
              <option value={500}>500ms</option>
              <option value={1000}>1s</option>
            </select>
          </div>
        </div>
      </div>

      {/* Overall Database Stats */}
      <div className="database-overview">
        <div className="db-stat-card">
          <div className="db-stat-icon">📊</div>
          <div className="db-stat-content">
            <div className="db-stat-value">{overallStats.totalQueries}</div>
            <div className="db-stat-label">Total Queries</div>
          </div>
        </div>
        
        <div className="db-stat-card">
          <div className="db-stat-icon">⚡</div>
          <div className="db-stat-content">
            <div className="db-stat-value">{formatDuration(overallStats.averageTime)}</div>
            <div className="db-stat-label">Avg Time</div>
          </div>
        </div>
        
        <div className="db-stat-card">
          <div className="db-stat-icon">🔄</div>
          <div className="db-stat-content">
            <div className="db-stat-value">{overallStats.qps.toFixed(1)}</div>
            <div className="db-stat-label">QPS</div>
          </div>
        </div>
        
        <div className={`db-stat-card ${overallStats.slowQueries > 0 ? 'warning' : ''}`}>
          <div className="db-stat-icon">🐌</div>
          <div className="db-stat-content">
            <div className="db-stat-value">{overallStats.slowQueries}</div>
            <div className="db-stat-label">Slow Queries</div>
          </div>
        </div>
        
        <div className={`db-stat-card ${overallStats.errorCount > 0 ? 'error' : ''}`}>
          <div className="db-stat-icon">❌</div>
          <div className="db-stat-content">
            <div className="db-stat-value">{overallStats.errorCount}</div>
            <div className="db-stat-label">Errors</div>
          </div>
        </div>
      </div>

      {/* Query Performance Chart */}
      <div className="database-chart-container">
        <MetricsChart
          metrics={chartMetrics}
          title="Query Execution Time Trends"
          height={300}
          metricNames={['query_time']}
          showLegend={false}
        />
      </div>

      {/* Database Details and Query Log */}
      <div className="database-details">
        <div className="database-stats">
          <h3>📈 Database Statistics</h3>
          <div className="database-list">
            {databaseStats.length === 0 ? (
              <div className="no-data">No database activity in selected time window</div>
            ) : (
              databaseStats.map(stat => (
                <div key={stat.database} className="database-item">
                  <div className="database-header">
                    <span className="database-name">{stat.database}</span>
                    <div className="database-badges">
                      <span className="query-count">{stat.totalQueries} queries</span>
                      {stat.slowQueries > 0 && (
                        <span className="slow-badge">{stat.slowQueries} slow</span>
                      )}
                      {stat.errorCount > 0 && (
                        <span className="error-badge">{stat.errorCount} errors</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="database-metrics">
                    <div className="metric-item">
                      <span className="metric-label">Avg Time:</span>
                      <span className="metric-value">{formatDuration(stat.averageTime)}</span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-label">QPS:</span>
                      <span className="metric-value">
                        {(stat.totalQueries / (timeWindow / 1000)).toFixed(2)}
                      </span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-label">Slow Rate:</span>
                      <span className="metric-value">
                        {stat.totalQueries > 0 ? 
                          ((stat.slowQueries / stat.totalQueries) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="query-log">
          <h3>📝 Recent Queries</h3>
          <div className="query-list">
            {filteredQueries.length === 0 ? (
              <div className="no-data">No queries to display</div>
            ) : (
              filteredQueries.slice(-20).reverse().map((query) => (
                <div key={query.id} className="query-entry">
                  <div className="query-header">
                    <div className="query-time">
                      {new Date(query.timestamp).toLocaleTimeString()}
                    </div>
                    
                    <div className="query-database-badge">
                      {query.database}
                    </div>
                    
                    <div className="query-metrics">
                      <span 
                        className="query-timing"
                        style={{ 
                          color: getSeverityColor(query.executionTime, query.error),
                          fontWeight: query.executionTime > slowQueryThreshold ? 'bold' : 'normal'
                        }}
                      >
                        {formatDuration(query.executionTime)}
                      </span>
                      
                      {query.rowsAffected !== undefined && (
                        <span className="rows-affected">
                          {query.rowsAffected} rows
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="query-sql">
                    <pre>{formatSQL(query.sql)}</pre>
                  </div>
                  
                  {query.error && (
                    <div className="query-error">
                      <strong>Error:</strong> {query.error}
                    </div>
                  )}
                  
                  {query.executionTime > slowQueryThreshold && (
                    <div className="query-warning">
                      ⚠️ Slow query detected (threshold: {slowQueryThreshold}ms)
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* Query Analysis Tips */}
      <div className="query-tips">
        <h4>💡 Optimization Tips</h4>
        <div className="tips-list">
          <div className="tip-item">
            <span className="tip-icon">🔍</span>
            <span>Look for queries with high execution times or frequent occurrence</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">📊</span>
            <span>Monitor slow queries over time to identify performance regressions</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">⚡</span>
            <span>Consider adding indexes for frequently slow WHERE clauses</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">🔄</span>
            <span>High QPS with slow queries may indicate need for query optimization</span>
          </div>
        </div>
      </div>
    </div>
  );
};