import React, { useState } from "react";
import { MagnifyingGlassIcon, AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import { api } from "../../../lib/trpc.js";
import { WalmartProductCard } from "./WalmartProductCard.js";
import type { WalmartProduct } from "../../../types/walmart-grocery.js";

export const WalmartProductSearch: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("");
  const [priceRange, setPriceRange] = useState({ min: 0, max: 1000 });
  const [showFilters, setShowFilters] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [searchResults, setSearchResults] = useState<WalmartProduct[]>([]);

  const searchProducts = api?.walmartGrocery?.searchProducts.useMutation({
    onSuccess: (data: any) => {
      setSearchResults(data.products || []);
    },
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) return;

    searchProducts.mutate({
      query: searchQuery,
      limit: 20,
      // Additional filters would be supported by enhanced search
    });
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

  return (
    <div className="walmart-product-search">
      {/* Search Header */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e: any) => setSearchQuery(e?.target?.value)}
                onKeyPress={(e: any) => e.key === "Enter" && handleSearch()}
                placeholder="Search for products..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
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
            disabled={searchProducts.isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {searchProducts.isLoading ? "Searching..." : "Search"}
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-4">
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

            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e: any) => setInStockOnly(e?.target?.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700">In Stock Only</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Search Results */}
      {searchProducts.isLoading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {searchProducts.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Error searching products. Please try again.
        </div>
      )}

      {searchResults?.length || 0 > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {searchResults?.map((product: any) => (
            <WalmartProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {searchResults?.length || 0 === 0 && searchProducts.isSuccess && (
        <div className="text-center py-12">
          <p className="text-gray-500">No products found. Try adjusting your search criteria.</p>
        </div>
      )}
    </div>
  );
};