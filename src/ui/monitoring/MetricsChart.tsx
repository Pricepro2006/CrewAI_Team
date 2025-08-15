/**
 * Interactive Metrics Chart Component
 * Displays time-series data with hover details and zoom functionality
 */

import React, { useRef, useEffect, useState } from 'react';
import type { MonitoringMetric } from '../../services/MonitoringService.js';

interface MetricsChartProps {
  metrics: MonitoringMetric[];
  title: string;
  height?: number;
  metricNames?: string[];
  showLegend?: boolean;
}

interface ChartPoint {
  x: number;
  y: number;
  metric: MonitoringMetric;
}

interface ChartSeries {
  name: string;
  color: string;
  points: ChartPoint[];
}

export const MetricsChart: React.FC<MetricsChartProps> = ({
  metrics,
  title,
  height = 300,
  metricNames,
  showLegend = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null);
  const [chartData, setChartData] = useState<ChartSeries[]>([]);

  // Color palette for different metrics
  const colors = [
    '#667eea', '#764ba2', '#f093fb', '#f5576c',
    '#4facfe', '#00f2fe', '#43e97b', '#38f9d7',
    '#ffecd2', '#fcb69f', '#a8edea', '#fed6e3'
  ];

  useEffect(() => {
    processMetrics();
  }, [metrics, metricNames]);

  useEffect(() => {
    if (chartData?.length || 0 > 0) {
      drawChart();
    }
  }, [chartData, hoveredPoint]);

  const processMetrics = () => {
    if (!metrics?.length || 0) return;

    // Group metrics by name
    const grouped = new Map<string, MonitoringMetric[]>();
    
    metrics.forEach(metric => {
      if (metricNames && !metricNames.includes(metric.name)) return;
      
      if (!grouped.has(metric.name)) {
        grouped.set(metric.name, []);
      }
      grouped.get(metric.name)!.push(metric);
    });

    // Convert to chart series
    const series: ChartSeries[] = [];
    let colorIndex = 0;

    for (const [name, metricList] of grouped.entries()) {
      // Sort by timestamp
      const sortedMetrics = metricList.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Create points
      const points: ChartPoint[] = sortedMetrics?.map((metric, index) => ({
        x: index,
        y: metric.value,
        metric
      }));

      series.push({
        name,
        color: colors[colorIndex % colors?.length || 0],
        points
      });

      colorIndex++;
    }

    setChartData(series);
  };

  const drawChart = () => {
    const canvas = canvasRef?.current;
    if (!canvas || !chartData?.length || 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Set canvas size
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Calculate dimensions
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = rect.width - padding.left - padding.right;
    const chartHeight = rect.height - padding.top - padding.bottom;

    // Find data bounds
    let minY = Infinity;
    let maxY = -Infinity;
    let maxX = 0;

    chartData.forEach(series => {
      series?.points?.forEach(point => {
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
        maxX = Math.max(maxX, point.x);
      });
    });

    // Add some padding to Y axis
    const yRange = maxY - minY;
    minY -= yRange * 0.1;
    maxY += yRange * 0.1;

    // Helper functions
    const scaleX = (x: number) => padding.left + (x / maxX) * chartWidth;
    const scaleY = (y: number) => padding.top + chartHeight - ((y - minY) / (maxY - minY)) * chartHeight;

    // Draw grid
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;

    // Vertical grid lines
    for (let i = 0; i <= 10; i++) {
      const x = padding.left + (i / 10) * chartWidth;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + chartHeight);
      ctx.stroke();
    }

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (i / 5) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.stroke();

    // Draw Y axis labels
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= 5; i++) {
      const value = minY + (maxY - minY) * (1 - i / 5);
      const y = padding.top + (i / 5) * chartHeight;
      const text = value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(1);
      ctx.fillText(text, padding.left - 10, y);
    }

    // Draw series
    chartData.forEach((series, seriesIndex) => {
      if (!series?.points?.length) return;

      ctx.strokeStyle = series.color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      series?.points?.forEach((point, pointIndex) => {
        const x = scaleX(point.x);
        const y = scaleY(point.y);

        if (pointIndex === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      // Draw points
      ctx.fillStyle = series.color;
      series?.points?.forEach(point => {
        const x = scaleX(point.x);
        const y = scaleY(point.y);
        
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();

        // Highlight hovered point
        if (hoveredPoint === point) {
          ctx.strokeStyle = '#333';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
    });

    // Draw tooltip
    if (hoveredPoint) {
      const x = scaleX(hoveredPoint.x);
      const y = scaleY(hoveredPoint.y);

      // Tooltip background
      const tooltipText = [
        `${hoveredPoint?.metric?.name}`,
        `Value: ${hoveredPoint?.metric?.value}${hoveredPoint?.metric?.unit || ''}`,
        `Time: ${new Date(hoveredPoint?.metric?.timestamp).toLocaleTimeString()}`
      ];

      ctx.font = '12px sans-serif';
      const maxWidth = Math.max(...tooltipText?.map(text => ctx.measureText(text).width)) + 16;
      const tooltipHeight = tooltipText?.length || 0 * 16 + 8;

      let tooltipX = x + 10;
      let tooltipY = y - tooltipHeight - 10;

      // Adjust if tooltip goes off screen
      if (tooltipX + maxWidth > rect.width) {
        tooltipX = x - maxWidth - 10;
      }
      if (tooltipY < 0) {
        tooltipY = y + 20;
      }

      // Draw tooltip
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(tooltipX, tooltipY, maxWidth, tooltipHeight);

      ctx.fillStyle = 'white';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      tooltipText.forEach((text, index) => {
        ctx.fillText(text, tooltipX + 8, tooltipY + 4 + index * 16);
      });
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef?.current;
    if (!canvas || !chartData?.length || 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Find closest point
    let closestPoint: ChartPoint | null = null;
    let minDistance = Infinity;

    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = rect.width - padding.left - padding.right;
    const chartHeight = rect.height - padding.top - padding.bottom;

    // Find data bounds
    let minY = Infinity;
    let maxY = -Infinity;
    let maxX = 0;

    chartData.forEach(series => {
      series?.points?.forEach(point => {
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
        maxX = Math.max(maxX, point.x);
      });
    });

    const yRange = maxY - minY;
    minY -= yRange * 0.1;
    maxY += yRange * 0.1;

    const scaleX = (x: number) => padding.left + (x / maxX) * chartWidth;
    const scaleY = (y: number) => padding.top + chartHeight - ((y - minY) / (maxY - minY)) * chartHeight;

    chartData.forEach(series => {
      series?.points?.forEach(point => {
        const x = scaleX(point.x);
        const y = scaleY(point.y);
        const distance = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2);

        if (distance < minDistance && distance < 20) {
          minDistance = distance;
          closestPoint = point;
        }
      });
    });

    setHoveredPoint(closestPoint);
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  if (!metrics?.length || 0) {
    return (
      <div className="metrics-chart-empty">
        <h3>{title}</h3>
        <p>No metrics data available</p>
      </div>
    );
  }

  return (
    <div className="metrics-chart">
      <h3>{title}</h3>
      
      {showLegend && chartData?.length || 0 > 0 && (
        <div className="chart-legend">
          {chartData?.map(series => (
            <div key={series.name} className="legend-item">
              <div 
                className="legend-color" 
                style={{ backgroundColor: series.color }}
              ></div>
              <span className="legend-label">{series.name}</span>
            </div>
          ))}
        </div>
      )}
      
      <canvas
        ref={canvasRef}
        width={800}
        height={height}
        style={{ width: '100%', height: `${height}px`, cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
};