#!/bin/bash

echo "🧹 Cleaning up test environment..."

# Kill test-related processes
pkill -f "playwright" 2>/dev/null || true
pkill -f "walmart-test" 2>/dev/null || true

# Clean test artifacts
rm -rf test-results/*
rm -rf playwright-report
rm -rf tests/walmart-ui-comprehensive/screenshots/*.png 2>/dev/null || true
rm -rf tests/walmart-ui-comprehensive/videos/*.webm 2>/dev/null || true
rm -rf tests/walmart-ui-comprehensive/reports/*.json 2>/dev/null || true

# Reset Walmart test database to clean state
if [ -f "scripts/init-walmart-test-data.sql" ]; then
    if command -v sqlite3 &> /dev/null; then
        sqlite3 data/walmart_grocery.db < scripts/init-walmart-test-data.sql
        echo "✅ Walmart test database reset"
    fi
fi

# Clean temporary files
rm -f /tmp/walmart-test-* 2>/dev/null || true

echo "✅ Test environment cleaned"
