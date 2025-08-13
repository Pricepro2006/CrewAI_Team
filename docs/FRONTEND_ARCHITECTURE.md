# Frontend Architecture Documentation

## Overview

The CrewAI Team frontend is a sophisticated React 18.2 application built with TypeScript, featuring a comprehensive component library, advanced state management, and specialized Walmart grocery automation interface. The architecture emphasizes type safety, performance, and user experience.

**Technical Stack:**
- **React 18.2** with TypeScript 5.3
- **tRPC** for type-safe API communication
- **React Query** for data fetching and caching
- **Zustand** for state management
- **Tailwind CSS** with custom component library
- **Vite** for build optimization and hot reloading

## Application Architecture

### Component Hierarchy

```
src/ui/
├── App.tsx                     # Main application entry point
├── components/
│   ├── Chat/                   # AI chat interfaces
│   ├── Dashboard/              # System overview dashboard
│   ├── Email/                  # Email management interface
│   ├── Agents/                 # Agent monitoring components
│   ├── WalmartAgent/           # Walmart grocery automation (13 components)
│   ├── Layout/                 # Application layout components
│   ├── Security/               # Security and authentication UI
│   └── ui/                     # Reusable UI components (25+ components)
├── hooks/                      # Custom React hooks
├── stores/                     # Zustand state management
├── pages/                      # Page-level components
└── utils/                      # Frontend utilities
```

### Core Application Structure

**Main App Component**: `src/ui/App.tsx`

```typescript
export function App() {
  const { token, getHeaders } = useCSRF();
  
  // Dark mode by default
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);
  
  // Optimized query client with intelligent retry logic
  const [queryClient] = useState(() =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000,        // 5 minutes
          cacheTime: 10 * 60 * 1000,       // 10 minutes
          retry: (failureCount, error: any) => {
            // Smart retry logic for different error types
            if (error?.status === 401 || error?.status === 403) return false;
            if (error?.message?.includes("CSRF")) return false;
            return failureCount < 3;
          },
          retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
        }
      }
    })
  );
  
  // tRPC client with WebSocket support
  const [trpcClient] = useState(() =>
    api.createClient({
      transformer: superjson,
      links: [
        splitLink({
          condition: (op) => op.type === "subscription",
          true: wsLink({ client: createWSClient({ url: webSocketConfig.url }) }),
          false: httpBatchLink({ url: "/api/trpc" })
        })
      ]
    })
  );
}
```

## Email Management Interface

### Email Dashboard Architecture

**Main Component**: `src/ui/components/Email/EmailDashboard.tsx`

```typescript
export const EmailDashboard: React.FC = () => {
  const [filters, setFilters] = useState<EmailFilters>({
    status: [],
    workflowState: [],
    priority: [],
    dateRange: undefined
  });
  
  // Optimized data fetching with caching
  const { data: emailsData, isLoading, error } = api.emails.getEmailsTable.useQuery({
    page: currentPage,
    pageSize: 50,
    sortBy: sortConfig.field,
    sortOrder: sortConfig.direction,
    filters,
    search: searchQuery,
    refreshKey: Date.now()
  }, {
    keepPreviousData: true,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000
  });
  
  return (
    <div className="space-y-6">
      <EmailStats />
      <FilterPanel filters={filters} onChange={setFilters} />
      <EmailTable 
        emails={emailsData?.emails || []} 
        loading={isLoading}
        onEmailSelect={handleEmailSelect}
      />
    </div>
  );
};
```

### Advanced Email Table

**Virtualized Performance**: `src/client/components/virtualized/VirtualizedEmailTable.tsx`

```typescript
export const VirtualizedEmailTable: React.FC<Props> = ({ 
  emails, 
  onEmailSelect, 
  selectedEmails 
}) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'received_date',
    direction: 'desc'
  });
  
  // Virtual scrolling for performance with large datasets
  const Row = ({ index, style }: { index: number; style: any }) => {
    const email = emails[index];
    return (
      <div style={style} className="border-b border-gray-200 dark:border-gray-700">
        <EmailRow 
          email={email}
          isSelected={selectedEmails.includes(email.id)}
          onSelect={() => onEmailSelect(email.id)}
        />
      </div>
    );
  };
  
  return (
    <div className="h-96 w-full">
      <AutoSizer>
        {({ height, width }) => (
          <FixedSizeList
            height={height}
            width={width}
            itemCount={emails.length}
            itemSize={80}
            overscanCount={5}
          >
            {Row}
          </FixedSizeList>
        )}
      </AutoSizer>
    </div>
  );
};
```

### Email Filtering System

**Advanced Filter Panel**: `src/client/components/email/FilterPanel.tsx`

```typescript
export const FilterPanel: React.FC<FilterPanelProps> = ({ 
  filters, 
  onChange, 
  onReset 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Email Filters
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onReset}>
            Reset All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Status Filter */}
          <MultiSelectFilter
            label="Status"
            options={[
              { value: "red", label: "Critical", color: "red" },
              { value: "yellow", label: "Warning", color: "yellow" },
              { value: "green", label: "Normal", color: "green" }
            ]}
            value={filters.status}
            onChange={(status) => onChange({ ...filters, status })}
          />
          
          {/* Priority Filter */}
          <MultiSelectFilter
            label="Priority"
            options={[
              { value: "critical", label: "Critical" },
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" }
            ]}
            value={filters.priority}
            onChange={(priority) => onChange({ ...filters, priority })}
          />
          
          {/* Date Range Filter */}
          <DateRangeFilter
            value={filters.dateRange}
            onChange={(dateRange) => onChange({ ...filters, dateRange })}
          />
        </div>
      </CardContent>
    </Card>
  );
};
```

## Walmart Grocery Agent Interface

### Comprehensive Walmart Integration

The system includes 13 specialized Walmart components for complete grocery automation:

#### 1. WalmartDashboard.tsx - Main Control Center

```typescript
export const WalmartDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [budget, setBudget] = useState<BudgetInfo>({
    monthly: 500,
    remaining: 325,
    spent: 175
  });
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header with Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Cart Total"
            value={`$${cartItems.reduce((sum, item) => sum + item.total, 0).toFixed(2)}`}
            icon={<ShoppingCart />}
            trend="+12%"
          />
          <StatCard
            title="Budget Remaining"
            value={`$${budget.remaining}`}
            icon={<DollarSign />}
            trend="-8%"
          />
          <StatCard
            title="Savings This Month"
            value="$47.20"
            icon={<TrendingUp />}
            trend="+23%"
          />
          <StatCard
            title="Active Deals"
            value="12"
            icon={<Sparkles />}
            trend="+3"
          />
        </div>
        
        {/* Main Dashboard Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="shopping">Shopping</TabsTrigger>
            <TabsTrigger value="budget">Budget</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="deals">Deals</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            <DashboardOverview />
          </TabsContent>
          
          <TabsContent value="shopping">
            <ShoppingInterface />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
```

#### 2. WalmartProductSearch.tsx - Advanced Product Discovery

```typescript
export const WalmartProductSearch: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<ProductFilters>({
    category: [],
    priceRange: { min: 0, max: 100 },
    brand: [],
    rating: 0,
    inStock: true
  });
  
  // Real-time product search with debouncing
  const { data: products, isLoading } = api.walmartGrocery.searchProducts.useQuery({
    query: searchQuery,
    filters,
    sort: 'relevance',
    limit: 20
  }, {
    enabled: searchQuery.length > 2,
    staleTime: 5 * 60 * 1000
  });
  
  return (
    <div className="space-y-6">
      {/* Advanced Search Interface */}
      <Card>
        <CardHeader>
          <CardTitle>Product Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search for products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <Button>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
          
          {/* Advanced Filters */}
          <ProductFilters 
            filters={filters} 
            onChange={setFilters}
            categories={products?.filters.availableCategories || []}
            brands={products?.filters.availableBrands || []}
          />
        </CardContent>
      </Card>
      
      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products?.products.map(product => (
          <WalmartProductCard
            key={product.id}
            product={product}
            onAddToCart={handleAddToCart}
            onQuickView={handleQuickView}
          />
        ))}
      </div>
    </div>
  );
};
```

#### 3. WalmartShoppingCart.tsx - Intelligent Cart Management

```typescript
export const WalmartShoppingCart: React.FC = () => {
  const { cartItems, updateQuantity, removeItem, clearCart } = useCart();
  const [promoCode, setPromoCode] = useState('');
  const [savings, setSavings] = useState<SavingsInfo>({
    coupons: 12.50,
    bulk: 8.75,
    rollback: 15.25
  });
  
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalSavings = Object.values(savings).reduce((sum, saving) => sum + saving, 0);
  const tax = subtotal * 0.0875; // 8.75% tax rate
  const total = subtotal - totalSavings + tax;
  
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Shopping Cart ({cartItems.length} items)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cartItems.length === 0 ? (
            <EmptyCartState />
          ) : (
            <div className="space-y-4">
              {cartItems.map(item => (
                <CartItemRow
                  key={item.id}
                  item={item}
                  onUpdateQuantity={updateQuantity}
                  onRemove={removeItem}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Order Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Order Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-green-600">
              <span>Savings</span>
              <span>-${totalSavings.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <hr />
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
```

### Walmart Component Architecture

**Complete Component Suite:**

1. **WalmartDashboard** - Main control center with analytics
2. **WalmartProductSearch** - Advanced product discovery with filtering
3. **WalmartShoppingCart** - Intelligent cart management with savings tracking
4. **WalmartOrderHistory** - Complete order tracking and reordering
5. **WalmartBudgetTracker** - Financial management and spending analytics
6. **WalmartDealAlert** - Real-time deal notifications and price tracking
7. **WalmartDeliveryScheduler** - Delivery time optimization
8. **WalmartGroceryList** - Smart list management with meal planning
9. **WalmartPriceTracker** - Price monitoring and trend analysis
10. **WalmartProductCard** - Rich product display with quick actions
11. **WalmartSubstitutionManager** - Automated product substitutions
12. **WalmartUserPreferences** - Personalization and dietary restrictions
13. **WalmartChatInterface** - AI-powered shopping assistance

## State Management Architecture

### Zustand Store Implementation

**Grocery Store**: `src/client/store/groceryStore.ts`

```typescript
interface GroceryState {
  // Cart Management
  cartItems: CartItem[];
  addToCart: (product: Product, quantity: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  
  // Budget Management
  budget: BudgetInfo;
  updateBudget: (budget: Partial<BudgetInfo>) => void;
  
  // User Preferences
  preferences: UserPreferences;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  
  // Shopping Lists
  lists: ShoppingList[];
  createList: (name: string) => void;
  addToList: (listId: string, item: ListItem) => void;
  
  // Order History
  orders: Order[];
  addOrder: (order: Order) => void;
}

export const useGroceryStore = create<GroceryState>()(
  persist(
    (set, get) => ({
      cartItems: [],
      budget: { monthly: 500, spent: 0, remaining: 500 },
      preferences: { dietaryRestrictions: [], favoritesBrands: [] },
      lists: [],
      orders: [],
      
      addToCart: (product, quantity) => 
        set((state) => ({
          cartItems: [...state.cartItems, { ...product, quantity }]
        })),
      
      updateQuantity: (productId, quantity) =>
        set((state) => ({
          cartItems: state.cartItems.map(item =>
            item.id === productId ? { ...item, quantity } : item
          )
        })),
        
      // ... additional methods
    }),
    {
      name: 'grocery-store',
      storage: createJSONStorage(() => localStorage)
    }
  )
);
```

## Custom Hooks Architecture

### Optimized Data Fetching

**useOptimizedTRPC**: `src/client/hooks/useOptimizedTRPC.ts`

```typescript
export function useOptimizedTRPC() {
  const queryClient = useQueryClient();
  
  // Intelligent prefetching strategy
  const prefetchEmailDetails = useCallback((emailId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['emails', 'details', emailId],
      queryFn: () => api.emails.getEmailById.query({ id: emailId }),
      staleTime: 2 * 60 * 1000
    });
  }, [queryClient]);
  
  // Optimized mutation with optimistic updates
  const useOptimisticUpdate = <T>(
    mutationFn: () => Promise<T>,
    queryKey: string[],
    optimisticUpdate: (oldData: any) => any
  ) => {
    return useMutation({
      mutationFn,
      onMutate: async () => {
        await queryClient.cancelQueries({ queryKey });
        const previousData = queryClient.getQueryData(queryKey);
        queryClient.setQueryData(queryKey, optimisticUpdate);
        return { previousData };
      },
      onError: (err, variables, context) => {
        queryClient.setQueryData(queryKey, context?.previousData);
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey });
      }
    });
  };
}
```

### Walmart-Specific Hooks

**useWalmartProducts**: `src/client/hooks/useWalmartProducts.ts`

```typescript
export function useWalmartProducts() {
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  
  // Enhanced product search with caching
  const useProductSearch = (query: string, filters: ProductFilters) => {
    return api.walmartGrocery.searchProducts.useQuery(
      { query, filters },
      {
        enabled: query.length > 2,
        staleTime: 5 * 60 * 1000,
        onSuccess: (data) => {
          // Update search history
          setSearchHistory(prev => 
            [query, ...prev.filter(q => q !== query)].slice(0, 10)
          );
          
          // Track recent products
          setRecentProducts(prev =>
            [...data.products.slice(0, 3), ...prev].slice(0, 20)
          );
        }
      }
    );
  };
  
  return {
    useProductSearch,
    searchHistory,
    recentProducts,
    clearHistory: () => setSearchHistory([])
  };
}
```

## UI Component Library

### Comprehensive Component System

**Core Components** (`src/components/ui/`):

1. **Layout Components**
   - `Card` - Flexible content containers
   - `Sheet` - Sliding panels and overlays
   - `Dialog` - Modal dialogs with accessibility
   - `Tabs` - Tabbed interfaces with keyboard navigation

2. **Form Components**
   - `Input` - Text inputs with validation styling
   - `Select` - Dropdown selections with search
   - `Checkbox` - Custom checkboxes with indeterminate state
   - `RadioGroup` - Radio button groups

3. **Data Display**
   - `Table` - Sortable and filterable data tables
   - `Badge` - Status indicators and labels
   - `Progress` - Progress bars and loading indicators
   - `Avatar` - User profile images and placeholders

4. **Navigation**
   - `Button` - Primary, secondary, and ghost variants
   - `DropdownMenu` - Context menus and actions
   - `Breadcrumb` - Navigation breadcrumbs
   - `Pagination` - Page navigation controls

### Custom Styling System

**Tailwind Configuration**: `tailwind.config.js`

```javascript
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Custom brand colors
        primary: {
          50: '#f0f9ff',
          500: '#3b82f6',
          900: '#1e3a8a'
        },
        walmart: {
          blue: '#0071ce',
          yellow: '#ffc220',
          orange: '#ff6900'
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s infinite'
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography')
  ]
};
```

## Performance Optimization

### Code Splitting Strategy

**Route-Based Splitting**: `src/client/routes/LazyRoutes.tsx`

```typescript
// Lazy load major route components
const Dashboard = lazy(() => import('../components/Dashboard/Dashboard'));
const EmailDashboard = lazy(() => import('../components/Email/EmailDashboard'));
const WalmartAgent = lazy(() => import('../components/WalmartAgent/WalmartGroceryAgent'));
const AgentNetwork = lazy(() => import('../pages/AgentNetwork'));

export const LazyRoutes = () => (
  <Suspense fallback={<SkeletonLoader />}>
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/emails" element={<EmailDashboard />} />
      <Route path="/walmart" element={<WalmartAgent />} />
      <Route path="/agents" element={<AgentNetwork />} />
    </Routes>
  </Suspense>
);
```

### Component-Level Optimization

**Memoized Components**:

```typescript
// Optimize expensive renders
export const EmailRow = React.memo<EmailRowProps>(({ email, onSelect }) => {
  return (
    <div className="email-row" onClick={() => onSelect(email.id)}>
      <span className="truncate">{email.subject}</span>
      <Badge variant={getPriorityVariant(email.priority)}>
        {email.priority}
      </Badge>
    </div>
  );
});

// Memoize selectors for Zustand
const cartItemCount = useGroceryStore(
  useCallback(state => state.cartItems.length, [])
);
```

## Testing Architecture

### Component Testing Strategy

```typescript
// Email Dashboard Tests
describe('EmailDashboard', () => {
  it('renders email table with correct data', async () => {
    const mockEmails = [
      { id: '1', subject: 'Test Email', priority: 'high' }
    ];
    
    render(
      <QueryClientProvider client={testQueryClient}>
        <EmailDashboard />
      </QueryClientProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Test Email')).toBeInTheDocument();
    });
  });
  
  it('handles filtering correctly', async () => {
    // Test filter functionality
  });
});

// Walmart Component Tests
describe('WalmartProductSearch', () => {
  it('searches products and displays results', async () => {
    // Test product search functionality
  });
});
```

## Accessibility Implementation

### WCAG 2.1 Compliance

```typescript
// Accessible component example
export const AccessibleButton: React.FC<ButtonProps> = ({
  children,
  onClick,
  disabled,
  ariaLabel,
  ...props
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      className={cn(
        "focus:outline-none focus:ring-2 focus:ring-blue-500",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};
```

### Keyboard Navigation

- **Tab Order**: Logical focus management
- **Escape Key**: Closes modals and dropdowns
- **Arrow Keys**: Navigation within lists and tables
- **Enter/Space**: Activates buttons and links
- **Screen Reader**: Comprehensive ARIA labels and descriptions

## Responsive Design

### Mobile-First Approach

```typescript
// Responsive grid example
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {products.map(product => (
    <ProductCard key={product.id} product={product} />
  ))}
</div>

// Mobile-optimized navigation
<div className="block md:hidden">
  <MobileNavigation />
</div>
<div className="hidden md:block">
  <DesktopNavigation />
</div>
```

This frontend architecture provides a robust, scalable, and user-friendly interface for enterprise email processing and Walmart grocery automation with comprehensive type safety and performance optimization.