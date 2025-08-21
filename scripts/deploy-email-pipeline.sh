#!/bin/bash

# Email Pipeline Deployment Script
# Purpose: Deploy and start the email processing pipeline

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/home/pricepro2006/CrewAI_Team"
LOG_DIR="$PROJECT_DIR/logs"
PID_DIR="$PROJECT_DIR/pids"

# Create required directories
mkdir -p "$LOG_DIR" "$PID_DIR"

echo -e "${GREEN}Email Pipeline Deployment Script${NC}"
echo "================================="

# Function to check if service is running
check_service() {
    local service_name=$1
    if systemctl is-active --quiet "$service_name"; then
        echo -e "${GREEN}✓${NC} $service_name is running"
        return 0
    else
        echo -e "${RED}✗${NC} $service_name is not running"
        return 1
    fi
}

# Function to check dependencies
check_dependencies() {
    echo -e "\n${YELLOW}Checking dependencies...${NC}"
    
    # Check Node.js
    if command -v node &> /dev/null; then
        echo -e "${GREEN}✓${NC} Node.js $(node --version)"
    else
        echo -e "${RED}✗${NC} Node.js not found"
        exit 1
    fi
    
    # Check Redis
    if check_service redis-server || check_service redis; then
        echo -e "${GREEN}✓${NC} Redis is running"
    else
        echo -e "${RED}✗${NC} Redis is not running. Starting Redis..."
        sudo systemctl start redis-server || sudo systemctl start redis
    fi
    
    # Check if project dependencies are installed
    if [ -d "$PROJECT_DIR/node_modules" ]; then
        echo -e "${GREEN}✓${NC} Node modules installed"
    else
        echo -e "${YELLOW}!${NC} Installing dependencies..."
        cd "$PROJECT_DIR"
        npm install
    fi
    
    # Check if TypeScript is built
    if [ -d "$PROJECT_DIR/dist" ]; then
        echo -e "${GREEN}✓${NC} TypeScript compiled"
    else
        echo -e "${YELLOW}!${NC} Building TypeScript..."
        cd "$PROJECT_DIR"
        npm run build
    fi
}

# Function to create email pipeline service
create_email_pipeline_service() {
    echo -e "\n${YELLOW}Creating email pipeline service...${NC}"
    
    cat > /tmp/crewai-email-pipeline.service << EOF
[Unit]
Description=CrewAI Email Processing Pipeline
After=network.target redis.service
Wants=redis.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR
Environment="NODE_ENV=production"
Environment="DATABASE_PATH=$PROJECT_DIR/data/crewai.db"
Environment="REDIS_URL=redis://localhost:6379"
Environment="LOG_LEVEL=info"
ExecStart=/usr/bin/node $PROJECT_DIR/dist/scripts/run-email-pipeline.js
Restart=always
RestartSec=10
StandardOutput=append:$LOG_DIR/email-pipeline.log
StandardError=append:$LOG_DIR/email-pipeline-error.log

[Install]
WantedBy=multi-user.target
EOF

    # Install the service
    sudo cp /tmp/crewai-email-pipeline.service /etc/systemd/system/
    sudo systemctl daemon-reload
    echo -e "${GREEN}✓${NC} Email pipeline service created"
}

# Function to create the pipeline runner script
create_pipeline_runner() {
    echo -e "\n${YELLOW}Creating pipeline runner script...${NC}"
    
    cat > "$PROJECT_DIR/scripts/run-email-pipeline.ts" << 'EOF'
import { EmailQueueProcessor } from '../src/core/processors/EmailQueueProcessor.js';
import { EmailBatchProcessor } from '../src/core/processors/EmailBatchProcessor.js';
import { EmailAnalysisPipeline } from '../src/core/processors/EmailAnalysisPipeline.js';
import { EmailAnalysisAgent } from '../src/core/agents/specialized/EmailAnalysisAgent.js';
import { EmailAnalysisCache } from '../src/core/cache/EmailAnalysisCache.js';
import { UnifiedEmailService } from '../src/api/services/UnifiedEmailService.js';
import { logger } from '../src/utils/logger.js';
import { metrics } from '../src/api/monitoring/metrics.js';

async function startEmailPipeline() {
    logger.info('Starting Email Processing Pipeline', 'PIPELINE');
    
    try {
        // Initialize components
        const emailService = new UnifiedEmailService();
        const analysisAgent = new EmailAnalysisAgent();
        const cache = new EmailAnalysisCache();
        const pipeline = new EmailAnalysisPipeline();
        
        // Initialize batch processor
        const batchProcessor = new EmailBatchProcessor(
            analysisAgent,
            cache,
            {
                concurrency: parseInt(process.env.BATCH_CONCURRENCY || '5'),
                timeout: parseInt(process.env.BATCH_TIMEOUT || '30000'),
                useCaching: process.env.USE_CACHE !== 'false'
            }
        );
        
        // Initialize queue processor
        const queueProcessor = new EmailQueueProcessor({
            concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5'),
            maxRetries: parseInt(process.env.MAX_RETRIES || '3')
        });
        
        // Start processing
        await queueProcessor.start();
        
        logger.info('Email Pipeline Started Successfully', 'PIPELINE', {
            batchConcurrency: process.env.BATCH_CONCURRENCY || 5,
            queueConcurrency: process.env.QUEUE_CONCURRENCY || 5,
            cacheEnabled: process.env.USE_CACHE !== 'false'
        });
        
        // Set up graceful shutdown
        process.on('SIGTERM', async () => {
            logger.info('Shutting down email pipeline...', 'PIPELINE');
            await queueProcessor.stop();
            process.exit(0);
        });
        
        process.on('SIGINT', async () => {
            logger.info('Shutting down email pipeline...', 'PIPELINE');
            await queueProcessor.stop();
            process.exit(0);
        });
        
        // Keep the process running
        setInterval(() => {
            const stats = batchProcessor.getStats();
            metrics.gauge('pipeline.queue.size', stats.queue.size);
            metrics.gauge('pipeline.queue.pending', stats.queue.pending);
            metrics.gauge('pipeline.cache.size', stats.cache.size);
            metrics.gauge('pipeline.cache.hitRate', stats.cache.hitRate);
        }, 30000); // Update metrics every 30 seconds
        
    } catch (error) {
        logger.error('Failed to start email pipeline', 'PIPELINE', {
            error: error instanceof Error ? error.message : String(error)
        });
        process.exit(1);
    }
}

// Start the pipeline
startEmailPipeline();
EOF

    # Compile the TypeScript file
    echo -e "${YELLOW}Compiling pipeline runner...${NC}"
    cd "$PROJECT_DIR"
    npx tsc scripts/run-email-pipeline.ts --outDir dist/scripts --module esnext --target es2020 --moduleResolution node --allowSyntheticDefaultImports --esModuleInterop
    
    echo -e "${GREEN}✓${NC} Pipeline runner created"
}

# Function to start the email pipeline
start_email_pipeline() {
    echo -e "\n${YELLOW}Starting email pipeline service...${NC}"
    
    sudo systemctl enable crewai-email-pipeline
    sudo systemctl start crewai-email-pipeline
    
    # Wait a moment for service to start
    sleep 2
    
    if check_service crewai-email-pipeline; then
        echo -e "${GREEN}✓${NC} Email pipeline started successfully"
    else
        echo -e "${RED}✗${NC} Failed to start email pipeline"
        echo "Check logs at: $LOG_DIR/email-pipeline-error.log"
        exit 1
    fi
}

# Function to show pipeline status
show_pipeline_status() {
    echo -e "\n${GREEN}Email Pipeline Status${NC}"
    echo "====================="
    
    # Service status
    systemctl status crewai-email-pipeline --no-pager | head -10
    
    # Recent logs
    echo -e "\n${YELLOW}Recent logs:${NC}"
    tail -n 20 "$LOG_DIR/email-pipeline.log" 2>/dev/null || echo "No logs yet"
    
    # Redis queue status
    echo -e "\n${YELLOW}Redis queue status:${NC}"
    redis-cli LLEN "bull:email-processor:wait" 2>/dev/null || echo "Queue not initialized"
}

# Main deployment flow
main() {
    echo -e "${YELLOW}Starting email pipeline deployment...${NC}\n"
    
    # Check dependencies
    check_dependencies
    
    # Create pipeline runner if it doesn't exist
    if [ ! -f "$PROJECT_DIR/dist/scripts/run-email-pipeline.js" ]; then
        create_pipeline_runner
    fi
    
    # Create service file
    create_email_pipeline_service
    
    # Start the pipeline
    start_email_pipeline
    
    # Show status
    show_pipeline_status
    
    echo -e "\n${GREEN}Email pipeline deployment complete!${NC}"
    echo -e "Monitor logs at: ${YELLOW}$LOG_DIR/email-pipeline.log${NC}"
    echo -e "View metrics at: ${YELLOW}http://localhost:3001/metrics${NC}"
}

# Handle command line arguments
case "${1:-deploy}" in
    deploy)
        main
        ;;
    status)
        show_pipeline_status
        ;;
    restart)
        echo -e "${YELLOW}Restarting email pipeline...${NC}"
        sudo systemctl restart crewai-email-pipeline
        show_pipeline_status
        ;;
    stop)
        echo -e "${YELLOW}Stopping email pipeline...${NC}"
        sudo systemctl stop crewai-email-pipeline
        ;;
    logs)
        tail -f "$LOG_DIR/email-pipeline.log"
        ;;
    *)
        echo "Usage: $0 {deploy|status|restart|stop|logs}"
        exit 1
        ;;
esac