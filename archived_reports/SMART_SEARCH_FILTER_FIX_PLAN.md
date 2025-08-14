# Smart Search Filter Buttons - Implementation Plan

## Problem Statement
The Smart Search filter buttons (Produce, Dairy, Meat & Seafood, Bakery, On Sale) are hardcoded UI elements with no backend functionality. They don't filter search results when clicked.

## Files That Need Modification

### 1. Frontend Components

#### Primary Component Files:
- **`/src/ui/components/WalmartAgent/WalmartGroceryAgent.tsx`** (Lines 232-238)
  - Contains the hardcoded filter buttons
  - Missing onClick handlers
  - No state management for active filters
  - No filter application logic

- **`/src/ui/components/Walmart/WalmartNLPSearch.tsx`**
  - Secondary component that may need similar filter functionality
  - Shares product display logic

### 2. State Management

#### New Files to Create:
- **`/src/hooks/useWalmartFilters.ts`** (NEW)
  - Custom hook for filter state management
  - Filter application logic
  - Category mapping

### 3. Backend API Routes

#### Existing Routes to Modify:
- **`/src/api/routes/walmart-grocery.router.ts`** (Lines 150-250)
  - searchProducts procedure needs to handle category filtering
  - Currently accepts `category` param but doesn't use it effectively
  - Need to add proper WHERE clauses for filtering

### 4. Database Queries

#### SQL/Query Files:
- **`/src/api/services/WalmartGroceryService.ts`** (if exists)
  - Service layer that handles database queries
  - Needs filter implementation in query builders

### 5. Type Definitions

#### TypeScript Interfaces:
- **`/src/types/walmart-grocery.ts`**
  - May need to add filter-related types
  - Category enum definitions

### 6. Database Schema

#### Current State:
- Table: `walmart_products`
- Relevant columns: 
  - `category_path` (TEXT) - stores category hierarchy
  - `department` (TEXT) - department name
  - `current_price` (REAL) - for "On Sale" filter
  - `regular_price` (REAL) - for price comparison

## Implementation Steps

### Step 1: Define Categories
Create category constants and mappings:
```typescript
// src/constants/walmart-categories.ts
export const WALMART_CATEGORIES = {
  PRODUCE: ['Fruits', 'Vegetables', 'Fresh Produce'],
  DAIRY: ['Milk', 'Cheese', 'Yogurt', 'Dairy & Eggs'],
  MEAT_SEAFOOD: ['Meat', 'Seafood', 'Poultry', 'Fresh Meat'],
  BAKERY: ['Bread', 'Bakery', 'Desserts', 'Cakes'],
  ON_SALE: 'special' // Special filter for discounted items
} as const;
```

### Step 2: Create Filter Hook
```typescript
// src/hooks/useWalmartFilters.ts
export const useWalmartFilters = () => {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['All Categories']));
  
  const toggleFilter = (filter: string) => {
    // Implementation
  };
  
  const applyFiltersToResults = (results: WalmartProduct[], filters: Set<string>) => {
    // Filter logic
  };
  
  return { activeFilters, toggleFilter, applyFiltersToResults };
};
```

### Step 3: Update Component
Modify WalmartGroceryAgent.tsx to:
1. Import and use the filter hook
2. Add onClick handlers to filter buttons
3. Apply filters to search results before rendering
4. Update button classes based on active state

### Step 4: Backend Query Modification
Update the searchProducts procedure to:
1. Parse category filters from input
2. Build appropriate WHERE clauses
3. Handle "On Sale" as a special case (current_price < regular_price)

### Step 5: Database Optimization
Add indexes for better performance:
```sql
CREATE INDEX idx_walmart_products_category ON walmart_products(category_path);
CREATE INDEX idx_walmart_products_department ON walmart_products(department);
CREATE INDEX idx_walmart_products_price ON walmart_products(current_price, regular_price);
```

## Files Summary

### Must Modify (Core Functionality):
1. `/src/ui/components/WalmartAgent/WalmartGroceryAgent.tsx`
2. `/src/api/routes/walmart-grocery.router.ts`

### Must Create (New):
3. `/src/hooks/useWalmartFilters.ts`
4. `/src/constants/walmart-categories.ts`

### Should Modify (Complete Integration):
5. `/src/ui/components/Walmart/WalmartNLPSearch.tsx`
6. `/src/types/walmart-grocery.ts`

### Database (Performance):
7. Add indexes via migration script

## Testing Requirements
1. Filter buttons should toggle active state visually
2. Multiple filters can be active simultaneously
3. "All Categories" deselects other filters
4. Results update immediately on filter change
5. Filter state persists during session
6. "On Sale" filter shows only discounted items
7. Empty results show appropriate message

## Estimated Implementation Time
- Frontend changes: 2-3 hours
- Backend changes: 1-2 hours
- Testing & debugging: 1-2 hours
- **Total: 4-7 hours**