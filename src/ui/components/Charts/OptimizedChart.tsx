import React, { useMemo } from 'react';
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

export interface ChartDataPoint {
  [key: string]: string | number;
}

export interface ChartProps {
  data: ChartDataPoint[];
  type: 'line' | 'area' | 'bar' | 'pie';
  xKey: string;
  yKey: string;
  color?: string;
  colors?: string[];
  height?: number;
  title?: string;
  showGrid?: boolean;
  showLegend?: boolean;
  animated?: boolean;
}

// Performance-optimized chart component
export const OptimizedChart: React.FC<ChartProps> = React.memo(({
  data,
  type,
  xKey,
  yKey,
  color = '#3B82F6',
  colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316'],
  height = 300,
  title,
  showGrid = true,
  showLegend = true,
  animated = true
}) => {
  // Memoize chart configuration for performance
  const chartConfig = useMemo(() => ({
    margin: { top: 20, right: 30, left: 20, bottom: 5 },
    animationDuration: animated ? 300 : 0,
  }), [animated]);

  // Memoize tooltip formatter for better performance
  const tooltipFormatter = useMemo(() => (value: any, name: string) => [
    typeof value === 'number' ? value.toLocaleString() : value,
    name
  ], []);

  const renderChart = () => {
    const commonProps = {
      data,
      margin: chartConfig.margin,
      height,
    };

    switch (type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
            <XAxis dataKey={xKey} stroke="#666" fontSize={12} />
            <YAxis stroke="#666" fontSize={12} />
            <Tooltip formatter={tooltipFormatter} />
            {showLegend && <Legend />}
            <Line
              type="monotone"
              dataKey={yKey}
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: color, strokeWidth: 2 }}
              animationDuration={chartConfig.animationDuration}
            />
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
            <XAxis dataKey={xKey} stroke="#666" fontSize={12} />
            <YAxis stroke="#666" fontSize={12} />
            <Tooltip formatter={tooltipFormatter} />
            {showLegend && <Legend />}
            <Area
              type="monotone"
              dataKey={yKey}
              stroke={color}
              fill={`${color}20`}
              strokeWidth={2}
              animationDuration={chartConfig.animationDuration}
            />
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
            <XAxis dataKey={xKey} stroke="#666" fontSize={12} />
            <YAxis stroke="#666" fontSize={12} />
            <Tooltip formatter={tooltipFormatter} />
            {showLegend && <Legend />}
            <Bar
              dataKey={yKey}
              fill={color}
              radius={[4, 4, 0, 0]}
              animationDuration={chartConfig.animationDuration}
            />
          </BarChart>
        );

      case 'pie':
        return (
          <PieChart {...commonProps}>
            <Tooltip formatter={tooltipFormatter} />
            {showLegend && <Legend />}
            <Pie
              data={data}
              dataKey={yKey}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={80}
              animationDuration={chartConfig.animationDuration}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
          </PieChart>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        {renderChart() || <div />}
      </ResponsiveContainer>
    </div>
  );
});

OptimizedChart.displayName = 'OptimizedChart';

// Specialized chart components for common use cases
export const PriceHistoryChart: React.FC<{
  data: { date: string; price: number }[];
  height?: number;
}> = React.memo(({ data, height = 300 }) => (
  <OptimizedChart
    data={data}
    type="line"
    xKey="date"
    yKey="price"
    color="#10B981"
    height={height}
    title="Price History"
    showGrid={true}
    showLegend={false}
  />
));

export const CategorySpendingChart: React.FC<{
  data: { category: string; amount: number }[];
  height?: number;
}> = React.memo(({ data, height = 300 }) => (
  <OptimizedChart
    data={data}
    type="pie"
    xKey="category"
    yKey="amount"
    height={height}
    title="Spending by Category"
    showGrid={false}
    showLegend={true}
  />
));

export const TrendingItemsChart: React.FC<{
  data: { name: string; changePercent: number }[];
  height?: number;
}> = React.memo(({ data, height = 300 }) => (
  <OptimizedChart
    data={data}
    type="bar"
    xKey="name"
    yKey="changePercent"
    color="#F59E0B"
    height={height}
    title="Price Changes"
    showGrid={true}
    showLegend={false}
  />
));

PriceHistoryChart.displayName = 'PriceHistoryChart';
CategorySpendingChart.displayName = 'CategorySpendingChart';
TrendingItemsChart.displayName = 'TrendingItemsChart';