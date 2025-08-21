#!/bin/bash

# Email Pipeline Startup Script
# Ensures all dependencies are working before starting the pipeline

echo "========================================="
echo "Email Pipeline Startup"
echo "========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check dependency
check_dependency() {
    local dep=$1
    local name=$2
    if node -e "require('$dep')" 2>/dev/null; then
        echo -e "${GREEN}✓ $name is available${NC}"
        return 0
    else
        echo -e "${RED}✗ $name is missing${NC}"
        return 1
    fi
}

# Function to check service
check_service() {
    local service=$1
    local port=$2
    local name=$3
    if nc -z localhost $port 2>/dev/null; then
        echo -e "${GREEN}✓ $name is running on port $port${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠ $name is not running on port $port${NC}"
        return 1
    fi
}

# Check critical dependencies
echo -e "\n${BLUE}Checking dependencies...${NC}"
DEPS_OK=true

check_dependency "better-sqlite3" "better-sqlite3" || DEPS_OK=false
check_dependency "express" "Express.js" || DEPS_OK=false
check_dependency "@trpc/server" "tRPC" || DEPS_OK=false
check_dependency "bullmq" "BullMQ" || DEPS_OK=false

if [ "$DEPS_OK" = false ]; then
    echo -e "\n${RED}Missing dependencies detected!${NC}"
    echo -e "${YELLOW}Running installation workaround...${NC}"
    
    # Run the install workaround
    if [ -f "./scripts/install-workaround.sh" ]; then
        ./scripts/install-workaround.sh
    else
        echo -e "${RED}Install workaround script not found!${NC}"
        exit 1
    fi
fi

# Check required services
echo -e "\n${BLUE}Checking required services...${NC}"
SERVICES_OK=true

check_service "Redis" 6379 "Redis" || SERVICES_OK=false
check_service "Ollama" 11434 "Ollama" || {
    echo -e "${YELLOW}Starting Ollama...${NC}"
    ollama serve > /dev/null 2>&1 &
    sleep 3
    check_service "Ollama" 11434 "Ollama" || SERVICES_OK=false
}

if [ "$SERVICES_OK" = false ]; then
    echo -e "\n${YELLOW}Some services are not running.${NC}"
    echo -e "Please ensure Redis is running: ${BLUE}redis-server${NC}"
    echo -e "Please ensure Ollama is running: ${BLUE}ollama serve${NC}"
fi

# Check database
echo -e "\n${BLUE}Checking database...${NC}"
if [ -f "./data/crewai.db" ]; then
    echo -e "${GREEN}✓ Database file exists${NC}"
    
    # Test database connection
    if node -e "
        const Database = require('better-sqlite3');
        const db = new Database('./data/crewai.db', { readonly: true });
        const count = db.prepare('SELECT COUNT(*) as count FROM emails').get();
        console.log('✓ Database connection successful');
        console.log('  Email count:', count.count);
        db.close();
    " 2>/dev/null; then
        echo -e "${GREEN}✓ Database is accessible${NC}"
    else
        echo -e "${RED}✗ Database connection failed${NC}"
        echo -e "${YELLOW}Initializing database...${NC}"
        tsx src/database/scripts/initializeDatabase.ts
    fi
else
    echo -e "${YELLOW}Database not found. Creating...${NC}"
    tsx src/database/scripts/initializeDatabase.ts
fi

# Pipeline selection menu
echo -e "\n${BLUE}Select pipeline to run:${NC}"
echo "1) Test Pipeline (small batch)"
echo "2) Development Pipeline"
echo "3) Production Pipeline"
echo "4) Pipeline Monitor"
echo "5) Process Emails (batch processor)"
echo "6) Exit"

read -p "Enter your choice (1-6): " choice

case $choice in
    1)
        echo -e "\n${BLUE}Starting Test Pipeline...${NC}"
        npm run pipeline:test
        ;;
    2)
        echo -e "\n${BLUE}Starting Development Pipeline...${NC}"
        npm run pipeline:execute
        ;;
    3)
        echo -e "\n${BLUE}Starting Production Pipeline...${NC}"
        npm run pipeline:execute:prod
        ;;
    4)
        echo -e "\n${BLUE}Starting Pipeline Monitor...${NC}"
        npm run pipeline:monitor
        ;;
    5)
        echo -e "\n${BLUE}Starting Email Batch Processor...${NC}"
        echo "Enter batch size (default: 10):"
        read batch_size
        batch_size=${batch_size:-10}
        npm run process-emails -- --batch-size $batch_size
        ;;
    6)
        echo -e "${GREEN}Exiting...${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice!${NC}"
        exit 1
        ;;
esac