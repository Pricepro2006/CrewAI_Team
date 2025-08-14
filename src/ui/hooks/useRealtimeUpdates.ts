/**
 * Real-Time Updates Hook
 * Manages real-time data synchronization with intelligent conflict resolution
 * and background sync capabilities for the Walmart Grocery Agent
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWalmartWebSocket } from './useWalmartWebSocket';
import { walmartCacheService } from '../services/WalmartCacheService';
import { WalmartProduct, CartItem, PriceAlert, WSMessage } from '../components/Walmart/types/WalmartTypes';

interface UseRealtimeUpdatesOptions {
  productIds?: string[];
  categories?: string[];
  priceAlerts?: boolean;
  cartSync?: boolean;
  enablePush?: boolean;
  syncInterval?: number; // Background sync interval in ms
  retryAttempts?: number;
  retryDelay?: number;
}

interface PendingUpdate {
  id: string;
  type: 'product' | 'cart' | 'price' | 'alert';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  attempts: number;
}

interface SyncStatus {
  isOnline: boolean;
  lastSync: Date | null;
  pendingUpdates: number;
  syncInProgress: boolean;
  lastError: string | null;
}

interface ConflictResolution {
  strategy: 'client-wins' | 'server-wins' | 'manual' | 'merge';
  resolver?: (clientData: any, serverData: any) => any;
}

export const useRealtimeUpdates = (options: UseRealtimeUpdatesOptions = {}) => {
  const {
    productIds = [],
    categories = [],
    priceAlerts = true,
    cartSync = true,
    enablePush = false,
    syncInterval = 30000, // 30 seconds
    retryAttempts = 3,
    retryDelay = 1000
  } = options;
  
  // State
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    lastSync: null,
    pendingUpdates: 0,
    syncInProgress: false,
    lastError: null
  });
  
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [priceUpdates, setPriceUpdates] = useState<Map<string, number>>(new Map());
  const [productUpdates, setProductUpdates] = useState<Map<string, WalmartProduct>>(new Map());
  
  // Refs
  const syncIntervalRef = useRef<NodeJS.Timeout>();
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const isInitializedRef = useRef(false);
  const conflictResolvers = useRef<Map<string, ConflictResolution>>(new Map());
  
  // WebSocket connection
  const {
    isConnected,
    sendMessage,
    lastMessage,
    connect,
    disconnect
  } = useWalmartWebSocket({
    autoConnect: true,
    userId: 'current-user' // Should come from auth context
  });
  
  /**
   * Update online status
   */
  const updateOnlineStatus = useCallback(() => {
    const isOnline = navigator.onLine && isConnected;
    setSyncStatus(prev => ({
      ...prev,
      isOnline,
      lastError: isOnline ? null : prev.lastError
    }));
    
    if (isOnline && pendingUpdates.length > 0) {
      // Process pending updates when back online
      processPendingUpdates();
    }
  }, [isConnected, pendingUpdates.length]);
  
  /**
   * Add pending update to queue
   */
  const addPendingUpdate = useCallback((update: Omit<PendingUpdate, 'id' | 'timestamp' | 'attempts'>) => {
    const pendingUpdate: PendingUpdate = {
      ...update,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      attempts: 0
    };
    
    setPendingUpdates(prev => {
      const newUpdates = [...prev, pendingUpdate];
      setSyncStatus(current => ({ ...current, pendingUpdates: newUpdates.length }));
      return newUpdates;
    });
    
    // Store in cache for persistence
    walmartCacheService.set(`pending_update_${pendingUpdate.id}`, pendingUpdate, 24 * 60 * 60 * 1000); // 24 hours
    
    return pendingUpdate.id;
  }, []);
  
  /**
   * Remove pending update
   */
  const removePendingUpdate = useCallback((updateId: string) => {
    setPendingUpdates(prev => {
      const newUpdates = prev.filter(update => update.id !== updateId);
      setSyncStatus(current => ({ ...current, pendingUpdates: newUpdates.length }));
      return newUpdates;
    });
    
    // Remove from cache
    walmartCacheService.delete(`pending_update_${updateId}`);
  }, []);
  
  /**
   * Process pending updates
   */
  const processPendingUpdates = useCallback(async () => {
    if (!syncStatus.isOnline || syncStatus.syncInProgress || pendingUpdates.length === 0) {
      return;
    }
    
    setSyncStatus(prev => ({ ...prev, syncInProgress: true, lastError: null }));
    
    try {
      const updatePromises = pendingUpdates.map(async (update) => {
        try {
          await processUpdate(update);
          removePendingUpdate(update.id);
        } catch (error) {
          update.attempts++;
          
          if (update.attempts >= retryAttempts) {
            console.error(`Failed to sync update ${update.id} after ${retryAttempts} attempts:`, error);
            removePendingUpdate(update.id);
          } else {
            // Retry with exponential backoff
            const delay = retryDelay * Math.pow(2, update.attempts - 1);
            setTimeout(() => {
              // Update will be retried in next sync cycle
            }, delay);
          }
        }
      });
      
      await Promise.allSettled(updatePromises);
      
      setSyncStatus(prev => ({
        ...prev,
        syncInProgress: false,
        lastSync: new Date()
      }));
      
    } catch (error) {
      setSyncStatus(prev => ({
        ...prev,
        syncInProgress: false,
        lastError: error instanceof Error ? error.message : 'Sync failed'
      }));
    }
  }, [syncStatus.isOnline, syncStatus.syncInProgress, pendingUpdates, retryAttempts, retryDelay]);
  
  /**
   * Process individual update
   */
  const processUpdate = useCallback(async (update: PendingUpdate) => {
    const message: WSMessage = {
      type: `${update.type}_${update.action}` as any,
      data: update.data,
      timestamp: new Date().toISOString()
    };
    
    const success = sendMessage(message);
    if (!success) {
      throw new Error('Failed to send update via WebSocket');
    }
    
    // Wait for confirmation or timeout
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Update timeout'));
      }, 10000);
      
      // This would typically be handled by WebSocket message handlers
      // For now, we'll assume success
      clearTimeout(timeout);
      resolve(true);
    });
  }, [sendMessage]);
  
  /**
   * Handle WebSocket messages
   */
  const handleWebSocketMessage = useCallback((message: WSMessage) => {
    switch (message.type) {
      case 'price_update':
        if (priceAlerts) {
          const { productId, newPrice, oldPrice } = message.data;
          setPriceUpdates(prev => new Map(prev.set(productId, newPrice)));
          
          // Update cache
          walmartCacheService.getProduct(productId).then(product => {
            if (product) {
              product.price = newPrice;
              walmartCacheService.setProduct(product);
            }
          });
          
          // Show push notification if enabled
          if (enablePush && 'Notification' in window) {
            showPriceUpdateNotification(productId, oldPrice, newPrice);
          }
        }
        break;
        
      case 'product_update':
        const updatedProduct = message.data as WalmartProduct;
        setProductUpdates(prev => new Map(prev.set(updatedProduct.id, updatedProduct)));
        
        // Update cache
        walmartCacheService.setProduct(updatedProduct);
        break;
        
      case 'cart_update':
        if (cartSync) {
          handleCartUpdate(message.data);
        }
        break;
        
      case 'conflict':
        handleConflict(message.data);
        break;
    }
  }, [priceAlerts, cartSync, enablePush]);
  
  /**
   * Handle cart updates
   */
  const handleCartUpdate = useCallback((cartData: any) => {
    // Emit custom event for cart components to listen to
    window.dispatchEvent(new CustomEvent('walmart-cart-update', {
      detail: cartData
    }));
  }, []);
  
  /**
   * Handle conflicts
   */
  const handleConflict = useCallback((conflictData: any) => {
    const resolver = conflictResolvers.current.get(conflictData.type);
    
    if (resolver) {
      switch (resolver.strategy) {
        case 'client-wins':
          // Keep client data, ignore server data
          break;
          
        case 'server-wins':
          // Accept server data, update client
          applyServerData(conflictData);
          break;
          
        case 'merge':
          if (resolver.resolver) {
            const mergedData = resolver.resolver(conflictData.clientData, conflictData.serverData);
            applyMergedData(conflictData.type, mergedData);
          }
          break;
          
        case 'manual':
        default:
          // Add to conflicts list for manual resolution
          setConflicts(prev => [...prev, conflictData]);
          break;
      }
    } else {
      setConflicts(prev => [...prev, conflictData]);
    }
  }, []);
  
  /**
   * Apply server data in conflict resolution
   */
  const applyServerData = useCallback((conflictData: any) => {
    switch (conflictData.type) {
      case 'product':
        setProductUpdates(prev => new Map(prev.set(conflictData.id, conflictData.serverData)));
        walmartCacheService.setProduct(conflictData.serverData);
        break;
        
      case 'cart':
        handleCartUpdate(conflictData.serverData);
        break;
    }
  }, [handleCartUpdate]);
  
  /**
   * Apply merged data in conflict resolution
   */
  const applyMergedData = useCallback((type: string, mergedData: any) => {
    switch (type) {
      case 'product':
        setProductUpdates(prev => new Map(prev.set(mergedData.id, mergedData)));
        walmartCacheService.setProduct(mergedData);
        break;
        
      case 'cart':
        handleCartUpdate(mergedData);
        break;
    }
  }, [handleCartUpdate]);
  
  /**
   * Show price update notification
   */
  const showPriceUpdateNotification = useCallback((productId: string, oldPrice: number, newPrice: number) => {
    if (Notification.permission === 'granted') {
      const priceChange = newPrice - oldPrice;
      const changeText = priceChange > 0 ? 'increased' : 'decreased';
      const changeAmount = Math.abs(priceChange).toFixed(2);
      
      new Notification('Price Alert', {
        body: `Price ${changeText} by $${changeAmount}`,
        icon: '/walmart-icon.png',
        tag: `price-${productId}`,
        renotify: true
      });
    }
  }, []);
  
  /**
   * Subscribe to product updates
   */
  const subscribeToProducts = useCallback((ids: string[]) => {
    if (isConnected && ids.length > 0) {
      sendMessage({
        type: 'subscribe_products',
        data: { productIds: ids },
        timestamp: new Date().toISOString()
      });
    }
  }, [isConnected, sendMessage]);
  
  /**
   * Subscribe to category updates
   */
  const subscribeToCategories = useCallback((cats: string[]) => {
    if (isConnected && cats.length > 0) {
      sendMessage({
        type: 'subscribe_categories',
        data: { categories: cats },
        timestamp: new Date().toISOString()
      });
    }
  }, [isConnected, sendMessage]);
  
  /**
   * Manually trigger sync
   */
  const syncNow = useCallback(async () => {
    await processPendingUpdates();
  }, [processPendingUpdates]);
  
  /**
   * Pause sync
   */
  const pauseSync = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = undefined;
    }
  }, []);
  
  /**
   * Resume sync
   */
  const resumeSync = useCallback(() => {
    if (!syncIntervalRef.current) {
      syncIntervalRef.current = setInterval(processPendingUpdates, syncInterval);
    }
  }, [processPendingUpdates, syncInterval]);
  
  /**
   * Set conflict resolver
   */
  const setConflictResolver = useCallback((type: string, resolver: ConflictResolution) => {
    conflictResolvers.current.set(type, resolver);
  }, []);
  
  /**
   * Resolve conflict manually
   */
  const resolveConflict = useCallback((conflictId: string, resolution: 'client' | 'server' | any) => {
    setConflicts(prev => {
      const conflict = prev.find(c => c.id === conflictId);
      if (!conflict) return prev;
      
      if (resolution === 'client') {
        // Keep client data
      } else if (resolution === 'server') {
        applyServerData(conflict);
      } else {
        // Apply custom resolution
        applyMergedData(conflict.type, resolution);
      }
      
      return prev.filter(c => c.id !== conflictId);
    });
  }, [applyServerData, applyMergedData]);
  
  /**
   * Load pending updates from cache on mount
   */
  useEffect(() => {
    const loadPendingUpdates = async () => {
      // This would load pending updates from IndexedDB cache
      // Implementation depends on cache structure
    };
    
    loadPendingUpdates();
  }, []);
  
  /**
   * Handle WebSocket messages
   */
  useEffect(() => {
    if (lastMessage) {
      handleWebSocketMessage(lastMessage);
    }
  }, [lastMessage, handleWebSocketMessage]);
  
  /**
   * Update online status
   */
  useEffect(() => {
    updateOnlineStatus();
  }, [isConnected, updateOnlineStatus]);
  
  /**
   * Subscribe to products and categories on connection
   */
  useEffect(() => {
    if (isConnected && !isInitializedRef.current) {
      subscribeToProducts(productIds);
      subscribeToCategories(categories);
      isInitializedRef.current = true;
    }
  }, [isConnected, productIds, categories, subscribeToProducts, subscribeToCategories]);
  
  /**
   * Set up background sync interval
   */
  useEffect(() => {
    resumeSync();
    
    return () => {
      pauseSync();
    };
  }, [resumeSync, pauseSync]);
  
  /**
   * Handle online/offline events
   */
  useEffect(() => {
    const handleOnline = () => updateOnlineStatus();
    const handleOffline = () => updateOnlineStatus();
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [updateOnlineStatus]);
  
  /**
   * Request notification permission if push notifications enabled
   */
  useEffect(() => {
    if (enablePush && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [enablePush]);
  
  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      pauseSync();
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [pauseSync]);
  
  return {
    // Status
    isOnline: syncStatus.isOnline,
    lastSync: syncStatus.lastSync,
    pendingUpdates: syncStatus.pendingUpdates,
    syncInProgress: syncStatus.syncInProgress,
    lastError: syncStatus.lastError,
    
    // Updates
    priceUpdates,
    productUpdates,
    conflicts,
    
    // Actions
    syncNow,
    pauseSync,
    resumeSync,
    addPendingUpdate,
    subscribeToProducts,
    subscribeToCategories,
    setConflictResolver,
    resolveConflict,
    
    // Connection management
    connect,
    disconnect
  };
}