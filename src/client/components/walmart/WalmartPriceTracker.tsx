/**
 * Walmart Price Tracker Component
 * Advanced price tracking with animated charts, alerts, and historical data
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Bell,
  BellOff,
  ChartLine,
  Calendar,
  DollarSign,
  AlertTriangle,
  Info,
  Settings,
  Download,
  Share2,
  Target,
  Sparkles,
  History,
  ChevronUp,
  ChevronDown,
  Check,
  X,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../../components/ui/card.js';
import { Button } from '../../../components/ui/button.js';
import { Badge } from '../../../components/ui/badge.js';
import { Input } from '../../../components/ui/input.js';
import { Label } from '../../../components/ui/label.js';
import { Switch } from '../../../components/ui/switch.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs.js';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip.js';
import { Slider } from '../../../components/ui/slider.js';
import { cn } from '../../lib/utils.js';
import { formatPrice } from '../../lib/utils.js';
import { useGroceryStore } from '../../store/groceryStore.js';
import type { WalmartProduct, PriceAlert, PriceHistory } from '../../../types/walmart-grocery.js';

interface WalmartPriceTrackerProps {
  product?: WalmartProduct;
  productId?: string;
  onCreateAlert?: (alert: PriceAlert) => void;
  showChart?: boolean;
  compactMode?: boolean;
  className?: string;
}

interface PricePoint {
  date: Date;
  price: number;
  event?: 'sale' | 'increase' | 'decrease';
}

// Mock price history data generator
const generatePriceHistory = (currentPrice: number): PricePoint[] => {
  const points: PricePoint[] = [];
  const days = 90;
  let price = currentPrice;
  
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    // Add some randomness to price
    const change = (Math.random() - 0.5) * 2;
    price = Math.max(currentPrice * 0.7, Math.min(currentPrice * 1.3, price + change));
    
    // Add occasional events
    let event: PricePoint['event'] | undefined;
    if (Math.random() < 0.1) {
      if (price < currentPrice * 0.85) event = 'sale';
      else if (price > currentPrice * 1.1) event = 'increase';
      else if (i > 0 && points.length > 0) {
        const lastPoint = points[points.length - 1];
        if (lastPoint && price < lastPoint.price) {
          event = 'decrease';
        }
      }
    }
    
    points.push({ date, price, event });
  }
  
  // Ensure last point is current price
  if (points.length > 0) {
    const lastPoint = points[points.length - 1];
    if (lastPoint) {
      lastPoint.price = currentPrice;
    }
  }
  
  return points;
};

const PriceChart: React.FC<{
  data: PricePoint[];
  height?: number;
  showEvents?: boolean;
}> = ({ data, height = 200, showEvents = true }) => {
  const maxPrice = Math.max(...data.map(d => d.price));
  const minPrice = Math.min(...data.map(d => d.price));
  const priceRange = maxPrice - minPrice || 1;
  
  const points = data.map((point, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = ((maxPrice - point.price) / priceRange) * (height - 40) + 20;
    return { x, y, point };
  });
  
  const pathData = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');
  
  return (
    <div className="relative" style={{ height }}>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(y => (
          <line
            key={y}
            x1="0"
            x2="100"
            y1={(y / 100) * height}
            y2={(y / 100) * height}
            stroke="currentColor"
            strokeOpacity="0.1"
            strokeWidth="0.5"
          />
        ))}
        
        {/* Price line */}
        <path
          d={pathData}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        
        {/* Area under line */}
        <path
          d={`${pathData} L 100 ${height} L 0 ${height} Z`}
          fill="hsl(var(--primary))"
          fillOpacity="0.1"
        />
        
        {/* Event markers */}
        {showEvents && points.map((p, i) => {
          if (!p.point.event) return null;
          
          return (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r="3"
                fill={
                  p.point.event === 'sale' ? 'hsl(var(--success))' :
                  p.point.event === 'increase' ? 'hsl(var(--destructive))' :
                  'hsl(var(--warning))'
                }
              />
              {p.point.event === 'sale' && (
                <text
                  x={p.x}
                  y={p.y - 5}
                  textAnchor="middle"
                  className="text-[6px] fill-current text-success font-medium"
                >
                  SALE
                </text>
              )}
            </g>
          );
        })}
      </svg>
      
      {/* Price labels */}
      <div className="absolute top-2 left-2 text-xs text-muted-foreground">
        {formatPrice(maxPrice)}
      </div>
      <div className="absolute bottom-2 left-2 text-xs text-muted-foreground">
        {formatPrice(minPrice)}
      </div>
    </div>
  );
};

export const WalmartPriceTracker: React.FC<WalmartPriceTrackerProps> = ({
  product,
  productId,
  onCreateAlert,
  showChart = true,
  compactMode = false,
  className,
}) => {
  const { priceAlerts, createPriceAlert, deletePriceAlert } = useGroceryStore();
  
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [targetPrice, setTargetPrice] = useState('');
  const [alertType, setAlertType] = useState<'below' | 'above'>('below');
  const [alertFrequency, setAlertFrequency] = useState<'once' | 'daily' | 'weekly'>('once');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  
  // Mock data - handle ProductPrice type properly
  const currentPrice = typeof product?.price === 'number' 
    ? product.price 
    : (typeof product?.price === 'object' && product?.price !== null && 'regular' in product.price)
      ? (product.price as { regular: number }).regular
      : 29.99;
  const priceHistory = useMemo(() => generatePriceHistory(currentPrice), [currentPrice]);
  
  const filteredHistory = useMemo(() => {
    const now = new Date();
    const cutoff = new Date();
    
    switch (selectedTimeRange) {
      case '7d':
        cutoff.setDate(now.getDate() - 7);
        break;
      case '30d':
        cutoff.setDate(now.getDate() - 30);
        break;
      case '90d':
        cutoff.setDate(now.getDate() - 90);
        break;
      default:
        return priceHistory;
    }
    
    return priceHistory.filter(p => p.date >= cutoff);
  }, [priceHistory, selectedTimeRange]);
  
  const stats = useMemo(() => {
    const prices = filteredHistory.map(p => p.price);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const current = prices[prices.length - 1] ?? 0;
    const previous = prices[prices.length - 2] ?? current;
    const change = current - previous;
    const changePercent = previous > 0 ? (change / previous) * 100 : 0;
    
    return { avg, min, max, current, change, changePercent };
  }, [filteredHistory]);
  
  const existingAlert = priceAlerts.find(
    (alert: PriceAlert) => alert.productId === (productId || product?.id)
  );
  
  const handleCreateAlert = () => {
    const target = parseFloat(targetPrice);
    if (target > 0 && (productId || product?.id)) {
      const alert = {
        productId: (productId || product?.id)!,
        targetPrice: target,
        // Additional properties would be set by the store
      };
      
      createPriceAlert((productId || product?.id)!, target);
      onCreateAlert?.(alert as PriceAlert);
      
      setShowAlertDialog(false);
      setTargetPrice('');
    }
  };
  
  const handleExport = (format: 'csv' | 'json') => {
    const data = filteredHistory.map(p => ({
      date: p.date.toISOString(),
      price: p.price,
      event: p.event || '',
    }));
    
    let content: string;
    let filename: string;
    let type: string;
    
    if (format === 'csv') {
      content = 'Date,Price,Event\n' + 
        data.map(d => `${d.date},${d.price},${d.event}`).join('\n');
      filename = `price-history-${product?.name || 'product'}.csv`;
      type = 'text/csv';
    } else {
      content = JSON.stringify(data, null, 2);
      filename = `price-history-${product?.name || 'product'}.json`;
      type = 'application/json';
    }
    
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    
    setShowExportDialog(false);
  };
  
  if (compactMode) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ChartLine className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{formatPrice(currentPrice)}</span>
              <Badge
                variant={stats.change >= 0 ? "destructive" : "success"}
                className="text-xs"
              >
                {stats.change >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                {Math.abs(stats.changePercent).toFixed(1)}%
              </Badge>
            </div>
            <Button
              size="sm"
              variant={existingAlert ? "secondary" : "outline"}
              onClick={() => setShowAlertDialog(true)}
            >
              {existingAlert ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
            </Button>
          </div>
          {showChart && (
            <PriceChart data={filteredHistory} height={80} showEvents={false} />
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
              <ChartLine className="h-5 w-5" />
              Price Tracker
              {product && (
                <Badge variant="outline" className="ml-2">
                  {product.name}
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedTimeRange} onValueChange={(value: any) => setSelectedTimeRange(value)}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 days</SelectItem>
                  <SelectItem value="30d">30 days</SelectItem>
                  <SelectItem value="90d">90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowExportDialog(true)}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Current Price & Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Current Price</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{formatPrice(stats.current)}</span>
                <Badge
                  variant={stats.change >= 0 ? "destructive" : "success"}
                  className="text-xs"
                >
                  {stats.change >= 0 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {Math.abs(stats.changePercent).toFixed(1)}%
                </Badge>
              </div>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Average</p>
              <p className="text-xl font-semibold">{formatPrice(stats.avg)}</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Lowest</p>
              <p className="text-xl font-semibold text-green-600">{formatPrice(stats.min)}</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Highest</p>
              <p className="text-xl font-semibold text-red-600">{formatPrice(stats.max)}</p>
            </div>
          </div>
          
          {/* Price Chart */}
          {showChart && (
            <div className="border rounded-lg p-4">
              <PriceChart data={filteredHistory} height={200} />
            </div>
          )}
          
          {/* Price Alerts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Price Alerts
              </h3>
              <Button
                size="sm"
                onClick={() => setShowAlertDialog(true)}
                disabled={!productId && !product}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Alert
              </Button>
            </div>
            
            {existingAlert ? (
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-2 w-2 rounded-full",
                    existingAlert ? "bg-green-500" : "bg-gray-400"
                  )} />
                  <div>
                    <p className="font-medium">
                      Alert when price drops below {formatPrice(existingAlert.targetPrice)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Current: {formatPrice(currentPrice)}
                      {currentPrice <= existingAlert.targetPrice && (
                        <Badge variant="success" className="ml-2 text-xs">
                          Target Reached!
                        </Badge>
                      )}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deletePriceAlert(existingAlert.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="text-center py-6 border rounded-lg bg-muted/50">
                <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No price alerts set for this product
                </p>
              </div>
            )}
          </div>
          
          {/* Insights */}
          <div className="space-y-2">
            <h3 className="font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Price Insights
            </h3>
            <div className="space-y-2">
              {stats && stats.current < stats.avg && (
                <div className="flex items-start gap-2 p-2 bg-green-50 dark:bg-green-950 rounded-lg">
                  <Info className="h-4 w-4 text-green-600 mt-0.5" />
                  <p className="text-sm">
                    Current price is <span className="font-medium">{formatPrice(stats.avg - stats.current)}</span> below average
                  </p>
                </div>
              )}
              {stats.current === stats.min && (
                <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <Target className="h-4 w-4 text-blue-600 mt-0.5" />
                  <p className="text-sm">
                    Price is at its <span className="font-medium">lowest point</span> in the selected period
                  </p>
                </div>
              )}
              {stats.changePercent < -5 && (
                <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <p className="text-sm">
                    Price dropped <span className="font-medium">{Math.abs(stats.changePercent).toFixed(1)}%</span> recently
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Create Alert Dialog */}
      <Dialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Price Alert</DialogTitle>
            <DialogDescription>
              Get notified when the price meets your target
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Alert Type</Label>
              <Select value={alertType} onValueChange={(value: any) => setAlertType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="below">Price drops below</SelectItem>
                  <SelectItem value="above">Price rises above</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Target Price</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Current price: {formatPrice(currentPrice)}
              </p>
            </div>
            
            <div>
              <Label>Notification Frequency</Label>
              <Select value={alertFrequency} onValueChange={(value: any) => setAlertFrequency(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">Once</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAlertDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateAlert}
              disabled={!targetPrice || parseFloat(targetPrice) <= 0}
            >
              Create Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Price History</DialogTitle>
            <DialogDescription>
              Download price history data for analysis
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleExport('csv')}
            >
              <Download className="h-4 w-4 mr-2" />
              Export as CSV
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleExport('json')}
            >
              <Download className="h-4 w-4 mr-2" />
              Export as JSON
            </Button>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};