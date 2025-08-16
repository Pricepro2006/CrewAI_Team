/**
 * WebSocket Test Panel Component
 * Provides a comprehensive testing interface for WebSocket connections
 * and real-time updates functionality
 */

import React, { useState, useEffect } from 'react';
import { useWebSocketConnection } from '../hooks/useWebSocketConnection.js';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useRealTimeUpdates } from '../hooks/useRealTimeUpdates.js';
import { getWebSocketDebugInfo, getWebSocketEndpoints } from '../../config/websocket.config.js';

interface TestResult {
  test: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
  timestamp: string;
}

export const WebSocketTestPanel: React.FC = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<'native' | 'trpc'>('native');

  // Native WebSocket connection
  const nativeWebSocket = useWebSocketConnection({
    onConnect: () => addTestResult('Native WebSocket Connection', 'success', 'Connected successfully'),
    onDisconnect: () => addTestResult('Native WebSocket Connection', 'error', 'Disconnected'),
    onError: (error) => addTestResult('Native WebSocket Connection', 'error', `Error: ${error.message}`),
    onMessage: (message) => addTestResult('Native WebSocket Message', 'success', `Received: ${message.type}`)
  });

  // tRPC WebSocket connection
  const trpcWebSocket = useWebSocket({
    onConnect: () => addTestResult('tRPC WebSocket Connection', 'success', 'Connected successfully'),
    onDisconnect: () => addTestResult('tRPC WebSocket Connection', 'error', 'Disconnected'),
    onError: (error) => addTestResult('tRPC WebSocket Connection', 'error', `Error: ${error.message}`)
  });

  // Real-time updates hook
  const realTimeUpdates = useRealTimeUpdates({
    onAgentStatusChange: (agentId, status) => 
      addTestResult('Agent Status Update', 'success', `Agent ${agentId}: ${status.status}`),
    onPlanProgress: (planId, update) => 
      addTestResult('Plan Progress Update', 'success', `Plan ${planId}: ${update.status}`),
    onRAGOperation: (operation) => 
      addTestResult('RAG Operation', 'success', `${operation.operation}: ${operation.status}`),
    onSystemHealthChange: (health) => 
      addTestResult('System Health Update', 'success', `Services: ${Object.keys(health.services).length}`)
  });

  const addTestResult = (test: string, status: TestResult['status'], message: string) => {
    setTestResults(prev => [...prev, {
      test,
      status,
      message,
      timestamp: new Date().toISOString()
    }]);
  };

  // Test functions
  const testNativeWebSocketConnection = async () => {
    addTestResult('Native WebSocket Connection', 'running', 'Attempting connection...');
    try {
      nativeWebSocket.connect();
    } catch (error) {
      addTestResult('Native WebSocket Connection', 'error', `Failed: ${(error as Error).message}`);
    }
  };

  const testTRPCWebSocketConnection = async () => {
    addTestResult('tRPC WebSocket Connection', 'running', 'Attempting connection...');
    try {
      trpcWebSocket.connect();
    } catch (error) {
      addTestResult('tRPC WebSocket Connection', 'error', `Failed: ${(error as Error).message}`);
    }
  };

  const testMessageSending = () => {
    const activeConnection = selectedEndpoint === 'native' ? nativeWebSocket : trpcWebSocket;
    
    if (!activeConnection.isConnected) {
      addTestResult('Message Sending', 'error', 'No active connection');
      return;
    }

    addTestResult('Message Sending', 'running', 'Sending test message...');
    
    try {
      if (selectedEndpoint === 'native') {
        nativeWebSocket.sendMessage({
          type: 'ping',
          data: { test: true, timestamp: Date.now() },
          timestamp: new Date().toISOString()
        });
      } else {
        // tRPC doesn't support direct message sending
        addTestResult('Message Sending', 'error', 'tRPC WebSocket doesn\'t support direct messaging');
      }
    } catch (error) {
      addTestResult('Message Sending', 'error', `Failed: ${(error as Error).message}`);
    }
  };

  const testReconnection = () => {
    const activeConnection = selectedEndpoint === 'native' ? nativeWebSocket : trpcWebSocket;
    
    addTestResult('Reconnection Test', 'running', 'Testing reconnection...');
    
    // Disconnect and then reconnect
    activeConnection.disconnect();
    setTimeout(() => {
      activeConnection.connect();
    }, 2000);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const endpoints = getWebSocketEndpoints();
  const debugInfo = getWebSocketDebugInfo();

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">WebSocket Test Panel</h2>
        <p className="text-gray-600">Test WebSocket connections and real-time functionality</p>
      </div>

      {/* Debug Information */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-2">Configuration Info</h3>
        <pre className="text-sm text-gray-700 whitespace-pre-wrap">
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      </div>

      {/* Connection Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 border rounded-lg">
          <h4 className="font-semibold text-gray-900 mb-2">Native WebSocket</h4>
          <div className="space-y-1">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${
                nativeWebSocket.isConnected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm">{nativeWebSocket.connectionStatus}</span>
            </div>
            <div className="text-xs text-gray-500">
              Reconnect attempts: {nativeWebSocket.reconnectAttempts}
            </div>
          </div>
        </div>

        <div className="p-4 border rounded-lg">
          <h4 className="font-semibold text-gray-900 mb-2">tRPC WebSocket</h4>
          <div className="space-y-1">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${
                trpcWebSocket.isConnected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm">{trpcWebSocket.connectionStatus}</span>
            </div>
            <div className="text-xs text-gray-500">
              Reconnect attempts: {trpcWebSocket.reconnectAttempts}
            </div>
          </div>
        </div>

        <div className="p-4 border rounded-lg">
          <h4 className="font-semibold text-gray-900 mb-2">Real-time Updates</h4>
          <div className="space-y-1">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${
                realTimeUpdates.isConnected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm">{realTimeUpdates.connectionStatus}</span>
            </div>
            <div className="text-xs text-gray-500">
              Active agents: {realTimeUpdates.getActiveAgents().length}
            </div>
            <div className="text-xs text-gray-500">
              Active plans: {realTimeUpdates.getActivePlans().length}
            </div>
          </div>
        </div>
      </div>

      {/* Test Controls */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">Test Controls</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Endpoint for Testing:
          </label>
          <select 
            value={selectedEndpoint}
            onChange={(e) => setSelectedEndpoint(e.target.value as 'native' | 'trpc')}
            className="border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="native">Native WebSocket (port 8080)</option>
            <option value="trpc">tRPC WebSocket (port 3000)</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={testNativeWebSocketConnection}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Test Native Connection
          </button>
          <button
            onClick={testTRPCWebSocketConnection}
            className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600"
          >
            Test tRPC Connection
          </button>
          <button
            onClick={testMessageSending}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            Test Message Sending
          </button>
          <button
            onClick={testReconnection}
            className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
          >
            Test Reconnection
          </button>
          <button
            onClick={clearResults}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
          >
            Clear Results
          </button>
        </div>
      </div>

      {/* Real-time Data Display */}
      {realTimeUpdates.isConnected && (
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Real-time Data</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 border rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Agent Statuses ({realTimeUpdates.agentStatuses.length})</h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {realTimeUpdates.agentStatuses.map((agent, index) => (
                  <div key={index} className="text-xs flex justify-between">
                    <span>{agent.agentId}</span>
                    <span className={`font-medium ${
                      agent.status === 'busy' ? 'text-yellow-600' :
                      agent.status === 'idle' ? 'text-green-600' :
                      agent.status === 'error' ? 'text-red-600' : 'text-gray-600'
                    }`}>{agent.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 border rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Recent RAG Operations ({realTimeUpdates.ragOperations.length})</h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {realTimeUpdates.ragOperations.slice(0, 5).map((operation, index) => (
                  <div key={index} className="text-xs">
                    <div className="flex justify-between">
                      <span>{operation.operation}</span>
                      <span className={`font-medium ${
                        operation.status === 'completed' ? 'text-green-600' :
                        operation.status === 'failed' ? 'text-red-600' : 'text-yellow-600'
                      }`}>{operation.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Results */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Test Results ({testResults.length})</h3>
        <div className="border rounded-lg max-h-64 overflow-y-auto">
          {testResults.length === 0 ? (
            <div className="p-4 text-gray-500 text-center">No test results yet</div>
          ) : (
            <div className="divide-y">
              {testResults.slice().reverse().map((result, index) => (
                <div key={index} className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{result.test}</span>
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        result.status === 'success' ? 'bg-green-500' :
                        result.status === 'error' ? 'bg-red-500' :
                        result.status === 'running' ? 'bg-yellow-500' : 'bg-gray-500'
                      }`} />
                      <span className="text-xs text-gray-500">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-700">{result.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WebSocketTestPanel;