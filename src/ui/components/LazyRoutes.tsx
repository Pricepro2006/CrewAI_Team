import * as React from 'react';
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { SkeletonLoader as Skeleton } from '../../client/components/loading/SkeletonLoader';

// Define types locally to avoid import issues
type EmailStatus = "pending" | "processing" | "completed" | "failed";
type StatusUpdateEmailStatus = "pending" | "in_progress" | "completed" | "cancelled" | "on_hold";

interface EmailRecord {
  id: string;
  emailAlias: string;
  requestedBy: string;
  subject: string;
  summary: string;
  status: StatusUpdateEmailStatus;
  priority: "low" | "medium" | "high" | "critical";
  assignedTo?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  metadata: Record<string, any>;
}

// Lazy load major route components to reduce initial bundle
const LazyWalmartDashboard = lazy(async () => {
  try {
    const module = await import('../../client/components/walmart/WalmartDashboard');
    return { default: (module as any).WalmartDashboard || module.default };
  } catch {
    return { default: () => React.createElement('div', {}, 'Component loading failed') };
  }
});

const LazyWalmartGroceryList = lazy(async () => {
  try {
    const module = await import('../../client/components/walmart/WalmartGroceryList');
    return { default: (module as any).WalmartGroceryList || module.default };
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
    return { default: (module as any).WalmartOrderHistory || module.default };
  } catch {
    return { default: () => React.createElement('div', {}, 'Component loading failed') };
  }
});

const LazyEmailDashboard = lazy(async () => {
  try {
    const module = await import('../../client/components/dashboard/EmailDashboardMultiPanel');
    return { default: (module as any).EmailDashboardMultiPanel || module.default };
  } catch {
    return { default: () => React.createElement('div', {}, 'Component loading failed') };
  }
});

const LazyAdvancedEmailDashboard = lazy(() => 
  import('../../client/components/dashboard/AdvancedEmailDashboard')
);

// Wrapper components to provide default props
const EmailDashboardWrapper: React.FC = () => {
  // Provide default props for the email dashboard
  const defaultEmails: EmailRecord[] = [];
  
  return (
    <LazyEmailDashboard 
      emails={defaultEmails}
      loading={false}
      error={null}
    />
  );
};

const AdvancedEmailDashboardWrapper: React.FC = () => {
  // Provide default props for the advanced email dashboard
  const defaultEmails: EmailRecord[] = [];
  
  const defaultUser = {
    id: 'guest',
    name: 'Guest User',
    role: 'viewer',
    permissions: ['read']
  };
  
  const handleEmailStatusUpdate = async (
    emailId: string,
    fromStatus: StatusUpdateEmailStatus,
    toStatus: StatusUpdateEmailStatus,
    comment?: string
  ): Promise<void> => {
    // Default implementation - could integrate with actual API
    console.log('Email status update:', { emailId, fromStatus, toStatus, comment });
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
    return { default: (module as any).MonitoringDashboard || module.default };
  } catch {
    return { default: () => React.createElement('div', {}, 'Component loading failed') };
  }
});

const LazyPerformanceDashboard = lazy(async () => {
  try {
    const module = await import('../../client/components/dev/PerformanceDashboard');
    return { default: (module as any).PerformanceDashboard || module.default };
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
type PreloadMap = {
  'walmart-dashboard': () => Promise<any>;
  'walmart-grocery': () => Promise<any>;
  'walmart-pricing': () => Promise<any>;
  'walmart-orders': () => Promise<any>;
  'email-dashboard': () => Promise<any>;
  'advanced-email': () => Promise<any>;
  'monitoring': () => Promise<any>;
  'performance': () => Promise<any>;
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