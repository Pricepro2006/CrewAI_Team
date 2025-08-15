import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDebounce } from '../../client/hooks/useDebounce.js';

export interface Suggestion {
  id: string;
  text: string;
  type: 'product' | 'quantity' | 'action' | 'template' | 'category';
  confidence: number;
  metadata?: {
    productId?: string;
    category?: string;
    price?: number;
    imageUrl?: string;
    commonPhrase?: boolean;
    template?: string;
  };
}

export interface SuggestionContext {
  recentCommands: string[];
  groceryCategories: string[];
  popularProducts: string[];
  userPreferences?: {
    favoriteCategories: string[];
    commonQuantities: number[];
    preferredBrands: string[];
  };
}

export interface AutoSuggestionsConfig {
  debounceMs?: number;
  maxSuggestions?: number;
  minQueryLength?: number;
  enableTemplates?: boolean;
  enableCategoryFiltering?: boolean;
  customSuggestions?: Suggestion[];
  context?: SuggestionContext;
}

export interface AutoSuggestionsState {
  suggestions: Suggestion[];
  isLoading: boolean;
  error: string | null;
  selectedIndex: number;
  totalSuggestions: number;
}

export interface AutoSuggestionsActions {
  getSuggestions: (query: string) => void;
  clearSuggestions: () => void;
  selectNext: () => void;
  selectPrevious: () => void;
  selectSuggestion: (index: number) => Suggestion | null;
  addCustomSuggestion: (suggestion: Suggestion) => void;
  updateContext: (context: Partial<SuggestionContext>) => void;
}

// Common grocery templates and patterns
const COMMON_TEMPLATES = [
  'Add {quantity} {product}',
  'I need {quantity} {product}',
  'Get {product}',
  'Remove {product}',
  'Change {product} quantity to {quantity}',
  'Find the cheapest {product}',
  'What\'s my total?',
  'Clear my list',
  'Show me deals on {category}',
  'Add organic {product}',
];

const COMMON_ACTIONS = [
  'add', 'remove', 'delete', 'clear', 'change', 'update', 'find', 'search',
  'show', 'get', 'buy', 'need', 'want', 'list', 'total', 'price', 'cost',
];

const QUANTITY_PATTERNS = [
  '1', '2', '3', '4', '5', '6', '10', '12', '24',
  'a', 'an', 'one', 'two', 'three', 'four', 'five',
  'dozen', 'half dozen', 'couple', 'few', 'several',
  'pound', 'pounds', 'lb', 'lbs', 'kg', 'gram', 'grams',
  'gallon', 'gallons', 'quart', 'quarts', 'liter', 'liters',
  'bottle', 'bottles', 'can', 'cans', 'box', 'boxes',
  'bag', 'bags', 'pack', 'packs', 'jar', 'jars',
];

const GROCERY_CATEGORIES = [
  'produce', 'meat', 'dairy', 'bakery', 'frozen', 'pantry', 'snacks',
  'beverages', 'breakfast', 'lunch', 'dinner', 'organic', 'gluten-free',
  'fruits', 'vegetables', 'protein', 'grains', 'spices', 'condiments',
];

const POPULAR_PRODUCTS = [
  'milk', 'eggs', 'bread', 'butter', 'cheese', 'chicken', 'beef', 'salmon',
  'bananas', 'apples', 'oranges', 'tomatoes', 'lettuce', 'onions', 'potatoes',
  'rice', 'pasta', 'cereal', 'yogurt', 'juice', 'water', 'coffee', 'tea',
  'olive oil', 'salt', 'pepper', 'garlic', 'carrots', 'broccoli', 'spinach',
];

export const useAutoSuggestions = (config: AutoSuggestionsConfig = {}) => {
  const {
    debounceMs = 300,
    maxSuggestions = 8,
    minQueryLength = 1,
    enableTemplates = true,
    enableCategoryFiltering = true,
    customSuggestions = [],
    context = {},
  } = config;

  const [state, setState] = useState<AutoSuggestionsState>({
    suggestions: [],
    isLoading: false,
    error: null,
    selectedIndex: -1,
    totalSuggestions: 0,
  });

  const [query, setQuery] = useState('');
  const [suggestionContext, setSuggestionContext] = useState<SuggestionContext>({
    recentCommands: [],
    groceryCategories: GROCERY_CATEGORIES,
    popularProducts: POPULAR_PRODUCTS,
    ...context,
  });

  const debouncedQuery = useDebounce(query, debounceMs);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Memoized suggestion generators
  const generateProductSuggestions = useCallback((searchQuery: string): Suggestion[] => {
    const lowerQuery = searchQuery.toLowerCase();
    const suggestions: Suggestion[] = [];

    // Search in popular products
    suggestionContext?.popularProducts?.forEach((product, index) => {
      if (product.toLowerCase().includes(lowerQuery)) {
        const confidence = product.toLowerCase().startsWith(lowerQuery) ? 0.9 : 0.7;
        suggestions.push({
          id: `product-${product}-${index}`,
          text: product,
          type: 'product',
          confidence,
          metadata: {
            productId: `product-${product}`,
            category: getProductCategory(product),
            commonPhrase: true,
          },
        });
      }
    });

    // Add user preferences if available
    if (suggestionContext.userPreferences?.preferredBrands) {
      suggestionContext?.userPreferences?.preferredBrands.forEach((brand, index) => {
        if (brand.toLowerCase().includes(lowerQuery)) {
          suggestions.push({
            id: `brand-${brand}-${index}`,
            text: brand,
            type: 'product',
            confidence: 0.8,
            metadata: {
              productId: `brand-${brand}`,
              commonPhrase: true,
            },
          });
        }
      });
    }

    return suggestions;
  }, [suggestionContext.popularProducts, suggestionContext.userPreferences]);

  const generateQuantitySuggestions = useCallback((searchQuery: string): Suggestion[] => {
    const lowerQuery = searchQuery.toLowerCase();
    const suggestions: Suggestion[] = [];

    QUANTITY_PATTERNS.forEach((pattern, index) => {
      if (pattern.toLowerCase().includes(lowerQuery)) {
        const confidence = pattern.toLowerCase() === lowerQuery ? 1.0 : 0.6;
        suggestions.push({
          id: `quantity-${pattern}-${index}`,
          text: pattern,
          type: 'quantity',
          confidence,
          metadata: {
            template: `${pattern} {product}`,
          },
        });
      }
    });

    return suggestions;
  }, []);

  const generateActionSuggestions = useCallback((searchQuery: string): Suggestion[] => {
    const lowerQuery = searchQuery.toLowerCase();
    const suggestions: Suggestion[] = [];

    COMMON_ACTIONS.forEach((action, index) => {
      if (action.toLowerCase().includes(lowerQuery)) {
        const confidence = action.toLowerCase().startsWith(lowerQuery) ? 0.8 : 0.6;
        suggestions.push({
          id: `action-${action}-${index}`,
          text: action,
          type: 'action',
          confidence,
          metadata: {
            template: `${action} {product}`,
          },
        });
      }
    });

    return suggestions;
  }, []);

  const generateTemplateSuggestions = useCallback((searchQuery: string): Suggestion[] => {
    if (!enableTemplates) return [];

    const lowerQuery = searchQuery.toLowerCase();
    const suggestions: Suggestion[] = [];

    COMMON_TEMPLATES.forEach((template, index) => {
      const templateText = template.toLowerCase().replace(/{[^}]+}/g, '');
      if (templateText.includes(lowerQuery)) {
        suggestions.push({
          id: `template-${index}`,
          text: template,
          type: 'template',
          confidence: 0.5,
          metadata: {
            template,
            commonPhrase: true,
          },
        });
      }
    });

    return suggestions;
  }, [enableTemplates]);

  const generateCategorySuggestions = useCallback((searchQuery: string): Suggestion[] => {
    if (!enableCategoryFiltering) return [];

    const lowerQuery = searchQuery.toLowerCase();
    const suggestions: Suggestion[] = [];

    suggestionContext?.groceryCategories?.forEach((category, index) => {
      if (category.toLowerCase().includes(lowerQuery)) {
        const confidence = category.toLowerCase().startsWith(lowerQuery) ? 0.8 : 0.6;
        suggestions.push({
          id: `category-${category}-${index}`,
          text: category,
          type: 'category',
          confidence,
          metadata: {
            category,
            template: `Show me {category} items`,
          },
        });
      }
    });

    return suggestions;
  }, [enableCategoryFiltering, suggestionContext.groceryCategories]);

  const generateRecentCommandSuggestions = useCallback((searchQuery: string): Suggestion[] => {
    const lowerQuery = searchQuery.toLowerCase();
    const suggestions: Suggestion[] = [];

    suggestionContext?.recentCommands?.forEach((command, index) => {
      if (command.toLowerCase().includes(lowerQuery)) {
        const confidence = command.toLowerCase().startsWith(lowerQuery) ? 0.9 : 0.7;
        suggestions.push({
          id: `recent-${index}`,
          text: command,
          type: 'template',
          confidence,
          metadata: {
            template: command,
            commonPhrase: false,
          },
        });
      }
    });

    return suggestions;
  }, [suggestionContext.recentCommands]);

  const getSuggestions = useCallback(async (searchQuery: string) => {
    if (searchQuery?.length || 0 < minQueryLength) {
      setState(prev => ({ ...prev, suggestions: [], isLoading: false, selectedIndex: -1 }));
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef?.current?.abort();
    }

    abortControllerRef.current = new AbortController();
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Simulate API delay for realism
      await new Promise(resolve => setTimeout(resolve, 50));

      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      // Generate different types of suggestions
      const allSuggestions: Suggestion[] = [
        ...generateRecentCommandSuggestions(searchQuery),
        ...generateProductSuggestions(searchQuery),
        ...generateActionSuggestions(searchQuery),
        ...generateQuantitySuggestions(searchQuery),
        ...generateCategorySuggestions(searchQuery),
        ...generateTemplateSuggestions(searchQuery),
        ...customSuggestions?.filter(s => 
          s?.text?.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      ];

      // Sort by confidence and relevance
      const sortedSuggestions = allSuggestions
        .sort((a, b) => {
          // Prioritize exact matches
          const aExact = a?.text?.toLowerCase() === searchQuery.toLowerCase();
          const bExact = b?.text?.toLowerCase() === searchQuery.toLowerCase();
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;

          // Then by confidence
          if (a.confidence !== b.confidence) {
            return b.confidence - a.confidence;
          }

          // Then by type priority
          const typePriority = { template: 0, product: 1, action: 2, quantity: 3, category: 4 };
          return (typePriority[a.type] || 99) - (typePriority[b.type] || 99);
        })
        .slice(0, maxSuggestions);

      setState(prev => ({
        ...prev,
        suggestions: sortedSuggestions,
        isLoading: false,
        selectedIndex: -1,
        totalSuggestions: sortedSuggestions?.length || 0,
      }));
    } catch (error) {
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to generate suggestions',
      }));
    }
  }, [
    minQueryLength,
    maxSuggestions,
    generateRecentCommandSuggestions,
    generateProductSuggestions,
    generateActionSuggestions,
    generateQuantitySuggestions,
    generateCategorySuggestions,
    generateTemplateSuggestions,
    customSuggestions,
  ]);

  // Effect to trigger suggestions when debounced query changes
  useEffect(() => {
    if (debouncedQuery !== query) return; // Only process when debounce is complete
    getSuggestions(debouncedQuery);
  }, [debouncedQuery, getSuggestions]);

  const clearSuggestions = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef?.current?.abort();
    }
    setState(prev => ({
      ...prev,
      suggestions: [],
      isLoading: false,
      error: null,
      selectedIndex: -1,
      totalSuggestions: 0,
    }));
    setQuery('');
  }, []);

  const selectNext = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedIndex: Math.min(prev.selectedIndex + 1, prev?.suggestions?.length - 1),
    }));
  }, []);

  const selectPrevious = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedIndex: Math.max(prev.selectedIndex - 1, -1),
    }));
  }, []);

  const selectSuggestion = useCallback((index: number): Suggestion | null => {
    if (index < 0 || index >= state?.suggestions?.length) {
      return null;
    }
    
    const suggestion = state.suggestions[index];
    setState(prev => ({ ...prev, selectedIndex: index }));
    return suggestion;
  }, [state.suggestions]);

  const addCustomSuggestion = useCallback((suggestion: Suggestion) => {
    setState(prev => ({
      ...prev,
      suggestions: [suggestion, ...prev.suggestions].slice(0, maxSuggestions),
      totalSuggestions: Math.min(prev.totalSuggestions + 1, maxSuggestions),
    }));
  }, [maxSuggestions]);

  const updateContext = useCallback((newContext: Partial<SuggestionContext>) => {
    setSuggestionContext(prev => ({
      ...prev,
      ...newContext,
    }));
  }, []);

  // Update query when external query changes
  const updateQuery = useCallback((newQuery: string) => {
    setQuery(newQuery);
  }, []);

  const actions: AutoSuggestionsActions = {
    getSuggestions: updateQuery,
    clearSuggestions,
    selectNext,
    selectPrevious,
    selectSuggestion,
    addCustomSuggestion,
    updateContext,
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef?.current?.abort();
      }
    };
  }, []);

  return {
    ...state,
    ...actions,
    query,
    context: suggestionContext,
  };
};

// Helper function to categorize products
function getProductCategory(product: string): string {
  const categoryMap: Record<string, string> = {
    // Produce
    'bananas': 'produce', 'apples': 'produce', 'oranges': 'produce', 'tomatoes': 'produce',
    'lettuce': 'produce', 'onions': 'produce', 'potatoes': 'produce', 'carrots': 'produce',
    'broccoli': 'produce', 'spinach': 'produce',
    
    // Dairy
    'milk': 'dairy', 'eggs': 'dairy', 'butter': 'dairy', 'cheese': 'dairy', 'yogurt': 'dairy',
    
    // Protein
    'chicken': 'meat', 'beef': 'meat', 'salmon': 'meat',
    
    // Pantry
    'bread': 'bakery', 'rice': 'pantry', 'pasta': 'pantry', 'cereal': 'breakfast',
    'olive oil': 'pantry', 'salt': 'pantry', 'pepper': 'pantry', 'garlic': 'pantry',
    
    // Beverages
    'juice': 'beverages', 'water': 'beverages', 'coffee': 'beverages', 'tea': 'beverages',
  };

  return categoryMap[product.toLowerCase()] || 'pantry';
}

export default useAutoSuggestions;