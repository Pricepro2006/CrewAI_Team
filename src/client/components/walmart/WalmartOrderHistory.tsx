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
import { Progress } from '../../../components/ui/progress';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { Checkbox } from '../../../components/ui/checkbox';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../components/ui/accordion';
// import { useToast } from '../../../components/ui/use-toast';
// Temporary mock for missing toast hook
const useToast = () => ({ toast: ({ title, description }: { title: string; description: string }) => console.log('Toast:', title, description) });
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
import type { UIOrder, UIOrderItem, UIWalmartProduct } from '../../../types/ui/walmart-ui-types';

interface WalmartOrderHistoryProps {
  onReorder?: (order: UIOrder) => void;
  onTrackOrder?: (orderId: string) => void;
  showFilters?: boolean;
  compactMode?: boolean;
  className?: string;
}

interface OrderStatusInfo {
  label: string;
  icon: React.ElementType;
  color: string;
}

const orderStatusMap: Record<string, OrderStatusInfo> = {
  pending: {
    label: 'Pending',
    icon: Clock,
    color: 'text-yellow-600',
  },
  processing: {
    label: 'Processing',
    icon: Package,
    color: 'text-blue-600',
  },
  shipped: {
    label: 'Shipped',
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
const generateMockOrders = (): UIOrder[] => {
  const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
  const orders: UIOrder[] = [];
  
  for (let i = 0; i < 10; i++) {
    const date = new Date();
    date.setDate(date.getDate() - Math.random() * 90);
    
    const items: UIOrderItem[] = Array.from({ length: Math.floor(Math.random() * 5) + 2 }, (_, j) => {
      const price = 2 + Math.random() * 10;
      const quantity = Math.floor(Math.random() * 3) + 1;
      
      return {
        id: `item-${i}-${j}`,
        productId: `prod-${i}-${j}`,
        name: ['Bananas', 'Milk', 'Bread', 'Eggs', 'Cheese'][j % 5] || 'Unknown Product',
        quantity,
        price,
        total: price * quantity,
        imageUrl: undefined,
        status: 'fulfilled',
        product: {
          id: `prod-${i}-${j}`,
          walmartId: `wm-${i}-${j}`,
          name: ['Bananas', 'Milk', 'Bread', 'Eggs', 'Cheese'][j % 5] || 'Unknown Product',
          brand: 'Generic',
          price,
          currency: 'USD',
          category: 'Grocery',
          imageUrl: '',
          inStock: true,
          unit: ['lb', 'gallon', 'loaf', 'dozen', 'block'][j % 5],
        },
      };
    });
    
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * 0.08;
    const deliveryFee = i % 3 === 0 ? 0 : 4.95;
    const total = subtotal + tax + deliveryFee;
    
    orders.push({
      id: `ORDER-${1000 + i}`,
      orderNumber: `WM${1000 + i}`,
      orderDate: date,
      status: i === 0 ? 'delivered' : (statuses[Math.floor(Math.random() * statuses.length)] || 'pending'),
      total,
      subtotal,
      tax,
      deliveryFee,
      itemCount: items.length,
      deliveryAddress: '123 Main St, San Francisco, CA 94105',
      deliveryDate: new Date(date.getTime() + 86400000 * 2), // 2 days after order
      items,
    });
  }
  
  return orders.sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime());
};

export const WalmartOrderHistory: React.FC<WalmartOrderHistoryProps> = ({
  onReorder,
  onTrackOrder,
  showFilters = true,
  compactMode = false,
  className,
}) => {
  const { toast } = useToast();
  const { addItem } = useCart();
  const [orders] = useState<UIOrder[]>(generateMockOrders());
  const [selectedOrder, setSelectedOrder] = useState<UIOrder | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all');
  const [showReorderDialog, setShowReorderDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesOrderNumber = order.orderNumber.toLowerCase().includes(query);
        const matchesItems = order.items.some((item: UIOrderItem) => 
          item.name.toLowerCase().includes(query)
        );
        if (!matchesOrderNumber && !matchesItems) return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && order.status !== selectedStatus) {
        return false;
      }

      // Date range filter
      if (selectedDateRange !== 'all') {
        const orderDate = order.orderDate;
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
        
        switch (selectedDateRange) {
          case '7days':
            if (daysDiff > 7) return false;
            break;
          case '30days':
            if (daysDiff > 30) return false;
            break;
          case '90days':
            if (daysDiff > 90) return false;
            break;
        }
      }

      return true;
    });
  }, [orders, searchQuery, selectedStatus, selectedDateRange]);

  const handleReorder = (order: UIOrder) => {
    if (onReorder) {
      onReorder(order);
    } else {
      setSelectedOrder(order);
      setSelectedItems(new Set(order.items.map((item: UIOrderItem) => item.id)));
      setShowReorderDialog(true);
    }
  };

  const handleReorderSelected = () => {
    if (!selectedOrder) return;

    const itemsToReorder = selectedOrder.items.filter((item: UIOrderItem) => 
      selectedItems.has(item.id)
    );

    itemsToReorder.forEach((item: UIOrderItem) => {
      if (item.product) {
        // Convert UIWalmartProduct to a minimal product for cart
        const cartProduct = {
          ...item.product,
          price: { 
            currency: item.product.currency, 
            regular: item.product.price 
          },
          availability: { inStock: item.product.inStock },
          category: item.product.category as any,
          description: item.product.description || '',
          images: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        addItem(cartProduct as any);
      }
    });

    toast({
      title: 'Items added to cart',
      description: `${itemsToReorder.length} items from order ${selectedOrder.orderNumber} added to your cart`,
    });

    setShowReorderDialog(false);
  };

  const handleDownloadInvoice = (order: UIOrder) => {
    // Mock download functionality
    toast({
      title: 'Invoice downloaded',
      description: `Invoice for order ${order.orderNumber} has been downloaded`,
    });
  };

  const toggleOrderExpanded = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    const StatusIcon = orderStatusMap[status]?.icon || Clock;
    return <StatusIcon className="h-4 w-4" />;
  };

  const getStatusColor = (status: string) => {
    return orderStatusMap[status]?.color || 'text-gray-600';
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Order History</h2>
          <p className="text-sm text-muted-foreground">
            View and manage your past orders
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export Orders
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="search">Search orders</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Order number or item name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {Object.entries(orderStatusMap).map(([value, info]) => (
                      <SelectItem key={value} value={value}>
                        {info.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateRange">Date Range</Label>
                <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
                  <SelectTrigger id="dateRange">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="7days">Last 7 Days</SelectItem>
                    <SelectItem value="30days">Last 30 Days</SelectItem>
                    <SelectItem value="90days">Last 90 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-8 text-center">
              <History className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 font-semibold">No orders found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery || selectedStatus !== 'all' || selectedDateRange !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Your order history will appear here'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id} className={cn(compactMode && 'p-3')}>
              <CardHeader className={cn('cursor-pointer', compactMode && 'p-3')}
                onClick={() => toggleOrderExpanded(order.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn('rounded-full p-2', 
                      order.status === 'delivered' ? 'bg-green-100' : 'bg-gray-100')}>
                      {getStatusIcon(order.status)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">
                          Order #{order.orderNumber}
                        </CardTitle>
                        <Badge variant="outline" className={getStatusColor(order.status)}>
                          {orderStatusMap[order.status]?.label || order.status}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {order.orderDate.toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {order.itemCount} items
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {formatPrice(order.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!compactMode && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReorder(order);
                          }}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Reorder
                        </Button>
                        {order.status !== 'cancelled' && onTrackOrder && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onTrackOrder(order.id);
                            }}
                          >
                            <Truck className="mr-2 h-4 w-4" />
                            Track
                          </Button>
                        )}
                      </>
                    )}
                    {expandedOrders.has(order.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <Collapsible open={expandedOrders.has(order.id)}>
                <CollapsibleContent>
                  <CardContent className={cn(compactMode && 'p-3 pt-0')}>
                    <Separator className="mb-4" />
                    
                    {/* Order Details */}
                    <div className="mb-4 grid gap-4 text-sm md:grid-cols-2">
                      <div>
                        <h4 className="mb-2 font-medium">Delivery Information</h4>
                        <div className="space-y-1 text-muted-foreground">
                          {order.deliveryAddress && (
                            <p className="flex items-start gap-2">
                              <MapPin className="mt-0.5 h-3 w-3" />
                              <span>{order.deliveryAddress}</span>
                            </p>
                          )}
                          {order.deliveryDate && (
                            <p className="flex items-center gap-2">
                              <Truck className="h-3 w-3" />
                              Delivered on {order.deliveryDate.toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        <h4 className="mb-2 font-medium">Order Summary</h4>
                        <div className="space-y-1 text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>{formatPrice(order.subtotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Tax</span>
                            <span>{formatPrice(order.tax)}</span>
                          </div>
                          {order.deliveryFee !== undefined && order.deliveryFee > 0 && (
                            <div className="flex justify-between">
                              <span>Delivery Fee</span>
                              <span>{formatPrice(order.deliveryFee)}</span>
                            </div>
                          )}
                          <Separator className="my-1" />
                          <div className="flex justify-between font-medium">
                            <span>Total</span>
                            <span>{formatPrice(order.total)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div>
                      <h4 className="mb-3 font-medium">Order Items</h4>
                      <div className="space-y-3">
                        {order.items.map((item: UIOrderItem) => (
                          <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
                            <div className="h-16 w-16 rounded bg-gray-100" />
                            <div className="flex-1">
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {item.quantity} × {formatPrice(item.price)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{formatPrice(item.total)}</p>
                              {item.status === 'substituted' && (
                                <Badge variant="outline" className="text-xs">
                                  Substituted
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReorder(order)}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reorder All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowInvoiceDialog(true);
                        }}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        View Invoice
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(order.orderNumber);
                          toast({
                            title: 'Order number copied',
                            description: `Order #${order.orderNumber} copied to clipboard`,
                          });
                        }}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Order #
                      </Button>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))
        )}
      </div>

      {/* Reorder Dialog */}
      <Dialog open={showReorderDialog} onOpenChange={setShowReorderDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Reorder Items</DialogTitle>
            <DialogDescription>
              Select the items you want to add to your cart
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto py-4">
            {selectedOrder?.items.map((item: UIOrderItem) => (
              <div key={item.id} className="flex items-center space-x-3 py-2">
                <Checkbox
                  checked={selectedItems.has(item.id)}
                  onCheckedChange={(checked) => {
                    const newSelected = new Set(selectedItems);
                    if (checked) {
                      newSelected.add(item.id);
                    } else {
                      newSelected.delete(item.id);
                    }
                    setSelectedItems(newSelected);
                  }}
                />
                <div className="flex-1">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.quantity} × {formatPrice(item.price)}
                  </p>
                </div>
                <p className="font-medium">{formatPrice(item.total)}</p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReorderDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleReorderSelected} disabled={selectedItems.size === 0}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Add {selectedItems.size} Items to Cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Order Invoice</DialogTitle>
            <DialogDescription>
              Order #{selectedOrder?.orderNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedOrder && (
              <div className="space-y-4">
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="font-medium">Order Date</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrder.orderDate.toLocaleDateString()}
                  </p>
                </div>
                <Separator />
                <div className="space-y-2">
                  {selectedOrder.items.map((item: UIOrderItem) => (
                    <div key={item.id} className="flex justify-between">
                      <div>
                        <p>{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} × {formatPrice(item.price)}
                        </p>
                      </div>
                      <p className="font-medium">{formatPrice(item.total)}</p>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatPrice(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span>{formatPrice(selectedOrder.tax)}</span>
                  </div>
                  {selectedOrder.deliveryFee !== undefined && selectedOrder.deliveryFee > 0 && (
                    <div className="flex justify-between">
                      <span>Delivery Fee</span>
                      <span>{formatPrice(selectedOrder.deliveryFee)}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>{formatPrice(selectedOrder.total)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvoiceDialog(false)}>
              Close
            </Button>
            <Button onClick={() => selectedOrder && handleDownloadInvoice(selectedOrder)}>
              <Download className="mr-2 h-4 w-4" />
              Download Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};