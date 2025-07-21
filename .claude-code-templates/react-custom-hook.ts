import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// Types
interface {{HookName}}Options {
  // Add your hook options here
  initialValue?: any;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  debounceMs?: number;
}

interface {{HookName}}Return {
  // Add your return values here
  data: any | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  reset: () => void;
}

/**
 * {{HookName}} - {{hookDescription}}
 * 
 * @param options - Hook configuration options
 * @returns Hook state and methods
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = {{HookName}}({
 *   initialValue: null,
 *   onSuccess: (data) => console.log('Success:', data),
 *   onError: (error) => console.error('Error:', error),
 * });
 * ```
 */
export const {{HookName}} = (options: {{HookName}}Options = {}): {{HookName}}Return => {
  const {
    initialValue = null,
    onSuccess,
    onError,
    debounceMs = 0,
  } = options;
  
  // State
  const [data, setData] = useState<any | null>(initialValue);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Refs
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);
  
  // Core fetch logic
  const fetchData = useCallback(async () => {
    // Cancel previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Replace with your actual data fetching logic
      const response = await fetch('/api/data', {
        signal: abortControllerRef.current.signal,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setData(result);
        onSuccess?.(result);
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      
      if (isMountedRef.current) {
        const error = err instanceof Error ? err : new Error('An unknown error occurred');
        setError(error);
        onError?.(error);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [onSuccess, onError]);
  
  // Debounced refetch
  const refetch = useCallback(async () => {
    if (debounceMs > 0) {
      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Set new timer
      debounceTimerRef.current = setTimeout(() => {
        fetchData();
      }, debounceMs);
    } else {
      await fetchData();
    }
  }, [fetchData, debounceMs]);
  
  // Reset to initial state
  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setData(initialValue);
    setIsLoading(false);
    setError(null);
  }, [initialValue]);
  
  // Auto-fetch on mount (optional)
  useEffect(() => {
    // Uncomment to fetch on mount
    // refetch();
  }, []);
  
  // Memoized return value
  return useMemo(
    () => ({
      data,
      isLoading,
      error,
      refetch,
      reset,
    }),
    [data, isLoading, error, refetch, reset]
  );
};

// Example of a more specific hook using the pattern
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
};