import React from "react";
import { AlertTriangle, X, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../utils/cn";
import "./ErrorModal.css";

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  error: Error | string;
  onRetry?: () => void;
  severity?: "warning" | "error" | "critical";
  showErrorDetails?: boolean;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  }>;
}

export function ErrorModal({
  isOpen,
  onClose,
  title = "An error occurred",
  error,
  onRetry,
  severity = "error",
  showErrorDetails = process.env.NODE_ENV === "development",
  actions,
}: ErrorModalProps) {
  const [copied, setCopied] = React.useState(false);
  const errorMessage = typeof error === "string" ? error : error.message;
  const errorStack = typeof error === "string" ? null : error.stack;

  const copyErrorDetails = async () => {
    const details = `Error: ${errorMessage}\n\nStack Trace:\n${errorStack || "Not available"}`;
    await navigator.clipboard.writeText(details);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const severityConfig = {
    warning: {
      icon: "⚠️",
      color: "error-modal-warning",
      title: "Warning",
    },
    error: {
      icon: "❌",
      color: "error-modal-error",
      title: "Error",
    },
    critical: {
      icon: "🚨",
      color: "error-modal-critical",
      title: "Critical Error",
    },
  };

  const config = severityConfig[severity];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn("error-modal-content", config.color)}>
        <DialogHeader>
          <div className="error-modal-header">
            <div className="error-modal-icon-wrapper">
              <span
                className="error-modal-icon"
                role="img"
                aria-label={config.title}
              >
                {config.icon}
              </span>
            </div>
            <button
              onClick={onClose}
              className="error-modal-close"
              aria-label="Close error dialog"
            >
              <X size={20} />
            </button>
          </div>

          <DialogTitle className="error-modal-title">
            {title || config.title}
          </DialogTitle>

          <DialogDescription className="error-modal-description">
            {errorMessage}
          </DialogDescription>
        </DialogHeader>

        {showErrorDetails && errorStack && (
          <div className="error-modal-details">
            <div className="error-modal-details-header">
              <span>Error Details</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyErrorDetails}
                className="error-modal-copy-button"
              >
                {copied ? (
                  <>
                    <Check size={14} className="mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={14} className="mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <pre className="error-modal-stack">{errorStack}</pre>
          </div>
        )}

        <div className="error-modal-actions">
          {onRetry && (
            <Button onClick={onRetry} variant="default">
              Try Again
            </Button>
          )}

          {actions?.map((action, index) => (
            <Button
              key={index}
              onClick={action.onClick}
              variant={action.variant || "outline"}
            >
              {action.label}
            </Button>
          ))}

          {!onRetry && !actions && (
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          )}
        </div>

        {severity === "critical" && (
          <div className="error-modal-footer">
            <p className="error-modal-footer-text">
              This error has been logged and our team has been notified. If the
              problem persists, please contact support.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
