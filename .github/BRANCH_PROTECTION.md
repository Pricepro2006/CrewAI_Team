# Branch Protection Rules

## Main Branch Protection

Configure the following protection rules for the `main` branch:

### Required Status Checks

Enable "Require status checks to pass before merging" with these checks:

- ✅ lint
- ✅ typecheck
- ✅ test
- ✅ build
- ✅ security

### Pull Request Requirements

- ✅ Require pull request reviews before merging
  - Required approving reviews: 1
  - Dismiss stale pull request approvals when new commits are pushed
  - Require review from CODEOWNERS
- ✅ Require conversation resolution before merging

### Additional Settings

- ✅ Include administrators
- ✅ Restrict who can push to matching branches
  - Add repository admins and CI/CD service accounts
- ✅ Require linear history
- ✅ Require deployments to succeed before merging
  - Environment: production

## Develop Branch Protection

Configure lighter protection for the `develop` branch:

### Required Status Checks

- ✅ lint
- ✅ typecheck
- ✅ test

### Pull Request Requirements

- ✅ Require pull request reviews before merging
  - Required approving reviews: 1

## Workflow Permissions

In Settings → Actions → General:

- Workflow permissions: Read and write permissions
- Allow GitHub Actions to create and approve pull requests

## Required Secrets

Add these secrets in Settings → Secrets and variables → Actions:

- `SNYK_TOKEN` - For security scanning
- `SLACK_WEBHOOK` - For deployment notifications
- `CODECOV_TOKEN` - For coverage reporting (optional)

## CODEOWNERS File

Create `.github/CODEOWNERS`:

```
# Global owners
* @your-github-username

# Frontend
/src/ui/ @frontend-team
/src/components/ @frontend-team

# Backend
/src/api/ @backend-team
/src/core/ @backend-team

# Email Pipeline
/src/core/pipeline/ @pipeline-team
/src/scripts/migration/ @pipeline-team
```
