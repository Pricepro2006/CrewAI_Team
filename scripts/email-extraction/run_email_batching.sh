#!/bin/bash

# Email Batching Script - Create batches from extracted emails
# This script creates email batches with notification filtering and TD SYNNEX footer removal

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
DB_PATH="email_database.db"
OUTPUT_DIR="email_batches"
LIMIT=""

# Function to display usage
usage() {
    echo -e "${CYAN}Usage: $0 [OPTIONS]${NC}"
    echo ""
    echo -e "${YELLOW}Options:${NC}"
    echo "  --db-path PATH       Path to SQLite database (default: email_database.db)"
    echo "  --output-dir DIR     Output directory for batches (default: email_batches)"
    echo "  --limit N            Limit number of emails to process (for testing)"
    echo "  --help               Show this help message"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  $0                                    # Process all emails in database"
    echo "  $0 --limit 1000                      # Process only first 1000 emails (testing)"
    echo "  $0 --output-dir custom_batches       # Use custom output directory"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --db-path)
            DB_PATH="$2"
            shift 2
            ;;
        --output-dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --limit)
            LIMIT="$2"
            shift 2
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
echo -e "${PURPLE}║                 EMAIL BATCHING SYSTEM                      ║${NC}"
echo -e "${PURPLE}║       Create batches with notification filtering          ║${NC}"
echo -e "${PURPLE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if database exists
if [[ ! -f "$DB_PATH" ]]; then
    echo -e "${RED}❌ Database not found: $DB_PATH${NC}"
    echo -e "${YELLOW}Run email extraction first with: ./run_comprehensive_extraction.sh${NC}"
    exit 1
fi

# Check prerequisites
echo -e "${BLUE}🔍 Checking prerequisites...${NC}"

if [[ ! -f "comprehensive_email_batcher.py" ]]; then
    echo -e "${RED}❌ comprehensive_email_batcher.py not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites found${NC}"

# Get database statistics
echo -e "${BLUE}📊 Database Analysis:${NC}"
python3 -c "
import sqlite3
import sys

try:
    conn = sqlite3.connect('$DB_PATH')
    cursor = conn.cursor()
    
    # Total emails
    cursor.execute('SELECT COUNT(*) FROM emails')
    total = cursor.fetchone()[0]
    print(f'   📧 Total emails in database: {total:,}')
    
    # By mailbox
    cursor.execute('SELECT mailbox_email, COUNT(*) FROM emails GROUP BY mailbox_email ORDER BY COUNT(*) DESC')
    print('   📬 By mailbox:')
    for mailbox, count in cursor.fetchall():
        print(f'      • {mailbox}: {count:,} emails')
    
    # By year
    cursor.execute('SELECT year, COUNT(*) FROM emails WHERE year > 0 GROUP BY year ORDER BY year DESC')
    years = cursor.fetchall()
    if years:
        print('   📅 By year:')
        for year, count in years:
            print(f'      • {year}: {count:,} emails')
    
    # Folders
    cursor.execute('SELECT COUNT(DISTINCT folder_path) FROM emails WHERE folder_path IS NOT NULL')
    folders = cursor.fetchone()[0]
    print(f'   📁 Unique folders: {folders}')
    
    conn.close()
    
    if total == 0:
        print('\n⚠️  No emails found in database. Run extraction first.')
        sys.exit(1)
    elif total < 50000:
        print(f'\n⚠️  Email count ({total:,}) seems low. Expected 200,000+ for complete extraction.')
    else:
        print(f'\n✅ Good email volume ({total:,}) detected.')
        
except Exception as e:
    print(f'❌ Error accessing database: {e}')
    sys.exit(1)
"

if [[ $? -ne 0 ]]; then
    exit 1
fi

# Display batching configuration
echo ""
echo -e "${BLUE}⚙️  Batching Configuration:${NC}"
echo -e "   📂 Database: ${YELLOW}$DB_PATH${NC}"
echo -e "   📁 Output directory: ${YELLOW}$OUTPUT_DIR${NC}"
echo -e "   📦 Business batch size: ${YELLOW}10 emails${NC}"
echo -e "   🔔 Notification batch size: ${YELLOW}25 notifications${NC}"
echo -e "   📏 Max body length: ${YELLOW}2000 characters${NC}"
if [[ -n "$LIMIT" ]]; then
    echo -e "   🔢 Email limit: ${YELLOW}$LIMIT emails (testing mode)${NC}"
else
    echo -e "   🔢 Email limit: ${YELLOW}No limit (process all)${NC}"
fi

echo ""
echo -e "${BLUE}🧹 Content Processing:${NC}"
echo -e "   • Notification email filtering and classification"
echo -e "   • TD SYNNEX footer/disclaimer removal"
echo -e "   • Intelligent content truncation (preserve important parts)"
echo -e "   • Quoted content removal"
echo -e "   • Attachment metadata simplification"

# Confirm processing
echo ""
echo -e "${CYAN}Ready to create email batches. Continue? (y/N)${NC}"
read -r response
if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Batching cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}🚀 Starting email batching process...${NC}"

# Build Python command
python_cmd="python3 comprehensive_email_batcher.py --db-path '$DB_PATH'"

if [[ -n "$OUTPUT_DIR" && "$OUTPUT_DIR" != "email_batches" ]]; then
    python_cmd="$python_cmd --output-dir '$OUTPUT_DIR'"
fi

if [[ -n "$LIMIT" ]]; then
    python_cmd="$python_cmd --limit $LIMIT"
fi

# Start batching with timestamp
echo -e "${BLUE}⏰ Started at: $(date)${NC}"
echo -e "${BLUE}📝 Command: $python_cmd${NC}"
echo ""

# Run the batching
if eval "$python_cmd"; then
    echo ""
    echo -e "${GREEN}🎉 EMAIL BATCHING COMPLETED SUCCESSFULLY!${NC}"
    echo -e "${BLUE}⏰ Finished at: $(date)${NC}"
    
    # Display results
    if [[ -f "$OUTPUT_DIR/batch_processing_summary.json" ]]; then
        echo ""
        echo -e "${CYAN}📊 Batching Summary:${NC}"
        python3 -c "
import json
try:
    with open('$OUTPUT_DIR/batch_processing_summary.json') as f:
        summary = json.load(f)
    print(f'   📧 Total emails processed: {summary.get(\"total_emails\", 0):,}')
    print(f'   💼 Business emails: {summary.get(\"business_emails\", 0):,} ({summary.get(\"business_batches\", 0)} batches)')
    print(f'   🔔 Notification emails: {summary.get(\"notification_emails\", 0):,} ({summary.get(\"notification_batches\", 0)} batches)')
    print(f'   📁 Business batches: $OUTPUT_DIR/')
    print(f'   📁 Notification batches: $OUTPUT_DIR/notification_batches/')
except Exception as e:
    print(f'   ⚠️  Could not read summary: {e}')
"
    fi
    
    # List batch files
    echo ""
    echo -e "${BLUE}📋 Generated Batch Files:${NC}"
    business_count=$(find "$OUTPUT_DIR" -name "emails_batch_*.json" -type f 2>/dev/null | wc -l)
    notification_count=$(find "$OUTPUT_DIR/notification_batches" -name "notifications_batch_*.json" -type f 2>/dev/null | wc -l)
    
    echo -e "   💼 Business email batches: ${YELLOW}$business_count files${NC}"
    echo -e "   🔔 Notification batches: ${YELLOW}$notification_count files${NC}"
    
    if [[ $business_count -gt 0 ]]; then
        echo ""
        echo -e "${GREEN}✅ Next step: Process batches with Claude AI analysis${NC}"
        echo -e "${BLUE}   Business batches are ready for workflow analysis${NC}"
        echo -e "${BLUE}   Location: $OUTPUT_DIR/emails_batch_*.json${NC}"
    fi
    
else
    echo ""
    echo -e "${RED}❌ BATCHING FAILED!${NC}"
    echo -e "${YELLOW}Check the logs for details:${NC}"
    echo -e "   • email_batching.log"
    exit 1
fi