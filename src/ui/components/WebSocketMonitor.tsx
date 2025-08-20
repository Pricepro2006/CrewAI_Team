/**
 * WebSocket Connection Monitor Component
 * Displays real-time WebSocket connection status and message flow
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useWebSocketConnection, WebSocketMessage } from '../hooks/useWebSocketConnection.js';

interface MessageLog {
  id: string;
  message: WebSocketMessage;
  timestamp: number;
}

export const WebSocketMonitor: React.FC = () => {
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [testMessage, setTestMessage] = useState('');

  // Memoize callback functions to prevent unnecessary re-renders
  const onMessage = useCallback((message: any) => {
    const logEntry: MessageLog = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message,
      timestamp: Date.now()
    };
    
    setMessages(prev => [logEntry, ...prev.slice(0, 49)]); // Keep last 50 messages
  }, []);

  const onConnect = useCallback(() => {
    console.log('WebSocket Monitor: Connected');
  }, []);

  const onDisconnect = useCallback(() => {
    console.log('WebSocket Monitor: Disconnected');
  }, []);

  const onError = useCallback((error: any) => {
    console.error('WebSocket Monitor: Error', error);
  }, []);

  const {
    connected,
    connecting,
    error,
    connectionCount,
    reconnectAttempts,
    sendMessage,
    reconnect
  } = useWebSocketConnection({
    onMessage,
    onConnect,
    onDisconnect,
    onError
  });

  const handleSendTest = useCallback(() => {
    if (!testMessage.trim()) return;
    
    const sent = sendMessage({
      type: 'test',
      data: { message: testMessage, timestamp: Date.now() },
      timestamp: new Date().toISOString()
    });
    
    if (sent) {
      setTestMessage('');
    }
  }, [testMessage, sendMessage]);

  const handleSendPing = useCallback(() => {
    sendMessage({
      type: 'ping',
      data: { timestamp: Date.now() },
      timestamp: new Date().toISOString()
    });
  }, [sendMessage]);

  const getConnectionStatus = useCallback(() => {
    if (connecting) return { text: 'Connecting...', color: 'text-yellow-600 bg-yellow-100' };
    if (connected) return { text: 'Connected', color: 'text-green-600 bg-green-100' };
    if (error) return { text: `Error: ${error}`, color: 'text-red-600 bg-red-100' };
    return { text: 'Disconnected', color: 'text-gray-600 bg-gray-100' };
  }, [connecting, connected, error]);

  const status = getConnectionStatus();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">WebSocket Monitor</h2>
          <p className="text-gray-600">Real-time WebSocket connection monitoring</p>
        </div>

        <div className="p-6">
          {/* Connection Status */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
                  {status.text}
                </div>
                <div className="text-sm text-gray-500">
                  Connections: {connectionCount} | Reconnect attempts: {reconnectAttempts}
                </div>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={handleSendPing}
                  disabled={!connected}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Send Ping
                </button>
                <button
                  onClick={reconnect}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Reconnect
                </button>
              </div>
            </div>

            {/* Test Message Input */}
            <div className="flex space-x-2">
              <input
                type="text"
                value={testMessage}
                onChange={(e: any) => setTestMessage(e?.target?.value)}
                onKeyPress={(e: any) => e.key === 'Enter' && handleSendTest()}
                placeholder="Enter test message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!connected}
              />
              <button
                onClick={handleSendTest}
                disabled={!connected || !testMessage.trim()}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Send Test
              </button>
            </div>
          </div>

          {/* Message Log */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Message Log</h3>
            <div className="bg-gray-50 rounded-lg max-h-96 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No messages received yet
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {messages?.map((log: any) => (
                    <div key={log.id} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-600">
                          {log?.message?.type}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700">
                        <pre className="bg-white p-2 rounded text-xs overflow-x-auto">
                          {JSON.stringify(log?.message?.data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};