import React, { useState } from 'react';
import { Search, ShoppingCart, Package, DollarSign, Clock, TrendingUp, AlertCircle, CheckCircle, List, PieChart, BarChart3, History, Zap } from 'lucide-react';
import { trpc } from '../../../utils/trpc';
import type { AppRouter } from '../../../api/trpc/router';
import WalmartLivePricing from './WalmartLivePricing';
import { GroceryListEnhanced } from './GroceryListEnhanced';
import { GroceryBudgetSplitView } from './GroceryBudgetSplitView';
import './WalmartGroceryAgent.css';

interface GroceryItem {
  id: string;
  name: string;
  price: number;
  inStock: boolean;
  imageUrl: string;
  category: string;
  unit: string;
  originalPrice?: number;
  savings?: number;
}

interface SearchResult {
  query: string;
  totalResults: number;
  items: GroceryItem[];
  timestamp: Date;
}

interface PriceHistory {
  date: string;
  price: number;
}

type TabType = 'shopping' | 'grocery-planning' | 'price-history' | 'live-pricing';

export const WalmartGroceryAgent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('shopping');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [priceAlerts, setPriceAlerts] = useState<Map<string, number>>(new Map());

  // Fetch real dashboard stats instead of hardcoded values
  // Type assertion needed due to complex tRPC type inference
  const { data: statsData } = (trpc as any).walmartGrocery?.getStats?.useQuery?.(undefined, {
    refetchInterval: 60000, // Refresh every minute
  }) || { data: null };

  // Fetch trending products for price history
  // Type assertion needed due to complex tRPC type inference
  const { data: trendingData } = (trpc as any).walmartGrocery?.getTrending?.useQuery?.(
    { limit: 6, days: 30 },
    { enabled: activeTab === 'price-history' }
  ) || { data: null };

  // Fetch budget data - not needed anymore as it's handled in the split view component
  // const { data: budgetData } = api?.walmartGrocery?.getBudget.useQuery(
  //   { userId: 'default_user' },
  //   { enabled: activeTab === 'grocery-planning' }
  // );

  // Use tRPC mutation for searching products
  // Type assertion needed due to complex tRPC type inference
  const searchProductsMutation = (trpc as any).walmartGrocery?.searchProducts?.useMutation?.({
    onError: (error: unknown) => {
      console.error('Search failed:', error);
      // You might want to show a toast notification here
    }
  }) || { mutateAsync: async () => ({ products: [], metadata: {} }), isPending: false, isLoading: false };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      const results = await searchProductsMutation.mutateAsync({
        query: searchQuery.trim(),
        limit: 20
      });
      
      // Transform the results to match our SearchResult interface
      setSearchResults({
        query: searchQuery.trim(),
        totalResults: results.metadata?.totalResults || results.products?.length || 0,
        items: results.products?.map((product: Record<string, unknown>) => ({
          id: String(product.id || product.productId || `item-${Date.now()}-${Math.random()}`),
          name: String(product.name || product.title || 'Unknown Product'),
          price: Number(product.price || 0),
          originalPrice: product.originalPrice ? Number(product.originalPrice) : undefined,
          savings: (product.originalPrice && product.price) ? Number(product.originalPrice) - Number(product.price) : undefined,
          inStock: product.inStock !== false,
          imageUrl: String(product.imageUrl || product.image || '/api/placeholder/100/100'),
          category: String(product.category || 'General'),
          unit: String(product.unit || product.size || 'each')
        })) || [],
        timestamp: new Date()
      });
    } catch (error) {
      // Error is already logged in the mutation's onError
      // Keep the search results empty on error
      setSearchResults(null);
    }
  };
  
  // Use the mutation's isPending state for compatibility with newer React Query versions
  const isSearching = searchProductsMutation.isPending || searchProductsMutation.isLoading;

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const setPriceAlert = (itemId: string, targetPrice: number) => {
    const newAlerts = new Map(priceAlerts);
    newAlerts.set(itemId, targetPrice);
    setPriceAlerts(newAlerts);
  };

  const calculateTotalSavings = () => {
    if (!searchResults) return 0;
    return searchResults.items
      .filter(item => selectedItems.has(item.id))
      .reduce((total: number, item: GroceryItem) => total + (item.savings || 0), 0);
  };

  const calculateTotalPrice = () => {
    if (!searchResults) return 0;
    return searchResults.items
      .filter(item => selectedItems.has(item.id))
      .reduce((total: number, item: GroceryItem) => total + item.price, 0);
  };

  const tabs = [
    { id: 'shopping' as TabType, label: 'Shopping', icon: ShoppingCart },
    { id: 'grocery-planning' as TabType, label: 'Grocery Planning', icon: List },
    { id: 'price-history' as TabType, label: 'Price History', icon: BarChart3 },
    { id: 'live-pricing' as TabType, label: 'Live Pricing', icon: Zap },
  ];

  return (
    <div className="walmart-agent">
      {/* Header */}
      <div className="agent-header">
        <div className="header-content">
          <h1 className="agent-title">
            <ShoppingCart className="title-icon" />
            Walmart Grocery Intelligence Agent
          </h1>
          <p className="agent-subtitle">
            AI-powered grocery shopping assistant with real-time price tracking and inventory monitoring
          </p>
        </div>
        
        <div className="header-stats">
          <div className="stat-card">
            <Package className="stat-icon" />
            <div className="stat-content">
              <span className="stat-value">
                {(statsData?.stats?.productsTracked || 0).toLocaleString()}
              </span>
              <span className="stat-label">Products Tracked</span>
            </div>
          </div>
          <div className="stat-card">
            <TrendingUp className="stat-icon" />
            <div className="stat-content">
              <span className="stat-value">
                ${(statsData?.stats?.savedThisMonth || 0).toFixed(2)}
              </span>
              <span className="stat-label">Saved This Month</span>
            </div>
          </div>
          <div className="stat-card">
            <AlertCircle className="stat-icon" />
            <div className="stat-content">
              <span className="stat-value">
                {statsData?.stats?.activeAlerts || 0}
              </span>
              <span className="stat-label">Active Price Alerts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="agent-nav">
        {tabs?.map((tab) => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <IconComponent size={20} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="agent-content">
        {activeTab === 'shopping' && (
          <>
            {/* Search Section */}
      <div className="search-section">
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search for groceries (e.g., 'organic milk', 'fresh produce', 'snacks')"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSearch()}
          />
          <button 
            className="search-button"
            onClick={handleSearch}
            disabled={isSearching}
          >
            {isSearching ? (
              <div className="spinner" />
            ) : (
              <Search size={20} />
            )}
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
        
        <div className="search-filters">
          <button className="filter-chip active">All Categories</button>
          <button className="filter-chip">Produce</button>
          <button className="filter-chip">Dairy</button>
          <button className="filter-chip">Meat & Seafood</button>
          <button className="filter-chip">Bakery</button>
          <button className="filter-chip">On Sale</button>
        </div>
      </div>

      {/* Results Section */}
      {searchResults && (
        <div className="results-section">
          <div className="results-header">
            <h2 className="results-title">
              Found {searchResults.totalResults} items for "{searchResults.query}"
            </h2>
            <div className="results-actions">
              <span className="selection-count">
                {selectedItems.size} items selected
              </span>
              {selectedItems.size > 0 && (
                <div className="selection-totals">
                  <span className="total-price">
                    Total: ${calculateTotalPrice().toFixed(2)}
                  </span>
                  {calculateTotalSavings() > 0 && (
                    <span className="total-savings">
                      Savings: ${calculateTotalSavings().toFixed(2)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="results-grid">
            {searchResults?.items?.map((item: GroceryItem) => (
              <div 
                key={item.id} 
                className={`grocery-item ${selectedItems.has(item.id) ? 'selected' : ''} ${!item.inStock ? 'out-of-stock' : ''}`}
              >
                <div className="item-image">
                  <img src={item.imageUrl} alt={item.name} />
                  {item.savings && (
                    <div className="savings-badge">
                      Save ${item?.savings?.toFixed(2)}
                    </div>
                  )}
                  {!item.inStock && (
                    <div className="stock-overlay">Out of Stock</div>
                  )}
                </div>
                
                <div className="item-details">
                  <h3 className="item-name">{item.name}</h3>
                  <p className="item-category">{item.category} • {item.unit}</p>
                  
                  <div className="item-pricing">
                    <span className="current-price">${item?.price?.toFixed(2)}</span>
                    {item.originalPrice && (
                      <span className="original-price">${item?.originalPrice?.toFixed(2)}</span>
                    )}
                  </div>
                  
                  <div className="item-actions">
                    <button
                      className={`select-button ${selectedItems.has(item.id) ? 'selected' : ''}`}
                      onClick={() => toggleItemSelection(item.id)}
                      disabled={!item.inStock}
                    >
                      {selectedItems.has(item.id) ? (
                        <>
                          <CheckCircle size={16} />
                          Selected
                        </>
                      ) : (
                        <>
                          <ShoppingCart size={16} />
                          Add to List
                        </>
                      )}
                    </button>
                    
                    <button 
                      className="alert-button"
                      onClick={() => setPriceAlert(item.id, item.price * 0.9)}
                    >
                      <AlertCircle size={16} />
                      Set Alert
                    </button>
                  </div>
                  
                  {priceAlerts.has(item.id) && (
                    <div className="price-alert-info">
                      Alert when price drops to ${priceAlerts.get(item.id)!.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Smart Shopping Assistant */}
      <div className="assistant-section">
        <h2 className="section-title">AI Shopping Assistant</h2>
        <div className="assistant-cards">
          <div className="assistant-card">
            <div className="card-icon">
              <Clock />
            </div>
            <h3 className="card-title">Best Time to Shop</h3>
            <p className="card-description">
              Prices typically drop on Wednesdays. Stock is freshest early mornings.
            </p>
          </div>
          
          <div className="assistant-card">
            <div className="card-icon">
              <TrendingUp />
            </div>
            <h3 className="card-title">Price Predictions</h3>
            <p className="card-description">
              Based on historical data, produce prices expected to decrease next week.
            </p>
          </div>
          
          <div className="assistant-card">
            <div className="card-icon">
              <DollarSign />
            </div>
            <h3 className="card-title">Smart Substitutions</h3>
            <p className="card-description">
              AI suggests alternatives that save money while maintaining quality.
            </p>
          </div>
        </div>
      </div>
          </>
        )}

        {activeTab === 'grocery-planning' && (
          <GroceryBudgetSplitView />
        )}

        {activeTab === 'price-history' && (
          <div className="price-history-section">
            <h2 className="section-title">Price History & Trends</h2>
            
            <div className="history-controls">
              <select className="time-filter">
                <option>Last 30 days</option>
                <option>Last 3 months</option>
                <option>Last 6 months</option>
                <option>Last year</option>
              </select>
              
              <select className="category-filter">
                <option>All Categories</option>
                <option>Produce</option>
                <option>Dairy</option>
                <option>Meat & Seafood</option>
                <option>Bakery</option>
              </select>
            </div>

            <div className="trending-items">
              <h3>Trending Price Changes</h3>
              <div className="trend-list">
                {trendingData?.trending && trendingData?.trending?.length > 0 ? (
                  trendingData?.trending?.map((product: Record<string, unknown> & { id: string; name: string; category: string }) => (
                    <div key={product.id} className="trend-item">
                      <div className="trend-info">
                        <img 
                          src={String(product.imageUrl || "/api/placeholder/60/60")} 
                          alt={product.name} 
                          className="trend-thumbnail" 
                        />
                        <div>
                          <h4>{product.name}</h4>
                          <p>{product.category} • {product.inStock ? 'In Stock' : 'Out of Stock'}</p>
                        </div>
                      </div>
                      <div className="trend-data">
                        <div className={`price-change ${product.trend === 'down' ? 'positive' : product.trend === 'up' ? 'negative' : 'neutral'}`}>
                          <span className="current-price">${(Number(product?.currentPrice) || 0).toFixed(2)}</span>
                          <span className="change">
                            {product.trend === 'down' ? '↓' : product.trend === 'up' ? '↑' : '→'} 
                            {' '}
                            {Math.abs(Number(product.priceChange) || 0).toFixed(1)}%
                          </span>
                        </div>
                        <div className="trend-indicator">
                          <div className={`mini-chart ${product.trend === 'down' ? 'positive' : product.trend === 'up' ? 'negative' : 'neutral'}`}>
                            <div className="chart-bar" style={{height: '60%'}}></div>
                            <div className="chart-bar" style={{height: '45%'}}></div>
                            <div className="chart-bar" style={{height: '30%'}}></div>
                            <div className="chart-bar" style={{height: '25%'}}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-data-message">
                    <p>Loading trending products...</p>
                  </div>
                )}
              </div>
            </div>

            <div className="price-alerts">
              <h3>Active Price Alerts</h3>
              {priceAlerts.size === 0 ? (
                <div className="empty-alerts">
                  <div className="empty-icon">
                    <AlertCircle size={48} />
                  </div>
                  <h4>No active price alerts</h4>
                  <p>Set price alerts while shopping to track your favorite items</p>
                </div>
              ) : (
                <div className="alert-list">
                  {Array.from(priceAlerts.entries()).map(([itemId, targetPrice]) => {
                    const item = searchResults?.items.find(i => i.id === itemId);
                    if (!item) return null;
                    
                    return (
                      <div key={itemId} className="alert-item">
                        <div className="alert-info">
                          <img src={item.imageUrl} alt={item.name} className="alert-thumbnail" />
                          <div>
                            <h4>{item.name}</h4>
                            <p>Current: ${item?.price?.toFixed(2)} • Target: ${targetPrice.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="alert-status">
                          {item.price <= targetPrice ? (
                            <span className="status-badge success">Target Reached!</span>
                          ) : (
                            <span className="status-badge pending">Monitoring</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'live-pricing' && (
          <WalmartLivePricing />
        )}
      </div>
    </div>
  );
};