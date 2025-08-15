/**
 * React hooks for Walmart order operations
 */

import { trpc } from "../../utils/trpc.js";

// Hook for getting user orders
export function useWalmartOrders(params: {
  userId: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  return trpc?.walmartGrocery?.getOrders.useQuery(params, {
    enabled: !!params.userId
  });
}

// Hook for getting single order
export function useWalmartOrder(orderId: string) {
  return trpc?.walmartGrocery?.getOrder.useQuery(
    { orderId },
    { enabled: !!orderId }
  );
}

// Hook for creating an order
export function useCreateWalmartOrder() {
  const utils = trpc.useContext();
  
  return trpc?.walmartGrocery?.createOrder.useMutation({
    onSuccess: (data, variables) => {
      // Invalidate orders cache
      utils?.walmartGrocery?.getOrders.invalidate({ userId: variables.userId });
    }
  });
}

// Hook for updating order status
export function useUpdateWalmartOrderStatus() {
  const utils = trpc.useContext();
  
  return trpc?.walmartGrocery?.updateOrderStatus.useMutation({
    onSuccess: (data: any) => {
      // Invalidate specific order and orders list
      utils?.walmartGrocery?.getOrder.invalidate({ orderId: data.orderId });
      utils?.walmartGrocery?.getOrders.invalidate();
    }
  });
}

// Hook for tracking order
export function useTrackWalmartOrder(orderId: string) {
  return trpc?.walmartGrocery?.trackOrder.useQuery(
    { orderId },
    { 
      enabled: !!orderId,
      refetchInterval: 30000 // Refetch every 30 seconds
    }
  );
}
