/**
 * React hooks for Walmart grocery list operations
 */

import { useState, useCallback } from "react";
import { api as trpc } from "../lib/api.js";
import type { GroceryList, GroceryItem } from "../../types/walmart-grocery.js";

// Types for list operations
interface CreateListInput {
  userId: string;
  name: string;
  description?: string;
  type?: "shopping" | "wishlist" | "recurring";
}

interface UpdateListInput {
  listId: string;
  name?: string;
  description?: string;
  status?: "active" | "completed" | "archived";
}

interface DeleteListInput {
  listId: string;
  userId: string;
}

interface AddItemInput {
  listId: string;
  itemName: string;
  productId?: string;
  quantity?: number;
  notes?: string;
}

interface RemoveItemInput {
  listId: string;
  itemId: string;
}

// Response types
interface ListsResponse {
  lists: GroceryList[];
  total: number;
}

interface ListOperationResponse {
  success: boolean;
  list?: GroceryList;
  message?: string;
}

// Hook return types
interface UseWalmartListsResult {
  data: ListsResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<{ data: ListsResponse }>;
  isSuccess: boolean;
  status: 'success' | 'error' | 'loading' | 'idle';
}

interface UseMutationResult {
  mutate: () => void;
  mutateAsync: (input: any) => Promise<ListOperationResponse>;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  data: ListOperationResponse | undefined;
  reset: () => void;
  status: 'idle' | 'loading' | 'error' | 'success';
}

// Hook for getting user lists
export function useWalmartLists(userId: string): UseWalmartListsResult {
  // Return mock result structure since list operations are not implemented yet
  return {
    data: { lists: [], total: 0 },
    isLoading: false,
    isError: false,
    error: null,
    refetch: async (): Promise<{ data: ListsResponse }> => ({ data: { lists: [], total: 0 } }),
    isSuccess: true,
    status: 'success' as const
  };
}

// Hook for creating a list
export function useCreateWalmartList(): UseMutationResult {
  // Return mock mutation since list operations are not implemented yet
  return {
    mutate: (): void => {},
    mutateAsync: async (input: CreateListInput): Promise<ListOperationResponse> => ({ 
      success: false, 
      message: "List operations not available" 
    }),
    isLoading: false,
    isError: false,
    error: null,
    data: undefined,
    reset: (): void => {},
    status: 'idle' as const
  };
}

// Hook for updating a list
export function useUpdateWalmartList(): UseMutationResult {
  // Return mock mutation since list operations are not implemented yet
  return {
    mutate: (): void => {},
    mutateAsync: async (input: UpdateListInput): Promise<ListOperationResponse> => ({ 
      success: false, 
      message: "List operations not available" 
    }),
    isLoading: false,
    isError: false,
    error: null,
    data: undefined,
    reset: (): void => {},
    status: 'idle' as const
  };
}

// Hook for deleting a list
export function useDeleteWalmartList(): UseMutationResult {
  // Return mock mutation since list operations are not implemented yet
  return {
    mutate: (): void => {},
    mutateAsync: async (input: DeleteListInput): Promise<ListOperationResponse> => ({ 
      success: false, 
      message: "List operations not available" 
    }),
    isLoading: false,
    isError: false,
    error: null,
    data: undefined,
    reset: (): void => {},
    status: 'idle' as const
  };
}

// Hook for adding item to list
export function useAddItemToWalmartList(): UseMutationResult {
  // Return mock mutation since list operations are not implemented yet
  return {
    mutate: (): void => {},
    mutateAsync: async (input: AddItemInput): Promise<ListOperationResponse> => ({ 
      success: false, 
      message: "List operations not available" 
    }),
    isLoading: false,
    isError: false,
    error: null,
    data: undefined,
    reset: (): void => {},
    status: 'idle' as const
  };
}

// Hook for removing item from list
export function useRemoveItemFromWalmartList(): UseMutationResult {
  // Return mock mutation since list operations are not implemented yet
  return {
    mutate: (): void => {},
    mutateAsync: async (input: RemoveItemInput): Promise<ListOperationResponse> => ({ 
      success: false, 
      message: "List operations not available" 
    }),
    isLoading: false,
    isError: false,
    error: null,
    data: undefined,
    reset: (): void => {},
    status: 'idle' as const
  };
}

// Custom hook for combined list operations
export function useWalmartListOperations() {
  const getLists = useWalmartLists;
  const createList = useCreateWalmartList();
  const updateList = useUpdateWalmartList();
  const deleteList = useDeleteWalmartList();
  const addItem = useAddItemToWalmartList();
  const removeItem = useRemoveItemFromWalmartList();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Combined operations with error handling
  const operations = {
    createListWithItems: useCallback(async (input: CreateListInput & { items?: AddItemInput[] }): Promise<ListOperationResponse> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await createList.mutateAsync(input);
        if (result.success && result.list && input.items?.length) {
          // Add items to the newly created list
          for (const item of input.items) {
            await addItem.mutateAsync({ ...item, listId: result.list.id });
          }
        }
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    }, [createList, addItem]),

    deleteListWithItems: useCallback(async (input: DeleteListInput): Promise<ListOperationResponse> => {
      setIsLoading(true);
      setError(null);
      try {
        return await deleteList.mutateAsync(input);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    }, [deleteList])
  };

  return {
    // Individual operations
    getLists,
    createList,
    updateList,
    deleteList,
    addItem,
    removeItem,
    
    // Combined operations
    operations,
    
    // State
    isLoading,
    error,
    
    // Utilities
    clearError: useCallback((): void => setError(null), [])
  };
}
