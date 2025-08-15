/**
 * Walmart Smart Connection Component
 * Uses intelligent WebSocket with automatic polling fallback
 */

import React, { useEffect, useState } from 'react';
import { useSmartWebSocket } from '../hooks/useSmartWebSocket.js';
import { ConnectionMonitor } from './ConnectionMonitor.js';
import { toast } from 'react-hot-toast';
import { 
  WifiIcon, 
  ArrowPathIcon,
  ExclamationCircleIcon,
  CheckCircleIcon 
} from '@heroicons/react/24/outline';

interface WalmartSmartConnectionProps {
  userId?: string;
  sessionId?: string;
  onDataReceived?: (data: any) => void;
  children?: React.ReactNode;
}

export const WalmartSmartConnection: React.FC<WalmartSmartConnectionProps> = ({
  userId = 'user123',
  sessionId,
  onDataReceived,
  children
}) => {
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [messageHistory, setMessageHistory] = useState<any[]>([]);

  const connection = useSmartWebSocket({
    wsUrl: `ws://localhost:3001/ws/walmart`,
    userId,
    sessionId,
    autoConnect: true,
    maxReconnectAttempts: 5,
    reconnectInterval: 2000,
    fallbackEnabled: true,
    fallbackThreshold: 3,
    pollingInterval: 5000,
    onConnect: () => {
      toast.success('Connected to Walmart service', {
        icon: <CheckCircleIcon className="w-5 h-5" />,
        duration: 3000
      });
    },
    onDisconnect: () => {
      toast.error('Disconnected from Walmart service', {
        icon: <ExclamationCircleIcon className="w-5 h-5" />,
        duration: 3000
      });
    },
    onMessage: (message: any) => {
      setLastUpdate(new Date());
      setMessageHistory(prev => [...prev.slice(-9), message]);
      onDataReceived?.(message);
    },
    onModeChange: (mode: any) => {
      const modeMessages = {
        websocket: 'Real-time connection established',
        polling: 'Switched to polling mode (fallback)',
        offline: 'Connection lost'
      };
      
      const modeIcons = {
        websocket: <WifiIcon className="w-5 h-5" />,
        polling: <ArrowPathIcon className="w-5 h-5" />,
        offline: <ExclamationCircleIcon className="w-5 h-5" />
      };

      if (mode !== 'offline') {
        toast(modeMessages[mode] || 'Connection mode changed', {
          icon: modeIcons[mode],
          duration: 4000
        });
      }
    }
  });

  // Send test message
  const sendTestMessage = () => {
    const success = connection.sendMessage({
      type: 'ping',
      timestamp: Date.now()
    });

    if (success) {
      toast.success('Test message sent');
    } else {
      toast.error('Cannot send message - using polling mode');
    }
  };

  // Connection status indicator
  const getStatusColor = () => {
    if (!connection.isConnected) return 'bg-red-500';
    if (connection.mode === 'websocket') return 'bg-green-500';
    if (connection.mode === 'polling') return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  const getStatusText = () => {
    if (connection.isConnecting) return 'Connecting...';
    if (!connection.isConnected) return 'Offline';
    if (connection.mode === 'websocket') return 'Real-time';
    if (connection.mode === 'polling') return 'Polling';
    return 'Unknown';
  };

  return (
    <div className="relative">
      {/* Connection Status Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={`w-3 h-3 rounded-full ${getStatusColor()} animate-pulse`} />
              {connection.isConnecting && (
                <div className="absolute inset-0 w-3 h-3 rounded-full bg-gray-400 animate-ping" />
              )}
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Connection Status: <span className="font-bold">{getStatusText()}</span>
              </p>
              {connection.mode === 'polling' && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Fallback active - updates every 5 seconds
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quality Indicator */}
            <div className="flex flex-col items-end">
              <span className="text-xs text-gray-500">Quality</span>
              <span className="text-sm font-medium capitalize">{connection.quality}</span>
            </div>

            {/* Reconnect Attempts */}
            {connection.reconnectAttempts > 0 && (
              <div className="flex flex-col items-end">
                <span className="text-xs text-gray-500">Retries</span>
                <span className="text-sm font-medium">{connection.reconnectAttempts}/5</span>
              </div>
            )}

            {/* Last Update */}
            {lastUpdate && (
              <div className="flex flex-col items-end">
                <span className="text-xs text-gray-500">Last Update</span>
                <span className="text-sm font-medium">
                  {lastUpdate.toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Connection Actions */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => connection.reconnect()}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            disabled={connection.isConnecting}
          >
            Reconnect
          </button>
          
          <button
            onClick={() => connection.switchMode('websocket')}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              connection.mode === 'websocket' 
                ? 'bg-green-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            disabled={connection.isConnecting}
          >
            WebSocket
          </button>
          
          <button
            onClick={() => connection.switchMode('polling')}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              connection.mode === 'polling' 
                ? 'bg-yellow-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            disabled={connection.isConnecting}
          >
            Polling
          </button>

          <button
            onClick={sendTestMessage}
            className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            disabled={!connection.canSend}
          >
            Test Message
          </button>
        </div>

        {/* Error Display */}
        {connection.lastError && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-700">
              Error: {connection?.lastError?.message}
            </p>
          </div>
        )}
      </div>

      {/* Message History (Debug) */}
      {process.env.NODE_ENV === 'development' && messageHistory?.length || 0 > 0 && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Recent Messages ({messageHistory?.length || 0})
          </h3>
          <div className="space-y-1 max-h-32 overflow-auto">
            {messageHistory?.map((msg, idx) => (
              <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                {JSON.stringify(msg).substring(0, 100)}...
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Child Components */}
      <div className="relative">
        {children}
        
        {/* Overlay when offline */}
        {!connection.isConnected && !connection.isConnecting && (
          <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
            <div className="text-center">
              <ExclamationCircleIcon className="w-12 h-12 text-red-500 mx-auto mb-2" />
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Connection Lost
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Attempting to reconnect...
              </p>
              <button
                onClick={() => connection.reconnect()}
                className="mt-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Retry Now
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Connection Monitor */}
      <ConnectionMonitor 
        userId={userId}
        sessionId={sessionId}
        position="bottom-right"
        expanded={false}
      />
    </div>
  );
};

export default WalmartSmartConnection;