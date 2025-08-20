/**
 * useWalmartRealTime Hook
 * Custom hook for interacting with Walmart Real-Time API
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { trpc } from '../../lib/trpc.js';
import type { RealTimeProduct, OrderHistory } from '../../api/services/WalmartRealTimeAPI';

interface StoreAvailability {
  storeId: string;
  name: string;
  address: string;
  distance: number;
  inStock: boolean;
  quantity: number;
  price: number;
}

interface UseWalmartRealTimeReturn {
  // Product data
  product: RealTimeProduct | null;
  isLoading: boolean;
  error: Error | null;
  
  // Price history
  priceHistory: Array<{ date: string; price: number }> | null;
  
  // Store availability
  storeAvailability: StoreAvailability[] | null;
  
  // Order history
  orderHistory: OrderHistory[] | null;
  
  // Actions
  refresh: () => Promise<void>;
  searchProducts: (query: string, limit?: number) => Promise<RealTimeProduct[]>;
  subscribeToUpdates: (productIds: string[], intervalMs?: number) => string | null;
  unsubscribe: (subscriptionId: string) => void;
  setPriceAlert: (productId: string, targetPrice: number, alertType: 'below' | 'above') => Promise<void>;
  checkStoreAvailability: (productId: string, zipCode: string) => Promise<void>;
  addToCart: (productId: string, quantity: number) => Promise<void>;
}

export function useWalmartRealTime(productId?: string): UseWalmartRealTimeReturn {
  const [product, setProduct] = useState<RealTimeProduct | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [priceHistory, setPriceHistory] = useState<Array<{ date: string; price: number }> | null>(null);
  const [storeAvailability, setStoreAvailability] = useState<StoreAvailability[] | null>(null);
  const [orderHistory, setOrderHistory] = useState<OrderHistory[] | null>(null);
  
  const subscriptionRef = useRef<string | null>(null);
  const utils = trpc.useContext();

  // Queries
  const productQuery = trpc.walmartRealTime.getProduct.useQuery(
    { productId: productId! },
    {
      enabled: !!productId,
      refetchInterval: false, // We'll use subscription for updates
      onSuccess: (data: any) => {
        setProduct(data);
        setPriceHistory(data.priceHistory || null);
      },
      onError: (err: any) => {
        setError(err);
      }
    }
  );

  const priceHistoryQuery = trpc.walmartRealTime.getPriceHistory.useQuery(
    { productId: productId!, days: 30 },
    {
      enabled: !!productId,
      onSuccess: (data: any) => {
        setPriceHistory(data.history);
      }
    }
  );

  const orderHistoryQuery = trpc.walmartRealTime.getOrderHistory.useQuery(
    { limit: 10 },
    {
      enabled: false, // Only fetch when requested
      onSuccess: (data: any) => {
        setOrderHistory(data.orders);
      }
    }
  );

  // Mutations - these endpoints don't exist in the router yet
  // For now, we'll create stub implementations that return null
  // TODO: Implement these mutations in the router when needed
  const searchMutation = null; // trpc.walmartRealTime.searchProducts.useMutation();
  const setPriceAlertMutation = null; // trpc.walmartRealTime.setPriceAlert.useMutation();
  const checkAvailabilityMutation = null; // trpc.walmartRealTime.checkStoreAvailability.useMutation();

  // Subscription for live updates
  const priceSubscription = trpc.walmartRealTime.subscribeToPriceUpdates.useSubscription(
    {
      productIds: productId ? [productId] : [],
      intervalMs: 60000 // 1 minute default
    },
    {
      enabled: false, // We'll control this manually
      onData: (update: any) => {
        if (update.type === 'price_update' && update.data) {
          setProduct(update.data);
          // Update price history with new data point
          setPriceHistory(prev => {
            if (!prev) return [{ date: update.data.lastUpdated, price: update.data.price }];
            const newHistory = [...prev, { date: update.data.lastUpdated, price: update.data.price }];
            // Keep only last 100 data points
            return newHistory.slice(-100);
          });
        }
      },
      onError: (err: any) => {
        console.error('Subscription error:', err);
      }
    }
  );

  // Load product data on mount or when productId changes
  useEffect(() => {
    if (productId) {
      setIsLoading(true);
      setError(null);
    }
  }, [productId]);

  // Update loading state based on query status
  useEffect(() => {
    setIsLoading(productQuery.isLoading);
    if (productQuery.error) {
      setError(productQuery.error as unknown as Error);
    }
  }, [productQuery.isLoading, productQuery.error]);

  // Actions
  const refresh = useCallback(async () => {
    if (productId) {
      setIsLoading(true);
      setError(null);
      try {
        await productQuery.refetch();
        await priceHistoryQuery.refetch();
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [productId, productQuery, priceHistoryQuery]);

  const searchProducts = useCallback(async (query: string, limit: number = 10) => {
    try {
      // searchMutation is currently null - need to implement in router
      if (!searchMutation) {
        console.warn('searchProducts mutation not implemented yet');
        return [];
      }
      const result = await searchMutation.mutateAsync({ query, limit });
      return result.products;
    } catch (err) {
      setError(err as Error);
      return [];
    }
  }, [searchMutation]);

  const subscribeToUpdates = useCallback((productIds: string[], intervalMs: number = 60000) => {
    try {
      // For now, we'll simulate subscription with polling
      // In production, this would use WebSocket subscription
      const subscriptionId = `sub_${Date.now()}`;
      subscriptionRef.current = subscriptionId;
      
      // Set up polling interval
      const interval = setInterval(async () => {
        if (productIds.length > 0) {
          const batchResult = await utils.client.walmartRealTime.batchGetProducts.query({
            productIds
          });
          
          // Update product if it's in the batch
          if (productId && batchResult[productId]) {
            setProduct(batchResult[productId]);
          }
        }
      }, intervalMs);
      
      // Store interval ID for cleanup
      (window as any)[subscriptionId] = interval;
      
      return subscriptionId;
    } catch (err) {
      console.error('Failed to subscribe:', err);
      return null;
    }
  }, [productId, utils.client.walmartRealTime.batchGetProducts]);

  const unsubscribe = useCallback((subscriptionId: string) => {
    const interval = (window as any)[subscriptionId];
    if (interval) {
      clearInterval(interval);
      delete (window as any)[subscriptionId];
    }
    if (subscriptionRef.current === subscriptionId) {
      subscriptionRef.current = null;
    }
  }, []);

  const setPriceAlert = useCallback(async (
    productId: string,
    targetPrice: number,
    alertType: 'below' | 'above'
  ) => {
    try {
      // setPriceAlertMutation is currently null - need to implement in router
      if (!setPriceAlertMutation) {
        console.warn('setPriceAlert mutation not implemented yet');
        return;
      }
      await setPriceAlertMutation.mutateAsync({
        productId,
        targetPrice,
        alertType
      });
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [setPriceAlertMutation]);

  const checkStoreAvailability = useCallback(async (productId: string, zipCode: string) => {
    try {
      // checkAvailabilityMutation is currently null - need to implement in router
      if (!checkAvailabilityMutation) {
        console.warn('checkStoreAvailability mutation not implemented yet');
        return;
      }
      const result = await checkAvailabilityMutation.mutateAsync({
        productId,
        zipCode
      });
      setStoreAvailability(result.stores);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [checkAvailabilityMutation]);

  const addToCart = useCallback(async (productId: string, quantity: number) => {
    try {
      // This would integrate with the cart system
      // For now, just log the action
      console.log('Adding to cart:', { productId, quantity });
      // You could call a cart mutation here
      // await addToCartMutation.mutateAsync({ productId, quantity });
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        unsubscribe(subscriptionRef.current);
      }
    };
  }, [unsubscribe]);

  return {
    product,
    isLoading,
    error,
    priceHistory,
    storeAvailability,
    orderHistory,
    refresh,
    searchProducts,
    subscribeToUpdates,
    unsubscribe,
    setPriceAlert,
    checkStoreAvailability,
    addToCart
  };
}