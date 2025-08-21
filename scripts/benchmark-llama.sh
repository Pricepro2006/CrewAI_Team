#!/bin/bash

# llama.cpp Benchmark Script for AMD Ryzen 7 PRO (64GB RAM)
# Comprehensive performance testing across models and configurations

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LLAMA_BIN="${PROJECT_ROOT}/llama.cpp/build/bin/llama-cli"
MODELS_DIR="${PROJECT_ROOT}/models"
RESULTS_DIR="${PROJECT_ROOT}/benchmark-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RESULTS_FILE="${RESULTS_DIR}/benchmark_${TIMESTAMP}.txt"
CSV_FILE="${RESULTS_DIR}/benchmark_${TIMESTAMP}.csv"

# Test configurations
THREAD_COUNTS=(4 6 8 10 12 14 16)
BATCH_SIZES=(128 256 512 1024 2048)
CONTEXT_SIZES=(512 1024 2048 4096 8192)

# Test prompts with different lengths
SHORT_PROMPT="Explain quantum computing in one sentence."
MEDIUM_PROMPT="Write a detailed explanation of how machine learning models are trained, including the concepts of forward propagation, backpropagation, gradient descent, and optimization techniques."
LONG_PROMPT="$(cat <<EOF
Provide a comprehensive analysis of the following topics:
1. The history and evolution of artificial intelligence from the 1950s to present day
2. The key breakthroughs that enabled modern deep learning
3. The current state of large language models and their capabilities
4. The technical challenges in scaling AI systems
5. The ethical implications of advanced AI systems
6. Future directions and potential developments in AI research
Please be thorough and provide specific examples where appropriate.
EOF
)"

# Default test settings
DEFAULT_THREADS=12
DEFAULT_BATCH=512
DEFAULT_UBATCH=256
DEFAULT_CONTEXT=4096
DEFAULT_TOKENS=512

# Create results directory
mkdir -p "$RESULTS_DIR"

# Initialize results files
echo "==================================================" | tee "$RESULTS_FILE"
echo "llama.cpp Benchmark Results - AMD Ryzen 7 PRO" | tee -a "$RESULTS_FILE"
echo "Date: $(date)" | tee -a "$RESULTS_FILE"
echo "System: $(uname -a)" | tee -a "$RESULTS_FILE"
echo "CPU: $(lscpu | grep 'Model name' | cut -d: -f2 | xargs)" | tee -a "$RESULTS_FILE"
echo "Memory: $(free -h | grep Mem | awk '{print $2}')" | tee -a "$RESULTS_FILE"
echo "==================================================" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

# CSV header
echo "timestamp,model,quantization,threads,batch,ubatch,context,tokens,prompt_tokens,eval_tokens,prompt_time,eval_time,total_time,prompt_tps,eval_tps,model_size_mb,memory_used_mb" > "$CSV_FILE"

# Function to run a single benchmark
run_benchmark() {
    local model_path="$1"
    local model_name="$2"
    local threads="$3"
    local batch="$4"
    local ubatch="$5"
    local context="$6"
    local max_tokens="$7"
    local prompt="$8"
    local test_name="$9"

    echo -n "  Testing $test_name... "

    # Set environment variables for AMD Ryzen optimization
    export OMP_NUM_THREADS=$threads
    export OMP_PROC_BIND=spread
    export OMP_PLACES=threads
    export OPENBLAS_NUM_THREADS=$threads
    export MALLOC_ARENA_MAX=2
    export TOKENIZERS_PARALLELISM=false

    # Set CPU affinity
    if [ "$threads" -le 8 ]; then
        export GOMP_CPU_AFFINITY="0-$(($threads-1))"
    else
        export GOMP_CPU_AFFINITY="0-$(($threads-1))"
    fi

    # Run benchmark
    BENCH_OUTPUT=$($LLAMA_BIN \
        --model "$model_path" \
        --prompt "$prompt" \
        --n-predict $max_tokens \
        --ctx-size $context \
        --threads $threads \
        --threads-batch 4 \
        --batch-size $batch \
        --ubatch-size $ubatch \
        --temp 0.3 \
        --top-k 40 \
        --top-p 0.9 \
        --repeat-penalty 1.1 \
        --mlock \
        --numa distribute \
        --log-disable \
        --no-display-prompt 2>&1 | grep -E "prompt eval time|eval time|total time|prompt eval|eval")

    # Parse results
    PROMPT_TIME=$(echo "$BENCH_OUTPUT" | grep "prompt eval time" | grep -oE "[0-9]+\.[0-9]+ ms" | grep -oE "[0-9]+\.[0-9]+")
    EVAL_TIME=$(echo "$BENCH_OUTPUT" | grep "^eval time" | grep -oE "[0-9]+\.[0-9]+ ms" | grep -oE "[0-9]+\.[0-9]+")
    TOTAL_TIME=$(echo "$BENCH_OUTPUT" | grep "total time" | grep -oE "[0-9]+\.[0-9]+ ms" | grep -oE "[0-9]+\.[0-9]+")
    
    PROMPT_TOKENS=$(echo "$BENCH_OUTPUT" | grep "prompt eval time" | grep -oE "[0-9]+ tokens" | grep -oE "[0-9]+")
    EVAL_TOKENS=$(echo "$BENCH_OUTPUT" | grep "^eval time" | grep -oE "[0-9]+ tokens" | grep -oE "[0-9]+")
    
    PROMPT_TPS=$(echo "$BENCH_OUTPUT" | grep "prompt eval time" | grep -oE "[0-9]+\.[0-9]+ tokens per second" | grep -oE "[0-9]+\.[0-9]+")
    EVAL_TPS=$(echo "$BENCH_OUTPUT" | grep "^eval time" | grep -oE "[0-9]+\.[0-9]+ tokens per second" | grep -oE "[0-9]+\.[0-9]+")

    # Get model size
    MODEL_SIZE_MB=$(du -m "$model_path" | cut -f1)

    # Get memory usage (approximate)
    MEMORY_MB=$((context * 2 + MODEL_SIZE_MB * 2))

    echo "✓ (eval: ${EVAL_TPS} tok/s)"

    # Append to CSV
    echo "$(date +%s),$model_name,Q4_K_M,$threads,$batch,$ubatch,$context,$max_tokens,$PROMPT_TOKENS,$EVAL_TOKENS,$PROMPT_TIME,$EVAL_TIME,$TOTAL_TIME,$PROMPT_TPS,$EVAL_TPS,$MODEL_SIZE_MB,$MEMORY_MB" >> "$CSV_FILE"

    # Return eval tokens per second for comparison
    echo "$EVAL_TPS"
}

# Function to test a model with various configurations
test_model() {
    local model_file="$1"
    local model_name="$2"
    local model_path="${MODELS_DIR}/${model_file}"

    if [ ! -f "$model_path" ]; then
        echo "Model not found: $model_path" | tee -a "$RESULTS_FILE"
        echo "Skipping $model_name tests" | tee -a "$RESULTS_FILE"
        return
    fi

    echo "Testing Model: $model_name" | tee -a "$RESULTS_FILE"
    echo "File: $model_file" | tee -a "$RESULTS_FILE"
    echo "Size: $(du -h "$model_path" | cut -f1)" | tee -a "$RESULTS_FILE"
    echo "----------------------------------------" | tee -a "$RESULTS_FILE"

    # Test 1: Thread count optimization
    echo "Test 1: Thread Count Optimization" | tee -a "$RESULTS_FILE"
    BEST_THREADS=0
    BEST_TPS=0
    
    for threads in "${THREAD_COUNTS[@]}"; do
        TPS=$(run_benchmark "$model_path" "$model_name" "$threads" "$DEFAULT_BATCH" "$DEFAULT_UBATCH" "$DEFAULT_CONTEXT" "$DEFAULT_TOKENS" "$MEDIUM_PROMPT" "threads=$threads")
        
        echo "  Threads: $threads → ${TPS} tok/s" | tee -a "$RESULTS_FILE"
        
        if (( $(echo "$TPS > $BEST_TPS" | bc -l) )); then
            BEST_TPS=$TPS
            BEST_THREADS=$threads
        fi
    done
    
    echo "  Best: $BEST_THREADS threads → ${BEST_TPS} tok/s" | tee -a "$RESULTS_FILE"
    echo "" | tee -a "$RESULTS_FILE"

    # Test 2: Batch size optimization
    echo "Test 2: Batch Size Optimization (threads=$BEST_THREADS)" | tee -a "$RESULTS_FILE"
    BEST_BATCH=0
    BEST_TPS=0
    
    for batch in "${BATCH_SIZES[@]}"; do
        ubatch=$((batch / 2))
        TPS=$(run_benchmark "$model_path" "$model_name" "$BEST_THREADS" "$batch" "$ubatch" "$DEFAULT_CONTEXT" "$DEFAULT_TOKENS" "$MEDIUM_PROMPT" "batch=$batch")
        
        echo "  Batch: $batch → ${TPS} tok/s" | tee -a "$RESULTS_FILE"
        
        if (( $(echo "$TPS > $BEST_TPS" | bc -l) )); then
            BEST_TPS=$TPS
            BEST_BATCH=$batch
        fi
    done
    
    echo "  Best: batch=$BEST_BATCH → ${BEST_TPS} tok/s" | tee -a "$RESULTS_FILE"
    echo "" | tee -a "$RESULTS_FILE"

    # Test 3: Context size impact
    echo "Test 3: Context Size Impact" | tee -a "$RESULTS_FILE"
    
    for context in "${CONTEXT_SIZES[@]}"; do
        TPS=$(run_benchmark "$model_path" "$model_name" "$BEST_THREADS" "$BEST_BATCH" "$((BEST_BATCH / 2))" "$context" "$DEFAULT_TOKENS" "$MEDIUM_PROMPT" "context=$context")
        
        echo "  Context: $context → ${TPS} tok/s" | tee -a "$RESULTS_FILE"
    done
    echo "" | tee -a "$RESULTS_FILE"

    # Test 4: Prompt length impact
    echo "Test 4: Prompt Length Impact" | tee -a "$RESULTS_FILE"
    
    echo -n "  Short prompt: "
    TPS=$(run_benchmark "$model_path" "$model_name" "$BEST_THREADS" "$BEST_BATCH" "$((BEST_BATCH / 2))" "$DEFAULT_CONTEXT" "$DEFAULT_TOKENS" "$SHORT_PROMPT" "short")
    echo "    → ${TPS} tok/s" | tee -a "$RESULTS_FILE"
    
    echo -n "  Medium prompt: "
    TPS=$(run_benchmark "$model_path" "$model_name" "$BEST_THREADS" "$BEST_BATCH" "$((BEST_BATCH / 2))" "$DEFAULT_CONTEXT" "$DEFAULT_TOKENS" "$MEDIUM_PROMPT" "medium")
    echo "    → ${TPS} tok/s" | tee -a "$RESULTS_FILE"
    
    echo -n "  Long prompt: "
    TPS=$(run_benchmark "$model_path" "$model_name" "$BEST_THREADS" "$BEST_BATCH" "$((BEST_BATCH / 2))" "$DEFAULT_CONTEXT" "$DEFAULT_TOKENS" "$LONG_PROMPT" "long")
    echo "    → ${TPS} tok/s" | tee -a "$RESULTS_FILE"
    
    echo "" | tee -a "$RESULTS_FILE"
    echo "==================================================" | tee -a "$RESULTS_FILE"
    echo "" | tee -a "$RESULTS_FILE"
}

# Function to run memory stress test
memory_stress_test() {
    local model_file="$1"
    local model_name="$2"
    local model_path="${MODELS_DIR}/${model_file}"

    if [ ! -f "$model_path" ]; then
        return
    fi

    echo "Memory Stress Test: $model_name" | tee -a "$RESULTS_FILE"
    echo "----------------------------------------" | tee -a "$RESULTS_FILE"

    # Test with increasing context sizes until failure or 32K
    for context in 1024 2048 4096 8192 16384 32768; do
        echo -n "  Context $context: "
        
        if timeout 60 $LLAMA_BIN \
            --model "$model_path" \
            --prompt "Test" \
            --n-predict 10 \
            --ctx-size $context \
            --threads 12 \
            --batch-size 512 \
            --mlock \
            --log-disable > /dev/null 2>&1; then
            echo "✓ Success" | tee -a "$RESULTS_FILE"
        else
            echo "✗ Failed (likely OOM)" | tee -a "$RESULTS_FILE"
            break
        fi
    done
    
    echo "" | tee -a "$RESULTS_FILE"
}

# Function to generate performance report
generate_report() {
    echo "==================================================" | tee -a "$RESULTS_FILE"
    echo "Performance Summary" | tee -a "$RESULTS_FILE"
    echo "==================================================" | tee -a "$RESULTS_FILE"
    
    # Analyze CSV data
    if [ -f "$CSV_FILE" ]; then
        echo "" | tee -a "$RESULTS_FILE"
        echo "Top 5 Configurations by Performance:" | tee -a "$RESULTS_FILE"
        sort -t, -k15 -rn "$CSV_FILE" | head -6 | tail -5 | while IFS=, read -r _ model quant threads batch ubatch context tokens _ _ _ _ _ _ eval_tps _; do
            echo "  - $model: ${eval_tps} tok/s (t=$threads, b=$batch, ctx=$context)" | tee -a "$RESULTS_FILE"
        done
        
        echo "" | tee -a "$RESULTS_FILE"
        echo "Recommendations for AMD Ryzen 7 PRO:" | tee -a "$RESULTS_FILE"
        
        # Calculate averages per thread count
        for t in "${THREAD_COUNTS[@]}"; do
            AVG=$(grep ",$t," "$CSV_FILE" | awk -F, '{sum+=$15; count++} END {if (count>0) print sum/count; else print 0}')
            echo "  Threads=$t: avg ${AVG} tok/s" | tee -a "$RESULTS_FILE"
        done
    fi
    
    echo "" | tee -a "$RESULTS_FILE"
    echo "Results saved to:" | tee -a "$RESULTS_FILE"
    echo "  Text: $RESULTS_FILE"
    echo "  CSV: $CSV_FILE"
}

# Main execution
main() {
    echo "Starting comprehensive llama.cpp benchmark..."
    echo "This may take 30-60 minutes depending on available models."
    echo ""

    # Check for llama.cpp binary
    if [ ! -f "$LLAMA_BIN" ]; then
        echo "Error: llama.cpp binary not found at $LLAMA_BIN"
        echo "Please build llama.cpp first."
        exit 1
    fi

    # List available models
    echo "Available models in $MODELS_DIR:"
    if [ -d "$MODELS_DIR" ]; then
        ls -lh "$MODELS_DIR"/*.gguf 2>/dev/null || echo "No GGUF models found"
    else
        echo "Models directory not found. Creating it..."
        mkdir -p "$MODELS_DIR"
        echo "Please place GGUF models in $MODELS_DIR"
        exit 1
    fi
    echo ""

    # Test each model configuration
    # You can customize these based on your actual model files
    test_model "tinyllama-1.1b-chat.Q4_K_M.gguf" "TinyLlama-1.1B"
    test_model "qwen3-0.6b-instruct.Q8_0.gguf" "Qwen3-0.6B"
    test_model "llama-3.2-3b-instruct.Q4_K_M.gguf" "Llama-3.2-3B"
    test_model "phi-4-14b-tools.Q3_K_S.gguf" "Phi-4-14B"

    # Run memory stress tests
    echo "Running memory stress tests..." | tee -a "$RESULTS_FILE"
    memory_stress_test "llama-3.2-3b-instruct.Q4_K_M.gguf" "Llama-3.2-3B"
    memory_stress_test "phi-4-14b-tools.Q3_K_S.gguf" "Phi-4-14B"

    # Generate final report
    generate_report

    echo ""
    echo "Benchmark complete!"
}

# Handle command line arguments
case "${1:-run}" in
    run)
        main
        ;;
    quick)
        # Quick test with single configuration
        echo "Running quick benchmark..."
        MODEL="${2:-tinyllama-1.1b-chat.Q4_K_M.gguf}"
        test_model "$MODEL" "Quick-Test"
        ;;
    compare)
        # Compare two specific models
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo "Usage: $0 compare <model1.gguf> <model2.gguf>"
            exit 1
        fi
        test_model "$2" "Model-1"
        test_model "$3" "Model-2"
        generate_report
        ;;
    analyze)
        # Analyze existing CSV results
        if [ -z "$2" ]; then
            echo "Usage: $0 analyze <benchmark_TIMESTAMP.csv>"
            exit 1
        fi
        echo "Analyzing $2..."
        # Add analysis logic here
        ;;
    *)
        echo "Usage: $0 {run|quick|compare|analyze}"
        echo ""
        echo "Commands:"
        echo "  run              - Run full benchmark suite"
        echo "  quick [model]    - Quick test with single model"
        echo "  compare m1 m2    - Compare two models"
        echo "  analyze csv      - Analyze existing results"
        exit 1
        ;;
esac