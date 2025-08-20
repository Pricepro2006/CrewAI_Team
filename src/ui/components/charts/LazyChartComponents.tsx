import React, { useEffect, useState } from 'react';

interface SkeletonLoaderProps {
  height?: string;
  width?: string;
  className?: string;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ height = '300px', width = '100%', className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} style={{ height, width }}>Loading...</div>
);

// Type definitions for recharts components
interface RechartsComponents {
  LineChart: React.ComponentType<any>;
  Line: React.ComponentType<any>;
  BarChart: React.ComponentType<any>;
  Bar: React.ComponentType<any>;
  PieChart: React.ComponentType<any>;
  Pie: React.ComponentType<any>;
  Cell: React.ComponentType<any>;
  XAxis: React.ComponentType<any>;
  YAxis: React.ComponentType<any>;
  CartesianGrid: React.ComponentType<any>;
  Tooltip: React.ComponentType<any>;
  ResponsiveContainer: React.ComponentType<any>;
}

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


// Chart component wrapper with lazy loading  
export const LazyLineChart: React.FC<LazyChartProps> = ({ 
  data, 
  xKey, 
  yKey, 
  width = "100%", 
  height = 300 
}) => {
  const ChartRenderer: React.FC = () => {
    const [RechartsComponents, setRechartsComponents] = useState<RechartsComponents | null>(null);
    
    useEffect(() => {
      import('recharts')
        .then((recharts) => {
          setRechartsComponents(recharts as RechartsComponents);
        })
        .catch((error) => {
          console.error('Failed to load recharts:', error);
        });
    }, []);
    
    if (!RechartsComponents) {
      return <SkeletonLoader height="300px" />;
    }
    
    const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = RechartsComponents;
    
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
  };
  
  return <ChartRenderer />;
};

export const LazyBarChart: React.FC<LazyChartProps> = ({ 
  data, 
  xKey, 
  yKey, 
  width = "100%", 
  height = 300 
}) => {
  const ChartRenderer: React.FC = () => {
    const [RechartsComponents, setRechartsComponents] = useState<RechartsComponents | null>(null);
    
    useEffect(() => {
      import('recharts')
        .then((recharts) => {
          setRechartsComponents(recharts as RechartsComponents);
        })
        .catch((error) => {
          console.error('Failed to load recharts:', error);
        });
    }, []);
    
    if (!RechartsComponents) {
      return <SkeletonLoader height="300px" />;
    }
    
    const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = RechartsComponents;
    
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
  };
  
  return <ChartRenderer />;
};

export const LazyPieChart: React.FC<LazyChartProps> = ({ 
  data, 
  yKey, 
  colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300'], 
  width = "100%", 
  height = 300 
}) => {
  const ChartRenderer: React.FC = () => {
    const [RechartsComponents, setRechartsComponents] = useState<RechartsComponents | null>(null);
    
    useEffect(() => {
      import('recharts')
        .then((recharts) => {
          setRechartsComponents(recharts as RechartsComponents);
        })
        .catch((error) => {
          console.error('Failed to load recharts:', error);
        });
    }, []);
    
    if (!RechartsComponents) {
      return <SkeletonLoader height="300px" />;
    }
    
    const { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } = RechartsComponents;
    
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
            {data.map((entry: ChartDataPoint, index: number) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  };
  
  return <ChartRenderer />;
};

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