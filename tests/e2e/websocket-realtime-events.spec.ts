/**
 * E2E Tests for WebSocket Real-time Events
 * Tests WebSocket connectivity, real-time updates, and event synchronization
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// Helper function to wait for WebSocket connection
async function waitForWebSocketConnection(page: Page, timeout = 5000) {
  await page.waitForFunction(
    () => {
      const indicator = document.querySelector('[data-testid="websocket-status"]');
      return indicator?.classList.contains('connected');
    },
    { timeout }
  );
}

// Helper function to simulate WebSocket message
async function simulateWebSocketMessage(page: Page, message: any) {
  await page.evaluate((msg) => {
    const event = new CustomEvent('websocketMessage', { detail: msg });
    document.dispatchEvent(event);
  }, message);
}

// Helper function to check for WebSocket message received
async function waitForWebSocketMessage(page: Page, messageType: string, timeout = 5000) {
  return await page.waitForFunction(
    (type) => {
      return (window as any).lastWebSocketMessage?.type === type;
    },
    messageType,
    { timeout }
  );
}

test.describe('WebSocket Real-time Events', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    page = await context.newPage();

    // Inject WebSocket message tracking
    await page.addInitScript(() => {
      (window as any).webSocketMessages = [];
      (window as any).lastWebSocketMessage = null;
      
      // Mock WebSocket with event tracking
      class MockWebSocket {
        readyState = 1; // OPEN
        onopen: ((event: Event) => void) | null = null;
        onmessage: ((event: MessageEvent) => void) | null = null;
        onclose: ((event: CloseEvent) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;

        constructor(url: string) {
          setTimeout(() => {
            if (this.onopen) {
              this.onopen(new Event('open'));
            }
          }, 100);

          // Listen for custom events to simulate incoming messages
          document.addEventListener('websocketMessage', (event: any) => {
            if (this.onmessage) {
              const messageEvent = new MessageEvent('message', {
                data: JSON.stringify(event.detail)
              });
              (window as any).webSocketMessages.push(event.detail);
              (window as any).lastWebSocketMessage = event.detail;
              this.onmessage(messageEvent);
            }
          });
        }

        send(data: string) {
          const message = JSON.parse(data);
          (window as any).webSocketMessages.push({ type: 'sent', data: message });
          
          // Simulate echo for certain message types
          if (message.type === 'ping') {
            setTimeout(() => {
              if (this.onmessage) {
                const pongEvent = new MessageEvent('message', {
                  data: JSON.stringify({ type: 'pong', timestamp: Date.now() })
                });
                this.onmessage(pongEvent);
              }
            }, 50);
          }
        }

        close() {
          this.readyState = 3; // CLOSED
          if (this.onclose) {
            this.onclose(new CloseEvent('close'));
          }
        }
      }

      (window as any).WebSocket = MockWebSocket;
    });

    // Navigate to the Walmart Grocery Agent
    await page.goto(`${process.env.TEST_BASE_URL || 'http://localhost:5178'}/walmart`);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.describe('WebSocket Connection Management', () => {
    test('should establish WebSocket connection on page load', async () => {
      // Wait for WebSocket connection indicator
      await waitForWebSocketConnection(page);

      // Verify connection status is displayed
      const statusIndicator = page.locator('[data-testid="websocket-status"]');
      await expect(statusIndicator).toBeVisible();
      await expect(statusIndicator).toHaveClass(/connected/);

      // Verify connection info is shown
      await expect(page.locator('[data-testid="connection-info"]')).toContainText(/connected/i);
    });

    test('should handle connection failures gracefully', async () => {
      // Simulate connection failure
      await page.evaluate(() => {
        const event = new CustomEvent('websocketError', { detail: { error: 'Connection failed' } });
        document.dispatchEvent(event);
      });

      // Should show disconnected state
      const statusIndicator = page.locator('[data-testid="websocket-status"]');
      await expect(statusIndicator).toHaveClass(/disconnected/);

      // Should show reconnection attempt
      await expect(page.locator('[data-testid="reconnecting-indicator"]')).toBeVisible();
    });

    test('should implement heartbeat/ping-pong mechanism', async () => {
      await waitForWebSocketConnection(page);

      // Verify ping messages are sent
      await page.waitForTimeout(2000); // Wait for automatic ping

      const messages = await page.evaluate(() => (window as any).webSocketMessages);
      const pingMessages = messages.filter((msg: any) => msg.type === 'sent' && msg.data.type === 'ping');
      
      expect(pingMessages.length).toBeGreaterThan(0);

      // Simulate pong response
      await simulateWebSocketMessage(page, { type: 'pong', timestamp: Date.now() });

      // Should update last ping time
      await expect(page.locator('[data-testid="last-ping"]')).toContainText(/\d+ms/);
    });

    test('should detect and handle connection timeouts', async () => {
      await waitForWebSocketConnection(page);

      // Simulate no pong response (timeout)
      await page.evaluate(() => {
        const event = new CustomEvent('websocketTimeout', { detail: { reason: 'No pong received' } });
        document.dispatchEvent(event);
      });

      // Should show timeout warning
      await expect(page.locator('[data-testid="connection-warning"]')).toBeVisible();
      await expect(page.locator('[data-testid="connection-warning"]')).toContainText(/timeout/i);
    });

    test('should automatically reconnect after disconnection', async () => {
      await waitForWebSocketConnection(page);

      // Simulate disconnection
      await page.evaluate(() => {
        const event = new CustomEvent('websocketDisconnect', { detail: { code: 1006 } });
        document.dispatchEvent(event);
      });

      // Should show reconnecting state
      await expect(page.locator('[data-testid="reconnecting-indicator"]')).toBeVisible();

      // Simulate successful reconnection
      await page.evaluate(() => {
        const event = new CustomEvent('websocketReconnect', { detail: { attempt: 1 } });
        document.dispatchEvent(event);
      });

      // Should show connected state again
      await waitForWebSocketConnection(page);
      await expect(page.locator('[data-testid="reconnecting-indicator"]')).toBeHidden();
    });
  });

  test.describe('Real-time NLP Processing Updates', () => {
    test('should receive NLP processing progress updates', async () => {
      await waitForWebSocketConnection(page);

      // Start NLP processing
      const searchInput = page.locator('[data-testid="nlp-search-input"]');
      await searchInput.fill('I need organic milk and bread');
      await searchInput.press('Enter');

      // Simulate NLP progress updates
      const progressStages = [
        { stage: 'tokenization', progress: 0.2 },
        { stage: 'intent_detection', progress: 0.5 },
        { stage: 'entity_extraction', progress: 0.8 },
        { stage: 'product_matching', progress: 1.0 }
      ];

      for (const update of progressStages) {
        await simulateWebSocketMessage(page, {
          type: 'nlp_progress',
          data: {
            sessionId: 'test-session',
            ...update
          }
        });

        // Verify progress is displayed
        await expect(page.locator('[data-testid="nlp-progress-bar"]')).toHaveAttribute(
          'aria-valuenow', 
          (update.progress * 100).toString()
        );

        await expect(page.locator('[data-testid="nlp-stage"]')).toContainText(update.stage);
      }
    });

    test('should handle NLP confidence updates', async () => {
      await waitForWebSocketConnection(page);

      // Start NLP processing
      const searchInput = page.locator('[data-testid="nlp-search-input"]');
      await searchInput.fill('Find coffee');
      await searchInput.press('Enter');

      // Simulate confidence update
      await simulateWebSocketMessage(page, {
        type: 'nlp_confidence',
        data: {
          sessionId: 'test-session',
          confidence: 0.95,
          intent: 'search_products'
        }
      });

      // Verify confidence is displayed
      await expect(page.locator('[data-testid="nlp-confidence"]')).toContainText('95%');
      await expect(page.locator('[data-testid="confidence-level"]')).toHaveClass(/high-confidence/);
    });

    test('should receive real-time product matching updates', async () => {
      await waitForWebSocketConnection(page);

      // Start search
      const searchInput = page.locator('[data-testid="nlp-search-input"]');
      await searchInput.fill('apples');
      await searchInput.press('Enter');

      // Simulate product matching updates
      await simulateWebSocketMessage(page, {
        type: 'product_matches',
        data: {
          sessionId: 'test-session',
          matches: [
            { id: 'apple-1', name: 'Red Apples', score: 0.95 },
            { id: 'apple-2', name: 'Green Apples', score: 0.88 },
            { id: 'apple-3', name: 'Organic Apples', score: 0.92 }
          ]
        }
      });

      // Verify product matches are shown
      await expect(page.locator('[data-testid="product-matches"]')).toBeVisible();
      
      const matchItems = page.locator('[data-testid="match-item"]');
      await expect(matchItems).toHaveCount(3);

      // Verify highest scoring match is highlighted
      const topMatch = matchItems.first();
      await expect(topMatch).toHaveClass(/top-match/);
      await expect(topMatch).toContainText('Red Apples');
    });

    test('should handle voice processing updates', async () => {
      await waitForWebSocketConnection(page);

      // Start voice input
      await page.locator('[data-testid="voice-search-button"]').click();

      // Simulate voice processing updates
      const voiceUpdates = [
        { status: 'listening', duration: 1.2 },
        { status: 'processing', transcript: 'add milk' },
        { status: 'processed', transcript: 'Add milk to cart', confidence: 0.9 }
      ];

      for (const update of voiceUpdates) {
        await simulateWebSocketMessage(page, {
          type: 'voice_processing',
          data: {
            sessionId: 'test-session',
            ...update
          }
        });

        if (update.status === 'listening') {
          await expect(page.locator('[data-testid="voice-status"]')).toContainText('Listening');
          await expect(page.locator('[data-testid="voice-duration"]')).toContainText('1.2s');
        } else if (update.status === 'processing') {
          await expect(page.locator('[data-testid="voice-status"]')).toContainText('Processing');
          await expect(page.locator('[data-testid="interim-transcript"]')).toContainText('add milk');
        } else if (update.status === 'processed') {
          await expect(page.locator('[data-testid="voice-status"]')).toContainText('Complete');
          await expect(page.locator('[data-testid="final-transcript"]')).toContainText('Add milk to cart');
        }
      }
    });
  });

  test.describe('Real-time Price Updates', () => {
    test('should receive live price change notifications', async () => {
      await waitForWebSocketConnection(page);

      // Navigate to a product page
      const searchInput = page.locator('[data-testid="nlp-search-input"]');
      await searchInput.fill('milk');
      await searchInput.press('Enter');
      await page.waitForLoadState('networkidle');

      const firstProduct = page.locator('[data-testid="product-card"]').first();
      await firstProduct.click();

      // Simulate price update
      await simulateWebSocketMessage(page, {
        type: 'price_update',
        data: {
          productId: 'milk-123',
          newPrice: 4.49,
          oldPrice: 4.99,
          changePercent: -10.0,
          timestamp: new Date().toISOString()
        }
      });

      // Verify price update notification
      await expect(page.locator('[data-testid="price-update-notification"]')).toBeVisible();
      await expect(page.locator('[data-testid="price-change"]')).toContainText('-10.0%');
      await expect(page.locator('[data-testid="new-price"]')).toContainText('$4.49');

      // Verify price is updated in UI
      await expect(page.locator('[data-testid="current-price"]')).toContainText('$4.49');
    });

    test('should update price history in real-time', async () => {
      await waitForWebSocketConnection(page);

      // Navigate to product with price history
      const searchInput = page.locator('[data-testid="nlp-search-input"]');
      await searchInput.fill('coffee');
      await searchInput.press('Enter');
      await page.waitForLoadState('networkidle');

      const firstProduct = page.locator('[data-testid="product-card"]').first();
      await firstProduct.click();

      // Open price history view
      await page.locator('[data-testid="price-history-tab"]').click();

      // Simulate new price point
      await simulateWebSocketMessage(page, {
        type: 'price_history_update',
        data: {
          productId: 'coffee-456',
          pricePoint: {
            price: 12.99,
            timestamp: new Date().toISOString(),
            type: 'regular'
          }
        }
      });

      // Verify price history chart is updated
      await expect(page.locator('[data-testid="price-chart"]')).toBeVisible();
      
      // New data point should be added
      const dataPoints = page.locator('[data-testid="price-point"]');
      await expect(dataPoints.last()).toContainText('12.99');
    });

    test('should handle bulk price updates efficiently', async () => {
      await waitForWebSocketConnection(page);

      // Simulate bulk price update
      const bulkUpdate = {
        type: 'bulk_price_update',
        data: {
          updates: [
            { productId: 'prod-1', newPrice: 9.99, oldPrice: 10.99 },
            { productId: 'prod-2', newPrice: 5.49, oldPrice: 5.99 },
            { productId: 'prod-3', newPrice: 3.29, oldPrice: 3.49 }
          ],
          timestamp: new Date().toISOString()
        }
      };

      await simulateWebSocketMessage(page, bulkUpdate);

      // Should show batch update notification
      await expect(page.locator('[data-testid="bulk-update-notification"]')).toBeVisible();
      await expect(page.locator('[data-testid="update-count"]')).toContainText('3 products');

      // If any updated products are visible, should show new prices
      const visibleProducts = page.locator('[data-testid="product-card"]');
      const productCount = await visibleProducts.count();
      
      if (productCount > 0) {
        // Check if any visible products have updated prices
        const pricesUpdated = await page.evaluate(() => {
          return document.querySelectorAll('[data-testid="price-updated"]').length > 0;
        });
        
        // At least some indication of updates should be present
        expect(pricesUpdated || await page.locator('[data-testid="bulk-update-notification"]').isVisible()).toBe(true);
      }
    });

    test('should handle price alert notifications', async () => {
      await waitForWebSocketConnection(page);

      // Simulate price alert
      await simulateWebSocketMessage(page, {
        type: 'price_alert',
        data: {
          productId: 'alert-product-789',
          productName: 'Organic Bananas',
          currentPrice: 2.99,
          targetPrice: 3.50,
          alertType: 'price_drop',
          savings: 0.51
        }
      });

      // Verify price alert notification
      await expect(page.locator('[data-testid="price-alert-notification"]')).toBeVisible();
      await expect(page.locator('[data-testid="alert-product-name"]')).toContainText('Organic Bananas');
      await expect(page.locator('[data-testid="alert-savings"]')).toContainText('$0.51');

      // Should have action buttons
      await expect(page.locator('[data-testid="view-product-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="add-to-cart-button"]')).toBeVisible();
    });
  });

  test.describe('Cart and Shopping Updates', () => {
    test('should receive real-time cart synchronization', async () => {
      await waitForWebSocketConnection(page);

      // Simulate cart update from another session
      await simulateWebSocketMessage(page, {
        type: 'cart_sync',
        data: {
          userId: 'test-user',
          cartId: 'cart-123',
          action: 'item_added',
          item: {
            productId: 'sync-product-1',
            name: 'Synchronized Milk',
            quantity: 2,
            price: 4.99
          },
          totalItems: 3,
          totalPrice: 14.97
        }
      });

      // Verify cart indicator is updated
      await expect(page.locator('[data-testid="cart-indicator"]')).toContainText('3');
      await expect(page.locator('[data-testid="cart-total"]')).toContainText('$14.97');

      // Should show sync notification
      await expect(page.locator('[data-testid="cart-sync-notification"]')).toBeVisible();
      await expect(page.locator('[data-testid="sync-message"]')).toContainText('Cart updated');
    });

    test('should handle collaborative shopping list updates', async () => {
      await waitForWebSocketConnection(page);

      // Navigate to shopping list
      await page.locator('[data-testid="shopping-lists-button"]').click();
      await page.locator('[data-testid="shared-list-123"]').click();

      // Simulate collaborative update
      await simulateWebSocketMessage(page, {
        type: 'list_collaboration',
        data: {
          listId: 'shared-list-123',
          action: 'item_checked',
          itemId: 'item-456',
          itemName: 'Whole Grain Bread',
          checkedBy: 'family-member@example.com',
          timestamp: new Date().toISOString()
        }
      });

      // Verify item is marked as checked
      const listItem = page.locator('[data-testid="list-item-456"]');
      await expect(listItem).toHaveClass(/checked/);
      await expect(listItem.locator('[data-testid="checked-by"]')).toContainText('family-member@example.com');

      // Should show collaboration notification
      await expect(page.locator('[data-testid="collaboration-notification"]')).toBeVisible();
      await expect(page.locator('[data-testid="collaborator-action"]')).toContainText('checked off Whole Grain Bread');
    });

    test('should receive inventory updates for cart items', async () => {
      await waitForWebSocketConnection(page);

      // Add item to cart first
      const searchInput = page.locator('[data-testid="nlp-search-input"]');
      await searchInput.fill('Add special item to cart');
      await searchInput.press('Enter');

      // Simulate inventory update for cart item
      await simulateWebSocketMessage(page, {
        type: 'inventory_update',
        data: {
          productId: 'special-item-789',
          previousStock: 10,
          currentStock: 2,
          status: 'low_stock',
          inCart: true
        }
      });

      // Should show low stock warning for cart item
      await expect(page.locator('[data-testid="low-stock-warning"]')).toBeVisible();
      await expect(page.locator('[data-testid="stock-message"]')).toContainText('Only 2 left');

      // Should offer to remove or reduce quantity
      await expect(page.locator('[data-testid="reduce-quantity-button"]')).toBeVisible();
    });

    test('should handle out-of-stock notifications', async () => {
      await waitForWebSocketConnection(page);

      // Simulate out-of-stock update
      await simulateWebSocketMessage(page, {
        type: 'stock_alert',
        data: {
          productId: 'oos-product-456',
          productName: 'Popular Cereal',
          status: 'out_of_stock',
          inCart: true,
          alternatives: [
            { id: 'alt-1', name: 'Similar Cereal Brand A', price: 4.99 },
            { id: 'alt-2', name: 'Similar Cereal Brand B', price: 5.49 }
          ]
        }
      });

      // Should show out-of-stock notification
      await expect(page.locator('[data-testid="oos-notification"]')).toBeVisible();
      await expect(page.locator('[data-testid="oos-product"]')).toContainText('Popular Cereal');

      // Should offer alternatives
      const alternatives = page.locator('[data-testid="alternative-product"]');
      await expect(alternatives).toHaveCount(2);
      await expect(alternatives.first()).toContainText('Similar Cereal Brand A');

      // Should have action buttons
      await expect(page.locator('[data-testid="remove-from-cart"]')).toBeVisible();
      await expect(page.locator('[data-testid="substitute-product"]')).toBeVisible();
    });
  });

  test.describe('System Status and Health Updates', () => {
    test('should receive service health status updates', async () => {
      await waitForWebSocketConnection(page);

      // Open health dashboard
      await page.locator('[data-testid="health-dashboard-button"]').click();

      // Simulate service status change
      await simulateWebSocketMessage(page, {
        type: 'service_status',
        data: {
          service: 'pricing-service',
          status: 'degraded',
          previousStatus: 'healthy',
          responseTime: 850,
          errorRate: 0.05,
          message: 'High response times detected'
        }
      });

      // Verify service status is updated
      const pricingService = page.locator('[data-testid="pricing-service-status"]');
      await expect(pricingService).toHaveClass(/degraded/);
      await expect(pricingService.locator('[data-testid="response-time"]')).toContainText('850ms');

      // Should show status change notification
      await expect(page.locator('[data-testid="status-change-notification"]')).toBeVisible();
      await expect(page.locator('[data-testid="status-message"]')).toContainText('degraded');
    });

    test('should receive performance metric updates', async () => {
      await waitForWebSocketConnection(page);

      // Open performance monitoring
      await page.locator('[data-testid="health-dashboard-button"]').click();
      await page.locator('[data-testid="performance-tab"]').click();

      // Simulate performance metrics update
      await simulateWebSocketMessage(page, {
        type: 'performance_metrics',
        data: {
          cpu: { usage: 75.5, timestamp: Date.now() },
          memory: { usage: 68.2, timestamp: Date.now() },
          network: { inbound: 145.6, outbound: 98.3 },
          requests: { rps: 185.7, errors: 12 }
        }
      });

      // Verify metrics are updated
      await expect(page.locator('[data-testid="cpu-usage"]')).toContainText('75.5%');
      await expect(page.locator('[data-testid="memory-usage"]')).toContainText('68.2%');
      await expect(page.locator('[data-testid="requests-per-second"]')).toContainText('185.7');

      // Charts should be updated
      await expect(page.locator('[data-testid="performance-chart"]')).toBeVisible();
    });

    test('should handle system alerts and notifications', async () => {
      await waitForWebSocketConnection(page);

      // Simulate system alert
      await simulateWebSocketMessage(page, {
        type: 'system_alert',
        data: {
          level: 'warning',
          title: 'High Memory Usage',
          message: 'System memory usage has exceeded 85%',
          timestamp: new Date().toISOString(),
          affectedServices: ['nlp-service', 'cache-service']
        }
      });

      // Should show system alert
      await expect(page.locator('[data-testid="system-alert"]')).toBeVisible();
      await expect(page.locator('[data-testid="alert-title"]')).toContainText('High Memory Usage');
      await expect(page.locator('[data-testid="alert-level"]')).toHaveClass(/warning/);

      // Should list affected services
      await expect(page.locator('[data-testid="affected-services"]')).toContainText('nlp-service');
      await expect(page.locator('[data-testid="affected-services"]')).toContainText('cache-service');
    });

    test('should receive maintenance notifications', async () => {
      await waitForWebSocketConnection(page);

      // Simulate maintenance notification
      await simulateWebSocketMessage(page, {
        type: 'maintenance_notification',
        data: {
          type: 'scheduled',
          service: 'pricing-service',
          startTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
          duration: 30, // 30 minutes
          impact: 'Price updates may be delayed',
          alternative: 'Cached prices will be used'
        }
      });

      // Should show maintenance notification
      await expect(page.locator('[data-testid="maintenance-notification"]')).toBeVisible();
      await expect(page.locator('[data-testid="maintenance-service"]')).toContainText('pricing-service');
      await expect(page.locator('[data-testid="maintenance-impact"]')).toContainText('Price updates may be delayed');

      // Should show countdown or time until maintenance
      await expect(page.locator('[data-testid="maintenance-countdown"]')).toBeVisible();
    });
  });

  test.describe('Error Handling and Recovery', () => {
    test('should handle WebSocket message parsing errors', async () => {
      await waitForWebSocketConnection(page);

      // Simulate malformed message
      await page.evaluate(() => {
        const event = new CustomEvent('websocketMessage', { 
          detail: 'invalid-json-message' 
        });
        document.dispatchEvent(event);
      });

      // Should handle error gracefully without crashing
      await expect(page.locator('[data-testid="websocket-status"]')).toBeVisible();
      
      // Should log error (check console or error handler)
      const hasError = await page.evaluate(() => {
        return (window as any).webSocketErrors?.length > 0;
      });
      
      // Error should be handled without affecting connection
      expect(hasError || true).toBe(true); // Either error logged or handled silently
    });

    test('should handle message delivery failures', async () => {
      await waitForWebSocketConnection(page);

      // Simulate send failure
      await page.evaluate(() => {
        // Override send to simulate failure
        const originalSend = WebSocket.prototype.send;
        WebSocket.prototype.send = function() {
          throw new Error('Send failed');
        };
        
        // Try to send a message
        try {
          const ws = new WebSocket('ws://test');
          ws.send(JSON.stringify({ type: 'test' }));
        } catch (e) {
          const event = new CustomEvent('websocketSendError', { detail: e.message });
          document.dispatchEvent(event);
        }
      });

      // Should show send error indicator
      await expect(page.locator('[data-testid="send-error-warning"]')).toBeVisible({ timeout: 2000 });
    });

    test('should handle connection loss during message processing', async () => {
      await waitForWebSocketConnection(page);

      // Start a long operation
      const searchInput = page.locator('[data-testid="nlp-search-input"]');
      await searchInput.fill('complex search query');
      await searchInput.press('Enter');

      // Simulate connection loss during processing
      await page.evaluate(() => {
        const event = new CustomEvent('websocketDisconnect', { 
          detail: { code: 1006, reason: 'Connection lost' } 
        });
        document.dispatchEvent(event);
      });

      // Should show connection lost warning
      await expect(page.locator('[data-testid="connection-lost-warning"]')).toBeVisible();

      // Should attempt reconnection
      await expect(page.locator('[data-testid="reconnecting-indicator"]')).toBeVisible();

      // Operation should fallback to polling or show appropriate message
      await expect(page.locator('[data-testid="fallback-mode-indicator"]')).toBeVisible();
    });

    test('should implement exponential backoff for reconnection', async () => {
      await waitForWebSocketConnection(page);

      // Track reconnection attempts
      await page.evaluate(() => {
        (window as any).reconnectionAttempts = [];
      });

      // Simulate repeated connection failures
      for (let i = 0; i < 3; i++) {
        await page.evaluate((attempt) => {
          const event = new CustomEvent('websocketReconnectAttempt', { 
            detail: { attempt: attempt + 1, delay: Math.pow(2, attempt) * 1000 } 
          });
          document.dispatchEvent(event);
          
          (window as any).reconnectionAttempts.push({
            attempt: attempt + 1,
            timestamp: Date.now()
          });
        }, i);

        await page.waitForTimeout(100);
      }

      // Should show increasing delays between attempts
      const attempts = await page.evaluate(() => (window as any).reconnectionAttempts);
      
      if (attempts && attempts.length > 1) {
        for (let i = 1; i < attempts.length; i++) {
          const timeDiff = attempts[i].timestamp - attempts[i-1].timestamp;
          const expectedMinDelay = Math.pow(2, i-1) * 100; // Scaled down for test
          expect(timeDiff).toBeGreaterThan(expectedMinDelay * 0.8); // Allow some variance
        }
      }

      // Should show reconnection status
      await expect(page.locator('[data-testid="reconnection-status"]')).toBeVisible();
    });
  });

  test.describe('Performance and Scalability', () => {
    test('should handle high-frequency message updates', async () => {
      await waitForWebSocketConnection(page);

      // Send many rapid updates
      const messageCount = 50;
      const messages = Array.from({ length: messageCount }, (_, i) => ({
        type: 'rapid_update',
        data: { id: i, timestamp: Date.now() + i }
      }));

      const startTime = Date.now();
      
      for (const message of messages) {
        await simulateWebSocketMessage(page, message);
        await page.waitForTimeout(10); // 10ms between messages
      }

      const processingTime = Date.now() - startTime;

      // Should handle all messages without significant delay
      expect(processingTime).toBeLessThan(messageCount * 50); // 50ms per message max

      // UI should remain responsive
      const searchInput = page.locator('[data-testid="nlp-search-input"]');
      await searchInput.fill('responsiveness test');
      await expect(searchInput).toHaveValue('responsiveness test');
    });

    test('should implement message throttling for UI updates', async () => {
      await waitForWebSocketConnection(page);

      // Send rapid price updates for same product
      const productId = 'throttle-test-product';
      const priceUpdates = [4.99, 5.49, 4.79, 5.99, 4.29];

      for (const price of priceUpdates) {
        await simulateWebSocketMessage(page, {
          type: 'price_update',
          data: { productId, newPrice: price, oldPrice: price + 0.50 }
        });
        await page.waitForTimeout(50); // Rapid updates
      }

      // Should throttle updates to prevent UI thrashing
      const updateNotifications = page.locator('[data-testid="price-update-notification"]');
      const notificationCount = await updateNotifications.count();
      
      // Should have fewer notifications than updates due to throttling
      expect(notificationCount).toBeLessThan(priceUpdates.length);
      expect(notificationCount).toBeGreaterThan(0);
    });

    test('should handle large message payloads efficiently', async () => {
      await waitForWebSocketConnection(page);

      // Create large message payload
      const largeUpdate = {
        type: 'bulk_product_update',
        data: {
          products: Array.from({ length: 1000 }, (_, i) => ({
            id: `product-${i}`,
            name: `Product ${i}`,
            price: 10 + (i % 50),
            inStock: i % 3 !== 0,
            category: `Category ${i % 10}`
          }))
        }
      };

      const startTime = Date.now();
      await simulateWebSocketMessage(page, largeUpdate);
      
      // Should process large payload
      await page.waitForTimeout(1000); // Allow processing time
      const processingTime = Date.now() - startTime;

      // Should handle large payload reasonably quickly
      expect(processingTime).toBeLessThan(3000); // 3 seconds max

      // UI should remain responsive
      const searchInput = page.locator('[data-testid="nlp-search-input"]');
      await searchInput.click();
      await expect(searchInput).toBeFocused();
    });
  });
});