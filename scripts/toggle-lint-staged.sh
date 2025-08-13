#!/bin/bash

# Toggle between strict and development lint-staged configurations
# Usage: ./scripts/toggle-lint-staged.sh [dev|strict]

MODE="${1:-dev}"

if [ "$MODE" = "dev" ]; then
  echo "🔧 Switching to development mode (allowing warnings)..."
  cp .lintstagedrc.optimized.json .lintstagedrc.json
  echo "✅ Development mode active - warnings allowed, auto-fix enabled"
elif [ "$MODE" = "strict" ]; then
  echo "🔒 Switching to strict mode (no warnings allowed)..."
  cat > .lintstagedrc.json << 'EOF'
{
  "*.{ts,tsx}": [
    "bash -c 'echo \"Checking TypeScript for:\" $0'",
    "tsc --noEmit --skipLibCheck --incremental --tsBuildInfoFile .tsbuildinfo.precommit"
  ],
  "*.{js,jsx,ts,tsx,json,md}": [
    "prettier --check --cache --cache-location .prettier-cache"
  ],
  "*.{ts,tsx,js,jsx}": [
    "eslint --cache --cache-location .eslintcache --max-warnings 0"
  ],
  "*": ["tsx scripts/check-secrets.ts"]
}
EOF
  echo "✅ Strict mode active - no warnings allowed"
else
  echo "❌ Invalid mode: $MODE"
  echo "Usage: $0 [dev|strict]"
  exit 1
fi