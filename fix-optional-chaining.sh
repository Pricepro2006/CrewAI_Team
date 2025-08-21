#!/bin/bash

# Fix TypeScript optional chaining assignment issues
# These cause "Invalid assignment target" errors

echo "Fixing optional chaining assignment issues..."

# Find all TypeScript files with potential issues
files=$(find /home/pricepro2006/CrewAI_Team/src -name "*.ts" -type f)

for file in $files; do
  # Check if file has problematic patterns
  if grep -q "?\.\w*\?\.\w*\s*=" "$file" 2>/dev/null || \
     grep -q "?\.\w*\?\.\w*++" "$file" 2>/dev/null || \
     grep -q "?\.\w*\?\.\w*\[" "$file" 2>/dev/null; then
    
    echo "Processing: $file"
    
    # Create a temporary file for the fixed content
    temp_file="${file}.tmp"
    
    # Use sed to fix common patterns (this is a simplified fix)
    # Note: This won't handle all cases perfectly but will fix most
    sed -E \
      -e 's/this\?\./this\./g' \
      -e 's/ctx\?\./ctx\./g' \
      -e 's/job\?\./job\./g' \
      -e 's/result\?\./result\./g' \
      -e 's/error\?\./error\./g' \
      -e 's/data\?\./data\./g' \
      "$file" > "$temp_file"
    
    # Only replace if changes were made
    if ! cmp -s "$file" "$temp_file"; then
      mv "$temp_file" "$file"
      echo "  Fixed: $file"
    else
      rm "$temp_file"
    fi
  fi
done

echo "Done fixing optional chaining issues"