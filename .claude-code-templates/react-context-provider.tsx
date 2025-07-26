import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

// Types
interface {{ContextName}}State {
  // Add your state properties here
  isLoading: boolean;
  error: string | null;
  data: any | null;
}

interface {{ContextName}}Actions {
  // Add your action methods here
  fetchData: () => Promise<void>;
  updateData: (data: any) => void;
  clearError: () => void;
}

type {{ContextName}}ContextType = {{ContextName}}State & {{ContextName}}Actions;

// Default values
const default{{ContextName}}State: {{ContextName}}State = {
  isLoading: false,
  error: null,
  data: null,
};

// Create context
const {{ContextName}}Context = createContext<{{ContextName}}ContextType | undefined>(undefined);

// Provider props
interface {{ContextName}}ProviderProps {
  children: ReactNode;
  initialData?: any;
}

/**
 * {{ContextName}} Provider
 * 
 * @description Provides {{contextDescription}}
 * @example
 * ```tsx
 * <{{ContextName}}Provider>
 *   <App />
 * </{{ContextName}}Provider>
 * ```
 */
export const {{ContextName}}Provider: React.FC<{{ContextName}}ProviderProps> = ({ 
  children,
  initialData = null 
}) => {
  // State management
  const [state, setState] = useState<{{ContextName}}State>({
    ...default{{ContextName}}State,
    data: initialData,
  });
  
  // Effects
  useEffect(() => {
    // Initialize context
    if (initialData) {
      setState(prev => ({ ...prev, data: initialData }));
    }
  }, [initialData]);
  
  // Actions
  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Replace with actual data fetching logic
      const response = await fetch('/api/data');
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      
      const data = await response.json();
      setState(prev => ({ 
        ...prev, 
        data,
        isLoading: false 
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'An error occurred',
        isLoading: false 
      }));
    }
  }, []);
  
  const updateData = useCallback((newData: any) => {
    setState(prev => ({ ...prev, data: newData }));
  }, []);
  
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);
  
  // Context value
  const contextValue: {{ContextName}}ContextType = {
    ...state,
    fetchData,
    updateData,
    clearError,
  };
  
  return (
    <{{ContextName}}Context.Provider value={contextValue}>
      {children}
    </{{ContextName}}Context.Provider>
  );
};

/**
 * Custom hook to use {{ContextName}} context
 * 
 * @throws {Error} If used outside of {{ContextName}}Provider
 * @example
 * ```tsx
 * const { data, isLoading, fetchData } = use{{ContextName}}();
 * ```
 */
export const use{{ContextName}} = (): {{ContextName}}ContextType => {
  const context = useContext({{ContextName}}Context);
  
  if (context === undefined) {
    throw new Error('use{{ContextName}} must be used within a {{ContextName}}Provider');
  }
  
  return context;
};

// Optional: HOC for components that need the context
export const with{{ContextName}} = <P extends object>(
  Component: React.ComponentType<P & {{ContextName}}ContextType>
): React.FC<P> => {
  return (props: P) => {
    const contextValue = use{{ContextName}}();
    return <Component {...props} {...contextValue} />;
  };
};