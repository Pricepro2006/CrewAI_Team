import React, { useState, useEffect } from "react";
import { MagnifyingGlassIcon, SparklesIcon, ShoppingCartIcon, WifiIcon } from "@heroicons/react/24/outline";
import { trpc } from "../../../utils/trpc";
import { WalmartProductCard } from "./WalmartProductCard.js";
import type { WalmartProduct } from "../../../types/walmart-grocery.js";
import { useWebSocketSingleton } from "../../hooks/useWebSocketSingleton.js";
import axios from "axios";

interface NLPResult {
  intent: string;
  confidence: number;
  items: string[];
  quantities: string[];
  action: string;
  products?: Array<{
    id: string;
    name: string;
    brand: string;
    price: number;
    inStock: boolean;
  }>;
}

export const WalmartNLPSearch: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<WalmartProduct[]>([]);
  const [nlpResult, setNlpResult] = useState<NLPResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showNLPInsight, setShowNLPInsight] = useState(false);
  const [cartItems, setCartItems] = useState<string[]>([]);

  // WebSocket connection with stable singleton
  const { isConnected, send } = useWebSocketSingleton({
    autoConnect: true,
    subscriberId: 'walmart-nlp-search',
    onMessage: (message) => {
      // Handle Walmart-specific messages here
      if (message?.type === 'nlp_result') {
        setNlpResult(message.data);
      } else if (message?.type === 'product_matches') {
        setSearchResults(message.data || []);
      }
    },
  });

  const searchProducts = trpc?.walmartGrocery?.searchProducts?.useMutation({
    onSuccess: (data: { products?: WalmartProduct[] }) => {
      setSearchResults(data.products || []);
    },
  });

  // Mock addToCart for now since the endpoint doesn't exist
  const addToCart = {
    mutate: (params: { productId: string; quantity: number }) => {
      console.log('Adding to cart:', params);
      // Mock success behavior
    },
    isPending: false,
    isLoading: false,
  };

  const handleNLPSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsProcessing(true);
    setShowNLPInsight(true);

    try {
      // Call NLP endpoint with WebSocket session ID
      const response = await axios.post("/api/nlp/process", {
        text: searchQuery,
        userId: "user123", // TODO: Get from auth context
        sessionId: `session-${Date.now()}`, // Generate session ID
      });

      const nlpData: NLPResult = response.data;
      setNlpResult(nlpData);

      // Handle different intents
      switch (nlpData.intent) {
        case "add_items":
          // For add_items, we get products directly from NLP
          if (nlpData.products && nlpData?.products?.length > 0) {
            const walmartProducts: WalmartProduct[] = nlpData?.products?.map((p) => ({
              id: p.id,
              walmartId: p.id,
              name: p.name,
              brand: p.brand,
              price: {
                currency: 'USD',
                regular: p.price,
                sale: p.price
              },
              images: [{
                id: `${p.id}-image`,
                url: "/api/placeholder/200/200",
                type: "primary" as const
              }],
              availability: {
                inStock: p.inStock,
                stockLevel: p.inStock ? "in_stock" as const : "out_of_stock" as const
              },
              category: {
                id: "grocery",
                name: "Grocery",
                path: ["grocery"],
                level: 1
              },
              description: "",
              metadata: {
                source: "api" as const,
                confidence: 0.8
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            } as WalmartProduct));
            setSearchResults(walmartProducts);
          } else if (nlpData?.items?.length > 0) {
            // Fallback to regular search for items
            searchProducts.mutate({
              query: nlpData?.items?.join(" "),
              limit: 20,
            });
          }
          break;

        case "search_products":
          // Search for products
          if (nlpData?.items?.length > 0) {
            searchProducts.mutate({
              query: nlpData?.items?.join(" "),
              limit: 20,
            });
          }
          break;

        case "view_cart":
          // Navigate to cart view
          // TODO: Implement cart navigation
          alert("Navigating to cart...");
          break;

        case "checkout":
          // Navigate to checkout
          // TODO: Implement checkout navigation
          alert("Proceeding to checkout...");
          break;

        case "clear_cart":
          // Clear the cart
          // TODO: Implement cart clearing
          alert("Clearing cart...");
          setCartItems([]);
          break;

        case "remove_items":
          // Remove items from cart
          // TODO: Implement item removal
          alert(`Removing items: ${nlpData?.items?.join(", ")}`);
          break;

        default:
          // Fallback to regular search
          searchProducts.mutate({
            query: searchQuery,
            limit: 20,
          });
      }
    } catch (error) {
      console.error("NLP processing error:", error);
      // Fallback to regular search
      searchProducts.mutate({
        query: searchQuery,
        limit: 20,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegularSearch = () => {
    if (!searchQuery.trim()) return;
    
    searchProducts.mutate({
      query: searchQuery,
      limit: 20,
    });
  };

  const handleAddToCart = async (product: WalmartProduct) => {
    addToCart.mutate({
      productId: product.id,
      quantity: 1,
    });
    setCartItems([...cartItems, product.id]);
  };

  // These effects are now handled in the onMessage callback of useWebSocketSingleton
  // The productMatches processing is done directly in the WebSocket message handler

  return (
    <div className="walmart-nlp-search">
      {/* WebSocket Status Indicator */}
      <div className="flex justify-end mb-2">
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
          isConnected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
        }`}>
          <WifiIcon className="h-3 w-3" />
          {isConnected ? "Real-time updates active" : "Offline mode"}
        </div>
      </div>

      {/* Search Header with NLP */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e: any) => setSearchQuery(e?.target?.value)}
                onKeyPress={(e: any) => e.key === "Enter" && handleNLPSearch()}
                placeholder='Try "add milk and bread to cart" or "show me organic vegetables"'
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <button
            onClick={handleNLPSearch}
            disabled={isProcessing || searchProducts.isLoading}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 flex items-center gap-2"
          >
            <SparklesIcon className="h-5 w-5" />
            {isProcessing ? "Processing..." : "Smart Search"}
          </button>
          <button
            onClick={handleRegularSearch}
            disabled={searchProducts.isLoading}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            Regular Search
          </button>
        </div>

        {/* NLP Insight Panel */}
        {showNLPInsight && nlpResult && (
          <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-3">
              <SparklesIcon className="h-5 w-5 text-purple-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800 mb-1">AI Understanding</h3>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-600">
                    Intent: <span className="font-medium text-blue-600">{nlpResult?.intent?.replace(/_/g, " ")}</span>
                    <span className="ml-2 text-gray-500">({(nlpResult.confidence * 100).toFixed(0)}% confident)</span>
                  </p>
                  {nlpResult?.items?.length > 0 && (
                    <p className="text-gray-600">
                      Items detected: <span className="font-medium">{nlpResult?.items?.join(", ")}</span>
                    </p>
                  )}
                  {nlpResult?.quantities?.length > 0 && (
                    <p className="text-gray-600">
                      Quantities: <span className="font-medium">{nlpResult?.quantities?.join(", ")}</span>
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowNLPInsight(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Example Queries */}
        <div className="mt-3">
          <p className="text-xs text-gray-500 mb-2">Try these examples:</p>
          <div className="flex flex-wrap gap-2">
            {[
              "add 2 gallons of milk",
              "show my cart",
              "find organic apples",
              "remove bread from cart",
              "checkout",
              "clear my shopping list"
            ].map((example: any) => (
              <button
                key={example}
                onClick={() => {
                  setSearchQuery(example);
                  handleNLPSearch();
                }}
                className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading State with WebSocket Indicator */}
      {(searchProducts.isLoading || isProcessing) && (
        <div className="flex flex-col justify-center items-center py-12">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            {isConnected && isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-pulse">
                  <SparklesIcon className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            )}
          </div>
          <p className="text-gray-600 mt-4">
            {isProcessing ? "Understanding your request..." : "Searching products..."}
          </p>
          {isConnected && isProcessing && (
            <p className="text-xs text-purple-600 mt-1">Real-time processing active</p>
          )}
        </div>
      )}

      {/* Error State */}
      {searchProducts.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Error searching products. Please try again.
        </div>
      )}

      {/* Search Results */}
      {searchResults?.length || 0 > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              {nlpResult?.intent === "add_items" ? "Products to Add" : "Search Results"}
            </h2>
            <span className="text-sm text-gray-500">
              {searchResults?.length || 0} products found
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {searchResults?.map((product: any) => (
              <div key={product.id} className="relative">
                <WalmartProductCard product={product} />
                {nlpResult?.intent === "add_items" && (
                  <button
                    onClick={() => handleAddToCart(product)}
                    disabled={cartItems.includes(product.id)}
                    className={`absolute top-2 right-2 p-2 rounded-full shadow-lg ${
                      cartItems.includes(product.id)
                        ? "bg-green-500 text-white"
                        : "bg-white hover:bg-blue-50"
                    }`}
                  >
                    <ShoppingCartIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {searchResults?.length || 0 === 0 && searchProducts.isSuccess && !isProcessing && (
        <div className="text-center py-12">
          <p className="text-gray-500">No products found. Try adjusting your search.</p>
        </div>
      )}
    </div>
  );
};