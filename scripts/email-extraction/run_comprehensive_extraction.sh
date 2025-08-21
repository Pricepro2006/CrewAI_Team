#!/bin/bash

# Comprehensive Deep Email Extraction Script
# This script performs complete extraction of ALL emails from ALL folders and subfolders

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Default values
START_DATE=""
WORKERS=1
TEST_MODE=false
RESUME=true

# Function to display usage
usage() {
    echo -e "${CYAN}Usage: $0 [OPTIONS]${NC}"
    echo ""
    echo -e "${YELLOW}Options:${NC}"
    echo "  --start-date DATE    Start date for extraction (ISO format, e.g., 2024-01-01T00:00:00Z)"
    echo "  --workers N          Number of concurrent extractions (default: 1)"
    echo "  --test               Test mode: only process first mailbox"
    echo "  --fresh              Fresh start: ignore previous progress"
    echo "  --help               Show this help message"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  $0                                    # Extract all emails from all mailboxes"
    echo "  $0 --start-date 2024-01-01T00:00:00Z # Extract emails from 2024 onwards"
    echo "  $0 --test                            # Test with first mailbox only"
    echo "  $0 --fresh                           # Start fresh, ignore previous progress"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --start-date)
            START_DATE="$2"
            shift 2
            ;;
        --workers)
            WORKERS="$2"
            shift 2
            ;;
        --test)
            TEST_MODE=true
            shift
            ;;
        --fresh)
            RESUME=false
            shift
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            exit 1
            ;;
    esac
done

# Display header
echo -e "${PURPLE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║              COMPREHENSIVE DEEP EMAIL EXTRACTION          ║${NC}"
echo -e "${PURPLE}║          Extract ALL emails from ALL folders              ║${NC}"
echo -e "${PURPLE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check prerequisites
echo -e "${BLUE}🔍 Checking prerequisites...${NC}"

required_files=(
    "comprehensive_deep_extractor.py"
    "run_comprehensive_extraction.py"
    "config/mailboxes.json"
    "msal_device_auth.py"
    "graph_connector.py"
)

missing_files=()
for file in "${required_files[@]}"; do
    if [[ ! -f "$file" ]]; then
        missing_files+=("$file")
    fi
done

if [[ ${#missing_files[@]} -gt 0 ]]; then
    echo -e "${RED}❌ Missing required files:${NC}"
    for file in "${missing_files[@]}"; do
        echo -e "   ${RED}• $file${NC}"
    done
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites found${NC}"

# Display configuration
echo -e "${BLUE}📊 Extraction Configuration:${NC}"
mailbox_count=$(python3 -c "import json; print(len(json.load(open('config/mailboxes.json'))))")
echo -e "   📧 Mailboxes to process: ${YELLOW}$mailbox_count${NC}"
echo -e "   🗓️  Start date filter: ${YELLOW}${START_DATE:-All emails (no filter)}${NC}"
echo -e "   🔄 Concurrent workers: ${YELLOW}$WORKERS${NC}"
echo -e "   🧪 Test mode: ${YELLOW}$TEST_MODE${NC}"
echo -e "   📂 Database: ${YELLOW}data/email_analysis.db${NC}"

# Show mailboxes to be processed
echo -e "${BLUE}📋 Mailboxes to process:${NC}"
python3 -c "
import json
with open('config/mailboxes.json') as f:
    mailboxes = json.load(f)
for i, mb in enumerate(mailboxes, 1):
    priority_color = '\033[0;31m' if mb.get('priority') == 'high' else '\033[0;33m'
    print(f'   {priority_color}{i}. {mb[\"name\"]} ({mb[\"email\"]}) - {mb.get(\"priority\", \"medium\")} priority\033[0m')
"

# Warning about extraction scope
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT NOTES:${NC}"
echo -e "   • This will extract emails from ALL folders and subfolders (including archives)"
echo -e "   • Expected to find 60,000+ emails from T119889C alone"
echo -e "   • Total expected: 200,000+ emails from all mailboxes"
echo -e "   • This may take several hours to complete"
echo -e "   • Progress is saved and can be resumed if interrupted"

if [[ "$RESUME" == "false" ]]; then
    echo -e "${YELLOW}   • FRESH START: Previous progress will be ignored${NC}"
    echo ""
    echo -e "${RED}⚠️  This will remove previous extraction progress. Continue? (y/N)${NC}"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Extraction cancelled.${NC}"
        exit 0
    fi
    
    # Remove progress files
    echo -e "${BLUE}🗑️  Removing previous progress files...${NC}"
    rm -f deep_extraction_progress_*.json
    rm -f comprehensive_extraction_summary.json
fi

# Confirm extraction
echo ""
echo -e "${CYAN}Ready to start comprehensive extraction. Continue? (y/N)${NC}"
read -r response
if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Extraction cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}🚀 Starting comprehensive deep extraction...${NC}"

# Build Python command
python_cmd="python3 run_comprehensive_extraction.py"

if [[ -n "$START_DATE" ]]; then
    python_cmd="$python_cmd --start-date '$START_DATE'"
fi

if [[ "$WORKERS" != "1" ]]; then
    python_cmd="$python_cmd --workers $WORKERS"
fi

if [[ "$TEST_MODE" == "true" ]]; then
    python_cmd="$python_cmd --test-mode"
fi

# Start extraction with timestamp
echo -e "${BLUE}⏰ Started at: $(date)${NC}"
echo -e "${BLUE}📝 Command: $python_cmd${NC}"
echo ""

# Run the extraction
if eval "$python_cmd"; then
    echo ""
    echo -e "${GREEN}🎉 COMPREHENSIVE EXTRACTION COMPLETED SUCCESSFULLY!${NC}"
    echo -e "${BLUE}⏰ Finished at: $(date)${NC}"
    
    # Display quick summary if available
    if [[ -f "comprehensive_extraction_summary.json" ]]; then
        echo ""
        echo -e "${CYAN}📊 Quick Summary:${NC}"
        python3 -c "
import json
try:
    with open('comprehensive_extraction_summary.json') as f:
        summary = json.load(f)
    print(f'   📧 Total emails extracted: {summary.get(\"total_emails\", 0):,}')
    print(f'   📁 Total folders processed: {summary.get(\"total_folders\", 0)}')
    print(f'   ✅ Successful mailboxes: {summary.get(\"successful_mailboxes\", 0)}')
    print(f'   ❌ Failed mailboxes: {summary.get(\"failed_mailboxes\", 0)}')
    print(f'   ⏱️  Total time: {summary.get(\"total_duration_minutes\", 0):.1f} minutes')
except:
    print('   Summary file not found or invalid')
"
    fi
    
    echo ""
    echo -e "${GREEN}✅ Next step: Run email batching and analysis${NC}"
    echo -e "${BLUE}   Use: ./run_email_batching.sh${NC}"
    
else
    echo ""
    echo -e "${RED}❌ EXTRACTION FAILED!${NC}"
    echo -e "${YELLOW}Check the logs for details:${NC}"
    echo -e "   • comprehensive_extraction.log"
    echo -e "   • deep_extraction.log"
    echo ""
    echo -e "${BLUE}You can resume the extraction later by running the same command${NC}"
    exit 1
fi