#!/bin/bash
# Script to update all occurrences of port 11434 to 8081 for llama.cpp

echo "Updating LLM port configuration from 11434 (Ollama) to 8081 (llama.cpp)..."

# Count occurrences before
BEFORE_COUNT=$(grep -r "11434" src --include="*.ts" --include="*.tsx" | wc -l)
echo "Found $BEFORE_COUNT occurrences of port 11434 before update"

# Update all TypeScript and TSX files in src directory
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i.bak \
  -e 's/localhost:11434/localhost:8081/g' \
  -e 's/:11434/:8081/g' \
  -e "s/'11434'/'8081'/g" \
  -e 's/"11434"/"8081"/g' {} \;

# Update shell scripts
find scripts -type f -name "*.sh" -exec sed -i.bak \
  -e 's/localhost:11434/localhost:8081/g' \
  -e 's/:11434/:8081/g' {} \;

# Update test files
find tests -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) -exec sed -i.bak \
  -e 's/localhost:11434/localhost:8081/g' \
  -e 's/:11434/:8081/g' {} \;

# Count occurrences after
AFTER_COUNT=$(grep -r "11434" src --include="*.ts" --include="*.tsx" | wc -l)
echo "Found $AFTER_COUNT occurrences of port 11434 after update"

# Clean up backup files
find src scripts tests -name "*.bak" -delete

echo "Port configuration update complete!"
echo "Updated $(($BEFORE_COUNT - $AFTER_COUNT)) occurrences"

# Show any remaining occurrences in non-source files
if [ $AFTER_COUNT -gt 0 ]; then
  echo "Remaining occurrences in source files:"
  grep -r "11434" src --include="*.ts" --include="*.tsx" | head -10
fi