#!/bin/bash
CURRENT_ERRORS=$(npx tsc --noEmit 2>&1 | grep "error TS" | wc -l)
echo "$(date): $CURRENT_ERRORS errors remaining" >> progress.log
echo "Current: $CURRENT_ERRORS | Target: <500 (Phase 4A) | Ultimate: <200 (Phase 4B)"

# Check for major regression (>50 error increase)
if [ -f "last-count.txt" ]; then
    LAST_COUNT=$(cat last-count.txt)
    DIFF=$((CURRENT_ERRORS - LAST_COUNT))
    if [ $DIFF -gt 50 ]; then
        echo "⚠️  WARNING: Error count increased by $DIFF errors!"
        echo "Consider rollback if issues persist."
    elif [ $DIFF -lt -50 ]; then
        echo "✅ PROGRESS: $((DIFF * -1)) errors fixed!"
    fi
fi

echo $CURRENT_ERRORS > last-count.txt
