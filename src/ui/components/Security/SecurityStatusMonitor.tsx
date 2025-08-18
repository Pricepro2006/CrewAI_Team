import React, { useEffect, useState } from "react";
import {
  Shield,
  CheckCircle,
  AlertCircle,
  XCircle,
  Wifi,
  Lock,
  Key,
} from "lucide-react";
import { useCSRFStatus } from "../../hooks/useTRPCWithCSRF.js";
import { api } from "../../../lib/trpc.js";

interface SecurityStatus {
  cors: boolean;
  csp: boolean;
  csrf: boolean;
  websocket: boolean;
  authentication: boolean;
  headers: {
    [key: string]: string | null;
  };
}

export const SecurityStatusMonitor: React.FC = () => {
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus>({
    cors: false,
    csp: false,
    csrf: false,
    websocket: false,
    authentication: false,
    headers: {},
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const csrfStatus = useCSRFStatus();

  // Check security status
  useEffect(() => {
    const checkSecurity = async () => {
      try {
        // Test CORS by making a request
        const response = await fetch(`${window?.location?.origin}/api/health`, {
          credentials: "include",
        });

        const newStatus: SecurityStatus = {
          cors: response.ok,
          csp:
            !!document.querySelector(
              'meta[http-equiv="Content-Security-Policy"]',
            ) || response?.headers?.get("content-security-policy") !== null,
          csrf: csrfStatus.hasToken,
          websocket: false, // Will be updated by WebSocket check
          authentication: !!localStorage.getItem("token"),
          headers: {
            "X-Frame-Options": response?.headers?.get("x-frame-options"),
            "X-Content-Type-Options": response?.headers?.get(
              "x-content-type-options",
            ),
            "X-XSS-Protection": response?.headers?.get("x-xss-protection"),
            "Referrer-Policy": response?.headers?.get("referrer-policy"),
            "Permissions-Policy": response?.headers?.get("permissions-policy"),
          },
        };

        setSecurityStatus(newStatus);
      } catch (error) {
        console.error("Security check failed:", error);
      }
    };

    checkSecurity();
    const interval = setInterval(checkSecurity, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [csrfStatus.hasToken]);

  // Check WebSocket status
  const { data: wsStatus } = (api?.websocket?.status as any)?.useQuery?.(undefined, {
    refetchInterval: 30000,
  }) || { data: null };

  useEffect(() => {
    if (wsStatus) {
      setSecurityStatus((prev: any) => ({ ...prev, websocket: wsStatus.connected }));
    }
  }, [wsStatus]);

  const getOverallStatus = () => {
    const checks = [
      securityStatus.cors,
      securityStatus.csp,
      securityStatus.csrf,
      securityStatus.websocket,
      Object.values(securityStatus.headers).filter((h: any) => h !== null).length >=
        3,
    ];

    const passedChecks = checks?.filter((c: any) => c).length;

    if (passedChecks === (checks?.length || 0)) return "secure";
    if (passedChecks >= (checks?.length || 0) * 0.7) return "warning";
    return "error";
  };

  const overallStatus = getOverallStatus();

  const StatusIcon = ({ status }: { status: boolean | null }) => {
    if (status === true)
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === false) return <XCircle className="w-4 h-4 text-red-500" />;
    return <AlertCircle className="w-4 h-4 text-yellow-500" />;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            overallStatus === "secure"
              ? "text-green-600 dark:text-green-400"
              : overallStatus === "warning"
                ? "text-yellow-600 dark:text-yellow-400"
                : "text-red-600 dark:text-red-400"
          }`}
        >
          <Shield className="w-5 h-5" />
          <span className="font-medium">Security Status</span>
          {overallStatus === "secure" && <CheckCircle className="w-4 h-4" />}
          {overallStatus === "warning" && <AlertCircle className="w-4 h-4" />}
          {overallStatus === "error" && <XCircle className="w-4 h-4" />}
        </button>

        {isExpanded && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-3">
            {/* Main Security Features */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">
                Core Security
              </h3>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <Wifi className="w-4 h-4" /> CORS Protection
                </span>
                <StatusIcon status={securityStatus.cors} />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Content Security Policy
                </span>
                <StatusIcon status={securityStatus.csp} />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <Key className="w-4 h-4" /> CSRF Protection
                </span>
                <StatusIcon status={securityStatus.csrf} />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <Wifi className="w-4 h-4" /> WebSocket Security
                </span>
                <StatusIcon status={securityStatus.websocket} />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <Lock className="w-4 h-4" /> Authentication
                </span>
                <StatusIcon status={securityStatus.authentication} />
              </div>
            </div>

            {/* Security Headers */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">
                Security Headers
              </h3>
              {Object.entries(securityStatus.headers).map(([header, value]) => (
                <div key={header} className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {header}
                  </span>
                  <StatusIcon status={value !== null} />
                </div>
              ))}
            </div>

            {/* CSRF Token Status */}
            {csrfStatus.hasToken && (
              <div className="text-xs text-gray-500 dark:text-gray-400 border-t pt-2">
                <div>CSRF Token Age: {csrfStatus.tokenAge}</div>
                {csrfStatus.lastRefresh && (
                  <div>
                    Last Refresh: {typeof csrfStatus?.lastRefresh === 'object' && csrfStatus?.lastRefresh instanceof Date ? csrfStatus?.lastRefresh?.toLocaleTimeString() : 'Unknown'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
