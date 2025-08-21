# CrewAI Team - Test Documentation

## ⚠️ IMPORTANT: Test Locations and Structure

This document serves as the single source of truth for all testing infrastructure to prevent duplicate efforts.

---

## 📁 Test Directory Structure

```
CrewAI_Team/
├── tests/e2e/                    # ✅ MAIN E2E TEST DIRECTORY
│   ├── walmart-grocery-agent.spec.ts
│   ├── walmart-grocery-complete-workflow.spec.ts
│   ├── walmart-performance-stress.spec.ts
│   ├── run-all-tests.sh          # Main E2E test runner script
│   └── fixtures/                  # Test data and fixtures
│
├── src/
│   ├── **/__tests__/              # Unit tests (co-located with source)
│   ├── database/repositories/__tests__/
│   │   ├── GroceryRepository.test.ts
│   │   └── WalmartProductRepository.test.ts
│   └── utils/__tests__/
│       └── jwt.test.ts
│
├── test-integration.js            # Integration test suite
├── vitest.config.ts              # Unit test configuration
├── vitest.integration.config.ts  # Integration test configuration
└── vitest.ui.config.ts          # UI test configuration
```

---

## 🧪 Test Types and Commands

### 1. Unit Tests
- **Location**: `src/**/__tests__/` (co-located with source files)
- **Framework**: Vitest
- **Run Command**: `npm run test:unit`
- **Coverage**: Repository patterns, utilities, services
- **Status**: Some tests need fixing (mocking issues)

### 2. Integration Tests
- **Location**: `test-integration.js`
- **Framework**: Node.js with fetch
- **Run Command**: `node test-integration.js`
- **Coverage**: API endpoints, database operations, service integration
- **Status**: 70% passing rate

### 3. E2E Tests (Playwright)
- **Location**: `tests/e2e/` ⚠️ PRIMARY E2E LOCATION
- **Framework**: Playwright
- **Run Commands**:
  ```bash
  # Run all E2E tests
  cd tests/e2e && ./run-all-tests.sh
  
  # Run specific test suite
  npm run test:e2e -- tests/e2e/walmart-grocery-agent.spec.ts
  
  # Run with UI
  npm run test:e2e:headed
  
  # Run Walmart tests only
  npm run test:e2e:walmart
  ```
- **Coverage**: 
  - Walmart grocery workflow
  - Performance testing
  - Stress testing
  - Complete user journeys

---

## 🔧 Test Infrastructure

### CI/CD Integration
- **GitHub Actions**: `.github/workflows/`
  - `ci.yml` - Main CI pipeline with test execution
  - `pr-tests.yml` - PR automated testing
  - `deploy.yml` - Deployment with test gates

### Test Databases
- **Unit Tests**: In-memory mocked databases
- **Integration Tests**: `test_main.db`, `test_walmart.db`
- **E2E Tests**: Full application with real databases

### Test Services Required
```bash
# For full E2E testing, ensure these are running:
npm run dev           # Frontend (port 3000)
npm run dev:server    # API (port 3001)
chroma run           # ChromaDB (port 8000)
redis-server         # Redis (port 6379)
```

---

## ⚠️ Common Pitfalls to Avoid

1. **DO NOT create new E2E test directories** - Use `tests/e2e/`
2. **DO NOT recreate Playwright configs** - Existing tests work
3. **Check this document first** before creating new test infrastructure
4. **Unit tests are co-located** - Don't create separate unit test directories

---

## 📊 Current Test Coverage Status

| Test Type | Location | Status | Pass Rate | Notes |
|-----------|----------|--------|-----------|-------|
| Unit Tests | `src/**/__tests__/` | ⚠️ Needs Fix | ~0% | Mocking issues need resolution |
| Integration | `test-integration.js` | ✅ Working | 70% | 7/10 tests passing |
| E2E Tests | `tests/e2e/` | ✅ Exists | TBD | Comprehensive Walmart tests |
| CI/CD | `.github/workflows/` | ✅ Complete | N/A | Full pipeline configured |

---

## 🚀 Quick Test Commands Reference

```bash
# Unit tests
npm run test:unit                    # Run all unit tests
npm run test:unit -- path/to/test   # Run specific test

# Integration tests  
node test-integration.js             # Run integration suite

# E2E tests
cd tests/e2e && ./run-all-tests.sh  # Run all E2E tests
npm run test:e2e                    # Run via npm script
npm run test:e2e:headed              # Run with browser UI
npm run test:e2e:walmart             # Run Walmart tests only

# All tests
npm test                             # Run all test suites
```

---

## 📝 Notes for Future Development

1. **Existing E2E Tests** (August 2025): Comprehensive Walmart grocery tests already exist in `tests/e2e/`
2. **Test Runner Script**: `tests/e2e/run-all-tests.sh` handles full E2E execution
3. **Playwright Config**: Tests use existing Playwright setup, no new config needed
4. **Mock Strategy**: Unit tests need proper mocking aligned with actual implementation

---

## Last Updated: August 20, 2025

**Remember**: Always check existing tests before creating new ones!