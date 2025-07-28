import React from 'react';
import { useCSRFStatus } from '../../hooks/useTRPCWithCSRF.js';
import { Shield, AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';

interface CSRFMonitorProps {
  className?: string;
  showDetails?: boolean;
}

export const CSRFMonitor: React.FC<CSRFMonitorProps> = ({ 
  className = '', 
  showDetails = false 
}) => {
  const { hasToken, tokenAge, lastRefresh, error, isLoading, status } = useCSRFStatus();

  // Don't show in production unless there's an error
  if (process.env.NODE_ENV === 'production' && status !== 'error' && !showDetails) {
    return null;
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'loading':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Shield className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'active':
        return 'Protected';
      case 'loading':
        return 'Initializing...';
      case 'error':
        return 'Security Error';
      default:
        return 'Inactive';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'active':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'loading':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'error':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className={`inline-flex items-center ${className}`}>
      <div 
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm
          ${getStatusColor()}
        `}
        title={`CSRF Protection: ${getStatusText()}`}
      >
        {getStatusIcon()}
        <span className="font-medium">CSRF: {getStatusText()}</span>
        
        {showDetails && hasToken && (
          <>
            <span className="text-xs opacity-70">•</span>
            <Clock className="w-3.5 h-3.5" />
            <span className="text-xs">{tokenAge}</span>
          </>
        )}
      </div>

      {error && (
        <div className="ml-2 text-xs text-red-600 max-w-[200px] truncate" title={error.message}>
          {error.message}
        </div>
      )}
    </div>
  );
};

/**
 * CSRF Status Badge - Minimal version for headers/footers
 */
export const CSRFStatusBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { status } = useCSRFStatus();

  // Only show if there's an issue
  if (status === 'active') {
    return null;
  }

  const getBadgeStyle = () => {
    switch (status) {
      case 'loading':
        return 'bg-blue-100 text-blue-800';
      case 'error':
        return 'bg-red-100 text-red-800 animate-pulse';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div 
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full
        ${getBadgeStyle()} ${className}
      `}
    >
      <Shield className="w-3 h-3" />
      <span>Security {status === 'loading' ? 'Init' : 'Issue'}</span>
    </div>
  );
};

/**
 * CSRF Error Boundary - Catches and displays CSRF-specific errors
 */
interface CSRFErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
}

interface CSRFErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class CSRFErrorBoundary extends React.Component<
  CSRFErrorBoundaryProps, 
  CSRFErrorBoundaryState
> {
  constructor(props: CSRFErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): CSRFErrorBoundaryState {
    // Check if it's a CSRF-related error
    const isCSRFError = 
      error.message.toLowerCase().includes('csrf') ||
      error.message.toLowerCase().includes('forbidden');
    
    return {
      hasError: isCSRFError,
      error: isCSRFError ? error : null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (this.state.hasError) {
      console.error('CSRF Error caught by boundary:', error, errorInfo);
    }
  }

  retry = () => {
    // Refresh the page to reinitialize CSRF protection
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} retry={this.retry} />;
      }

      return (
        <div className="flex items-center justify-center min-h-[200px] p-4">
          <div className="text-center max-w-md">
            <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Security Protection Error
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              We encountered a security validation error. This is usually temporary and can be 
              resolved by refreshing the page.
            </p>
            <button
              onClick={this.retry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white 
                       rounded-md hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}