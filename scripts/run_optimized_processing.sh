#!/bin/bash
# Run optimized email processing with better error handling

echo "🚀 Starting optimized email processing for complete chains..."
echo "Target: Process all 25,482 remaining complete email chains"
echo "Workers: 3 (reduced from 4 to prevent timeouts)"
echo ""

# Create log directory if needed
mkdir -p ./logs

# Set environment for better performance
export PYTHONUNBUFFERED=1
export OMP_NUM_THREADS=4

# Run with 3 workers (more stable than 4)
nohup python scripts/process_emails_parallel_optimized.py \
    --workers 3 \
    --hours 168 \
    --db ./data/crewai_enhanced.db \
    > ./logs/parallel_processing_3workers_$(date +%Y%m%d_%H%M%S).log 2>&1 &

PID=$!
echo "Started parallel processing with PID: $PID"
echo "Log file: ./logs/parallel_processing_3workers_$(date +%Y%m%d_%H%M%S).log"

# Also start the progress monitor
echo ""
echo "Starting progress monitor..."
nohup python scripts/monitor_email_processing_progress.py \
    --refresh 300 \
    > ./logs/progress_monitor_$(date +%Y%m%d_%H%M%S).log 2>&1 &

MON_PID=$!
echo "Progress monitor PID: $MON_PID"

echo ""
echo "✅ Processing started successfully!"
echo "Run 'python scripts/monitor_email_processing_progress.py --once' to check progress"
echo "Estimated completion: 14-20 days for all complete chains"