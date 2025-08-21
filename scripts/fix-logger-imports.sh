#!/usr/bin/env bash
set -euo pipefail

pattern='../../utils/logger.js'
replacement='../utils/logger.js'
apply=false

if [[ "${1:-}" == "--apply" ]]; then
  apply=true
  echo "⚙️  Applying fixes..."
else
  echo "🔍  Dry run—showing diffs. Run with --apply to update files."
fi

# Find all TS/TSX files importing the old logger path
files=$(grep -rl "$pattern" src --include="*.ts" --include="*.tsx" 2>/dev/null || true)

if [[ -z "$files" ]]; then
  echo "✔️  No incorrect logger import paths found."
  exit 0
fi

count=0
for file in $files; do
  echo -e "\n=== $file ==="
  diff -u "$file" <(sed "s#$pattern#$replacement#g" "$file") || true
  
  if $apply; then
    sed -i "s#$pattern#$replacement#g" "$file"
    ((count++))
  fi
done

if $apply; then
  echo -e "\n✅  Updated $count files with correct logger import paths."
else
  echo -e "\n👉  To apply these changes, re-run with: $0 --apply"
fi