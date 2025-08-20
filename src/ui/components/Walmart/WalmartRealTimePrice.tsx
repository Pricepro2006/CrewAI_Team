/**
 * Walmart Real-Time Price Component
 * Displays live price updates with WebSocket subscription
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useWalmartRealTime } from '../../../client/hooks/useWalmartRealTime';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Alert, AlertDescription } from '../../components/ui/alert';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Bell,
  Store,
  ShoppingCart,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface WalmartRealTimePriceProps {
  productId: string;
  showHistory?: boolean;
  showAlerts?: boolean;
  showStoreAvailability?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const WalmartRealTimePrice: React.FC<WalmartRealTimePriceProps> = ({
  productId,
  showHistory = true,
  showAlerts = true,
  showStoreAvailability = false,
  autoRefresh = true,
  refreshInterval = 60000 // 1 minute default
}) => {
  const {
    product,
    isLoading,
    error,
    priceHistory,
    storeAvailability,
    subscribeToUpdates,
    unsubscribe,
    setPriceAlert,
    refresh,
    addToCart
  } = useWalmartRealTime(productId);

  const [alertPrice, setAlertPrice] = useState<number>(0);
  const [alertType, setAlertType] = useState<'below' | 'above'>('below');
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Subscribe to live updates
  useEffect(() => {
    if (autoRefresh && productId) {
      const subscription = subscribeToUpdates([productId], refreshInterval);
      
      return () => {
        if (subscription) {
          unsubscribe(subscription);
        }
      };
    }
  }, [productId, autoRefresh, refreshInterval, subscribeToUpdates, unsubscribe]);

  // Update last update time
  useEffect(() => {
    if (product) {
      setLastUpdate(new Date(product.lastUpdated));
    }
  }, [product]);

  const handleSetAlert = useCallback(async () => {
    if (alertPrice > 0 && productId) {
      try {
        await setPriceAlert(productId, alertPrice, alertType);
        setShowAlertForm(false);
        setAlertPrice(0);
      } catch (error) {
        console.error('Failed to set price alert:', error);
      }
    }
  }, [productId, alertPrice, alertType, setPriceAlert]);

  const handleAddToCart = useCallback(async () => {
    if (product) {
      try {
        await addToCart(product.productId, 1);
      } catch (error) {
        console.error('Failed to add to cart:', error);
      }
    }
  }, [product, addToCart]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriceChangeIcon = () => {
    if (!product?.priceChange) return null;
    
    if (product.priceChange > 0) {
      return <TrendingUp className="w-4 h-4 text-red-500" />;
    } else if (product.priceChange < 0) {
      return <TrendingDown className="w-4 h-4 text-green-500" />;
    }
    return null;
  };

  const getPriceChangeColor = () => {
    if (!product?.priceChange) return 'text-gray-500';
    return product.priceChange > 0 ? 'text-red-500' : 'text-green-500';
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load price data: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!product) {
    return (
      <Alert>
        <AlertDescription>No product data available</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Price Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg">{product.name}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Price */}
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">
                {formatPrice(product.price)}
              </span>
              {product.wasPrice && (
                <span className="text-sm text-gray-500 line-through">
                  {formatPrice(product.wasPrice)}
                </span>
              )}
            </div>
            {product.priceChange !== undefined && (
              <div className={`flex items-center gap-1 ${getPriceChangeColor()}`}>
                {getPriceChangeIcon()}
                <span className="text-sm font-medium">
                  {Math.abs(product.priceChange).toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {/* Stock Status */}
          <div className="flex items-center justify-between">
            <Badge variant={product.inStock ? 'success' : 'destructive'}>
              {product.inStock ? (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  In Stock
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3 mr-1" />
                  Out of Stock
                </>
              )}
            </Badge>
            {product.stockLevel !== undefined && (
              <span className="text-sm text-gray-500">
                {product.stockLevel} available
              </span>
            )}
          </div>

          {/* Store Location */}
          {product.storeLocation && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Store className="w-4 h-4" />
              <span>{product.storeLocation}</span>
            </div>
          )}

          {/* Last Updated */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            <span>Updated {formatDate(product.lastUpdated)}</span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleAddToCart}
              disabled={!product.inStock}
              className="flex-1"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Add to Cart
            </Button>
            {showAlerts && (
              <Button
                variant="outline"
                onClick={() => setShowAlertForm(!showAlertForm)}
              >
                <Bell className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Price Alert Form */}
      {showAlerts && showAlertForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Set Price Alert</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <select
                value={alertType}
                onChange={(e) => setAlertType(e.target.value as 'below' | 'above')}
                className="px-3 py-2 border rounded-md"
              >
                <option value="below">Below</option>
                <option value="above">Above</option>
              </select>
              <input
                type="number"
                value={alertPrice}
                onChange={(e) => setAlertPrice(parseFloat(e.target.value))}
                placeholder="Target price"
                step="0.01"
                min="0"
                className="flex-1 px-3 py-2 border rounded-md"
              />
            </div>
            <Button onClick={handleSetAlert} className="w-full" size="sm">
              Set Alert
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Price History Chart */}
      {showHistory && priceHistory && priceHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Price History (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart
                data={priceHistory}
                margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  })}
                  stroke="#999"
                  fontSize={12}
                />
                <YAxis
                  tickFormatter={(value) => `$${value}`}
                  stroke="#999"
                  fontSize={12}
                />
                <Tooltip
                  formatter={(value: number) => formatPrice(value)}
                  labelFormatter={(label) => formatDate(label)}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorPrice)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Store Availability */}
      {showStoreAvailability && storeAvailability && storeAvailability.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Store Availability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {storeAvailability.map((store) => (
              <div
                key={store.storeId}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{store.name}</div>
                  <div className="text-xs text-gray-500">{store.address}</div>
                  <div className="text-xs text-gray-500">
                    {store.distance} miles away
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={store.inStock ? 'success' : 'secondary'}>
                    {store.inStock ? `${store.quantity} in stock` : 'Out of stock'}
                  </Badge>
                  <div className="text-sm font-medium mt-1">
                    {formatPrice(store.price)}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};