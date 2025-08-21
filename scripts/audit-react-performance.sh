#!/bin/bash

echo "==================================="
echo "React Component Performance Audit"
echo "==================================="
echo ""

echo "1. Checking for useEffect without dependency arrays..."
echo "----------------------------------------------"
grep -r "useEffect(\s*(\s*)\s*=>" src/ui src/client --include="*.tsx" --include="*.jsx" -l 2>/dev/null | head -10
echo ""

echo "2. Checking for rapid polling intervals (< 1000ms)..."
echo "----------------------------------------------"
grep -rE "setInterval\([^,]+,\s*[0-9]{1,3}\)" src/ui src/client --include="*.tsx" --include="*.jsx" 2>/dev/null | head -10
echo ""

echo "3. Checking for missing useEffect cleanup..."
echo "----------------------------------------------"
echo "Files with setInterval/setTimeout but no cleanup:"
for file in $(grep -r "setInterval\|setTimeout" src/ui src/client --include="*.tsx" --include="*.jsx" -l 2>/dev/null); do
    if ! grep -q "return.*clear" "$file"; then
        echo "  ⚠️  $file"
    fi
done | head -10
echo ""

echo "4. Checking for setState in render path..."
echo "----------------------------------------------"
grep -r "render.*setState\|setState.*render" src/ui src/client --include="*.tsx" --include="*.jsx" 2>/dev/null | head -10
echo ""

echo "5. Checking for heavy computations without useMemo..."
echo "----------------------------------------------"
echo "Files with .map/.filter/.reduce but no useMemo:"
for file in $(grep -r "\.map\|\.filter\|\.reduce" src/ui src/client --include="*.tsx" --include="*.jsx" -l 2>/dev/null | head -20); do
    if ! grep -q "useMemo" "$file"; then
        echo "  📊 $file"
    fi
done | head -10
echo ""

echo "6. Components with multiple useState calls (potential optimization)..."
echo "----------------------------------------------"
for file in $(find src/ui src/client -name "*.tsx" -o -name "*.jsx" 2>/dev/null | head -30); do
    count=$(grep -c "useState" "$file" 2>/dev/null || echo 0)
    if [ "$count" -gt 5 ]; then
        echo "  $file: $count useState calls"
    fi
done
echo ""

echo "7. WebSocket connections without proper cleanup..."
echo "----------------------------------------------"
grep -r "new WebSocket\|io(" src/ui src/client --include="*.tsx" --include="*.jsx" -l 2>/dev/null | while read file; do
    if ! grep -q "close()\|disconnect()" "$file"; then
        echo "  ⚠️  $file"
    fi
done | head -10
echo ""

echo "Summary Report:"
echo "----------------------------------------------"
total_components=$(find src/ui src/client -name "*.tsx" -o -name "*.jsx" 2>/dev/null | wc -l)
components_with_effects=$(grep -r "useEffect" src/ui src/client --include="*.tsx" --include="*.jsx" -l 2>/dev/null | wc -l)
components_with_intervals=$(grep -r "setInterval" src/ui src/client --include="*.tsx" --include="*.jsx" -l 2>/dev/null | wc -l)

echo "Total React components: $total_components"
echo "Components with useEffect: $components_with_effects"
echo "Components with intervals: $components_with_intervals"
echo ""
echo "Audit complete!"