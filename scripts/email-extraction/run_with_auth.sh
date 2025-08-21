#!/bin/bash

# Run Comprehensive Extraction with Authentication
# This script handles the authentication flow and then runs comprehensive extraction

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

echo -e "${PURPLE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║           COMPREHENSIVE EMAIL EXTRACTION                  ║${NC}"
echo -e "${PURPLE}║              WITH AUTHENTICATION                          ║${NC}"
echo -e "${PURPLE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check if token is valid
check_token() {
    if [[ ! -f "access_token.json" ]]; then
        return 1
    fi
    
    python3 -c "
import json
import time
try:
    with open('access_token.json') as f:
        token = json.load(f)
    expires_on = token.get('expires_on', 0)
    valid = time.time() < expires_on - 300  # 5 minute buffer
    exit(0 if valid else 1)
except:
    exit(1)
" 2>/dev/null
}

echo -e "${BLUE}🔍 Checking authentication status...${NC}"

if check_token; then
    echo -e "${GREEN}✅ Valid access token found${NC}"
else
    echo -e "${YELLOW}⚠️  No valid access token found${NC}"
    echo ""
    echo -e "${CYAN}To get a valid token, you need to authenticate:${NC}"
    echo -e "${YELLOW}1. Run: python3 fixed_device_auth.py${NC}"
    echo -e "${YELLOW}2. Follow the authentication steps${NC}"
    echo -e "${YELLOW}3. Re-run this script${NC}"
    echo ""
    echo -e "${BLUE}Would you like to run authentication now? (y/N)${NC}"
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}🔐 Starting authentication...${NC}"
        echo ""
        
        if python3 fixed_device_auth.py; then
            echo -e "${GREEN}✅ Authentication completed${NC}"
            
            # Check if token is now valid
            if check_token; then
                echo -e "${GREEN}✅ Token is now valid${NC}"
            else
                echo -e "${RED}❌ Token still not valid after authentication${NC}"
                exit 1
            fi
        else
            echo -e "${RED}❌ Authentication failed${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}Authentication cancelled. Cannot proceed without valid token.${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}🚀 Starting comprehensive email extraction...${NC}"

# Run the comprehensive extraction
if ./run_comprehensive_extraction.sh "$@"; then
    echo ""
    echo -e "${GREEN}🎉 COMPREHENSIVE EXTRACTION COMPLETED!${NC}"
    echo ""
    echo -e "${CYAN}📊 Next steps:${NC}"
    echo -e "${BLUE}1. Review extraction results${NC}"
    echo -e "${BLUE}2. Run email batching: ./run_email_batching.sh${NC}"
    echo -e "${BLUE}3. Process email batches for analysis${NC}"
else
    echo ""
    echo -e "${RED}❌ EXTRACTION FAILED!${NC}"
    echo -e "${YELLOW}Check the logs for details:${NC}"
    echo -e "   • comprehensive_extraction.log"
    echo -e "   • deep_extraction.log"
    exit 1
fi