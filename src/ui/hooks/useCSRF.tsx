import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { logger } from '../utils/logger';

// CSRF Token configuration matching backend
const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_TOKEN_STORAGE_KEY = 'csrf-token';
const CSRF_TOKEN_FETCH_URL = '/api/csrf-token';
const CSRF_TOKEN_REFRESH_INTERVAL = 55 * 60 * 1000; // 55 minutes (before 1-hour rotation)

// Types
interface CSRFContextValue {
  token: string | null;
  isLoading: boolean;
  error: Error | null;
  refreshToken: () => Promise<void>;
  getHeaders: () => Record<string, string>;
}

interface CSRFProviderProps {
  children: ReactNode;
}

// Context
const CSRFContext = createContext<CSRFContextValue | undefined>(undefined);

// CSRF Provider Component
export function CSRFProvider({ children }: CSRFProviderProps) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshTimer, setRefreshTimer] = useState<NodeJS.Timeout | null>(null);

  // Fetch CSRF token from backend
  const fetchCSRFToken = useCallback(async (isRetry = false): Promise<string | null> => {
    try {
      const response = await fetch(CSRF_TOKEN_FETCH_URL, {
        method: 'GET',
        credentials: 'include', // Include cookies
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.statusText}`);
      }

      const data = await response.json();
      const newToken = data.token;

      if (!newToken) {
        throw new Error('CSRF token not found in response');
      }

      // Store in memory and localStorage as backup
      localStorage.setItem(CSRF_TOKEN_STORAGE_KEY, newToken);
      
      logger.debug('CSRF token fetched successfully', 'CSRF', {
        isRetry,
        tokenPrefix: newToken.substring(0, 8),
      });

      return newToken;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error fetching CSRF token');
      logger.error('Failed to fetch CSRF token', 'CSRF', error);
      
      // On error, try to use stored token as fallback
      if (!isRetry) {
        const storedToken = localStorage.getItem(CSRF_TOKEN_STORAGE_KEY);
        if (storedToken) {
          logger.warn('Using stored CSRF token as fallback', 'CSRF');
          return storedToken;
        }
      }
      
      throw error;
    }
  }, []);

  // Refresh token function
  const refreshToken = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const newToken = await fetchCSRFToken();
      if (newToken) {
        setToken(newToken);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to refresh CSRF token');
      setError(error);
      logger.error('CSRF token refresh failed', 'CSRF', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchCSRFToken]);

  // Get headers with CSRF token
  const getHeaders = useCallback(() => {
    if (!token) {
      logger.warn('Attempting to get CSRF headers without token', 'CSRF');
      return {};
    }

    return {
      [CSRF_TOKEN_HEADER]: token,
    };
  }, [token]);

  // Initialize token on mount
  useEffect(() => {
    // Try to get token from localStorage first
    const storedToken = localStorage.getItem(CSRF_TOKEN_STORAGE_KEY);
    if (storedToken) {
      setToken(storedToken);
      setIsLoading(false);
      
      // Verify stored token is still valid
      fetchCSRFToken().then(newToken => {
        if (newToken && newToken !== storedToken) {
          setToken(newToken);
        }
      }).catch(err => {
        logger.error('Failed to verify stored CSRF token', 'CSRF', err);
      });
    } else {
      // No stored token, fetch new one
      refreshToken();
    }
  }, [fetchCSRFToken, refreshToken]);

  // Set up automatic token refresh
  useEffect(() => {
    if (token && !error) {
      // Clear existing timer
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }

      // Set up new refresh timer
      const timer = setInterval(() => {
        logger.debug('Auto-refreshing CSRF token', 'CSRF');
        refreshToken();
      }, CSRF_TOKEN_REFRESH_INTERVAL);

      setRefreshTimer(timer);

      return () => {
        clearInterval(timer);
      };
    }
  }, [token, error, refreshToken]);

  // Handle visibility change - refresh token when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && token) {
        // Check if token might be stale (simplified check)
        const lastRefresh = localStorage.getItem('csrf-last-refresh');
        if (lastRefresh) {
          const timeSinceRefresh = Date.now() - parseInt(lastRefresh, 10);
          if (timeSinceRefresh > CSRF_TOKEN_REFRESH_INTERVAL) {
            logger.debug('Refreshing potentially stale CSRF token', 'CSRF');
            refreshToken();
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token, refreshToken]);

  // Track last refresh time
  useEffect(() => {
    if (token) {
      localStorage.setItem('csrf-last-refresh', Date.now().toString());
    }
  }, [token]);

  const value: CSRFContextValue = {
    token,
    isLoading,
    error,
    refreshToken,
    getHeaders,
  };

  return <CSRFContext.Provider value={value}>{children}</CSRFContext.Provider>;
}

// Hook to use CSRF context
export function useCSRF() {
  const context = useContext(CSRFContext);
  if (context === undefined) {
    throw new Error('useCSRF must be used within a CSRFProvider');
  }
  return context;
}

// Utility function to handle CSRF errors and retry
export async function handleCSRFError<T>(
  operation: () => Promise<T>,
  options: {
    onTokenRefresh?: () => Promise<void>;
    maxRetries?: number;
    retryDelay?: number;
  } = {}
): Promise<T> {
  const { onTokenRefresh, maxRetries = 1, retryDelay = 1000 } = options;
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // Check if it's a CSRF error
      const isCSRFError = 
        (error instanceof Error && error.message.toLowerCase().includes('csrf')) ||
        (error as any)?.code === 'FORBIDDEN' ||
        (error as any)?.response?.status === 403;
      
      if (isCSRFError && attempt < maxRetries) {
        logger.warn('CSRF error detected, refreshing token and retrying', 'CSRF', {
          attempt: attempt + 1,
          maxRetries,
        });
        
        // Refresh token
        if (onTokenRefresh) {
          await onTokenRefresh();
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      
      // Not a CSRF error or max retries reached
      throw lastError;
    }
  }
  
  throw lastError;
}

// HOC for components that need CSRF protection
export function withCSRFProtection<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return function WithCSRFProtection(props: P) {
    const { isLoading, error } = useCSRF();

    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-4">
          <div className="text-sm text-muted-foreground">Initializing security...</div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center p-4">
          <div className="text-sm text-destructive">
            Security initialization failed. Please refresh the page.
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
}