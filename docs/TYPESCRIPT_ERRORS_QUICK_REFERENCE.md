# TypeScript Errors Quick Reference Guide

## 🔥 Critical Error Hotspots

### 1. Security Middleware Context Issues
**Files:** `src/api/middleware/security/*`  
**Problem:** Missing logger and PERMISSIONS properties on security context  
**Quick Fix:**
```typescript
// Add to security context type definition
interface SecurityContext {
  logger: Logger;
  PERMISSIONS: PermissionsMap;
  // ... other properties
}
```

### 2. Walmart Component Type Mismatches
**Files:** `src/client/components/walmart/*`  
**Total Errors:** 100+ across 5 components  
**Main Issues:**
- WalmartSubstitutionManager.tsx (41 errors)
- WalmartUserPreferences.tsx (32 errors)
- WalmartDealAlert.tsx (24 errors)

**Common Pattern:**
```typescript
// Problem: Props not properly typed
interface WalmartComponentProps {
  data?: WalmartData; // Make optional with ?
  onUpdate: (data: WalmartData) => void;
}
```

### 3. Service Layer Type Issues
**Files:** `src/services/*`, `src/api/services/*`  
**Problem:** Missing return types and undefined handling  
**Pattern to Fix:**
```typescript
// Before
async processEmail(email) { // implicit any
  return email.process(); // might be undefined
}

// After
async processEmail(email: Email): Promise<ProcessedEmail | null> {
  return email?.process() ?? null;
}
```

### 4. Router Return Value Issues
**Files:** `src/api/routes/*.router.ts`  
**Error:** TS7030 - Not all code paths return a value  
**Quick Fix Template:**
```typescript
router.get('/endpoint', async (req, res) => {
  try {
    // ... logic
    return res.json(data);
  } catch (error) {
    // MUST return here too!
    return res.status(500).json({ error });
  }
  // Add default return if needed
});
```

## 🚀 Fast Fix Commands

### Batch Fix Undefined Types
```bash
# Find all undefined type assignments
grep -r "Type 'string | undefined'" src/ --include="*.ts" --include="*.tsx"

# Add default values in bulk (careful review needed)
find src -name "*.ts" -exec sed -i 's/: string = \(.*\)/: string = \1 || ""/g' {} \;
```

### Fix Import Extensions
```bash
# Remove .ts extensions from imports
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i "s/from '\(.*\)\.ts'/from '\1'/g"
```

### Add Missing Return Statements
```bash
# Find functions missing returns
grep -n "TS7030" typescript-errors.log | cut -d: -f1 | sort -u
```

## 📊 Error Distribution by Component

```
UI Components:      35% ████████████████████
API Routes:         25% ██████████████
Services:           20% ███████████
Middleware:         10% ██████
Database:           5%  ███
Utils/Helpers:      5%  ███
```

## 🔧 Priority Fix Order

### Week 1 - Foundation (High Impact)
1. ✅ Fix security middleware context (affects all routes)
2. ✅ Resolve service layer undefined handling
3. ✅ Add missing return statements in routers

### Week 2 - Type Safety
1. ✅ Update Walmart component props
2. ✅ Fix email service type annotations
3. ✅ Resolve unknown type handling

### Week 3 - Clean Up
1. ✅ Remove .ts extensions from imports
2. ✅ Fix logger singleton pattern
3. ✅ Update test mock types

## 🎯 Top 10 Quick Wins

1. **Add logger to context** - Fixes 50+ errors instantly
2. **Update User type import** - Resolves auth issues
3. **Fix Redis constructor** - Unblocks server startup
4. **Add return statements** - 43 functions fixed
5. **Remove .ts extensions** - 29 import errors gone
6. **Type email parameters** - 131 unknown types resolved
7. **Add null checks** - 98 undefined access fixed
8. **Update WebSocket types** - Server compatibility
9. **Fix rate limiter imports** - Middleware operational
10. **Add missing exports** - Module resolution fixed

## 💡 Common Patterns & Solutions

### Pattern: Undefined Assignment
```typescript
// ❌ Error
const name: string = getUserName(); // might return undefined

// ✅ Fix 1: Optional chaining + nullish coalescing
const name: string = getUserName() ?? 'Anonymous';

// ✅ Fix 2: Type guard
const userName = getUserName();
if (userName) {
  const name: string = userName;
}

// ✅ Fix 3: Change type to allow undefined
const name: string | undefined = getUserName();
```

### Pattern: Missing Properties
```typescript
// ❌ Error
interface Context {
  user: User;
}
ctx.logger.info('test'); // Property 'logger' does not exist

// ✅ Fix: Extend interface
interface Context {
  user: User;
  logger: Logger;
}
```

### Pattern: Implicit Any
```typescript
// ❌ Error
function process(data) { // Parameter 'data' implicitly has an 'any' type

// ✅ Fix: Add type annotation
function process(data: ProcessData) {
```

## 🔍 Verification Commands

```bash
# Check if errors are decreasing
npx tsc --noEmit 2>&1 | wc -l

# Get current error count by type
npx tsc --noEmit 2>&1 | grep -oE "TS[0-9]+" | sort | uniq -c | sort -rn

# Find files with most errors
npx tsc --noEmit 2>&1 | cut -d'(' -f1 | sort | uniq -c | sort -rn | head -10

# Check specific file
npx tsc --noEmit --skipLibCheck src/path/to/file.ts
```

## 📈 Progress Tracker

| Date | Total Errors | Files Affected | Coverage |
|------|--------------|----------------|----------|
| Aug 14 | 3,643 | 100+ | ~60% |
| Target | 0 | 0 | 95%+ |

---

*Use this guide for quick fixes. Full documentation in TYPESCRIPT_ERRORS_LOG.md*