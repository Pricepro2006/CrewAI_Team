#!/bin/bash

echo "🔍 CrewAI Team Framework - Critical Issues Verification"
echo "======================================================"
echo ""
echo "This script will verify that all critical issues have been resolved,"
echo "particularly the 300+ second timeout issue."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Ollama is running
echo "Checking Ollama status..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Ollama is running${NC}"
else
    echo -e "${YELLOW}⚠️  Ollama is not running. Starting Ollama...${NC}"
    ollama serve > /dev/null 2>&1 &
    sleep 3
    
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Ollama started successfully${NC}"
    else
        echo -e "${RED}❌ Failed to start Ollama. Some tests will be skipped.${NC}"
    fi
fi

echo ""
echo "Ensuring test model is available..."
ollama pull qwen2.5:0.5b > /dev/null 2>&1 || echo -e "${YELLOW}⚠️  Could not pull test model${NC}"

echo ""
echo "Running critical issues verification tests..."
echo "============================================"
echo ""

# Run the test
pnpm test src/test/system/critical-issues-verification.test.ts

echo ""
echo "Test complete! Check CRITICAL_ISSUES_RESOLVED.md for the full report."
echo ""

# Show summary from the report if it exists
if [ -f "CRITICAL_ISSUES_RESOLVED.md" ]; then
    echo "Report Summary:"
    echo "---------------"
    head -n 20 CRITICAL_ISSUES_RESOLVED.md | grep -E "(Status|Generated|Tests Passed|✅|❌)"
fi