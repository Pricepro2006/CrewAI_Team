import React, { useEffect, useState } from "react";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";
import { useNetworkRecovery } from "../../hooks/useErrorRecovery.js";
import { cn } from "../../../utils/cn.js";
import "./NetworkStatus.css";

interface NetworkStatusProps {
  position?: "top" | "bottom";
  showWhenOnline?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number;
}

export function NetworkStatus({
  position = "top",
  showWhenOnline = false,
  autoHide = true,
  autoHideDelay = 3000,
}: NetworkStatusProps) {
  const { isOnline } = useNetworkRecovery();
  const [show, setShow] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastOnlineState, setLastOnlineState] = useState(isOnline);

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;

    // Show banner when going offline
    if (!isOnline && lastOnlineState) {
      setShow(true);
      setIsReconnecting(false);
    }

    // Handle coming back online
    if (isOnline && !lastOnlineState) {
      setIsReconnecting(true);

      if (showWhenOnline) {
        setShow(true);

        if (autoHide) {
          timer = setTimeout(() => {
            setShow(false);
            setIsReconnecting(false);
          }, autoHideDelay);
        }
      } else {
        // Hide immediately if not showing online status
        setShow(false);
        setIsReconnecting(false);
      }
    }

    setLastOnlineState(isOnline);

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [isOnline, lastOnlineState, showWhenOnline, autoHide, autoHideDelay]);

  if (!show) return null;

  return (
    <div
      className={cn(
        "network-status",
        position === "top" ? "network-status-top" : "network-status-bottom",
        isOnline ? "network-status-online" : "network-status-offline",
        isReconnecting && "network-status-reconnecting",
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="network-status-content">
        <div className="network-status-icon">
          {isReconnecting ? (
            <RefreshCw className="network-icon-reconnecting" size={18} />
          ) : isOnline ? (
            <Wifi size={18} />
          ) : (
            <WifiOff size={18} />
          )}
        </div>

        <span className="network-status-text">
          {isReconnecting
            ? "Reconnecting..."
            : isOnline
              ? "Back online"
              : "You are offline"}
        </span>

        {!isOnline && (
          <span className="network-status-detail">
            Some features may be unavailable
          </span>
        )}
      </div>

      <div
        className={cn(
          "network-status-progress",
          isReconnecting && "network-status-progress-active",
        )}
      />
    </div>
  );
}
