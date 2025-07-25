/**
 * Walmart Order History Component
 * Displays order history with reorder functionality and tracking
 */

import React, { useState, useMemo } from 'react';
import {
  History,
  Package,
  Truck,
  CheckCircle,
  Clock,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  Calendar,
  Search,
  Filter,
  Download,
  Copy,
  Star,
  MapPin,
  DollarSign,
  ShoppingCart,
  AlertCircle,
  FileText,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Separator } from '../../../components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../../components/ui/collapsible';
import { Calendar as CalendarComponent } from '../../../components/ui/calendar';
import { cn } from '../../lib/utils';
import { formatPrice } from '../../lib/utils';
import { useGroceryStore } from '../../store/groceryStore';
import { useCart } from '../../hooks/useCart';
import type { Order, OrderItem, WalmartProduct } from '../../../types/walmart-grocery';

interface WalmartOrderHistoryProps {
  onReorder?: (order: Order) => void;
  onTrackOrder?: (orderId: string) => void;
  showFilters?: boolean;
  compactMode?: boolean;
  className?: string;
}

interface OrderStatusInfo {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const orderStatusMap: Record<string, OrderStatusInfo> = {
  pending: {
    label: 'Pending',
    icon: Clock,
    color: 'text-yellow-600',
  },
  confirmed: {
    label: 'Confirmed',
    icon: CheckCircle,
    color: 'text-blue-600',
  },
  preparing: {
    label: 'Preparing',
    icon: Package,
    color: 'text-orange-600',
  },
  ready: {
    label: 'Ready',
    icon: CheckCircle,
    color: 'text-indigo-600',
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    icon: Truck,
    color: 'text-purple-600',
  },
  delivered: {
    label: 'Delivered',
    icon: CheckCircle,
    color: 'text-green-600',
  },
  cancelled: {
    label: 'Cancelled',
    icon: AlertCircle,
    color: 'text-red-600',
  },
};

// Generate mock order data
const generateMockOrders = (): Order[] => {
  const statuses = Object.keys(orderStatusMap);
  const orders: Order[] = [];
  
  for (let i = 0; i < 10; i++) {
    const date = new Date();
    date.setDate(date.getDate() - Math.random() * 90);
    
    const items: OrderItem[] = Array.from({ length: Math.floor(Math.random() * 5) + 2 }, (_, j) => ({
      productId: `prod-${i}-${j}`,
      product: {
        id: `prod-${i}-${j}`,
        name: ['Bananas', 'Milk', 'Bread', 'Eggs', 'Cheese'][j % 5],
        price: 2 + Math.random() * 10,
        category: 'Grocery',
        unit: ['lb', 'gallon', 'loaf', 'dozen', 'block'][j % 5],
        inStock: true,
      } as WalmartProduct,
      quantity: Math.floor(Math.random() * 3) + 1,
      price: 2 + Math.random() * 10,
    }));
    
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const status = i === 0 ? 'delivered' : statuses[Math.floor(Math.random() * statuses.length)];
    
    orders.push({
      id: `ORDER-${1000 + i}`,
      userId: 'current-user',
      orderNumber: `WM${1000 + i}`,
      items,
      subtotal,
      tax: subtotal * 0.08,
      fees: 0,
      deliveryFee: i % 3 === 0 ? 0 : 4.95,
      total: subtotal + (subtotal * 0.08) + (i % 3 === 0 ? 0 : 4.95),
      status: status as Order['status'],
      orderDate: date,
      createdAt: date,
      updatedAt: date,
      deliveryAddress: '123 Main St, Anytown, USA 12345',
      deliveryDate: new Date(date.getTime() + 24 * 60 * 60 * 1000),
      deliverySlot: `${9 + (i % 4) * 2}:00 - ${11 + (i % 4) * 2}:00`,
    });
  }
  
  return orders;
};

const OrderCard: React.FC<{
  order: Order;
  onReorder: () => void;
  onTrack: () => void;
  onViewDetails: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  compactMode?: boolean;
}> = ({ order, onReorder, onTrack, onViewDetails, isExpanded, onToggleExpand, compactMode = false }) => {
  const statusInfo = orderStatusMap[order.status] || orderStatusMap.pending;
  const StatusIcon = statusInfo!.icon;
  
  if (compactMode) {
    return (
      <div className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg">
        <div className="flex items-center gap-3">
          <StatusIcon className={cn("h-4 w-4", statusInfo!.color)} />
          <div>
            <p className="text-sm font-medium">Order #{order.orderNumber}</p>
            <p className="text-xs text-muted-foreground">
              {order.createdAt.toLocaleDateString()} • {formatPrice(order.total)}
            </p>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={onReorder}>
          <RotateCcw className="h-3 w-3" />
        </Button>
      </div>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Order #{order.orderNumber}</h3>
              <Badge className={cn("gap-1", statusInfo!.color)} variant="secondary">
                <StatusIcon className="h-3 w-3" />
                {statusInfo!.label}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {order.createdAt.toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                {order.items.length} items
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {formatPrice(order.total)}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {order.status === 'preparing' && (
              <Button size="sm" variant="outline" onClick={onTrack}>
                <MapPin className="h-4 w-4 mr-2" />
                Track
              </Button>
            )}
            <Button size="sm" onClick={onReorder}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reorder
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
        <CollapsibleTrigger>
          <Button
            variant="ghost"
            size="sm"
            className="w-full rounded-none border-t"
          >
            <ChevronDown className={cn(
              "h-4 w-4 mr-2 transition-transform",
              isExpanded && "rotate-180"
            )} />
            {isExpanded ? 'Hide' : 'Show'} Order Details
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-4">
            {/* Delivery Info */}
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <div className="flex items-start gap-3">
                <Truck className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">Delivery Details</p>
                  <p className="text-sm text-muted-foreground">
                    {typeof order.deliveryAddress === 'string' 
                      ? order.deliveryAddress 
                      : order.deliveryAddress 
                        ? `${order.deliveryAddress.street}${order.deliveryAddress.apartment ? `, ${order.deliveryAddress.apartment}` : ''}, ${order.deliveryAddress.city}, ${order.deliveryAddress.state} ${order.deliveryAddress.zipCode}`
                        : 'No address provided'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {order.deliveryDate?.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })} • {order.deliverySlot}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Order Items */}
            <div className="space-y-3">
              <h4 className="font-medium">Order Items</h4>
              {order.items.map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded bg-gray-100 flex items-center justify-center">
                    <Package className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{item.product?.name || 'Unknown Item'}</p>
                    <p className="text-sm text-muted-foreground">
                      Qty: {item.quantity} • {formatPrice(item.price)} each
                    </p>
                  </div>
                  <span className="font-medium">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            
            <Separator className="my-4" />
            
            {/* Order Summary */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax</span>
                <span>{formatPrice(order.tax)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Delivery Fee</span>
                <span>{order.deliveryFee === 0 ? 'FREE' : formatPrice(order.deliveryFee ?? 0)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span>{formatPrice(order.total)}</span>
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="pt-0 gap-2">
            <Button variant="outline" size="sm" className="flex-1">
              <FileText className="h-4 w-4 mr-2" />
              View Receipt
            </Button>
            <Button variant="outline" size="sm" className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Download Invoice
            </Button>
          </CardFooter>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export const WalmartOrderHistory: React.FC<WalmartOrderHistoryProps> = ({
  onReorder,
  onTrackOrder,
  showFilters = true,
  compactMode = false,
  className,
}) => {
  const { orders: storeOrders, addOrder } = useGroceryStore();
  const { addItem } = useCart();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d' | '90d'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'total' | 'status'>('date');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [showTrackingDialog, setShowTrackingDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  // Use mock data if no real orders
  const orders = storeOrders.length > 0 ? storeOrders : generateMockOrders();
  
  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    let filtered = [...orders];
    
    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(order =>
        (order.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        order.items.some(item =>
          item.product?.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }
    
    // Date range filter
    if (dateRange !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      
      switch (dateRange) {
        case '7d':
          cutoff.setDate(now.getDate() - 7);
          break;
        case '30d':
          cutoff.setDate(now.getDate() - 30);
          break;
        case '90d':
          cutoff.setDate(now.getDate() - 90);
          break;
      }
      
      filtered = filtered.filter(order => order.createdAt >= cutoff);
    }
    
    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'total':
          return b.total - a.total;
        case 'status':
          return a.status.localeCompare(b.status);
        case 'date':
        default:
          return b.createdAt.getTime() - a.createdAt.getTime();
      }
    });
    
    return filtered;
  }, [orders, searchQuery, statusFilter, dateRange, sortBy]);
  
  const handleReorder = async (order: Order) => {
    if (onReorder) {
      onReorder(order);
    } else {
      // Add all items to cart
      for (const item of order.items) {
        if (item.product) {
          await addItem(item.product, item.quantity);
        }
      }
    }
  };
  
  const handleTrackOrder = (orderId: string) => {
    const order = orders.find((o: Order) => o.id === orderId);
    if (order) {
      setSelectedOrder(order);
      setShowTrackingDialog(true);
    }
    
    if (onTrackOrder) {
      onTrackOrder(orderId);
    }
  };
  
  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };
  
  // Calculate stats
  const totalSpent = orders.reduce((sum: number, order: Order) => sum + order.total, 0);
  const avgOrderValue = orders.length > 0 ? totalSpent / orders.length : 0;
  const mostOrdered = orders.flatMap((o: Order) => o.items)
    .reduce((acc: Record<string, number>, item: OrderItem) => {
      const name = item.product?.name || 'Unknown';
      acc[name] = (acc[name] || 0) + item.quantity;
      return acc;
    }, {} as Record<string, number>);
  const topProduct = Object.entries(mostOrdered)
    .sort(([, a]: [string, number], [, b]: [string, number]) => b - a)[0];
  
  if (compactMode) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Recent Orders
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          {filteredOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No orders found
            </p>
          ) : (
            <div className="space-y-1">
              {filteredOrders.slice(0, 5).map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onReorder={() => handleReorder(order)}
                  onTrack={() => handleTrackOrder(order.id)}
                  onViewDetails={() => {}}
                  isExpanded={false}
                  onToggleExpand={() => {}}
                  compactMode
                />
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="pt-3">
          <Button variant="outline" className="w-full" size="sm">
            View All Orders
          </Button>
        </CardFooter>
      </Card>
    );
  }
  
  return (
    <>
      <div className={cn("space-y-6", className)}>
        {/* Header and Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                  <p className="text-2xl font-bold">{formatPrice(totalSpent)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Average Order</p>
                  <p className="text-2xl font-bold">{formatPrice(avgOrderValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Star className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Most Ordered</p>
                  <p className="text-lg font-bold truncate">
                    {topProduct ? `${topProduct[0]} (${topProduct[1]}x)` : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Filters */}
        {showFilters && (
          <Card>
            <CardHeader>
              <CardTitle>Order History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search orders..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {Object.entries(orderStatusMap).map(([value, info]) => (
                      <SelectItem key={value} value={value}>
                        {info.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Date Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="total">Total</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Orders List */}
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <History className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-lg font-medium mb-1">No orders found</p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery || statusFilter !== 'all' || dateRange !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Your order history will appear here'}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onReorder={() => handleReorder(order)}
                onTrack={() => handleTrackOrder(order.id)}
                onViewDetails={() => toggleOrderExpand(order.id)}
                isExpanded={expandedOrders.has(order.id)}
                onToggleExpand={() => toggleOrderExpand(order.id)}
              />
            ))
          )}
        </div>
      </div>
      
      {/* Tracking Dialog */}
      <Dialog open={showTrackingDialog} onOpenChange={setShowTrackingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Track Order #{selectedOrder?.orderNumber}</DialogTitle>
            <DialogDescription>
              Real-time tracking for your delivery
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Mock tracking steps */}
            <div className="space-y-3">
              {[
                { step: 'Order Placed', time: '10:30 AM', completed: true },
                { step: 'Preparing', time: '11:15 AM', completed: true },
                { step: 'Out for Delivery', time: '12:45 PM', completed: true },
                { step: 'Arriving Soon', time: 'Est. 1:30 PM', completed: false },
              ].map((step, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center",
                    step.completed
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {step.completed ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <span className="text-xs">{index + 1}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={cn(
                      "font-medium",
                      !step.completed && "text-muted-foreground"
                    )}>
                      {step.step}
                    </p>
                    <p className="text-sm text-muted-foreground">{step.time}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <Separator />
            
            {/* Driver info */}
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Truck className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Your driver is on the way</p>
                <p className="text-sm text-muted-foreground">
                  Driver: John D. • Vehicle: White Toyota Camry
                </p>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTrackingDialog(false)}>
              Close
            </Button>
            <Button>
              <MapPin className="h-4 w-4 mr-2" />
              View on Map
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};