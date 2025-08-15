/**
 * Walmart Live Pricing Component
 * Displays real-time prices from Walmart.com
 */

import React, { useState, useEffect } from 'react';
import {
  useWalmartPrice,
  useWalmartSearch,
  useNearbyWalmartStores,
  useWalmartPriceMonitor,
  useClearPriceCache,
  useWalmartPricingHealth,
} from '../../hooks/useWalmartPricing.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card.js';
import { Button } from '../../../components/ui/button.js';
import { Input } from '../../../components/ui/input.js';
import { Badge } from '../../../components/ui/badge.js';
import { Alert, AlertDescription } from '../../../components/ui/alert.js';
import { 
  DollarSign, 
  MapPin, 
  Search, 
  RefreshCw, 
  TrendingDown,
  TrendingUp,
  ShoppingCart,
  Store,
  Clock,
  AlertCircle
} from 'lucide-react';

export const WalmartLivePricing: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZip, setSelectedZip] = useState('29301');
  const [monitoredProducts, setMonitoredProducts] = useState<string[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<Array<{
    productId: string;
    message: string;
    type: 'increase' | 'decrease';
    timestamp: Date;
  }>>([]);

  // Hooks
  const health = useWalmartPricingHealth();
  const stores = useNearbyWalmartStores(selectedZip);
  const searchResults = useWalmartSearch(searchQuery, {
    location: { zipCode: selectedZip },
    enabled: searchQuery?.length || 0 > 2,
    limit: 6
  });
  
  const priceMonitor = useWalmartPriceMonitor(monitoredProducts, {
    location: { zipCode: selectedZip },
    autoRefresh: true,
    refreshInterval: 5 * 60 * 1000, // 5 minutes
    onPriceChange: (productId, oldPrice, newPrice) => {
      const change = newPrice - oldPrice;
      const percentChange = ((change / oldPrice) * 100).toFixed(1);
      
      setPriceAlerts(prev => [{
        productId,
        message: `Price ${change > 0 ? 'increased' : 'decreased'} by $${Math.abs(change).toFixed(2)} (${percentChange}%)`,
        type: change > 0 ? 'increase' : 'decrease',
        timestamp: new Date()
      }, ...prev].slice(0, 5)); // Keep last 5 alerts
    }
  });

  const clearCache = useClearPriceCache();

  // Service status indicator
  const getServiceStatus = () => {
    if (!health.data) return { color: 'gray', text: 'Checking...' };
    
    const { services } = health.data;
    if (services?.searxng === 'available') {
      return { color: 'green', text: 'SearXNG Active' };
    } else if (services?.scraper === 'available') {
      return { color: 'yellow', text: 'Web Scraping Active' };
    }
    return { color: 'red', text: 'Limited Functionality' };
  };

  const serviceStatus = getServiceStatus();

  return (
    <div className="walmart-live-pricing space-y-6 p-6">
      {/* Header with Status */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Walmart Live Pricing</h2>
          <p className="text-gray-600">Real-time prices from Walmart.com</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge 
            variant={serviceStatus.color === 'green' ? 'default' : 'secondary'}
            className="flex items-center gap-2"
          >
            <div className={`w-2 h-2 rounded-full bg-${serviceStatus.color}-500 animate-pulse`} />
            {serviceStatus.text}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearCache.mutate()}
            disabled={clearCache.isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${clearCache.isLoading ? 'animate-spin' : ''}`} />
            Clear Cache
          </Button>
        </div>
      </div>

      {/* Location Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Store Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <Input
              placeholder="ZIP Code"
              value={selectedZip}
              onChange={(e: any) => setSelectedZip(e?.target?.value)}
              className="w-32"
            />
            <span className="text-sm text-gray-600">
              {selectedZip === '29301' ? 'Spartanburg, SC (Default)' : 'Custom Location'}
            </span>
          </div>
          
          {stores.data && stores?.data?.stores?.length || 0 > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Nearby Stores:</p>
              {stores?.data?.stores?.map((store, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <Store className="h-4 w-4 text-gray-400" />
                  <span>{store.name}</span>
                  <Badge variant="outline">{store.distance} mi</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search for products..."
              value={searchQuery}
              onChange={(e: any) => setSearchQuery(e?.target?.value)}
              onKeyPress={(e: any) => e.key === 'Enter' && setSearchQuery(e?.currentTarget?.value)}
            />
            <Button disabled={searchResults.isLoading}>
              {searchResults.isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {searchResults.data && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults?.data?.products?.map((product: any) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onMonitor={() => setMonitoredProducts(prev => [...prev, product.id])}
                  isMonitored={monitoredProducts.includes(product.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Price Monitoring */}
      {monitoredProducts?.length || 0 > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Price Monitoring
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {priceMonitor.prices?.map(({ productId, data }) => (
                <div key={productId} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">Product {productId}</p>
                    {data && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-2xl font-bold">${data.price}</span>
                        {data.salePrice && (
                          <Badge variant="destructive">Sale</Badge>
                        )}
                        <Badge variant={data.inStock ? 'default' : 'secondary'}>
                          {data.inStock ? 'In Stock' : 'Out of Stock'}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMonitoredProducts(prev => prev?.filter(id => id !== productId))}
                  >
                    Stop Monitoring
                  </Button>
                </div>
              ))}
            </div>

            {priceMonitor.lastFetch && (
              <p className="text-sm text-gray-500 mt-4">
                Last updated: {priceMonitor?.lastFetch?.toLocaleTimeString()}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Price Alerts */}
      {priceAlerts?.length || 0 > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Price Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {priceAlerts?.map((alert, idx) => (
                <Alert key={idx} variant={alert.type === 'decrease' ? 'default' : 'destructive'}>
                  <div className="flex items-center gap-2">
                    {alert.type === 'decrease' ? (
                      <TrendingDown className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingUp className="h-4 w-4 text-red-600" />
                    )}
                    <AlertDescription>
                      <span className="font-medium">Product {alert.productId}:</span> {alert.message}
                      <span className="text-xs text-gray-500 ml-2">
                        {alert?.timestamp?.toLocaleTimeString()}
                      </span>
                    </AlertDescription>
                  </div>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Product Card Component
const ProductCard: React.FC<{
  product: any;
  onMonitor: () => void;
  isMonitored: boolean;
}> = ({ product, onMonitor, isMonitored }) => {
  const individualPrice = useWalmartPrice(product.id);

  return (
    <div className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
      <h3 className="font-semibold text-sm mb-2 line-clamp-2">{product.name}</h3>
      
      <div className="space-y-2">
        {/* Live Price Display */}
        {individualPrice.data ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-xl font-bold">${individualPrice?.data?.price}</span>
              {individualPrice?.data?.wasPrice && (
                <span className="text-sm line-through text-gray-400">
                  ${individualPrice?.data?.wasPrice}
                </span>
              )}
            </div>
            <Badge variant={individualPrice?.data?.source === 'cache' ? 'secondary' : 'default'}>
              {individualPrice?.data?.source}
            </Badge>
          </div>
        ) : product.livePrice ? (
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">${product?.livePrice?.price}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">${product.price || 'N/A'}</span>
          </div>
        )}

        {/* Stock Status */}
        <div className="flex items-center justify-between">
          <Badge variant={product.inStock ? 'default' : 'secondary'}>
            {product.inStock ? 'In Stock' : 'Out of Stock'}
          </Badge>
          
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onMonitor}
              disabled={isMonitored}
            >
              {isMonitored ? 'Monitoring' : 'Monitor'}
            </Button>
            <Button size="sm">
              <ShoppingCart className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalmartLivePricing;