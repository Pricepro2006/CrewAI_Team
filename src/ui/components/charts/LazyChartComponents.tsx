import React, { lazy, Suspense } from 'react';
// import { SkeletonLoader } from '../../client/components/loading/SkeletonLoader'; // Module not found
interface SkeletonLoaderProps {
  height?: string;
  width?: string;
  className?: string;
}
const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ height = '300px', width = '100%', className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} style={{ height, width }}>Loading...</div>
);

// Define chart component types without importing recharts
type ChartComponent = React.ComponentType<any>;

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
const LazyRecharts = lazy(() => import('recharts') as any);

// Chart component wrapper with lazy loading  
export const LazyLineChart: React.FC<LazyChartProps> = ({ 
  data, 
  xKey, 
  yKey, 
  width = "100%", 
  height = 300 
}) => {
  const ChartRenderer = () => {
    const [RechartsComponents, setRechartsComponents] = React.useState<any>(null);
    
    React.useEffect(() => {
      import('recharts')
        .then((recharts) => {
          setRechartsComponents(recharts);
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
  const ChartRenderer = () => {
    const [RechartsComponents, setRechartsComponents] = React.useState<any>(null);
    
    React.useEffect(() => {
      import('recharts')
        .then((recharts) => {
          setRechartsComponents(recharts);
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
  const ChartRenderer = () => {
    const [RechartsComponents, setRechartsComponents] = React.useState<any>(null);
    
    React.useEffect(() => {
      import('recharts')
        .then((recharts) => {
          setRechartsComponents(recharts);
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
            {data?.map((entry: ChartDataPoint, index: number) => (
              <Cell key={`cell-${index}`} fill={colors[index % (colors?.length || 4)]} />
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