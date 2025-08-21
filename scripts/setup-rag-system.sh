#!/bin/bash

# Setup RAG System for CrewAI Team
# This script initializes ChromaDB and indexes the knowledge base

set -e

echo "============================================"
echo "CrewAI Team - RAG System Setup"
echo "============================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a service is running
check_service() {
    local service_name=$1
    local port=$2
    local url=$3
    
    echo -n "Checking $service_name on port $port... "
    if curl -s -f "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Running${NC}"
        return 0
    else
        echo -e "${RED}✗ Not running${NC}"
        return 1
    fi
}

# Function to start ChromaDB
start_chromadb() {
    echo -e "\n${YELLOW}Starting ChromaDB...${NC}"
    
    # Check if ChromaDB is already running
    if check_service "ChromaDB" 8000 "http://localhost:8000/api/v1/heartbeat"; then
        echo "ChromaDB is already running"
        return 0
    fi
    
    # Check if ChromaDB is installed
    if ! command -v chroma &> /dev/null; then
        echo -e "${YELLOW}Installing ChromaDB...${NC}"
        pip install chromadb
    fi
    
    # Start ChromaDB in the background
    echo "Starting ChromaDB server..."
    chroma run --path ./data/chroma --port 8000 &
    CHROMADB_PID=$!
    
    # Wait for ChromaDB to start
    echo -n "Waiting for ChromaDB to start"
    for i in {1..30}; do
        if curl -s -f "http://localhost:8000/api/v1/heartbeat" > /dev/null 2>&1; then
            echo -e " ${GREEN}✓${NC}"
            echo "ChromaDB started successfully (PID: $CHROMADB_PID)"
            return 0
        fi
        echo -n "."
        sleep 1
    done
    
    echo -e " ${RED}✗${NC}"
    echo "Failed to start ChromaDB"
    return 1
}

# Function to start Ollama
start_ollama() {
    echo -e "\n${YELLOW}Checking Ollama...${NC}"
    
    # Check if Ollama is running
    if check_service "Ollama" 11434 "http://localhost:8081/api/version"; then
        echo "Ollama is already running"
        
        # Check if required model is available
        echo -n "Checking for llama3.2:3b model... "
        if ollama list | grep -q "llama3.2:3b"; then
            echo -e "${GREEN}✓ Available${NC}"
        else
            echo -e "${YELLOW}Pulling llama3.2:3b model...${NC}"
            ollama pull llama3.2:3b
        fi
        return 0
    else
        echo -e "${YELLOW}Starting Ollama...${NC}"
        
        # Check if Ollama is installed
        if ! command -v ollama &> /dev/null; then
            echo -e "${RED}Ollama is not installed. Please install it first:${NC}"
            echo "curl -fsSL https://ollama.ai/install.sh | sh"
            return 1
        fi
        
        # Start Ollama
        ollama serve &
        OLLAMA_PID=$!
        
        # Wait for Ollama to start
        echo -n "Waiting for Ollama to start"
        for i in {1..30}; do
            if curl -s -f "http://localhost:8081/api/version" > /dev/null 2>&1; then
                echo -e " ${GREEN}✓${NC}"
                echo "Ollama started successfully (PID: $OLLAMA_PID)"
                
                # Pull required model
                echo -e "${YELLOW}Pulling llama3.2:3b model...${NC}"
                ollama pull llama3.2:3b
                return 0
            fi
            echo -n "."
            sleep 1
        done
        
        echo -e " ${RED}✗${NC}"
        echo "Failed to start Ollama"
        return 1
    fi
}

# Function to index knowledge base
index_knowledge_base() {
    echo -e "\n${YELLOW}Indexing Knowledge Base...${NC}"
    
    # Check if knowledge base exists
    if [ ! -d "/home/pricepro2006/master_knowledge_base" ]; then
        echo -e "${RED}Knowledge base not found at /home/pricepro2006/master_knowledge_base${NC}"
        return 1
    fi
    
    # Run indexing script
    echo "Running knowledge base indexer..."
    npm run rag:index
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Knowledge base indexed successfully${NC}"
        return 0
    else
        echo -e "${RED}Failed to index knowledge base${NC}"
        return 1
    fi
}

# Function to run tests
run_tests() {
    echo -e "\n${YELLOW}Running RAG Integration Tests...${NC}"
    
    npm run rag:test
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}All tests passed successfully${NC}"
        return 0
    else
        echo -e "${RED}Some tests failed${NC}"
        return 1
    fi
}

# Main execution
main() {
    echo "This script will:"
    echo "1. Start ChromaDB (vector database)"
    echo "2. Start Ollama (LLM service)"
    echo "3. Index the master knowledge base"
    echo "4. Run integration tests"
    echo ""
    
    read -p "Do you want to continue? (y/n): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled"
        exit 0
    fi
    
    # Create necessary directories
    mkdir -p ./data/chroma
    mkdir -p ./logs
    
    # Start services
    start_chromadb
    CHROMADB_OK=$?
    
    start_ollama
    OLLAMA_OK=$?
    
    if [ $CHROMADB_OK -ne 0 ] || [ $OLLAMA_OK -ne 0 ]; then
        echo -e "\n${RED}Failed to start required services${NC}"
        echo "Please check the logs and try again"
        exit 1
    fi
    
    # Index knowledge base
    echo ""
    read -p "Do you want to index the knowledge base? (y/n): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        index_knowledge_base
        INDEX_OK=$?
        
        if [ $INDEX_OK -ne 0 ]; then
            echo -e "\n${YELLOW}Warning: Knowledge base indexing failed${NC}"
            echo "You can try again later with: npm run rag:index"
        fi
    fi
    
    # Run tests
    echo ""
    read -p "Do you want to run integration tests? (y/n): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        run_tests
    fi
    
    echo ""
    echo "============================================"
    echo -e "${GREEN}RAG System Setup Complete!${NC}"
    echo "============================================"
    echo ""
    echo "Services running:"
    echo "  - ChromaDB: http://localhost:8000"
    echo "  - Ollama: http://localhost:8081"
    echo ""
    echo "Available commands:"
    echo "  npm run rag:index  - Index knowledge base"
    echo "  npm run rag:test   - Run integration tests"
    echo "  npm run dev        - Start development server"
    echo ""
    echo "To stop services:"
    echo "  pkill chroma      - Stop ChromaDB"
    echo "  pkill ollama      - Stop Ollama"
}

# Run main function
main