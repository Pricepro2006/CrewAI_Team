import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import './LoadingState.css';

interface LoadingStateProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  fullScreen?: boolean;
  overlay?: boolean;
  className?: string;
}

export function LoadingState({
  size = 'medium',
  text,
  fullScreen = false,
  overlay = false,
  className,
}: LoadingStateProps) {
  const sizeConfig = {
    small: { iconSize: 16, textSize: 'text-sm' },
    medium: { iconSize: 24, textSize: 'text-base' },
    large: { iconSize: 32, textSize: 'text-lg' },
  };

  const config = sizeConfig[size];

  const content = (
    <div className={cn('loading-state-content', className)}>
      <Loader2 
        className="loading-state-icon" 
        size={config.iconSize}
      />
      {text && (
        <p className={cn('loading-state-text', config.textSize)}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="loading-state-fullscreen">
        {content}
      </div>
    );
  }

  if (overlay) {
    return (
      <div className="loading-state-overlay">
        {content}
      </div>
    );
  }

  return content;
}

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  circle?: boolean;
}

export function Skeleton({
  className,
  width,
  height,
  circle = false,
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'skeleton',
        circle && 'skeleton-circle',
        className
      )}
      style={{
        width: width,
        height: height,
      }}
    />
  );
}

interface LoadingCardProps {
  lines?: number;
  showAvatar?: boolean;
  className?: string;
}

export function LoadingCard({
  lines = 3,
  showAvatar = false,
  className,
}: LoadingCardProps) {
  return (
    <div className={cn('loading-card', className)}>
      {showAvatar && (
        <div className="loading-card-header">
          <Skeleton circle width={40} height={40} />
          <div className="loading-card-header-text">
            <Skeleton width="60%" height={16} />
            <Skeleton width="40%" height={14} />
          </div>
        </div>
      )}
      <div className="loading-card-content">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            width={i === lines - 1 ? '80%' : '100%'}
            height={16}
            className="loading-card-line"
          />
        ))}
      </div>
    </div>
  );
}