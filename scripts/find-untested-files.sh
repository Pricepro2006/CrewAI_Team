#!/bin/bash

# Find files without corresponding test files
echo "Files without tests:"
echo "===================="

count=0
for file in $(find /home/pricepro2006/CrewAI_Team/src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*"); do
  # Skip test files themselves
  if [[ "$file" == *".test."* ]] || [[ "$file" == *".spec."* ]]; then
    continue
  fi
  
  # Check for corresponding test files
  base="${file%.*}"
  ext="${file##*.}"
  
  testfile1="${base}.test.${ext}"
  testfile2="${base}.spec.${ext}"
  
  if [[ ! -f "$testfile1" && ! -f "$testfile2" ]]; then
    echo "$file"
    ((count++))
    if [ $count -ge 20 ]; then
      break
    fi
  fi
done

echo ""
echo "Total files checked: $(find /home/pricepro2006/CrewAI_Team/src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*" | wc -l)"
echo "Showing first 20 untested files..."