import React, { FC, useState, useEffect } from 'react';
import { cn } from '@/utils/cn';

interface {{ComponentName}}Props {
  className?: string;
  children?: React.ReactNode;
  // Add your props here
}

/**
 * {{ComponentName}} component
 * 
 * @description {{ComponentDescription}}
 * @example
 * ```tsx
 * <{{ComponentName}} className="custom-class">
 *   Content
 * </{{ComponentName}}>
 * ```
 */
export const {{ComponentName}}: FC<{{ComponentName}}Props> = ({ 
  className,
  children,
  ...props 
}) => {
  // State management
  const [isLoading, setIsLoading] = useState(false);
  
  // Effects
  useEffect(() => {
    // Component mount logic
    return () => {
      // Cleanup logic
    };
  }, []);
  
  // Event handlers
  const handleClick = () => {
    // Handle click logic
  };
  
  return (
    <div 
      className={cn(
        'relative',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

{{ComponentName}}.displayName = '{{ComponentName}}';