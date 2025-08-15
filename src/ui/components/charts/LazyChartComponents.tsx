import React, { lazy, Suspense } from 'react';
import { SkeletonLoader } from '../loading/SkeletonLoader';
import type {
  LineChart as LineChartType,
  BarChart as BarChartType,
  PieChart as PieChartType,
  XAxis as XAxisType,
  YAxis as YAxisType,
  CartesianGrid as CartesianGridType,
  Tooltip as TooltipType,
  Legend as LegendType,
  ResponsiveContainer as ResponsiveContainerType,
  Line as LineType,
  Bar as BarType,
  Cell as CellType,
  Pie as PieType
} from 'recharts';

// Chart component props interfaces
export interface ChartDataPoint {
  [key: string]: string | number;
}

export interface LazyChartProps {
  data: ChartDataPoint[];
  xKey: string;
  yKey: string;
  colors?: string[];
  width?: string | number;
  height?: string | number;
}

// Lazy load heavy chart components to reduce initial bundle size
const LazyRecharts = lazy(() => import('recharts'));

const LazyChartJS = lazy(() => import('chart.js/auto'));

const LazyReactChartJS = lazy(() => import('react-chartjs-2'));

// Chart component wrapper with lazy loading
export const LazyLineChart: React.FC<LazyChartProps> = ({ 
  data, 
  xKey, 
  yKey, 
  width = "100%", 
  height = 300 
}) => (
  <Suspense fallback={<SkeletonLoader height="300px" />}>
    <LazyRecharts>
      {(recharts: any) => {
        const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = recharts;
        return (
          <ResponsiveContainer width={width} height={height}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey={yKey} stroke="#8884d8" />
            </LineChart>
          </ResponsiveContainer>
        );
      }}
    </LazyRecharts>
  </Suspense>
);

export const LazyBarChart: React.FC<LazyChartProps> = ({ 
  data, 
  xKey, 
  yKey, 
  width = "100%", 
  height = 300 
}) => (
  <Suspense fallback={<SkeletonLoader height="300px" />}>
    <LazyRecharts>
      {(recharts: any) => {
        const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = recharts;
        return (
          <ResponsiveContainer width={width} height={height}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} />
              <YAxis />
              <Tooltip />
              <Bar dataKey={yKey} fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        );
      }}
    </LazyRecharts>
  </Suspense>
);

export const LazyPieChart: React.FC<LazyChartProps> = ({ 
  data, 
  yKey, 
  colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300'], 
  width = "100%", 
  height = 300 
}) => (
  <Suspense fallback={<SkeletonLoader height="300px" />}>
    <LazyRecharts>
      {(recharts: any) => {
        const { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } = recharts;
        return (
          <ResponsiveContainer width={width} height={height}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                dataKey={yKey}
              >
                {data?.map((entry: ChartDataPoint, index: number) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors?.length || 0]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );
      }}
    </LazyRecharts>
  </Suspense>
);

// Performance optimized chart selector
export interface OptimizedChartProps extends LazyChartProps {
  type: 'line' | 'bar' | 'pie';
}

export const OptimizedChart: React.FC<OptimizedChartProps> = ({ type, ...props }) => {
  switch (type) {
    case 'line':
      return <LazyLineChart {...props} />;
    case 'bar':
      return <LazyBarChart {...props} />;
    case 'pie':
      return <LazyPieChart {...props} />;
    default:
      return <LazyLineChart {...props} />;
  }
};