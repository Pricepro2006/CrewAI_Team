import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { SkeletonLoader } from './loading/SkeletonLoader';

// Lazy load major route components to reduce initial bundle
const LazyWalmartDashboard = lazy(() => 
  import('./walmart/WalmartDashboard').then(module => ({ default: module.WalmartDashboard }))
);

const LazyWalmartGroceryList = lazy(() => 
  import('./walmart/WalmartGroceryList').then(module => ({ default: module.WalmartGroceryList }))
);

const LazyWalmartLivePricing = lazy(() => 
  import('./walmart/WalmartLivePricing').then(module => ({ default: module.WalmartLivePricing }))
);

const LazyWalmartOrderHistory = lazy(() => 
  import('./walmart/WalmartOrderHistory').then(module => ({ default: module.WalmartOrderHistory }))
);

const LazyEmailDashboard = lazy(() => 
  import('./dashboard/EmailDashboardMultiPanel').then(module => ({ default: module.EmailDashboardMultiPanel }))
);

const LazyAdvancedEmailDashboard = lazy(() => 
  import('./dashboard/AdvancedEmailDashboard').then(module => ({ default: module.AdvancedEmailDashboard }))
);

const LazyMonitoringDashboard = lazy(() => 
  import('./monitoring/MonitoringDashboard').then(module => ({ default: module.MonitoringDashboard }))
);

const LazyPerformanceDashboard = lazy(() => 
  import('./dev/PerformanceDashboard').then(module => ({ default: module.PerformanceDashboard }))
);

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
          <SkeletonLoader height="600px" />
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
            <LazyEmailDashboard />
          </RouteWrapper>
        } 
      />
      <Route 
        path="/emails/advanced" 
        element={
          <RouteWrapper title="advanced-email">
            <LazyAdvancedEmailDashboard />
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

// Preload utilities for better UX
export const preloadRoute = (routeName: string): void => {
  const preloadMap = {
    'walmart-dashboard': () => import('./walmart/WalmartDashboard'),
    'walmart-grocery': () => import('./walmart/WalmartGroceryList'),
    'walmart-pricing': () => import('./walmart/WalmartLivePricing'),
    'walmart-orders': () => import('./walmart/WalmartOrderHistory'),
    'email-dashboard': () => import('./dashboard/EmailDashboardMultiPanel'),
    'advanced-email': () => import('./dashboard/AdvancedEmailDashboard'),
    'monitoring': () => import('./monitoring/MonitoringDashboard'),
    'performance': () => import('./dev/PerformanceDashboard'),
  };
  
  const preloader = preloadMap[routeName as keyof typeof preloadMap];
  if (preloader) {
    preloader().catch((err: Error) => console.warn(`Failed to preload ${routeName}:`, err));
  }
};

// Hook for intelligent route preloading
export const useRoutePreloading = (): void => {
  React.useEffect(() => {
    const prefetchOnHover = (event: Event): void => {
      const target = event.target as HTMLElement;
      const link = target.closest('a[href]') as HTMLAnchorElement;
      if (link && link?.href?.includes('/walmart')) {
        preloadRoute('walmart-dashboard');
      }
    };
    
    document.addEventListener('mouseover', prefetchOnHover);
    return () => document.removeEventListener('mouseover', prefetchOnHover);
  }, []);
};