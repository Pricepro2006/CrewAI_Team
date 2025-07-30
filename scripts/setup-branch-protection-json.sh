#!/bin/bash

# Branch Protection Setup Script with JSON payloads
# Uses proper JSON format for GitHub API

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
    
    echo ""
    echo "Setting up protection for branch: $BRANCH"
    
    # First check if branch exists
    if ! git show-ref --verify --quiet refs/remotes/origin/$BRANCH; then
        echo "⚠️  Branch $BRANCH does not exist remotely, skipping..."
        return 0
    fi
    
    # Create JSON payload
    cat > /tmp/branch-protection.json <<EOF
{
  "required_status_checks": null,
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": $REQUIRED_REVIEWERS,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": false,
  "allow_squash_merge": true,
  "allow_merge_commit": true,
  "allow_rebase_merge": true,
  "delete_branch_on_merge": false
}
EOF
    
    # Apply protection using JSON input
    gh api \
        --method PUT \
        -H "Accept: application/vnd.github+json" \
        repos/$REPO_OWNER/$REPO_NAME/branches/$BRANCH/protection \
        --input /tmp/branch-protection.json
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully protected branch: $BRANCH"
        rm -f /tmp/branch-protection.json
        return 0
    else
        echo "❌ Failed to protect branch: $BRANCH"
        rm -f /tmp/branch-protection.json
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

# Set up protection for main branch (1 required review)
echo ""
echo "🔒 Protecting main branch (1 required review)..."
setup_branch_protection "main" 1

# Set up protection for feature/production-implementation branch
echo ""
echo "🔒 Protecting feature/production-implementation branch (1 required review)..."
setup_branch_protection "feature/production-implementation" 1

# Display current protection status
echo ""
echo "📊 Current branch protection status:"
echo ""

for branch in main feature/production-implementation; do
    if git show-ref --verify --quiet refs/remotes/origin/$branch; then
        echo "Branch: $branch"
        
        # Check protection status
        if gh api repos/$REPO_OWNER/$REPO_NAME/branches/$branch/protection 2>/dev/null > /dev/null; then
            # Get details about the protection
            REVIEWS=$(gh api repos/$REPO_OWNER/$REPO_NAME/branches/$branch/protection 2>/dev/null | jq -r '.required_pull_request_reviews.required_approving_review_count // "none"')
            echo "✅ Protected (Required reviews: $REVIEWS)"
        else
            echo "❌ Not protected"
        fi
        echo ""
    fi
done

echo "✨ Branch protection setup complete!"
echo ""
echo "Note: You can modify protection settings at:"
echo "https://github.com/$REPO_OWNER/$REPO_NAME/settings/branches"