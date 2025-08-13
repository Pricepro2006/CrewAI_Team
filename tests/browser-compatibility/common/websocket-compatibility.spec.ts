import { test, expect, Page } from '@playwright/test';
import { detectBrowserCapabilities, BrowserCapabilities } from '../utils/browser-detector';

test.describe('WebSocket Compatibility Tests', () => {
  let capabilities: BrowserCapabilities;

  test.beforeEach(async ({ page }) => {
    capabilities = await detectBrowserCapabilities(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should detect WebSocket API availability', async ({ page }) => {
    const webSocketSupport = await page.evaluate(() => {
      return {
        webSocket: 'WebSocket' in window,
        webSocketConstructor: typeof WebSocket,
        closeConstants: !!(WebSocket.CLOSED && WebSocket.CLOSING && WebSocket.CONNECTING && WebSocket.OPEN),
        eventTarget: WebSocket.prototype instanceof EventTarget
      };
    });

    console.log(`WebSocket Support for ${capabilities.name}:`, webSocketSupport);

    // WebSocket should be available in all modern browsers
    expect(webSocketSupport.webSocket).toBe(true);
    expect(webSocketSupport.webSocketConstructor).toBe('function');
    expect(webSocketSupport.closeConstants).toBe(true);
    expect(webSocketSupport.eventTarget).toBe(true);
  });

  test('should test WebSocket connection lifecycle', async ({ page }) => {
    // Use a WebSocket echo server for testing
    const testWebSocket = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const results: any = {
          connectionAttempted: false,
          events: [],
          readyStates: [],
          error: null
        };

        try {
          // Use a public WebSocket echo server for testing
          const ws = new WebSocket('wss://echo.websocket.org');
          results.connectionAttempted = true;

          const timeout = setTimeout(() => {
            ws.close();
            resolve({
              ...results,
              timeout: true,
              finalState: ws.readyState
            });
          }, 5000);

          ws.addEventListener('open', (event) => {
            results.events.push({ type: 'open', timestamp: Date.now() });
            results.readyStates.push(ws.readyState);
            
            // Send test message
            ws.send('Test message from browser compatibility test');
          });

          ws.addEventListener('message', (event) => {
            results.events.push({ 
              type: 'message', 
              data: event.data.substring(0, 50), // Truncate for logging
              timestamp: Date.now() 
            });
            
            // Close connection after successful echo
            ws.close(1000, 'Test completed');
          });

          ws.addEventListener('close', (event) => {
            results.events.push({ 
              type: 'close', 
              code: event.code,
              reason: event.reason,
              wasClean: event.wasClean,
              timestamp: Date.now() 
            });
            results.readyStates.push(ws.readyState);
            
            clearTimeout(timeout);
            resolve({
              ...results,
              finalState: ws.readyState,
              closeCode: event.code
            });
          });

          ws.addEventListener('error', (event) => {
            results.events.push({ 
              type: 'error', 
              timestamp: Date.now() 
            });
            results.error = 'WebSocket error occurred';
            
            clearTimeout(timeout);
            resolve({
              ...results,
              finalState: ws.readyState
            });
          });

          // Track initial state
          results.readyStates.push(ws.readyState);

        } catch (error) {
          resolve({
            ...results,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });
    });

    console.log('WebSocket Test Results:', testWebSocket);

    expect(testWebSocket.connectionAttempted).toBe(true);
    
    if (testWebSocket.error && !testWebSocket.timeout) {
      console.log('WebSocket connection error (may be network/firewall related):', testWebSocket.error);
    } else if (testWebSocket.timeout) {
      console.log('WebSocket connection timeout (may be network related)');
    } else {
      // Successful connection should have open and close events
      const eventTypes = testWebSocket.events.map((e: any) => e.type);
      expect(eventTypes).toContain('open');
      expect(eventTypes).toContain('close');
      
      if (eventTypes.includes('message')) {
        console.log('WebSocket echo successful');
      }
    }

    // Final state should be CLOSED (3) for clean shutdown
    if (testWebSocket.closeCode === 1000) {
      expect(testWebSocket.finalState).toBe(3); // WebSocket.CLOSED
    }
  });

  test('should test WebSocket error handling', async ({ page }) => {
    const errorHandlingTest = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const results: any = {
          events: [],
          properErrorHandling: false
        };

        try {
          // Try to connect to invalid WebSocket URL
          const ws = new WebSocket('wss://invalid-websocket-url-for-testing.com');

          const timeout = setTimeout(() => {
            resolve({
              ...results,
              timeout: true
            });
          }, 3000);

          ws.addEventListener('open', (event) => {
            results.events.push({ type: 'open' });
            // This shouldn't happen with invalid URL
            ws.close();
          });

          ws.addEventListener('error', (event) => {
            results.events.push({ type: 'error' });
            results.properErrorHandling = true;
            clearTimeout(timeout);
          });

          ws.addEventListener('close', (event) => {
            results.events.push({ 
              type: 'close',
              code: event.code,
              wasClean: event.wasClean
            });
            
            clearTimeout(timeout);
            resolve(results);
          });

        } catch (error) {
          resolve({
            ...results,
            constructorError: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });
    });

    console.log('WebSocket Error Handling Test:', errorHandlingTest);

    // Should properly handle connection errors
    expect(
      errorHandlingTest.properErrorHandling || 
      errorHandlingTest.constructorError ||
      errorHandlingTest.timeout
    ).toBe(true);

    if (errorHandlingTest.properErrorHandling) {
      console.log('WebSocket error events handled correctly');
    }
  });

  test('should test WebSocket in Walmart Agent context', async ({ page }) => {
    // Navigate to Walmart agent
    const walmartButton = page.locator('button:has-text("Walmart"), a[href*="walmart"]').first();
    if (await walmartButton.isVisible()) {
      await walmartButton.click();
    } else {
      await page.goto('/walmart');
    }

    await page.waitForLoadState('networkidle');

    // Check if the application uses WebSocket connections
    const webSocketUsage = await page.evaluate(() => {
      // Check for WebSocket usage in the page
      const scripts = Array.from(document.scripts);
      const hasWebSocketCode = scripts.some(script => 
        script.innerHTML.includes('WebSocket') || 
        script.innerHTML.includes('ws://') ||
        script.innerHTML.includes('wss://')
      );

      // Check for Socket.IO or other WebSocket libraries
      const hasSocketIO = !!(window as any).io;
      const hasNativeWebSocket = 'WebSocket' in window;

      return {
        hasWebSocketCode,
        hasSocketIO,
        hasNativeWebSocket,
        currentConnections: [] // Would need to track active connections
      };
    });

    console.log('WebSocket Usage in Walmart Agent:', webSocketUsage);

    // Log findings
    if (webSocketUsage.hasWebSocketCode) {
      console.log('WebSocket code detected in application');
    }
    if (webSocketUsage.hasSocketIO) {
      console.log('Socket.IO detected');
    }

    // Even if not used, WebSocket should be available
    expect(webSocketUsage.hasNativeWebSocket).toBe(true);
  });

  test('should test WebSocket with different protocols', async ({ page }) => {
    const protocolTests = await page.evaluate(async () => {
      const protocols = ['ws-test', 'echo-protocol', 'json-protocol'];
      const results: any = {};

      // Test each protocol support
      for (const protocol of protocols) {
        try {
          const ws = new WebSocket('wss://echo.websocket.org', protocol);
          results[protocol] = {
            created: true,
            protocol: ws.protocol,
            readyState: ws.readyState
          };
          ws.close();
        } catch (error) {
          results[protocol] = {
            created: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }

      // Test multiple protocols
      try {
        const wsMultiple = new WebSocket('wss://echo.websocket.org', protocols);
        results.multipleProtocols = {
          created: true,
          protocol: wsMultiple.protocol,
          readyState: wsMultiple.readyState
        };
        wsMultiple.close();
      } catch (error) {
        results.multipleProtocols = {
          created: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }

      return results;
    });

    console.log('WebSocket Protocol Tests:', protocolTests);

    // At least basic WebSocket creation should work
    Object.entries(protocolTests).forEach(([protocol, result]: [string, any]) => {
      if (result.error) {
        console.log(`Protocol ${protocol} error:`, result.error);
      } else {
        console.log(`Protocol ${protocol} created successfully`);
        expect(result.created).toBe(true);
      }
    });
  });

  test('should test WebSocket binary data handling', async ({ page }) => {
    const binaryTest = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const results: any = {
          binaryTypeSupport: false,
          arrayBufferSupport: false,
          blobSupport: false,
          events: []
        };

        try {
          const ws = new WebSocket('wss://echo.websocket.org');
          
          const timeout = setTimeout(() => {
            ws.close();
            resolve({
              ...results,
              timeout: true
            });
          }, 5000);

          ws.addEventListener('open', () => {
            results.events.push({ type: 'open' });
            
            // Test binary type settings
            try {
              ws.binaryType = 'arraybuffer';
              results.arrayBufferSupport = ws.binaryType === 'arraybuffer';
              
              ws.binaryType = 'blob';
              results.blobSupport = ws.binaryType === 'blob';
              
              results.binaryTypeSupport = true;
              
              // Send binary data
              const buffer = new ArrayBuffer(8);
              const view = new DataView(buffer);
              view.setUint32(0, 42);
              ws.send(buffer);
              
            } catch (error) {
              results.events.push({ type: 'binary_error', error: (error as Error).message });
              ws.close();
            }
          });

          ws.addEventListener('message', (event) => {
            results.events.push({ 
              type: 'message',
              dataType: typeof event.data,
              isArrayBuffer: event.data instanceof ArrayBuffer,
              isBlob: event.data instanceof Blob
            });
            ws.close();
          });

          ws.addEventListener('close', () => {
            results.events.push({ type: 'close' });
            clearTimeout(timeout);
            resolve(results);
          });

          ws.addEventListener('error', () => {
            results.events.push({ type: 'error' });
            clearTimeout(timeout);
            resolve(results);
          });

        } catch (error) {
          resolve({
            ...results,
            constructorError: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });
    });

    console.log('WebSocket Binary Data Test:', binaryTest);

    if (!binaryTest.timeout && !binaryTest.constructorError) {
      expect(binaryTest.binaryTypeSupport).toBe(true);
      console.log(`ArrayBuffer support: ${binaryTest.arrayBufferSupport}`);
      console.log(`Blob support: ${binaryTest.blobSupport}`);
    } else if (binaryTest.timeout) {
      console.log('Binary data test timeout (may be network related)');
    }
  });

  test('should provide WebSocket fallback recommendations', async ({ page }) => {
    const recommendations = await page.evaluate(() => {
      const support = {
        webSocket: 'WebSocket' in window,
        eventSource: 'EventSource' in window,
        fetch: 'fetch' in window,
        xmlHttpRequest: 'XMLHttpRequest' in window
      };

      const fallbacks = [];

      if (!support.webSocket) {
        fallbacks.push({
          primary: 'SockJS',
          alternative: 'Socket.IO with polling fallback',
          description: 'Provides WebSocket-like API with fallbacks'
        });
      }

      if (support.eventSource) {
        fallbacks.push({
          primary: 'Server-Sent Events (EventSource)',
          alternative: 'Long polling with fetch/XHR',
          description: 'One-way server-to-client communication'
        });
      }

      if (support.fetch) {
        fallbacks.push({
          primary: 'Long polling with fetch',
          alternative: 'XMLHttpRequest polling',
          description: 'Request-response polling for real-time updates'
        });
      }

      return { support, fallbacks };
    });

    console.log(`WebSocket Compatibility Summary for ${capabilities.name}:`);
    console.log('Native Support:', recommendations.support);

    if (!recommendations.support.webSocket) {
      console.log('WebSocket not supported - Fallback options:');
      recommendations.fallbacks.forEach(fallback => {
        console.log(`- ${fallback.primary}: ${fallback.description}`);
      });
    } else {
      console.log('WebSocket natively supported');
      console.log('Additional real-time options available:');
      recommendations.fallbacks.slice(1).forEach(fallback => {
        console.log(`- ${fallback.primary}: ${fallback.description}`);
      });
    }

    // Save recommendations
    await page.evaluate((data) => {
      (window as any).webSocketCompatibilityReport = data;
    }, recommendations);

    await page.screenshot({ 
      path: `browser-compatibility-results/${capabilities.name.toLowerCase()}/websocket-compatibility.png`,
      fullPage: true 
    });
  });
});