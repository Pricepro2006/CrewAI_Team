#!/bin/bash

# Simple Branch Protection Setup Script
# Uses the correct GitHub API format

echo "🔒 Setting up branch protection rules..."

# Get repository information
REPO_OWNER=$(git remote get-url origin | sed -E 's/.*github\.com[:/]([^/]+)\/.*/\1/')
REPO_NAME=$(git remote get-url origin | sed -E 's/.*github\.com[:/][^/]+\/([^.]+)(\.git)?$/\1/')

if [ -z "$REPO_OWNER" ] || [ -z "$REPO_NAME" ]; then
    echo "❌ Could not determine repository owner and name"
    exit 1
fi

echo "Repository: $REPO_OWNER/$REPO_NAME"

# Function to set up branch protection with minimal settings
setup_branch_protection() {
    local BRANCH=$1
    local REQUIRED_REVIEWERS=$2
    
    echo ""
    echo "Setting up protection for branch: $BRANCH"
    
    # First check if branch exists
    if ! git show-ref --verify --quiet refs/remotes/origin/$BRANCH; then
        echo "⚠️  Branch $BRANCH does not exist remotely, skipping..."
        return 0
    fi
    
    # Use simplified protection settings
    gh api \
        --method PUT \
        -H "Accept: application/vnd.github+json" \
        repos/$REPO_OWNER/$REPO_NAME/branches/$BRANCH/protection \
        -f required_pull_request_reviews[required_approving_review_count]=$REQUIRED_REVIEWERS \
        -f required_pull_request_reviews[dismiss_stale_reviews]=true \
        -F enforce_admins=false \
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

# Set up protection for main branch (1 required review for simplicity)
echo ""
echo "🔒 Protecting main branch..."
setup_branch_protection "main" 1

# Set up protection for feature/production-implementation branch
echo ""
echo "🔒 Protecting feature/production-implementation branch..."
setup_branch_protection "feature/production-implementation" 1

# Display current protection status
echo ""
echo "📊 Current branch protection status:"
echo ""

for branch in main feature/production-implementation; do
    if git show-ref --verify --quiet refs/remotes/origin/$branch; then
        echo "Branch: $branch"
        if gh api repos/$REPO_OWNER/$REPO_NAME/branches/$branch/protection 2>/dev/null | grep -q "required_pull_request_reviews"; then
            echo "✅ Protected"
        else
            echo "❌ Not protected"
        fi
        echo ""
    fi
done

echo "✨ Branch protection setup complete!"