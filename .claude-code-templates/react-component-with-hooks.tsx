import React, { FC, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { cn } from '@/utils/cn';

interface {{ComponentName}}Props {
  className?: string;
  initialValue?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  // Add your props here
}

/**
 * {{ComponentName}} component with comprehensive hooks usage
 * 
 * @description {{ComponentDescription}}
 */
export const {{ComponentName}}: FC<{{ComponentName}}Props> = ({ 
  className,
  initialValue = '',
  onChange,
  onSubmit,
  ...props 
}) => {
  // State management
  const [value, setValue] = useState(initialValue);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);
  
  // Effects
  useEffect(() => {
    // Component mount logic
    inputRef.current?.focus();
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  useEffect(() => {
    // Value change side effect
    onChange?.(value);
  }, [value, onChange]);
  
  // Memoized values
  const processedValue = useMemo(() => {
    // Expensive computation
    return value.trim().toLowerCase();
  }, [value]);
  
  const isValid = useMemo(() => {
    return processedValue.length > 0;
  }, [processedValue]);
  
  // Callbacks
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setError(null);
  }, []);
  
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValid) {
      setError('Please enter a valid value');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (isMountedRef.current) {
        onSubmit?.(processedValue);
        setValue('');
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [isValid, processedValue, onSubmit]);
  
  const handleReset = useCallback(() => {
    setValue(initialValue);
    setError(null);
    inputRef.current?.focus();
  }, [initialValue]);
  
  return (
    <form 
      className={cn(
        'space-y-4',
        className
      )}
      onSubmit={handleSubmit}
      {...props}
    >
      <div className="space-y-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          disabled={isLoading}
          className={cn(
            'w-full px-3 py-2 border rounded-md',
            'focus:outline-none focus:ring-2 focus:ring-blue-500',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-red-500'
          )}
          placeholder="Enter value..."
        />
        
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>
      
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isLoading || !isValid}
          className={cn(
            'px-4 py-2 bg-blue-500 text-white rounded-md',
            'hover:bg-blue-600 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isLoading ? 'Loading...' : 'Submit'}
        </button>
        
        <button
          type="button"
          onClick={handleReset}
          disabled={isLoading}
          className={cn(
            'px-4 py-2 border border-gray-300 rounded-md',
            'hover:bg-gray-50 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          Reset
        </button>
      </div>
      
      {/* Debug info (remove in production) */}
      <div className="mt-4 p-2 bg-gray-100 rounded text-xs">
        <p>Current value: {value}</p>
        <p>Processed value: {processedValue}</p>
        <p>Is valid: {isValid ? 'Yes' : 'No'}</p>
      </div>
    </form>
  );
};

{{ComponentName}}.displayName = '{{ComponentName}}';