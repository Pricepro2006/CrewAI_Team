/**
 * Mock Data and Scenarios for Walmart Grocery Agent Testing
 * Comprehensive test data sets for different scenarios
 */

export interface MockProduct {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  savings?: number;
  inStock: boolean;
  imageUrl: string;
  category: string;
  unit: string;
  description?: string;
  rating?: number;
  reviewCount?: number;
}

export interface MockSearchResponse {
  products: MockProduct[];
  metadata: {
    totalResults: number;
    query: string;
    location?: string;
  };
  timestamp: string;
}

export interface MockGroceryList {
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    category: string;
    added: string;
    completed?: boolean;
  }>;
  total: number;
  lastUpdated: string;
}

/**
 * Mock Product Categories
 */
export const MOCK_CATEGORIES = [
  'Produce',
  'Dairy',
  'Meat & Seafood',
  'Bakery',
  'Pantry',
  'Frozen',
  'Beverages',
  'Snacks',
  'Health & Beauty',
  'Household'
];

/**
 * Mock Products for Different Test Scenarios
 */
export const MOCK_PRODUCTS: MockProduct[] = [
  // Produce
  {
    id: 'prod-001',
    name: 'Organic Bananas',
    price: 1.98,
    originalPrice: 2.48,
    savings: 0.50,
    inStock: true,
    imageUrl: '/api/placeholder/150/150',
    category: 'Produce',
    unit: 'lb',
    description: 'Fresh organic bananas',
    rating: 4.3,
    reviewCount: 1247
  },
  {
    id: 'prod-002',
    name: 'Fresh Strawberries',
    price: 3.98,
    inStock: true,
    imageUrl: '/api/placeholder/150/150',
    category: 'Produce',
    unit: '1 lb container',
    rating: 4.1,
    reviewCount: 892
  },
  {
    id: 'prod-003',
    name: 'Organic Spinach',
    price: 2.98,
    inStock: false,
    imageUrl: '/api/placeholder/150/150',
    category: 'Produce',
    unit: '5 oz bag',
    rating: 4.0,
    reviewCount: 456
  },

  // Dairy
  {
    id: 'dairy-001',
    name: 'Whole Milk',
    price: 3.48,
    inStock: true,
    imageUrl: '/api/placeholder/150/150',
    category: 'Dairy',
    unit: 'gallon',
    rating: 4.5,
    reviewCount: 2341
  },
  {
    id: 'dairy-002',
    name: 'Sharp Cheddar Cheese',
    price: 4.98,
    originalPrice: 5.98,
    savings: 1.00,
    inStock: true,
    imageUrl: '/api/placeholder/150/150',
    category: 'Dairy',
    unit: '8 oz block',
    rating: 4.7,
    reviewCount: 1876
  },

  // Meat & Seafood
  {
    id: 'meat-001',
    name: 'Boneless Chicken Breast',
    price: 5.98,
    inStock: true,
    imageUrl: '/api/placeholder/150/150',
    category: 'Meat & Seafood',
    unit: 'lb',
    rating: 4.2,
    reviewCount: 987
  },
  {
    id: 'meat-002',
    name: 'Atlantic Salmon Fillet',
    price: 9.98,
    originalPrice: 12.98,
    savings: 3.00,
    inStock: true,
    imageUrl: '/api/placeholder/150/150',
    category: 'Meat & Seafood',
    unit: 'lb',
    rating: 4.6,
    reviewCount: 654
  },

  // Bakery
  {
    id: 'bakery-001',
    name: 'Whole Grain Bread',
    price: 2.48,
    inStock: true,
    imageUrl: '/api/placeholder/150/150',
    category: 'Bakery',
    unit: '20 oz loaf',
    rating: 4.4,
    reviewCount: 1432
  },

  // Pantry
  {
    id: 'pantry-001',
    name: 'Extra Virgin Olive Oil',
    price: 7.98,
    inStock: true,
    imageUrl: '/api/placeholder/150/150',
    category: 'Pantry',
    unit: '500ml bottle',
    rating: 4.8,
    reviewCount: 789
  },

  // Out of stock items for testing
  {
    id: 'oos-001',
    name: 'Premium Ice Cream',
    price: 6.98,
    inStock: false,
    imageUrl: '/api/placeholder/150/150',
    category: 'Frozen',
    unit: '48 oz container',
    rating: 4.9,
    reviewCount: 2156
  }
];

/**
 * Mock Search Scenarios
 */
export const MOCK_SEARCH_SCENARIOS = {
  dairy: {
    query: 'milk',
    products: MOCK_PRODUCTS.filter(p => p.category === 'Dairy'),
    metadata: {
      totalResults: 2,
      query: 'milk',
      location: 'Spartanburg, SC'
    }
  },
  produce: {
    query: 'organic',
    products: MOCK_PRODUCTS.filter(p => p.name.toLowerCase().includes('organic')),
    metadata: {
      totalResults: 2,
      query: 'organic',
      location: 'Spartanburg, SC'
    }
  },
  sale_items: {
    query: 'sale',
    products: MOCK_PRODUCTS.filter(p => p.savings && p.savings > 0),
    metadata: {
      totalResults: 4,
      query: 'sale',
      location: 'Spartanburg, SC'
    }
  },
  empty_results: {
    query: 'nonexistent product',
    products: [],
    metadata: {
      totalResults: 0,
      query: 'nonexistent product',
      location: 'Spartanburg, SC'
    }
  }
};

/**
 * Mock Grocery Lists for Testing
 */
export const MOCK_GROCERY_LISTS = {
  empty: {
    items: [],
    total: 0,
    lastUpdated: new Date().toISOString()
  },
  small: {
    items: [
      {
        id: 'item-1',
        name: 'Milk',
        price: 3.48,
        quantity: 1,
        category: 'Dairy',
        added: new Date().toISOString(),
        completed: false
      },
      {
        id: 'item-2',
        name: 'Bread',
        price: 2.48,
        quantity: 2,
        category: 'Bakery',
        added: new Date().toISOString(),
        completed: true
      }
    ],
    total: 8.44,
    lastUpdated: new Date().toISOString()
  },
  large: {
    items: [
      ...Array.from({ length: 15 }, (_, i) => ({
        id: `item-${i + 1}`,
        name: `Test Product ${i + 1}`,
        price: Math.round((Math.random() * 10 + 1) * 100) / 100,
        quantity: Math.floor(Math.random() * 3) + 1,
        category: MOCK_CATEGORIES[i % MOCK_CATEGORIES.length],
        added: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        completed: Math.random() > 0.7
      }))
    ],
    total: 0, // Will be calculated
    lastUpdated: new Date().toISOString()
  }
};

// Calculate total for large list
MOCK_GROCERY_LISTS.large.total = MOCK_GROCERY_LISTS.large.items.reduce(
  (sum, item) => sum + (item.price * item.quantity), 0
);

/**
 * Mock Price History Data
 */
export const MOCK_PRICE_HISTORY = {
  'prod-001': [
    { date: '2024-01-01', price: 2.48 },
    { date: '2024-01-15', price: 2.28 },
    { date: '2024-02-01', price: 2.18 },
    { date: '2024-02-15', price: 1.98 }
  ],
  'dairy-001': [
    { date: '2024-01-01', price: 3.68 },
    { date: '2024-01-15', price: 3.58 },
    { date: '2024-02-01', price: 3.48 },
    { date: '2024-02-15', price: 3.48 }
  ]
};

/**
 * Mock Budget Data
 */
export const MOCK_BUDGET_DATA = {
  monthly: {
    limit: 400,
    spent: 260,
    remaining: 140,
    categories: {
      'Produce': { limit: 80, spent: 65, percentage: 81.25 },
      'Dairy': { limit: 60, spent: 42, percentage: 70 },
      'Meat & Seafood': { limit: 120, spent: 98, percentage: 81.67 },
      'Bakery': { limit: 40, spent: 28, percentage: 70 },
      'Pantry': { limit: 100, spent: 27, percentage: 27 }
    }
  }
};

/**
 * Mock WebSocket Messages
 */
export const MOCK_WEBSOCKET_MESSAGES = {
  priceUpdate: {
    type: 'PRICE_UPDATE',
    data: {
      productId: 'prod-001',
      oldPrice: 2.48,
      newPrice: 1.98,
      timestamp: new Date().toISOString()
    }
  },
  stockUpdate: {
    type: 'STOCK_UPDATE',
    data: {
      productId: 'prod-003',
      inStock: true,
      timestamp: new Date().toISOString()
    }
  },
  budgetAlert: {
    type: 'BUDGET_ALERT',
    data: {
      category: 'Produce',
      currentSpent: 75,
      limit: 80,
      percentage: 93.75,
      timestamp: new Date().toISOString()
    }
  }
};

/**
 * Mock API Error Responses
 */
export const MOCK_API_ERRORS = {
  networkError: {
    status: 0,
    message: 'Network error - unable to connect'
  },
  serverError: {
    status: 500,
    message: 'Internal server error'
  },
  rateLimited: {
    status: 429,
    message: 'Rate limit exceeded. Please try again later.'
  },
  notFound: {
    status: 404,
    message: 'Product not found'
  }
};

/**
 * Test User Preferences
 */
export const MOCK_USER_PREFERENCES = {
  default: {
    zipCode: '29301',
    store: 'Walmart Supercenter - Spartanburg',
    budgetLimit: 200,
    notifications: true,
    preferredCategories: ['Produce', 'Dairy', 'Meat & Seafood'],
    dietaryRestrictions: []
  },
  vegetarian: {
    zipCode: '29301',
    store: 'Walmart Supercenter - Spartanburg',
    budgetLimit: 150,
    notifications: true,
    preferredCategories: ['Produce', 'Dairy', 'Pantry'],
    dietaryRestrictions: ['vegetarian']
  },
  budget_conscious: {
    zipCode: '29301',
    store: 'Walmart Supercenter - Spartanburg',
    budgetLimit: 100,
    notifications: true,
    preferredCategories: ['Pantry', 'Frozen'],
    dietaryRestrictions: []
  }
};