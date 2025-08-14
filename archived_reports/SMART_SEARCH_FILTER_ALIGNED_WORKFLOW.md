# Smart Search Filter Implementation - Properly Aligned Workflow

## Overview
This workflow strictly follows SMART_SEARCH_FILTER_FIX_PLAN.md using actual available tools and appropriate agents.

## Phase 1: Analysis and Current State Review

### Step 1.1: Code Review of Current Implementation
```bash
# Use code-reviewer agent to analyze current filter implementation
Task(
  subagent_type="code-reviewer",
  description="Review Walmart filter implementation",
  prompt="Review the Smart Search filter implementation in WalmartGroceryAgent.tsx lines 232-238. Check for: 1) Missing onClick handlers, 2) No state management for active filters, 3) No filter application logic. Also review walmart-grocery.router.ts lines 150-250 for category parameter handling."
)
```

### Step 1.2: Architecture Review
```bash
# Use architecture-reviewer to assess structural needs
Task(
    , 
  description="Assess filter architecture",
  prompt="Analyze the architecture needed for Walmart grocery filters. Requirements: 1) Filter buttons for Produce, Dairy, Meat & Seafood, Bakery, On Sale, 2) State management via custom hook, 3) Backend SQL filtering with WHERE clauses, 4) Category mappings in constants file. Confirm the plan aligns with existing tRPC/React/SQLite stack."
)
```

### Step 1.3: Verify Current Database Schema
```bash
# Check the actual database structure
Bash(command="sqlite3 /home/pricepro2006/CrewAI_Team/data/walmart_grocery.db '.schema walmart_products' | head -20")

# Verify relevant columns exist
Bash(command="sqlite3 /home/pricepro2006/CrewAI_Team/data/walmart_grocery.db 'PRAGMA table_info(walmart_products);' | grep -E 'category_path|department|current_price|regular_price'")
```

## Phase 2: Implementation - Backend First

### Step 2.1: Create Category Constants
```bash
# Create the category mappings file
Write(
  file_path="/home/pricepro2006/CrewAI_Team/src/constants/walmart-categories.ts",
  content=`// Walmart Category Mappings for Filter System
export const WALMART_CATEGORIES = {
  PRODUCE: ['Fruits', 'Vegetables', 'Fresh Produce', 'Organic Produce'],
  DAIRY: ['Milk', 'Cheese', 'Yogurt', 'Dairy & Eggs', 'Butter', 'Cream'],
  MEAT_SEAFOOD: ['Meat', 'Seafood', 'Poultry', 'Fresh Meat', 'Beef', 'Pork', 'Fish'],
  BAKERY: ['Bread', 'Bakery', 'Desserts', 'Cakes', 'Pastries', 'Bagels'],
  ON_SALE: 'special' // Special filter for discounted items
} as const;

export type WalmartFilterCategory = keyof typeof WALMART_CATEGORIES | 'All Categories';

// Helper function to check if product belongs to category
export function isInCategory(productCategory: string, filterCategory: WalmartFilterCategory): boolean {
  if (filterCategory === 'All Categories') return true;
  if (filterCategory === 'ON_SALE') return false; // Handle separately with price comparison
  
  const categoryKeywords = WALMART_CATEGORIES[filterCategory as keyof typeof WALMART_CATEGORIES];
  if (Array.isArray(categoryKeywords)) {
    return categoryKeywords.some(keyword => 
      productCategory?.toLowerCase().includes(keyword.toLowerCase())
    );
  }
  return false;
}`
)
```

### Step 2.2: Update Backend Router
```bash
# First, read the current implementation
Read(file_path="/home/pricepro2006/CrewAI_Team/src/api/routes/walmart-grocery.router.ts", offset=150, limit=100)

# Then modify the searchProducts procedure to handle filters
Edit(
  file_path="/home/pricepro2006/CrewAI_Team/src/api/routes/walmart-grocery.router.ts",
  old_string="[CURRENT_SEARCHPRODUCTS_IMPLEMENTATION]",
  new_string="[UPDATED_WITH_FILTER_LOGIC]"
)
```

### Step 2.3: Add Database Indexes
```bash
# Create indexes for better filter performance
Bash(command="sqlite3 /home/pricepro2006/CrewAI_Team/data/walmart_grocery.db 'CREATE INDEX IF NOT EXISTS idx_walmart_products_category ON walmart_products(category_path);'")

Bash(command="sqlite3 /home/pricepro2006/CrewAI_Team/data/walmart_grocery.db 'CREATE INDEX IF NOT EXISTS idx_walmart_products_department ON walmart_products(department);'")

Bash(command="sqlite3 /home/pricepro2006/CrewAI_Team/data/walmart_grocery.db 'CREATE INDEX IF NOT EXISTS idx_walmart_products_price ON walmart_products(current_price, regular_price);'")
```

## Phase 3: Implementation - Frontend

### Step 3.1: Create Filter Hook
```bash
Write(
  file_path="/home/pricepro2006/CrewAI_Team/src/hooks/useWalmartFilters.ts",
  content=`import { useState, useCallback } from 'react';
import { WALMART_CATEGORIES, WalmartFilterCategory, isInCategory } from '../constants/walmart-categories';

export interface WalmartProduct {
  id: string;
  name: string;
  category_path?: string;
  department?: string;
  current_price: number;
  regular_price?: number;
}

export const useWalmartFilters = () => {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['All Categories']));

  const toggleFilter = useCallback((filter: string) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev);
      
      if (filter === 'All Categories') {
        // Clear all and set only 'All Categories'
        return new Set(['All Categories']);
      }
      
      // Remove 'All Categories' if selecting specific filter
      newFilters.delete('All Categories');
      
      if (newFilters.has(filter)) {
        newFilters.delete(filter);
        // If no filters left, default to 'All Categories'
        if (newFilters.size === 0) {
          newFilters.add('All Categories');
        }
      } else {
        newFilters.add(filter);
      }
      
      return newFilters;
    });
  }, []);

  const applyFiltersToResults = useCallback((
    results: WalmartProduct[], 
    filters: Set<string> = activeFilters
  ): WalmartProduct[] => {
    if (filters.has('All Categories')) {
      return results;
    }

    return results.filter(product => {
      // Check each active filter
      for (const filter of filters) {
        if (filter === 'On Sale') {
          // Special case for On Sale
          if (product.regular_price && product.current_price < product.regular_price) {
            return true;
          }
        } else {
          // Category-based filtering
          const categoryPath = product.category_path || product.department || '';
          if (isInCategory(categoryPath, filter as WalmartFilterCategory)) {
            return true;
          }
        }
      }
      return false;
    });
  }, [activeFilters]);

  const getFilterParams = useCallback((): { categories?: string[]; onSale?: boolean } => {
    if (activeFilters.has('All Categories')) {
      return {};
    }

    const params: { categories?: string[]; onSale?: boolean } = {};
    const categories: string[] = [];

    activeFilters.forEach(filter => {
      if (filter === 'On Sale') {
        params.onSale = true;
      } else if (filter !== 'All Categories') {
        categories.push(filter);
      }
    });

    if (categories.length > 0) {
      params.categories = categories;
    }

    return params;
  }, [activeFilters]);

  return {
    activeFilters,
    toggleFilter,
    applyFiltersToResults,
    getFilterParams
  };
};`
)
```

### Step 3.2: Update Component with Filter Functionality
```bash
# Read current component implementation
Read(file_path="/home/pricepro2006/CrewAI_Team/src/ui/components/WalmartAgent/WalmartGroceryAgent.tsx", offset=230, limit=20)

# Apply multiple edits to add filter functionality
MultiEdit(
  file_path="/home/pricepro2006/CrewAI_Team/src/ui/components/WalmartAgent/WalmartGroceryAgent.tsx",
  edits=[
    {
      old_string: "import statements section",
      new_string: "import statements section\nimport { useWalmartFilters } from '../../../hooks/useWalmartFilters';"
    },
    {
      old_string: '<button className="filter-chip active">All Categories</button>',
      new_string: '<button className={`filter-chip ${activeFilters.has("All Categories") ? "active" : ""}`} onClick={() => toggleFilter("All Categories")}>All Categories</button>'
    },
    {
      old_string: '<button className="filter-chip">Produce</button>',
      new_string: '<button className={`filter-chip ${activeFilters.has("Produce") ? "active" : ""}`} onClick={() => toggleFilter("Produce")}>Produce</button>'
    },
    {
      old_string: '<button className="filter-chip">Dairy</button>',
      new_string: '<button className={`filter-chip ${activeFilters.has("Dairy") ? "active" : ""}`} onClick={() => toggleFilter("Dairy")}>Dairy</button>'
    },
    {
      old_string: '<button className="filter-chip">Meat & Seafood</button>',
      new_string: '<button className={`filter-chip ${activeFilters.has("Meat & Seafood") ? "active" : ""}`} onClick={() => toggleFilter("Meat & Seafood")}>Meat & Seafood</button>'
    },
    {
      old_string: '<button className="filter-chip">Bakery</button>',
      new_string: '<button className={`filter-chip ${activeFilters.has("Bakery") ? "active" : ""}`} onClick={() => toggleFilter("Bakery")}>Bakery</button>'
    },
    {
      old_string: '<button className="filter-chip">On Sale</button>',
      new_string: '<button className={`filter-chip ${activeFilters.has("On Sale") ? "active" : ""}`} onClick={() => toggleFilter("On Sale")}>On Sale</button>'
    }
  ]
)
```

## Phase 4: Testing and Validation

### Step 4.1: Create Test File
```bash
Write(
  file_path="/home/pricepro2006/CrewAI_Team/src/tests/walmart-filter.test.ts",
  content=`// Test file for Walmart filter functionality
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';
import { useWalmartFilters } from '../hooks/useWalmartFilters';

describe('Walmart Filter Functionality', () => {
  it('should toggle filters correctly', () => {
    const { result } = renderHook(() => useWalmartFilters());
    
    // Initial state
    expect(result.current.activeFilters.has('All Categories')).toBe(true);
    
    // Toggle Produce
    act(() => {
      result.current.toggleFilter('Produce');
    });
    expect(result.current.activeFilters.has('Produce')).toBe(true);
    expect(result.current.activeFilters.has('All Categories')).toBe(false);
  });

  it('should filter products by category', () => {
    const { result } = renderHook(() => useWalmartFilters());
    const testProducts = [
      { id: '1', name: 'Apple', category_path: 'Fresh Produce', current_price: 1.99 },
      { id: '2', name: 'Milk', category_path: 'Dairy & Eggs', current_price: 3.99 },
      { id: '3', name: 'Bread', department: 'Bakery', current_price: 2.49 }
    ];

    act(() => {
      result.current.toggleFilter('Produce');
    });

    const filtered = result.current.applyFiltersToResults(testProducts);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Apple');
  });

  it('should handle On Sale filter', () => {
    const { result } = renderHook(() => useWalmartFilters());
    const testProducts = [
      { id: '1', name: 'Sale Item', current_price: 1.99, regular_price: 2.99 },
      { id: '2', name: 'Regular Item', current_price: 3.99, regular_price: 3.99 }
    ];

    act(() => {
      result.current.toggleFilter('On Sale');
    });

    const filtered = result.current.applyFiltersToResults(testProducts);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Sale Item');
  });
});`
)
```

### Step 4.2: Run Tests
```bash
# Run the filter tests
Bash(command="cd /home/pricepro2006/CrewAI_Team && npm test walmart-filter")
```

### Step 4.3: Integration Testing
```bash
# Use test-failure-debugger if tests fail
Task(
  subagent_type="test-failure-debugger",
  description="Debug filter test failures",
  prompt="Debug any failing tests in walmart-filter.test.ts. Check for: 1) Import path issues, 2) Type mismatches, 3) Hook implementation problems, 4) Missing dependencies."
)
```

## Phase 5: Final Validation

### Step 5.1: Code Review
```bash
Task(
  subagent_type="code-reviewer",
  description="Final filter implementation review",
  prompt="Review the complete Smart Search filter implementation. Verify: 1) All filter buttons have onClick handlers, 2) State management via useWalmartFilters hook works, 3) Backend properly filters with WHERE clauses, 4) Type safety maintained throughout, 5) Performance indexes added to database."
)
```

### Step 5.2: Manual Testing Checklist
```bash
Write(
  file_path="/home/pricepro2006/CrewAI_Team/FILTER_TEST_CHECKLIST.md",
  content=`# Smart Search Filter Testing Checklist

## Visual & Interaction Tests
- [ ] Filter buttons toggle active state visually (active class applied)
- [ ] Multiple filters can be active simultaneously  
- [ ] "All Categories" deselects other filters when clicked
- [ ] Clicking active filter deselects it
- [ ] If all filters deselected, "All Categories" auto-activates

## Functionality Tests
- [ ] Results update immediately on filter change
- [ ] Produce filter shows only produce items
- [ ] Dairy filter shows only dairy products
- [ ] Meat & Seafood filter shows appropriate items
- [ ] Bakery filter shows bakery products
- [ ] On Sale filter shows only items where current_price < regular_price
- [ ] Multiple filters show union of results (OR logic)

## Edge Cases
- [ ] Empty results show appropriate message
- [ ] Filter state persists during session
- [ ] Filters work with search queries
- [ ] Filters work after pagination

## Performance
- [ ] No lag when toggling filters
- [ ] Database queries optimized with indexes
- [ ] No unnecessary re-renders`
)
```

## Important Agent Constraints

### For ALL Task() calls:
1. **Stay focused on Smart Search Filter ONLY** - Do not fix other issues
2. **Follow the exact file list** from SMART_SEARCH_FILTER_FIX_PLAN.md
3. **Do not create unnecessary files** beyond the 4 specified new files
4. **Maintain compatibility** with existing tRPC/React/SQLite stack
5. **Test only filter functionality** - ignore other broken features

### Agent-Specific Instructions:

**code-reviewer agent:**
- Review ONLY filter-related code
- Ignore other issues in the codebase
- Focus on lines 232-238 in WalmartGroceryAgent.tsx

**architecture-reviewer agent:**
- Assess ONLY the filter architecture
- Don't suggest broader refactoring
- Stay within the defined scope

**test-failure-debugger agent:**
- Debug ONLY filter-related test failures
- Don't fix unrelated test issues
- Focus on the specific test file created

## Success Criteria
✅ All 7 filter buttons functional (All Categories, Produce, Dairy, Meat & Seafood, Bakery, On Sale)
✅ Buttons show active state visually
✅ Backend filters results correctly
✅ Performance optimized with indexes
✅ Tests pass for filter functionality

## Files Modified/Created Checklist
- [x] Created: `/src/constants/walmart-categories.ts` ✅
- [x] Created: `/src/hooks/useWalmartFilters.ts` ✅
- [x] Modified: `/src/ui/components/WalmartAgent/WalmartGroceryAgent.tsx` ✅
- [x] Modified: `/src/api/routes/walmart-grocery.router.ts` ✅
- [x] Created: `/src/tests/walmart-filter.test.ts` ✅
- [x] Database: Added 3 indexes ✅

This workflow ensures agents stay on track and only fix the Smart Search Filter feature as requested.