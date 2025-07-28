/**
 * Walmart Shopping Cart Component
 * Manages shopping cart with real-time updates, deal matching, and checkout
 */

import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Tag,
  AlertCircle,
  CheckCircle,
  Package,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../../components/ui/card.js';
import { Button } from '../../../components/ui/button.js';
import { Badge } from '../../../components/ui/badge.js';
import { Separator } from '../../../components/ui/separator.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../components/ui/dialog.js';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip.js';
import { Input } from '../../../components/ui/input.js';
import { useCart } from '../../hooks/useCart.js';
import { useWalmartDeals } from '../../hooks/useWalmartDeals.js';
import { formatPrice } from '../../lib/utils.js';
import type { WalmartProduct, CartItem, DealMatch } from '../../../types/walmart-grocery.js';

interface WalmartShoppingCartProps {
  onCheckout?: () => void;
  showDeals?: boolean;
  compactMode?: boolean;
  maxHeight?: string;
}

interface CartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
  deal?: DealMatch;
  compactMode?: boolean;
}

const CartItemRow: React.FC<CartItemRowProps> = ({
  item,
  onUpdateQuantity,
  onRemove,
  deal,
  compactMode = false,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [quantity, setQuantity] = useState(item.quantity);

  const handleQuantityChange = async (newQuantity: number) => {
    if (newQuantity < 1 || newQuantity > 99) return;
    
    setIsUpdating(true);
    setQuantity(newQuantity);
    await onUpdateQuantity(newQuantity);
    setIsUpdating(false);
  };

  const itemTotal = deal
    ? item.quantity * (item.price - deal.savings)
    : item.quantity * item.price;

  if (compactMode) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.product?.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatPrice(item.price)} × {item.quantity}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => handleQuantityChange(quantity - 1)}
            disabled={isUpdating || quantity <= 1}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-8 text-center text-sm">{quantity}</span>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => handleQuantityChange(quantity + 1)}
            disabled={isUpdating || quantity >= 99}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="group relative">
      <div className="flex items-start gap-4 py-4">
        {/* Product Image */}
        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
          {item.product?.thumbnailUrl ? (
            <img
              src={item.product.thumbnailUrl}
              alt={item.product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <Package className="h-full w-full p-4 text-gray-400" />
          )}
          {!item.product?.inStock && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-xs text-white font-medium">Out of Stock</span>
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="flex-1 space-y-1">
          <h4 className="text-sm font-medium line-clamp-2">{item.product?.name}</h4>
          {item.product?.brand && (
            <p className="text-xs text-muted-foreground">{item.product.brand}</p>
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{formatPrice(item.price)}</span>
            {item.product?.unit && (
              <span className="text-xs text-muted-foreground">/ {item.product.unit}</span>
            )}
            {deal && (
              <Badge variant="success" className="text-xs">
                <Tag className="h-3 w-3 mr-1" />
                Save {formatPrice(deal.savings)}
              </Badge>
            )}
          </div>
        </div>

        {/* Quantity Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-none"
              onClick={() => handleQuantityChange(quantity - 1)}
              disabled={isUpdating || quantity <= 1}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
              className="h-8 w-12 rounded-none border-x-0 text-center"
              min={1}
              max={99}
              disabled={isUpdating}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-none"
              onClick={() => handleQuantityChange(quantity + 1)}
              disabled={isUpdating || quantity >= 99}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Item Total & Actions */}
        <div className="flex flex-col items-end gap-2">
          <span className="text-sm font-medium">{formatPrice(itemTotal)}</span>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export const WalmartShoppingCart: React.FC<WalmartShoppingCartProps> = ({
  onCheckout,
  showDeals = true,
  compactMode = false,
  maxHeight = '600px',
}) => {
  const {
    items,
    totalItems,
    subtotal,
    updateQuantity,
    removeItem,
    clearCart,
    loading,
  } = useCart();

  const { deals, totalSavings, analyzingDeals } = useWalmartDeals(
    items.map(item => item.productId)
  );

  const [showClearDialog, setShowClearDialog] = useState(false);
  const [promoCode, setPromoCode] = useState('');

  const tax = subtotal * 0.0825; // 8.25% tax rate
  const total = subtotal + tax - totalSavings;

  const handleCheckout = () => {
    if (onCheckout) {
      onCheckout();
    }
  };

  if (compactMode) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Cart ({totalItems})
            </CardTitle>
            {totalItems > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowClearDialog(true)}
              >
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Your cart is empty
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <CartItemRow
                  key={item.productId}
                  item={item}
                  onUpdateQuantity={(qty) => updateQuantity(item.productId, qty)}
                  onRemove={() => removeItem(item.productId)}
                  deal={deals[item.productId]?.[0]}
                  compactMode
                />
              ))}
            </div>
          )}
        </CardContent>
        {items.length > 0 && (
          <CardFooter className="pt-3">
            <div className="w-full space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total</span>
                <span className="font-medium">{formatPrice(total)}</span>
              </div>
              <Button
                className="w-full"
                onClick={handleCheckout}
                disabled={loading || totalItems === 0}
              >
                Checkout
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-6 w-6" />
              Shopping Cart
              {totalItems > 0 && (
                <Badge variant="secondary">{totalItems} items</Badge>
              )}
            </CardTitle>
            {totalItems > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowClearDialog(true)}
              >
                Clear Cart
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">Your cart is empty</p>
              <p className="text-sm text-muted-foreground">
                Add items to get started with your grocery shopping
              </p>
            </div>
          ) : (
            <div
              className="space-y-0 divide-y overflow-y-auto"
              style={{ maxHeight }}
            >
              {items.map((item) => (
                <CartItemRow
                  key={item.productId}
                  item={item}
                  onUpdateQuantity={(qty) => updateQuantity(item.productId, qty)}
                  onRemove={() => removeItem(item.productId)}
                  deal={deals[item.productId]?.[0]}
                />
              ))}
            </div>
          )}

          {items.length > 0 && (
            <>
              <Separator className="my-6" />

              {/* Promo Code */}
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter promo code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                  />
                  <Button variant="secondary">Apply</Button>
                </div>

                {/* Order Summary */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>

                  {showDeals && totalSavings > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span className="flex items-center gap-1">
                        <Tag className="h-4 w-4" />
                        Deal Savings
                      </span>
                      <span>-{formatPrice(totalSavings)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span>Estimated Tax</span>
                    <span>{formatPrice(tax)}</span>
                  </div>

                  <Separator />

                  <div className="flex justify-between text-lg font-medium">
                    <span>Total</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                </div>

                {/* Savings Alert */}
                {showDeals && totalSavings > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-green-900">
                        You're saving {formatPrice(totalSavings)}!
                      </p>
                      <p className="text-green-700">
                        {Object.keys(deals).length} items have active deals
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>

        {items.length > 0 && (
          <CardFooter>
            <Button
              className="w-full"
              size="lg"
              onClick={handleCheckout}
              disabled={loading || totalItems === 0}
            >
              Proceed to Checkout
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Clear Cart Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Shopping Cart?</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove all items from your cart? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowClearDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                clearCart();
                setShowClearDialog(false);
              }}
            >
              Clear Cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};