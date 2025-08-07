import { test, expect } from '@playwright/test';
import { WalmartTestHelpers } from './utils/test-helpers';

/**
 * Visual Regression Testing for Walmart Grocery Agent
 * Captures screenshots and compares UI components for visual consistency
 */

test.describe('Visual Regression Tests', () => {
  let helpers: WalmartTestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new WalmartTestHelpers(page);
    await helpers.mockWalmartAPI();
    await helpers.navigateToWalmartAgent();
    
    // Wait for all content to load
    await helpers.waitForLoadingComplete();
  });

  test.describe('Component Screenshots', () => {
    test('should capture main dashboard layout', async ({ page }) => {
      // Wait for stats to load
      await expect(page.locator('.stat-card')).toHaveCountGreaterThan(0);
      
      // Take full page screenshot
      await expect(page).toHaveScreenshot('walmart-agent-main-dashboard.png', {
        fullPage: true,
        threshold: 0.3, // Allow for minor differences
      });
    });

    test('should capture shopping tab with search results', async ({ page }) => {
      await helpers.searchForProduct('milk');
      await helpers.verifySearchResults(1);
      
      // Wait for images to load
      await page.waitForTimeout(2000);
      
      // Capture shopping interface with results
      await expect(page.locator('.agent-content')).toHaveScreenshot('shopping-tab-with-results.png', {
        threshold: 0.3,
      });
    });

    test('should capture grocery list interface', async ({ page }) => {
      // Add some items first
      await helpers.searchForProduct('milk');
      await helpers.addItemToGroceryList(0);
      
      await helpers.switchTab('grocery-list');
      await helpers.waitForLoadingComplete();
      
      // Capture grocery list layout
      await expect(page.locator('.agent-content')).toHaveScreenshot('grocery-list-interface.png', {
        threshold: 0.3,
      });
    });

    test('should capture budget tracker visualization', async ({ page }) => {
      await helpers.switchTab('budget-tracker');
      await helpers.waitForLoadingComplete();
      
      // Wait for progress bars to render
      await page.waitForTimeout(1000);
      
      // Capture budget tracker
      await expect(page.locator('.agent-content')).toHaveScreenshot('budget-tracker-interface.png', {
        threshold: 0.3,
      });
    });

    test('should capture price history charts', async ({ page }) => {
      await helpers.switchTab('price-history');
      await helpers.waitForLoadingComplete();
      
      // Wait for chart animations to complete
      await page.waitForTimeout(2000);
      
      // Capture price history interface
      await expect(page.locator('.agent-content')).toHaveScreenshot('price-history-interface.png', {
        threshold: 0.3,
      });
    });

    test('should capture live pricing interface', async ({ page }) => {
      await helpers.switchTab('live-pricing');
      await helpers.waitForLoadingComplete();
      
      // Perform a search to show pricing results
      const searchInput = page.locator('input[placeholder*="Search"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('milk');
        await page.locator('button:has-text("Search")').click();
        await page.waitForTimeout(3000);
      }
      
      // Capture live pricing interface
      await expect(page.locator('.agent-content')).toHaveScreenshot('live-pricing-interface.png', {
        threshold: 0.3,
      });
    });
  });

  test.describe('Mobile Responsive Views', () => {
    test('should capture mobile dashboard layout', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await helpers.navigateToWalmartAgent();
      
      await helpers.waitForLoadingComplete();
      
      // Capture mobile layout
      await expect(page).toHaveScreenshot('walmart-agent-mobile-dashboard.png', {
        fullPage: true,
        threshold: 0.3,
      });
    });

    test('should capture tablet layout', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      await helpers.navigateToWalmartAgent();
      
      await helpers.waitForLoadingComplete();
      
      // Capture tablet layout
      await expect(page).toHaveScreenshot('walmart-agent-tablet-dashboard.png', {
        fullPage: true,
        threshold: 0.3,
      });
    });

    test('should capture mobile grocery list', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Add items and switch to grocery list
      await helpers.searchForProduct('milk');
      await helpers.addItemToGroceryList(0);
      await helpers.switchTab('grocery-list');
      
      await helpers.waitForLoadingComplete();
      
      // Capture mobile grocery list
      await expect(page.locator('.agent-content')).toHaveScreenshot('mobile-grocery-list.png', {
        threshold: 0.3,
      });
    });
  });

  test.describe('State-based Screenshots', () => {
    test('should capture empty states', async ({ page }) => {
      // Capture empty search results
      await helpers.searchForProduct('nonexistent product');
      await page.waitForTimeout(2000);
      
      await expect(page.locator('.agent-content')).toHaveScreenshot('empty-search-results.png', {
        threshold: 0.3,
      });

      // Capture empty grocery list
      await helpers.switchTab('grocery-list');
      await helpers.waitForLoadingComplete();
      
      await expect(page.locator('.agent-content')).toHaveScreenshot('empty-grocery-list.png', {
        threshold: 0.3,
      });
    });

    test('should capture loading states', async ({ page }) => {
      // Simulate slow API responses to capture loading states
      await page.route('**/api/walmart/search**', async route => {
        // Delay response to capture loading state
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.continue();
      });

      await helpers.searchForProduct('milk');
      
      // Capture loading state
      const loadingElement = page.locator('.spinner, .loading, [data-testid="loading"]');
      if (await loadingElement.isVisible()) {
        await expect(page.locator('.agent-content')).toHaveScreenshot('loading-state.png', {
          threshold: 0.3,
        });
      }
    });

    test('should capture error states', async ({ page }) => {
      // Mock API error
      await page.route('**/api/walmart/**', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Service unavailable' })
        });
      });

      await helpers.searchForProduct('milk');
      await page.waitForTimeout(3000);
      
      // Capture error state
      await expect(page.locator('.agent-content')).toHaveScreenshot('error-state.png', {
        threshold: 0.3,
      });
    });

    test('should capture item selection states', async ({ page }) => {
      await helpers.searchForProduct('milk');
      await helpers.verifySearchResults(1);
      
      // Select first item
      const selectButton = page.locator('button:has-text("Add"), button[data-testid="add-to-list"]').first();
      if (await selectButton.isVisible()) {
        await selectButton.click();
        await page.waitForTimeout(1000);
      }
      
      // Capture selected state
      await expect(page.locator('.agent-content')).toHaveScreenshot('item-selected-state.png', {
        threshold: 0.3,
      });
    });
  });

  test.describe('Component Interactions', () => {
    test('should capture hover states', async ({ page }) => {
      await helpers.searchForProduct('milk');
      await helpers.verifySearchResults(1);
      
      // Hover over first product card
      const firstProduct = page.locator('.grocery-item, .product-card').first();
      await firstProduct.hover();
      await page.waitForTimeout(500);
      
      // Capture hover state
      await expect(firstProduct).toHaveScreenshot('product-card-hover.png', {
        threshold: 0.3,
      });
    });

    test('should capture focus states for accessibility', async ({ page }) => {
      // Focus on search input
      const searchInput = page.locator('input[placeholder*="Search"]').first();
      await searchInput.focus();
      
      // Capture focus state
      await expect(page.locator('.search-section, .search-container')).toHaveScreenshot('search-input-focus.png', {
        threshold: 0.3,
      });

      // Tab through navigation
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Capture focused navigation
      await expect(page.locator('.agent-nav, .nav-tabs')).toHaveScreenshot('navigation-focus.png', {
        threshold: 0.3,
      });
    });

    test('should capture modal and popup states', async ({ page }) => {
      // Look for buttons that might open modals
      const alertButton = page.locator('button:has-text("Alert"), button[data-testid="set-alert"]').first();
      
      if (await alertButton.isVisible()) {
        await alertButton.click();
        await page.waitForTimeout(1000);
        
        // If modal opens, capture it
        const modal = page.locator('.modal, .popup, [role="dialog"]');
        if (await modal.isVisible()) {
          await expect(modal).toHaveScreenshot('price-alert-modal.png', {
            threshold: 0.3,
          });
        }
      }
    });
  });

  test.describe('Theme and Styling Variations', () => {
    test('should capture high contrast mode if available', async ({ page }) => {
      // Enable high contrast mode (if supported)
      await page.evaluate(() => {
        document.body.classList.add('high-contrast');
        document.documentElement.setAttribute('data-theme', 'high-contrast');
      });

      await page.waitForTimeout(1000);
      
      // Capture high contrast version
      await expect(page).toHaveScreenshot('high-contrast-mode.png', {
        fullPage: true,
        threshold: 0.3,
      });
    });

    test('should capture dark mode if available', async ({ page }) => {
      // Enable dark mode (if supported)
      await page.evaluate(() => {
        document.body.classList.add('dark-mode');
        document.documentElement.setAttribute('data-theme', 'dark');
      });

      await page.waitForTimeout(1000);
      
      // Capture dark mode version
      await expect(page).toHaveScreenshot('dark-mode.png', {
        fullPage: true,
        threshold: 0.3,
      });
    });

    test('should capture reduced motion mode', async ({ page }) => {
      // Disable animations
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        `
      });

      await helpers.searchForProduct('milk');
      await helpers.verifySearchResults(1);
      
      // Capture without animations
      await expect(page.locator('.agent-content')).toHaveScreenshot('reduced-motion-mode.png', {
        threshold: 0.3,
      });
    });
  });

  test.describe('Browser-specific Rendering', () => {
    test('should capture cross-browser consistent rendering', async ({ page, browserName }) => {
      // This test will run on different browsers as configured in playwright.config.ts
      await helpers.searchForProduct('milk');
      await helpers.verifySearchResults(1);
      
      // Capture browser-specific rendering
      await expect(page).toHaveScreenshot(`walmart-agent-${browserName}.png`, {
        fullPage: true,
        threshold: 0.3,
      });
    });

    test('should handle font rendering differences', async ({ page }) => {
      // Test with system fonts
      await page.addStyleTag({
        content: `
          * {
            font-family: system-ui, -apple-system, sans-serif !important;
          }
        `
      });

      await helpers.waitForLoadingComplete();
      
      // Capture with system fonts
      await expect(page).toHaveScreenshot('system-fonts-rendering.png', {
        fullPage: true,
        threshold: 0.4, // Higher threshold for font differences
      });
    });
  });

  test.describe('Performance-based Visual Tests', () => {
    test('should capture layout with large datasets', async ({ page }) => {
      // Mock large search results
      await page.route('**/api/walmart/search**', async route => {
        const largeDataset = Array.from({ length: 50 }, (_, i) => ({
          id: `large-${i}`,
          name: `Test Product ${i + 1}`,
          price: Math.random() * 20 + 1,
          inStock: true,
          imageUrl: '/api/placeholder/150/150',
          category: 'Test',
          unit: 'each'
        }));

        await route.fulfill({
          json: {
            products: largeDataset,
            metadata: { totalResults: largeDataset.length }
          }
        });
      });

      await helpers.searchForProduct('large dataset');
      await page.waitForTimeout(3000);
      
      // Capture large dataset rendering
      await expect(page.locator('.agent-content')).toHaveScreenshot('large-dataset-layout.png', {
        threshold: 0.3,
      });
    });

    test('should capture layout stability during loading', async ({ page }) => {
      // Test Cumulative Layout Shift (CLS)
      await page.route('**/api/walmart/**', async route => {
        // Stagger responses to test layout stability
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));
        await route.continue();
      });

      await helpers.searchForProduct('milk');
      
      // Capture initial layout
      await page.waitForTimeout(500);
      await expect(page.locator('.agent-content')).toHaveScreenshot('layout-during-loading-initial.png', {
        threshold: 0.3,
      });

      // Wait for content to stabilize
      await helpers.waitForLoadingComplete();
      
      // Capture final stable layout
      await expect(page.locator('.agent-content')).toHaveScreenshot('layout-after-loading-stable.png', {
        threshold: 0.3,
      });
    });
  });

  test.afterEach(async ({ page }) => {
    // Reset any styling modifications
    await page.evaluate(() => {
      document.body.classList.remove('dark-mode', 'high-contrast');
      document.documentElement.removeAttribute('data-theme');
    });
  });
});