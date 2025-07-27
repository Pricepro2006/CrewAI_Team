#!/bin/bash

# Setup script for security git hooks
# This ensures all hooks are properly configured

echo "🔒 Setting up security git hooks..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if npm packages are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing npm packages...${NC}"
    npm install
fi

# Initialize husky if not already done
if [ ! -d ".husky" ]; then
    echo -e "${YELLOW}🐾 Initializing husky...${NC}"
    npx husky init
else
    echo -e "${GREEN}✅ Husky already initialized${NC}"
fi

# Ensure hooks are executable
echo "🔧 Making hooks executable..."
chmod +x .husky/pre-commit 2>/dev/null || true
chmod +x .husky/commit-msg 2>/dev/null || true
chmod +x scripts/check-*.js 2>/dev/null || true
chmod +x scripts/security-checks.js 2>/dev/null || true

# Verify lint-staged configuration
if [ ! -f ".lintstagedrc.json" ]; then
    echo -e "${RED}❌ .lintstagedrc.json not found!${NC}"
    echo "Please ensure .lintstagedrc.json exists"
    exit 1
fi

# Test pre-commit hook
echo -e "\n${YELLOW}🧪 Testing pre-commit hook setup...${NC}"
if [ -x ".husky/pre-commit" ]; then
    echo -e "${GREEN}✅ Pre-commit hook is executable${NC}"
else
    echo -e "${RED}❌ Pre-commit hook is not executable${NC}"
    exit 1
fi

# Test commit-msg hook
if [ -x ".husky/commit-msg" ]; then
    echo -e "${GREEN}✅ Commit-msg hook is executable${NC}"
else
    echo -e "${RED}❌ Commit-msg hook is not executable${NC}"
    exit 1
fi

# Verify security scripts exist
REQUIRED_SCRIPTS=(
    "scripts/check-secrets.js"
    "scripts/check-file-size.js"
    "scripts/security-checks.js"
    "scripts/check-commit-msg.js"
)

echo -e "\n${YELLOW}📋 Verifying security scripts...${NC}"
for script in "${REQUIRED_SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        echo -e "${GREEN}✅ $script exists${NC}"
    else
        echo -e "${RED}❌ $script is missing!${NC}"
        exit 1
    fi
done

# Optional: Install git-secrets
echo -e "\n${YELLOW}🔐 Git-secrets setup (optional)${NC}"
read -p "Would you like to install git-secrets for enhanced security? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -x "scripts/install-git-secrets.sh" ]; then
        ./scripts/install-git-secrets.sh
    else
        echo -e "${RED}❌ install-git-secrets.sh not found${NC}"
    fi
fi

# Display hook information
echo -e "\n${GREEN}✅ Security hooks setup complete!${NC}"
echo
echo "📚 Hooks installed:"
echo "  - Pre-commit: Runs security checks, linting, and tests"
echo "  - Commit-msg: Validates commit message format"
echo
echo "🔒 Security checks include:"
echo "  - Secret detection (API keys, passwords, tokens)"
echo "  - File size validation"
echo "  - Code security patterns"
echo "  - TypeScript type checking"
echo "  - Related test execution"
echo
echo "📖 For more information, see: docs/SECURITY_HOOKS_GUIDE.md"
echo
echo -e "${YELLOW}💡 To test the hooks, try:${NC}"
echo "  1. Stage a file with console.log: git add <file>"
echo "  2. Try to commit: git commit -m 'test'"
echo "  3. The hook should catch the console.log"
echo
echo -e "${GREEN}Happy secure coding! 🚀${NC}"