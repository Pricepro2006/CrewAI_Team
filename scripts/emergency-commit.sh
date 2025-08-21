#!/bin/bash

# Emergency commit script for when pre-commit hooks are failing
# This should only be used when urgent fixes are needed

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "${YELLOW}⚠️  EMERGENCY COMMIT MODE${NC}"
echo "${YELLOW}This bypasses all pre-commit hooks and safety checks!${NC}"
echo

# Check if there are staged changes
if ! git diff --cached --quiet; then
  echo "${BLUE}📋 Staged files:${NC}"
  git diff --cached --name-only
  echo
else
  echo "${RED}❌ No staged changes found!${NC}"
  echo "Stage your changes with: git add <files>"
  exit 1
fi

# Get commit message
if [ -z "$1" ]; then
  echo "${BLUE}💬 Enter commit message:${NC}"
  read -r commit_message
  if [ -z "$commit_message" ]; then
    echo "${RED}❌ Commit message cannot be empty!${NC}"
    exit 1
  fi
else
  commit_message="$1"
fi

# Confirm emergency commit
echo
echo "${YELLOW}⚠️  About to commit with message: \"$commit_message\"${NC}"
echo "${YELLOW}⚠️  This will bypass ALL pre-commit hooks!${NC}"
echo "${BLUE}Are you sure? (y/N):${NC}"
read -r confirmation

if [ "$confirmation" != "y" ] && [ "$confirmation" != "Y" ]; then
  echo "${BLUE}🚫 Emergency commit cancelled${NC}"
  exit 0
fi

# Perform the emergency commit
echo "${BLUE}🚨 Performing emergency commit...${NC}"
git commit --no-verify -m "$commit_message"

if [ $? -eq 0 ]; then
  echo "${GREEN}✅ Emergency commit successful!${NC}"
  echo
  echo "${YELLOW}📝 TODO after emergency:${NC}"
  echo "${YELLOW}  1. Run: npm run format${NC}"
  echo "${YELLOW}  2. Run: npm run typecheck${NC}"
  echo "${YELLOW}  3. Run: npm test${NC}"
  echo "${YELLOW}  4. Fix any issues found${NC}"
  echo "${YELLOW}  5. Commit fixes normally (with hooks)${NC}"
  echo
  echo "${BLUE}💡 Consider creating a follow-up commit to fix any issues${NC}"
else
  echo "${RED}❌ Emergency commit failed!${NC}"
  exit 1
fi