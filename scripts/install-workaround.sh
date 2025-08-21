#!/bin/bash

# Email Pipeline Installation Workaround Script
# This script bypasses the Python distutils requirement for better-sqlite3

echo "========================================="
echo "Email Pipeline Installation Workaround"
echo "========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if better-sqlite3 is already working
echo -e "${YELLOW}Checking better-sqlite3 status...${NC}"
if node -e "require('better-sqlite3')" 2>/dev/null; then
    echo -e "${GREEN}✓ better-sqlite3 is already installed and working!${NC}"
    SKIP_SQLITE3=true
else
    echo -e "${YELLOW}⚠ better-sqlite3 needs installation${NC}"
    SKIP_SQLITE3=false
fi

# Function to install packages without better-sqlite3
install_without_sqlite3() {
    echo -e "${YELLOW}Installing dependencies (excluding better-sqlite3)...${NC}"
    
    # Create a temporary package.json without better-sqlite3
    cp package.json package.json.backup
    node -e "
        const pkg = require('./package.json');
        delete pkg.dependencies['better-sqlite3'];
        require('fs').writeFileSync('./package.json', JSON.stringify(pkg, null, 2));
    "
    
    # Install all other dependencies
    npm install --no-optional
    
    # Restore original package.json
    mv package.json.backup package.json
    
    echo -e "${GREEN}✓ Other dependencies installed successfully${NC}"
}

# Function to download prebuilt better-sqlite3 binary
download_prebuilt_binary() {
    echo -e "${YELLOW}Attempting to download prebuilt better-sqlite3 binary...${NC}"
    
    # Get system information
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    PLATFORM=$(node -e "console.log(process.platform)")
    ARCH=$(node -e "console.log(process.arch)")
    
    # Construct the prebuilt binary URL
    BINARY_NAME="better-sqlite3-v9.6.0-node-v$(node -e "console.log(process.versions.modules)")-${PLATFORM}-${ARCH}.tar.gz"
    BINARY_URL="https://github.com/WiseLibs/better-sqlite3/releases/download/v9.6.0/${BINARY_NAME}"
    
    echo "Looking for prebuilt binary: $BINARY_NAME"
    
    # Try to download the prebuilt binary
    if curl -L -f -o "/tmp/${BINARY_NAME}" "${BINARY_URL}" 2>/dev/null; then
        echo -e "${GREEN}✓ Prebuilt binary downloaded${NC}"
        
        # Extract to the correct location
        SQLITE_DIR="node_modules/better-sqlite3"
        mkdir -p "${SQLITE_DIR}/build/Release"
        tar -xzf "/tmp/${BINARY_NAME}" -C "${SQLITE_DIR}/build/Release"
        rm -f "/tmp/${BINARY_NAME}"
        
        return 0
    else
        echo -e "${YELLOW}⚠ No prebuilt binary available for your system${NC}"
        return 1
    fi
}

# Main installation flow
if [ "$SKIP_SQLITE3" = false ]; then
    # Try to use prebuilt binary first
    if ! download_prebuilt_binary; then
        echo -e "${YELLOW}Falling back to local build workaround...${NC}"
        
        # Create a mock distutils module for Python
        echo -e "${YELLOW}Creating Python distutils mock...${NC}"
        PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null || echo "3.10")
        MOCK_DIR="$HOME/.local/lib/python${PYTHON_VERSION}/site-packages/distutils"
        
        mkdir -p "$MOCK_DIR"
        cat > "$MOCK_DIR/__init__.py" << 'EOF'
# Mock distutils module to satisfy node-gyp requirements
import sys
import os

class StubModule:
    def __getattr__(self, name):
        return lambda *args, **kwargs: None

sys.modules['distutils.sysconfig'] = StubModule()
sys.modules['distutils.core'] = StubModule()
sys.modules['distutils.util'] = StubModule()
EOF
        
        echo -e "${GREEN}✓ Python distutils mock created${NC}"
        
        # Try to install better-sqlite3 with the mock
        echo -e "${YELLOW}Installing better-sqlite3...${NC}"
        PYTHONPATH="$HOME/.local/lib/python${PYTHON_VERSION}/site-packages:$PYTHONPATH" npm install better-sqlite3@9.6.0 --no-optional || true
    fi
fi

# Verify installation
echo -e "\n${YELLOW}Verifying installation...${NC}"
if node -e "require('better-sqlite3'); console.log('✓ better-sqlite3 is working')"; then
    echo -e "${GREEN}✓ Installation successful!${NC}"
    
    # Install remaining dependencies if needed
    if [ ! -d "node_modules/@trpc" ] || [ ! -d "node_modules/express" ]; then
        echo -e "${YELLOW}Installing remaining dependencies...${NC}"
        npm install --no-optional
    fi
    
    echo -e "\n${GREEN}✓ All dependencies installed successfully!${NC}"
    echo -e "${GREEN}You can now run the email pipeline with:${NC}"
    echo -e "  npm run pipeline:execute"
    echo -e "  npm run pipeline:execute:prod"
else
    echo -e "${RED}✗ Installation failed${NC}"
    echo -e "${YELLOW}Please try one of these alternatives:${NC}"
    echo -e "  1. Install Python distutils: sudo apt-get install python3-distutils"
    echo -e "  2. Use a Docker container with Node.js and Python pre-configured"
    echo -e "  3. Copy a working better-sqlite3 from another installation"
    exit 1
fi