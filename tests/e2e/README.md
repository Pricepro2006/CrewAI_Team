# Walmart Grocery Agent - Comprehensive E2E Testing Suite

This comprehensive End-to-End testing suite covers all major user workflows and interactions for the Walmart Grocery Agent UI. The tests are built using Playwright and provide thorough coverage of functionality, performance, accessibility, and visual consistency.

## 🎯 Test Coverage Overview

### Core Features Tested

1. **Product Search & Discovery**
   - Natural language search queries
   - Category filtering
   - Search result validation
   - Empty and error state handling

2. **Grocery List Management**
   - Adding/removing items from search results
   - Running totals calculation
   - Data persistence across sessions
   - Cross-component synchronization

3. **Live Pricing Features**
   - Real-time price updates from Walmart.com
   - Location-based pricing (ZIP code changes)
   - Price monitoring setup
   - Service health indicators

4. **Budget Tracking**
   - Real-time budget calculations
   - Category-wise spending tracking
   - Budget alerts and warnings
   - Progress visualization

5. **Price History & Trends**
   - Historical price data display
   - Price change notifications
   - Active price alert management
   - Trend visualization

6. **Real-time Updates (WebSocket)**
   - WebSocket connection management
   - Live price update notifications
   - Stock availability changes
   - Budget threshold alerts

7. **Visual Regression Testing**
   - Component screenshot comparison
   - Mobile and tablet responsiveness
   - State-based visual validation
   - Cross-browser consistency

8. **Accessibility & Performance**
   - Keyboard navigation support
   - ARIA labels and screen reader compatibility
   - Loading state management
   - Error recovery mechanisms

## 🏗️ Test Architecture

### Test Files Structure

```
tests/e2e/
├── walmart-grocery-agent.spec.ts    # Main UI functionality tests
├── websocket-realtime.spec.ts       # Real-time updates and WebSocket tests
├── integration-workflows.spec.ts    # Cross-component integration tests
├── visual-regression.spec.ts        # Visual consistency and UI tests
├── utils/
│   └── test-helpers.ts              # Reusable test utilities and helpers
├── fixtures/
│   └── mock-data.ts                 # Test data and mock scenarios
├── global-setup.ts                  # Global test setup and initialization
├── global-teardown.ts               # Global cleanup and teardown
├── run-all-tests.sh                 # Comprehensive test runner script
└── README.md                        # This documentation file
```

### Test Utilities

- **WalmartTestHelpers**: Core utilities for navigating and interacting with the Walmart agent
- **GroceryListHelpers**: Specialized helpers for grocery list operations
- **Mock Data**: Comprehensive test data including products, prices, and user scenarios

## 🚀 Running the Tests

### Prerequisites

1. **Node.js** (v18 or higher)
2. **npm** or **pnpm** package manager
3. **Playwright** browsers installed
4. **Running application** (both frontend and backend services)

### Quick Start

```bash
# Install dependencies (if not already installed)
npm install

# Install Playwright browsers
npx playwright install

# Run all E2E tests
./tests/e2e/run-all-tests.sh
```

### Advanced Usage

#### Run Specific Test Suites

```bash
# Run main functionality tests only
npx playwright test tests/e2e/walmart-grocery-agent.spec.ts

# Run WebSocket/real-time tests only
npx playwright test tests/e2e/websocket-realtime.spec.ts

# Run integration workflow tests
npx playwright test tests/e2e/integration-workflows.spec.ts

# Run visual regression tests
npx playwright test tests/e2e/visual-regression.spec.ts
```

#### Browser-Specific Testing

```bash
# Test in Chrome
./tests/e2e/run-all-tests.sh --browser chromium

# Test in Firefox
./tests/e2e/run-all-tests.sh --browser firefox

# Test in Safari (WebKit)
./tests/e2e/run-all-tests.sh --browser webkit
```

#### Debug Mode

```bash
# Run with browser visible (headed mode)
./tests/e2e/run-all-tests.sh --headed

# Run with specific number of workers
./tests/e2e/run-all-tests.sh --workers 1
```

#### Environment Variables

```bash
# Run in headed mode
HEADLESS=false ./tests/e2e/run-all-tests.sh

# Use different browser
BROWSER=firefox ./tests/e2e/run-all-tests.sh

# Set parallel workers
PARALLEL_WORKERS=4 ./tests/e2e/run-all-tests.sh
```

## 📊 Test Reports and Analysis

### Report Types

1. **HTML Report**: Interactive Playwright report with screenshots and traces
2. **JSON Report**: Machine-readable test results for CI/CD integration
3. **Comprehensive Report**: Custom markdown report with detailed analysis
4. **Screenshots**: Visual documentation of test execution and failures

### Accessing Reports

After running tests, reports are available in:

```
test-results/e2e-[TIMESTAMP]/
├── playwright-report/          # Interactive HTML report
├── test-results/              # Screenshots and trace files
├── comprehensive-test-report.md # Custom detailed report
└── *.json                     # JSON result files
```

**Open the HTML report:**
```bash
npx playwright show-report
```

## 🎭 Mock Data and Scenarios

### Product Test Data

The test suite includes comprehensive mock data for:

- **Product Categories**: Produce, Dairy, Meat & Seafood, Bakery, etc.
- **Price Scenarios**: Regular prices, sale items, out-of-stock items
- **Search Scenarios**: Various query types and result sets
- **User Preferences**: Different user types and shopping patterns

### Mock API Responses

All external API calls are mocked to ensure:
- **Consistent test data** across runs
- **Predictable response times** for reliable testing
- **Error scenario testing** with controlled failures
- **Offline capability testing**

### WebSocket Simulation

Real-time features are tested using simulated WebSocket messages:
- Price update notifications
- Stock availability changes
- Budget threshold alerts
- Connection management events

## ♿ Accessibility Testing

### Automated Accessibility Checks

- **ARIA labels and roles** validation
- **Keyboard navigation** testing
- **Focus management** verification
- **Screen reader compatibility** checks

### Manual Accessibility Features

- **High contrast mode** support
- **Reduced motion** preferences
- **Font size** adjustments
- **Color blindness** considerations

## 📱 Responsive Design Testing

### Device Coverage

- **Desktop**: 1920x1080, 1366x768
- **Tablet**: 768x1024 (iPad)
- **Mobile**: 375x667 (iPhone), 360x640 (Android)

### Responsive Features Tested

- **Navigation adaptation** for smaller screens
- **Touch-friendly interactions** on mobile
- **Content reflow** and readability
- **Performance optimization** for mobile networks

## 🔄 Continuous Integration

### CI/CD Integration

The test suite is designed for easy integration with CI/CD pipelines:

```yaml
# Example GitHub Actions integration
- name: Run E2E Tests
  run: |
    npm ci
    npx playwright install --with-deps
    ./tests/e2e/run-all-tests.sh --browser chromium
  env:
    HEADLESS: true
    PARALLEL_WORKERS: 2
```

### Test Artifacts

CI environments should collect:
- **HTML reports** for debugging failures
- **Screenshots** of failed tests
- **Video recordings** of test execution
- **Performance metrics** and timing data

## 🛠️ Troubleshooting

### Common Issues

1. **Services Not Running**
   ```bash
   # Start backend
   npm run dev:server
   
   # Start frontend
   npm run dev:client
   ```

2. **Port Conflicts**
   - Ensure ports 3000 (backend) and 5173 (frontend) are available
   - Check for other running services

3. **Browser Installation**
   ```bash
   # Install all Playwright browsers
   npx playwright install
   
   # Install system dependencies (Linux)
   npx playwright install-deps
   ```

4. **Test Data Issues**
   - Tests use mocked data by default
   - Clear browser storage between test runs
   - Verify mock API responses are working

### Debug Mode

For detailed debugging:

```bash
# Run single test with debug
npx playwright test tests/e2e/walmart-grocery-agent.spec.ts --debug

# Generate trace files
npx playwright test --trace on

# Show trace viewer
npx playwright show-trace trace.zip
```

## 🔮 Future Enhancements

### Planned Improvements

1. **Performance Testing**
   - Load testing with large datasets
   - Memory usage monitoring
   - Network throttling simulation

2. **API Testing Integration**
   - Contract testing with real APIs
   - Response time validation
   - Error handling verification

3. **Advanced Visual Testing**
   - Component-level screenshot comparison
   - Animation testing
   - Color contrast validation

4. **Security Testing**
   - XSS prevention validation
   - Input sanitization testing
   - Authentication flow testing

## 📞 Support

For questions or issues with the test suite:

1. **Check the HTML report** for detailed error information
2. **Review screenshots** of failed test steps
3. **Check service logs** for backend/frontend issues
4. **Verify test environment** prerequisites are met

---

**Test Suite Version**: 1.0.0  
**Last Updated**: 2025-01-06  
**Compatible with**: Walmart Grocery Agent v1.x  
**Playwright Version**: ^1.41.0