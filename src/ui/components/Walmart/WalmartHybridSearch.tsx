import React, { useState, useEffect } from "react";
import { 
  MagnifyingGlassIcon, 
  AdjustmentsHorizontalIcon,
  ClockIcon,
  SparklesIcon,
  ShoppingCartIcon,
  StarIcon
} from "@heroicons/react/24/outline";
import { api } from "../../../lib/trpc.js";
import { WalmartProductCard } from "./WalmartProductCard.js";
import type { WalmartProduct } from "../../../types/walmart-grocery.js";

interface SearchSection {
  title: string;
  icon: React.ReactNode;
  products: WalmartProduct[];
  emptyMessage: string;
  highlightColor: string;
}

export const WalmartHybridSearch: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("");
  const [priceRange, setPriceRange] = useState({ min: 0, max: 1000 });
  const [showFilters, setShowFilters] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [includeExternal, setIncludeExternal] = useState(true);
  const [sortBy, setSortBy] = useState<"relevance" | "price" | "rating" | "purchase_frequency">("relevance");
  
  // Search results sections
  const [pastPurchases, setPastPurchases] = useState<WalmartProduct[]>([]);
  const [newProducts, setNewProducts] = useState<WalmartProduct[]>([]);
  const [recommendations, setRecommendations] = useState<WalmartProduct[]>([]);
  const [searchMetadata, setSearchMetadata] = useState<any>(null);
  
  // Auto-complete suggestions
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Get tRPC context to check initialization
  const utils = api.useUtils();
  const [isClientReady, setIsClientReady] = useState(false);

  // Check if tRPC client is initialized
  useEffect(() => {
    // Small delay to ensure tRPC client is ready
    const timer = setTimeout(() => {
      setIsClientReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Use hybrid search mutation with error handling
  const hybridSearch = api?.walmartGrocery?.hybridSearch.useMutation({
    onSuccess: (data: any) => {
      setPastPurchases(data.pastPurchases || []);
      setNewProducts(data.newProducts || []);
      setRecommendations(data.recommendedProducts || []);
      setSearchMetadata(data.searchMetadata);
    },
    onError: (error: any) => {
      // Hybrid search error handling with user feedback
      // Fallback to regular search if hybrid fails
      if (error?.message?.includes('No \'mutation\'')) {
        // Try using a query instead of mutation as fallback
      }
    },
  });

  // Quick search for autocomplete with error handling
  const quickSearch = api?.walmartGrocery?.quickSearch.useMutation({
    onSuccess: (data: any) => {
      setSuggestions(data.suggestions || []);
      setShowSuggestions(data?.suggestions?.length > 0);
    },
    onError: (error: any) => {
      setSuggestions([]);
      setShowSuggestions(false);
    },
  });

  // Handle search input changes for autocomplete
  useEffect(() => {
    if (searchQuery?.length || 0 >= 2 && isClientReady) {
      const timer = setTimeout(() => {
        quickSearch.mutate({ query: searchQuery, limit: 5 });
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchQuery, isClientReady]);

  const handleSearch = () => {
    if (!searchQuery.trim() || !isClientReady) {
      return;
    }
    
    setShowSuggestions(false);
    hybridSearch.mutate({
      query: searchQuery,
      userId: "current-user", // Get from auth context
      includeExternal,
      includePastPurchases: true,
      includeRecommendations: true,
      category: category || undefined,
      priceRange: priceRange.min > 0 || priceRange.max < 1000 ? priceRange : undefined,
      inStockOnly,
      sortBy,
      limit: 40,
    });
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    handleSearch();
  };

  const categories = [
    "All Categories",
    "Fresh Produce",
    "Dairy & Eggs",
    "Meat & Seafood",
    "Bakery & Bread",
    "Frozen Foods",
    "Pantry",
    "Snacks & Candy",
    "Beverages",
    "Health & Beauty",
    "Household",
    "Baby",
    "Pet Supplies",
  ];

  // Define search result sections
  const searchSections: SearchSection[] = [
    {
      title: "Previously Purchased",
      icon: <ClockIcon className="h-5 w-5" />,
      products: pastPurchases,
      emptyMessage: "No matching products from your purchase history",
      highlightColor: "bg-green-50 border-green-200",
    },
    {
      title: "New Products",
      icon: <SparklesIcon className="h-5 w-5" />,
      products: newProducts,
      emptyMessage: "No new products found",
      highlightColor: "bg-blue-50 border-blue-200",
    },
    {
      title: "Recommended for You",
      icon: <StarIcon className="h-5 w-5" />,
      products: recommendations,
      emptyMessage: "No recommendations available",
      highlightColor: "bg-purple-50 border-purple-200",
    },
  ];

  // Show loading state if client not ready
  if (!isClientReady) {
    return (
      <div className="walmart-hybrid-search">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="text-center text-gray-500">
            <div className="animate-pulse">Initializing search...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="walmart-hybrid-search">
      {/* Search Header */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e: any) => setSearchQuery(e?.target?.value)}
                onKeyPress={(e: any) => e.key === "Enter" && handleSearch()}
                placeholder="Search products, past purchases, or discover new items..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {/* Autocomplete Suggestions */}
            {showSuggestions && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                {suggestions?.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                      <span>{suggestion}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <AdjustmentsHorizontalIcon className="h-5 w-5" />
            Filters
          </button>
          
          <button
            onClick={handleSearch}
            disabled={hybridSearch.isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {hybridSearch.isLoading ? "Searching..." : "Search"}
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e: any) => setCategory(e?.target?.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {categories?.map((cat: any) => (
                    <option key={cat} value={cat === "All Categories" ? "" : cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price Range
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={priceRange.min}
                    onChange={(e: any) => setPriceRange({ ...priceRange, min: Number(e?.target?.value) })}
                    placeholder="Min"
                    className="w-20 px-2 py-1 border border-gray-300 rounded"
                  />
                  <span className="text-gray-500">-</span>
                  <input
                    type="number"
                    value={priceRange.max}
                    onChange={(e: any) => setPriceRange({ ...priceRange, max: Number(e?.target?.value) })}
                    placeholder="Max"
                    className="w-20 px-2 py-1 border border-gray-300 rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e?.target?.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="relevance">Relevance</option>
                  <option value="price">Price: Low to High</option>
                  <option value="rating">Rating</option>
                  <option value="purchase_frequency">Most Purchased</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e: any) => setInStockOnly(e?.target?.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700">In Stock Only</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeExternal}
                  onChange={(e: any) => setIncludeExternal(e?.target?.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Search External Sources</span>
              </label>
            </div>
          </div>
        )}

        {/* Search Metadata */}
        {searchMetadata && (
          <div className="mt-3 pt-3 border-t flex items-center gap-4 text-sm text-gray-600">
            <span>{searchMetadata.totalResults} results</span>
            <span>•</span>
            <span>{searchMetadata.executionTime}ms</span>
            <span>•</span>
            <span>Sources: {searchMetadata?.sources?.join(", ")}</span>
          </div>
        )}
      </div>

      {/* Loading State */}
      {hybridSearch.isLoading && (
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Searching multiple sources...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {hybridSearch.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Error searching products. Please try again.
        </div>
      )}

      {/* Search Results Sections */}
      {hybridSearch.isSuccess && (
        <div className="space-y-8">
          {searchSections?.map((section: any) => {
            if (section?.products?.length === 0) return null;
            
            return (
              <div key={section.title} className="space-y-4">
                <div className={`border rounded-lg p-3 ${section.highlightColor}`}>
                  <div className="flex items-center gap-2">
                    {section.icon}
                    <h2 className="text-lg font-semibold">{section.title}</h2>
                    <span className="ml-auto text-sm text-gray-600">
                      {section?.products?.length} items
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {section?.products?.map((product: any) => (
                    <div key={product.id} className="relative">
                      {section.title === "Previously Purchased" && (
                        <div className="absolute -top-2 -right-2 z-10">
                          <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                            <ShoppingCartIcon className="h-3 w-3" />
                            Purchased
                          </div>
                        </div>
                      )}
                      <WalmartProductCard product={product} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* No Results */}
          {pastPurchases?.length || 0 === 0 && newProducts?.length || 0 === 0 && recommendations?.length || 0 === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No products found. Try adjusting your search criteria.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};