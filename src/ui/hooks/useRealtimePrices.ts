import { useState, useCallback, useEffect, useRef } from "react";
import { useGroceryWebSocket, type GroceryWebSocketEvent } from "./useGroceryWebSocket.js";
import { logger } from "../../utils/logger.js";

export interface PriceUpdate {
  productId: string;
  oldPrice: number;
  newPrice: number;
  percentageChange: number;
  reason?: "rollback" | "sale" | "clearance" | "regular_price_change";
  timestamp: number;
  isIncrease: boolean;
  savings?: number;
}

export interface PriceChangeIndicator {
  productId: string;
  changeType: "increase" | "decrease" | "no_change";
  animation: "flash" | "bounce" | "pulse" | "none";
  duration: number;
  show: boolean;
}

export interface RealtimePricesState {
  priceUpdates: Map<string, PriceUpdate>;
  priceChangeIndicators: Map<string, PriceChangeIndicator>;
  totalSavingsDetected: number;
  dealsActive: number;
  lastUpdateTime: number;
}

export interface UseRealtimePricesOptions {
  productIds?: string[];
  conversationId?: string;
  userId?: string;
  onPriceChange?: (update: PriceUpdate) => void;
  onDealDetected?: (dealInfo: any) => void;
  onTotalRecalculated?: (newTotal: number, savings: number) => void;
  enableAnimations?: boolean;
  maxPriceHistory?: number;
}

export interface UseRealtimePricesReturn extends RealtimePricesState {
  subscribeToPrices: (productIds: string[]) => void;
  unsubscribeFromPrices: (productIds: string[]) => void;
  getPriceUpdate: (productId: string) => PriceUpdate | undefined;
  getPriceChangeIndicator: (productId: string) => PriceChangeIndicator | undefined;
  clearPriceIndicator: (productId: string) => void;
  clearAllIndicators: () => void;
  getRecentPriceChanges: (minutes?: number) => PriceUpdate[];
  isConnected: boolean;
  connectionStatus: string;
}

const PRICE_CHANGE_ANIMATION_DURATION = 3000;
const DEFAULT_MAX_PRICE_HISTORY = 100;

export function useRealtimePrices(
  options: UseRealtimePricesOptions = {}
): UseRealtimePricesReturn {
  const {
    productIds = [],
    conversationId,
    userId,
    onPriceChange,
    onDealDetected,
    onTotalRecalculated,
    enableAnimations = true,
    maxPriceHistory = DEFAULT_MAX_PRICE_HISTORY,
  } = options;

  // State management
  const [state, setState] = useState<RealtimePricesState>({
    priceUpdates: new Map(),
    priceChangeIndicators: new Map(),
    totalSavingsDetected: 0,
    dealsActive: 0,
    lastUpdateTime: 0,
  });

  // Refs for cleanup and timers
  const animationTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const subscribedProductsRef = useRef<Set<string>>(new Set(productIds));

  // WebSocket connection
  const { 
    isConnected, 
    connectionStatus, 
    subscribe, 
    unsubscribe 
  } = useGroceryWebSocket({
    conversationId,
    userId,
    onEvent: handleWebSocketEvent,
    enableLogging: true,
  });

  // Handle incoming WebSocket events
  function handleWebSocketEvent(event: GroceryWebSocketEvent) {
    switch (event.type) {
      case 'price_updated':
        handlePriceUpdate(event);
        break;
      case 'deal_detected':
        handleDealDetected(event);
        break;
      case 'totals_calculated':
        handleTotalsCalculated(event);
        break;
      case 'cart_updated':
        handleCartUpdate(event);
        break;
      default:
        break;
    }
  }

  // Handle price update events
  const handlePriceUpdate = useCallback((event: GroceryWebSocketEvent) => {
    const { productId, oldPrice, newPrice, reason } = event.data;
    
    if (!productId || oldPrice === undefined || newPrice === undefined) {
      logger.warn("Invalid price update data", "REALTIME_PRICES", event.data);
      return;
    }

    const percentageChange = ((newPrice - oldPrice) / oldPrice) * 100;
    const isIncrease = newPrice > oldPrice;
    const savings = isIncrease ? 0 : oldPrice - newPrice;

    const priceUpdate: PriceUpdate = {
      productId,
      oldPrice,
      newPrice,
      percentageChange,
      reason,
      timestamp: event.timestamp || Date.now(),
      isIncrease,
      savings,
    };

    // Update state
    setState(prevState => {
      const newPriceUpdates = new Map(prevState.priceUpdates);
      newPriceUpdates.set(productId, priceUpdate);

      // Limit history size
      if (newPriceUpdates.size > maxPriceHistory) {
        const oldest = Array.from(newPriceUpdates.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
        newPriceUpdates.delete(oldest[0]);
      }

      const newIndicators = new Map(prevState.priceChangeIndicators);
      
      // Create price change indicator with animation
      if (enableAnimations) {
        const indicator: PriceChangeIndicator = {
          productId,
          changeType: isIncrease ? "increase" : "decrease",
          animation: savings > 0 ? "bounce" : isIncrease ? "pulse" : "flash",
          duration: PRICE_CHANGE_ANIMATION_DURATION,
          show: true,
        };
        
        newIndicators.set(productId, indicator);

        // Clear existing timer
        const existingTimer = animationTimersRef?.current?.get(productId);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        // Set new timer to hide animation
        const timer = setTimeout(() => {
          setState(prev => ({
            ...prev,
            priceChangeIndicators: new Map(prev.priceChangeIndicators).set(productId, {
              ...indicator,
              show: false,
            })
          }));
          animationTimersRef?.current?.delete(productId);
        }, PRICE_CHANGE_ANIMATION_DURATION);

        animationTimersRef?.current?.set(productId, timer);
      }

      const newTotalSavings = prevState.totalSavingsDetected + (savings || 0);

      return {
        ...prevState,
        priceUpdates: newPriceUpdates,
        priceChangeIndicators: newIndicators,
        totalSavingsDetected: newTotalSavings,
        lastUpdateTime: Date.now(),
      };
    });

    // Trigger callbacks
    onPriceChange?.(priceUpdate);
    
    logger.info(`Price update for ${productId}: ${oldPrice} -> ${newPrice}`, "REALTIME_PRICES", priceUpdate);
  }, [onPriceChange, enableAnimations, maxPriceHistory]);

  // Handle deal detection events
  const handleDealDetected = useCallback((event: GroceryWebSocketEvent) => {
    const { productId, dealInfo, savings } = event.data;
    
    setState(prev => ({
      ...prev,
      dealsActive: prev.dealsActive + 1,
      totalSavingsDetected: prev.totalSavingsDetected + (savings || 0),
      lastUpdateTime: Date.now(),
    }));

    onDealDetected?.(event.data);
    
    logger.info(`Deal detected for ${productId}`, "REALTIME_PRICES", event.data);
  }, [onDealDetected]);

  // Handle total calculation events
  const handleTotalsCalculated = useCallback((event: GroceryWebSocketEvent) => {
    const { total, savings } = event.data;
    
    onTotalRecalculated?.(total, savings);
    
    logger.info(`Totals recalculated: ${total} (savings: ${savings})`, "REALTIME_PRICES");
  }, [onTotalRecalculated]);

  // Handle cart update events
  const handleCartUpdate = useCallback((event: GroceryWebSocketEvent) => {
    // Update subscriptions based on cart changes
    const { items } = event.data;
    if (items && Array.isArray(items)) {
      const newProductIds = items?.map((item: any) => item.productId).filter(Boolean);
      subscribeToPrices(newProductIds);
    }
  }, []);

  // Subscribe to price updates for specific products
  const subscribeToPrices = useCallback((newProductIds: string[]) => {
    const uniqueIds = [...new Set(newProductIds)];
    const newSubscriptions = uniqueIds?.filter(id => !subscribedProductsRef?.current?.has(id));
    
    if (newSubscriptions?.length || 0 > 0) {
      newSubscriptions.forEach(id => subscribedProductsRef?.current?.add(id));
      
      // Subscribe to price update events
      subscribe(['price_updated', 'deal_detected']);
      
      logger.info(`Subscribed to price updates for ${newSubscriptions?.length || 0} products`, "REALTIME_PRICES", newSubscriptions);
    }
  }, [subscribe]);

  // Unsubscribe from price updates
  const unsubscribeFromPrices = useCallback((productIds: string[]) => {
    productIds.forEach(id => subscribedProductsRef?.current?.delete(id));
    
    // Clear related data
    setState(prev => {
      const newPriceUpdates = new Map(prev.priceUpdates);
      const newIndicators = new Map(prev.priceChangeIndicators);
      
      productIds.forEach(id => {
        newPriceUpdates.delete(id);
        newIndicators.delete(id);
        
        // Clear animation timer
        const timer = animationTimersRef?.current?.get(id);
        if (timer) {
          clearTimeout(timer);
          animationTimersRef?.current?.delete(id);
        }
      });

      return {
        ...prev,
        priceUpdates: newPriceUpdates,
        priceChangeIndicators: newIndicators,
      };
    });
    
    logger.info(`Unsubscribed from price updates for ${productIds?.length || 0} products`, "REALTIME_PRICES");
  }, []);

  // Get price update for specific product
  const getPriceUpdate = useCallback((productId: string): PriceUpdate | undefined => {
    return state?.priceUpdates?.get(productId);
  }, [state.priceUpdates]);

  // Get price change indicator for specific product
  const getPriceChangeIndicator = useCallback((productId: string): PriceChangeIndicator | undefined => {
    return state?.priceChangeIndicators?.get(productId);
  }, [state.priceChangeIndicators]);

  // Clear price indicator for specific product
  const clearPriceIndicator = useCallback((productId: string) => {
    setState(prev => {
      const newIndicators = new Map(prev.priceChangeIndicators);
      newIndicators.delete(productId);
      return { ...prev, priceChangeIndicators: newIndicators };
    });

    const timer = animationTimersRef?.current?.get(productId);
    if (timer) {
      clearTimeout(timer);
      animationTimersRef?.current?.delete(productId);
    }
  }, []);

  // Clear all price indicators
  const clearAllIndicators = useCallback(() => {
    setState(prev => ({
      ...prev,
      priceChangeIndicators: new Map(),
    }));

    // Clear all animation timers
    animationTimersRef?.current?.forEach(timer => clearTimeout(timer));
    animationTimersRef?.current?.clear();
  }, []);

  // Get recent price changes within specified time window
  const getRecentPriceChanges = useCallback((minutes: number = 30): PriceUpdate[] => {
    const cutoffTime = Date.now() - (minutes * 60 * 1000);
    return Array.from(state?.priceUpdates?.values())
      .filter(update => update.timestamp >= cutoffTime)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [state.priceUpdates]);

  // Initialize subscriptions
  useEffect(() => {
    if (productIds?.length || 0 > 0) {
      subscribeToPrices(productIds);
    }

    // Cleanup on unmount
    return () => {
      animationTimersRef?.current?.forEach(timer => clearTimeout(timer));
      animationTimersRef?.current?.clear();
    };
  }, [productIds, subscribeToPrices]);

  return {
    ...state,
    subscribeToPrices,
    unsubscribeFromPrices,
    getPriceUpdate,
    getPriceChangeIndicator,
    clearPriceIndicator,
    clearAllIndicators,
    getRecentPriceChanges,
    isConnected,
    connectionStatus,
  };
}

export default useRealtimePrices;