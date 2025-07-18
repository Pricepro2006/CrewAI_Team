import React from 'react';
import { cn } from '../../utils/cn';
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  XCircleIcon,
  InformationCircleIcon 
} from '@heroicons/react/24/outline';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'very_low';

export interface ConfidenceIndicatorProps {
  level: ConfidenceLevel;
  score?: number;
  message?: string;
  compact?: boolean;
  showIcon?: boolean;
  className?: string;
}

export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  level,
  score,
  message,
  compact = false,
  showIcon = true,
  className,
}) => {
  const config = {
    high: {
      icon: CheckCircleIcon,
      color: 'text-green-600 bg-green-50 border-green-200',
      label: 'High Confidence',
      description: 'Response is highly reliable',
    },
    medium: {
      icon: InformationCircleIcon,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      label: 'Medium Confidence',
      description: 'Response is generally reliable with some uncertainty',
    },
    low: {
      icon: ExclamationTriangleIcon,
      color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      label: 'Low Confidence',
      description: 'Response contains significant uncertainty',
    },
    very_low: {
      icon: XCircleIcon,
      color: 'text-red-600 bg-red-50 border-red-200',
      label: 'Very Low Confidence',
      description: 'Response requires verification',
    },
  };

  const { icon: Icon, color, label, description } = config[level];

  if (compact) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1 px-2 py-1 rounded-md border',
          color,
          className
        )}
      >
        {showIcon && <Icon className="w-4 h-4" />}
        <span className="text-xs font-medium">
          {score !== undefined ? `${Math.round(score * 100)}%` : label}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border',
        color,
        className
      )}
    >
      {showIcon && <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-medium">{label}</h4>
          {score !== undefined && (
            <span className="text-sm opacity-75">
              ({Math.round(score * 100)}%)
            </span>
          )}
        </div>
        <p className="text-sm mt-0.5 opacity-75">
          {message || description}
        </p>
      </div>
    </div>
  );
};