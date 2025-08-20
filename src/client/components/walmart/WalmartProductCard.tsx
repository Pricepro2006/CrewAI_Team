/**
 * Walmart Product Card Component
 * Displays individual product with actions, pricing, and deal information
 */

import React, { useState, useCallback } from 'react';
import {
  Package,
  Star,
  ShoppingCart,
  Heart,
  TrendingUp,
  AlertCircle,
  Check,
  Plus,
  Minus,
  Eye,
  Tag,
  Clock,
  Truck,
} from 'lucide-react';
import { Card, CardContent, CardFooter } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip';
import { Input } from '../../../components/ui/input';
import { cn } from '../../lib/utils';
import { formatPrice } from '../../lib/utils';
import { getNumericPrice, calculateSavings } from '../../../utils/walmart-helpers';
import { useCart } from '../../hooks/useCart';
import { useGroceryStore } from '../../store/groceryStore';
import type { WalmartProduct, DealMatch, UserPreferences } from '../../../types/walmart-grocery';

interface WalmartProductCardProps {
  product: WalmartProduct;
  onProductClick?: (product: WalmartProduct) => void;
  onAddToList?: (product: WalmartProduct) => void;
  showActions?: boolean;
  showDetails?: boolean;
  compactMode?: boolean;
  deal?: DealMatch;
  className?: string;
}

export const WalmartProductCard: React.FC<WalmartProductCardProps> = ({
  product,
  onProductClick,
  onAddToList,
  showActions = true,
  showDetails = false,
  compactMode = false,
  deal,
  className,
}) => {
  const { addItem, isInCart, getItemQuantity, updateQuantity } = useCart();
  const { preferences, createPriceAlert } = useGroceryStore();
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [isFavorite, setIsFavorite] = useState(
    preferences?.favoriteProducts?.includes(product.id) ?? false
  );
  const [showPriceAlert, setShowPriceAlert] = useState(false);
  const [targetPrice, setTargetPrice] = useState('');

  const inCart = isInCart(product.id);
  const cartQuantity = getItemQuantity(product.id);

  const handleAddToCart = async () => {
    setIsAdding(true);
    try {
      await addItem(product, quantity);
      setQuantity(1);
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateQuantity = async (newQuantity: number) => {
    if (newQuantity < 1 || newQuantity > 99) return;
    await updateQuantity(product.id, newQuantity);
  };

  const handleToggleFavorite = () => {
    const { updatePreferences, preferences } = useGroceryStore.getState();
    const newFavorites = isFavorite
      ? (preferences?.favoriteProducts?.filter((id: string) => id !== product.id) ?? [])
      : [...(preferences?.favoriteProducts ?? []), product.id];
    
    updatePreferences({ favoriteProducts: newFavorites } as Partial<UserPreferences>);
    setIsFavorite(!isFavorite);
  };

  const handleCreatePriceAlert = () => {
    const target = parseFloat(targetPrice);
    const currentPrice = getNumericPrice(product.price);
    if (target > 0 && target < currentPrice) {
      createPriceAlert(product.id, target);
      setShowPriceAlert(false);
      setTargetPrice('');
    }
  };

  const numericPrice = getNumericPrice(product.price);
  const dealSavings = deal?.savings ?? deal?.potential_savings ?? 0;
  const effectivePrice = deal ? numericPrice - dealSavings : numericPrice;
  const savingsPercentage = deal ? (dealSavings / numericPrice) * 100 : 0;

  if (compactMode) {
    return (
      <Card 
        className={cn(
          "hover:shadow-md transition-shadow cursor-pointer",
          !product.inStock && "opacity-60",
          className
        )}
        onClick={() => onProductClick?.(product)}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-gray-100">
              {product.thumbnailUrl ? (
                <img
                  src={product.thumbnailUrl}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Package className="h-full w-full p-3 text-gray-400" />
              )}
              {deal && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 text-[10px] px-1"
                >
                  -{Math.round(savingsPercentage)}%
                </Badge>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium line-clamp-2">{product.name}</h4>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-bold">{formatPrice(effectivePrice)}</span>
                {deal && (
                  <span className="text-xs text-muted-foreground line-through">
                    {formatPrice(numericPrice)}
                  </span>
                )}
                {product.unit && (
                  <span className="text-xs text-muted-foreground">/ {product.unit}</span>
                )}
              </div>
            </div>

            {showActions && (
              <div className="flex-shrink-0">
                {inCart ? (
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        handleUpdateQuantity(cartQuantity - 1);
                      }}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-sm">{cartQuantity}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        handleUpdateQuantity(cartQuantity + 1);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="h-7"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      handleAddToCart();
                    }}
                    disabled={!product.inStock || isAdding}
                  >
                    <ShoppingCart className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={cn(
        "hover:shadow-lg transition-shadow",
        !product.inStock && "opacity-60",
        className
      )}
    >
      <div className="relative">
        {/* Product Image */}
        <div 
          className="relative aspect-square overflow-hidden bg-gray-100 cursor-pointer"
          onClick={() => onProductClick?.(product)}
        >
          {product.imageUrl || product.thumbnailUrl ? (
            <img
              src={product.imageUrl || product.thumbnailUrl}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <Package className="h-full w-full p-12 text-gray-400" />
          )}
          
          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {deal && (
              <Badge variant="destructive" className="shadow-sm">
                <Tag className="h-3 w-3 mr-1" />
                Save {formatPrice(dealSavings)}
              </Badge>
            )}
            {(product as WalmartProduct & { isOrganic?: boolean }).isOrganic && (
              <Badge variant="secondary" className="shadow-sm">
                Organic
              </Badge>
            )}
            {!product.inStock && (
              <Badge variant="outline" className="bg-white shadow-sm">
                Out of Stock
              </Badge>
            )}
          </div>

          {/* Favorite Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "absolute top-2 right-2 h-8 w-8 bg-white/80 backdrop-blur-sm",
                    isFavorite && "text-red-500"
                  )}
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    handleToggleFavorite();
                  }}
                >
                  <Heart className={cn("h-4 w-4", isFavorite && "fill-current")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Quick View Button */}
        {onProductClick && (
          <Button
            variant="secondary"
            className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 hover:opacity-100 transition-opacity shadow-lg"
            onClick={() => onProductClick(product)}
          >
            <Eye className="h-4 w-4 mr-2" />
            Quick View
          </Button>
        )}
      </div>

      <CardContent className="p-4">
        {/* Product Info */}
        <div className="space-y-2">
          {product.brand && (
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {product.brand}
            </p>
          )}
          
          <h3 
            className="font-medium line-clamp-2 cursor-pointer hover:text-primary"
            onClick={() => onProductClick?.(product)}
          >
            {product.name}
          </h3>

          {/* Rating */}
          {product.ratings !== undefined && (
            <div className="flex items-center gap-1">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "h-3 w-3",
                      i < Math.floor(product.ratings?.average || 0)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                ({product.ratings?.count || 0})
              </span>
            </div>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold">{formatPrice(effectivePrice)}</span>
            {deal && (
              <span className="text-sm text-muted-foreground line-through">
              {formatPrice(numericPrice)}
              </span>
            )}
            {product.unit && (
              <span className="text-sm text-muted-foreground">/ {product.unit}</span>
            )}
          </div>

          {/* Additional Details */}
          {showDetails && (
            <div className="space-y-1 text-sm text-muted-foreground">
              {product.size && <p>Size: {product.size}</p>}
              {product.nutritionalInfo && (
                <div className="flex items-center gap-1">
                  <span>Nutrition Score:</span>
                  <Badge variant="outline" className="text-xs">
                    {product?.nutritionalInfo?.calories ? `${product?.nutritionalInfo?.calories} cal` : 'N/A'}
                  </Badge>
                </div>
              )}
            </div>
          )}

          {/* Stock & Delivery Info */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {product.inStock ? (
              <span className="flex items-center gap-1 text-green-600">
                <Check className="h-3 w-3" />
                In Stock
              </span>
            ) : (
              <span className="flex items-center gap-1 text-red-600">
                <AlertCircle className="h-3 w-3" />
                Out of Stock
              </span>
            )}
            {/* Delivery info could be added here when available */}
          </div>
        </div>
      </CardContent>

      {showActions && (
        <CardFooter className="p-4 pt-0 gap-2">
          {/* Quantity Selector & Add to Cart */}
          {inCart ? (
            <div className="flex items-center gap-2 flex-1">
              <Button
                size="icon"
                variant="outline"
                onClick={() => handleUpdateQuantity(cartQuantity - 1)}
                disabled={cartQuantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                value={cartQuantity}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateQuantity(parseInt(e.target.value) || 1)}
                className="w-16 text-center"
                min={1}
                max={99}
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => handleUpdateQuantity(cartQuantity + 1)}
                disabled={cartQuantity >= 99}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center">{quantity}</span>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setQuantity(Math.min(99, quantity + 1))}
                  disabled={quantity >= 99}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button
                className="flex-1"
                onClick={handleAddToCart}
                disabled={!product.inStock || isAdding}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add to Cart
              </Button>
            </>
          )}

          {/* Secondary Actions */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setShowPriceAlert(!showPriceAlert)}
                >
                  <TrendingUp className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Track Price</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {onAddToList && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => onAddToList(product)}
                  >
                    <Clock className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add to List</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </CardFooter>
      )}

      {/* Price Alert Dialog */}
      {showPriceAlert && (
        <CardFooter className="border-t pt-4">
          <div className="w-full space-y-2">
            <p className="text-sm font-medium">Set Price Alert</p>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Target price"
                value={targetPrice}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetPrice(e.target.value)}
                step="0.01"
                min="0"
              />
              <Button
                size="sm"
                onClick={handleCreatePriceAlert}
                disabled={!targetPrice || parseFloat(targetPrice) >= numericPrice}
              >
                Set Alert
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowPriceAlert(false);
                  setTargetPrice('');
                }}
              >
                Cancel
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Current price: {formatPrice(numericPrice)}
            </p>
          </div>
        </CardFooter>
      )}
    </Card>
  );
};