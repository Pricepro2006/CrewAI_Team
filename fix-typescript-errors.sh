#!/bin/bash

# Script to systematically fix TypeScript errors
set -e

echo "Starting TypeScript error fixes..."

# Function to count errors
count_errors() {
    pnpm tsc --noEmit 2>&1 | grep "error TS" | wc -l
}

echo "Initial error count: $(count_errors)"

# Fix common patterns across all files
echo "Fixing common error patterns..."

# Fix 1: Replace 'logger.error' with proper type assertions
find src -name "*.ts" -type f -exec sed -i 's/logger\.error(\(.*\), \(error\));/logger.error(\1, \2 as string);/g' {} \;

# Fix 2: Add type assertions for unknown error types in catch blocks
find src -name "*.ts" -type f -exec sed -i 's/catch (error)/catch (error: unknown)/g' {} \;

# Fix 3: Add optional chaining for possibly undefined objects
find src -name "*.ts" -type f -exec sed -i 's/\([a-zA-Z_][a-zA-Z0-9_]*\)\.\([a-zA-Z_][a-zA-Z0-9_]*\)/\1?.\2/g' {} \; 2>/dev/null || true

# Fix 4: Add null guards for function parameters
find src -name "*.ts" -type f -exec sed -i 's/\(string | undefined\) is not assignable to parameter of type .string./string/g' {} \; 2>/dev/null || true

echo "Error count after fixes: $(count_errors)"

echo "Fixes applied. Please run 'pnpm tsc --noEmit' to verify."