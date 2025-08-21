#!/bin/bash

# Setup script for llama.cpp with AMD Ryzen optimization
# This script installs and configures llama.cpp for the CrewAI Team project

set -e

echo "========================================="
echo "llama.cpp Setup for AMD Ryzen 7 PRO"
echo "========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LLAMA_CPP_DIR="$PROJECT_ROOT/llama.cpp"
MODELS_DIR="$PROJECT_ROOT/models"

# Check system information
echo -e "${YELLOW}System Information:${NC}"
echo "CPU: $(lscpu | grep 'Model name' | cut -d':' -f2 | xargs)"
echo "Cores: $(nproc) logical ($(lscpu | grep 'Core(s) per socket' | cut -d':' -f2 | xargs) physical per socket)"
echo "RAM: $(free -h | grep Mem | awk '{print $2}')"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

MISSING_DEPS=""

if ! command_exists git; then
    MISSING_DEPS="$MISSING_DEPS git"
fi

if ! command_exists make; then
    MISSING_DEPS="$MISSING_DEPS build-essential"
fi

if ! command_exists g++; then
    MISSING_DEPS="$MISSING_DEPS g++"
fi

if [ ! -z "$MISSING_DEPS" ]; then
    echo -e "${RED}Missing dependencies: $MISSING_DEPS${NC}"
    echo "Please install them first:"
    echo "  sudo apt-get update && sudo apt-get install -y$MISSING_DEPS"
    exit 1
fi

echo -e "${GREEN}✓ All prerequisites installed${NC}"
echo ""

# Clone or update llama.cpp
if [ -d "$LLAMA_CPP_DIR" ]; then
    echo -e "${YELLOW}Updating existing llama.cpp installation...${NC}"
    cd "$LLAMA_CPP_DIR"
    git pull origin master
else
    echo -e "${YELLOW}Cloning llama.cpp...${NC}"
    cd "$PROJECT_ROOT"
    git clone https://github.com/ggml-org/llama.cpp.git
    cd "$LLAMA_CPP_DIR"
fi

# Detect CPU features
echo ""
echo -e "${YELLOW}Detecting CPU features...${NC}"

CPU_FLAGS=$(cat /proc/cpuinfo | grep flags | head -1)
CMAKE_FLAGS=""

if echo "$CPU_FLAGS" | grep -q "avx2"; then
    echo -e "${GREEN}✓ AVX2 support detected${NC}"
    CMAKE_FLAGS="$CMAKE_FLAGS -DGGML_AVX2=ON"
fi

if echo "$CPU_FLAGS" | grep -q "fma"; then
    echo -e "${GREEN}✓ FMA support detected${NC}"
    CMAKE_FLAGS="$CMAKE_FLAGS -DGGML_FMA=ON"
fi

if echo "$CPU_FLAGS" | grep -q "f16c"; then
    echo -e "${GREEN}✓ F16C support detected${NC}"
    CMAKE_FLAGS="$CMAKE_FLAGS -DGGML_F16C=ON"
fi

if echo "$CPU_FLAGS" | grep -q "sse4_2"; then
    echo -e "${GREEN}✓ SSE4.2 support detected${NC}"
    CMAKE_FLAGS="$CMAKE_FLAGS -DGGML_SSE42=ON"
fi

# Build llama.cpp with optimizations
echo ""
echo -e "${YELLOW}Building llama.cpp with AMD Ryzen optimizations...${NC}"

# Clean previous build
if [ -d "build" ]; then
    rm -rf build
fi

# Configure with CMake
cmake -B build \
    -DCMAKE_BUILD_TYPE=Release \
    -DGGML_NATIVE=ON \
    -DGGML_OPENMP=ON \
    $CMAKE_FLAGS \
    -DCMAKE_C_FLAGS="-march=native -mtune=native -O3" \
    -DCMAKE_CXX_FLAGS="-march=native -mtune=native -O3"

# Build with optimal thread count
PHYSICAL_CORES=$(lscpu | grep "Core(s) per socket" | awk '{print $4}')
SOCKETS=$(lscpu | grep "Socket(s)" | awk '{print $2}')
BUILD_THREADS=$((PHYSICAL_CORES * SOCKETS))

echo "Building with $BUILD_THREADS threads..."
cmake --build build --config Release -j $BUILD_THREADS

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful!${NC}"
else
    echo -e "${RED}✗ Build failed!${NC}"
    exit 1
fi

# Create models directory
if [ ! -d "$MODELS_DIR" ]; then
    echo ""
    echo -e "${YELLOW}Creating models directory...${NC}"
    mkdir -p "$MODELS_DIR"
fi

# Create environment configuration
echo ""
echo -e "${YELLOW}Creating environment configuration...${NC}"

ENV_FILE="$PROJECT_ROOT/.env.llama"
cat > "$ENV_FILE" << EOF
# Llama.cpp Configuration for AMD Ryzen 7 PRO
# Generated on $(date)

# Paths
LLAMA_CPP_PATH=$LLAMA_CPP_DIR/build/bin/llama-cli
LLAMA_SERVER_PATH=$LLAMA_CPP_DIR/build/bin/llama-server
LLAMA_MODELS_PATH=$MODELS_DIR

# CPU Optimization (Physical cores only)
LLAMA_CPU_THREADS=$BUILD_THREADS
LLAMA_CPU_AFFINITY=0-$((BUILD_THREADS - 1))
LLAMA_NUMA_MODE=distribute

# Memory Management
LLAMA_USE_MLOCK=true
LLAMA_USE_MMAP=true

# Performance Tuning
LLAMA_CONTEXT_SIZE=8192
LLAMA_BATCH_SIZE=512
LLAMA_UBATCH_SIZE=256

# Inference Parameters
LLAMA_TEMPERATURE=0.3
LLAMA_TOP_K=40
LLAMA_TOP_P=0.9
LLAMA_REPEAT_PENALTY=1.1
LLAMA_MAX_TOKENS=2048
LLAMA_SEED=-1

# OpenMP Settings
OMP_NUM_THREADS=$BUILD_THREADS
GOMP_CPU_AFFINITY=0-$((BUILD_THREADS - 1))
MKL_NUM_THREADS=$BUILD_THREADS
MALLOC_ARENA_MAX=2
TOKENIZERS_PARALLELISM=false
EOF

echo -e "${GREEN}✓ Configuration saved to .env.llama${NC}"

# Create performance test script
echo ""
echo -e "${YELLOW}Creating performance test script...${NC}"

TEST_SCRIPT="$PROJECT_ROOT/test-llama-cpp-performance.sh"
cat > "$TEST_SCRIPT" << 'EOF'
#!/bin/bash

# Load configuration
source .env.llama

echo "====================================="
echo "Llama.cpp Performance Test"
echo "====================================="
echo ""

if [ ! -f "$LLAMA_CPP_PATH" ]; then
    echo "Error: llama-cli not found at $LLAMA_CPP_PATH"
    exit 1
fi

# Test prompt
PROMPT="The capital of France is"

# Test with different thread counts
for THREADS in 1 4 8 12 16; do
    echo "Testing with $THREADS threads..."
    
    # Create temporary test file
    TEMP_FILE=$(mktemp)
    echo "$PROMPT" > "$TEMP_FILE"
    
    # Run test
    TIME_START=$(date +%s%N)
    $LLAMA_CPP_PATH \
        -m "$LLAMA_MODELS_PATH/tinyllama-1.1b-chat.Q4_K_M.gguf" \
        -f "$TEMP_FILE" \
        -n 50 \
        -t $THREADS \
        --log-disable \
        2>/dev/null | tail -n +2
    TIME_END=$(date +%s%N)
    
    # Calculate time
    TIME_DIFF=$((TIME_END - TIME_START))
    TIME_SEC=$(echo "scale=3; $TIME_DIFF / 1000000000" | bc)
    
    echo "  Time: ${TIME_SEC}s"
    echo ""
    
    rm "$TEMP_FILE"
done

echo "Test complete!"
EOF

chmod +x "$TEST_SCRIPT"
echo -e "${GREEN}✓ Performance test script created${NC}"

# Download a small test model if not present
TEST_MODEL="$MODELS_DIR/tinyllama-1.1b-chat.Q4_K_M.gguf"
if [ ! -f "$TEST_MODEL" ]; then
    echo ""
    echo -e "${YELLOW}Downloading TinyLlama test model...${NC}"
    echo "This is a small 1.1B model for testing (~670MB)"
    
    wget -q --show-progress \
        -O "$TEST_MODEL" \
        "https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Test model downloaded${NC}"
    else
        echo -e "${YELLOW}⚠ Could not download test model. Please download manually.${NC}"
    fi
fi

# Create systemd service file (optional)
echo ""
echo -e "${YELLOW}Creating systemd service template...${NC}"

SERVICE_FILE="$PROJECT_ROOT/llama-cpp-server.service"
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Llama.cpp Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_ROOT
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
EnvironmentFile=$PROJECT_ROOT/.env.llama
ExecStart=$LLAMA_CPP_DIR/build/bin/llama-server \\
    -m $MODELS_DIR/llama-3.2-3b-instruct.Q4_K_M.gguf \\
    --host 0.0.0.0 \\
    --port 8080 \\
    -c 8192 \\
    -t $BUILD_THREADS \\
    --parallel 4 \\
    --mlock
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}✓ Systemd service template created${NC}"

# Summary
echo ""
echo "========================================="
echo -e "${GREEN}Installation Complete!${NC}"
echo "========================================="
echo ""
echo "Llama.cpp has been installed and optimized for your AMD Ryzen system."
echo ""
echo "Next steps:"
echo "1. Source the environment: source .env.llama"
echo "2. Download models to: $MODELS_DIR"
echo "3. Test performance: ./test-llama-cpp-performance.sh"
echo "4. Start server: $LLAMA_CPP_DIR/build/bin/llama-server -m <model>"
echo ""
echo "Optimized settings for your system:"
echo "  - CPU Threads: $BUILD_THREADS (physical cores only)"
echo "  - CPU Affinity: 0-$((BUILD_THREADS - 1))"
echo "  - Context Size: 8192 tokens"
echo "  - Batch Size: 512"
echo ""
echo "Model recommendations:"
echo "  - General use: Q4_K_M quantization"
echo "  - High quality: Q6_K or Q8_0 quantization"
echo "  - Fast inference: Q4_0 or Q4_K_S quantization"
echo ""
echo "For more information, see: $PROJECT_ROOT/master_knowledge_base/llama_cpp_amd_ryzen_optimization_guide.md"