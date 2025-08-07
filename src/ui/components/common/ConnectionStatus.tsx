import React from 'react';
import { Wifi, WifiOff, Loader2, AlertTriangle } from 'lucide-react';

export interface ConnectionStatusProps {
  isConnected: boolean;
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
  reconnectAttempts?: number;
  maxReconnectAttempts?: number;
  lastUpdateTime?: number;
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  position?: 'inline' | 'floating';
  onRetryConnection?: () => void;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected,
  connectionStatus,
  reconnectAttempts = 0,
  maxReconnectAttempts = 10,
  lastUpdateTime,
  className = '',
  showText = true,
  size = 'md',
  position = 'inline',
  onRetryConnection,
}) => {
  // Size configurations
  const sizeConfig = {
    sm: {
      dot: 'w-2 h-2',
      icon: 12,
      text: 'text-xs',
      container: 'gap-1',
    },
    md: {
      dot: 'w-3 h-3',
      icon: 14,
      text: 'text-sm',
      container: 'gap-2',
    },
    lg: {
      dot: 'w-4 h-4',
      icon: 16,
      text: 'text-base',
      container: 'gap-2',
    },
  };

  const config = sizeConfig[size];

  // Status-specific configurations
  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          color: 'bg-green-500',
          textColor: 'text-green-600',
          icon: <Wifi size={config.icon} className="text-green-600" />,
          label: 'Connected',
          description: 'Real-time updates active',
          pulse: false,
        };
      case 'connecting':
        return {
          color: 'bg-yellow-500',
          textColor: 'text-yellow-600',
          icon: <Loader2 size={config.icon} className="text-yellow-600 animate-spin" />,
          label: 'Connecting',
          description: 'Establishing connection...',
          pulse: true,
        };
      case 'disconnected':
        return {
          color: 'bg-gray-500',
          textColor: 'text-gray-600',
          icon: <WifiOff size={config.icon} className="text-gray-600" />,
          label: 'Disconnected',
          description: 'No real-time updates',
          pulse: false,
        };
      case 'error':
        return {
          color: 'bg-red-500',
          textColor: 'text-red-600',
          icon: <AlertTriangle size={config.icon} className="text-red-600" />,
          label: 'Error',
          description: reconnectAttempts >= maxReconnectAttempts 
            ? 'Connection failed - max retries reached' 
            : 'Connection error',
          pulse: true,
        };
      default:
        return {
          color: 'bg-gray-500',
          textColor: 'text-gray-600',
          icon: <WifiOff size={config.icon} className="text-gray-600" />,
          label: 'Unknown',
          description: 'Status unknown',
          pulse: false,
        };
    }
  };

  const statusConfig = getStatusConfig();

  // Format last update time
  const formatLastUpdate = () => {
    if (!lastUpdateTime) return 'Never';
    
    const now = Date.now();
    const diff = now - lastUpdateTime;
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Tooltip content
  const getTooltipContent = () => {
    const parts = [statusConfig.description];
    
    if (reconnectAttempts > 0) {
      parts.push(`Retry attempt: ${reconnectAttempts}/${maxReconnectAttempts}`);
    }
    
    if (lastUpdateTime && isConnected) {
      parts.push(`Last update: ${formatLastUpdate()}`);
    }

    return parts.join('\n');
  };

  // Base classes
  const baseClasses = position === 'floating'
    ? 'fixed top-4 right-4 z-50 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg px-3 py-2 shadow-lg'
    : 'inline-flex items-center';

  const containerClasses = `
    ${baseClasses}
    ${config.container}
    ${className}
  `.trim();

  return (
    <div 
      className={containerClasses}
      title={getTooltipContent()}
      role="status"
      aria-label={`Connection status: ${statusConfig.label}`}
    >
      {/* Status indicator dot */}
      <div className="relative">
        <div 
          className={`
            ${config.dot} 
            ${statusConfig.color} 
            rounded-full
            ${statusConfig.pulse ? 'animate-pulse' : ''}
          `}
        />
        {/* Pulse ring for active states */}
        {(connectionStatus === 'connecting' || connectionStatus === 'connected') && (
          <div 
            className={`
              absolute inset-0 
              ${config.dot} 
              ${statusConfig.color} 
              rounded-full 
              animate-ping 
              opacity-75
            `}
          />
        )}
      </div>

      {/* Status text and icon */}
      {showText && (
        <>
          {statusConfig.icon}
          <span className={`${config.text} ${statusConfig.textColor} font-medium`}>
            {statusConfig.label}
          </span>
          
          {/* Additional info for error state */}
          {connectionStatus === 'error' && reconnectAttempts >= maxReconnectAttempts && onRetryConnection && (
            <button
              onClick={onRetryConnection}
              className="ml-2 text-xs text-blue-600 hover:text-blue-800 underline"
              type="button"
            >
              Retry
            </button>
          )}
        </>
      )}
    </div>
  );
};

// Hook variant that provides connection status from context
export const useConnectionStatus = () => {
  // This could be expanded to use a context provider
  // For now, return basic values
  return {
    isConnected: false,
    connectionStatus: 'disconnected' as const,
    reconnectAttempts: 0,
    maxReconnectAttempts: 10,
    lastUpdateTime: undefined,
  };
};

export default ConnectionStatus;