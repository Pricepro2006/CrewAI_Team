import React, { useState } from 'react';
import { Search, ShoppingCart, Package, DollarSign, Clock, TrendingUp, AlertCircle, CheckCircle, List, PieChart, BarChart3, History } from 'lucide-react';
import { api } from '../../../lib/trpc.js';
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

type TabType = 'shopping' | 'grocery-list' | 'budget-tracker' | 'price-history';

export const WalmartGroceryAgent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('shopping');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [priceAlerts, setPriceAlerts] = useState<Map<string, number>>(new Map());

  // Use tRPC mutation for searching products
  const searchProductsMutation = api.walmartGrocery.searchProducts.useMutation({
    onError: (error) => {
      console.error('Search failed:', error);
      // You might want to show a toast notification here
    }
  });

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
      .reduce((total, item) => total + (item.savings || 0), 0);
  };

  const calculateTotalPrice = () => {
    if (!searchResults) return 0;
    return searchResults.items
      .filter(item => selectedItems.has(item.id))
      .reduce((total, item) => total + item.price, 0);
  };

  const tabs = [
    { id: 'shopping' as TabType, label: 'Shopping', icon: ShoppingCart },
    { id: 'grocery-list' as TabType, label: 'Grocery List', icon: List },
    { id: 'budget-tracker' as TabType, label: 'Budget Tracker', icon: PieChart },
    { id: 'price-history' as TabType, label: 'Price History', icon: BarChart3 },
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
              <span className="stat-value">2,847</span>
              <span className="stat-label">Products Tracked</span>
            </div>
          </div>
          <div className="stat-card">
            <TrendingUp className="stat-icon" />
            <div className="stat-content">
              <span className="stat-value">$142.50</span>
              <span className="stat-label">Saved This Month</span>
            </div>
          </div>
          <div className="stat-card">
            <AlertCircle className="stat-icon" />
            <div className="stat-content">
              <span className="stat-value">12</span>
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

          <div className="results-grid">
            {searchResults.items.map((item) => (
              <div 
                key={item.id} 
                className={`grocery-item ${selectedItems.has(item.id) ? 'selected' : ''} ${!item.inStock ? 'out-of-stock' : ''}`}
              >
                <div className="item-image">
                  <img src={item.imageUrl} alt={item.name} />
                  {item.savings && (
                    <div className="savings-badge">
                      Save ${item.savings.toFixed(2)}
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
                    <span className="current-price">${item.price.toFixed(2)}</span>
                    {item.originalPrice && (
                      <span className="original-price">${item.originalPrice.toFixed(2)}</span>
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

        {activeTab === 'grocery-list' && (
          <div className="grocery-list-section">
            <h2 className="section-title">My Grocery List</h2>
            
            <div className="list-stats">
              <div className="stat-card">
                <div className="stat-icon">
                  <List />
                </div>
                <div className="stat-content">
                  <p className="stat-value">{selectedItems.size}</p>
                  <p className="stat-label">Items</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">
                  <DollarSign />
                </div>
                <div className="stat-content">
                  <p className="stat-value">${calculateTotalPrice().toFixed(2)}</p>
                  <p className="stat-label">Total Cost</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">
                  <TrendingUp />
                </div>
                <div className="stat-content">
                  <p className="stat-value">${calculateTotalSavings().toFixed(2)}</p>
                  <p className="stat-label">Total Savings</p>
                </div>
              </div>
            </div>

            {selectedItems.size === 0 ? (
              <div className="empty-list">
                <div className="empty-icon">
                  <ShoppingCart size={48} />
                </div>
                <h3>Your grocery list is empty</h3>
                <p>Start shopping to add items to your list</p>
                <button className="btn-primary" onClick={() => setActiveTab('shopping')}>
                  Start Shopping
                </button>
              </div>
            ) : (
              <div className="list-management">
                <div className="list-controls">
                  <button className="btn-primary">
                    <CheckCircle size={16} />
                    Mark All Purchased
                  </button>
                  <button className="btn-secondary">
                    <Package size={16} />
                    Export List
                  </button>
                  <button className="btn-secondary">
                    <AlertCircle size={16} />
                    Clear List
                  </button>
                </div>
                
                <div className="list-items">
                  {searchResults?.items
                    .filter(item => selectedItems.has(item.id))
                    .map((item) => (
                      <div key={item.id} className="list-item">
                        <div className="item-info">
                          <img src={item.imageUrl} alt={item.name} className="item-thumbnail" />
                          <div className="item-details">
                            <h4>{item.name}</h4>
                            <p>{item.category} • {item.unit}</p>
                          </div>
                        </div>
                        
                        <div className="item-price">${item.price.toFixed(2)}</div>
                        
                        <div className="item-controls">
                          <button className="quantity-btn">-</button>
                          <span className="quantity">1</span>
                          <button className="quantity-btn">+</button>
                          <button 
                            className="remove-btn"
                            onClick={() => toggleItemSelection(item.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'budget-tracker' && (
          <div className="budget-section">
            <h2 className="section-title">Budget Tracker</h2>
            
            <div className="budget-overview">
              <div className="budget-card primary">
                <h3>Monthly Budget</h3>
                <div className="budget-amount">$400.00</div>
                <div className="budget-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{width: '65%'}}></div>
                  </div>
                  <span>$260.00 spent • $140.00 remaining</span>
                </div>
              </div>
            </div>

            <div className="budget-categories">
              <div className="category-card">
                <div className="category-header">
                  <h4>Produce</h4>
                  <span className="category-amount">$85.50</span>
                </div>
                <div className="category-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{width: '75%'}}></div>
                  </div>
                  <span>75% of $114 budget</span>
                </div>
              </div>

              <div className="category-card">
                <div className="category-header">
                  <h4>Dairy & Eggs</h4>
                  <span className="category-amount">$42.30</span>
                </div>
                <div className="category-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{width: '60%'}}></div>
                  </div>
                  <span>60% of $70 budget</span>
                </div>
              </div>

              <div className="category-card">
                <div className="category-header">
                  <h4>Meat & Seafood</h4>
                  <span className="category-amount">$132.20</span>
                </div>
                <div className="category-progress">
                  <div className="progress-bar warning">
                    <div className="progress-fill" style={{width: '95%'}}></div>
                  </div>
                  <span>95% of $140 budget • Near limit!</span>
                </div>
              </div>
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
                <div className="trend-item">
                  <div className="trend-info">
                    <img src="/api/placeholder/60/60" alt="Organic Bananas" className="trend-thumbnail" />
                    <div>
                      <h4>Organic Bananas</h4>
                      <p>Produce • Per lb</p>
                    </div>
                  </div>
                  <div className="trend-data">
                    <div className="price-change positive">
                      <span className="current-price">$0.59</span>
                      <span className="change">↓ $0.20</span>
                    </div>
                    <div className="trend-indicator">
                      <div className="mini-chart positive">
                        <div className="chart-bar" style={{height: '60%'}}></div>
                        <div className="chart-bar" style={{height: '45%'}}></div>
                        <div className="chart-bar" style={{height: '30%'}}></div>
                        <div className="chart-bar" style={{height: '25%'}}></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="trend-item">
                  <div className="trend-info">
                    <img src="/api/placeholder/60/60" alt="Chicken Breast" className="trend-thumbnail" />
                    <div>
                      <h4>Chicken Breast</h4>
                      <p>Meat & Seafood • Per lb</p>
                    </div>
                  </div>
                  <div className="trend-data">
                    <div className="price-change negative">
                      <span className="current-price">$2.98</span>
                      <span className="change">↑ $0.50</span>
                    </div>
                    <div className="trend-indicator">
                      <div className="mini-chart negative">
                        <div className="chart-bar" style={{height: '25%'}}></div>
                        <div className="chart-bar" style={{height: '40%'}}></div>
                        <div className="chart-bar" style={{height: '55%'}}></div>
                        <div className="chart-bar" style={{height: '70%'}}></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="trend-item">
                  <div className="trend-info">
                    <img src="/api/placeholder/60/60" alt="Whole Milk" className="trend-thumbnail" />
                    <div>
                      <h4>Whole Milk</h4>
                      <p>Dairy • Per gallon</p>
                    </div>
                  </div>
                  <div className="trend-data">
                    <div className="price-change neutral">
                      <span className="current-price">$3.49</span>
                      <span className="change">→ $0.00</span>
                    </div>
                    <div className="trend-indicator">
                      <div className="mini-chart neutral">
                        <div className="chart-bar" style={{height: '45%'}}></div>
                        <div className="chart-bar" style={{height: '50%'}}></div>
                        <div className="chart-bar" style={{height: '48%'}}></div>
                        <div className="chart-bar" style={{height: '47%'}}></div>
                      </div>
                    </div>
                  </div>
                </div>
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
      </div>
    </div>
  );
};