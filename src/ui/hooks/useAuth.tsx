import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { trpc } from "../utils/trpc.js";

/**
 * Authentication Hook and Context
 * Provides authentication state management and operations for the React frontend
 */

export interface User {
  id: string;
  email: string;
  username: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  role: "user" | "admin" | "moderator";
  is_active: boolean;
  is_verified: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileData {
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
}

export interface AuthContextType {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshToken: () => Promise<void>;
  updateProfile: (data: UpdateProfileData) => Promise<void>;
  changePassword: (data: ChangePasswordData) => Promise<void>;
  checkPasswordStrength: (password: string) => Promise<{
    isValid: boolean;
    errors: string[];
    strength: "weak" | "medium" | "strong";
    entropy: number;
    isCompromised: boolean;
    recommendations: string[];
  }>;
}

// Create Auth Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Token storage keys
const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";

// Storage utilities
const getStoredToken = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const setStoredToken = (key: string, token: string): void => {
  try {
    localStorage.setItem(key, token);
  } catch (error) {
    console.warn("Failed to store token:", error);
  }
};

const removeStoredToken = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn("Failed to remove token:", error);
  }
};

const clearAllTokens = (): void => {
  removeStoredToken(ACCESS_TOKEN_KEY);
  removeStoredToken(REFRESH_TOKEN_KEY);
};

// Custom hook for authentication
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// Auth Provider Component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // TRPC mutations
  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();
  const logoutAllMutation = trpc.auth.logoutAll.useMutation();
  const refreshTokenMutation = trpc.auth.refreshToken.useMutation();
  const updateProfileMutation = trpc.auth.updateProfile.useMutation();
  const changePasswordMutation = trpc.auth.changePassword.useMutation();

  // TRPC queries
  const { data: userData, refetch: refetchUser } = trpc.auth.me.useQuery(
    undefined,
    {
      enabled: !!tokens?.accessToken,
      retry: false,
    },
  );

  const checkPasswordStrengthMutation =
    trpc.auth.checkPasswordStrength.useMutation();

  // Initialize auth state from storage
  useEffect(() => {
    const accessToken = getStoredToken(ACCESS_TOKEN_KEY);
    const refreshToken = getStoredToken(REFRESH_TOKEN_KEY);

    if (accessToken && refreshToken) {
      setTokens({
        accessToken,
        refreshToken,
        expiresIn: 0, // Will be updated on refresh
        tokenType: "Bearer",
      });
    }

    setIsLoading(false);
  }, []);

  // Update user when userData changes
  useEffect(() => {
    if (userData?.user) {
      setUser(userData.user);
    }
  }, [userData]);

  // Set up automatic token refresh
  useEffect(() => {
    if (!tokens?.accessToken) return;

    // Parse JWT to get expiration time
    try {
      const payload = JSON.parse(atob(tokens.accessToken.split(".")[1]!));
      const expirationTime = payload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const timeUntilExpiry = expirationTime - currentTime;

      // Refresh token 5 minutes before expiry
      const refreshTime = Math.max(0, timeUntilExpiry - 5 * 60 * 1000);

      const refreshTimer = setTimeout(() => {
        handleRefreshToken();
      }, refreshTime);

      return () => clearTimeout(refreshTimer);
    } catch (error) {
      console.warn("Failed to parse access token:", error);
      return; // Add explicit return for catch block
    }
  }, [tokens?.accessToken]);

  // Login function
  const login = useCallback(
    async (credentials: LoginCredentials): Promise<void> => {
      try {
        const result = await loginMutation.mutateAsync(credentials);

        const newTokens = result.tokens;
        setTokens(newTokens);
        setUser(result.user);

        // Store tokens
        setStoredToken(ACCESS_TOKEN_KEY, newTokens.accessToken);
        setStoredToken(REFRESH_TOKEN_KEY, newTokens.refreshToken);
      } catch (error) {
        // Clear any partial state
        setTokens(null);
        setUser(null);
        clearAllTokens();
        throw error;
      }
    },
    [loginMutation],
  );

  // Register function
  const register = useCallback(
    async (data: RegisterData): Promise<void> => {
      await registerMutation.mutateAsync(data);
      // Note: After registration, user needs to login separately
    },
    [registerMutation],
  );

  // Logout function
  const logout = useCallback(async (): Promise<void> => {
    try {
      if (tokens?.refreshToken) {
        await logoutMutation.mutateAsync({ refreshToken: tokens.refreshToken });
      }
    } catch (error) {
      console.warn("Logout request failed:", error);
      // Continue with local logout even if server request fails
    } finally {
      // Clear state and storage
      setTokens(null);
      setUser(null);
      clearAllTokens();
    }
  }, [logoutMutation, tokens?.refreshToken]);

  // Logout from all devices
  const logoutAll = useCallback(async (): Promise<void> => {
    try {
      await logoutAllMutation.mutateAsync();
    } catch (error) {
      console.warn("Logout all request failed:", error);
    } finally {
      // Clear state and storage
      setTokens(null);
      setUser(null);
      clearAllTokens();
    }
  }, [logoutAllMutation]);

  // Refresh token function
  const handleRefreshToken = useCallback(async (): Promise<void> => {
    if (!tokens?.refreshToken) {
      throw new Error("No refresh token available");
    }

    try {
      const result = await refreshTokenMutation.mutateAsync({
        refreshToken: tokens.refreshToken,
      });

      const newTokens = result.tokens;
      setTokens(newTokens);

      // Update stored tokens
      setStoredToken(ACCESS_TOKEN_KEY, newTokens.accessToken);
      setStoredToken(REFRESH_TOKEN_KEY, newTokens.refreshToken);
    } catch (error) {
      // If refresh fails, logout user
      console.warn("Token refresh failed:", error);
      setTokens(null);
      setUser(null);
      clearAllTokens();
      throw error;
    }
  }, [refreshTokenMutation, tokens?.refreshToken]);

  // Update profile function
  const updateProfile = useCallback(
    async (data: UpdateProfileData): Promise<void> => {
      const result = await updateProfileMutation.mutateAsync(data);
      setUser(result.user);
    },
    [updateProfileMutation],
  );

  // Change password function
  const changePassword = useCallback(
    async (data: ChangePasswordData): Promise<void> => {
      await changePasswordMutation.mutateAsync(data);
      // After password change, logout user for security
      await logout();
    },
    [changePasswordMutation, logout],
  );

  // Check password strength function
  const checkPasswordStrength = useCallback(
    async (password: string) => {
      const result = await checkPasswordStrengthMutation.mutateAsync({
        password,
      });
      return result;
    },
    [checkPasswordStrengthMutation],
  );

  const isAuthenticated = !!user && !!tokens?.accessToken;

  const contextValue: AuthContextType = {
    user,
    tokens,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    logoutAll,
    refreshToken: handleRefreshToken,
    updateProfile,
    changePassword,
    checkPasswordStrength,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

// Additional utility hooks

/**
 * Hook to check if user has specific role
 */
export const useRole = (role: "user" | "admin" | "moderator"): boolean => {
  const { user } = useAuth();
  return user?.role === role;
};

/**
 * Hook to check if user has admin privileges
 */
export const useIsAdmin = (): boolean => {
  const { user } = useAuth();
  return user?.role === "admin";
};

/**
 * Hook to check if user has moderator or admin privileges
 */
export const useIsModerator = (): boolean => {
  const { user } = useAuth();
  return user?.role === "moderator" || user?.role === "admin";
};

/**
 * Hook for protected routes - redirects to login if not authenticated
 */
export const useRequireAuth = (redirectTo?: string): boolean => {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // In a real app, you would handle routing here
      // For now, we'll just log the redirect intent
      console.warn("Authentication required", { redirectTo });
    }
  }, [isAuthenticated, isLoading, redirectTo]);

  return isAuthenticated;
};
