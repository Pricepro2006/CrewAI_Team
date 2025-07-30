/**
 * Walmart Product Search Component
 * Provides advanced search functionality for Walmart grocery products
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Search, Filter, X, Loader2 } from 'lucide-react';
import { Input } from '../../../components/ui/input.js';
import { Button } from '../../../components/ui/button.js';
import { Card, CardContent } from '../../../components/ui/card.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select.js';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../../../components/ui/sheet.js';
import { Badge } from '../../../components/ui/badge.js';
import { Slider } from '../../../components/ui/slider.js';
import { Checkbox } from '../../../components/ui/checkbox.js';
import { useWalmartSearch } from '../../hooks/useWalmartSearch.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import type { WalmartProduct, SearchOptions } from '../../../types/walmart-grocery.js';
import type { ExtendedSearchOptions } from '../../../types/walmart-search-extended.js';

interface WalmartProductSearchProps {
  onProductSelect?: (product: WalmartProduct) => void;
  onSearchResults?: (products: WalmartProduct[]) => void;
  initialQuery?: string;
  showFilters?: boolean;
  compactMode?: boolean;
  autoFocus?: boolean;
}

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'produce', label: 'Produce' },
  { value: 'dairy', label: 'Dairy & Eggs' },
  { value: 'meat', label: 'Meat & Seafood' },
  { value: 'bakery', label: 'Bakery & Bread' },
  { value: 'pantry', label: 'Pantry' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'beverages', label: 'Beverages' },
  { value: 'snacks', label: 'Snacks' },
  { value: 'household', label: 'Household' },
  { value: 'personal', label: 'Personal Care' },
  { value: 'baby', label: 'Baby' },
  { value: 'pets', label: 'Pets' },
];

const DIETARY_PREFERENCES = [
  { value: 'organic', label: 'Organic' },
  { value: 'gluten-free', label: 'Gluten Free' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'dairy-free', label: 'Dairy Free' },
  { value: 'sugar-free', label: 'Sugar Free' },
  { value: 'keto', label: 'Keto Friendly' },
  { value: 'paleo', label: 'Paleo' },
];

export const WalmartProductSearch: React.FC<WalmartProductSearchProps> = ({
  onProductSelect,
  onSearchResults,
  initialQuery = '',
  showFilters = true,
  compactMode = false,
  autoFocus = false,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<ExtendedSearchOptions>({
    query: initialQuery,
    category: undefined,
    minPrice: undefined,
    maxPrice: undefined,
    inStock: true,
    dietary: [],
    pagination: { limit: 20, offset: 0 },
  });
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100]);

  const debouncedQuery = useDebounce(query, 500);
  const { search, results, loading, error } = useWalmartSearch();

  // Perform search when query or filters change
  useEffect(() => {
    if (debouncedQuery || filters.category) {
      const searchOptions: SearchOptions = {
        query: debouncedQuery,
        filters: {
          categories: filters.category ? [filters.category] : undefined,
          priceRange: {
            min: priceRange[0] > 0 ? priceRange[0] : undefined,
            max: priceRange[1] < 100 ? priceRange[1] : undefined,
          },
          availability: filters.inStock ? 'in_stock' : 'all',
          dietary: filters.dietary,
        },
        pagination: filters.pagination,
      };
      
      search(searchOptions);
    }
  }, [debouncedQuery, filters, priceRange, search]);

  // Handle search results
  useEffect(() => {
    if (results.length > 0 && onSearchResults) {
      onSearchResults(results);
    }
  }, [results, onSearchResults]);

  const handleCategoryChange = (category: string) => {
    setFilters(prev => ({
      ...prev,
      category: category === 'all' ? undefined : category,
    }));
  };

  const handleDietaryToggle = (dietary: string) => {
    setFilters(prev => ({
      ...prev,
      dietary: prev.dietary?.includes(dietary)
        ? prev.dietary.filter(d => d !== dietary)
        : [...(prev.dietary || []), dietary],
    }));
  };

  const clearFilters = () => {
    setFilters({
      query: query,
      category: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      inStock: true,
      dietary: [],
      pagination: { limit: 20, offset: 0 },
    });
    setPriceRange([0, 100]);
  };

  const activeFilterCount = [
    filters.category,
    filters.minPrice,
    filters.maxPrice,
    filters.dietary?.length,
    !filters.inStock,
  ].filter(Boolean).length;

  if (compactMode) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search Walmart groceries..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-10"
            autoFocus={autoFocus}
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
          )}
        </div>
        {showFilters && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilterSheet(true)}
          >
            <Filter className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center"
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Search Input */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search for groceries..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10 pr-10 h-12 text-lg"
                autoFocus={autoFocus}
              />
              {loading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin" />
              )}
            </div>
            {showFilters && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => setShowFilterSheet(true)}
                className="h-12"
              >
                <Filter className="h-5 w-5 mr-2" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            )}
          </div>

          {/* Quick Filters */}
          {showFilters && !compactMode && (
            <div className="flex items-center gap-4">
              <Select
                value={filters.category || 'all'}
                onValueChange={handleCategoryChange}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="in-stock"
                  checked={filters.inStock}
                  onCheckedChange={(checked) =>
                    setFilters(prev => ({ ...prev, inStock: !!checked }))
                  }
                />
                <label
                  htmlFor="in-stock"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  In Stock Only
                </label>
              </div>

              {filters.dietary && filters.dietary.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Dietary:</span>
                  {filters.dietary.map(diet => (
                    <Badge key={diet} variant="secondary">
                      {diet}
                      <button
                        onClick={() => handleDietaryToggle(diet)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Filter Sheet */}
        {showFilters && (
          <Sheet open={showFilterSheet} onOpenChange={setShowFilterSheet}>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Search Filters</SheetTitle>
                <SheetDescription>
                  Refine your search to find exactly what you need
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 py-6">
                {/* Category Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select
                    value={filters.category || 'all'}
                    onValueChange={handleCategoryChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Price Range */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Price Range: ${priceRange[0]} - ${priceRange[1]}
                  </label>
                  <Slider
                    value={priceRange}
                    onValueChange={(value) => setPriceRange(value as [number, number])}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>

                {/* Dietary Preferences */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Dietary Preferences</label>
                  <div className="grid grid-cols-2 gap-2">
                    {DIETARY_PREFERENCES.map(diet => (
                      <div key={diet.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={diet.value}
                          checked={filters.dietary?.includes(diet.value) || false}
                          onCheckedChange={() => handleDietaryToggle(diet.value)}
                        />
                        <label
                          htmlFor={diet.value}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {diet.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stock Filter */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="filter-in-stock"
                    checked={filters.inStock}
                    onCheckedChange={(checked) =>
                      setFilters(prev => ({ ...prev, inStock: !!checked }))
                    }
                  />
                  <label
                    htmlFor="filter-in-stock"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Show in-stock items only
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="flex-1"
                  >
                    Clear Filters
                  </Button>
                  <Button
                    onClick={() => setShowFilterSheet(false)}
                    className="flex-1"
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </CardContent>
    </Card>
  );
};