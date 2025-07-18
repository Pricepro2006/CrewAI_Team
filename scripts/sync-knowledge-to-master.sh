#!/bin/bash

# Knowledge Sync Script - Syncs CrewAI_Team knowledge to master_knowledge_base
# Created: 2025-07-18

set -e  # Exit on error

# Configuration
CREWAI_KB="/home/pricepro2006/CrewAI_Team/docs/knowledge_base"
MASTER_KB="/home/pricepro2006/master_knowledge_base"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="/home/pricepro2006/master_knowledge_base/metadata/sync_log_${TIMESTAMP}.txt"

# Ensure directories exist
mkdir -p "${MASTER_KB}/CrewAI_Team/knowledge_base"
mkdir -p "${MASTER_KB}/CrewAI_Team/confidence_system"
mkdir -p "${MASTER_KB}/CrewAI_Team/test_results"
mkdir -p "${MASTER_KB}/metadata"

echo "=== Knowledge Base Sync Started at $(date) ===" | tee -a "${LOG_FILE}"

# Function to sync files with metadata
sync_with_metadata() {
    local source_file="$1"
    local dest_dir="$2"
    local file_name=$(basename "$source_file")
    
    if [ -f "$source_file" ]; then
        # Copy the file
        cp -v "$source_file" "$dest_dir/" 2>&1 | tee -a "${LOG_FILE}"
        
        # Add metadata
        echo "Synced: $file_name at $(date)" >> "${dest_dir}/.sync_metadata"
    fi
}

# 1. Sync knowledge base documents
echo -e "\n[1/5] Syncing knowledge base documents..." | tee -a "${LOG_FILE}"
if [ -d "$CREWAI_KB" ]; then
    for file in "$CREWAI_KB"/*.md; do
        if [ -f "$file" ]; then
            sync_with_metadata "$file" "${MASTER_KB}/CrewAI_Team/knowledge_base"
        fi
    done
fi

# 2. Sync confidence system documentation
echo -e "\n[2/5] Syncing confidence system documentation..." | tee -a "${LOG_FILE}"
CONFIDENCE_DOCS=(
    "/home/pricepro2006/CrewAI_Team/src/core/rag/confidence/IMPLEMENTATION_SUMMARY.md"
    "/home/pricepro2006/CrewAI_Team/src/core/rag/confidence/INTEGRATION_GUIDE.md"
    "/home/pricepro2006/CrewAI_Team/src/core/rag/confidence/MIGRATION_GUIDE.md"
    "/home/pricepro2006/CrewAI_Team/src/core/rag/confidence/README.md"
)

for doc in "${CONFIDENCE_DOCS[@]}"; do
    sync_with_metadata "$doc" "${MASTER_KB}/CrewAI_Team/confidence_system"
done

# 3. Sync test results and performance data
echo -e "\n[3/5] Syncing test results..." | tee -a "${LOG_FILE}"
TEST_RESULTS=(
    "/home/pricepro2006/CrewAI_Team/COMPREHENSIVE_MODEL_TESTING_REPORT.md"
    "/home/pricepro2006/CrewAI_Team/PERFORMANCE_REPORT.md"
    "/home/pricepro2006/CrewAI_Team/SYSTEM_STATUS_REPORT.md"
    "/home/pricepro2006/CrewAI_Team/MODEL_IMPLEMENTATION_SUMMARY.md"
    "/home/pricepro2006/CrewAI_Team/RAG_IMPLEMENTATION_BEST_PRACTICES_2025.md"
)

for result in "${TEST_RESULTS[@]}"; do
    sync_with_metadata "$result" "${MASTER_KB}/CrewAI_Team/test_results"
done

# 4. Sync JSON test results
echo -e "\n[4/5] Syncing JSON test results..." | tee -a "${LOG_FILE}"
for json_file in /home/pricepro2006/CrewAI_Team/*-results*.json; do
    if [ -f "$json_file" ]; then
        sync_with_metadata "$json_file" "${MASTER_KB}/CrewAI_Team/test_results"
    fi
done

# 5. Create summary of new knowledge
echo -e "\n[5/5] Creating knowledge summary..." | tee -a "${LOG_FILE}"
cat > "${MASTER_KB}/CrewAI_Team/KNOWLEDGE_SUMMARY_${TIMESTAMP}.md" << EOF
# CrewAI Team Knowledge Summary
Generated: $(date)

## Overview
This directory contains knowledge captured from the CrewAI_Team project, including:

### 1. Knowledge Base Documents
Located in \`knowledge_base/\`:
- TypeScript AI best practices
- Ollama integration patterns
- Multi-agent systems research
- tRPC integration reference
- Vector database optimization
- RAG implementation patterns
- WebSocket real-time patterns
- Performance optimization for LLM apps

### 2. Confidence System Documentation
Located in \`confidence_system/\`:
- Implementation summary
- Integration guide
- Migration guide
- System README

### 3. Test Results and Performance Data
Located in \`test_results/\`:
- Comprehensive model testing reports
- Performance reports
- System status reports
- Model implementation summaries
- RAG implementation best practices (2025)

## Recent Learnings (July 16-18, 2025)

### 4-Step Confidence-Scored RAG System
- Replaced 6-step approach with streamlined 4-step process
- Implemented multi-modal evaluation
- Added confidence calibration
- Created adaptive delivery manager

### Model Performance
- granite3.3:2b as main model
- qwen2.5:0.5b for agents
- Optimized for 8K token windows
- Improved response times to sub-2 second

### CI/CD Pipeline
- Comprehensive GitHub Actions workflows
- Security testing (auth, input validation, CSRF)
- Load testing with k6
- Memory leak detection
- Automated dependency updates

## Integration Status
- Confidence system implemented but NOT yet integrated into production
- Requires final integration steps as documented in PHASE7_PROGRESS.md

EOF

# Create index of all synced files
echo -e "\n=== Creating file index ===" | tee -a "${LOG_FILE}"
find "${MASTER_KB}/CrewAI_Team" -type f -name "*.md" -o -name "*.json" | sort > "${MASTER_KB}/CrewAI_Team/FILE_INDEX.txt"

# Summary
SYNCED_COUNT=$(grep -c "Synced:" "${LOG_FILE}" || echo "0")
echo -e "\n=== Sync Complete ===" | tee -a "${LOG_FILE}"
echo "Total files synced: $SYNCED_COUNT" | tee -a "${LOG_FILE}"
echo "Log file: ${LOG_FILE}" | tee -a "${LOG_FILE}"
echo "Knowledge summary: ${MASTER_KB}/CrewAI_Team/KNOWLEDGE_SUMMARY_${TIMESTAMP}.md" | tee -a "${LOG_FILE}"

# Make the script executable
chmod +x "$0"