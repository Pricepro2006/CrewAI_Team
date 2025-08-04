/**
 * Walmart Dashboard Component
 * Main dashboard that integrates all Walmart grocery components
 */

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Search,
  Package,
  TrendingUp,
  Calendar,
  DollarSign,
  Bell,
  History,
  Heart,
  Settings,
  ChevronRight,
  BarChart3,
  Sparkles,
  Clock,
  MapPin,
  Truck,
  Star,
  MessageCircle,
  Filter,
  Grid,
  List,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../../../components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { Separator } from '../../../components/ui/separator';
import { cn } from '../../lib/utils';
import { formatPrice } from '../../lib/utils';

// Import all Walmart components
import { WalmartProductSearch } from './WalmartProductSearch';
import { WalmartShoppingCart } from './WalmartShoppingCart';
import { WalmartProductCard } from './WalmartProductCard';
import { WalmartGroceryList } from './WalmartGroceryList';
import { WalmartPriceTracker } from './WalmartPriceTracker';
import { WalmartDeliveryScheduler } from './WalmartDeliveryScheduler';
import { WalmartDealAlert } from './WalmartDealAlert';
import { WalmartSubstitutionManager } from './WalmartSubstitutionManager';
import { WalmartOrderHistory } from './WalmartOrderHistory';
import { WalmartBudgetTracker } from './WalmartBudgetTracker';
import { WalmartUserPreferences } from './WalmartUserPreferences';
import { WalmartChatInterface } from './WalmartChatInterface';

// Hooks and store
import { useGroceryStore } from '../../store/groceryStore';
import { useCart } from '../../hooks/useCart';
import { useWalmartSearch } from '../../hooks/useWalmartSearch';
import { useWalmartDeals } from '../../hooks/useWalmartDeals';

import type { WalmartProduct, CartItem, Order } from '../../../types/walmart-grocery';
import { normalizePrice, getEffectivePrice, isOnSale, calculateSavings } from '../../../../utils/walmart-price';

interface WalmartDashboardProps {
  className?: string;
}

interface QuickAction {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  badge?: string;
  color?: string;
}

interface DashboardMetric {
  label: string;
  value: string | number;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
}

// Quick stats component
const QuickStats: React.FC = () => {
  const { cart, orders, lists, preferences } = useGroceryStore();
  
  const metrics: DashboardMetric[] = [
    {
      label: 'Cart Value',
      value: formatPrice(cart.items.reduce((sum: number, item: CartItem) => sum + (item.price * item.quantity), 0)),
      icon: ShoppingCart,
      color: 'text-blue-600',
    },
    {
      label: 'Active Lists',
      value: lists.length,
      icon: List,
      color: 'text-green-600',
    },
    {
      label: 'This Month',
      value: formatPrice(
        orders
          .filter((o: Order) => {
            const now = new Date();
            const orderDate = new Date(o.createdAt);
            return orderDate.getMonth() === now.getMonth() && 
                   orderDate.getFullYear() === now.getFullYear();
          })
          .reduce((sum: number, o: Order) => sum + o.totals.total, 0)
      ),
      change: -12,
      icon: TrendingUp,
      color: 'text-purple-600',
    },
    {
      label: 'Saved',
      value: formatPrice(42.50),
      change: 15,
      icon: DollarSign,
      color: 'text-green-600',
    },
  ];
  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold">{metric.value}</p>
                    {metric.change && (
                      <Badge
                        variant={metric.change > 0 ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {metric.change > 0 ? '+' : ''}{metric.change}%
                      </Badge>
                    )}
                  </div>
                </div>
                <div className={cn(
                  "h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center",
                  metric.color
                )}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

// Helper to create mock WalmartProduct
const createMockProduct = (
  id: string,
  name: string,
  regularPrice: number,
  salePrice: number,
  categoryName: string,
  brand: string = 'Generic'
): WalmartProduct => ({
  id,
  walmartId: id,
  name,
  brand,
  category: {
    id: `cat-${categoryName.toLowerCase()}`,
    name: categoryName,
    path: ['Grocery', categoryName],
    level: 2,
  },
  description: `${name} - ${brand}`,
  price: {
    currency: 'USD',
    regular: regularPrice,
    sale: salePrice,
  },
  images: [],
  availability: {
    inStock: true,
    stockLevel: "in_stock" as const,
    quantity: 100,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  metadata: {
    source: "manual" as const,
    dealEligible: salePrice < regularPrice,
    tags: [categoryName.toLowerCase(), brand.toLowerCase()],
  },
});

// Featured deals component
const FeaturedDeals: React.FC = () => {
  const { search: searchProducts } = useWalmartSearch();
  const [deals, setDeals] = useState<WalmartProduct[]>([]);
  
  useEffect(() => {
    // Mock featured deals
    setDeals([
      createMockProduct('deal-1', 'Organic Bananas', 0.69, 0.49, 'Produce', 'Fresh Farms'),
      createMockProduct('deal-2', 'Whole Milk Gallon', 3.99, 2.99, 'Dairy', 'Great Value'),
      createMockProduct('deal-3', 'Fresh Bread', 2.99, 1.99, 'Bakery', 'Wonder'),
    ]);
  }, []);
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Today's Deals
          </CardTitle>
          <Button variant="ghost" size="sm">
            View All
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {deals.map(deal => (
            <div
              key={deal.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded bg-gray-100 flex items-center justify-center">
                  <Package className="h-6 w-6 text-gray-400" />
                </div>
                <div>
                  <p className="font-medium">{deal.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{formatPrice(getEffectivePrice(deal.price))}</span>
                    {isOnSale(deal.price) && (
                      <>
                        <span className="text-xs text-muted-foreground line-through">
                          {formatPrice(normalizePrice(deal.price).regular)}
                        </span>
                        <Badge variant="destructive" className="text-xs">
                          Save {formatPrice(calculateSavings(deal.price))}
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Button size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Recent activity component
const RecentActivity: React.FC = () => {
  const activities = [
    {
      id: '1',
      type: 'order',
      title: 'Order delivered',
      description: 'Order #WM1234 was delivered',
      time: '2 hours ago',
      icon: Truck,
      color: 'text-green-600',
    },
    {
      id: '2',
      type: 'price',
      title: 'Price dropped',
      description: 'Organic Milk is now $0.50 cheaper',
      time: '5 hours ago',
      icon: TrendingUp,
      color: 'text-blue-600',
    },
    {
      id: '3',
      type: 'list',
      title: 'List shared',
      description: 'Weekly Groceries shared with family',
      time: '1 day ago',
      icon: Heart,
      color: 'text-purple-600',
    },
  ];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map(activity => {
            const Icon = activity.icon;
            return (
              <div key={activity.id} className="flex items-start gap-3">
                <div className={cn(
                  "h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mt-0.5",
                  activity.color
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">{activity.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {activity.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activity.time}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full" size="sm">
          View All Activity
        </Button>
      </CardFooter>
    </Card>
  );
};

export const WalmartDashboard: React.FC<WalmartDashboardProps> = ({
  className,
}) => {
  const [activeView, setActiveView] = useState<'dashboard' | 'search' | 'lists' | 'orders' | 'budget' | 'settings'>('dashboard');
  const [showCart, setShowCart] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<WalmartProduct | null>(null);
  
  const { cart, lists, preferences } = useGroceryStore();
  const cartItemCount = cart.items.reduce((sum: number, item: CartItem) => sum + item.quantity, 0);
  
  const quickActions: QuickAction[] = [
    {
      label: 'Quick Reorder',
      icon: History,
      onClick: () => setActiveView('orders'),
      color: 'hover:bg-blue-50 hover:text-blue-600',
    },
    {
      label: 'Browse Deals',
      icon: Sparkles,
      onClick: () => setActiveView('search'),
      color: 'hover:bg-yellow-50 hover:text-yellow-600',
    },
    {
      label: 'Schedule Delivery',
      icon: Calendar,
      onClick: () => {},
      color: 'hover:bg-green-50 hover:text-green-600',
    },
    {
      label: 'Track Budget',
      icon: DollarSign,
      onClick: () => setActiveView('budget'),
      badge: '$257 left',
      color: 'hover:bg-purple-50 hover:text-purple-600',
    },
  ];
  
  return (
    <div className={cn("min-h-screen bg-background", className)}>
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5" />
              Walmart Grocery
            </h1>
            <nav className="hidden md:flex items-center gap-1">
              <Button
                variant={activeView === 'dashboard' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActiveView('dashboard')}
              >
                Dashboard
              </Button>
              <Button
                variant={activeView === 'search' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActiveView('search')}
              >
                Shop
              </Button>
              <Button
                variant={activeView === 'lists' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActiveView('lists')}
              >
                Lists
              </Button>
              <Button
                variant={activeView === 'orders' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActiveView('orders')}
              >
                Orders
              </Button>
              <Button
                variant={activeView === 'budget' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActiveView('budget')}
              >
                Budget
              </Button>
            </nav>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowChat(!showChat)}
            >
              <MessageCircle className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowCart(!showCart)}
              className="relative"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartItemCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {cartItemCount}
                </Badge>
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setActiveView('settings')}>
                  Preferences
                </DropdownMenuItem>
                <DropdownMenuItem>Notifications</DropdownMenuItem>
                <DropdownMenuItem>Help</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Sign Out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="container py-6">
        {activeView === 'dashboard' && (
          <div className="space-y-6">
            {/* Welcome section */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold">Welcome back!</h2>
                <p className="text-muted-foreground">
                  Here's what's happening with your groceries today
                </p>
              </div>
              <Button size="lg">
                <Search className="h-4 w-4 mr-2" />
                Start Shopping
              </Button>
            </div>
            
            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <button
                    key={index}
                    onClick={action.onClick}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-lg border bg-card text-card-foreground transition-colors",
                      action.color
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <div className="text-left flex-1">
                      <p className="font-medium">{action.label}</p>
                      {action.badge && (
                        <p className="text-sm text-muted-foreground">{action.badge}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
            
            {/* Quick Stats */}
            <QuickStats />
            
            {/* Main Grid */}
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <FeaturedDeals />
                <WalmartDealAlert compactMode />
              </div>
              <div className="space-y-6">
                <RecentActivity />
                <WalmartBudgetTracker compactMode />
              </div>
            </div>
            
            {/* Additional Sections */}
            <div className="grid gap-6 md:grid-cols-2">
              <WalmartOrderHistory compactMode />
              <WalmartGroceryList compactMode />
            </div>
          </div>
        )}
        
        {activeView === 'search' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Shop Groceries</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </Button>
                <Button variant="outline" size="sm">
                  <Grid className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <WalmartProductSearch
              onProductSelect={setSelectedProduct}
              autoFocus
            />
            {selectedProduct && (
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <WalmartProductCard
                    product={selectedProduct}
                    showDetails
                  />
                </div>
                <div className="space-y-6">
                  <WalmartSubstitutionManager
                    product={selectedProduct}
                  />
                  <WalmartPriceTracker
                    productId={selectedProduct.id}
                    compactMode
                  />
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeView === 'lists' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">My Lists</h2>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create List
              </Button>
            </div>
            <WalmartGroceryList showCreateButton />
          </div>
        )}
        
        {activeView === 'orders' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Order History</h2>
            <WalmartOrderHistory />
          </div>
        )}
        
        {activeView === 'budget' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Budget Tracker</h2>
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <WalmartBudgetTracker showInsights />
              </div>
              <div>
                <WalmartPriceTracker
                  showChart
                  compactMode
                />
              </div>
            </div>
          </div>
        )}
        
        {activeView === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Settings & Preferences</h2>
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <WalmartUserPreferences />
              </div>
              <div className="space-y-6">
                <WalmartDeliveryScheduler compactMode />
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Delivery Addresses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">Home</p>
                          <p className="text-sm text-muted-foreground">
                            123 Main St, Anytown, USA 12345
                          </p>
                        </div>
                        <Badge>Default</Badge>
                      </div>
                      <Button variant="outline" className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Address
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* Shopping Cart Sheet */}
      <Sheet open={showCart} onOpenChange={setShowCart}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Shopping Cart</SheetTitle>
            <SheetDescription>
              {cartItemCount} items in your cart
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <WalmartShoppingCart />
          </div>
        </SheetContent>
      </Sheet>
      
      {/* Chat Interface Sheet */}
      <Sheet open={showChat} onOpenChange={setShowChat}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Shopping Assistant</SheetTitle>
            <SheetDescription>
              Ask me anything about your groceries
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 h-[calc(100vh-120px)]">
            <WalmartChatInterface />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};