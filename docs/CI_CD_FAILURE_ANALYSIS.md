# CI/CD Pipeline Failure Analysis - PR #8

## Executive Summary

All CI/CD jobs are failing at the "Install dependencies" step with exit code 1. The root cause is the `better-sqlite3` package requiring Python distutils for node-gyp compilation, which is not available in the default GitHub Actions Ubuntu runners.

## Root Cause Analysis

### The Problem

1. **Package:** `better-sqlite3` v9.3.0 requires compilation via node-gyp
2. **Missing Dependency:** Python distutils module is not installed on GitHub Actions Ubuntu runners
3. **Error:** `ModuleNotFoundError: No module named 'distutils'`
4. **Impact:** All jobs fail immediately during `npm ci`, preventing any code testing or validation

### Why This Happens

- `better-sqlite3` contains native C++ code that must be compiled for each platform
- `node-gyp` is the build tool used for this compilation
- `node-gyp` requires Python with the distutils module
- GitHub Actions Ubuntu runners have Python but not distutils by default

## Solution Options (Ranked by Implementation Speed)

### Option 1: Quick Fix - Add Python Setup Step (RECOMMENDED)

**Time to implement:** 5 minutes  
**Risk:** Low  
**Permanence:** High

Update `.github/workflows/migration-pipeline.yml` to install Python distutils before npm install:

```yaml
- name: Setup Python for node-gyp
  run: |
    sudo apt-get update
    sudo apt-get install -y python3-distutils python3-dev build-essential

- name: Install dependencies
  run: npm ci
```

### Option 2: Use Prebuilt Binaries

**Time to implement:** 10 minutes  
**Risk:** Medium  
**Permanence:** Medium

Force npm to use prebuilt binaries instead of compiling:

```yaml
- name: Install dependencies
  run: npm ci --prefer-offline --no-audit --no-fund
  env:
    npm_config_build_from_source: false
```

### Option 3: Switch to Pure JavaScript SQLite

**Time to implement:** 2-4 hours  
**Risk:** High (requires code changes)  
**Permanence:** High

Replace `better-sqlite3` with `sql.js` or another pure JavaScript implementation.

### Option 4: Use Docker Container with Dependencies

**Time to implement:** 1 hour  
**Risk:** Medium  
**Permanence:** High

Use a custom Docker image with all dependencies pre-installed:

```yaml
jobs:
  lint-and-type-check:
    name: Lint and Type Check
    runs-on: ubuntu-latest
    container:
      image: node:18-bullseye
      options: --user root
```

### Option 5: Cache node_modules with Prebuilt Binaries

**Time to implement:** 30 minutes  
**Risk:** Low  
**Permanence:** Medium

Build once and cache the compiled binaries:

```yaml
- name: Cache node_modules
  uses: actions/cache@v3
  with:
    path: |
      node_modules
      ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}-with-sqlite
    restore-keys: |
      ${{ runner.os }}-node-
```

## Immediate Action Plan

1. **Apply Quick Fix (Option 1)**
   - Edit `.github/workflows/migration-pipeline.yml`
   - Add Python setup step before npm install in all jobs
   - Commit and push to trigger new CI/CD run

2. **Verify Fix**
   - Monitor the new CI/CD run
   - Ensure all jobs pass the dependency installation step
   - Check that subsequent steps complete successfully

3. **Long-term Consideration**
   - Evaluate if `better-sqlite3` is the best choice for the project
   - Consider using PostgreSQL or MySQL in production for better scalability
   - Document the Python dependency requirement for new developers

## Implementation Guide

### Step-by-Step Fix

1. Open `.github/workflows/migration-pipeline.yml`
2. Add the following before EVERY `npm ci` command in ALL jobs:

```yaml
- name: Setup build dependencies
  run: |
    sudo apt-get update
    sudo apt-get install -y python3-distutils python3-dev build-essential
```

3. The updated structure for each job should look like:

```yaml
steps:
  - name: Checkout code
    uses: actions/checkout@v4

  - name: Setup Node.js
    uses: actions/setup-node@v4
    with:
      node-version: ${{ env.NODE_VERSION }}
      cache: "npm"

  - name: Setup build dependencies
    run: |
      sudo apt-get update
      sudo apt-get install -y python3-distutils python3-dev build-essential

  - name: Install dependencies
    run: npm ci
```

## Alternative Workarounds

If the main solution doesn't work:

1. **Skip SQLite in CI/CD** (temporary):

   ```json
   "optionalDependencies": {
     "better-sqlite3": "^9.3.0"
   }
   ```

2. **Use npm install instead of npm ci**:

   ```yaml
   - name: Install dependencies
     run: npm install --no-save
   ```

3. **Pin to older version** that might have prebuilt binaries:
   ```json
   "better-sqlite3": "8.7.0"
   ```

## Prevention Measures

1. **Documentation**: Add to README.md:

   ```markdown
   ## System Requirements

   - Node.js 18+
   - Python 3.x with distutils (`apt-get install python3-distutils`)
   - Build tools (`apt-get install build-essential`)
   ```

2. **Docker Development**: Create a Dockerfile for consistent environments

3. **Pre-commit Hook**: Warn about native dependencies

## Monitoring

After applying the fix:

- ✅ All jobs should pass "Install dependencies"
- ✅ TypeScript compilation should succeed
- ✅ Tests should run (may have other issues to address)
- ✅ Security audit should complete

## Notes

- This issue affects ALL jobs because they all run `npm ci`
- The socket.io dependencies might cause similar issues but are currently optional
- Consider using a matrix build to test multiple Node.js versions
- The `--no-verify` push bypassed local hooks but doesn't affect CI/CD

## References

- [better-sqlite3 Installation Guide](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/troubleshooting.md)
- [node-gyp Prerequisites](https://github.com/nodejs/node-gyp#installation)
- [GitHub Actions Ubuntu Runner Specs](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2204-Readme.md)
