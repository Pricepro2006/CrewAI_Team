import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Package, DollarSign, Clock, TrendingUp, AlertCircle, CheckCircle, List, PieChart, BarChart3, History, Zap, Sparkles } from 'lucide-react';
import { api } from '../../../lib/trpc.js';
import { 
  LazyWalmartLivePricing, 
  LazyGroceryListAndTracker, 
  LazyWalmartHybridSearch 
} from './LazyComponentLoader.js';
import { VirtualizedProductList } from '../VirtualizedList/VirtualizedProductList.js';
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

type TabType = 'shopping' | 'hybrid-search' | 'list-tracker' | 'price-history' | 'live-pricing';

export const WalmartGroceryAgent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('shopping');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [priceAlerts, setPriceAlerts] = useState<Map<string, number>>(new Map());

  // Sync activeTab with URL
  useEffect(() => {
    const pathSegments = location.pathname.split('/');
    const lastSegment = pathSegments[pathSegments.length - 1];
    
    // Map URL segments to tab IDs
    const urlToTab: Record<string, TabType> = {
      'walmart': 'shopping',
      'shopping': 'shopping',
      'smart-search': 'hybrid-search',
      'list-tracker': 'list-tracker',
      'price-history': 'price-history',
      'live-pricing': 'live-pricing'
    };
    
    const mappedTab = urlToTab[lastSegment];
    if (mappedTab && mappedTab !== activeTab) {
      setActiveTab(mappedTab);
    }
  }, [location.pathname]);

  // Update URL when tab changes
  const handleTabChange = (newTab: TabType) => {
    setActiveTab(newTab);
    
    // Map tab IDs to URL segments
    const tabToUrl: Record<TabType, string> = {
      'shopping': '/walmart',
      'hybrid-search': '/walmart/smart-search',
      'list-tracker': '/walmart/list-tracker',
      'price-history': '/walmart/price-history',
      'live-pricing': '/walmart/live-pricing'
    };
    
    navigate(tabToUrl[newTab]);
  };

  // Fetch real dashboard stats instead of hardcoded values
  const { data: statsData } = api.walmartGrocery.getStats.useQuery(undefined, {
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch trending products for price history
  const { data: trendingData } = api.walmartGrocery.getTrending.useQuery(
    { limit: 6, days: 30 },
    { enabled: activeTab === 'price-history' }
  );

  // Budget data no longer needed here - moved to GroceryListAndTracker component

  // Use tRPC mutation for searching products
  const searchProductsMutation = api.walmartGrocery.searchProducts.useMutation({
    onError: (error) => {
      // Error handling handled by component state and user feedback
      // You might want to show a toast notification here
    }
  });

  const handleSearch = useCallback(async () => {
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
        items: results.products?.map((product: any) => ({
          id: product.id || product.productId || `item-${Date.now()}-${Math.random()}`,
          name: product.name || product.title,
          price: product.price || 0,
          originalPrice: product.originalPrice,
          savings: product.originalPrice ? product.originalPrice - product.price : undefined,
          inStock: product.inStock !== false,
          imageUrl: product.imageUrl || product.image || '/api/placeholder/100/100',
          category: product.category || 'General',
          unit: product.unit || product.size || 'each'
        })) || [],
        timestamp: new Date()
      });
    } catch (error) {
      // Error is already logged in the mutation's onError
      // Keep the search results empty on error
      setSearchResults(null);
    }
  }, [searchQuery, searchProductsMutation]);
  
  // Use the mutation's isPending state for compatibility with newer React Query versions
  const isSearching = searchProductsMutation.isPending || searchProductsMutation.isLoading;

  const toggleItemSelection = useCallback((itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  }, [selectedItems]);

  const setPriceAlert = useCallback((itemId: string, targetPrice: number) => {
    const newAlerts = new Map(priceAlerts);
    newAlerts.set(itemId, targetPrice);
    setPriceAlerts(newAlerts);
  }, [priceAlerts]);

  const calculateTotalSavings = useMemo(() => {
    if (!searchResults) return 0;
    return searchResults.items
      .filter(item => selectedItems.has(item.id))
      .reduce((total, item) => total + (item.savings || 0), 0);
  }, [searchResults, selectedItems]);

  const calculateTotalPrice = useMemo(() => {
    if (!searchResults) return 0;
    return searchResults.items
      .filter(item => selectedItems.has(item.id))
      .reduce((total, item) => total + item.price, 0);
  }, [searchResults, selectedItems]);

  const tabs = [
    { id: 'shopping' as TabType, label: 'Shopping', icon: ShoppingCart },
    { id: 'hybrid-search' as TabType, label: 'Smart Search', icon: Sparkles },
    { id: 'list-tracker' as TabType, label: 'List & Tracker', icon: List },
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
                {statsData?.stats?.productsTracked?.toLocaleString() || '0'}
              </span>
              <span className="stat-label">Products Tracked</span>
            </div>
          </div>
          <div className="stat-card">
            <TrendingUp className="stat-icon" />
            <div className="stat-content">
              <span className="stat-value">
                ${statsData?.stats?.savedThisMonth?.toFixed(2) || '0.00'}
              </span>
              <span className="stat-label">Saved This Month</span>
            </div>
          </div>
          <div className="stat-card">
            <AlertCircle className="stat-icon" />
            <div className="stat-content">
              <span className="stat-value">
                {statsData?.stats?.activeAlerts || '0'}
              </span>
              <span className="stat-label">Active Price Alerts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="agent-nav">
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
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
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
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

          {/* Use virtualized list for better performance with large result sets */}
          <VirtualizedProductList
            items={searchResults.items}
            selectedItems={selectedItems}
            priceAlerts={priceAlerts}
            onToggleSelection={toggleItemSelection}
            onSetPriceAlert={setPriceAlert}
            height={600}
            itemHeight={120}
          />
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

        {activeTab === 'hybrid-search' && (
          <LazyWalmartHybridSearch />
        )}

        {activeTab === 'list-tracker' && (
          <LazyGroceryListAndTracker />
        )}

        {activeTab === 'budget-tracker-old' && (
          <div className="budget-section">
            <h2 className="section-title">Budget Tracker</h2>
            
            <div className="budget-overview">
              <div className="budget-card primary">
                <h3>Monthly Budget</h3>
                <div className="budget-amount">
                  ${budgetData?.budget?.monthlyBudget?.toFixed(2) || '400.00'}
                </div>
                <div className="budget-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{
                      width: `${budgetData?.budget?.percentUsed || 0}%`
                    }}></div>
                  </div>
                  <span>
                    ${budgetData?.budget?.totalSpent?.toFixed(2) || '0.00'} spent • 
                    ${budgetData?.budget?.remaining?.toFixed(2) || '400.00'} remaining
                  </span>
                </div>
              </div>
            </div>

            <div className="budget-categories">
              {budgetData?.budget?.categories && Object.entries(budgetData.budget.categories).map(([category, data]: [string, any]) => {
                const percentUsed = data.budget > 0 ? (data.spent / data.budget * 100) : 0;
                const isWarning = percentUsed >= 90;
                
                return (
                  <div key={category} className="category-card">
                    <div className="category-header">
                      <h4>{category}</h4>
                      <span className="category-amount">${data.spent.toFixed(2)}</span>
                    </div>
                    <div className="category-progress">
                      <div className={`progress-bar ${isWarning ? 'warning' : ''}`}>
                        <div className="progress-fill" style={{width: `${percentUsed}%`}}></div>
                      </div>
                      <span>
                        {percentUsed.toFixed(0)}% of ${data.budget} budget
                        {isWarning && ' • Near limit!'}
                      </span>
                    </div>
                  </div>
                );
              })}
              
              {(!budgetData?.budget?.categories || Object.keys(budgetData.budget.categories).length === 0) && (
                <div className="no-data-message">
                  <p>No spending data available yet. Start shopping to track your budget!</p>
                </div>
              )}
            </div>

            <div className="budget-insights">
              <h3>Budget Insights</h3>
              <div className="insight-cards">
                <div className="insight-card">
                  <div className="insight-icon success">
                    <TrendingUp />
                  </div>
                  <div className="insight-content">
                    <h4>Great Progress!</h4>
                    <p>You're saving 12% compared to last month through smart shopping choices.</p>
                  </div>
                </div>
                
                <div className="insight-card">
                  <div className="insight-icon warning">
                    <AlertCircle />
                  </div>
                  <div className="insight-content">
                    <h4>Budget Alert</h4>
                    <p>Meat & Seafood category is near its limit. Consider alternatives or wait for sales.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
                {trendingData?.trending && trendingData.trending.length > 0 ? (
                  trendingData.trending.map((product) => (
                    <div key={product.id} className="trend-item">
                      <div className="trend-info">
                        <img 
                          src={product.imageUrl || "/api/placeholder/60/60"} 
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
                          <span className="current-price">${product.currentPrice.toFixed(2)}</span>
                          <span className="change">
                            {product.trend === 'down' ? '↓' : product.trend === 'up' ? '↑' : '→'} 
                            {' '}
                            {Math.abs(product.priceChange).toFixed(1)}%
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
                            <p>Current: ${item.price.toFixed(2)} • Target: ${targetPrice.toFixed(2)}</p>
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
          <LazyWalmartLivePricing />
        )}
      </div>
    </div>
  );
};