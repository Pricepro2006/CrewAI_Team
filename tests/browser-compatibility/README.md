# Browser Compatibility Test Suite

Comprehensive browser compatibility testing for the Walmart Grocery Agent and AI Agent Team Framework.

## Overview

This test suite validates functionality across major browsers:
- **Chrome** (Desktop & Mobile)
- **Firefox** (Desktop)
- **Safari** (Desktop & Mobile)
- **Edge** (Desktop)

## Test Categories

### 🛒 Walmart Grocery Agent Functionality
- Product search and pricing
- Location-based features
- Shopping cart operations
- Voice input (when available)
- Responsive design

### 🎤 Web Speech API Compatibility
- Speech Recognition availability
- Speech Synthesis functionality
- Microphone permission handling
- Fallback mechanisms

### 🌐 WebSocket Connection Testing
- Connection lifecycle management
- Error handling and reconnection
- Binary data support
- Protocol negotiation

### 🎨 CSS & Responsive Design
- Modern CSS feature support
- Responsive breakpoints
- Dark mode compatibility
- Animation performance

### 💾 Storage & Network APIs
- localStorage/sessionStorage
- IndexedDB functionality
- Fetch API compatibility
- CORS policy handling

### ⚡ Performance Benchmarks
- Page load metrics
- JavaScript execution speed
- Rendering performance
- Memory usage patterns

## Quick Start

### Prerequisites

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Install Playwright Browsers**
   ```bash
   npx playwright install
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

### Running Tests

#### Run All Browser Compatibility Tests
```bash
npm run test:browser-compat
```

#### Browser-Specific Testing
```bash
# Test specific browsers
npm run test:browser-compat:chrome
npm run test:browser-compat:firefox
npm run test:browser-compat:safari
npm run test:browser-compat:edge

# Run tests with visible browser
npm run test:browser-compat:headed

# Run tests sequentially (not parallel)
npm run test:browser-compat:sequential
```

#### Walmart-Specific Tests
```bash
npm run test:walmart-browsers
```

## Test Results

### Output Locations

- **HTML Report**: `browser-compatibility-report/index.html`
- **JSON Results**: `browser-compatibility-results.json`
- **Summary Report**: `browser-compatibility-results/COMPATIBILITY_REPORT.md`
- **Screenshots**: `browser-compatibility-results/{browser}/`

### Understanding Results

The test suite generates:

1. **Compatibility Score** (0-100) per browser
2. **Feature Support Matrix**
3. **Performance Benchmarks**
4. **Polyfill Recommendations**
5. **Visual Screenshots** for verification

## Test Structure

```
tests/browser-compatibility/
├── common/           # Cross-browser tests
│   ├── walmart-agent-functionality.spec.ts
│   ├── speech-api-compatibility.spec.ts
│   ├── websocket-compatibility.spec.ts
│   ├── css-responsive-design.spec.ts
│   ├── storage-and-network.spec.ts
│   └── performance-benchmarks.spec.ts
├── chrome/           # Chrome-specific tests
├── firefox/          # Firefox-specific tests
├── safari/           # Safari-specific tests
├── edge/             # Edge-specific tests
├── mobile/           # Mobile-specific tests
├── tablet/           # Tablet-specific tests
├── utils/            # Testing utilities
│   └── browser-detector.ts
├── global-setup.ts
├── global-teardown.ts
└── README.md
```

## Configuration

### Playwright Configuration

The test suite uses `playwright.config.ts` with:

- **Multiple Browser Projects**
- **Parallel Execution**
- **Retry Logic**
- **Screenshot/Video on Failure**
- **Trace Collection**

### Environment Variables

```bash
# Server URL for testing
TEST_BASE_URL=http://localhost:5173

# Browser-specific settings
BROWSER_NAME=chrome
```

## Browser-Specific Notes

### Chrome
- ✅ Full Web Speech API support
- ✅ Latest CSS features
- ✅ WebSocket binary data
- ✅ Performance APIs

### Firefox
- ⚠️ Limited Speech Recognition
- ✅ WebSocket support
- ✅ Modern CSS features
- ⚠️ Some performance APIs missing

### Safari
- ✅ WebKit Speech Recognition
- ⚠️ Some CSS features behind flags
- ✅ WebSocket support
- ⚠️ Limited performance APIs

### Edge
- ✅ Similar to Chrome (Chromium-based)
- ✅ Full API support
- ✅ Modern CSS features

## Common Issues & Solutions

### 1. Browser Not Found
```bash
# Install missing browsers
npx playwright install chromium firefox webkit
```

### 2. Tests Timeout
```bash
# Increase timeout
npm run test:browser-compat -- --timeout=60000
```

### 3. Headless Issues
```bash
# Run with visible browser for debugging
npm run test:browser-compat:headed
```

### 4. Network Errors
- Ensure development server is running on port 5173
- Check firewall settings for WebSocket tests
- Verify CORS configuration

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Browser Compatibility Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  browser-compatibility:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright
        run: npx playwright install --with-deps
      - name: Run browser compatibility tests
        run: npm run test:browser-compat
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: browser-compatibility-report
          path: browser-compatibility-report/
```

## Polyfill Recommendations

The test suite automatically detects missing features and suggests polyfills:

### Common Polyfills
- **fetch**: `@github/fetch`
- **Web Speech API**: `speech-recognition-polyfill`
- **Intersection Observer**: `intersection-observer`
- **CSS Custom Properties**: `css-vars-ponyfill`
- **WebSocket**: `sockjs-client` or `socket.io`

## Performance Baselines

### Target Metrics
- **Page Load**: < 3 seconds
- **First Contentful Paint**: < 2 seconds
- **JavaScript Execution**: Varies by operation
- **Memory Usage**: < 100MB increase per test

### Browser Performance Comparison

Tests automatically benchmark:
- Array/Object operations
- DOM manipulation
- CSS animation performance
- Network request speed
- Memory allocation patterns

## Extending Tests

### Adding New Test Cases

1. **Create Test File**
   ```typescript
   // tests/browser-compatibility/common/my-feature.spec.ts
   import { test, expect } from '@playwright/test';
   import { detectBrowserCapabilities } from '../utils/browser-detector';

   test.describe('My Feature Tests', () => {
     // Your tests here
   });
   ```

2. **Update Browser Detector**
   ```typescript
   // Add feature detection to utils/browser-detector.ts
   export const MY_FEATURE_REQUIRED = [
     'myApi',
     'myFeature'
   ];
   ```

3. **Run Tests**
   ```bash
   npm run test:browser-compat
   ```

## Troubleshooting

### Debug Mode
```bash
# Run with debug output
DEBUG=pw:api npm run test:browser-compat

# Run single test
npx playwright test tests/browser-compatibility/common/walmart-agent-functionality.spec.ts
```

### Manual Testing
```bash
# Open Playwright UI
npx playwright test --ui

# Run specific browser
npx playwright test --project=chrome-desktop
```

## Support

For issues or questions:

1. Check existing [GitHub Issues](../../issues)
2. Review test logs in `browser-compatibility-results/`
3. Run tests with `--headed` flag for visual debugging
4. Consult browser-specific documentation

---

**Last Updated**: January 2025  
**Playwright Version**: Latest  
**Supported Browsers**: Chrome 120+, Firefox 118+, Safari 16+, Edge 120+