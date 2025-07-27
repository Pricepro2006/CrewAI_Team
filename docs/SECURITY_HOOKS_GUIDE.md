# Security Git Hooks Guide

This document describes the security-focused git hooks implemented in this project to prevent common security vulnerabilities and maintain code quality.

## Overview

Our pre-commit hooks provide multiple layers of security validation:

1. **Secret Detection** - Prevents hardcoded secrets and API keys
2. **Security Patterns** - Catches common security vulnerabilities
3. **File Size Limits** - Prevents large or binary files
4. **Code Quality** - Enforces linting and formatting
5. **Commit Message Format** - Ensures consistent commit history
6. **Type Safety** - Validates TypeScript types
7. **Test Validation** - Runs related tests before commit

## Pre-Commit Hooks

### 1. Secret Detection (`scripts/check-secrets.js`)

Scans all staged files for potential secrets:

- **API Keys**: Generic API key patterns, AWS keys, GitHub tokens
- **Passwords**: Hardcoded passwords in code
- **Private Keys**: SSH keys, SSL certificates, PGP keys
- **Database URLs**: MongoDB, PostgreSQL, MySQL connection strings
- **OAuth Secrets**: Client secrets, refresh tokens
- **High Entropy Strings**: Potential secrets based on entropy analysis

**Example patterns detected:**
```javascript
// ❌ These will be blocked:
const apiKey = "sk_live_abcd1234...";  // Hardcoded API key
const password = "mySecretPassword123"; // Hardcoded password
const dbUrl = "mongodb://user:pass@host:27017/db"; // DB credentials

// ✅ These are allowed:
const apiKey = process.env.API_KEY;    // Environment variable
const dbUrl = process.env.DATABASE_URL; // Environment variable
```

### 2. Security Checks (`scripts/security-checks.js`)

Detects common security issues and code quality problems:

- **Console Statements**: `console.log`, `console.error`, etc.
- **Debugger Statements**: Left-over debugging code
- **TODO/FIXME Comments**: Unfinished work indicators
- **Dangerous Functions**: `eval()`, `document.write()`
- **XSS Risks**: `innerHTML` usage, script tags in code
- **Hardcoded Fallbacks**: Environment variables with hardcoded defaults

**Severity Levels:**
- 🚨 **Error**: Blocks commit (eval, debugger, hardcoded credentials)
- ⚠️ **Warning**: Allows commit but shows warning (console.log, innerHTML)
- ℹ️ **Info**: Informational only (TODO comments)

### 3. File Size Validation (`scripts/check-file-size.js`)

Prevents large files and enforces size limits:

- **Maximum file size**: 5MB (configurable)
- **Warning threshold**: 1MB
- **Code file limits**: 
  - JavaScript/TypeScript: 100KB
  - CSS: 50KB
  - Markdown: 50KB
- **Binary file detection**: Images, PDFs, executables
- **Suspicious file detection**: `.env` files, logs, temp files

### 4. Lint-Staged Integration

Automatically runs on staged files:

```json
{
  "*.{ts,tsx,js,jsx}": [
    "eslint --fix",
    "prettier --write",
    "bash -c 'node scripts/security-checks.js'"
  ],
  "*": [
    "bash -c 'node scripts/check-secrets.js'",
    "bash -c 'node scripts/check-file-size.js'"
  ]
}
```

### 5. Additional Validations

The pre-commit hook also:
- Blocks sensitive file extensions (`.env`, `.pem`, `.key`, `.cert`)
- Warns about `package-lock.json` changes without `package.json`
- Runs tests for changed files (`npm run test:related`)
- Validates TypeScript types (`npx tsc --noEmit`)

## Commit Message Validation

### Format: `type(scope): subject`

**Valid types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Formatting, no code change
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test additions/changes
- `build`: Build system changes
- `ci`: CI configuration changes
- `chore`: Other changes
- `revert`: Reverting commits
- `security`: Security improvements/fixes

**Rules:**
- Subject must start with lowercase
- No period at the end
- Maximum 100 characters for first line
- Use imperative mood ("add" not "added")

**Examples:**
```bash
✅ Good:
feat(auth): add user login functionality
fix(api): resolve memory leak in data processing
security(deps): update vulnerable dependencies

❌ Bad:
Added new feature.          # Wrong tense, has period
FIX: bug in system         # Wrong format
very long commit message... # Too long
```

## Bypassing Hooks (Emergency Only)

If you need to bypass hooks in an emergency:

```bash
# Skip all pre-commit hooks
git commit --no-verify

# Skip specific checks by commenting in .lintstagedrc.json
```

⚠️ **Warning**: Only bypass hooks when absolutely necessary and you're certain the code is safe.

## Cross-Platform Compatibility

The hooks are designed to work on:
- ✅ macOS
- ✅ Linux (including WSL)
- ✅ Windows (with Git Bash)

## Setup Instructions

1. **Install dependencies** (already done if you ran `npm install`):
   ```bash
   npm install
   ```

2. **Initialize Husky** (already done):
   ```bash
   npx husky init
   ```

3. **Optional: Install git-secrets for enhanced protection**:
   ```bash
   ./scripts/install-git-secrets.sh
   ```

## Troubleshooting

### Hook not running
```bash
# Ensure hooks are executable
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg
chmod +x scripts/check-*.js
```

### False positives in secret detection
Add patterns to allowed list in `scripts/check-secrets.js`:
```javascript
const allowedPatterns = [
  /your-pattern-here/i
];
```

### TypeScript errors blocking commit
```bash
# Fix TypeScript errors
npm run typecheck

# Or temporarily skip (not recommended)
git commit --no-verify
```

## Best Practices

1. **Never commit secrets** - Use environment variables
2. **Remove console.logs** - Use proper logging
3. **Fix TODOs** - Or create issues to track them
4. **Keep files small** - Split large files
5. **Write clear commits** - Follow the format
6. **Run hooks locally** - Don't rely on CI alone
7. **Update patterns** - Add new security patterns as needed

## Continuous Improvement

The security hooks are continuously updated. To contribute:

1. Add new patterns to detection scripts
2. Adjust thresholds based on project needs
3. Add new security checks as threats evolve
4. Share false positives to improve accuracy

## Additional Security Tools

Consider integrating:
- **Snyk**: Vulnerability scanning
- **SonarQube**: Code quality and security
- **OWASP Dependency Check**: Dependency vulnerabilities
- **Semgrep**: Custom security rules
- **Gitleaks**: Advanced secret scanning

---

Remember: Security is everyone's responsibility. These hooks are a safety net, not a replacement for secure coding practices.