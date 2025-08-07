import React, { lazy, Suspense } from 'react';
import { SkeletonLoader } from '../loading/SkeletonLoader';

// Lazy load heavy chart components to reduce initial bundle size
const LazyRecharts = lazy(() => import('recharts').then(module => ({
  default: {
    LineChart: module.LineChart,
    BarChart: module.BarChart,
    PieChart: module.PieChart,
    XAxis: module.XAxis,
    YAxis: module.YAxis,
    CartesianGrid: module.CartesianGrid,
    Tooltip: module.Tooltip,
    Legend: module.Legend,
    ResponsiveContainer: module.ResponsiveContainer,
    Line: module.Line,
    Bar: module.Bar,
    Cell: module.Cell,
    Pie: module.Pie
  }
})));

const LazyChartJS = lazy(() => import('chart.js/auto').then(module => ({
  default: module.default
})));

const LazyReactChartJS = lazy(() => import('react-chartjs-2').then(module => ({
  default: {
    Line: module.Line,
    Bar: module.Bar,
    Pie: module.Pie,
    Doughnut: module.Doughnut
  }
})));

// Chart component wrapper with lazy loading
export const LazyLineChart: React.FC<any> = (props) => (
  <Suspense fallback={<SkeletonLoader height="300px" />}>
    <LazyRecharts>
      {({ LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer }) => (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={props.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={props.xKey} />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey={props.yKey} stroke="#8884d8" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </LazyRecharts>
  </Suspense>
);

export const LazyBarChart: React.FC<any> = (props) => (
  <Suspense fallback={<SkeletonLoader height="300px" />}>
    <LazyRecharts>
      {({ BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer }) => (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={props.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={props.xKey} />
            <YAxis />
            <Tooltip />
            <Bar dataKey={props.yKey} fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </LazyRecharts>
  </Suspense>
);

export const LazyPieChart: React.FC<any> = (props) => (
  <Suspense fallback={<SkeletonLoader height="300px" />}>
    <LazyRecharts>
      {({ PieChart, Pie, Cell, Tooltip, ResponsiveContainer }) => (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={props.data}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
              dataKey={props.yKey}
            >
              {props.data.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={props.colors[index % props.colors.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      )}
    </LazyRecharts>
  </Suspense>
);

// Performance optimized chart selector
export const OptimizedChart: React.FC<{
  type: 'line' | 'bar' | 'pie';
  data: any[];
  xKey: string;
  yKey: string;
  colors?: string[];
}> = ({ type, ...props }) => {
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