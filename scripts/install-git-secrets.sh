#!/bin/bash

# Install git-secrets for enhanced secret detection
# This script sets up git-secrets which prevents committing secrets to git

echo "🔐 Setting up git-secrets for enhanced security..."

# Check if git-secrets is already installed
if command -v git-secrets &> /dev/null; then
    echo "✅ git-secrets is already installed"
else
    echo "📦 Installing git-secrets..."
    
    # Clone and install git-secrets
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install git-secrets
        else
            echo "Installing from source..."
            git clone https://github.com/awslabs/git-secrets.git /tmp/git-secrets
            cd /tmp/git-secrets && sudo make install
            cd - && rm -rf /tmp/git-secrets
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        echo "Installing from source..."
        git clone https://github.com/awslabs/git-secrets.git /tmp/git-secrets
        cd /tmp/git-secrets && sudo make install
        cd - && rm -rf /tmp/git-secrets
    else
        echo "⚠️  Unsupported OS. Please install git-secrets manually."
        echo "Visit: https://github.com/awslabs/git-secrets"
        exit 1
    fi
fi

# Install git-secrets hooks in the repository
echo "🔧 Installing git-secrets hooks..."
git secrets --install -f

# Add common patterns to detect
echo "📝 Adding secret patterns..."

# AWS patterns
git secrets --register-aws

# Additional custom patterns
git secrets --add 'api[_-]?key.*[:=]\s*["\'][^"\']+["\']' || true
git secrets --add 'secret.*[:=]\s*["\'][^"\']+["\']' || true
git secrets --add 'password.*[:=]\s*["\'][^"\']+["\']' || true
git secrets --add 'token.*[:=]\s*["\'][^"\']+["\']' || true
git secrets --add 'private[_-]?key.*[:=]\s*["\'][^"\']+["\']' || true

# MongoDB/Database URLs
git secrets --add 'mongodb(\+srv)?:\/\/[^:]+:[^@]+@[^\/]+' || true
git secrets --add 'postgres:\/\/[^:]+:[^@]+@[^\/]+' || true
git secrets --add 'mysql:\/\/[^:]+:[^@]+@[^\/]+' || true

# API Keys for popular services
git secrets --add 'sk_live_[A-Za-z0-9]{24,}' || true  # Stripe
git secrets --add 'SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}' || true  # SendGrid
git secrets --add 'xox[baprs]-[0-9]{10,}-[A-Za-z0-9]{24,}' || true  # Slack

# Add allowed patterns (false positives)
echo "✅ Adding allowed patterns..."
git secrets --add --allowed 'localhost' || true
git secrets --add --allowed '127.0.0.1' || true
git secrets --add --allowed 'example\.com' || true
git secrets --add --allowed 'test' || true
git secrets --add --allowed 'demo' || true
git secrets --add --allowed 'dummy' || true
git secrets --add --allowed 'process\.env\.' || true
git secrets --add --allowed '\$\{[^}]+\}' || true

echo "✅ git-secrets setup complete!"
echo ""
echo "📚 Usage:"
echo "  - git secrets --scan        # Scan repository for secrets"
echo "  - git secrets --list        # List configured patterns"
echo "  - git secrets --add [regex] # Add new pattern to detect"
echo ""
echo "🔒 Your repository is now protected against accidental secret commits!"