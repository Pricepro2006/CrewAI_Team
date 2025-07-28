import React, { useState } from "react";
import { PlusIcon, MinusIcon, HeartIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolidIcon } from "@heroicons/react/24/solid";
import { api } from "../../../lib/trpc.js";
import { useCartStore } from "../../../client/store/groceryStore.js";
import type { WalmartProduct } from "../../../types/walmart-grocery.js";

interface WalmartProductCardProps {
  product: WalmartProduct;
}

export const WalmartProductCard: React.FC<WalmartProductCardProps> = ({ product }) => {
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { addItem } = useCartStore();

  const addToCart = api.walmartGrocery.addToCart.useMutation({
    onSuccess: () => {
      // Update local cart store
      addItem({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity,
        imageUrl: product.imageUrl,
        unit: product.unit,
      });
      // Reset quantity
      setQuantity(1);
    },
  });

  const handleAddToCart = () => {
    addToCart.mutate({
      productId: product.id,
      quantity,
      userId: "default-user", // In production, get from auth context
    });
  };

  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
    // TODO: Persist favorite status
  };

  const incrementQuantity = () => setQuantity(q => q + 1);
  const decrementQuantity = () => setQuantity(q => Math.max(1, q - 1));

  return (
    <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="relative">
        {/* Product Image */}
        <img
          src={product.imageUrl || "/api/placeholder/200/200"}
          alt={product.name}
          className="w-full h-48 object-cover rounded-t-lg"
        />
        
        {/* Favorite Button */}
        <button
          onClick={toggleFavorite}
          className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-sm hover:shadow-md"
        >
          {isFavorite ? (
            <HeartSolidIcon className="h-5 w-5 text-red-500" />
          ) : (
            <HeartIcon className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {/* Stock Badge */}
        {product.inStock ? (
          product.stock && product.stock < 10 && (
            <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded text-xs">
              Only {product.stock} left
            </div>
          )
        ) : (
          <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs">
            Out of Stock
          </div>
        )}
      </div>

      <div className="p-4">
        {/* Product Name */}
        <h3 className="font-medium text-gray-900 mb-1 line-clamp-2">{product.name}</h3>
        
        {/* Brand */}
        {product.brand && (
          <p className="text-sm text-gray-500 mb-2">{product.brand}</p>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-xl font-bold text-blue-600">
            ${product.price.toFixed(2)}
          </span>
          {product.unit && (
            <span className="text-sm text-gray-500">/ {product.unit}</span>
          )}
          {product.originalPrice && product.originalPrice > product.price && (
            <span className="text-sm text-gray-400 line-through">
              ${product.originalPrice.toFixed(2)}
            </span>
          )}
        </div>

        {/* Quantity Selector */}
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={decrementQuantity}
            className="p-1 rounded border border-gray-300 hover:bg-gray-50"
            disabled={!product.inStock}
          >
            <MinusIcon className="h-4 w-4" />
          </button>
          <span className="font-medium w-8 text-center">{quantity}</span>
          <button
            onClick={incrementQuantity}
            className="p-1 rounded border border-gray-300 hover:bg-gray-50"
            disabled={!product.inStock}
          >
            <PlusIcon className="h-4 w-4" />
          </button>
          <button
            onClick={handleAddToCart}
            disabled={!product.inStock || addToCart.isLoading}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {addToCart.isLoading ? "Adding..." : "Add to Cart"}
          </button>
        </div>

        {/* Product Details Toggle */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
        >
          <InformationCircleIcon className="h-4 w-4" />
          Product Details
        </button>

        {/* Expanded Details */}
        {showDetails && (
          <div className="mt-3 pt-3 border-t text-sm text-gray-600 space-y-1">
            {product.description && (
              <p className="mb-2">{product.description}</p>
            )}
            {product.category && (
              <p><span className="font-medium">Category:</span> {product.category}</p>
            )}
            {product.nutritionInfo && (
              <div>
                <p className="font-medium">Nutrition Info:</p>
                <p className="text-xs">{product.nutritionInfo}</p>
              </div>
            )}
            {product.averageRating && (
              <p>
                <span className="font-medium">Rating:</span> {product.averageRating}/5
                {product.reviewCount && ` (${product.reviewCount} reviews)`}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};