import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, 
  Minus, 
  Trash2, 
  Save, 
  Share2, 
  ShoppingCart, 
  DollarSign, 
  Package, 
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Zap,
  Clock,
  Target,
  Gift,
  Truck
} from 'lucide-react';
import { api } from '../../../lib/trpc.js';
import { useRealtimePrices } from '../../hooks/useRealtimePrices.js';
import ConnectionStatus from '../common/ConnectionStatus.js';
import NaturalLanguageInput from './NaturalLanguageInput.js';
import CommandHistory from './CommandHistory.js';
import type { CommandHistoryItem } from './CommandHistory.js';
import './GroceryListEnhanced.css';
import './NaturalLanguageInput.css';
import './CommandHistory.css';

interface GroceryItem {
  id: string;
  productId: string;
  name: string;
  category: string;
  quantity: number;
  price: number;
  originalPrice?: number;
  unit: string;
  imageUrl: string;
  inStock: boolean;
  notes?: string;
}

interface GroceryList {
  items: GroceryItem[];
  subtotal: number;
  estimatedTax: number;
  total: number;
  savings: number;
  itemCount: number;
  deliveryEligible: boolean;
  deliveryThreshold: number;
}

interface SmartSuggestion {
  id: string;
  productId: string;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  reason: string;
  confidence: number;
  matchScore: number;
  imageUrl: string;
  tags: string[];
}

interface ListTotalCalculation {
  subtotal: number;
  originalSubtotal: number;
  itemSavings: number;
  promoDiscount: number;
  promoDescription: string;
  loyaltyDiscount: number;
  tax: number;
  taxRate: number;
  deliveryFee: number;
  deliveryFeeWaived: boolean;
  totalSavings: number;
  total: number;
  freeDeliveryEligible: boolean;
  freeDeliveryThreshold: number;
  amountForFreeDelivery: number;
}

export const GroceryListEnhanced: React.FC = () => {
  const [naturalInput, setNaturalInput] = useState('');
  const [groceryList, setGroceryList] = useState<GroceryList | null>(null);
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [totals, setTotals] = useState<ListTotalCalculation | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [savingsFlash, setSavingsFlash] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'price_drop' | 'deal_detected' | 'savings';
    message: string;
    timestamp: number;
    show: boolean;
  }>>([]);
  const [commandHistory, setCommandHistory] = useState<CommandHistoryItem[]>([]);
  const [inputError, setInputError] = useState<string | null>(null);
  const [inputSuccess, setInputSuccess] = useState(false);
  const [showCommandHistory, setShowCommandHistory] = useState(false);
  const [location] = useState({ zipCode: '90210', city: 'Beverly Hills', state: 'CA' });
  const [conversationId] = useState(`grocery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [userId] = useState('demo-user');
  
  // Get current product IDs for price monitoring
  const currentProductIds = useMemo(() => 
    groceryList?.items?.map(item => item.productId) || [], 
    [groceryList]
  );
  
  // Real-time price monitoring
  const {
    priceUpdates,
    totalSavingsDetected,
    dealsActive,
    subscribeToPrices,
    getPriceChangeIndicator,
    getRecentPriceChanges,
    isConnected,
    connectionStatus,
  } = useRealtimePrices({
    productIds: currentProductIds,
    conversationId,
    userId,
    onPriceChange: (update: any) => {
      // Update grocery list with new prices
      if (groceryList) {
        const updatedItems = groceryList?.items?.map(item => 
          item.productId === update.productId || "" 
            ? { ...item, price: update.newPrice, originalPrice: update.oldPrice }
            : item
        );
        setGroceryList({ ...groceryList, items: updatedItems });
        
        // Add price change notification
        if (update.savings && update.savings > 0) {
          const notification = {
            id: `price-${update.productId}-${Date.now()}`,
            type: 'price_drop' as const,
            message: `💰 Price dropped! Save $${update?.savings?.toFixed(2)} on an item`,
            timestamp: Date.now(),
            show: true,
          };
          
          setNotifications(prev => [...prev.slice(-2), notification]);
          
          setTimeout(() => {
            setNotifications(prev => 
              prev?.map(n => n.id === notification.id ? { ...n, show: false } : n)
            );
          }, 4000);
        }
      }
    },
    onDealDetected: (dealInfo: any) => {
      // Flash savings indicator
      setSavingsFlash(true);
      setTimeout(() => setSavingsFlash(false), 2000);
      
      // Add notification
      const notification = {
        id: `deal-${Date.now()}`,
        type: 'deal_detected' as const,
        message: `🎉 New deal detected on ${dealInfo.productName || 'an item'}!`,
        timestamp: Date.now(),
        show: true,
      };
      
      setNotifications(prev => [...prev.slice(-2), notification]);
      
      // Auto-hide notification
      setTimeout(() => {
        setNotifications(prev => 
          prev?.map(n => n.id === notification.id ? { ...n, show: false } : n)
        );
      }, 5000);
    },
    onTotalRecalculated: (newTotal, savings) => {
      // Update totals with new calculations
      if (totals) {
        setTotals({ ...totals, total: newTotal, totalSavings: savings });
      }
    },
    enableAnimations: true,
  });

  // tRPC hooks
  const processGroceryInputMutation = api?.walmartGrocery?.processGroceryInput.useMutation({
    onSuccess: (data: any) => {
      if (data.groceryList) {
        setGroceryList(data.groceryList);
      }
      if (data.suggestions) {
        setSuggestions(data.suggestions);
      }
      
      // Show success state briefly
      setInputSuccess(true);
      setTimeout(() => setInputSuccess(false), 3000);
      
      // Clear any errors
      setInputError(null);
    },
    onError: (error: any) => {
      console.error('Failed to process grocery input:', error);
      setInputError(error.message || 'Failed to process your request');
      setInputSuccess(false);
    }
  });

  const calculateTotalsMutation = api?.walmartGrocery?.calculateListTotals.useMutation({
    onSuccess: (data: any) => {
      if (data.success) {
        setTotals(data.calculation);
      }
    },
    onError: (error: any) => {
      console.error('Failed to calculate totals:', error);
    }
  });

  const getSmartRecommendationsQuery = api?.walmartGrocery?.getSmartRecommendations.useQuery(
    {
      userId,
      context: 'personalized',
      limit: 8,
    },
    {
      enabled: true,
      onSuccess: (data: any) => {
        if (data.recommendations) {
          setSuggestions(data.recommendations);
        }
      }
    }
  );

  // Generate command history for display
  const recentCommands = useMemo(() => 
    commandHistory.slice(0, 5).map(cmd => cmd.command),
    [commandHistory]
  );

  // Calculate totals when grocery list changes
  useEffect(() => {
    if (groceryList && groceryList?.items?.length > 0) {
      const listItems = groceryList?.items?.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        originalPrice: item.originalPrice,
      }));

      calculateTotalsMutation.mutate({
        items: listItems,
        location: { zipCode: location.zipCode, state: location.state },
        loyaltyMember: true,
      });
      
      // Subscribe to price updates for current products
      subscribeToPrices(currentProductIds);
    }
  }, [groceryList, subscribeToPrices, currentProductIds, calculateTotalsMutation, location.zipCode, location.state]);

  // Handle natural language input submission
  const handleInputSubmit = useCallback(async (input: string) => {
    if (!input.trim()) return;
    
    const commandId = `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Add to command history as pending
    const newCommand: CommandHistoryItem = {
      id: commandId,
      command: input.trim(),
      timestamp: Date.now(),
      status: 'pending',
      category: detectCommandCategory(input.trim()),
    };
    
    setCommandHistory(prev => [newCommand, ...prev].slice(0, 20));
    setIsProcessing(true);
    
    try {
      const startTime = Date.now();
      const result = await processGroceryInputMutation.mutateAsync({
        conversationId,
        userId,
        input: input.trim(),
        location,
      });
      
      const executionTime = Date.now() - startTime;
      
      // Update command history with success
      setCommandHistory(prev => prev?.map(cmd => 
        cmd.id === commandId
          ? {
              ...cmd,
              status: 'success' as const,
              result: getSuccessMessage(result),
              executionTime,
              itemsAffected: result.groceryList?.items?.length || 0 || 0,
            }
          : cmd
      ));
      
    } catch (error) {
      // Update command history with error
      setCommandHistory(prev => prev?.map(cmd => 
        cmd.id === commandId
          ? {
              ...cmd,
              status: 'error' as const,
              result: error instanceof Error ? error.message : 'Unknown error',
            }
          : cmd
      ));
    } finally {
      setIsProcessing(false);
    }
  }, [processGroceryInputMutation, conversationId, userId, location]);

  // Detect command category for history classification
  const detectCommandCategory = useCallback((command: string): string => {
    const lowerCommand = command.toLowerCase();
    
    if (lowerCommand.includes('add') || lowerCommand.includes('need') || lowerCommand.includes('get')) {
      return 'add';
    } else if (lowerCommand.includes('remove') || lowerCommand.includes('delete')) {
      return 'remove';
    } else if (lowerCommand.includes('change') || lowerCommand.includes('update') || lowerCommand.includes('modify')) {
      return 'modify';
    } else if (lowerCommand.includes('total') || lowerCommand.includes('cost') || lowerCommand.includes('price')) {
      return 'query';
    } else if (lowerCommand.includes('clear') || lowerCommand.includes('empty')) {
      return 'list';
    }
    
    return 'query';
  }, []);

  // Generate success message from API result
  const getSuccessMessage = useCallback((result: any): string => {
    if (result.groceryList && result?.groceryList?.items?.length || 0 > 0) {
      return `Updated list with ${result?.groceryList?.items?.length || 0} items`;
    } else if (result.suggestions && result?.suggestions?.length > 0) {
      return `Found ${result?.suggestions?.length} suggestions`;
    }
    return 'Command processed successfully';
  }, []);

  // Handle command history replay
  const handleCommandReplay = useCallback((command: string) => {
    setNaturalInput(command);
  }, []);

  // Handle command editing
  const handleCommandEdit = (command: string) => {
    setNaturalInput(command);
  };

  // Handle command deletion
  const handleCommandDelete = (commandId: string) => {
    setCommandHistory(prev => prev?.filter(cmd => cmd.id !== commandId));
  };

  // Handle clearing all command history
  const handleClearHistory = () => {
    setCommandHistory([]);
  };

  // Handle voice recognition callbacks
  const handleVoiceStart = () => {
    setInputError(null);
  };

  const handleVoiceEnd = () => {
    // Voice ended
  };

  const handleVoiceError = (error: string) => {
    setInputError(`Voice recognition error: ${error}`);
  };

  const updateItemQuantity = (itemId: string, newQuantity: number) => {
    if (!groceryList) return;
    
    const updatedItems = groceryList?.items?.map(item =>
      item.id === itemId
        ? { ...item, quantity: Math.max(0, newQuantity) }
        : item
    ).filter(item => item.quantity > 0);

    setGroceryList({
      ...groceryList,
      items: updatedItems,
      itemCount: updatedItems?.length || 0,
    });
  };

  const removeItem = (itemId: string) => {
    if (!groceryList) return;
    
    const updatedItems = groceryList?.items?.filter(item => item.id !== itemId);
    setGroceryList({
      ...groceryList,
      items: updatedItems,
      itemCount: updatedItems?.length || 0,
    });
  };

  const addSuggestedItem = (suggestion: SmartSuggestion) => {
    const newItem: GroceryItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      productId: suggestion.productId,
      name: suggestion.name,
      category: suggestion.category,
      quantity: 1,
      price: suggestion.price,
      originalPrice: suggestion.originalPrice,
      unit: 'each',
      imageUrl: suggestion.imageUrl,
      inStock: true,
    };

    const currentItems = groceryList?.items || [];
    const updatedItems = [...currentItems, newItem];
    
    setGroceryList({
      items: updatedItems,
      subtotal: updatedItems.reduce((sum: any, item: any) => sum + (item.price * item.quantity), 0),
      estimatedTax: 0,
      total: 0,
      savings: 0,
      itemCount: updatedItems?.length || 0,
      deliveryEligible: false,
      deliveryThreshold: 35,
    });
  };

  const groupItemsByCategory = (items: GroceryItem[]) => {
    return items.reduce((groups: any, item: any) => {
      const category = item.category || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
      return groups;
    }, {} as Record<string, GroceryItem[]>);
  };

  const categories = groceryList ? groupItemsByCategory(groceryList.items) : {};
  
  // Helper function to get price change animation classes
  const getPriceAnimationClasses = (productId: string) => {
    const indicator = getPriceChangeIndicator(productId);
    if (!indicator || !indicator.show) return '';
    
    const baseClasses = 'transition-all duration-500';
    
    switch (indicator.animation) {
      case 'flash':
        return `${baseClasses} animate-pulse bg-yellow-100`;
      case 'bounce':
        return `${baseClasses} animate-bounce text-green-600`;
      case 'pulse':
        return `${baseClasses} animate-pulse text-red-500`;
      default:
        return baseClasses;
    }
  };

  return (
    <div className="grocery-list-enhanced">
      {/* Connection Status Indicator */}
      <div className="connection-status-container mb-4">
        <ConnectionStatus
          isConnected={isConnected}
          connectionStatus={connectionStatus}
          showText={true}
          size="md"
          position="floating"
          className="connection-status"
        />
      </div>
      
      {/* Real-time Notifications */}
      <div className="notifications-container fixed top-20 right-4 z-50 space-y-2">
        {notifications?.map((notification: any) => (
          <div
            key={notification.id}
            className={`notification-toast p-3 bg-white border-l-4 rounded-lg shadow-lg transition-all duration-300 max-w-sm ${
              notification.type === 'price_drop' ? 'border-green-500 bg-green-50' :
              notification.type === 'deal_detected' ? 'border-blue-500 bg-blue-50' :
              'border-yellow-500 bg-yellow-50'
            } ${
              notification.show ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-800">
                {notification.message}
              </span>
              <button
                onClick={() => {
                  setNotifications(prev => 
                    prev?.map(n => n.id === notification.id ? { ...n, show: false } : n)
                  );
                }}
                className="ml-2 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {/* Sticky Running Totals Card */}
      <div className="running-totals-sticky">
        <div className="totals-card">
          <div className="totals-header">
            <h3>Running Total</h3>
            <div className="item-count">
              <Package size={16} />
              {groceryList?.itemCount || 0} items
            </div>
          </div>
          
          <div className="totals-breakdown">
            <div className="total-row">
              <span>Subtotal:</span>
              <span className={getPriceAnimationClasses('subtotal')}>
                ${totals?.subtotal.toFixed(2) || '0.00'}
              </span>
            </div>
            {(totals?.itemSavings > 0 || totalSavingsDetected > 0) && (
              <div className={`total-row savings ${savingsFlash ? 'animate-bounce text-green-600' : ''}`}>
                <span>Savings:</span>
                <span>-${((totals?.itemSavings || 0) + totalSavingsDetected).toFixed(2)}</span>
                {dealsActive > 0 && (
                  <span className="deals-badge ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                    {dealsActive} deals
                  </span>
                )}
              </div>
            )}
            <div className="total-row">
              <span>Tax:</span>
              <span>${totals?.tax.toFixed(2) || '0.00'}</span>
            </div>
            <div className="total-row">
              <span>Delivery:</span>
              <span>{totals?.deliveryFeeWaived ? 'FREE' : `$${totals?.deliveryFee.toFixed(2) || '4.95'}`}</span>
            </div>
            <div className="total-row total">
              <span>Total:</span>
              <span>${totals?.total.toFixed(2) || '0.00'}</span>
            </div>
          </div>

          {/* Free Delivery Progress */}
          {totals && !totals.freeDeliveryEligible && (
            <div className="delivery-progress">
              <div className="progress-header">
                <Truck size={16} />
                <span>Free Delivery Progress</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${Math.min((totals.subtotal / totals.freeDeliveryThreshold) * 100, 100)}%` }}
                />
              </div>
              <div className="progress-text">
                Add ${totals?.amountForFreeDelivery?.toFixed(2)} more for free delivery
              </div>
            </div>
          )}

          {totals?.freeDeliveryEligible && (
            <div className="delivery-eligible">
              <CheckCircle size={16} />
              <span>Free delivery eligible!</span>
            </div>
          )}
        </div>
      </div>

      {/* Natural Language Input */}
      <div className="natural-input-section">
        <NaturalLanguageInput
          value={naturalInput}
          onChange={setNaturalInput}
          onSubmit={handleInputSubmit}
          placeholder="Tell me what you need, like 'Add 2 gallons of milk and some bananas'"
          disabled={false}
          isProcessing={isProcessing}
          error={inputError}
          success={inputSuccess}
          recentCommands={recentCommands}
          showVoiceButton={true}
          showSuggestions={true}
          maxSuggestions={6}
          autoFocus={false}
          onVoiceStart={handleVoiceStart}
          onVoiceEnd={handleVoiceEnd}
          onVoiceError={handleVoiceError}
          onSuggestionSelected={(suggestion: any) => {
            // Auto-submit if it's a complete command
            if (suggestion.toLowerCase().includes('total') || 
                suggestion.toLowerCase().includes('clear')) {
              handleInputSubmit(suggestion);
            }
          }}
          quickActions={[
            { id: 'add-basic', label: 'Add items', template: 'Add ', icon: <Plus size={14} /> },
            { id: 'remove', label: 'Remove item', template: 'Remove ', icon: <Minus size={14} /> },
            { id: 'change-qty', label: 'Change quantity', template: 'Change quantity of ', icon: <Package size={14} /> },
            { id: 'whats-total', label: 'What\'s my total?', template: 'What\'s my total?', icon: <DollarSign size={14} /> },
            { id: 'find-deals', label: 'Find deals', template: 'Find deals on ', icon: <TrendingUp size={14} /> },
            { id: 'clear-list', label: 'Clear list', template: 'Clear my list', icon: <Trash2 size={14} /> },
          ]}
        />
      </div>

      {/* Command History Panel */}
      {commandHistory?.length || 0 > 0 && (
        <div className="command-history-section">
          <CommandHistory
            commands={commandHistory}
            maxCommands={20}
            showResults={true}
            showTimestamps={true}
            showCategories={true}
            groupByDate={true}
            onReplay={handleCommandReplay}
            onEdit={handleCommandEdit}
            onDelete={handleCommandDelete}
            onClear={handleClearHistory}
            isCollapsed={!showCommandHistory}
            onToggleCollapsed={() => setShowCommandHistory(!showCommandHistory)}
          />
        </div>
      )}

      {/* Smart Grocery List */}
      <div className="grocery-list-section">
        <div className="list-header">
          <h2>Your Grocery List</h2>
          <div className="list-actions">
            <button className="action-button secondary">
              <Save size={16} />
              Save List
            </button>
            <button className="action-button secondary">
              <Share2 size={16} />
              Share
            </button>
          </div>
        </div>

        {!groceryList || groceryList?.items?.length === 0 ? (
          <div className="empty-list">
            <div className="empty-icon">
              <ShoppingCart size={64} />
            </div>
            <h3>Your grocery list is empty</h3>
            <p>Start by adding items using natural language above, or browse our smart suggestions below</p>
          </div>
        ) : (
          <div className="list-content">
            {Object.entries(categories).map(([category, items]) => (
              <div key={category} className="category-section">
                <div className="category-header">
                  <h3>{category}</h3>
                  <span className="item-count">{items?.length || 0} items</span>
                </div>
                
                <div className="category-items">
                  {items?.map((item: any) => (
                    <div key={item.id} className="list-item">
                      <div className="item-image">
                        <img src={item.imageUrl} alt={item.name} />
                        {item.originalPrice && item.originalPrice > item.price && (
                          <div className="savings-badge">
                            Save ${(item.originalPrice - item.price).toFixed(2)}
                          </div>
                        )}
                      </div>
                      
                      <div className="item-details">
                        <h4>{item.name}</h4>
                        <p className="item-meta">{item.category} • {item.unit}</p>
                        <div className="item-pricing">
                          <span className={`current-price ${getPriceAnimationClasses(item.productId)}`}>
                            ${item?.price?.toFixed(2)}
                          </span>
                          {item.originalPrice && (
                            <span className="original-price">${item?.originalPrice?.toFixed(2)}</span>
                          )}
                          {/* Price change indicator */}
                          {(() => {
                            const priceUpdate = priceUpdates.get(item.productId);
                            const indicator = getPriceChangeIndicator(item.productId);
                            
                            if (indicator && indicator.show && priceUpdate) {
                              return (
                                <div className={`price-change-indicator ${
                                  priceUpdate.isIncrease ? 'text-red-500' : 'text-green-600'
                                } text-xs font-medium ml-2`}>
                                  {priceUpdate.isIncrease ? '↑' : '↓'}
                                  {Math.abs(priceUpdate.percentageChange).toFixed(1)}%
                                  {priceUpdate.savings && priceUpdate.savings > 0 && (
                                    <span className="savings-amount ml-1">
                                      Save ${priceUpdate?.savings?.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        {item.notes && (
                          <p className="item-notes">{item.notes}</p>
                        )}
                      </div>
                      
                      <div className="quantity-controls">
                        <button
                          onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                          className="quantity-btn"
                          disabled={item.quantity <= 1}
                        >
                          <Minus size={16} />
                        </button>
                        <span className="quantity-display">{item.quantity}</span>
                        <button
                          onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                          className="quantity-btn"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      
                      <div className={`item-total ${getPriceAnimationClasses(item.productId)}`}>
                        ${(item.price * item.quantity).toFixed(2)}
                      </div>
                      
                      <button
                        onClick={() => removeItem(item.id)}
                        className="remove-button"
                        title="Remove item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Smart Suggestions Panel */}
      <div className="suggestions-section">
        <div className="suggestions-header">
          <h2>Smart Suggestions</h2>
          <div className="suggestions-meta">
            <Zap size={16} />
            <span>Personalized for you</span>
          </div>
        </div>
        
        <div className="suggestions-grid">
          {suggestions?.map((suggestion: any) => (
            <div key={suggestion.id} className="suggestion-card">
              <div className="suggestion-image">
                <img src={suggestion.imageUrl} alt={suggestion.name} />
                {suggestion.originalPrice && suggestion.originalPrice > suggestion.price && (
                  <div className="deal-badge">
                    <Gift size={14} />
                    Deal
                  </div>
                )}
              </div>
              
              <div className="suggestion-content">
                <h4>{suggestion.name}</h4>
                <p className="suggestion-category">{suggestion.category}</p>
                
                <div className="suggestion-pricing">
                  <span className="price">${suggestion?.price?.toFixed(2)}</span>
                  {suggestion.originalPrice && (
                    <span className="original-price">${suggestion?.originalPrice?.toFixed(2)}</span>
                  )}
                </div>
                
                <div className="suggestion-reason">
                  <AlertCircle size={14} />
                  <span>{suggestion.reason}</span>
                </div>
                
                <div className="suggestion-meta">
                  <div className="confidence-bar">
                    <div 
                      className="confidence-fill"
                      style={{ width: `${suggestion.confidence * 100}%` }}
                    />
                  </div>
                  <span className="confidence-text">
                    {Math.round(suggestion.confidence * 100)}% match
                  </span>
                </div>
                
                <button
                  onClick={() => addSuggestedItem(suggestion)}
                  className="add-suggestion-btn"
                >
                  <Plus size={16} />
                  Add to List
                </button>
              </div>
            </div>
          ))}
        </div>
        
        {suggestions?.length || 0 === 0 && !getSmartRecommendationsQuery.isLoading && (
          <div className="no-suggestions">
            <Target size={48} />
            <h3>Building your preferences...</h3>
            <p>Add some items to your list to get personalized suggestions</p>
          </div>
        )}
        
        {getSmartRecommendationsQuery.isLoading && (
          <div className="suggestions-loading">
            <div className="loading-grid">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="suggestion-skeleton">
                  <div className="skeleton-image"></div>
                  <div className="skeleton-content">
                    <div className="skeleton-line"></div>
                    <div className="skeleton-line short"></div>
                    <div className="skeleton-line"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};