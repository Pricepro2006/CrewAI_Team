# Walmart Grocery Agent Frontend Documentation

## Overview

The Walmart Grocery Agent is a comprehensive React-based frontend application that provides an AI-powered grocery shopping experience with real-time price tracking, inventory monitoring, and intelligent product recommendations. The system integrates with backend microservices through tRPC APIs and WebSocket connections for real-time updates.

## Architecture

### Component Hierarchy

```
WalmartGroceryAgent (Main Container)
├── WalmartDashboard (Alternative Entry Point)
├── WalmartHybridSearch (Smart Search)
├── GroceryListAndTracker (List Management)
├── WalmartLivePricing (Price Monitoring)
└── Supporting Components
    ├── WalmartProductCard
    ├── WalmartShoppingCart
    ├── WalmartNLPSearch
    ├── WalmartBudgetTracker
    ├── WalmartDealAlert
    └── Various utility components
```

### Technology Stack

- **Framework**: React 18.2.0 with TypeScript 5.0
- **State Management**: Zustand with persistent storage
- **API Layer**: tRPC for type-safe communication
- **Styling**: Custom CSS with dark theme
- **Real-time**: WebSocket connections
- **Icons**: Lucide React icons

## Core Components

### 1. WalmartGroceryAgent (Main Container)

**File**: `/src/ui/components/WalmartAgent/WalmartGroceryAgent.tsx`

**Purpose**: Primary container component that orchestrates the entire grocery shopping experience.

**Key Features**:
- Tabbed navigation system (Shopping, Smart Search, List & Tracker, Price History, Live Pricing)
- URL-based routing synchronization
- Real-time statistics display
- Search functionality with product results
- Price alert management
- Shopping cart integration

**State Management**:
```typescript
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
```

**Key Props**: None (root component)

**State Variables**:
- `activeTab`: Current active tab
- `searchQuery`: Search input value
- `searchResults`: Product search results
- `selectedItems`: Set of selected product IDs
- `priceAlerts`: Map of price alert configurations

**Event Handlers**:
- `handleTabChange()`: Navigate between tabs
- `handleSearch()`: Execute product search
- `toggleItemSelection()`: Add/remove items from selection
- `setPriceAlert()`: Configure price alerts

### 2. WalmartDashboard (Alternative Entry)

**File**: `/src/ui/components/Walmart/WalmartDashboard.tsx`

**Purpose**: Alternative dashboard-style entry point with navigation.

**Features**:
- Header navigation
- Quick action cards
- Component switching
- Dashboard overview

### 3. GroceryListAndTracker (List Management)

**File**: `/src/ui/components/WalmartAgent/GroceryListAndTracker.tsx`

**Purpose**: Comprehensive grocery list and budget tracking interface.

**Key Features**:
- Receipt-style grocery list display
- Real-time budget tracking by category
- Category-based organization
- Tax calculation and totals
- Persistent storage in localStorage

**State Management**:
```typescript
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
```

**Default Categories**:
- Produce: $150
- Dairy & Eggs: $100
- Meat & Seafood: $150
- Bakery: $50
- Pantry: $75
- Frozen: $50
- Beverages: $50
- Snacks: $40
- Other: $35

### 4. WalmartHybridSearch (Smart Search)

**File**: `/src/ui/components/Walmart/WalmartHybridSearch.tsx`

**Purpose**: AI-powered search with multiple result categories.

**Features**:
- Natural language search with autocomplete
- Three search result categories:
  - Previously Purchased (from order history)
  - New Products (fresh catalog items)
  - Recommended for You (AI suggestions)
- Advanced filtering options
- External source integration

**Search Configuration**:
```typescript
interface SearchParams {
  query: string;
  userId: string;
  includeExternal: boolean;
  includePastPurchases: boolean;
  includeRecommendations: boolean;
  category?: string;
  priceRange?: { min: number; max: number };
  inStockOnly: boolean;
  sortBy: "relevance" | "price" | "rating" | "purchase_frequency";
  limit: number;
}
```

### 5. WalmartLivePricing (Price Monitoring)

**File**: `/src/ui/components/WalmartAgent/WalmartLivePricing.tsx`

**Purpose**: Real-time price monitoring and comparison.

**Features**:
- Live price fetching from Walmart.com
- Store location selection
- Price change alerts
- Service health monitoring
- Price history tracking

**Integration Points**:
- Uses custom hooks for price data
- WebSocket for real-time updates
- SearXNG/scraping services for price data

## State Management

### Global Store (Zustand)

**File**: `/src/client/store/groceryStore.ts`

**Purpose**: Centralized state management for the entire grocery application.

**Key Features**:
- Persistent storage with Zustand middleware
- Optimized updates with Immer integration
- Type-safe state management
- Performance optimizations

**Store Structure**:
```typescript
interface GroceryState {
  // Cart Management
  cart: ShoppingCart;
  addToCart: (product: WalmartProduct, quantity: number) => void;
  updateCartItemQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;

  // List Management
  lists: GroceryList[];
  currentListId: string | null;
  createList: (name: string, description?: string) => GroceryList;
  updateList: (listId: string, updates: Partial<GroceryList>) => void;
  deleteList: (listId: string) => void;

  // User Preferences
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => void;

  // Price Alerts
  priceAlerts: PriceAlert[];
  createPriceAlert: (productId: string, targetPrice: number) => void;
  deletePriceAlert: (alertId: string) => void;

  // Computed Values
  cartItemCount: number;
  cartTotal: number;
  favoriteProductIds: Set<string>;
}
```

## Custom Hooks

### 1. useWalmartPricing

**File**: `/src/ui/hooks/useWalmartPricing.ts`

**Purpose**: Collection of hooks for Walmart price data management.

**Available Hooks**:
- `useWalmartPrice(productId, options)`: Single product price
- `useWalmartPrices(productIds, options)`: Multiple product prices
- `useWalmartSearch(query, options)`: Search with prices
- `useNearbyWalmartStores(zipCode)`: Store locations
- `useWalmartPriceMonitor(productIds, options)`: Price monitoring
- `useWalmartPriceComparison(productId, zipCodes)`: Multi-location comparison
- `useClearPriceCache()`: Cache management
- `useWalmartPricingHealth()`: Service health check

### 2. useWalmartWebSocket

**File**: `/src/ui/hooks/useWalmartWebSocket.ts`

**Purpose**: WebSocket connection management for real-time updates.

**Features**:
- Exponential backoff reconnection
- Heartbeat monitoring
- Message type handling
- Session management
- Error recovery

**Message Types**:
```typescript
interface WSMessage {
  type: "nlp_processing" | "nlp_result" | "cart_update" | "price_update" | "product_match" | "error";
  data: any;
  timestamp: string;
  sessionId?: string;
  userId?: string;
}
```

**Connection Options**:
```typescript
interface UseWalmartWebSocketOptions {
  userId?: string;
  autoConnect?: boolean;
  maxReconnectAttempts?: number;
  initialReconnectDelay?: number;
  maxReconnectDelay?: number;
  reconnectDelayMultiplier?: number;
  enableJitter?: boolean;
}
```

## UI Design System

### Color Scheme (Dark Theme)

```css
:root {
  --bg-primary: #0f172a;      /* Main background */
  --bg-secondary: #1e293b;    /* Card backgrounds */
  --bg-tertiary: #1a202c;     /* Secondary cards */
  --accent-primary: #fbbf24;   /* Gold accent */
  --accent-secondary: #f59e0b; /* Dark gold */
  --text-primary: #f1f5f9;     /* Primary text */
  --text-secondary: #94a3b8;   /* Secondary text */
  --text-muted: #64748b;       /* Muted text */
  --success: #10b981;          /* Success/savings */
  --danger: #ef4444;           /* Errors/warnings */
  --border: rgba(148, 163, 184, 0.1); /* Subtle borders */
}
```

### Component Styling Patterns

**Card Components**:
```css
.card {
  background: linear-gradient(135deg, #1e293b 0%, #1a202c 100%);
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.1);
  transition: all 0.3s ease;
}

.card:hover {
  transform: translateY(-2px);
  border-color: rgba(251, 191, 36, 0.2);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
}
```

**Button Styles**:
```css
.btn-primary {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: #0f172a;
  border: none;
  border-radius: 0.75rem;
  padding: 1rem 2rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}
```

## API Integration

### tRPC Endpoints

The frontend communicates with backend services through type-safe tRPC endpoints:

**Walmart Grocery Endpoints**:
- `walmartGrocery.searchProducts`: Product search
- `walmartGrocery.getStats`: Dashboard statistics
- `walmartGrocery.getTrending`: Trending products
- `walmartGrocery.hybridSearch`: AI-powered search
- `walmartGrocery.quickSearch`: Autocomplete suggestions

**Pricing Endpoints**:
- `walmartPrice.getProductPrice`: Single product price
- `walmartPrice.getMultiplePrices`: Batch price fetching
- `walmartPrice.searchWithPrices`: Search with live prices
- `walmartPrice.getNearbyStores`: Store locations
- `walmartPrice.clearCache`: Cache management
- `walmartPrice.healthCheck`: Service status

### Error Handling

The application implements comprehensive error handling:

```typescript
const searchProductsMutation = api.walmartGrocery.searchProducts.useMutation({
  onError: (error) => {
    console.error('Search failed:', error);
    // Fallback behavior or user notification
  },
  onSuccess: (data) => {
    // Handle successful response
  }
});
```

## Performance Optimizations

### 1. Lazy Loading
- Components are loaded on-demand
- Route-based code splitting
- Image lazy loading for product cards

### 2. Caching Strategy
- tRPC query caching with appropriate stale times
- localStorage for user preferences
- WebSocket message deduplication

### 3. State Optimization
- Zustand with Immer for efficient updates
- Selective re-renders with computed values
- Batch operations for cart updates

### 4. Memory Management
- Cleanup intervals and timeouts
- WebSocket connection management
- Proper component unmounting

## Real-time Features

### WebSocket Integration

**Port**: 8080 (WebSocket Gateway)
**Connection URL**: `ws://localhost:8080/ws/walmart`

**Message Flow**:
1. Client connects and authenticates
2. Subscribes to relevant events
3. Receives real-time updates for:
   - NLP processing status
   - Price changes
   - Cart synchronization
   - Product matches

### Live Updates

- **Price Monitoring**: Real-time price change alerts
- **NLP Processing**: Live feedback during AI analysis
- **Cart Sync**: Multi-device cart synchronization
- **Inventory Updates**: Stock status changes

## Responsive Design

### Breakpoints

- **Desktop**: >= 1024px - Full feature set
- **Tablet**: 768px - 1023px - Adapted layouts
- **Mobile**: < 768px - Simplified interface

### Mobile Optimizations

- **Navigation**: Collapsible tab navigation
- **Lists**: Vertical layouts for list items
- **Search**: Full-width search inputs
- **Cards**: Single-column product grids

## Testing Considerations

### Component Testing
- Unit tests for individual components
- Mock tRPC providers for testing
- WebSocket connection mocking

### Integration Testing
- End-to-end user workflows
- API integration testing
- Real-time feature testing

### Performance Testing
- Load testing with large product catalogs
- WebSocket connection stress testing
- Memory leak detection

## Future Enhancements

### Planned Features
- Voice shopping integration
- Augmented reality product visualization
- Advanced recommendation algorithms
- Multi-store price comparison
- Social shopping features

### Technical Improvements
- Progressive Web App (PWA) capabilities
- Advanced caching strategies
- Machine learning model integration
- Enhanced accessibility features

## File Structure Summary

```
src/ui/components/
├── WalmartAgent/
│   ├── WalmartGroceryAgent.tsx      # Main container
│   ├── WalmartGroceryAgent.css      # Comprehensive styling
│   ├── GroceryListAndTracker.tsx    # List management
│   ├── WalmartLivePricing.tsx       # Price monitoring
│   ├── NaturalLanguageInput.tsx     # Voice/text input
│   └── CommandHistory.tsx           # Command tracking
├── Walmart/
│   ├── WalmartDashboard.tsx         # Alternative entry
│   ├── WalmartHybridSearch.tsx      # AI-powered search
│   ├── WalmartProductCard.tsx       # Product display
│   ├── WalmartShoppingCart.tsx      # Cart management
│   ├── WalmartBudgetTracker.tsx     # Budget tracking
│   ├── WalmartNLPSearch.tsx         # NLP search interface
│   └── [Other utility components]
src/ui/hooks/
├── useWalmartPricing.ts             # Pricing hooks
├── useWalmartWebSocket.ts           # WebSocket management
└── useRealtimePrices.ts             # Real-time price updates
src/client/store/
└── groceryStore.ts                  # Global state management
```

## Configuration

### Environment Variables
- `NODE_ENV`: Environment mode
- WebSocket ports and endpoints
- API base URLs
- Feature flags for experimental features

### Default Settings
- Default ZIP code: 29301 (Spartanburg, SC)
- Tax rate: 7%
- Search result limits: 20 items
- WebSocket reconnection: 10 attempts max
- Price cache duration: 30 minutes

This documentation provides a comprehensive overview of the Walmart Grocery Agent frontend implementation. The system demonstrates modern React development practices with TypeScript, real-time capabilities, and a focus on user experience and performance.