import React, { useMemo, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { ShoppingCart, CheckCircle, AlertCircle } from 'lucide-react';

export interface ProductItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  savings?: number;
  inStock: boolean;
  imageUrl: string;
  category: string;
  unit: string;
}

interface VirtualizedProductListProps {
  items: ProductItem[];
  selectedItems: Set<string>;
  priceAlerts: Map<string, number>;
  onToggleSelection: (itemId: string) => void;
  onSetPriceAlert: (itemId: string, targetPrice: number) => void;
  height?: number;
  itemHeight?: number;
}

// Optimized image component with lazy loading
const OptimizedImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
}> = React.memo(({ src, alt, className = "" }) => {
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);

  const handleLoad = useCallback(() => setLoaded(true), []);
  const handleError = useCallback(() => setError(true), []);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && !error && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
      {error ? (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="w-8 h-8 bg-gray-300 rounded" />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={`transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'} w-full h-full object-cover`}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </div>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

// Memoized product item component for virtual list
const ProductListItem: React.FC<{
  index: number;
  style: React.CSSProperties;
  data: {
    items: ProductItem[];
    selectedItems: Set<string>;
    priceAlerts: Map<string, number>;
    onToggleSelection: (itemId: string) => void;
    onSetPriceAlert: (itemId: string, targetPrice: number) => void;
  };
}> = React.memo(({ index, style, data }) => {
  const { items, selectedItems, priceAlerts, onToggleSelection, onSetPriceAlert } = data;
  const item = items[index];

  if (!item) return null;

  const isSelected = selectedItems.has(item.id);
  const hasAlert = priceAlerts.has(item.id);

  return (
    <div style={style} className="px-4">
      <div className={`
        flex items-center p-4 bg-white rounded-lg border transition-all duration-200
        ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
        ${!item.inStock ? 'opacity-60' : ''}
      `}>
        {/* Product Image */}
        <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
          <OptimizedImage
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full"
          />
          {item.savings && item.savings > 0 && (
            <div className="absolute top-0 right-0 bg-green-500 text-white text-xs px-1 py-0.5 rounded-bl-md">
              Save ${item?.savings?.toFixed(2)}
            </div>
          )}
          {!item.inStock && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <span className="text-white text-xs font-medium">Out of Stock</span>
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="flex-1 ml-4 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{item.name}</h3>
          <p className="text-sm text-gray-500 mt-1">{item.category} • {item.unit}</p>
          
          <div className="flex items-center mt-2">
            <span className="font-semibold text-lg text-gray-900">
              ${item?.price?.toFixed(2)}
            </span>
            {item.originalPrice && (
              <span className="ml-2 text-sm text-gray-400 line-through">
                ${item?.originalPrice?.toFixed(2)}
              </span>
            )}
          </div>

          {hasAlert && (
            <div className="mt-1 text-xs text-blue-600">
              Alert when price drops to ${priceAlerts.get(item.id)!.toFixed(2)}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2 flex-shrink-0">
          <button
            onClick={() => onToggleSelection(item.id)}
            disabled={!item.inStock}
            className={`
              flex items-center space-x-1 px-3 py-2 rounded-md transition-colors
              ${isSelected
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
              ${!item.inStock ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {isSelected ? (
              <CheckCircle size={16} />
            ) : (
              <ShoppingCart size={16} />
            )}
            <span className="text-sm">
              {isSelected ? 'Selected' : 'Add'}
            </span>
          </button>

          <button
            onClick={() => onSetPriceAlert(item.id, item.price * 0.9)}
            className="flex items-center space-x-1 px-3 py-2 bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200 transition-colors"
          >
            <AlertCircle size={16} />
            <span className="text-sm">Alert</span>
          </button>
        </div>
      </div>
    </div>
  );
});

ProductListItem.displayName = 'ProductListItem';

// Main virtualized product list component
export const VirtualizedProductList: React.FC<VirtualizedProductListProps> = React.memo(({
  items,
  selectedItems,
  priceAlerts,
  onToggleSelection,
  onSetPriceAlert,
  height = 600,
  itemHeight = 120
}) => {
  // Memoize the data passed to the virtual list to prevent unnecessary re-renders
  const listData = useMemo(() => ({
    items,
    selectedItems,
    priceAlerts,
    onToggleSelection,
    onSetPriceAlert
  }), [items, selectedItems, priceAlerts, onToggleSelection, onSetPriceAlert]);

  if (!items || items?.length || 0 === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        <p>No products found</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <List
        height={height}
        itemCount={items?.length || 0}
        itemSize={itemHeight}
        itemData={listData}
        overscanCount={5} // Render a few extra items for smooth scrolling
        className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
      >
        {ProductListItem}
      </List>
    </div>
  );
});

VirtualizedProductList.displayName = 'VirtualizedProductList';