/**
 * Enhanced Walmart Product Card Component
 * Includes all interaction handlers: favorites, grocery list, comparison, sharing, quick view
 */

import React, { useState, useEffect } from "react";
import { 
  PlusIcon, 
  MinusIcon, 
  HeartIcon, 
  InformationCircleIcon,
  ShareIcon,
  ScaleIcon,
  EyeIcon,
  ClipboardDocumentListIcon,
  BellIcon,
  CheckCircleIcon,
  TruckIcon,
  StarIcon
} from "@heroicons/react/24/outline";
import { 
  HeartIcon as HeartSolidIcon,
  StarIcon as StarSolidIcon
} from "@heroicons/react/24/solid";
import { api } from "../../../lib/trpc.js";
import { useGroceryStore } from "../../../client/store/groceryStore.js";
import type { WalmartProduct } from "../../../types/walmart-grocery.js";

interface WalmartProductCardEnhancedProps {
  product: WalmartProduct;
  onCompare?: (product: WalmartProduct) => void;
  onQuickView?: (product: WalmartProduct) => void;
  inComparisonMode?: boolean;
  isCompared?: boolean;
}

export const WalmartProductCardEnhanced: React.FC<WalmartProductCardEnhancedProps> = ({ 
  product, 
  onCompare,
  onQuickView,
  inComparisonMode = false,
  isCompared = false
}) => {
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showPriceAlert, setShowPriceAlert] = useState(false);
  const [targetPrice, setTargetPrice] = useState("");
  const [isAddedToList, setIsAddedToList] = useState(false);
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState("");
  
  const { 
    addToCart: addToCartStore,
    lists,
    currentListId,
    addToList,
    preferences,
    updatePreferences,
    createPriceAlert
  } = useGroceryStore();

  // Track product view
  const trackView = api?.cart?.trackView.useMutation();
  
  // Price alert mutation
  const setPriceAlert = api?.priceAlerts?.createAlert.useMutation({
    onSuccess: () => {
      showNotification("Price alert set successfully!");
      setShowPriceAlert(false);
      setTargetPrice("");
    }
  });

  // Initialize favorite status from preferences
  useEffect(() => {
    if (preferences.favoriteProducts?.includes(product.id)) {
      setIsFavorite(true);
    }
  }, [preferences.favoriteProducts, product.id]);

  // Track product view on mount
  useEffect(() => {
    const sessionId = localStorage.getItem("walmart-session") || `session-${Date.now()}`;
    if (!localStorage.getItem("walmart-session")) {
      localStorage.setItem("walmart-session", sessionId);
    }
    
    trackView.mutate({
      productId: product.id,
      sessionId,
      interactionType: "view"
    });
  }, [product.id]);

  const showNotification = (message: string) => {
    setNotificationMessage(message);
    setTimeout(() => setNotificationMessage(""), 3000);
  };

  const handleAddToGroceryList = () => {
    const listId = selectedList || currentListId || lists[0]?.id;
    
    if (!listId) {
      showNotification("Please create a grocery list first");
      return;
    }
    
    addToList(listId, product, quantity);
    setIsAddedToList(true);
    showNotification(`Added to ${lists.find(l => l.id === listId)?.name || "grocery list"}`);
    
    // Reset after animation
    setTimeout(() => setIsAddedToList(false), 2000);
  };

  const toggleFavorite = () => {
    const newFavoriteStatus = !isFavorite;
    setIsFavorite(newFavoriteStatus);
    
    const updatedFavorites = newFavoriteStatus
      ? [...(preferences.favoriteProducts || []), product.id]
      : (preferences.favoriteProducts || []).filter(id => id !== product.id);
    
    updatePreferences({ favoriteProducts: updatedFavorites });
    showNotification(newFavoriteStatus ? "Added to favorites" : "Removed from favorites");
  };

  const handleShare = (method: "copy" | "email" | "sms") => {
    const shareUrl = `https://walmart.com/product/${product.id}`;
    const shareText = `Check out ${product.name} for $${product.price} at Walmart`;
    
    switch (method) {
      case "copy":
        navigator?.clipboard?.writeText(shareUrl);
        showNotification("Link copied to clipboard!");
        break;
      case "email":
        window.open(`mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareUrl)}`);
        break;
      case "sms":
        window.open(`sms:?body=${encodeURIComponent(`${shareText} ${shareUrl}`)}`);
        break;
    }
    
    setShowShareMenu(false);
  };

  const handleSetPriceAlert = () => {
    if (!targetPrice || isNaN(Number(targetPrice))) {
      showNotification("Please enter a valid target price");
      return;
    }
    
    const target = Number(targetPrice);
    const currentPrice = typeof product.price === "number" 
      ? product.price 
      : product?.price?.sale || product?.price?.regular;
    
    if (target >= currentPrice) {
      showNotification("Target price should be lower than current price");
      return;
    }
    
    createPriceAlert(product.id, target);
    setPriceAlert.mutate({
      productId: product.id,
      productName: product.name,
      currentPrice,
      targetPrice: target,
      userId: "current-user"
    });
  };

  const handleCompare = () => {
    if (onCompare) {
      onCompare(product);
    }
  };

  const handleQuickView = () => {
    const sessionId = localStorage.getItem("walmart-session") || "";
    trackView.mutate({
      productId: product.id,
      sessionId,
      interactionType: "quick_view"
    });
    
    if (onQuickView) {
      onQuickView(product);
    }
  };

  const incrementQuantity = () => setQuantity(q => Math.min(99, q + 1));
  const decrementQuantity = () => setQuantity(q => Math.max(1, q - 1));

  const currentPrice = typeof product.price === "number" 
    ? product.price 
    : product?.price?.sale || product?.price?.regular;
    
  const originalPrice = typeof product.price === "object" && product?.price?.wasPrice
    ? product?.price?.wasPrice
    : product.originalPrice;
    
  const savings = originalPrice && originalPrice > currentPrice 
    ? originalPrice - currentPrice 
    : 0;
    
  const savingsPercent = originalPrice && originalPrice > currentPrice
    ? Math.round((savings / originalPrice) * 100)
    : 0;

  return (
    <div className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 relative ${
      inComparisonMode ? "ring-2 ring-blue-500" : ""
    } ${isCompared ? "bg-blue-50" : ""}`}>
      {/* Notification Toast */}
      {notificationMessage && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-50 
                        bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg 
                        flex items-center gap-2 animate-slide-down">
          <CheckCircleIcon className="h-5 w-5" />
          {notificationMessage}
        </div>
      )}

      <div className="relative">
        {/* Product Image */}
        <img
          src={product.imageUrl || "/api/placeholder/200/200"}
          alt={product.name}
          className="w-full h-48 object-cover rounded-t-lg cursor-pointer"
          onClick={handleQuickView}
        />
        
        {/* Action Buttons Row */}
        <div className="absolute top-2 right-2 flex gap-2">
          {/* Favorite Button */}
          <button
            onClick={toggleFavorite}
            className="p-2 bg-white rounded-full shadow-sm hover:shadow-md transition-shadow"
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            {isFavorite ? (
              <HeartSolidIcon className="h-5 w-5 text-red-500" />
            ) : (
              <HeartIcon className="h-5 w-5 text-gray-400 hover:text-red-500" />
            )}
          </button>

          {/* Quick View Button */}
          <button
            onClick={handleQuickView}
            className="p-2 bg-white rounded-full shadow-sm hover:shadow-md transition-shadow"
            title="Quick view"
          >
            <EyeIcon className="h-5 w-5 text-gray-400 hover:text-blue-600" />
          </button>

          {/* Compare Button */}
          {onCompare && (
            <button
              onClick={handleCompare}
              className={`p-2 bg-white rounded-full shadow-sm hover:shadow-md transition-shadow ${
                isCompared ? "ring-2 ring-blue-500" : ""
              }`}
              title="Compare products"
            >
              <ScaleIcon className={`h-5 w-5 ${
                isCompared ? "text-blue-600" : "text-gray-400 hover:text-blue-600"
              }`} />
            </button>
          )}
        </div>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-2">
          {/* Stock Badge */}
          {product.inStock ? (
            product.stock && product.stock < 10 && (
              <div className="bg-yellow-500 text-white px-2 py-1 rounded text-xs">
                Only {product.stock} left
              </div>
            )
          ) : (
            <div className="bg-red-500 text-white px-2 py-1 rounded text-xs">
              Out of Stock
            </div>
          )}
          
          {/* Savings Badge */}
          {savingsPercent > 0 && (
            <div className="bg-green-500 text-white px-2 py-1 rounded text-xs font-bold">
              Save {savingsPercent}%
            </div>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* Product Name */}
        <h3 className="font-medium text-gray-900 mb-1 line-clamp-2 cursor-pointer hover:text-blue-600"
            onClick={handleQuickView}>
          {product.name}
        </h3>
        
        {/* Brand & Category */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          {product.brand && <span>{product.brand}</span>}
          {product.brand && product.category && <span>•</span>}
          {product.category && (
            <span>{typeof product.category === "string" ? product.category : product?.category?.name}</span>
          )}
        </div>

        {/* Rating */}
        {product.rating && (
          <div className="flex items-center gap-1 mb-2">
            {[...Array(5)].map((_, i) => (
              <StarSolidIcon 
                key={i} 
                className={`h-4 w-4 ${
                  i < Math.floor(product.rating || 0) ? "text-yellow-400" : "text-gray-200"
                }`} 
              />
            ))}
            <span className="text-sm text-gray-600">
              {product.rating} {product.reviewCount && `(${product.reviewCount})`}
            </span>
          </div>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-xl font-bold text-blue-600">
            ${currentPrice.toFixed(2)}
          </span>
          {product.unit && (
            <span className="text-sm text-gray-500">/ {product.unit}</span>
          )}
          {originalPrice && originalPrice > currentPrice && (
            <>
              <span className="text-sm text-gray-400 line-through">
                ${originalPrice.toFixed(2)}
              </span>
              <span className="text-sm text-green-600 font-medium">
                Save ${savings.toFixed(2)}
              </span>
            </>
          )}
        </div>

        {/* Delivery Info */}
        {product.deliveryInfo && (
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
            <TruckIcon className="h-4 w-4" />
            <span>{product.deliveryInfo}</span>
          </div>
        )}

        {/* Quantity Selector & Add to List */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center border rounded">
            <button
              onClick={decrementQuantity}
              className="p-2 hover:bg-gray-50"
              disabled={!product.inStock}
            >
              <MinusIcon className="h-4 w-4" />
            </button>
            <span className="px-3 font-medium">{quantity}</span>
            <button
              onClick={incrementQuantity}
              className="p-2 hover:bg-gray-50"
              disabled={!product.inStock}
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
          
          <button
            onClick={handleAddToGroceryList}
            disabled={!product.inStock}
            className={`flex-1 py-2 px-4 rounded font-medium transition-all ${
              isAddedToList 
                ? "bg-green-600 text-white" 
                : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            }`}
          >
            {isAddedToList ? (
              <>
                <CheckCircleIcon className="h-5 w-5 inline mr-2" />
                Added!
              </>
            ) : (
              <>
                <ClipboardDocumentListIcon className="h-5 w-5 inline mr-2" />
                Add to List
              </>
            )}
          </button>
        </div>

        {/* Action Buttons Row */}
        <div className="flex gap-2 mb-3">
          {/* Share Button */}
          <div className="relative">
            <button
              onClick={() => setShowShareMenu(!showShareMenu)}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600"
            >
              <ShareIcon className="h-4 w-4" />
              Share
            </button>
            
            {showShareMenu && (
              <div className="absolute bottom-full left-0 mb-2 bg-white border rounded-lg shadow-lg p-2 z-10">
                <button
                  onClick={() => handleShare("copy")}
                  className="block w-full text-left px-3 py-1 text-sm hover:bg-gray-50 rounded"
                >
                  Copy Link
                </button>
                <button
                  onClick={() => handleShare("email")}
                  className="block w-full text-left px-3 py-1 text-sm hover:bg-gray-50 rounded"
                >
                  Email
                </button>
                <button
                  onClick={() => handleShare("sms")}
                  className="block w-full text-left px-3 py-1 text-sm hover:bg-gray-50 rounded"
                >
                  Text Message
                </button>
              </div>
            )}
          </div>

          {/* Price Alert Button */}
          <button
            onClick={() => setShowPriceAlert(!showPriceAlert)}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600"
          >
            <BellIcon className="h-4 w-4" />
            Price Alert
          </button>

          {/* Product Details Toggle */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600"
          >
            <InformationCircleIcon className="h-4 w-4" />
            Details
          </button>
        </div>

        {/* Price Alert Setup */}
        {showPriceAlert && (
          <div className="mb-3 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium mb-2">Set price alert</p>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                value={targetPrice}
                onChange={(e: any) => setTargetPrice(e?.target?.value)}
                placeholder={`Below $${currentPrice.toFixed(2)}`}
                className="flex-1 px-2 py-1 border rounded text-sm"
              />
              <button
                onClick={handleSetPriceAlert}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Set Alert
              </button>
            </div>
          </div>
        )}

        {/* Expanded Details */}
        {showDetails && (
          <div className="mt-3 pt-3 border-t text-sm text-gray-600 space-y-2">
            {product.description && (
              <p className="mb-2">{product.description}</p>
            )}
            
            {product.size && (
              <p><span className="font-medium">Size:</span> {product.size}</p>
            )}
            
            {product.ingredients && (
              <div>
                <p className="font-medium">Ingredients:</p>
                <p className="text-xs">{product.ingredients}</p>
              </div>
            )}
            
            {product.nutritionalInfo && (
              <div>
                <p className="font-medium">Nutrition Info:</p>
                <div className="text-xs grid grid-cols-2 gap-1 mt-1">
                  {Object.entries(product.nutritionalInfo).map(([key, value]) => (
                    <div key={key}>
                      <span className="capitalize">{key}:</span> {value}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {product.allergens && product?.allergens?.length > 0 && (
              <div>
                <p className="font-medium text-red-600">Allergens:</p>
                <p className="text-xs">{product?.allergens?.join(", ")}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};