#!/bin/bash

# Branch Protection Setup Script
# This script configures branch protection rules for the repository

echo "🔒 Setting up branch protection rules..."

# Get repository information
REPO_OWNER=$(git remote get-url origin | sed -E 's/.*github\.com[:/]([^/]+)\/.*/\1/')
REPO_NAME=$(git remote get-url origin | sed -E 's/.*github\.com[:/][^/]+\/([^.]+)(\.git)?$/\1/')

if [ -z "$REPO_OWNER" ] || [ -z "$REPO_NAME" ]; then
    echo "❌ Could not determine repository owner and name"
    exit 1
fi

echo "Repository: $REPO_OWNER/$REPO_NAME"

# Function to set up branch protection
setup_branch_protection() {
    local BRANCH=$1
    local REQUIRED_REVIEWERS=$2
    
    echo "Setting up protection for branch: $BRANCH"
    
    gh api repos/$REPO_OWNER/$REPO_NAME/branches/$BRANCH/protection \
        --method PUT \
        -H "Accept: application/vnd.github+json" \
        -f required_status_checks[strict]=true \
        -f required_status_checks[contexts][]="ci" \
        -f required_status_checks[contexts][]="pr-checks" \
        -F enforce_admins=true \
        -f required_pull_request_reviews[required_approving_review_count]=$REQUIRED_REVIEWERS \
        -f required_pull_request_reviews[dismiss_stale_reviews]=true \
        -f required_pull_request_reviews[require_code_owner_reviews]=false \
        -F allow_force_pushes=false \
        -F allow_deletions=false
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully protected branch: $BRANCH"
    else
        echo "❌ Failed to protect branch: $BRANCH"
        return 1
    fi
}

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed. Please install it first:"
    echo "   https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub. Please run: gh auth login"
    exit 1
fi

# Set up protection for main branch (2 required reviews)
echo ""
echo "🔒 Protecting main branch (2 required reviews)..."
setup_branch_protection "main" 2

# Set up protection for develop branch (1 required review)
echo ""
echo "🔒 Protecting develop branch (1 required review)..."
setup_branch_protection "develop" 1

# Create feature/production-implementation branch protection if it exists
if git show-ref --verify --quiet refs/remotes/origin/feature/production-implementation; then
    echo ""
    echo "🔒 Protecting feature/production-implementation branch (1 required review)..."
    setup_branch_protection "feature/production-implementation" 1
fi

# Display current protection status
echo ""
echo "📊 Current branch protection status:"
echo ""

for branch in main develop feature/production-implementation; do
    if git show-ref --verify --quiet refs/remotes/origin/$branch; then
        echo "Branch: $branch"
        gh api repos/$REPO_OWNER/$REPO_NAME/branches/$branch/protection 2>/dev/null && echo "✅ Protected" || echo "❌ Not protected"
        echo ""
    fi
done

echo "✨ Branch protection setup complete!"