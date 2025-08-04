import React, { Suspense } from 'react';
import { EmailIngestionMonitoringErrorBoundary } from './EmailIngestionMonitoringErrorBoundary.js';
import { EmailIngestionMonitoringDashboard } from './EmailIngestionMonitoringDashboard.js';
import { LoadingState } from '../LoadingState/LoadingState.js';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card.js';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../../../components/ui/alert.js';
import { 
  Activity,
  AlertCircle,
  Wifi,
  WifiOff,
} from 'lucide-react';

// =====================================================
// Loading Fallback Component
// =====================================================

const MonitoringLoadingFallback: React.FC = () => (
  <div className="space-y-6 p-6">
    {/* Header Skeleton */}
    <div className="flex justify-between items-center">
      <div>
        <div className="h-8 w-80 bg-muted animate-pulse rounded mb-2" />
        <div className="h-4 w-96 bg-muted animate-pulse rounded" />
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-24 bg-muted animate-pulse rounded" />
        <div className="h-8 w-20 bg-muted animate-pulse rounded" />
      </div>
    </div>

    {/* Status Alert Skeleton */}
    <div className="h-24 bg-muted animate-pulse rounded" />

    {/* Tabs Skeleton */}
    <div className="space-y-4">
      <div className="h-10 bg-muted animate-pulse rounded" />
      
      {/* Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded mb-1" />
              <div className="h-3 w-24 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Chart Skeleton */}
      <Card>
        <CardHeader>
          <div className="h-6 w-48 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    </div>
  </div>
);

// =====================================================
// Error Fallback Component
// =====================================================

const MonitoringErrorFallback: React.FC = () => (
  <div className="min-h-[400px] flex items-center justify-center p-6">
    <Card className="w-full max-w-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertCircle className="w-6 h-6 text-red-500" />
          <CardTitle className="text-xl">Service Unavailable</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Alert variant="destructive">
          <WifiOff className="h-4 w-4" />
          <AlertTitle>Cannot Connect to Monitoring Service</AlertTitle>
          <AlertDescription>
            The email ingestion monitoring service is currently unavailable. 
            Please check your connection and try again.
          </AlertDescription>
        </Alert>
        
        <div className="mt-4 text-sm text-muted-foreground">
          <p>This could be due to:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Network connectivity issues</li>
            <li>Backend service maintenance</li>
            <li>WebSocket connection problems</li>
            <li>Redis or database connectivity issues</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  </div>
);

// =====================================================
// Network Status Hook
// =====================================================

const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  
  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOnline;
};

// =====================================================
// Connection Status Component
// =====================================================

const ConnectionStatus: React.FC = () => {
  const isOnline = useNetworkStatus();
  
  if (!isOnline) {
    return (
      <Alert variant="destructive" className="mb-4">
        <WifiOff className="h-4 w-4" />
        <AlertTitle>No Internet Connection</AlertTitle>
        <AlertDescription>
          You're currently offline. Monitoring data may not be up to date.
        </AlertDescription>
      </Alert>
    );
  }
  
  return null;
};

// =====================================================
// Main Wrapper Component
// =====================================================

export const EmailIngestionMonitoringWrapper: React.FC = () => {
  return (
    <EmailIngestionMonitoringErrorBoundary
      fallback={<MonitoringErrorFallback />}
      onError={(error, errorInfo) => {
        // Additional error handling logic
        console.error('EmailIngestionMonitoring Error:', error, errorInfo);
        
        // Could send to analytics service
        if (window.gtag) {
          window.gtag('event', 'exception', {
            description: error.message,
            fatal: false,
          });
        }
      }}
    >
      <ConnectionStatus />
      
      <Suspense fallback={<MonitoringLoadingFallback />}>
        <EmailIngestionMonitoringDashboard />
      </Suspense>
    </EmailIngestionMonitoringErrorBoundary>
  );
};

// =====================================================
// Lazy Loaded Component (Alternative)
// =====================================================

export const LazyEmailIngestionMonitoringWrapper = React.lazy(() =>
  import('./EmailIngestionMonitoringDashboard.js').then((module) => ({
    default: () => (
      <EmailIngestionMonitoringErrorBoundary
        fallback={<MonitoringErrorFallback />}
      >
        <ConnectionStatus />
        <module.EmailIngestionMonitoringDashboard />
      </EmailIngestionMonitoringErrorBoundary>
    ),
  }))
);

// =====================================================
// Export
// =====================================================

export default EmailIngestionMonitoringWrapper;