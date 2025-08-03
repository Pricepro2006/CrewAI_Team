import React, { useState } from "react";
import { TrashIcon, PlusIcon, MinusIcon, ShoppingCartIcon, CreditCardIcon } from "@heroicons/react/24/outline";
import { api } from "../../../lib/trpc";
import { useGroceryStore } from "../../../client/store/groceryStore";

export const WalmartShoppingCart: React.FC = () => {
  const { 
    cart, 
    updateCartItemQuantity: updateQuantity, 
    removeFromCart: removeItem, 
    clearCart 
  } = useGroceryStore();
  
  const items = cart.items;
  const getTotal = () => cart.total;
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);

  const checkout = api.walmartGrocery.createOrder.useMutation({
    onSuccess: (data) => {
      // Handle successful checkout
      clearCart();
      alert(`Order placed successfully! Order ID: ${data.order.id}`);
    },
  });

  const applyPromoCode = () => {
    // Mock promo code validation
    if (promoCode === "SAVE10") {
      setDiscount(0.1); // 10% discount
      setAppliedPromo(promoCode);
    } else if (promoCode === "FREESHIP") {
      setDiscount(0); // Free shipping
      setAppliedPromo(promoCode);
    } else {
      alert("Invalid promo code");
    }
  };

  const subtotal = getTotal();
  const tax = subtotal * 0.0825; // 8.25% tax
  const discountAmount = subtotal * discount;
  const shipping = appliedPromo === "FREESHIP" ? 0 : subtotal > 35 ? 0 : 5.99;
  const total = subtotal - discountAmount + tax + shipping;

  const handleCheckout = () => {
    const cartItems = items.map((item: any) => ({
      productId: item.productId,
      quantity: item.quantity,
      price: item.price,
    }));

    checkout.mutate({
      items: cartItems,
      userId: "default-user", // In production, get from auth context
      deliveryAddress: "123 Main St, City, State 12345",
      deliveryDate: new Date().toISOString(),
      deliverySlot: "10:00-12:00",
    });
  };

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <ShoppingCartIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Your cart is empty</h2>
        <p className="text-gray-500 mb-4">Add items to your cart to see them here</p>
        <button
          onClick={() => window.location.href = "/walmart-grocery/search"}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
        >
          Start Shopping
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Cart Items */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <ShoppingCartIcon className="h-6 w-6" />
              Shopping Cart ({items.length} items)
            </h2>
          </div>
          
          <div className="divide-y">
            {items.map((item) => (
              <div key={item.productId} className="p-4 flex gap-4">
                <img
                  src={item.product?.images?.[0]?.url || "/api/placeholder/80/80"}
                  alt={item.product?.name || "Product"}
                  className="w-20 h-20 object-cover rounded"
                />
                
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{item.product?.name || `Product ${item.productId}`}</h3>
                  <p className="text-sm text-gray-500">each</p>
                  <p className="text-lg font-semibold text-blue-600 mt-1">
                    ${item.price.toFixed(2)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.productId, Math.max(0, item.quantity - 1))}
                    className="p-1 rounded border border-gray-300 hover:bg-gray-50"
                  >
                    <MinusIcon className="h-4 w-4" />
                  </button>
                  <span className="font-medium w-8 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    className="p-1 rounded border border-gray-300 hover:bg-gray-50"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center">
                  <p className="font-semibold text-gray-900 mr-3">
                    ${(item.price * item.quantity).toFixed(2)}
                  </p>
                  <button
                    onClick={() => removeItem(item.productId)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Promo Code */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-3">Promo Code</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Enter promo code"
              className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={applyPromoCode}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded font-medium"
            >
              Apply
            </button>
          </div>
          {appliedPromo && (
            <p className="text-sm text-green-600 mt-2">
              Promo code "{appliedPromo}" applied successfully!
            </p>
          )}
        </div>
      </div>

      {/* Order Summary */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-lg shadow p-6 sticky top-4">
          <h3 className="text-xl font-semibold mb-4">Order Summary</h3>
          
          <div className="space-y-2 mb-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount ({(discount * 100).toFixed(0)}%)</span>
                <span>-${discountAmount.toFixed(2)}</span>
              </div>
            )}
            
            <div className="flex justify-between">
              <span className="text-gray-600">Estimated Tax</span>
              <span className="font-medium">${tax.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Shipping</span>
              <span className="font-medium">
                {shipping === 0 ? "FREE" : `$${shipping.toFixed(2)}`}
              </span>
            </div>
            
            {shipping > 0 && (
              <p className="text-sm text-gray-500">
                Free shipping on orders over $35
              </p>
            )}
          </div>
          
          <div className="border-t pt-4 mb-6">
            <div className="flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span className="text-blue-600">${total.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={checkout.isLoading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CreditCardIcon className="h-5 w-5" />
            {checkout.isLoading ? "Processing..." : "Proceed to Checkout"}
          </button>

          <div className="mt-4 text-center text-sm text-gray-500">
            <p>Secure checkout powered by Walmart</p>
          </div>
        </div>
      </div>
    </div>
  );
};