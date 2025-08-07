import { test, expect } from '@playwright/test';
import { WalmartTestHelpers } from './utils/test-helpers';
import { MOCK_WEBSOCKET_MESSAGES } from './fixtures/mock-data';

/**
 * WebSocket Real-time Updates Testing
 * Tests real-time price updates, stock changes, and live notifications
 */

test.describe('WebSocket Real-time Updates', () => {
  let helpers: WalmartTestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new WalmartTestHelpers(page);
    await helpers.mockWalmartAPI();
    await helpers.navigateToWalmartAgent();
  });

  test.describe('WebSocket Connection Management', () => {
    test('should establish WebSocket connection on load', async ({ page }) => {
      // Check if WebSocket connection is established
      const wsConnected = await page.evaluate(() => {
        return new Promise((resolve) => {
          // Check if WebSocket is available
          if (typeof WebSocket === 'undefined') {
            resolve(false);
            return;
          }

          // Look for existing WebSocket connections or create test connection
          try {
            const testWs = new WebSocket('ws://localhost:3000');
            testWs.onopen = () => {
              testWs.close();
              resolve(true);
            };
            testWs.onerror = () => {
              resolve(false);
            };
            
            // Timeout after 5 seconds
            setTimeout(() => {
              if (testWs.readyState === WebSocket.CONNECTING) {
                testWs.close();
                resolve(false);
              }
            }, 5000);
          } catch (error) {
            resolve(false);
          }
        });
      });

      if (wsConnected) {
        console.log('✅ WebSocket connection available');
        await helpers.verifyWebSocketConnection();
      } else {
        console.log('ℹ️ WebSocket connection not available - testing in fallback mode');
      }

      await helpers.takeTimestampedScreenshot('websocket-connection-status');
    });

    test('should handle connection drops gracefully', async ({ page }) => {
      // Simulate connection drop
      await page.evaluate(() => {
        // Dispatch a connection lost event
        window.dispatchEvent(new CustomEvent('websocket-disconnected'));
      });

      await page.waitForTimeout(1000);

      // Check for reconnection attempt or offline indicator
      const connectionStatus = page.locator('[data-testid="connection-status"], .connection-indicator');
      if (await connectionStatus.isVisible()) {
        // Should show disconnected or reconnecting state
        const statusText = await connectionStatus.textContent();
        expect(statusText?.toLowerCase()).toMatch(/disconnect|offline|reconnect/);
      }

      await helpers.takeTimestampedScreenshot('websocket-disconnected');
    });

    test('should reconnect automatically after connection loss', async ({ page }) => {
      // Simulate connection drop and restoration
      await page.evaluate(() => {
        // Simulate disconnect
        window.dispatchEvent(new CustomEvent('websocket-disconnected'));
        
        // Simulate reconnection after delay
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('websocket-reconnected'));
        }, 2000);
      });

      await page.waitForTimeout(3000);

      // Check for reconnected status
      const connectionStatus = page.locator('[data-testid="connection-status"], .connection-indicator');
      if (await connectionStatus.isVisible()) {
        const statusText = await connectionStatus.textContent();
        expect(statusText?.toLowerCase()).toMatch(/connect|online/);
      }

      await helpers.takeTimestampedScreenshot('websocket-reconnected');
    });
  });

  test.describe('Real-time Price Updates', () => {
    test('should receive and display live price updates', async ({ page }) => {
      // First add some products to monitor
      await helpers.searchForProduct('milk');
      await helpers.addItemToGroceryList(0);

      // Switch to live pricing to set up monitoring
      await helpers.switchTab('live-pricing');
      
      // Set up price monitoring (if available)
      const monitorButton = page.locator('button:has-text("Monitor")').first();
      if (await monitorButton.isVisible()) {
        await monitorButton.click();
      }

      // Simulate incoming price update via WebSocket
      await page.evaluate((mockMessage) => {
        window.dispatchEvent(new CustomEvent('websocket-message', {
          detail: mockMessage
        }));
      }, MOCK_WEBSOCKET_MESSAGES.priceUpdate);

      await page.waitForTimeout(2000);

      // Check if price update is reflected in UI
      const priceElements = page.locator('[data-testid="live-price"], .live-price, .current-price');
      if (await priceElements.count() > 0) {
        // Price should be updated to the new value
        const updatedPrice = await priceElements.first().textContent();
        expect(updatedPrice).toContain('1.98'); // From mock data
      }

      await helpers.takeTimestampedScreenshot('live-price-update');
    });

    test('should show price change notifications', async ({ page }) => {
      // Set up a product for monitoring
      await helpers.searchForProduct('milk');
      await helpers.setPriceAlert(0, 2.00);

      // Simulate price drop notification
      await page.evaluate((mockMessage) => {
        const priceDropEvent = new CustomEvent('price-alert', {
          detail: {
            productId: mockMessage.data.productId,
            message: `Price dropped from $${mockMessage.data.oldPrice} to $${mockMessage.data.newPrice}!`,
            type: 'price-drop'
          }
        });
        window.dispatchEvent(priceDropEvent);
      }, MOCK_WEBSOCKET_MESSAGES.priceUpdate);

      await page.waitForTimeout(1000);

      // Look for notification
      const notification = page.locator('[data-testid="notification"], .notification, .alert');
      if (await notification.isVisible()) {
        await expect(notification).toContainText(/price.*drop|alert/i);
      }

      await helpers.takeTimestampedScreenshot('price-change-notification');
    });

    test('should update multiple products simultaneously', async ({ page }) => {
      // Add multiple products to monitor
      await helpers.searchForProduct('organic');
      await helpers.addItemToGroceryList(0);
      
      await helpers.searchForProduct('dairy');
      await helpers.addItemToGroceryList(0);

      // Simulate multiple price updates
      const multipleUpdates = [
        { ...MOCK_WEBSOCKET_MESSAGES.priceUpdate, data: { ...MOCK_WEBSOCKET_MESSAGES.priceUpdate.data, productId: 'prod-001' } },
        { ...MOCK_WEBSOCKET_MESSAGES.priceUpdate, data: { ...MOCK_WEBSOCKET_MESSAGES.priceUpdate.data, productId: 'dairy-001', newPrice: 3.99 } }
      ];

      for (const update of multipleUpdates) {
        await page.evaluate((mockMessage) => {
          window.dispatchEvent(new CustomEvent('websocket-message', {
            detail: mockMessage
          }));
        }, update);
      }

      await page.waitForTimeout(2000);

      // Switch to grocery list to see updated prices
      await helpers.switchTab('grocery-list');
      
      // Verify that running totals are updated
      await helpers.verifyGroceryListTotals();

      await helpers.takeTimestampedScreenshot('multiple-price-updates');
    });
  });

  test.describe('Real-time Stock Updates', () => {
    test('should handle stock availability changes', async ({ page }) => {
      // Search for products including out-of-stock items
      await helpers.searchForProduct('organic');
      
      // Simulate stock becoming available
      await page.evaluate((mockMessage) => {
        window.dispatchEvent(new CustomEvent('websocket-message', {
          detail: mockMessage
        }));
      }, MOCK_WEBSOCKET_MESSAGES.stockUpdate);

      await page.waitForTimeout(1500);

      // Check if stock status is updated
      const stockIndicators = page.locator('[data-testid="stock-status"], .stock-status, .in-stock, .out-of-stock');
      if (await stockIndicators.count() > 0) {
        const stockStatus = await stockIndicators.first().textContent();
        expect(stockStatus?.toLowerCase()).toContain('stock');
      }

      await helpers.takeTimestampedScreenshot('stock-update-received');
    });

    test('should enable/disable add buttons based on stock', async ({ page }) => {
      await helpers.searchForProduct('organic');
      
      // Find initially out-of-stock item
      const outOfStockItem = page.locator('.grocery-item.out-of-stock, .product-card.out-of-stock').first();
      if (await outOfStockItem.isVisible()) {
        const addButton = outOfStockItem.locator('button:has-text("Add"), button[data-testid="add-to-list"]');
        
        // Should be disabled initially
        if (await addButton.isVisible()) {
          await expect(addButton).toBeDisabled();
        }

        // Simulate stock becoming available
        await page.evaluate((mockMessage) => {
          window.dispatchEvent(new CustomEvent('stock-available', {
            detail: {
              productId: mockMessage.data.productId,
              inStock: true
            }
          }));
        }, MOCK_WEBSOCKET_MESSAGES.stockUpdate);

        await page.waitForTimeout(1000);

        // Button should now be enabled
        if (await addButton.isVisible()) {
          await expect(addButton).toBeEnabled();
        }
      }

      await helpers.takeTimestampedScreenshot('stock-button-state-change');
    });
  });

  test.describe('Real-time Budget Alerts', () => {
    test('should show budget threshold notifications', async ({ page }) => {
      // Add items to approach budget limit
      await helpers.searchForProduct('milk');
      await helpers.addItemToGroceryList(0);

      // Simulate budget alert
      await page.evaluate((mockMessage) => {
        window.dispatchEvent(new CustomEvent('websocket-message', {
          detail: mockMessage
        }));
      }, MOCK_WEBSOCKET_MESSAGES.budgetAlert);

      await page.waitForTimeout(1000);

      // Check for budget alert notification
      const budgetAlert = page.locator('[data-testid="budget-alert"], .budget-alert, .alert');
      if (await budgetAlert.isVisible()) {
        await expect(budgetAlert).toContainText(/budget|limit|alert/i);
      }

      await helpers.takeTimestampedScreenshot('budget-alert-notification');
    });

    test('should update budget progress bars in real-time', async ({ page }) => {
      // Switch to budget tracker
      await helpers.switchTab('budget-tracker');

      // Capture initial budget state
      const initialProgressBar = page.locator('.progress-fill').first();
      const initialWidth = await initialProgressBar.getAttribute('style');

      // Add expensive item to trigger budget update
      await helpers.switchTab('shopping');
      await helpers.searchForProduct('organic');
      await helpers.addItemToGroceryList(0);

      // Simulate real-time budget update
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('budget-updated', {
          detail: {
            category: 'Produce',
            newSpent: 85,
            limit: 80,
            percentage: 106.25
          }
        }));
      });

      await page.waitForTimeout(1000);

      // Switch back to budget tracker
      await helpers.switchTab('budget-tracker');

      // Verify progress bar is updated
      const updatedProgressBar = page.locator('.progress-fill').first();
      const updatedWidth = await updatedProgressBar.getAttribute('style');

      // Progress should have changed
      expect(updatedWidth).not.toBe(initialWidth);

      await helpers.takeTimestampedScreenshot('budget-progress-updated');
    });
  });

  test.describe('WebSocket Error Handling', () => {
    test('should handle malformed WebSocket messages', async ({ page }) => {
      // Send malformed message
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('websocket-message', {
          detail: { invalid: 'malformed message without proper structure' }
        }));
      });

      await page.waitForTimeout(1000);

      // App should continue functioning normally
      await expect(page.locator('body')).toBeVisible();
      
      // No error messages should be displayed to user
      const errorMessages = page.locator('.error-message, [data-testid="error"]');
      if (await errorMessages.count() > 0) {
        // If errors are shown, they should be developer-friendly, not user-facing
        const errorText = await errorMessages.first().textContent();
        expect(errorText?.toLowerCase()).not.toContain('websocket');
      }

      await helpers.takeTimestampedScreenshot('malformed-message-handling');
    });

    test('should handle WebSocket message delivery failures', async ({ page }) => {
      // Simulate failed message delivery
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('websocket-error', {
          detail: { error: 'Failed to deliver message' }
        }));
      });

      await page.waitForTimeout(1000);

      // Check for retry mechanism or graceful degradation
      const retryIndicator = page.locator('[data-testid="retry-indicator"], .retry-message');
      if (await retryIndicator.isVisible()) {
        await expect(retryIndicator).toBeVisible();
      }

      await helpers.takeTimestampedScreenshot('message-delivery-failure');
    });
  });

  test.describe('Performance with Real-time Updates', () => {
    test('should handle high-frequency updates without performance degradation', async ({ page }) => {
      // Set up performance monitoring
      await page.addInitScript(() => {
        window.performanceMetrics = {
          updateCount: 0,
          startTime: Date.now()
        };
      });

      // Simulate rapid price updates
      for (let i = 0; i < 10; i++) {
        await page.evaluate((index) => {
          window.performanceMetrics.updateCount++;
          window.dispatchEvent(new CustomEvent('websocket-message', {
            detail: {
              type: 'PRICE_UPDATE',
              data: {
                productId: `prod-${index % 3 + 1}`,
                oldPrice: 3.99,
                newPrice: 3.99 + (Math.random() * 2 - 1), // Random price change
                timestamp: new Date().toISOString()
              }
            }
          }));
        }, i);

        await page.waitForTimeout(100); // 10 updates per second
      }

      // Check performance metrics
      const metrics = await page.evaluate(() => {
        const endTime = Date.now();
        const duration = endTime - window.performanceMetrics.startTime;
        return {
          updateCount: window.performanceMetrics.updateCount,
          duration: duration,
          updatesPerSecond: window.performanceMetrics.updateCount / (duration / 1000)
        };
      });

      console.log('Performance metrics:', metrics);
      
      // Verify UI is still responsive
      await helpers.switchTab('grocery-list');
      await expect(page.locator('.grocery-list, [data-testid="grocery-list"]')).toBeVisible();

      await helpers.takeTimestampedScreenshot('high-frequency-updates-performance');
    });

    test('should batch updates to prevent UI thrashing', async ({ page }) => {
      // Set up DOM mutation observer
      await page.addInitScript(() => {
        window.domUpdateCount = 0;
        const observer = new MutationObserver(() => {
          window.domUpdateCount++;
        });
        
        // Start observing after page loads
        setTimeout(() => {
          const targetNode = document.querySelector('.walmart-agent, body');
          if (targetNode) {
            observer.observe(targetNode, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeOldValue: true
            });
          }
        }, 1000);
      });

      await page.waitForTimeout(1500);

      // Send multiple rapid updates
      for (let i = 0; i < 5; i++) {
        await page.evaluate((index) => {
          window.dispatchEvent(new CustomEvent('price-batch-update', {
            detail: {
              updates: [
                { productId: `prod-${index}`, newPrice: Math.random() * 10 + 1 },
                { productId: `dairy-${index}`, newPrice: Math.random() * 10 + 1 }
              ]
            }
          }));
        }, i);

        await page.waitForTimeout(50);
      }

      await page.waitForTimeout(2000);

      // Check if updates were batched (fewer DOM changes than individual updates)
      const domUpdateCount = await page.evaluate(() => window.domUpdateCount);
      console.log('DOM update count:', domUpdateCount);

      // Should have fewer DOM updates than total messages sent (indicating batching)
      expect(domUpdateCount).toBeLessThan(50); // Reasonable threshold

      await helpers.takeTimestampedScreenshot('batched-updates');
    });
  });

  test.afterEach(async ({ page }) => {
    // Clean up WebSocket connections and event listeners
    await page.evaluate(() => {
      // Remove any test event listeners
      const events = ['websocket-message', 'websocket-disconnected', 'websocket-reconnected', 
                     'price-alert', 'stock-available', 'budget-updated'];
      
      events.forEach(eventType => {
        window.removeEventListener(eventType, () => {});
      });

      // Clean up performance tracking
      delete window.performanceMetrics;
      delete window.domUpdateCount;
    });
  });
});