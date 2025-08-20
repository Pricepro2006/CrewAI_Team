/**
 * Health Dashboard Component
 * Real-time system health monitoring interface
 */

import React, { useState, useEffect } from "react";
import { 
  HeartIcon, 
  ServerIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ClockIcon
} from "@heroicons/react/24/outline";
import { trpc as api } from "../utils/trpc";

// Define interfaces matching the actual API response
interface HealthCheckResult {
  serviceId: string;
  status: "healthy" | "degraded" | "unhealthy";
  lastCheck: string | Date;
  latency?: number;
  message?: string;
  details?: Record<string, unknown>;
  metrics?: {
    responseTime?: number;
    memory?: number;
  };
}

interface AggregatedHealth {
  status: "healthy" | "degraded" | "unhealthy";
  uptime: number;
  services?: HealthCheckResult[];
  metrics?: {
    responseTime?: number;
    memory?: number;
  };
}

interface ServiceHealth {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  lastCheck: string | Date;
  latency?: number;
  message?: string;
  details?: Record<string, unknown>;
}

interface ServiceCardProps {
  service: ServiceHealth;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service }): React.ReactElement => {
  const getStatusColor = (status: string): string => {
    switch (status) {
      case "healthy":
        return "bg-green-100 text-green-800 border-green-300";
      case "degraded":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "unhealthy":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getStatusIcon = (status: string): React.ReactElement => {
    switch (status) {
      case "healthy":
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case "degraded":
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />;
      case "unhealthy":
        return <XCircleIcon className="h-5 w-5 text-red-600" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${getStatusColor(service.status)}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold capitalize">{service?.name?.replace("-", " ")}</h3>
        {getStatusIcon(service.status)}
      </div>
      
      {service.latency && (
        <div className="text-sm">
          <span className="font-medium">Latency:</span> {service.latency}ms
        </div>
      )}
      
      {service.message && (
        <div className="text-sm mt-1">
          <span className="font-medium">Message:</span> {service.message}
        </div>
      )}
      
      {service.details && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-medium">Details</summary>
          <pre className="text-xs mt-1 p-2 bg-white bg-opacity-50 rounded">
            {JSON.stringify(service.details, null, 2)}
          </pre>
        </details>
      )}
      
      <div className="text-xs mt-2 opacity-75">
        Last check: {new Date(service.lastCheck).toLocaleTimeString()}
      </div>
    </div>
  );
};

export const HealthDashboard: React.FC = (): React.ReactElement => {
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [checkLevel, setCheckLevel] = useState<"basic" | "deep" | "full">("basic");

  // Get current health
  const { data: healthData, refetch: refetchHealth } = api?.healthCheck?.getCurrentHealth.useQuery(
    { level: checkLevel },
    {
      enabled: true,
      refetchInterval: autoRefresh ? 30000 : false, // Auto-refresh every 30s if enabled
    }
  );

  // Get health history
  const { data: historyData } = api?.healthCheck?.getHealthHistory.useQuery(
    { limit: 20 },
    {
      enabled: true,
      refetchInterval: autoRefresh ? 60000 : false,
    }
  );

  // Get health trends
  const { data: trendsData } = api?.healthCheck?.getHealthTrends.useQuery(
    { hours: 1 },
    {
      enabled: true,
      refetchInterval: autoRefresh ? 60000 : false,
    }
  );

  // Trigger manual health check
  const triggerCheckMutation = api?.healthCheck?.triggerHealthCheck.useMutation({
    onSuccess: () => {
      refetchHealth();
    },
  });

  const health = healthData?.health as AggregatedHealth | undefined;
  const history = (historyData?.history || []) as any;
  const trends = trendsData?.trends;

  const getSystemStatusColor = (status?: string): string => {
    switch (status) {
      case "healthy":
        return "bg-green-500";
      case "degraded":
        return "bg-yellow-500";
      case "unhealthy":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <HeartIcon className="h-8 w-8 text-red-500" />
              System Health Dashboard
            </h1>
            
            <div className="flex items-center gap-4">
              {/* Check Level Selector */}
              <select
                value={checkLevel}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCheckLevel(e.target.value as "basic" | "deep" | "full")}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="basic">Basic Check</option>
                <option value="deep">Deep Check</option>
                <option value="full">Full Check</option>
              </select>
              
              {/* Auto-refresh Toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Auto-refresh</span>
              </label>
              
              {/* Manual Refresh Button */}
              <button
                onClick={(): void => { triggerCheckMutation.mutate({ level: checkLevel }); }}
                disabled={triggerCheckMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <ArrowPathIcon className={`h-5 w-5 ${triggerCheckMutation.isPending ? "animate-spin" : ""}`} />
                Check Now
              </button>
            </div>
          </div>

          {/* System Status */}
          {health && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">System Status</div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getSystemStatusColor(health?.status)}`} />
                  <span className="text-xl font-semibold capitalize">{health?.status || 'unknown'}</span>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Uptime</div>
                <div className="text-xl font-semibold">{formatUptime(health?.uptime || 0)}</div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Response Time</div>
                <div className="text-xl font-semibold">{health?.metrics?.responseTime || 0}ms</div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Memory Usage</div>
                <div className="text-xl font-semibold">
                  {health?.metrics?.memory ? `${health.metrics.memory.toFixed(1)} MB` : "N/A"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Service Health Grid */}
        {health && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <ServerIcon className="h-6 w-6 text-blue-600" />
              Service Health
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {health?.services?.map((service: HealthCheckResult, index: number) => (
                <ServiceCard key={service.serviceId || `service-${index}`} service={{
                  name: service.serviceId,
                  status: service.status,
                  lastCheck: service.lastCheck,
                  latency: service.latency,
                  message: service.message,
                  details: service.details
                }} />
              )) || []}
            </div>
          </div>
        )}

        {/* Health Trends */}
        {trends && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Health Trends ({trendsData?.period})</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="text-sm text-green-600 mb-1">Healthy</div>
                <div className="text-2xl font-bold text-green-800">
                  {trends?.healthyPercentage?.toFixed(1)}%
                </div>
              </div>
              
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <div className="text-sm text-yellow-600 mb-1">Degraded</div>
                <div className="text-2xl font-bold text-yellow-800">
                  {trends?.degradedPercentage?.toFixed(1)}%
                </div>
              </div>
              
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <div className="text-sm text-red-600 mb-1">Unhealthy</div>
                <div className="text-2xl font-bold text-red-800">
                  {trends?.unhealthyPercentage?.toFixed(1)}%
                </div>
              </div>
            </div>
            
            {Object.keys(trends.serviceFailures).length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold mb-2">Service Failures</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(trends.serviceFailures || {}).map(([service, count]: [string, unknown]) => (
                    <span key={service} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                      {service}: {String(count)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Health History */}
        {history?.length || 0 > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Health Checks</h2>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Response Time</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Services</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {history.slice(0, 10).map((check: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">
                        {check.lastCheck ? new Date(check.lastCheck).toLocaleTimeString() : 'N/A'}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          check.status === "healthy" ? "bg-green-100 text-green-800" :
                          check.status === "degraded" ? "bg-yellow-100 text-yellow-800" :
                          "bg-red-100 text-red-800"
                        }`}>
                          {check.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {check?.metrics?.responseTime || 0}ms
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <div className="flex gap-1">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            check.status === "healthy" ? "bg-green-100 text-green-800" :
                            check.status === "degraded" ? "bg-yellow-100 text-yellow-800" :
                            "bg-red-100 text-red-800"
                          }`}>
                            {check.serviceId || "System"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};