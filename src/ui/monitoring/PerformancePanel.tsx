/**
 * Performance Monitoring Panel
 * API response times, throughput, and error rates
 */

import React, { useMemo, useState } from 'react';
import type { PerformanceMetric, MonitoringMetric } from '../../services/MonitoringService.js';
import { MetricsChart } from './MetricsChart.js';

interface PerformancePanelProps {
  performanceData: PerformanceMetric[];
  metrics: MonitoringMetric[];
}

interface EndpointStats {
  endpoint: string;
  totalRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  errorCount: number;
  errorRate: number;
  recentRequests: PerformanceMetric[];
}

export const PerformancePanel: React.FC<PerformancePanelProps> = ({
  performanceData,
  metrics
}) => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('all');
  const [timeWindow, setTimeWindow] = useState<number>(300000); // 5 minutes default

  // Calculate endpoint statistics
  const endpointStats = useMemo(() => {
    const now = Date.now();
    const cutoffTime = now - timeWindow;

    // Filter recent data
    const recentData = performanceData.filter(p => 
      new Date(p.timestamp).getTime() > cutoffTime
    );

    // Group by endpoint
    const grouped = new Map<string, PerformanceMetric[]>();
    recentData.forEach(perf => {
      const key = `${perf.method} ${perf.endpoint}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(perf);
    });

    // Calculate stats for each endpoint
    const stats: EndpointStats[] = [];
    for (const [endpointKey, requests] of grouped.entries()) {
      const responseTimes = requests.map(r => r.responseTime);
      const errorCount = requests.filter(r => r.error || r.statusCode >= 400).length;

      stats.push({
        endpoint: endpointKey,
        totalRequests: requests.length,
        averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
        minResponseTime: Math.min(...responseTimes),
        maxResponseTime: Math.max(...responseTimes),
        errorCount,
        errorRate: requests.length > 0 ? (errorCount / requests.length) * 100 : 0,
        recentRequests: requests.slice(-10) // Last 10 requests
      });
    }

    return stats.sort((a, b) => b.totalRequests - a.totalRequests);
  }, [performanceData, timeWindow]);

  // Overall performance stats
  const overallStats = useMemo(() => {
    const now = Date.now();
    const cutoffTime = now - timeWindow;
    const recentData = performanceData.filter(p => 
      new Date(p.timestamp).getTime() > cutoffTime
    );

    if (recentData.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        throughput: 0,
        errorRate: 0,
        slowRequests: 0
      };
    }

    const responseTimes = recentData.map(r => r.responseTime);
    const errorCount = recentData.filter(r => r.error || r.statusCode >= 400).length;
    const slowRequests = recentData.filter(r => r.responseTime > 1000).length;

    return {
      totalRequests: recentData.length,
      averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      throughput: (recentData.length / (timeWindow / 1000)) * 60, // requests per minute
      errorRate: (errorCount / recentData.length) * 100,
      slowRequests
    };
  }, [performanceData, timeWindow]);

  // Filter data for selected endpoint
  const filteredData = useMemo(() => {
    if (selectedEndpoint === 'all') return performanceData;
    return performanceData.filter(p => `${p.method} ${p.endpoint}` === selectedEndpoint);
  }, [performanceData, selectedEndpoint]);

  // Convert performance data to metrics for charting
  const chartMetrics = useMemo(() => {
    return filteredData.map((perf, index) => ({
      id: `${index}`,
      name: 'response_time',
      value: perf.responseTime,
      timestamp: perf.timestamp,
      tags: {
        endpoint: perf.endpoint,
        method: perf.method,
        status: perf.statusCode.toString()
      },
      type: 'timer' as const,
      unit: 'ms'
    }));
  }, [filteredData]);

  const getStatusColor = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) return '#4CAF50';
    if (statusCode >= 300 && statusCode < 400) return '#2196F3';
    if (statusCode >= 400 && statusCode < 500) return '#FF9800';
    if (statusCode >= 500) return '#F44336';
    return '#9E9E9E';
  };

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return '#4CAF50';
      case 'POST': return '#2196F3';
      case 'PUT': return '#FF9800';
      case 'DELETE': return '#F44336';
      case 'PATCH': return '#9C27B0';
      default: return '#9E9E9E';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 10000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatThroughput = (requestsPerMinute: number) => {
    if (requestsPerMinute < 1) return `${(requestsPerMinute * 60).toFixed(1)}/min`;
    return `${requestsPerMinute.toFixed(1)}/min`;
  };

  return (
    <div className="performance-panel">
      <div className="performance-header">
        <h2>⚡ API Performance Monitor</h2>
        
        <div className="performance-controls">
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
            <label>Endpoint:</label>
            <select 
              value={selectedEndpoint} 
              onChange={(e) => setSelectedEndpoint(e.target.value)}
            >
              <option value="all">All Endpoints</option>
              {endpointStats.map(stat => (
                <option key={stat.endpoint} value={stat.endpoint}>
                  {stat.endpoint} ({stat.totalRequests})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Overall Performance Stats */}
      <div className="performance-overview">
        <div className="perf-stat-card">
          <div className="perf-stat-icon">📊</div>
          <div className="perf-stat-content">
            <div className="perf-stat-value">{overallStats.totalRequests}</div>
            <div className="perf-stat-label">Total Requests</div>
          </div>
        </div>
        
        <div className="perf-stat-card">
          <div className="perf-stat-icon">⚡</div>
          <div className="perf-stat-content">
            <div className="perf-stat-value">{formatDuration(overallStats.averageResponseTime)}</div>
            <div className="perf-stat-label">Avg Response</div>
          </div>
        </div>
        
        <div className="perf-stat-card">
          <div className="perf-stat-icon">🔄</div>
          <div className="perf-stat-content">
            <div className="perf-stat-value">{formatThroughput(overallStats.throughput)}</div>
            <div className="perf-stat-label">Throughput</div>
          </div>
        </div>
        
        <div className={`perf-stat-card ${overallStats.errorRate > 5 ? 'error' : ''}`}>
          <div className="perf-stat-icon">❌</div>
          <div className="perf-stat-content">
            <div className="perf-stat-value">{overallStats.errorRate.toFixed(1)}%</div>
            <div className="perf-stat-label">Error Rate</div>
          </div>
        </div>
        
        <div className={`perf-stat-card ${overallStats.slowRequests > 0 ? 'warning' : ''}`}>
          <div className="perf-stat-icon">🐌</div>
          <div className="perf-stat-content">
            <div className="perf-stat-value">{overallStats.slowRequests}</div>
            <div className="perf-stat-label">Slow Requests</div>
          </div>
        </div>
      </div>

      {/* Performance Chart */}
      <div className="performance-chart-container">
        <MetricsChart
          metrics={chartMetrics}
          title="Response Time Trends"
          height={300}
          metricNames={['response_time']}
          showLegend={false}
        />
      </div>

      {/* Endpoint Details and Recent Requests */}
      <div className="performance-details">
        <div className="endpoint-stats">
          <h3>📈 Endpoint Statistics</h3>
          <div className="endpoint-list">
            {endpointStats.length === 0 ? (
              <div className="no-data">No performance data available</div>
            ) : (
              endpointStats.map(stat => (
                <div key={stat.endpoint} className="endpoint-item">
                  <div className="endpoint-header">
                    <span className="endpoint-name">{stat.endpoint}</span>
                    <div className="endpoint-badges">
                      <span className="request-count">{stat.totalRequests} requests</span>
                      {stat.errorRate > 0 && (
                        <span className="error-badge">{stat.errorRate.toFixed(1)}% errors</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="endpoint-metrics">
                    <div className="metric-item">
                      <span className="metric-label">Avg:</span>
                      <span className="metric-value">{formatDuration(stat.averageResponseTime)}</span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-label">Min:</span>
                      <span className="metric-value">{formatDuration(stat.minResponseTime)}</span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-label">Max:</span>
                      <span className="metric-value">{formatDuration(stat.maxResponseTime)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="recent-requests">
          <h3>📝 Recent Requests</h3>
          <div className="request-log">
            {filteredData.length === 0 ? (
              <div className="no-data">No requests to display</div>
            ) : (
              filteredData.slice(-20).reverse().map((request, index) => (
                <div key={index} className="request-entry">
                  <div className="request-time">
                    {new Date(request.timestamp).toLocaleTimeString()}
                  </div>
                  
                  <div className="request-details">
                    <span 
                      className="request-method"
                      style={{ backgroundColor: getMethodColor(request.method) }}
                    >
                      {request.method}
                    </span>
                    
                    <span className="request-endpoint">{request.endpoint}</span>
                    
                    <span 
                      className="request-status"
                      style={{ color: getStatusColor(request.statusCode) }}
                    >
                      {request.statusCode}
                    </span>
                  </div>
                  
                  <div className="request-timing">
                    <span className={`response-time ${request.responseTime > 1000 ? 'slow' : ''}`}>
                      {formatDuration(request.responseTime)}
                    </span>
                  </div>
                  
                  {request.error && (
                    <div className="request-error">
                      Error: {request.error}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};