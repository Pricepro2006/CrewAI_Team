import React from 'react';
import { cn } from '../../utils/cn';

export interface ConfidenceScoreProps {
  score: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  showBar?: boolean;
  animated?: boolean;
  className?: string;
}

export const ConfidenceScore: React.FC<ConfidenceScoreProps> = ({
  score,
  label,
  size = 'md',
  showPercentage = true,
  showBar = true,
  animated = true,
  className,
}) => {
  // Ensure score is between 0 and 1
  const normalizedScore = Math.max(0, Math.min(1, score));
  const percentage = Math.round(normalizedScore * 100);

  // Determine color based on confidence level
  const getColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-100 border-green-300';
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-100 border-yellow-300';
    if (score >= 0.4) return 'text-orange-600 bg-orange-100 border-orange-300';
    return 'text-red-600 bg-red-100 border-red-300';
  };

  const getBarColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-500';
    if (score >= 0.6) return 'bg-yellow-500';
    if (score >= 0.4) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const barHeights = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={cn('confidence-score', className)}>
      {label && (
        <div className={cn('mb-1 font-medium text-gray-700', sizeClasses[size])}>
          {label}
        </div>
      )}
      
      <div className="flex items-center gap-2">
        {showBar && (
          <div className={cn('flex-1 bg-gray-200 rounded-full overflow-hidden', barHeights[size])}>
            <div
              className={cn(
                'h-full transition-all duration-500 ease-out',
                getBarColor(normalizedScore),
                animated && 'animate-slide-in'
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
        )}
        
        {showPercentage && (
          <div
            className={cn(
              'px-2 py-1 rounded-md border font-semibold',
              getColor(normalizedScore),
              sizeClasses[size]
            )}
          >
            {percentage}%
          </div>
        )}
      </div>
    </div>
  );
};