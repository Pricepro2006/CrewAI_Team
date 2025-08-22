import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useGroceryWebSocketStable, type GroceryWebSocketEvent } from "./useGroceryWebSocketStable.js";
import { logger } from "../../utils/logger.js";

// Re-export types for compatibility
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

export interface UseRealtimePricesStableOptions {
  productIds?: string[];
  conversationId?: string;
  userId?: string;
  onPriceChange?: (update: PriceUpdate) => void;
  onDealDetected?: (dealInfo: unknown) => void;
  onTotalRecalculated?: (newTotal: number, savings: number) => void;
  enableAnimations?: boolean;
  maxPriceHistory?: number;
}

export interface UseRealtimePricesStableReturn extends RealtimePricesState {
  // Stable functions that won't cause re-renders
  getPriceUpdate: (productId: string) => PriceUpdate | undefined;
  getPriceChangeIndicator: (productId: string) => PriceChangeIndicator | undefined;
  clearPriceIndicator: (productId: string) => void;
  clearAllIndicators: () => void;
  getRecentPriceChanges: (minutes?: number) => PriceUpdate[];
  
  // Connection state
  isConnected: boolean;
  connectionStatus: string;
  
  // Price subscription - STABLE FUNCTION TO PREVENT INFINITE LOOPS
  updatePriceSubscription: (productIds: string[]) => void;
}

const PRICE_CHANGE_ANIMATION_DURATION = 3000;
const DEFAULT_MAX_PRICE_HISTORY = 100;

export function useRealtimePricesStable(
  options: UseRealtimePricesStableOptions = {}
): UseRealtimePricesStableReturn {
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
  
  // Stable callback refs to prevent infinite loops
  const onPriceChangeRef = useRef(onPriceChange);
  const onDealDetectedRef = useRef(onDealDetected);
  const onTotalRecalculatedRef = useRef(onTotalRecalculated);

  // Update callback refs without causing re-renders
  useEffect(() => {
    onPriceChangeRef.current = onPriceChange;
    onDealDetectedRef.current = onDealDetected;
    onTotalRecalculatedRef.current = onTotalRecalculated;
  });

  // Handle price update events - stable reference
  const handlePriceUpdate = useCallback((event: GroceryWebSocketEvent) => {
    const { productId, oldPrice, newPrice, reason } = event.data as any;
    
    if (!productId || oldPrice === undefined || newPrice === undefined) {
      logger.warn("Invalid price update data", "REALTIME_PRICES_STABLE", event.data);
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
        if (oldest) {
          newPriceUpdates.delete(oldest[0]);
        }
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
        const existingTimer = animationTimersRef.current.get(productId);
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
          animationTimersRef.current.delete(productId);
        }, PRICE_CHANGE_ANIMATION_DURATION);

        animationTimersRef.current.set(productId, timer);
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
    onPriceChangeRef.current?.(priceUpdate);
    
    logger.info(`Price update for ${productId}: ${oldPrice} -> ${newPrice}`, "REALTIME_PRICES_STABLE", priceUpdate);
  }, [enableAnimations, maxPriceHistory]);

  // Handle deal detection events - stable reference
  const handleDealDetected = useCallback((event: GroceryWebSocketEvent) => {
    const { productId, dealInfo, savings } = event.data as any;
    
    setState(prev => ({
      ...prev,
      dealsActive: prev.dealsActive + 1,
      totalSavingsDetected: prev.totalSavingsDetected + (savings || 0),
      lastUpdateTime: Date.now(),
    }));

    onDealDetectedRef.current?.(event.data);
    
    logger.info(`Deal detected for ${productId}`, "REALTIME_PRICES_STABLE", event.data);
  }, []);

  // Handle total calculation events - stable reference
  const handleTotalsCalculated = useCallback((event: GroceryWebSocketEvent) => {
    const { total, savings } = event.data as any;
    
    onTotalRecalculatedRef.current?.(total, savings);
    
    logger.info(`Totals recalculated: ${total} (savings: ${savings})`, "REALTIME_PRICES_STABLE");
  }, []);

  // Handle incoming WebSocket events - stable reference
  const handleWebSocketEvent = useCallback((event: GroceryWebSocketEvent) => {
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
        const { items } = event.data as any;
        if (items && Array.isArray(items)) {
          const newProductIds = items.map((item: any) => item.productId).filter(Boolean);
          // Use the stable subscription function
          stableFunctions.updatePriceSubscription(newProductIds);
        }
        break;
      default:
        break;
    }
  }, [handlePriceUpdate, handleDealDetected, handleTotalsCalculated]);

  // WebSocket connection with stable event handler
  const { 
    isConnected, 
    connectionStatus, 
    subscribeToPrice
  } = useGroceryWebSocketStable({
    conversationId,
    userId,
    onEvent: handleWebSocketEvent, // This is now stable
    enableLogging: true,
  });

  // Create stable functions to prevent infinite re-renders
  const stableFunctions = useMemo(() => ({
    // CRITICAL: Stable price subscription function
    updatePriceSubscription: (newProductIds: string[]) => {
      const uniqueIds = Array.from(new Set(newProductIds));
      
      if (uniqueIds.length > 0) {
        subscribeToPrice(uniqueIds); // This is now stable from useGroceryWebSocketStable
        logger.info(`Updated price subscriptions for ${uniqueIds.length} products`, "REALTIME_PRICES_STABLE", uniqueIds);
      }
    },

    // Get price update for specific product
    getPriceUpdate: (productId: string): PriceUpdate | undefined => {
      return state.priceUpdates.get(productId);
    },

    // Get price change indicator for specific product
    getPriceChangeIndicator: (productId: string): PriceChangeIndicator | undefined => {
      return state.priceChangeIndicators.get(productId);
    },

    // Clear price indicator for specific product
    clearPriceIndicator: (productId: string) => {
      setState(prev => {
        const newIndicators = new Map(prev.priceChangeIndicators);
        newIndicators.delete(productId);
        return { ...prev, priceChangeIndicators: newIndicators };
      });

      const timer = animationTimersRef.current.get(productId);
      if (timer) {
        clearTimeout(timer);
        animationTimersRef.current.delete(productId);
      }
    },

    // Clear all price indicators
    clearAllIndicators: () => {
      setState(prev => ({
        ...prev,
        priceChangeIndicators: new Map(),
      }));

      // Clear all animation timers
      animationTimersRef.current.forEach(timer => clearTimeout(timer));
      animationTimersRef.current.clear();
    },

    // Get recent price changes within specified time window
    getRecentPriceChanges: (minutes: number = 30): PriceUpdate[] => {
      const cutoffTime = Date.now() - (minutes * 60 * 1000);
      return Array.from(state.priceUpdates.values())
        .filter(update => update.timestamp >= cutoffTime)
        .sort((a, b) => b.timestamp - a.timestamp);
    }
  }), [subscribeToPrice, state.priceUpdates, state.priceChangeIndicators]);

  // Initialize subscriptions with the stable function - CRITICAL FIX
  useEffect(() => {
    if (productIds.length > 0) {
      // Use the stable function instead of recreating subscriptions
      stableFunctions.updatePriceSubscription(productIds);
    }

    // Cleanup on unmount
    return () => {
      animationTimersRef.current.forEach(timer => clearTimeout(timer));
      animationTimersRef.current.clear();
    };
  }, []); // EMPTY DEPS - only run on mount/unmount

  // Separate effect to handle product ID changes without infinite loops
  useEffect(() => {
    stableFunctions.updatePriceSubscription(productIds);
  }, [productIds.join(',')]); // Only re-run when actual product IDs change

  return {
    ...state,
    isConnected,
    connectionStatus,
    ...stableFunctions
  };
}

export default useRealtimePricesStable;