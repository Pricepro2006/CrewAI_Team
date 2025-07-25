# GitHub Actions Security Permissions Guide

## Overview

This document explains the GitHub Actions permissions required for various security-related operations in our CI/CD pipeline, particularly for uploading security scan results.

## The "Resource not accessible by integration" Error

This error commonly occurs when a GitHub Actions workflow attempts to perform operations that require elevated permissions, such as:

- Uploading CodeQL/SARIF results to the Security tab
- Writing security alerts
- Modifying pull request checks

## Solution: Adding Permissions Block

To fix this error, add a `permissions` block at the workflow level (not inside a job):

```yaml
name: Your Workflow

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read # Read repository contents
  security-events: write # Upload security scan results
  pull-requests: write # Comment on PRs
  issues: write # Create/modify issues

jobs:
  # Your jobs here...
```

## Permission Scopes Explained

### `contents: read`

- Required for: Checking out code, reading files
- Default for: Most workflows

### `security-events: write`

- Required for: Uploading SARIF files, CodeQL results
- Used by: `github/codeql-action/upload-sarif`
- Critical for: Security scanning tools (Trivy, Snyk, CodeQL)

### `pull-requests: write`

- Required for: Adding comments to PRs, updating PR status
- Used by: PR review bots, security result comments

### `issues: write`

- Required for: Creating issues, adding labels
- Used by: Automated issue creation from security scans

## Important Considerations

### 1. Fork Limitations

GitHub restricts write permissions for workflows triggered by pull requests from forks for security reasons. Options:

- Run security scans only on `push` events to protected branches
- Use pull request targets with careful security review
- Manually approve workflow runs for first-time contributors

### 2. Least Privilege Principle

Only grant the minimum permissions required:

```yaml
permissions:
  contents: read
  security-events: write # Only what's needed
```

### 3. Job-Level Permissions

You can override permissions at the job level for finer control:

```yaml
jobs:
  security-scan:
    permissions:
      contents: read
      security-events: write
    steps:
      # Security scanning steps
```

## Common Security Tools and Required Permissions

| Tool          | Action                              | Required Permissions                      |
| ------------- | ----------------------------------- | ----------------------------------------- |
| Trivy (SARIF) | `github/codeql-action/upload-sarif` | `security-events: write`                  |
| CodeQL        | `github/codeql-action/analyze`      | `security-events: write`                  |
| Snyk          | `snyk/actions/*`                    | `contents: read` (unless uploading SARIF) |
| OWASP ZAP     | SARIF upload                        | `security-events: write`                  |

## Troubleshooting

### Error: "Resource not accessible by integration"

1. Check if the workflow has the required permissions
2. Verify the action version supports the operation
3. Ensure the repository has GitHub Advanced Security enabled (for private repos)

### Error: "Workflow not authorized"

1. Check repository settings for workflow permissions
2. Verify the default permissions haven't been restricted
3. For organizations, check org-level workflow policies

## Best Practices

1. **Always use versioned actions**: `uses: github/codeql-action/upload-sarif@v3`
2. **Review permissions regularly**: Audit workflows for excessive permissions
3. **Use environment protection rules**: For sensitive deployments
4. **Enable security alerts**: In repository settings
5. **Document permission requirements**: In workflow comments

## Example: Complete Security Workflow

```yaml
name: Security Scan

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

permissions:
  contents: read
  security-events: write

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Trivy scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: "fs"
          format: "sarif"
          output: "trivy-results.sarif"

      - name: Upload results
        uses: github/codeql-action/upload-sarif@v3
        if: always() # Upload even if scan finds issues
        with:
          sarif_file: "trivy-results.sarif"
```

## References

- [GitHub Actions Permissions Documentation](https://docs.github.com/en/actions/using-jobs/assigning-permissions-to-jobs)
- [GITHUB_TOKEN Permissions](https://docs.github.com/en/actions/security-guides/automatic-token-authentication)
- [Security Hardening for GitHub Actions](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
