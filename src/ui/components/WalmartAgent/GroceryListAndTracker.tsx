import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  AlertTriangle,
  Edit2,
  Save,
  X,
  TrendingUp,
  Package,
  DollarSign
} from 'lucide-react';
import { api } from '../../../lib/trpc.js';
import './GroceryListAndTracker.css';

interface GroceryItem {
  id: string;
  productId: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  subtotal: number;
  imageUrl?: string;
}

interface CategoryBudget {
  limit: number;
  spent: number;
  percentage: number;
  items: GroceryItem[];
}

interface BudgetData {
  monthlyLimit: number;
  spent: number;
  remaining: number;
  categories: Record<string, CategoryBudget>;
  warnings: string[];
  lastUpdated: Date;
}

// Default category budgets
const DEFAULT_CATEGORIES: Record<string, number> = {
  'Produce': 150,
  'Dairy & Eggs': 100,
  'Meat & Seafood': 150,
  'Bakery': 50,
  'Pantry': 75,
  'Frozen': 50,
  'Beverages': 50,
  'Snacks': 40,
  'Other': 35
};

const CATEGORY_ICONS: Record<string, string> = {
  'Produce': '🥬',
  'Dairy & Eggs': '🥛',
  'Meat & Seafood': '🥩',
  'Bakery': '🍞',
  'Pantry': '🥫',
  'Frozen': '🧊',
  'Beverages': '🥤',
  'Snacks': '🍿',
  'Other': '📦'
};

export const GroceryListAndTracker: React.FC = () => {
  // State management
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // Budget state
  const [monthlyBudget, setMonthlyBudget] = useState(500);
  const [categoryLimits, setCategoryLimits] = useState(DEFAULT_CATEGORIES);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingBudget, setEditingBudget] = useState(false);
  const [tempBudgetValue, setTempBudgetValue] = useState('');
  const [tempCategoryValue, setTempCategoryValue] = useState('');
  
  // Tax and totals
  const [taxRate] = useState(0.07); // 7% tax rate
  const [subtotal, setSubtotal] = useState(0);
  const [tax, setTax] = useState(0);
  const [total, setTotal] = useState(0);

  // Load saved preferences from localStorage
  useEffect(() => {
    const savedPreferences = localStorage.getItem('budgetPreferences');
    if (savedPreferences) {
      const prefs = JSON.parse(savedPreferences);
      setMonthlyBudget(prefs.monthlyBudget || 500);
      setCategoryLimits(prefs.categoryLimits || DEFAULT_CATEGORIES);
    }

    const savedList = localStorage.getItem('currentGroceryList');
    if (savedList) {
      setGroceryItems(JSON.parse(savedList));
    }
  }, []);

  // Save preferences when they change
  useEffect(() => {
    localStorage.setItem('budgetPreferences', JSON.stringify({
      monthlyBudget,
      categoryLimits,
      taxRate
    }));
  }, [monthlyBudget, categoryLimits, taxRate]);

  // Save grocery list when it changes
  useEffect(() => {
    localStorage.setItem('currentGroceryList', JSON.stringify(groceryItems));
  }, [groceryItems]);

  // Search for products
  const searchProducts = api.walmartGrocery.searchProducts.useMutation({
    onSuccess: (data) => {
      setSearchResults(data.products || []);
      setShowSearchResults(true);
    },
    onError: (error) => {
      setSearchResults([]);
    }
  });

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    await searchProducts.mutateAsync({
      query: searchQuery,
      limit: 10
    });
    setIsSearching(false);
  }, [searchQuery, searchProducts]);

  // Add item to list
  const addItem = useCallback((product: any) => {
    const newItem: GroceryItem = {
      id: `item-${Date.now()}-${Math.random()}`,
      productId: product.id || product.productId,
      name: product.name || product.title,
      category: detectCategory(product),
      price: product.price || 0,
      quantity: 1,
      subtotal: product.price || 0,
      imageUrl: product.imageUrl || product.image
    };

    setGroceryItems(prev => [...prev, newItem]);
    setShowSearchResults(false);
    setSearchQuery('');
  }, []);

  // Detect category from product
  const detectCategory = (product: any): string => {
    const categoryPath = product.category || product.categoryPath || '';
    
    // Simple category detection logic
    if (categoryPath.toLowerCase().includes('produce') || categoryPath.toLowerCase().includes('fruit') || categoryPath.toLowerCase().includes('vegetable')) {
      return 'Produce';
    } else if (categoryPath.toLowerCase().includes('dairy') || categoryPath.toLowerCase().includes('milk') || categoryPath.toLowerCase().includes('cheese')) {
      return 'Dairy & Eggs';
    } else if (categoryPath.toLowerCase().includes('meat') || categoryPath.toLowerCase().includes('seafood') || categoryPath.toLowerCase().includes('poultry')) {
      return 'Meat & Seafood';
    } else if (categoryPath.toLowerCase().includes('bakery') || categoryPath.toLowerCase().includes('bread')) {
      return 'Bakery';
    } else if (categoryPath.toLowerCase().includes('frozen')) {
      return 'Frozen';
    } else if (categoryPath.toLowerCase().includes('beverage') || categoryPath.toLowerCase().includes('drink')) {
      return 'Beverages';
    } else if (categoryPath.toLowerCase().includes('snack') || categoryPath.toLowerCase().includes('chip') || categoryPath.toLowerCase().includes('candy')) {
      return 'Snacks';
    } else if (categoryPath.toLowerCase().includes('pantry') || categoryPath.toLowerCase().includes('canned')) {
      return 'Pantry';
    }
    
    return 'Other';
  };

  // Update quantity
  const updateQuantity = useCallback((itemId: string, delta: number) => {
    setGroceryItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return {
          ...item,
          quantity: newQuantity,
          subtotal: newQuantity * item.price
        };
      }
      return item;
    }));
  }, []);

  // Remove item
  const removeItem = useCallback((itemId: string) => {
    setGroceryItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  // Calculate totals
  useEffect(() => {
    const newSubtotal = groceryItems.reduce((sum, item) => sum + item.subtotal, 0);
    const newTax = newSubtotal * taxRate;
    const newTotal = newSubtotal + newTax;
    
    setSubtotal(newSubtotal);
    setTax(newTax);
    setTotal(newTotal);
  }, [groceryItems, taxRate]);

  // Calculate budget data
  const calculateBudgetData = useCallback((): BudgetData => {
    const categories: Record<string, CategoryBudget> = {};
    
    // Initialize all categories
    Object.keys(categoryLimits).forEach(category => {
      categories[category] = {
        limit: categoryLimits[category],
        spent: 0,
        percentage: 0,
        items: []
      };
    });

    // Calculate spending per category
    groceryItems.forEach(item => {
      const category = item.category;
      if (!categories[category]) {
        categories[category] = {
          limit: categoryLimits[category] || 50,
          spent: 0,
          percentage: 0,
          items: []
        };
      }
      
      categories[category].spent += item.subtotal;
      categories[category].items.push(item);
    });

    // Calculate percentages and warnings
    const warnings: string[] = [];
    Object.keys(categories).forEach(category => {
      const cat = categories[category];
      cat.percentage = cat.limit > 0 ? (cat.spent / cat.limit) * 100 : 0;
      
      if (cat.percentage >= 90 && cat.spent > 0) {
        warnings.push(`${category} is at ${cat.percentage.toFixed(0)}% of budget!`);
      }
    });

    const totalSpent = Object.values(categories).reduce((sum, cat) => sum + cat.spent, 0);

    return {
      monthlyLimit: monthlyBudget,
      spent: totalSpent,
      remaining: monthlyBudget - totalSpent,
      categories,
      warnings,
      lastUpdated: new Date()
    };
  }, [groceryItems, monthlyBudget, categoryLimits]);

  const budgetData = calculateBudgetData();

  // Edit budget handlers
  const startEditingBudget = () => {
    setEditingBudget(true);
    setTempBudgetValue(monthlyBudget.toString());
  };

  const saveBudget = () => {
    const newBudget = parseFloat(tempBudgetValue);
    if (!isNaN(newBudget) && newBudget > 0) {
      setMonthlyBudget(newBudget);
    }
    setEditingBudget(false);
  };

  const startEditingCategory = (category: string) => {
    setEditingCategory(category);
    setTempCategoryValue(categoryLimits[category].toString());
  };

  const saveCategoryLimit = (category: string) => {
    const newLimit = parseFloat(tempCategoryValue);
    if (!isNaN(newLimit) && newLimit >= 0) {
      setCategoryLimits(prev => ({
        ...prev,
        [category]: newLimit
      }));
    }
    setEditingCategory(null);
  };

  // Clear list
  const clearList = () => {
    if (window.confirm('Clear all items from the list?')) {
      setGroceryItems([]);
    }
  };

  // Save list (to history)
  const saveList = () => {
    const history = JSON.parse(localStorage.getItem('groceryHistory') || '[]');
    history.push({
      date: new Date().toISOString(),
      items: groceryItems,
      total: total
    });
    localStorage.setItem('groceryHistory', JSON.stringify(history));
    alert('List saved to history!');
  };

  return (
    <div className="grocery-list-and-tracker">
      {/* Left Pane - Grocery Receipt */}
      <div className="grocery-receipt">
        <div className="receipt-header">
          <h2><ShoppingCart size={20} /> Grocery List</h2>
        </div>

        {/* Search Bar */}
        <div className="search-section">
          <div className="search-input-group">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} disabled={isSearching}>
              <Search size={18} />
            </button>
          </div>

          {/* Search Results Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="search-dropdown">
              {searchResults.map((product) => (
                <div 
                  key={product.id} 
                  className="search-result-item"
                  onClick={() => addItem(product)}
                >
                  <span className="product-name">{product.name}</span>
                  <span className="product-price">${(product.price || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Receipt Items */}
        <div className="receipt-items">
          {groceryItems.length === 0 ? (
            <div className="empty-list">
              <Package size={48} />
              <p>Your list is empty</p>
              <p className="hint">Search and add products above</p>
            </div>
          ) : (
            groceryItems.map((item) => (
              <div key={item.id} className="receipt-item">
                <div className="item-info">
                  <span className="item-icon">{CATEGORY_ICONS[item.category] || '📦'}</span>
                  <div className="item-details">
                    <div className="item-name">{item.name}</div>
                    <div className="item-calc">
                      {item.quantity} × ${item.price.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="item-controls">
                  <div className="quantity-controls">
                    <button onClick={() => updateQuantity(item.id, -1)}>
                      <Minus size={14} />
                    </button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)}>
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="item-total">${item.subtotal.toFixed(2)}</div>
                  <button 
                    className="remove-btn"
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Receipt Footer */}
        {groceryItems.length > 0 && (
          <div className="receipt-footer">
            <div className="receipt-divider"></div>
            <div className="receipt-total-line">
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="receipt-total-line">
              <span>Tax ({(taxRate * 100).toFixed(0)}%):</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="receipt-divider"></div>
            <div className="receipt-total-line total">
              <span>TOTAL:</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <div className="receipt-actions">
              <button onClick={clearList} className="btn-secondary">Clear</button>
              <button onClick={saveList} className="btn-primary">Save List</button>
            </div>
          </div>
        )}
      </div>

      {/* Right Pane - Budget Tracker */}
      <div className="budget-tracker">
        <div className="tracker-header">
          <h2><DollarSign size={20} /> Budget Tracker</h2>
        </div>

        {/* Monthly Budget */}
        <div className="monthly-budget">
          <div className="budget-header">
            {editingBudget ? (
              <div className="edit-budget">
                <span>Monthly Budget: $</span>
                <input
                  type="number"
                  value={tempBudgetValue}
                  onChange={(e) => setTempBudgetValue(e.target.value)}
                  autoFocus
                />
                <button onClick={saveBudget}><Save size={14} /></button>
                <button onClick={() => setEditingBudget(false)}><X size={14} /></button>
              </div>
            ) : (
              <div className="budget-display">
                <span>Monthly Budget: ${monthlyBudget.toFixed(2)}</span>
                <button onClick={startEditingBudget}><Edit2 size={14} /></button>
              </div>
            )}
          </div>
          
          <div className="budget-progress">
            <div className="progress-bar">
              <div 
                className={`progress-fill ${
                  budgetData.spent / monthlyBudget > 0.9 ? 'danger' :
                  budgetData.spent / monthlyBudget > 0.7 ? 'warning' : 'safe'
                }`}
                style={{ width: `${Math.min(100, (budgetData.spent / monthlyBudget) * 100)}%` }}
              />
            </div>
            <div className="budget-stats">
              <span className="spent">${budgetData.spent.toFixed(2)} spent</span>
              <span className="remaining">${budgetData.remaining.toFixed(2)} remaining</span>
            </div>
          </div>
        </div>

        {/* Category Budgets */}
        <div className="category-budgets">
          <h3>Categories</h3>
          {Object.entries(budgetData.categories).map(([category, data]) => (
            <div key={category} className="category-budget">
              <div className="category-header">
                <span className="category-name">
                  {CATEGORY_ICONS[category]} {category}
                </span>
                {editingCategory === category ? (
                  <div className="edit-category">
                    <span>$</span>
                    <input
                      type="number"
                      value={tempCategoryValue}
                      onChange={(e) => setTempCategoryValue(e.target.value)}
                      autoFocus
                    />
                    <button onClick={() => saveCategoryLimit(category)}><Save size={12} /></button>
                    <button onClick={() => setEditingCategory(null)}><X size={12} /></button>
                  </div>
                ) : (
                  <div className="category-limit">
                    <span>${data.limit}</span>
                    <button onClick={() => startEditingCategory(category)}>
                      <Edit2 size={12} />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="category-progress">
                <div className="progress-bar small">
                  <div 
                    className={`progress-fill ${
                      data.percentage > 90 ? 'danger' :
                      data.percentage > 70 ? 'warning' : 'safe'
                    }`}
                    style={{ width: `${Math.min(100, data.percentage)}%` }}
                  />
                </div>
                <div className="category-stats">
                  <span>${data.spent.toFixed(2)} / ${data.limit}</span>
                  <span>{data.percentage.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Warnings */}
        {budgetData.warnings.length > 0 && (
          <div className="budget-warnings">
            {budgetData.warnings.map((warning, idx) => (
              <div key={idx} className="warning">
                <AlertTriangle size={16} />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}

        {/* Insights */}
        <div className="budget-insights">
          <h3><TrendingUp size={16} /> Quick Insights</h3>
          <div className="insight">
            <span className="insight-label">Most spent category:</span>
            <span className="insight-value">
              {Object.entries(budgetData.categories)
                .sort((a, b) => b[1].spent - a[1].spent)[0]?.[0] || 'None'}
            </span>
          </div>
          <div className="insight">
            <span className="insight-label">Items in cart:</span>
            <span className="insight-value">{groceryItems.length}</span>
          </div>
          <div className="insight">
            <span className="insight-label">Budget used:</span>
            <span className="insight-value">
              {((budgetData.spent / monthlyBudget) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};