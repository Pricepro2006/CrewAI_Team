#\!/bin/bash
# Security Setup Script for CrewAI_Team
# Implements comprehensive security measures for version control

set -e

echo "🔒 Setting up comprehensive security for CrewAI_Team..."

# 1. Create .env from template if it doesn't exist
if [ \! -f .env ]; then
    echo "📝 Creating .env from template..."
    cp .env.example .env
    echo "⚠️  IMPORTANT: Edit .env and add your real secrets\!"
fi

# 2. Create secure config from template
if [ \! -f claude_desktop_config.json ]; then
    echo "📝 Creating secure config from template..."
    # This would normally use envsubst, but for now just copy template
    cp claude_desktop_config.template.json claude_desktop_config.json
    echo "⚠️  IMPORTANT: Edit claude_desktop_config.json and replace \${VARIABLE} placeholders\!"
fi

# 3. Ensure all sensitive files are gitignored
echo "🛡️  Updating .gitignore for security..."
grep -q "claude_desktop_config.json" .gitignore || echo "claude_desktop_config.json" >> .gitignore

# 4. Check for secrets in staged files
echo "🔍 Checking for secrets in staged files..."
if git diff --cached --name-only  < /dev/null |  xargs grep -l "client_secret\|CLIENT_SECRET\|api_key\|API_KEY\|password\|PASSWORD\|token\|TOKEN" 2>/dev/null; then
    echo "🚨 WARNING: Potential secrets found in staged files\!"
    echo "Please review and remove secrets before committing."
    exit 1
fi

# 5. Setup pre-commit hook
echo "🔧 Setting up pre-commit security hook..."
mkdir -p .git/hooks
cat > .git/hooks/pre-commit << 'HOOK'
#\!/bin/bash
# Pre-commit security check

echo "🔍 Running pre-commit security checks..."

# Check for secrets
if git diff --cached --name-only | xargs grep -l "client_secret\|CLIENT_SECRET\|api_key\|API_KEY\|password\|PASSWORD\|token\|TOKEN" 2>/dev/null; then
    echo "🚨 COMMIT BLOCKED: Potential secrets found\!"
    echo "Remove secrets before committing."
    exit 1
fi

echo "✅ Security checks passed."
HOOK

chmod +x .git/hooks/pre-commit

echo "✅ Security setup complete\!"
echo ""
echo "Next steps:"
echo "1. 🔑 Revoke the Azure client secret: 3Pr8Q~W8wu7TKQNuo4v0GJwz0NK0T7Vw86~CFajw"
echo "2. 📝 Edit .env with your real secrets"
echo "3. 📝 Edit claude_desktop_config.json with real values"
echo "4. 🧹 Run: git filter-branch to clean history"
echo "5. ✅ Test secure push to GitHub"
