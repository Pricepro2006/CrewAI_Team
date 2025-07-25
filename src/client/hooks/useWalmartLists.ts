/**
 * React hooks for Walmart grocery list operations
 */

import { trpc } from "../../utils/trpc";

// Hook for getting user lists
export function useWalmartLists(userId: string) {
  return trpc.walmartGrocery.getLists.useQuery(
    { userId },
    { enabled: !!userId }
  );
}

// Hook for creating a list
export function useCreateWalmartList() {
  const utils = trpc.useContext();
  
  return trpc.walmartGrocery.createList.useMutation({
    onSuccess: (data, variables) => {
      // Invalidate lists cache after creation
      utils.walmartGrocery.getLists.invalidate({ userId: variables.userId });
    }
  });
}

// Hook for updating a list
export function useUpdateWalmartList() {
  const utils = trpc.useContext();
  
  return trpc.walmartGrocery.updateList.useMutation({
    onSuccess: () => {
      // Invalidate all lists cache
      utils.walmartGrocery.getLists.invalidate();
    }
  });
}

// Hook for deleting a list
export function useDeleteWalmartList() {
  const utils = trpc.useContext();
  
  return trpc.walmartGrocery.deleteList.useMutation({
    onSuccess: () => {
      // Invalidate all lists cache
      utils.walmartGrocery.getLists.invalidate();
    }
  });
}

// Hook for adding item to list
export function useAddItemToWalmartList() {
  const utils = trpc.useContext();
  
  return trpc.walmartGrocery.addItemToList.useMutation({
    onSuccess: (_, variables) => {
      // Invalidate specific list
      utils.walmartGrocery.getLists.invalidate();
    }
  });
}

// Hook for removing item from list
export function useRemoveItemFromWalmartList() {
  const utils = trpc.useContext();
  
  return trpc.walmartGrocery.removeItemFromList.useMutation({
    onSuccess: () => {
      // Invalidate lists cache
      utils.walmartGrocery.getLists.invalidate();
    }
  });
}
