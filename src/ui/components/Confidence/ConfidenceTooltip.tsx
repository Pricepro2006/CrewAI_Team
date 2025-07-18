import React, { useState } from 'react';
import { cn } from '../../utils/cn';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

export interface ConfidenceTooltipProps {
  score: number;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export const ConfidenceTooltip: React.FC<ConfidenceTooltipProps> = ({
  score,
  children,
  position = 'top',
  className,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const getConfidenceLevel = (score: number) => {
    if (score >= 0.8) return { level: 'High', color: 'text-green-600' };
    if (score >= 0.6) return { level: 'Medium', color: 'text-blue-600' };
    if (score >= 0.4) return { level: 'Low', color: 'text-yellow-600' };
    return { level: 'Very Low', color: 'text-red-600' };
  };

  const { level, color } = getConfidenceLevel(score);
  const percentage = Math.round(score * 100);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 -mt-1 border-t-gray-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-1 border-b-gray-800',
    left: 'left-full top-1/2 -translate-y-1/2 -ml-1 border-l-gray-800',
    right: 'right-full top-1/2 -translate-y-1/2 -mr-1 border-r-gray-800',
  };

  return (
    <div className={cn('relative inline-block', className)}>
      <div
        className="cursor-help"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>

      {isVisible && (
        <div
          className={cn(
            'absolute z-50 px-3 py-2 text-sm text-white bg-gray-800 rounded-lg shadow-lg whitespace-nowrap',
            'transition-opacity duration-200',
            positionClasses[position]
          )}
        >
          <div className="flex items-center gap-2">
            <QuestionMarkCircleIcon className="w-4 h-4" />
            <span>
              Confidence: <span className={cn('font-semibold', color)}>{percentage}%</span> ({level})
            </span>
          </div>
          
          {/* Arrow */}
          <div
            className={cn(
              'absolute w-0 h-0 border-4 border-transparent',
              arrowClasses[position]
            )}
          />
        </div>
      )}
    </div>
  );
};

export interface InlineConfidenceProps {
  score: number;
  text: string;
  showIcon?: boolean;
  className?: string;
}

export const InlineConfidence: React.FC<InlineConfidenceProps> = ({
  score,
  text,
  showIcon = true,
  className,
}) => {
  const getUnderlineStyle = (score: number) => {
    if (score >= 0.8) return 'decoration-green-400';
    if (score >= 0.6) return 'decoration-blue-400';
    if (score >= 0.4) return 'decoration-yellow-400';
    return 'decoration-red-400';
  };

  return (
    <ConfidenceTooltip score={score}>
      <span
        className={cn(
          'underline decoration-2 decoration-dotted cursor-help',
          getUnderlineStyle(score),
          className
        )}
      >
        {text}
        {showIcon && (
          <QuestionMarkCircleIcon className="inline-block w-3 h-3 ml-1 -mt-0.5 opacity-50" />
        )}
      </span>
    </ConfidenceTooltip>
  );
};