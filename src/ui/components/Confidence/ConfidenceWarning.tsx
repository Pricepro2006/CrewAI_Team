import React from 'react';
import { cn } from '../../utils/cn';
import { 
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ShieldExclamationIcon 
} from '@heroicons/react/24/outline';

export type WarningType = 'uncertainty' | 'source' | 'fallback' | 'review';

export interface ConfidenceWarningProps {
  type: WarningType;
  message: string;
  details?: string[];
  severity?: 'info' | 'warning' | 'error';
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export const ConfidenceWarning: React.FC<ConfidenceWarningProps> = ({
  type,
  message,
  details,
  severity = 'warning',
  dismissible = false,
  onDismiss,
  className,
}) => {
  const config = {
    uncertainty: {
      icon: ExclamationTriangleIcon,
      title: 'Uncertainty Detected',
      defaultSeverity: 'warning' as const,
    },
    source: {
      icon: InformationCircleIcon,
      title: 'Source Information',
      defaultSeverity: 'info' as const,
    },
    fallback: {
      icon: ShieldExclamationIcon,
      title: 'Fallback Response',
      defaultSeverity: 'error' as const,
    },
    review: {
      icon: ExclamationTriangleIcon,
      title: 'Human Review Recommended',
      defaultSeverity: 'warning' as const,
    },
  };

  const severityStyles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    error: 'bg-red-50 border-red-200 text-red-800',
  };

  const { icon: Icon, title } = config[type];
  const effectiveSeverity = severity || config[type].defaultSeverity;

  return (
    <div
      className={cn(
        'relative rounded-lg border p-4',
        severityStyles[effectiveSeverity],
        className
      )}
      role="alert"
    >
      <div className="flex items-start">
        <Icon className="w-5 h-5 mt-0.5 mr-3 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-medium mb-1">{title}</h3>
          <p className="text-sm">{message}</p>
          
          {details && details.length > 0 && (
            <ul className="mt-2 text-sm space-y-1">
              {details.map((detail, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span className="opacity-90">{detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-3 -mt-1 -mr-1 p-1 rounded-md hover:bg-black/5 transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};