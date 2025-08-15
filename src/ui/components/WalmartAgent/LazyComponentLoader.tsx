import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// Lazy-loaded components with proper error boundaries
const WalmartLivePricing = React.lazy(() => 
  import('./WalmartLivePricing.js').then(module => ({ default: module.WalmartLivePricing }))
);

const GroceryListAndTracker = React.lazy(() => 
  import('./GroceryListAndTracker.js').then(module => ({ default: module.GroceryListAndTracker }))
);

const WalmartHybridSearch = React.lazy(() => 
  import('../Walmart/WalmartHybridSearch.js').then(module => ({ default: module.WalmartHybridSearch }))
);

// Performance-optimized loading component
const LoadingSpinner: React.FC = React.memo(() => (
  <div className="flex items-center justify-center p-8 min-h-[200px]">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      <p className="text-sm text-gray-600">Loading component...</p>
    </div>
  </div>
));

LoadingSpinner.displayName = 'LoadingSpinner';

// Error boundary for lazy components
interface LazyErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class LazyErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  LazyErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): LazyErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy component failed to load:', error, errorInfo);
  }

  render() {
    if (this?.state?.hasError) {
      return (
        <div className="flex items-center justify-center p-8 min-h-[200px]">
          <div className="text-center">
            <p className="text-red-600 font-medium">Component failed to load</p>
            <button 
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => this.setState({ hasError: false })}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this?.props?.children;
  }
}

// Wrapper components with suspense and error boundaries
export const LazyWalmartLivePricing: React.FC = React.memo(() => (
  <LazyErrorBoundary>
    <Suspense fallback={<LoadingSpinner />}>
      <WalmartLivePricing />
    </Suspense>
  </LazyErrorBoundary>
));

export const LazyGroceryListAndTracker: React.FC = React.memo(() => (
  <LazyErrorBoundary>
    <Suspense fallback={<LoadingSpinner />}>
      <GroceryListAndTracker />
    </Suspense>
  </LazyErrorBoundary>
));

export const LazyWalmartHybridSearch: React.FC = React.memo(() => (
  <LazyErrorBoundary>
    <Suspense fallback={<LoadingSpinner />}>
      <WalmartHybridSearch />
    </Suspense>
  </LazyErrorBoundary>
));

LazyWalmartLivePricing.displayName = 'LazyWalmartLivePricing';
LazyGroceryListAndTracker.displayName = 'LazyGroceryListAndTracker';
LazyWalmartHybridSearch.displayName = 'LazyWalmartHybridSearch';