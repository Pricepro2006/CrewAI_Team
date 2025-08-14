# Walmart Grocery Agent - Comprehensive Test Suite

This directory contains a comprehensive test suite for the Walmart Grocery Agent, organized by commit phases for the multi-commit strategy. The test suite covers backend APIs, frontend components, integration scenarios, and end-to-end user workflows.

## Test Structure Overview

```
tests/
├── unit/                          # Phase 1 & 2: Unit Tests
│   ├── api/                       # Backend API unit tests
│   │   ├── nlp-query-processing.test.ts
│   │   ├── product-search-api.test.ts
│   │   ├── grocery-list-management.test.ts
│   │   ├── pricing-api-with-caching.test.ts
│   │   └── websocket-events.test.ts
│   └── components/                # Frontend component unit tests
│       ├── nlp-search-input.test.tsx
│       ├── search-interface-virtualization.test.tsx
│       └── service-health-dashboard.test.tsx
├── integration/                   # Phase 3: Integration Tests
│   ├── walmart-nlp-integration.test.ts
│   └── pricing-cache-integration.test.ts
├── e2e/                          # Phase 4 & 5: End-to-End Tests
│   ├── walmart-grocery-complete-workflow.spec.ts
│   ├── walmart-performance-stress.spec.ts
│   └── websocket-realtime-events.spec.ts
└── README.md                     # This file
```

## Multi-Commit Strategy

### Phase 1: Backend API Unit Tests
**Commit Message**: `test: add comprehensive backend API unit tests for Walmart Grocery Agent`

Tests backend API endpoints with proper mocking and error handling:
- **NLP Query Processing**: Tests intent detection, entity extraction, confidence scoring
- **Product Search API**: Tests filtering, sorting, pagination, virtualization optimization
- **Grocery List Management**: Tests CRUD operations, sharing, collaboration features
- **Pricing API with Caching**: Tests real-time pricing, cache invalidation, performance
- **WebSocket Events**: Tests connection management, event broadcasting, room management

**Coverage**: Backend services, API routes, business logic, error handling

### Phase 2: Frontend Component Unit Tests
**Commit Message**: `test: add frontend component unit tests with React Testing Library`

Tests React components with user interaction simulation:
- **NLP Search Input**: Tests voice input, search suggestions, NLP integration
- **Search Interface**: Tests virtualization, filtering, responsive design
- **Service Health Dashboard**: Tests monitoring display, alerts, real-time updates

**Coverage**: React components, hooks, user interactions, accessibility

### Phase 3: Integration Tests
**Commit Message**: `test: add integration tests for API-component interactions`

Tests interaction between backend and frontend systems:
- **Walmart NLP Integration**: Tests end-to-end NLP processing flow
- **Pricing Cache Integration**: Tests real-time pricing with caching layers

**Coverage**: API-frontend integration, data flow, state synchronization

### Phase 4: E2E User Workflow Tests
**Commit Message**: `test: add comprehensive E2E tests for complete user workflows`

Tests complete user journeys with Playwright:
- **Complete Workflow**: Tests full shopping experience from search to cart
- **Performance & Stress**: Tests system performance under load

**Coverage**: User workflows, performance, cross-browser compatibility

### Phase 5: WebSocket Real-time Tests
**Commit Message**: `test: add specialized WebSocket and real-time update tests`

Tests real-time functionality and WebSocket communication:
- **Real-time Events**: Tests WebSocket connectivity, event synchronization

**Coverage**: Real-time updates, WebSocket reliability, event handling

## Test Categories

### 🔧 Unit Tests (Jest + React Testing Library)
- **Backend API Tests**: Mock external dependencies, test business logic
- **Frontend Component Tests**: Test component behavior, user interactions
- **Service Tests**: Test individual service classes and utilities

### 🔄 Integration Tests (Vitest)
- **API Integration**: Test API endpoints with real database connections
- **Component Integration**: Test component interactions with real API calls
- **Service Integration**: Test service interactions and data flow

### 🌐 End-to-End Tests (Playwright)
- **User Workflows**: Test complete user journeys across the application
- **Cross-browser Testing**: Test compatibility across Chrome, Firefox, Safari
- **Performance Testing**: Test load times, responsiveness, memory usage
- **Accessibility Testing**: Test keyboard navigation, screen reader support

### ⚡ Real-time Tests (Playwright + WebSocket)
- **WebSocket Connectivity**: Test connection establishment and recovery
- **Live Updates**: Test real-time price updates, cart synchronization
- **Event Broadcasting**: Test multi-user collaboration scenarios

## Running Tests

### Prerequisites
```bash
# Install dependencies
npm install

# Ensure test databases are available
npm run test:setup
```

### Individual Test Phases

#### Phase 1: Backend API Unit Tests
```bash
# Run all backend API tests
npm run test:api

# Run specific API test files
npm test tests/unit/api/nlp-query-processing.test.ts
npm test tests/unit/api/product-search-api.test.ts
npm test tests/unit/api/grocery-list-management.test.ts
npm test tests/unit/api/pricing-api-with-caching.test.ts
npm test tests/unit/api/websocket-events.test.ts
```

#### Phase 2: Frontend Component Unit Tests
```bash
# Run all component tests
npm run test:ui

# Run specific component test files
npm test tests/unit/components/nlp-search-input.test.tsx
npm test tests/unit/components/search-interface-virtualization.test.tsx
npm test tests/unit/components/service-health-dashboard.test.tsx
```

#### Phase 3: Integration Tests
```bash
# Run all integration tests
npm run test:integration

# Run specific integration test files
npm test tests/integration/walmart-nlp-integration.test.ts
npm test tests/integration/pricing-cache-integration.test.ts
```

#### Phase 4: E2E Workflow Tests
```bash
# Run all E2E tests
npm run test:e2e

# Run specific E2E test files
npx playwright test tests/e2e/walmart-grocery-complete-workflow.spec.ts
npx playwright test tests/e2e/walmart-performance-stress.spec.ts

# Run with different browsers
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

#### Phase 5: WebSocket Real-time Tests
```bash
# Run WebSocket-specific tests
npx playwright test tests/e2e/websocket-realtime-events.spec.ts

# Run with headed browser for debugging
npx playwright test tests/e2e/websocket-realtime-events.spec.ts --headed
```

### Complete Test Suite
```bash
# Run all tests in sequence (recommended for CI)
npm run test:all

# Run with coverage reporting
npm run test:coverage

# Run in CI mode with optimized settings
npm run test:ci
```

## Test Configuration

### Environment Variables
```bash
# Test environment configuration
NODE_ENV=test
TEST_BASE_URL=http://localhost:5178
WEBSOCKET_URL=ws://localhost:8080
DATABASE_URL=:memory:
REDIS_HOST=localhost
REDIS_PORT=6379

# Performance thresholds
PERFORMANCE_TIMEOUT=5000
LOAD_TIMEOUT=3000
```

### Test Databases
- **SQLite In-Memory**: Used for unit and integration tests
- **Redis Test DB**: Database 15 reserved for testing
- **Separate Test Schemas**: Isolated from production data

### Mock Services
- **WebSocket Mock**: Simulates real-time events for consistent testing
- **External API Mocks**: Mocks Walmart pricing APIs and external services
- **Authentication Mock**: Provides test user sessions and permissions

## Performance Thresholds

### Load Time Targets
- **Page Load**: < 3 seconds
- **NLP Processing**: < 5 seconds
- **Search Response**: < 2 seconds
- **Cart Updates**: < 1 second
- **Price Refresh**: < 2 seconds

### Performance Metrics
- **First Contentful Paint**: < 1.5 seconds
- **Largest Contentful Paint**: < 2.5 seconds
- **Cumulative Layout Shift**: < 0.1
- **First Input Delay**: < 100ms

### Memory Limits
- **JavaScript Heap**: < 100MB for normal operation
- **Memory Growth**: < 2x initial after extended use
- **WebSocket Connections**: < 1000 concurrent connections

## Test Data Management

### Test Fixtures
- **Mock Product Data**: Realistic product information for testing
- **Sample Orders**: Representative shopping cart and order data
- **User Scenarios**: Various user types and permission levels

### Data Factories
- **Product Factory**: Generates test products with realistic attributes
- **Order Factory**: Creates test orders with proper relationships
- **User Factory**: Provides test users with different roles

### Cleanup Strategies
- **Automatic Cleanup**: Tests clean up after themselves
- **Database Reset**: Fresh state for each test run
- **Cache Clearing**: Redis cache cleared between test suites

## Debugging and Troubleshooting

### Test Debugging
```bash
# Run tests in debug mode
npm test -- --inspect-brk

# Run specific test with verbose output
npm test tests/unit/api/nlp-query-processing.test.ts -- --verbose

# Generate test reports
npm run test:report
```

### E2E Debugging
```bash
# Run E2E tests in headed mode
npx playwright test --headed

# Run with debug mode
npx playwright test --debug

# Generate trace files
npx playwright test --trace on

# Open test report
npx playwright show-report
```

### Common Issues

#### Test Timeouts
- Increase timeout values in test configuration
- Check for hanging promises or incomplete async operations
- Verify mock services are responding correctly

#### WebSocket Connection Issues
- Ensure WebSocket server is running on correct port
- Check firewall settings for test environment
- Verify WebSocket mock implementation is correct

#### Memory Leaks in Tests
- Ensure proper cleanup in `afterEach` hooks
- Check for unclosed database connections
- Monitor test runner memory usage

## Coverage Targets

### Minimum Coverage Requirements
- **Unit Tests**: 80% line coverage
- **Integration Tests**: 70% pathway coverage
- **E2E Tests**: 100% critical user journey coverage

### Coverage Reports
```bash
# Generate coverage report
npm run test:coverage

# View coverage report in browser
npm run coverage:open

# Check coverage thresholds
npm run coverage:check
```

### Critical Path Coverage
- ✅ NLP query processing
- ✅ Product search and filtering
- ✅ Cart management operations
- ✅ Real-time price updates
- ✅ WebSocket connectivity
- ✅ Error handling and recovery

## CI/CD Integration

### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Comprehensive Test Suite
on: [push, pull_request]
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - name: Run Unit Tests (Phase 1 & 2)
        run: npm run test:ci
  
  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - name: Run Integration Tests (Phase 3)
        run: npm run test:integration
  
  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    steps:
      - name: Run E2E Tests (Phase 4 & 5)
        run: npm run test:e2e:ci
```

### Test Parallelization
- **Unit Tests**: Run in parallel by test file
- **Integration Tests**: Sequential execution for database consistency
- **E2E Tests**: Parallel execution with isolated browser contexts

### Performance Monitoring
- **Test Execution Time**: Monitored and optimized
- **Resource Usage**: Memory and CPU tracking during tests
- **Flaky Test Detection**: Automated detection and reporting

## Contributing to Tests

### Adding New Tests
1. Follow the established patterns in existing test files
2. Use appropriate test category (unit/integration/e2e)
3. Include both positive and negative test cases
4. Add proper documentation and comments

### Test Naming Conventions
- **Descriptive Names**: `should handle NLP processing with high confidence`
- **Behavior-Driven**: Focus on what the system should do
- **Clear Expectations**: Make test intent obvious from the name

### Best Practices
- **Test Isolation**: Each test should be independent
- **Realistic Data**: Use realistic test data and scenarios
- **Error Testing**: Include error conditions and edge cases
- **Performance Awareness**: Consider test execution time

## Maintenance and Updates

### Regular Maintenance Tasks
- Update test data to reflect current product catalog
- Review and update performance thresholds
- Maintain mock services to match real API changes
- Update browser versions for E2E tests

### Monitoring Test Health
- Track test execution times and failure rates
- Monitor coverage trends over time
- Identify and fix flaky tests promptly
- Review test effectiveness and add missing scenarios

This comprehensive test suite ensures the Walmart Grocery Agent maintains high quality, performance, and reliability across all features and user interactions.