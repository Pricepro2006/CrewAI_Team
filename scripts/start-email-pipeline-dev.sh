#!/bin/bash

# Email Pipeline Development Startup Script
# Purpose: Start the email processing pipeline in development mode without sudo

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/home/pricepro2006/CrewAI_Team"
LOG_DIR="$PROJECT_DIR/logs"
PID_FILE="$PROJECT_DIR/pids/email-pipeline.pid"

# Create required directories
mkdir -p "$LOG_DIR" "$PROJECT_DIR/pids"

echo -e "${GREEN}Email Pipeline Development Mode${NC}"
echo "==============================="

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
    
    # Check Redis (just warn if not running)
    if pgrep -x "redis-server" > /dev/null; then
        echo -e "${GREEN}✓${NC} Redis is running"
    else
        echo -e "${YELLOW}!${NC} Redis is not running. Pipeline will start but may not process emails."
        echo -e "  Start Redis with: redis-server"
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

# Function to create the pipeline runner script
create_pipeline_runner() {
    echo -e "\n${YELLOW}Creating pipeline runner script...${NC}"
    
    cat > "$PROJECT_DIR/scripts/run-email-pipeline.ts" << 'EOF'
import { EmailQueueProcessor } from '../src/core/processors/EmailQueueProcessor.js';
import { EmailBatchProcessor } from '../src/core/processors/EmailBatchProcessor.js';
import { EmailAnalysisPipeline } from '../src/core/processors/EmailAnalysisPipeline.js';
import { EmailAnalysisAgent } from '../src/core/agents/specialized/EmailAnalysisAgent.js';
import { EmailAnalysisCache } from '../src/core/cache/EmailAnalysisCache.js';
import { logger } from '../src/utils/logger.js';

// Write PID file
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const pidFile = resolve(process.cwd(), 'pids/email-pipeline.pid');
writeFileSync(pidFile, process.pid.toString());

async function startEmailPipeline() {
    logger.info('Starting Email Processing Pipeline (Development Mode)', 'PIPELINE');
    
    try {
        // Initialize components
        const analysisAgent = new EmailAnalysisAgent();
        const cache = new EmailAnalysisCache();
        const pipeline = new EmailAnalysisPipeline();
        
        // Initialize batch processor
        const batchProcessor = new EmailBatchProcessor(
            analysisAgent,
            cache,
            {
                concurrency: 3, // Lower for dev mode
                timeout: 30000,
                useCaching: true
            }
        );
        
        // Initialize queue processor
        const queueProcessor = new EmailQueueProcessor({
            concurrency: 3,
            maxRetries: 2
        });
        
        // Start processing
        await queueProcessor.start();
        
        logger.info('Email Pipeline Started Successfully', 'PIPELINE', {
            mode: 'development',
            batchConcurrency: 3,
            queueConcurrency: 3,
            cacheEnabled: true
        });
        
        // Log stats every minute
        setInterval(() => {
            const stats = batchProcessor.getStats();
            logger.info('Pipeline Statistics', 'PIPELINE', {
                queue: stats.queue,
                cache: stats.cache
            });
        }, 60000);
        
        // Set up graceful shutdown
        const shutdown = async () => {
            logger.info('Shutting down email pipeline...', 'PIPELINE');
            await queueProcessor.stop();
            process.exit(0);
        };
        
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
        
    } catch (error) {
        logger.error('Failed to start email pipeline', 'PIPELINE', {
            error: error instanceof Error ? error.message : String(error)
        });
        process.exit(1);
    }
}

// Start the pipeline
startEmailPipeline().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
EOF

    # Compile the TypeScript file
    echo -e "${YELLOW}Compiling pipeline runner...${NC}"
    cd "$PROJECT_DIR"
    
    # Create a simple tsconfig for this script if needed
    if [ ! -f "$PROJECT_DIR/scripts/tsconfig.json" ]; then
        cat > "$PROJECT_DIR/scripts/tsconfig.json" << 'EOF'
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "outDir": "../dist/scripts",
    "rootDir": "."
  },
  "include": ["*.ts"]
}
EOF
    fi
    
    npx tsc -p scripts/tsconfig.json
    
    echo -e "${GREEN}✓${NC} Pipeline runner created"
}

# Function to start the pipeline
start_pipeline() {
    echo -e "\n${YELLOW}Starting email pipeline...${NC}"
    
    # Check if already running
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        echo -e "${YELLOW}!${NC} Pipeline is already running (PID: $(cat $PID_FILE))"
        exit 1
    fi
    
    # Start the pipeline in background
    cd "$PROJECT_DIR"
    nohup node dist/scripts/run-email-pipeline.js > "$LOG_DIR/email-pipeline.log" 2> "$LOG_DIR/email-pipeline-error.log" &
    
    # Wait a moment for it to start
    sleep 3
    
    # Check if it started successfully
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Email pipeline started successfully (PID: $(cat $PID_FILE))"
        echo -e "  Logs: $LOG_DIR/email-pipeline.log"
        echo -e "  Errors: $LOG_DIR/email-pipeline-error.log"
    else
        echo -e "${RED}✗${NC} Failed to start email pipeline"
        echo -e "Check error log: $LOG_DIR/email-pipeline-error.log"
        [ -f "$LOG_DIR/email-pipeline-error.log" ] && tail -20 "$LOG_DIR/email-pipeline-error.log"
        exit 1
    fi
}

# Function to stop the pipeline
stop_pipeline() {
    echo -e "${YELLOW}Stopping email pipeline...${NC}"
    
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID"
            sleep 2
            if kill -0 "$PID" 2>/dev/null; then
                kill -9 "$PID"
            fi
            rm -f "$PID_FILE"
            echo -e "${GREEN}✓${NC} Pipeline stopped"
        else
            echo -e "${YELLOW}!${NC} Pipeline not running (stale PID file)"
            rm -f "$PID_FILE"
        fi
    else
        echo -e "${YELLOW}!${NC} Pipeline not running"
    fi
}

# Function to show status
show_status() {
    echo -e "\n${GREEN}Email Pipeline Status${NC}"
    echo "===================="
    
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        PID=$(cat "$PID_FILE")
        echo -e "Status: ${GREEN}RUNNING${NC}"
        echo -e "PID: $PID"
        
        # Show process info
        ps -p "$PID" -o pid,vsz,rss,pcpu,pmem,etime,comm
        
        # Show recent logs
        echo -e "\n${YELLOW}Recent activity:${NC}"
        tail -10 "$LOG_DIR/email-pipeline.log" 2>/dev/null | grep -v "^$"
        
        # Show any recent errors
        if [ -f "$LOG_DIR/email-pipeline-error.log" ] && [ -s "$LOG_DIR/email-pipeline-error.log" ]; then
            echo -e "\n${RED}Recent errors:${NC}"
            tail -5 "$LOG_DIR/email-pipeline-error.log"
        fi
    else
        echo -e "Status: ${RED}STOPPED${NC}"
    fi
}

# Main function
main() {
    case "${1:-start}" in
        start)
            check_dependencies
            
            # Create runner if it doesn't exist
            if [ ! -f "$PROJECT_DIR/dist/scripts/run-email-pipeline.js" ]; then
                create_pipeline_runner
            fi
            
            start_pipeline
            show_status
            ;;
        stop)
            stop_pipeline
            ;;
        restart)
            stop_pipeline
            sleep 2
            check_dependencies
            start_pipeline
            show_status
            ;;
        status)
            show_status
            ;;
        logs)
            tail -f "$LOG_DIR/email-pipeline.log"
            ;;
        errors)
            tail -f "$LOG_DIR/email-pipeline-error.log"
            ;;
        *)
            echo "Usage: $0 {start|stop|restart|status|logs|errors}"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"