#!/bin/bash

echo "Fixing malformed import paths in TypeScript files..."

# Fix paths with ?.js?.js pattern
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/"\.\.\([^"]*\)\?\.js\?\.js"/"..\1.js"/g' {} \;

# Fix paths with four dots
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/"\.\.\.\.\//"..\/..\/"/g' {} \;

# Fix paths with ..llm pattern (missing slash)
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/"\.\.llm/"..\/llm/g' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/"\.\.agents/"..\/agents/g' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/"\.\.rag/"..\/rag/g' {} \;

echo "Import paths fixed!"