/**
 * Authentication Hook for Walmart Grocery Agent
 * Provides secure user authentication and session management
 */

import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { logger } from '../utils/logger.js';

export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'user' | 'admin';
  permissions: string[];
  sessionId: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useAuthState = (): AuthState => {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    error: null
  });

  // Load token from localStorage on mount
  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        const storedToken = localStorage.getItem('walmart_auth_token');
        const storedUser = localStorage.getItem('walmart_auth_user');
        
        if (storedToken && storedUser) {
          const user = JSON.parse(storedUser);
          
          // Validate token is still valid
          if (await validateToken(storedToken)) {
            setState({
              user,
              token: storedToken,
              isAuthenticated: true,
              isLoading: false,
              error: null
            });
            return;
          } else {
            // Token is invalid, clear storage
            localStorage.removeItem('walmart_auth_token');
            localStorage.removeItem('walmart_auth_user');
          }
        }
      } catch (error) {
        logger.error('Failed to load stored authentication', 'AUTH', { error });
      }
      
      setState(prev => ({ ...prev, isLoading: false }));
    };

    loadStoredAuth();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Login failed');
      }

      const { user, token } = await response.json();

      // Store authentication data
      localStorage.setItem('walmart_auth_token', token);
      localStorage.setItem('walmart_auth_user', JSON.stringify(user));

      setState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });

      logger.info('User login successful', 'AUTH', { userId: user.id });
      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));

      logger.error('Login failed', 'AUTH', { error: errorMessage, email });
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    // Clear stored authentication
    localStorage.removeItem('walmart_auth_token');
    localStorage.removeItem('walmart_auth_user');

    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null
    });

    logger.info('User logout', 'AUTH');
  }, []);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    const currentToken = state.token;
    if (!currentToken) {
      return false;
    }

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const { user, token } = await response.json();

      // Update stored authentication
      localStorage.setItem('walmart_auth_token', token);
      localStorage.setItem('walmart_auth_user', JSON.stringify(user));

      setState(prev => ({
        ...prev,
        user,
        token,
        error: null
      }));

      return true;

    } catch (error) {
      logger.error('Token refresh failed', 'AUTH', { error });
      logout();
      return false;
    }
  }, [state.token, logout]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    login,
    logout,
    refreshToken,
    clearError
  };
};

/**
 * Validate token with server
 */
async function validateToken(token: string): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/validate', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * AuthProvider component
 */
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const auth = useAuthState();
  return React.createElement(
    AuthContext.Provider,
    { value: auth },
    children
  );
};

/**
 * Hook to get current user information
 */
export const useCurrentUser = (): User | null => {
  const { user } = useAuth();
  return user;
};

/**
 * Hook to check if user has specific permission
 */
export const usePermission = (permission: string): boolean => {
  const { user } = useAuth();
  return user ? user.permissions.includes(permission) || user.role === 'admin' : false;
};

/**
 * Hook to get authentication token
 */
export const useAuthToken = (): string | null => {
  const { token } = useAuth();
  return token;
};