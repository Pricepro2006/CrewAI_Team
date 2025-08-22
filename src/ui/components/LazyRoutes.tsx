import * as React from 'react';
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Skeleton } from '../../client/components/loading/SkeletonLoader';
import { ErrorBoundary } from './ErrorBoundary/ErrorBoundary';

// Safe type definitions with proper fallbacks
type EmailStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

// Unified EmailRecord type that handles both formats safely
interface SafeEmailRecord {
  id: string;
  emailAlias: string;
  requestedBy: string;
  subject: string;
  summary: string;
  status: EmailStatus;
  priority: "low" | "medium" | "high" | "critical";
  assignedTo?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

// Type adapter function to safely convert API data
const adaptEmailRecord = (input: unknown): SafeEmailRecord => {
  const data = input as any;
  return {
    id: data?.id || 'unknown',
    emailAlias: data?.emailAlias || data?.email_alias || 'unknown',
    requestedBy: data?.requestedBy || data?.requested_by || 'unknown',
    subject: data?.subject || 'No subject',
    summary: data?.summary || '',
    status: data?.status || 'pending',
    priority: data?.priority || 'medium',
    assignedTo: data?.assignedTo,
    dueDate: data?.dueDate,
    createdAt: data?.createdAt || new Date().toISOString(),
    updatedAt: data?.updatedAt || new Date().toISOString(),
    tags: Array.isArray(data?.tags) ? data.tags : [],
    metadata: data?.metadata || {},
  };
};

// Lazy load major route components to reduce initial bundle
const LazyWalmartDashboard = lazy(async () => {
  try {
    const module = await import('../../client/components/walmart/WalmartDashboard');
    return { default: module.WalmartDashboard };
  } catch {
    return { default: () => React.createElement('div', {}, 'Component loading failed') };
  }
});

const LazyWalmartGroceryList = lazy(async () => {
  try {
    const module = await import('../../client/components/walmart/WalmartGroceryList');
    return { default: module.WalmartGroceryList };
  } catch {
    return { default: () => React.createElement('div', {}, 'Component loading failed') };
  }
});

const LazyWalmartLivePricing = lazy(() => 
  import('../../client/components/walmart/WalmartLivePricing')
);

const LazyWalmartOrderHistory = lazy(async () => {
  try {
    const module = await import('../../client/components/walmart/WalmartOrderHistory');
    return { default: module.WalmartOrderHistory };
  } catch {
    return { default: () => React.createElement('div', {}, 'Component loading failed') };
  }
});

const LazyEmailDashboard = lazy(() => 
  import('../components/Email/EmailDashboard').then(module => ({
    default: module.EmailDashboard
  }))
);

const LazyAdvancedEmailDashboard = lazy(() => 
  import('../../client/components/dashboard/AdvancedEmailDashboard')
);

// Wrapper components to provide default props
const EmailDashboardWrapper: React.FC = () => {
  // EmailDashboard fetches its own data via tRPC
  return <LazyEmailDashboard />;
};

const AdvancedEmailDashboardWrapper: React.FC = () => {
  // Use safe unified type
  const defaultEmails: SafeEmailRecord[] = [];
  
  const defaultUser = {
    id: 'guest',
    name: 'Guest User',
    role: 'viewer',
    permissions: ['read']
  };
  
  const handleEmailStatusUpdate = async (
    emailId: string,
    fromStatus: EmailStatus,
    toStatus: EmailStatus,
    comment?: string
  ): Promise<void> => {
    try {
      // Default implementation with error handling
      console.log('Email status update:', { emailId, fromStatus, toStatus, comment });
      // TODO: Integrate with actual API when available
    } catch (error) {
      console.error('Failed to update email status:', error);
      throw error; // Re-throw to allow component to handle
    }
  };
  
  const handleRefresh = async (): Promise<void> => {
    // Default implementation - could integrate with actual API
    console.log('Refreshing email data');
  };
  
  return (
    <LazyAdvancedEmailDashboard 
      emails={defaultEmails}
      currentUser={defaultUser}
      onEmailStatusUpdate={handleEmailStatusUpdate}
      onRefresh={handleRefresh}
    />
  );
};

const LazyMonitoringDashboard = lazy(async () => {
  try {
    const module = await import('../../client/components/monitoring/MonitoringDashboard');
    return { default: module.MonitoringDashboard };
  } catch {
    return { default: () => React.createElement('div', {}, 'Component loading failed') };
  }
});

const LazyPerformanceDashboard = lazy(async () => {
  try {
    const module = await import('../../client/components/dev/PerformanceDashboard');
    return { default: module.PerformanceDashboard };
  } catch {
    return { default: () => React.createElement('div', {}, 'Component loading failed') };
  }
});

// Route wrapper with optimized loading states
interface RouteWrapperProps {
  children: React.ReactNode;
  title: string;
}

const RouteWrapper: React.FC<RouteWrapperProps> = ({ children, title }): React.ReactElement => (
  <ErrorBoundary 
    onError={(error, errorInfo) => {
      console.error(`Route loading error for ${title}:`, error, errorInfo);
    }}
  >
    <Suspense 
      fallback={
        <div className="min-h-screen bg-gray-50">
          <div className="container mx-auto px-4 py-8">
            <div className="mb-4">
              <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse"></div>
            </div>
            <Skeleton height="600px" />
          </div>
        </div>
      }
    >
      <div className="page-content" data-page={title}>
        {children}
      </div>
    </Suspense>
  </ErrorBoundary>
);

// Optimized routing with preload hints
export const OptimizedRoutes: React.FC = (): React.ReactElement => {
  return (
    <Routes>
      {/* Walmart Grocery Agent Routes */}
      <Route 
        path="/walmart" 
        element={
          <RouteWrapper title="walmart-dashboard">
            <LazyWalmartDashboard />
          </RouteWrapper>
        } 
      />
      <Route 
        path="/walmart/grocery" 
        element={
          <RouteWrapper title="walmart-grocery">
            <LazyWalmartGroceryList />
          </RouteWrapper>
        } 
      />
      <Route 
        path="/walmart/pricing" 
        element={
          <RouteWrapper title="walmart-pricing">
            <LazyWalmartLivePricing />
          </RouteWrapper>
        } 
      />
      <Route 
        path="/walmart/orders" 
        element={
          <RouteWrapper title="walmart-orders">
            <LazyWalmartOrderHistory />
          </RouteWrapper>
        } 
      />
      
      {/* Email Dashboard Routes */}
      <Route 
        path="/emails" 
        element={
          <RouteWrapper title="email-dashboard">
            <EmailDashboardWrapper />
          </RouteWrapper>
        } 
      />
      <Route 
        path="/emails/advanced" 
        element={
          <RouteWrapper title="advanced-email">
            <AdvancedEmailDashboardWrapper />
          </RouteWrapper>
        } 
      />
      
      {/* Monitoring Routes */}
      <Route 
        path="/monitoring" 
        element={
          <RouteWrapper title="monitoring">
            <LazyMonitoringDashboard />
          </RouteWrapper>
        } 
      />
      <Route 
        path="/performance" 
        element={
          <RouteWrapper title="performance">
            <LazyPerformanceDashboard />
          </RouteWrapper>
        } 
      />
      
      {/* Default Route */}
      <Route 
        path="/" 
        element={
          <RouteWrapper title="walmart-dashboard">
            <LazyWalmartDashboard />
          </RouteWrapper>
        } 
      />
    </Routes>
  );
};

// Type definitions for preload map
type ComponentModule = { [key: string]: React.ComponentType<unknown> };

type PreloadMap = {
  'walmart-dashboard': () => Promise<ComponentModule>;
  'walmart-grocery': () => Promise<ComponentModule>;
  'walmart-pricing': () => Promise<ComponentModule>;
  'walmart-orders': () => Promise<ComponentModule>;
  'email-dashboard': () => Promise<ComponentModule>;
  'advanced-email': () => Promise<ComponentModule>;
  'monitoring': () => Promise<ComponentModule>;
  'performance': () => Promise<ComponentModule>;
};

type RouteNames = keyof PreloadMap;

// Preload utilities for better UX
export const preloadRoute = (routeName: RouteNames): void => {
  const preloadMap: PreloadMap = {
    'walmart-dashboard': () => import('../../client/components/walmart/WalmartDashboard'),
    'walmart-grocery': () => import('../../client/components/walmart/WalmartGroceryList'),
    'walmart-pricing': () => import('../../client/components/walmart/WalmartLivePricing'),
    'walmart-orders': () => import('../../client/components/walmart/WalmartOrderHistory'),
    'email-dashboard': () => import('../../client/components/dashboard/EmailDashboardMultiPanel'),
    'advanced-email': () => import('../../client/components/dashboard/AdvancedEmailDashboard'),
    'monitoring': () => import('../../client/components/monitoring/MonitoringDashboard'),
    'performance': () => import('../../client/components/dev/PerformanceDashboard'),
  };
  
  const preloader = preloadMap[routeName];
  if (preloader) {
    preloader().catch((err: Error) => console.warn(`Failed to preload ${routeName}:`, err));
  }
};

// Hook for intelligent route preloading
export const useRoutePreloading = (): void => {
  React.useEffect(() => {
    const prefetchOnHover = (event: Event): void => {
      const target = event.target as HTMLElement;
      const link = target.closest('a[href]') as HTMLAnchorElement | null;
      if (link?.href) {
        if (link.href.includes('/walmart/grocery')) {
          preloadRoute('walmart-grocery');
        } else if (link.href.includes('/walmart/pricing')) {
          preloadRoute('walmart-pricing');
        } else if (link.href.includes('/walmart/orders')) {
          preloadRoute('walmart-orders');
        } else if (link.href.includes('/walmart')) {
          preloadRoute('walmart-dashboard');
        } else if (link.href.includes('/emails/advanced')) {
          preloadRoute('advanced-email');
        } else if (link.href.includes('/emails')) {
          preloadRoute('email-dashboard');
        } else if (link.href.includes('/monitoring')) {
          preloadRoute('monitoring');
        } else if (link.href.includes('/performance')) {
          preloadRoute('performance');
        }
      }
    };
    
    document.addEventListener('mouseover', prefetchOnHover);
    return () => document.removeEventListener('mouseover', prefetchOnHover);
  }, []);
};