#!/bin/bash

# Optimized llama.cpp Server Startup Script for AMD Ryzen 7 PRO (64GB RAM)
# Features: CPU affinity, NUMA optimization, memory locking, health checks, auto-restart

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LLAMA_BIN="${PROJECT_ROOT}/llama.cpp/build/bin/llama-server"
MODELS_DIR="${PROJECT_ROOT}/models"
LOG_DIR="${PROJECT_ROOT}/logs"
PID_FILE="/tmp/llama-server.pid"

# Default settings (can be overridden by environment)
MODEL_NAME="${LLAMA_MODEL:-llama-3.2-3b-instruct.Q4_K_M.gguf}"
PORT="${LLAMA_PORT:-8081}"
HOST="${LLAMA_HOST:-127.0.0.1}"
PROFILE="${LLAMA_PROFILE:-balanced}"  # fast, balanced, quality, memory, batch

# Performance profiles for AMD Ryzen 7 PRO
case "$PROFILE" in
    "fast")
        THREADS=8
        CONTEXT=2048
        BATCH=256
        UBATCH=128
        PARALLEL=2
        ;;
    "balanced")
        THREADS=12
        CONTEXT=4096
        BATCH=512
        UBATCH=256
        PARALLEL=4
        ;;
    "quality")
        THREADS=14
        CONTEXT=8192
        BATCH=1024
        UBATCH=512
        PARALLEL=4
        ;;
    "memory")
        THREADS=10
        CONTEXT=16384
        BATCH=2048
        UBATCH=512
        PARALLEL=2
        ;;
    "batch")
        THREADS=16
        CONTEXT=4096
        BATCH=2048
        UBATCH=1024
        PARALLEL=8
        ;;
    *)
        THREADS=12
        CONTEXT=4096
        BATCH=512
        UBATCH=256
        PARALLEL=4
        ;;
esac

# Override with environment variables if set
THREADS="${LLAMA_THREADS:-$THREADS}"
CONTEXT="${LLAMA_CONTEXT:-$CONTEXT}"
BATCH="${LLAMA_BATCH:-$BATCH}"
UBATCH="${LLAMA_UBATCH:-$UBATCH}"
PARALLEL="${LLAMA_PARALLEL:-$PARALLEL}"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to check if server is running
is_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# Function to start the server
start_server() {
    if is_running; then
        echo "llama.cpp server is already running (PID: $(cat $PID_FILE))"
        return 0
    fi

    echo "Starting llama.cpp server with profile: $PROFILE"
    echo "Configuration:"
    echo "  Model: $MODEL_NAME"
    echo "  Threads: $THREADS"
    echo "  Context: $CONTEXT"
    echo "  Batch: $BATCH"
    echo "  Port: $PORT"

    # Set AMD Ryzen optimized environment variables
    export OMP_NUM_THREADS=$THREADS
    export OMP_PROC_BIND=spread
    export OMP_PLACES=threads
    export OPENBLAS_NUM_THREADS=$THREADS
    export MKL_NUM_THREADS=$THREADS
    export MALLOC_ARENA_MAX=2
    export MALLOC_MMAP_THRESHOLD_=131072
    export MALLOC_TRIM_THRESHOLD_=131072
    export TOKENIZERS_PARALLELISM=false
    export GGML_CUDA_NO_PINNED=1
    export LLAMA_NO_ACCELERATE=1

    # Set CPU affinity for AMD Ryzen (2 CCX with 8 cores each)
    if [ "$THREADS" -le 8 ]; then
        # Use single CCX for small workloads (better cache locality)
        export GOMP_CPU_AFFINITY="0-$(($THREADS-1))"
    else
        # Use both CCX for larger workloads
        export GOMP_CPU_AFFINITY="0-$(($THREADS-1))"
    fi

    # Check if model exists
    MODEL_PATH="${MODELS_DIR}/${MODEL_NAME}"
    if [ ! -f "$MODEL_PATH" ]; then
        echo "Error: Model not found at $MODEL_PATH"
        echo "Available models:"
        ls -la "$MODELS_DIR" 2>/dev/null || echo "No models directory found"
        exit 1
    fi

    # Build server command
    SERVER_CMD="$LLAMA_BIN \
        --model \"$MODEL_PATH\" \
        --host $HOST \
        --port $PORT \
        --ctx-size $CONTEXT \
        --threads $THREADS \
        --threads-batch 4 \
        --threads-http 4 \
        --batch-size $BATCH \
        --ubatch-size $UBATCH \
        --parallel $PARALLEL \
        --mlock \
        --numa distribute \
        --cont-batching \
        --metrics \
        --log-disable"

    # Start server with automatic restart on failure
    echo "Starting server..."
    nohup bash -c "
        while true; do
            $SERVER_CMD 2>&1 | tee -a \"${LOG_DIR}/llama-server-\$(date +%Y%m%d).log\"
            EXIT_CODE=\$?
            echo \"Server exited with code \$EXIT_CODE at \$(date)\" >> \"${LOG_DIR}/llama-server-crashes.log\"
            
            if [ \$EXIT_CODE -eq 0 ] || [ \$EXIT_CODE -eq 130 ]; then
                # Normal exit or SIGINT (Ctrl+C)
                break
            fi
            
            echo \"Server crashed, restarting in 5 seconds...\"
            sleep 5
        done
    " > "${LOG_DIR}/llama-server.out" 2>&1 &

    SERVER_PID=$!
    echo $SERVER_PID > "$PID_FILE"

    # Wait for server to start
    echo -n "Waiting for server to start"
    for i in {1..30}; do
        if curl -s "http://${HOST}:${PORT}/health" > /dev/null 2>&1; then
            echo ""
            echo "Server started successfully!"
            echo "  PID: $SERVER_PID"
            echo "  URL: http://${HOST}:${PORT}"
            echo "  Health: http://${HOST}:${PORT}/health"
            echo "  Metrics: http://${HOST}:${PORT}/metrics"
            return 0
        fi
        echo -n "."
        sleep 1
    done

    echo ""
    echo "Warning: Server may not have started properly. Check logs at ${LOG_DIR}/llama-server.out"
    return 1
}

# Function to stop the server
stop_server() {
    if ! is_running; then
        echo "llama.cpp server is not running"
        return 0
    fi

    PID=$(cat "$PID_FILE")
    echo "Stopping llama.cpp server (PID: $PID)..."
    
    # Try graceful shutdown first
    kill -TERM "$PID" 2>/dev/null || true
    
    # Wait for process to exit
    for i in {1..10}; do
        if ! ps -p "$PID" > /dev/null 2>&1; then
            rm -f "$PID_FILE"
            echo "Server stopped successfully"
            return 0
        fi
        sleep 1
    done

    # Force kill if still running
    echo "Force killing server..."
    kill -9 "$PID" 2>/dev/null || true
    rm -f "$PID_FILE"
    echo "Server stopped"
}

# Function to check server health
check_health() {
    if ! is_running; then
        echo "Server is not running"
        return 1
    fi

    echo "Checking server health..."
    
    # Check health endpoint
    if HEALTH=$(curl -s "http://${HOST}:${PORT}/health" 2>/dev/null); then
        echo "Health check: OK"
        echo "$HEALTH" | jq . 2>/dev/null || echo "$HEALTH"
    else
        echo "Health check: FAILED"
        return 1
    fi

    # Check metrics
    echo ""
    echo "Server metrics:"
    curl -s "http://${HOST}:${PORT}/metrics" 2>/dev/null | head -20 || echo "Could not fetch metrics"

    # Show resource usage
    if is_running; then
        PID=$(cat "$PID_FILE")
        echo ""
        echo "Resource usage:"
        ps -p "$PID" -o pid,vsz,rss,pcpu,pmem,comm --no-headers || true
    fi
}

# Function to restart the server
restart_server() {
    echo "Restarting llama.cpp server..."
    stop_server
    sleep 2
    start_server
}

# Function to show logs
show_logs() {
    LOG_FILE="${LOG_DIR}/llama-server-$(date +%Y%m%d).log"
    if [ -f "$LOG_FILE" ]; then
        echo "Showing last 50 lines of $LOG_FILE:"
        tail -50 "$LOG_FILE"
    else
        echo "No log file found for today"
        echo "Available log files:"
        ls -la "${LOG_DIR}"/llama-server-*.log 2>/dev/null || echo "No log files found"
    fi
}

# Function to monitor server with auto-restart
monitor_server() {
    echo "Starting server monitor (Ctrl+C to stop)..."
    
    # Start server if not running
    if ! is_running; then
        start_server
    fi

    while true; do
        if ! is_running; then
            echo "$(date): Server is down, restarting..."
            start_server
        fi

        # Health check
        if ! curl -s "http://${HOST}:${PORT}/health" > /dev/null 2>&1; then
            echo "$(date): Health check failed, restarting server..."
            restart_server
        fi

        sleep 30
    done
}

# Main command handling
case "${1:-start}" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        restart_server
        ;;
    status)
        if is_running; then
            echo "llama.cpp server is running (PID: $(cat $PID_FILE))"
            check_health
        else
            echo "llama.cpp server is not running"
            exit 1
        fi
        ;;
    health)
        check_health
        ;;
    logs)
        show_logs
        ;;
    monitor)
        monitor_server
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|health|logs|monitor}"
        echo ""
        echo "Environment variables:"
        echo "  LLAMA_MODEL    - Model file name (default: llama-3.2-3b-instruct.Q4_K_M.gguf)"
        echo "  LLAMA_PORT     - Server port (default: 8081)"
        echo "  LLAMA_HOST     - Server host (default: 127.0.0.1)"
        echo "  LLAMA_PROFILE  - Performance profile: fast|balanced|quality|memory|batch"
        echo "  LLAMA_THREADS  - Override thread count"
        echo "  LLAMA_CONTEXT  - Override context size"
        echo "  LLAMA_BATCH    - Override batch size"
        echo ""
        echo "Examples:"
        echo "  $0 start                    # Start with default settings"
        echo "  LLAMA_PROFILE=fast $0 start # Start with fast profile"
        echo "  $0 monitor                  # Start and monitor with auto-restart"
        exit 1
        ;;
esac