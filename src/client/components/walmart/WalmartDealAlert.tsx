/**
 * Walmart Deal Alert Component
 * Real-time deal notifications with animated alerts and smart recommendations
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  BellOff,
  Tag,
  TrendingDown,
  Clock,
  Sparkles,
  ChevronRight,
  X,
  Settings,
  ShoppingCart,
  Zap,
  Star,
  Filter,
  Check,
  AlertCircle,
  Package,
  Percent,
  Gift,
  Timer,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../../components/ui/card.js';
import { Button } from '../../../components/ui/button.js';
import { Badge } from '../../../components/ui/badge.js';
import { Switch } from '../../../components/ui/switch.js';
import { Label } from '../../../components/ui/label.js';
import { Slider } from '../../../components/ui/slider.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../components/ui/dialog.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs.js';
import type { DealType, DealNotification, AlertSettings } from '../../../types/walmart-grocery.js';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip.js';
import { cn, formatPrice } from '../../lib/utils.js';
import { useCart } from '../../hooks/useCart.js';
import type { DealMatch, WalmartProduct } from '../../../types/walmart-grocery.js';
import { createMinimalProduct, getNumericPrice } from '../../../utils/walmart-product.js';

interface WalmartDealAlertProps {
  deals?: DealMatch[];
  onDealClick?: (deal: DealMatch) => void;
  onAddToCart?: (product: WalmartProduct) => void;
  showSettings?: boolean;
  compactMode?: boolean;
  className?: string;
}

// Extended interfaces for local use
interface ExtendedDealNotification {
  id: string;
  dealId: string;
  userId: string;
  sent?: boolean;
  sentAt?: Date;
  opened?: boolean;
  clicked?: boolean;
  // Additional local properties
  productName?: string;
  currentPrice?: number;
  expiresAt?: Date;
  isNew?: boolean;
  dealType?: DealType | string;
  savings: number;
  originalPrice?: number;
  product?: WalmartProduct;
  productId?: string;
  dealName?: string;
  price?: number;
  category?: string;
  discount?: number;
  validUntil?: Date;
  title?: string;
  message?: string;
  timestamp?: Date;
  isRead?: boolean;
  priority?: 'low' | 'medium' | 'high';
}

interface ExtendedAlertSettings extends AlertSettings {
  // Additional local properties
  enabled: boolean;
  minSavings: number;
  minPercentage: number;
  alertTypes: string[];
  frequency: 'instant' | 'daily' | 'weekly';
}

// Animated notification component
const DealNotificationCard: React.FC<{
  notification: ExtendedDealNotification;
  onDismiss: (id: string) => void;
  onAction: (notification: ExtendedDealNotification) => void;
  isAnimating?: boolean;
}> = ({ notification, onDismiss, onAction, isAnimating = false }) => {
  const timeLeft = notification.expiresAt
    ? Math.max(0, notification.expiresAt.getTime() - Date.now())
    : null;
  
  const hours = timeLeft ? Math.floor(timeLeft / (1000 * 60 * 60)) : 0;
  const minutes = timeLeft ? Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60)) : 0;
  
  const getDealIcon = () => {
    switch (notification.dealType) {
      case 'percentage':
        return TrendingDown;
      case 'fixed':
        return Tag;
      case 'bogo':
        return Zap;
      case 'bundle':
        return Gift;
      default:
        return TrendingDown;
    }
  };
  
  const Icon = getDealIcon();
  
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card transition-all duration-500",
        isAnimating && "animate-slide-in-right",
        notification.isNew && "ring-2 ring-primary ring-offset-2"
      )}
    >
      {/* Deal type indicator */}
      <div className={cn(
        "absolute top-0 left-0 h-full w-1",
        notification.dealType === 'percentage' && "bg-green-500",
        notification.dealType === 'fixed' && "bg-red-500",
        notification.dealType === 'bogo' && "bg-orange-500",
        notification.dealType === 'bundle' && "bg-purple-500"
      )} />
      
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full",
            notification.dealType === 'FLASH_SALE' && "bg-orange-100 text-orange-600",
            notification.dealType === 'CLEARANCE' && "bg-red-100 text-red-600",
            (notification.dealType === 'BUNDLE' || notification.dealType === 'bundle') && "bg-purple-100 text-purple-600",
            notification.dealType === 'PRICE_DROP' && "bg-green-100 text-green-600",
            notification.dealType === 'percentage' && "bg-green-100 text-green-600",
            notification.dealType === 'fixed' && "bg-blue-100 text-blue-600",
            notification.dealType === 'bogo' && "bg-orange-100 text-orange-600"
          )}>
            <Icon className="h-5 w-5" />
          </div>
          
          <div className="flex-1 space-y-1">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium line-clamp-1">
                  {notification.productName}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {notification.dealType ? notification.dealType.replace('_', ' ') : 'Deal'}
                  </Badge>
                  <span className="text-sm font-medium text-green-600">
                    Save {formatPrice(notification.savings)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({notification.originalPrice ? Math.round((notification.savings / notification.originalPrice) * 100) : 0}% off)
                  </span>
                </div>
              </div>
              
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 -mt-1 -mr-1"
                onClick={() => onDismiss(notification.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Price comparison */}
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold">
                {formatPrice(notification.currentPrice || getNumericPrice(notification.product?.price) || 0)}
              </span>
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(notification.originalPrice || 0)}
              </span>
            </div>
            
            {/* Expiration timer */}
            {timeLeft !== null && timeLeft > 0 && (
              <div className="flex items-center gap-1 text-xs text-orange-600">
                <Timer className="h-3 w-3" />
                <span>
                  Ends in {hours > 0 ? `${hours}h ` : ''}{minutes}m
                </span>
              </div>
            )}
            
            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                size="sm"
                className="h-7"
                onClick={() => onAction(notification)}
              >
                <ShoppingCart className="h-3 w-3 mr-1" />
                Add to Cart
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                onClick={() => onAction(notification)}
              >
                View Deal
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* New indicator */}
      {notification.isNew && (
        <div className="absolute top-2 right-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
          </span>
        </div>
      )}
    </div>
  );
};

// Deal categories with icons
const dealCategories = [
  { id: 'grocery', label: 'Grocery', icon: Package },
  { id: 'produce', label: 'Produce', icon: Package },
  { id: 'dairy', label: 'Dairy', icon: Package },
  { id: 'meat', label: 'Meat & Seafood', icon: Package },
  { id: 'bakery', label: 'Bakery', icon: Package },
  { id: 'frozen', label: 'Frozen', icon: Package },
];

export const WalmartDealAlert: React.FC<WalmartDealAlertProps> = ({
  deals = [],
  onDealClick,
  onAddToCart,
  showSettings = true,
  compactMode = false,
  className,
}) => {
  const { addItem } = useCart();
  const [notifications, setNotifications] = useState<ExtendedDealNotification[]>([]);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [settings, setSettings] = useState<ExtendedAlertSettings>({
    enabled: true,
    threshold: 10,
    minSavings: 5,
    minPercentage: 20,
    categories: ['grocery', 'produce'],
    alertTypes: ['price-drop', 'flash-sale'],
    frequency: 'instant',
  });
  const [filter, setFilter] = useState<'all' | 'active' | 'expired'>('all');
  
  // Simulate receiving new deal notifications
  useEffect(() => {
    if (!settings.enabled) return;
    
    const interval = setInterval(() => {
      // Mock new deal notification
      const originalPrice = 10 + Math.random() * 20;
      const currentPrice = 5 + Math.random() * 10;
      const savings = originalPrice - currentPrice;
      
      const mockDeals: ExtendedDealNotification[] = [
        {
          id: `deal-${Date.now()}`,
          dealId: `DEAL-${Math.random().toString(36).substr(2, 9)}`,
          dealName: 'Special Deal',
          productId: `prod-${Math.random().toString(36).substr(2, 9)}`,
          dealType: ['PRICE_DROP', 'FLASH_SALE', 'CLEARANCE', 'BUNDLE'][Math.floor(Math.random() * 4)] as DealType,
          discount: savings,
          savings,
          validUntil: new Date(Date.now() + Math.random() * 24 * 60 * 60 * 1000),
          userId: 'current-user',
          title: 'Great Deal Available!',
          message: 'Limited time offer',
          timestamp: new Date(),
          isRead: false,
          priority: 'medium' as const,
          originalPrice,
          category: 'Grocery',
        },
      ];
      
      const newDeal = mockDeals[0];
      if (
        newDeal &&
        newDeal.savings >= settings.minSavings &&
        newDeal.originalPrice &&
        ((newDeal.savings / newDeal.originalPrice) * 100) >= settings.minPercentage
      ) {
        setNotifications((prev: ExtendedDealNotification[]) => [newDeal, ...prev].slice(0, 10));
        
        // Mark as not new after animation
        setTimeout(() => {
          setNotifications((prev: ExtendedDealNotification[]) =>
            prev.map((n: ExtendedDealNotification) => n.id === newDeal.id ? { ...n, isNew: false } : n)
          );
        }, 3000);
      }
    }, 30000); // Every 30 seconds for demo
    
    return () => clearInterval(interval);
  }, [settings]);
  
  const handleDismiss = (id: string) => {
    setNotifications((prev: ExtendedDealNotification[]) => prev.filter((n: ExtendedDealNotification) => n.id !== id));
  };
  
  const handleAction = async (notification: ExtendedDealNotification) => {
    if (onAddToCart && notification.product) {
      onAddToCart(notification.product);
    } else if (onAddToCart) {
      // Convert notification to product if no product attached
      const product = createMinimalProduct({
        id: notification.productId || notification.dealId,
        name: notification.dealName || 'Unknown Product',
        price: notification.price || notification.product?.price || 0,
        originalPrice: notification.originalPrice,
        category: notification.category,
        unit: 'each',
        inStock: true,
      });
      onAddToCart(product);
    } else {
      // Use built-in cart
      const product = createMinimalProduct({
        id: notification.productId || notification.dealId,
        name: notification.dealName || 'Unknown Product',
        price: notification.price || notification.product?.price || 0,
        originalPrice: notification.originalPrice,
        category: notification.category,
        unit: 'each',
        inStock: true,
      });
      await addItem(product);
    }
    
    if (onDealClick) {
      onDealClick(notification as any);
    }
  };
  
  const filteredNotifications = notifications.filter((n: ExtendedDealNotification) => {
    if (filter === 'active') {
      return !n.expiresAt || n.expiresAt > new Date();
    } else if (filter === 'expired') {
      return n.expiresAt && n.expiresAt <= new Date();
    }
    return true;
  });
  
  const activeDealsCount = notifications.filter(
    (n: ExtendedDealNotification) => !n.expiresAt || n.expiresAt > new Date()
  ).length;
  
  if (compactMode) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Deal Alerts
              {activeDealsCount > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {activeDealsCount}
                </Badge>
              )}
            </CardTitle>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked: boolean) =>
                setSettings((prev: ExtendedAlertSettings) => ({ ...prev, enabled: checked }))
              }
            />
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          {filteredNotifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No active deals at the moment
            </p>
          ) : (
            <div className="space-y-2">
              {filteredNotifications.slice(0, 3).map(notification => (
                <div
                  key={notification.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                >
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {notification.productName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Save {formatPrice(notification.savings)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => handleAction(notification)}
                  >
                    <ShoppingCart className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
  
  return (
    <>
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Deal Alerts
              {activeDealsCount > 0 && (
                <Badge variant="destructive" className="animate-pulse">
                  {activeDealsCount} Active
                </Badge>
              )}
            </CardTitle>
            
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="alerts-toggle" className="text-sm">
                        Alerts
                      </Label>
                      <Switch
                        id="alerts-toggle"
                        checked={settings.enabled}
                        onCheckedChange={(checked: boolean) =>
                          setSettings((prev: ExtendedAlertSettings) => ({ ...prev, enabled: checked }))
                        }
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {settings.enabled ? 'Alerts enabled' : 'Alerts disabled'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {showSettings && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSettingsDialog(true)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Alert Status */}
          {!settings.enabled && (
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <BellOff className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-medium">Deal alerts are disabled</p>
                <p className="text-sm text-muted-foreground">
                  Enable alerts to get notified about new deals
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setSettings((prev: ExtendedAlertSettings) => ({ ...prev, enabled: true }))}
              >
                Enable
              </Button>
            </div>
          )}
          
          {/* Filter Tabs */}
          <Tabs value={filter} onValueChange={(value: string) => setFilter(value as 'all' | 'active' | 'expired')}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all" className="text-xs">
                All ({filteredNotifications.length})
              </TabsTrigger>
              <TabsTrigger value="active" className="text-xs">
                Active ({activeDealsCount})
              </TabsTrigger>
              <TabsTrigger value="expired" className="text-xs">
                Expired ({notifications.length - activeDealsCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {/* Notifications List */}
          <div className="space-y-3">
            {filteredNotifications.length === 0 ? (
              <div className="text-center py-12">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-lg font-medium mb-1">No deals yet</p>
                <p className="text-sm text-muted-foreground">
                  {settings.enabled
                    ? "We'll notify you when great deals become available"
                    : "Enable alerts to start receiving deal notifications"}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notification, index) => (
                <DealNotificationCard
                  key={notification.id}
                  notification={notification}
                  onDismiss={handleDismiss}
                  onAction={handleAction}
                  isAnimating={notification.isNew && index === 0}
                />
              ))
            )}
          </div>
          
          {/* Quick Stats */}
          {notifications.length > 0 && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {formatPrice(
                    notifications.reduce((sum, n) => sum + n.savings, 0)
                  )}
                </p>
                <p className="text-sm text-muted-foreground">Total Savings</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {Math.round(
                    notifications.reduce(
                      (sum, n) => sum + (n.originalPrice ? (n.savings / n.originalPrice) * 100 : 0),
                      0
                    ) / notifications.length
                  )}%
                </p>
                <p className="text-sm text-muted-foreground">Avg. Discount</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Deal Alert Settings</DialogTitle>
            <DialogDescription>
              Customize when and how you receive deal notifications
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Minimum Savings */}
            <div className="space-y-2">
              <Label>Minimum Savings Amount</Label>
              <div className="flex items-center gap-3">
                <Slider
                  value={[settings.minSavings]}
                  onValueChange={([value]: number[]) =>
                    setSettings((prev: ExtendedAlertSettings) => ({ ...prev, minSavings: value || 1 }))
                  }
                  min={1}
                  max={50}
                  step={1}
                  className="flex-1"
                />
                <span className="w-16 text-sm font-medium">
                  {formatPrice(settings.minSavings)}
                </span>
              </div>
            </div>
            
            {/* Minimum Percentage */}
            <div className="space-y-2">
              <Label>Minimum Discount Percentage</Label>
              <div className="flex items-center gap-3">
                <Slider
                  value={[settings.minPercentage]}
                  onValueChange={(value: number[]) =>
                    setSettings((prev: ExtendedAlertSettings) => ({ ...prev, minPercentage: value[0] || 1 }))
                  }
                  min={5}
                  max={75}
                  step={5}
                  className="flex-1"
                />
                <span className="w-12 text-sm font-medium">
                  {settings.minPercentage}%
                </span>
              </div>
            </div>
            
            {/* Alert Types */}
            <div className="space-y-2">
              <Label>Alert Types</Label>
              <div className="space-y-2">
                {[
                  { id: 'price-drop', label: 'Price Drops', icon: TrendingDown },
                  { id: 'flash-sale', label: 'Flash Sales', icon: Zap },
                  { id: 'clearance', label: 'Clearance', icon: Tag },
                  { id: 'bundle', label: 'Bundle Deals', icon: Gift },
                ].map(({ id, label, icon: Icon }) => (
                  <div key={id} className="flex items-center space-x-2">
                    <Switch
                      id={id}
                      checked={settings.alertTypes.includes(id as any)}
                      onCheckedChange={(checked: boolean) => {
                        setSettings((prev: ExtendedAlertSettings) => ({
                          ...prev,
                          alertTypes: checked
                            ? [...prev.alertTypes, id]
                            : prev.alertTypes.filter((t: string) => t !== id),
                        }));
                      }}
                    />
                    <Label
                      htmlFor={id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Notification Frequency */}
            <div className="space-y-2">
              <Label>Notification Frequency</Label>
              <Select
                value={settings.frequency}
                onValueChange={(value: string) =>
                  setSettings((prev: ExtendedAlertSettings) => ({ ...prev, frequency: value as 'instant' | 'daily' | 'weekly' }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instant">Instant</SelectItem>
                  <SelectItem value="daily">Daily Digest</SelectItem>
                  <SelectItem value="weekly">Weekly Summary</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowSettingsDialog(false)}>
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};