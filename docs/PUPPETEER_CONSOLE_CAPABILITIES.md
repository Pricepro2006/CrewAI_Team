# Puppeteer Console Capabilities

## Console Data Capture

Puppeteer can capture all types of console output from web pages:

### 1. Console Messages
```javascript
page.on('console', msg => {
  console.log('PAGE LOG:', msg.type(), msg.text());
  // Capture: log, warn, error, info, debug
});
```

### 2. JavaScript Errors
```javascript
page.on('pageerror', error => {
  console.log('PAGE ERROR:', error.message);
});
```

### 3. Network Console Logs
```javascript
page.on('response', response => {
  console.log('RESPONSE:', response.url(), response.status());
});
```

## Our MCP Integration

We have `mcp__puppeteer__puppeteer_evaluate` which can:
- Execute JavaScript in browser context
- Return console output data
- Capture runtime errors

## Example Usage
```javascript
// Capture console logs during page interaction
const logs = [];
page.on('console', msg => logs.push(msg.text()));

// Execute code and capture results
await puppeteer_evaluate({
  script: "console.log('test'); return document.title;"
});
```

This complements our Chrome DevTools MCP setup for comprehensive debugging.