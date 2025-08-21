#!/bin/bash

# Adaptive Three-Phase Email Analysis Deployment Script
# Purpose: Deploy and manage the production email processing pipeline with LLM integration

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/home/pricepro2006/CrewAI_Team"
SCRIPT_DIR="$PROJECT_DIR/scripts"
LOG_DIR="$PROJECT_DIR/logs"
PID_DIR="$PROJECT_DIR/pids"
DB_PATH="$PROJECT_DIR/data/crewai_enhanced.db"

# Create required directories
mkdir -p "$LOG_DIR" "$PID_DIR"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}   Adaptive Three-Phase Email Analysis Deployment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Function to check if Ollama is running
check_ollama() {
    echo -e "${YELLOW}🔍 Checking Ollama status...${NC}"
    
    if curl -s http://localhost:8081/api/tags >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Ollama is running"
        
        # Check for required models
        local models=$(curl -s http://localhost:8081/api/tags | python3 -c "
import json, sys
data = json.load(sys.stdin)
models = [m['name'] for m in data.get('models', [])]
print(' '.join(models))
")
        
        if [[ $models == *"llama3.2:3b"* ]]; then
            echo -e "${GREEN}✓${NC} llama3.2:3b model found"
        else
            echo -e "${RED}✗${NC} llama3.2:3b model not found"
            echo -e "${YELLOW}Installing llama3.2:3b...${NC}"
            ollama pull llama3.2:3b
        fi
        
        if [[ $models == *"phi-4"* ]] || [[ $models == *"doomgrave/phi-4:14b-tools-Q3_K_S"* ]]; then
            echo -e "${GREEN}✓${NC} phi-4 model found"
        else
            echo -e "${YELLOW}!${NC} phi-4 model not found (optional for Phase 3)"
        fi
        
        return 0
    else
        echo -e "${RED}✗${NC} Ollama is not running"
        echo -e "${YELLOW}Starting Ollama...${NC}"
        ollama serve >/dev/null 2>&1 &
        sleep 5
        
        if curl -s http://localhost:8081/api/tags >/dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} Ollama started successfully"
            return 0
        else
            echo -e "${RED}✗${NC} Failed to start Ollama"
            return 1
        fi
    fi
}

# Function to check Redis
check_redis() {
    echo -e "${YELLOW}🔍 Checking Redis status...${NC}"
    
    if redis-cli ping >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Redis is running"
        return 0
    else
        echo -e "${RED}✗${NC} Redis is not running"
        echo -e "${YELLOW}Starting Redis...${NC}"
        redis-server --daemonize yes
        sleep 2
        
        if redis-cli ping >/dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} Redis started successfully"
            return 0
        else
            echo -e "${RED}✗${NC} Failed to start Redis"
            return 1
        fi
    fi
}

# Function to check ChromaDB
check_chromadb() {
    echo -e "${YELLOW}🔍 Checking ChromaDB status...${NC}"
    
    if curl -s http://localhost:8001/api/v1/heartbeat >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} ChromaDB is running"
        return 0
    else
        echo -e "${YELLOW}!${NC} ChromaDB is not running (optional for RAG)"
        return 0
    fi
}

# Function to check database
check_database() {
    echo -e "${YELLOW}🔍 Checking database...${NC}"
    
    if [ -f "$DB_PATH" ]; then
        local count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM emails_enhanced;" 2>/dev/null || echo "0")
        echo -e "${GREEN}✓${NC} Database found: $count emails"
        
        # Check for emails needing processing
        local pending=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM emails_enhanced WHERE workflow_state IS NULL OR workflow_state = '{}';" 2>/dev/null || echo "0")
        echo -e "${BLUE}ℹ${NC} Emails pending processing: $pending"
        
        return 0
    else
        echo -e "${RED}✗${NC} Database not found at $DB_PATH"
        return 1
    fi
}

# Function to create systemd service
create_systemd_service() {
    echo -e "${YELLOW}🔧 Creating systemd service...${NC}"
    
    cat > /tmp/crewai-email-analysis.service << EOF
[Unit]
Description=CrewAI Adaptive Three-Phase Email Analysis
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR
Environment="PYTHONPATH=$PROJECT_DIR"
Environment="DATABASE_PATH=$DB_PATH"
Environment="LLM_URL=http://localhost:8081"
Environment="LOG_LEVEL=INFO"
ExecStart=/usr/bin/python3 $SCRIPT_DIR/robust_llm_processor_cli.py --db $DB_PATH --batch-size 10 --continuous
Restart=on-failure
RestartSec=30
StandardOutput=append:$LOG_DIR/email-analysis.log
StandardError=append:$LOG_DIR/email-analysis-error.log

# Resource limits
LimitNOFILE=65536
MemoryLimit=4G

[Install]
WantedBy=multi-user.target
EOF

    # Install the service
    sudo cp /tmp/crewai-email-analysis.service /etc/systemd/system/
    sudo systemctl daemon-reload
    echo -e "${GREEN}✓${NC} Systemd service created"
}

# Function to create quality monitoring service
create_monitoring_service() {
    echo -e "${YELLOW}🔧 Creating quality monitoring service...${NC}"
    
    cat > /tmp/crewai-quality-monitor.service << EOF
[Unit]
Description=CrewAI Email Processing Quality Monitor
After=crewai-email-analysis.service
Requires=crewai-email-analysis.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR
Environment="PYTHONPATH=$PROJECT_DIR"
Environment="DATABASE_PATH=$DB_PATH"
ExecStart=/usr/bin/python3 $SCRIPT_DIR/monitor_quality_metrics_fixed.py --db $DB_PATH --continuous --interval 300
Restart=always
RestartSec=60
StandardOutput=append:$LOG_DIR/quality-monitor.log
StandardError=append:$LOG_DIR/quality-monitor-error.log

[Install]
WantedBy=multi-user.target
EOF

    # Install the service
    sudo cp /tmp/crewai-quality-monitor.service /etc/systemd/system/
    sudo systemctl daemon-reload
    echo -e "${GREEN}✓${NC} Quality monitoring service created"
}

# Function to start services
start_services() {
    echo -e "${YELLOW}🚀 Starting services...${NC}"
    
    # Enable and start email analysis
    sudo systemctl enable crewai-email-analysis
    sudo systemctl start crewai-email-analysis
    
    sleep 3
    
    if systemctl is-active --quiet crewai-email-analysis; then
        echo -e "${GREEN}✓${NC} Email analysis service started"
    else
        echo -e "${RED}✗${NC} Failed to start email analysis service"
        sudo journalctl -u crewai-email-analysis -n 20
        return 1
    fi
    
    # Enable and start quality monitor
    sudo systemctl enable crewai-quality-monitor
    sudo systemctl start crewai-quality-monitor
    
    if systemctl is-active --quiet crewai-quality-monitor; then
        echo -e "${GREEN}✓${NC} Quality monitoring service started"
    else
        echo -e "${YELLOW}!${NC} Quality monitoring service failed to start (non-critical)"
    fi
    
    return 0
}

# Function to show status
show_status() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}   System Status${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Service status
    echo -e "\n${YELLOW}📊 Service Status:${NC}"
    systemctl is-active --quiet crewai-email-analysis && \
        echo -e "${GREEN}✓${NC} Email Analysis: Active" || \
        echo -e "${RED}✗${NC} Email Analysis: Inactive"
    
    systemctl is-active --quiet crewai-quality-monitor && \
        echo -e "${GREEN}✓${NC} Quality Monitor: Active" || \
        echo -e "${YELLOW}!${NC} Quality Monitor: Inactive"
    
    # Database statistics
    if [ -f "$DB_PATH" ]; then
        echo -e "\n${YELLOW}📈 Database Statistics:${NC}"
        sqlite3 "$DB_PATH" << EOF
.headers on
.mode column
SELECT 
    COUNT(*) as total_emails,
    COUNT(CASE WHEN workflow_state IS NOT NULL AND workflow_state != '{}' THEN 1 END) as processed,
    COUNT(CASE WHEN workflow_state IS NULL OR workflow_state = '{}' THEN 1 END) as pending,
    ROUND(100.0 * COUNT(CASE WHEN workflow_state IS NOT NULL AND workflow_state != '{}' THEN 1 END) / COUNT(*), 2) as percent_complete
FROM emails_enhanced;
EOF
    fi
    
    # Recent logs
    echo -e "\n${YELLOW}📜 Recent Processing Logs:${NC}"
    if [ -f "$LOG_DIR/email-analysis.log" ]; then
        tail -n 10 "$LOG_DIR/email-analysis.log" | grep -E "Processed|Error|Stats" || echo "No recent activity"
    else
        echo "No logs yet"
    fi
}

# Function to run quality check
run_quality_check() {
    echo -e "\n${YELLOW}🔍 Running quality check...${NC}"
    
    cd "$PROJECT_DIR"
    python3 scripts/monitor_quality_metrics_fixed.py --hours 1
}

# Main deployment function
deploy() {
    echo -e "${YELLOW}🚀 Starting deployment...${NC}\n"
    
    # Check all dependencies
    check_ollama || { echo -e "${RED}Failed to setup Ollama${NC}"; exit 1; }
    check_redis || { echo -e "${RED}Failed to setup Redis${NC}"; exit 1; }
    check_chromadb
    check_database || { echo -e "${RED}Database check failed${NC}"; exit 1; }
    
    # Create services
    create_systemd_service
    create_monitoring_service
    
    # Start services
    start_services || { echo -e "${RED}Failed to start services${NC}"; exit 1; }
    
    # Show status
    show_status
    
    # Run initial quality check
    run_quality_check
    
    echo -e "\n${GREEN}✅ Deployment complete!${NC}"
    echo -e "\n${YELLOW}📋 Next steps:${NC}"
    echo -e "  1. Monitor logs: ${BLUE}tail -f $LOG_DIR/email-analysis.log${NC}"
    echo -e "  2. Check quality: ${BLUE}./deploy-adaptive-email-analysis.sh quality${NC}"
    echo -e "  3. View status: ${BLUE}./deploy-adaptive-email-analysis.sh status${NC}"
    echo -e "  4. Stop service: ${BLUE}./deploy-adaptive-email-analysis.sh stop${NC}"
}

# Handle command line arguments
case "${1:-deploy}" in
    deploy)
        deploy
        ;;
    status)
        show_status
        ;;
    start)
        echo -e "${YELLOW}Starting services...${NC}"
        sudo systemctl start crewai-email-analysis crewai-quality-monitor
        show_status
        ;;
    stop)
        echo -e "${YELLOW}Stopping services...${NC}"
        sudo systemctl stop crewai-email-analysis crewai-quality-monitor
        ;;
    restart)
        echo -e "${YELLOW}Restarting services...${NC}"
        sudo systemctl restart crewai-email-analysis crewai-quality-monitor
        show_status
        ;;
    logs)
        tail -f "$LOG_DIR/email-analysis.log"
        ;;
    errors)
        tail -f "$LOG_DIR/email-analysis-error.log"
        ;;
    quality)
        run_quality_check
        ;;
    clean)
        echo -e "${YELLOW}Cleaning up services...${NC}"
        sudo systemctl stop crewai-email-analysis crewai-quality-monitor 2>/dev/null
        sudo systemctl disable crewai-email-analysis crewai-quality-monitor 2>/dev/null
        sudo rm -f /etc/systemd/system/crewai-email-analysis.service
        sudo rm -f /etc/systemd/system/crewai-quality-monitor.service
        sudo systemctl daemon-reload
        echo -e "${GREEN}✓${NC} Services cleaned up"
        ;;
    *)
        echo "Usage: $0 {deploy|status|start|stop|restart|logs|errors|quality|clean}"
        echo ""
        echo "Commands:"
        echo "  deploy  - Deploy and start the email analysis pipeline"
        echo "  status  - Show current status and statistics"
        echo "  start   - Start the services"
        echo "  stop    - Stop the services"
        echo "  restart - Restart the services"
        echo "  logs    - Follow the processing logs"
        echo "  errors  - Follow the error logs"
        echo "  quality - Run a quality check"
        echo "  clean   - Remove all services"
        exit 1
        ;;
esac