/**
 * Connection Monitor Component
 * Displays real-time connection status, quality, and metrics
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useConnectionWithFallback } from '../hooks/useConnectionWithFallback';

// Define local types to avoid import issues
type ConnectionMode = 'websocket' | 'polling' | 'hybrid' | 'offline';
type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';

interface ConnectionMetrics {
  latency: number;
  uptime: number;
  dataUpdates: number;
  modeChanges: number;
}

interface WebSocketConnection {
  isConnected: boolean;
  isConnecting: boolean;
  sessionId?: string;
}

interface Connection {
  mode: ConnectionMode;
  quality: ConnectionQuality;
  isConnected: boolean;
  isTransitioning: boolean;
  dataVersion: number;
  lastUpdate: number | null;
  metrics: ConnectionMetrics;
  websocket?: WebSocketConnection;
  forceMode: (mode: ConnectionMode) => void;
  refresh: () => void;
};
import { 
  WifiIcon,
  SignalIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

interface ConnectionMonitorProps {
  userId?: string;
  sessionId?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  expanded?: boolean;
  onModeChange?: (mode: ConnectionMode) => void;
  className?: string;
}

export const ConnectionMonitor: React.FC<ConnectionMonitorProps> = ({
  userId,
  sessionId,
  position = 'bottom-right',
  expanded: initialExpanded = false,
  onModeChange,
  className
}) => {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [showDetails, setShowDetails] = useState(false);

  const connection = useConnectionWithFallback({
    userId,
    sessionId,
    preferWebSocket: true,
    autoFallback: true,
    hybridMode: false,
    onModeChange
  }) as Connection;

  // Position classes
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  // Mode colors and icons - memoized for performance
  const getModeConfig = useCallback((mode: ConnectionMode) => {
    switch (mode) {
      case 'websocket':
        return {
          color: 'text-green-500',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          icon: WifiIcon,
          label: 'WebSocket'
        };
      case 'polling':
        return {
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          icon: ArrowPathIcon,
          label: 'Polling'
        };
      case 'hybrid':
        return {
          color: 'text-blue-500',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          icon: SignalIcon,
          label: 'Hybrid'
        };
      case 'offline':
        return {
          color: 'text-red-500',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          icon: WifiIcon,
          label: 'Offline'
        };
      default:
        return {
          color: 'text-gray-500',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          icon: ExclamationTriangleIcon,
          label: 'Unknown'
        };
    }
  }, []);

  // Quality indicators - memoized for performance
  const getQualityConfig = useCallback((quality: ConnectionQuality) => {
    switch (quality) {
      case 'excellent':
        return { bars: 4, color: 'bg-green-500', label: 'Excellent' };
      case 'good':
        return { bars: 3, color: 'bg-green-400', label: 'Good' };
      case 'fair':
        return { bars: 2, color: 'bg-yellow-500', label: 'Fair' };
      case 'poor':
        return { bars: 1, color: 'bg-red-500', label: 'Poor' };
      case 'offline':
        return { bars: 0, color: 'bg-gray-400', label: 'Offline' };
      default:
        return { bars: 0, color: 'bg-gray-400', label: 'Unknown' };
    }
  }, []);

  // Memoize configurations to prevent unnecessary re-calculations
  const modeConfig = useMemo(() => getModeConfig(connection.mode), [connection.mode, getModeConfig]);
  const qualityConfig = useMemo(() => getQualityConfig(connection.quality), [connection.quality, getQualityConfig]);
  const ModeIcon = modeConfig?.icon;

  // Format uptime - memoized for performance
  const formatUptime = useCallback((ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }, []);

  // Auto-collapse after mode change
  useEffect(() => {
    if (connection.isTransitioning) {
      setExpanded(true);
      const timer = setTimeout(() => {
        setExpanded(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined; // Explicit return for when not transitioning
  }, [connection.isTransitioning]);

  return (
    <div
      className={clsx(
        'fixed z-50 transition-all duration-300',
        positionClasses[position],
        className
      )}
    >
      {/* Compact View */}
      <div
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg cursor-pointer',
          'backdrop-blur-sm bg-white/90 dark:bg-gray-800/90',
          'border transition-all hover:shadow-xl',
          modeConfig.borderColor,
          expanded && 'rounded-b-none'
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <ModeIcon className={clsx('w-5 h-5', modeConfig.color)} />
        
        {/* Quality Bars */}
        <div className="flex gap-0.5">
          {[1, 2, 3, 4].map((bar: number) => (
            <div
              key={bar}
              className={clsx(
                'w-1 transition-all',
                bar <= qualityConfig.bars ? qualityConfig.color : 'bg-gray-300',
                bar === 1 && 'h-2',
                bar === 2 && 'h-3',
                bar === 3 && 'h-4',
                bar === 4 && 'h-5'
              )}
            />
          ))}
        </div>

        {/* Status Text */}
        <span className={clsx('text-sm font-medium', modeConfig.color)}>
          {modeConfig.label}
        </span>

        {/* Latency Badge */}
        {connection?.metrics?.latency > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {connection?.metrics?.latency}ms
          </span>
        )}

        {/* Transition Indicator */}
        {connection.isTransitioning && (
          <ArrowPathIcon className="w-4 h-4 animate-spin text-gray-500" />
        )}
      </div>

      {/* Expanded View */}
      {expanded && (
        <div
          className={clsx(
            'mt-0 p-4 rounded-b-lg shadow-lg',
            'backdrop-blur-sm bg-white/90 dark:bg-gray-800/90',
            'border border-t-0',
            modeConfig.borderColor
          )}
        >
          {/* Connection Details */}
          <div className="space-y-3">
            {/* Quality */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Quality</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{qualityConfig.label}</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4].map((bar: number) => (
                    <div
                      key={bar}
                      className={clsx(
                        'w-2 h-3',
                        bar <= qualityConfig.bars ? qualityConfig.color : 'bg-gray-300'
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Latency */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Latency</span>
              <span className="text-sm font-medium">
                {connection?.metrics?.latency}ms
              </span>
            </div>

            {/* Uptime */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Uptime</span>
              <span className="text-sm font-medium">
                {formatUptime(connection?.metrics?.uptime)}
              </span>
            </div>

            {/* Data Updates */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Updates</span>
              <span className="text-sm font-medium">
                {connection?.metrics?.dataUpdates}
              </span>
            </div>

            {/* Mode Changes */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Mode Changes</span>
              <span className="text-sm font-medium">
                {connection?.metrics?.modeChanges}
              </span>
            </div>

            {/* WebSocket Status */}
            {connection?.websocket?.isConnected && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Session</span>
                <span className="text-xs font-mono">
                  {connection?.websocket?.sessionId?.substring(0, 8)}...
                </span>
              </div>
            )}

            {/* Last Update */}
            {connection.lastUpdate && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Last Update</span>
                <span className="text-sm font-medium">
                  {new Date(connection.lastUpdate).toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <button
                onClick={() => connection.forceMode('websocket')}
                className={clsx(
                  'flex-1 px-2 py-1 text-xs rounded transition-colors',
                  connection.mode === 'websocket'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                WebSocket
              </button>
              <button
                onClick={() => connection.forceMode('polling')}
                className={clsx(
                  'flex-1 px-2 py-1 text-xs rounded transition-colors',
                  connection.mode === 'polling'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                Polling
              </button>
              <button
                onClick={() => connection.forceMode('hybrid')}
                className={clsx(
                  'flex-1 px-2 py-1 text-xs rounded transition-colors',
                  connection.mode === 'hybrid'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                Hybrid
              </button>
            </div>

            <button
              onClick={() => connection.refresh()}
              className="mt-2 w-full px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              Refresh Data
            </button>

            {/* Debug Toggle */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="mt-2 w-full px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
            >
              {showDetails ? 'Hide' : 'Show'} Debug Info
            </button>
          </div>

          {/* Debug Details */}
          {showDetails && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-32">
                {JSON.stringify({
                  mode: connection.mode,
                  quality: connection.quality,
                  isConnected: connection.isConnected,
                  isTransitioning: connection.isTransitioning,
                  dataVersion: connection.dataVersion,
                  metrics: connection.metrics,
                  websocket: {
                    connected: connection?.websocket?.isConnected,
                    connecting: connection?.websocket?.isConnecting
                  }
                }, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConnectionMonitor;