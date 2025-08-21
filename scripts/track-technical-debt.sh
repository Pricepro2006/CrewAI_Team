#!/bin/bash

# Technical Debt Tracking Script
# Tracks progress on key metrics daily

echo "================================================"
echo "📊 TECHNICAL DEBT METRICS TRACKER"
echo "📅 Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Base directory
BASE_DIR="/home/pricepro2006/CrewAI_Team"
SRC_DIR="$BASE_DIR/src"

# Metric 1: Codebase Size
echo -e "${BLUE}📁 CODEBASE SIZE${NC}"
echo "------------------------"
TS_FILES=$(find "$BASE_DIR" -name "*.ts" -o -name "*.tsx" | grep -v node_modules | grep -v dist | wc -l)
TSX_FILES=$(find "$SRC_DIR" -name "*.tsx" | grep -v node_modules | wc -l)
echo "TypeScript Files: $TS_FILES"
echo "React Components: $TSX_FILES"
echo ""

# Metric 2: Test Coverage
echo -e "${BLUE}🧪 TEST COVERAGE${NC}"
echo "------------------------"
TEST_FILES=$(find "$BASE_DIR" -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" -o -name "*.spec.tsx" | grep -v node_modules | wc -l)
echo "Test Files: $TEST_FILES"

# Estimate coverage percentage (rough calculation)
COVERAGE_PCT=$((TEST_FILES * 100 / TS_FILES))
if [ $COVERAGE_PCT -lt 20 ]; then
    echo -e "Coverage Estimate: ${RED}~${COVERAGE_PCT}% ⚠️ CRITICAL${NC}"
elif [ $COVERAGE_PCT -lt 60 ]; then
    echo -e "Coverage Estimate: ${YELLOW}~${COVERAGE_PCT}% ⚠️ INSUFFICIENT${NC}"
else
    echo -e "Coverage Estimate: ${GREEN}~${COVERAGE_PCT}% ✅ GOOD${NC}"
fi
echo ""

# Metric 3: Technical Debt
echo -e "${BLUE}🔧 TECHNICAL DEBT${NC}"
echo "------------------------"
TODO_COUNT=$(grep -r "TODO\|FIXME" "$SRC_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
ANY_COUNT=$(grep -r ": any" "$SRC_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)

echo "TODO/FIXME Comments: $TODO_COUNT"
if [ $TODO_COUNT -gt 100 ]; then
    echo -e "  Status: ${RED}⚠️ HIGH DEBT${NC}"
elif [ $TODO_COUNT -gt 50 ]; then
    echo -e "  Status: ${YELLOW}⚠️ MODERATE DEBT${NC}"
else
    echo -e "  Status: ${GREEN}✅ MANAGEABLE${NC}"
fi

echo "'any' Type Usages: $ANY_COUNT"
if [ $ANY_COUNT -gt 1000 ]; then
    echo -e "  Status: ${RED}⚠️ CRITICAL - Type safety compromised${NC}"
elif [ $ANY_COUNT -gt 500 ]; then
    echo -e "  Status: ${YELLOW}⚠️ HIGH - Needs attention${NC}"
else
    echo -e "  Status: ${GREEN}✅ ACCEPTABLE${NC}"
fi
echo ""

# Additional Metrics
echo -e "${BLUE}📈 ADDITIONAL METRICS${NC}"
echo "------------------------"

# Count console.log statements (code smell)
CONSOLE_COUNT=$(grep -r "console\." "$SRC_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
echo "Console statements: $CONSOLE_COUNT"

# Count eslint-disable comments (suppressed warnings)
ESLINT_DISABLE=$(grep -r "eslint-disable" "$SRC_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
echo "ESLint disabled: $ESLINT_DISABLE"

# Count ts-ignore comments (TypeScript overrides)
TS_IGNORE=$(grep -r "@ts-ignore\|@ts-nocheck\|@ts-expect-error" "$SRC_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
echo "TypeScript ignored: $TS_IGNORE"
echo ""

# Progress Tracking (compare with targets)
echo -e "${BLUE}🎯 PROGRESS VS TARGETS${NC}"
echo "------------------------"
echo "Metric          | Current | Target | Status"
echo "----------------|---------|--------|--------"
printf "Test Coverage   | ~%d%%    | 60%%    | " $COVERAGE_PCT
if [ $COVERAGE_PCT -lt 60 ]; then
    echo -e "${RED}❌${NC}"
else
    echo -e "${GREEN}✅${NC}"
fi

printf "TODO/FIXME      | %d     | 72     | " $TODO_COUNT
if [ $TODO_COUNT -gt 72 ]; then
    echo -e "${RED}❌${NC}"
else
    echo -e "${GREEN}✅${NC}"
fi

printf "'any' Types     | %d   | 330    | " $ANY_COUNT
if [ $ANY_COUNT -gt 330 ]; then
    echo -e "${RED}❌${NC}"
else
    echo -e "${GREEN}✅${NC}"
fi
echo ""

# Risk Assessment
echo -e "${BLUE}⚠️  RISK ASSESSMENT${NC}"
echo "------------------------"
RISK_SCORE=0

if [ $COVERAGE_PCT -lt 20 ]; then
    echo -e "${RED}• CRITICAL: Test coverage below 20%${NC}"
    RISK_SCORE=$((RISK_SCORE + 3))
fi

if [ $ANY_COUNT -gt 1500 ]; then
    echo -e "${RED}• CRITICAL: Type safety severely compromised${NC}"
    RISK_SCORE=$((RISK_SCORE + 3))
fi

if [ $TODO_COUNT -gt 200 ]; then
    echo -e "${YELLOW}• WARNING: High technical debt accumulation${NC}"
    RISK_SCORE=$((RISK_SCORE + 2))
fi

if [ $CONSOLE_COUNT -gt 100 ]; then
    echo -e "${YELLOW}• WARNING: Excessive console logging${NC}"
    RISK_SCORE=$((RISK_SCORE + 1))
fi

echo ""
echo -n "Overall Risk Level: "
if [ $RISK_SCORE -ge 6 ]; then
    echo -e "${RED}CRITICAL (Score: $RISK_SCORE)${NC}"
elif [ $RISK_SCORE -ge 3 ]; then
    echo -e "${YELLOW}HIGH (Score: $RISK_SCORE)${NC}"
else
    echo -e "${GREEN}MODERATE (Score: $RISK_SCORE)${NC}"
fi

echo ""
echo "================================================"
echo "💡 Run 'pnpm test:coverage' for detailed coverage"
echo "💡 Run 'npx tsc --noEmit --strict' for type checking"
echo "================================================"

# Save metrics to log file
LOG_FILE="$BASE_DIR/technical-debt-metrics.log"
echo "$(date '+%Y-%m-%d %H:%M:%S'),${TS_FILES},${TEST_FILES},${TODO_COUNT},${ANY_COUNT},${CONSOLE_COUNT}" >> "$LOG_FILE"
echo ""
echo "📝 Metrics saved to: $LOG_FILE"