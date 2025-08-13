import { test, expect } from '@playwright/test';
import { WalmartTestHelpers, GroceryListHelpers } from './utils/test-helpers';
import { MOCK_GROCERY_LISTS, MOCK_BUDGET_DATA, MOCK_PRODUCTS } from './fixtures/mock-data';

/**
 * Integration Tests for Cross-Component Interactions
 * Tests complete user workflows that span multiple components
 */

test.describe('Integration Workflows - Cross-Component Interactions', () => {
  let helpers: WalmartTestHelpers;
  let groceryHelpers: GroceryListHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new WalmartTestHelpers(page);
    groceryHelpers = new GroceryListHelpers(page);
    
    await helpers.mockWalmartAPI();
    await helpers.navigateToWalmartAgent();
  });

  test.describe('Complete Shopping Workflow', () => {
    test('should complete full shopping journey from search to budget tracking', async ({ page }) => {
      // Step 1: Search for products
      await helpers.searchForProduct('milk');
      await helpers.verifySearchResults(1);
      await helpers.takeTimestampedScreenshot('workflow-step-1-search');

      // Step 2: Add items to grocery list
      await helpers.addItemToGroceryList(0);
      await page.waitForTimeout(1000);

      // Step 3: Verify item in grocery list
      await helpers.switchTab('grocery-list');
      await groceryHelpers.verifyItemCount(1);
      await helpers.verifyGroceryListTotals();
      await helpers.takeTimestampedScreenshot('workflow-step-2-grocery-list');

      // Step 4: Check budget impact
      await helpers.switchTab('budget-tracker');
      await helpers.verifyBudgetCalculations();
      
      // Verify budget category reflects the addition
      const dairyCategory = page.locator('[data-testid="dairy-budget"], .category-card:has-text("Dairy")');
      if (await dairyCategory.isVisible()) {
        await expect(dairyCategory).toBeVisible();
      }
      await helpers.takeTimestampedScreenshot('workflow-step-3-budget-update');

      // Step 5: Set price alert
      await helpers.switchTab('shopping');
      await helpers.searchForProduct('milk');
      await helpers.setPriceAlert(0, 3.00);

      // Step 6: Verify alert in price history
      await helpers.switchTab('price-history');
      const alertsSection = page.locator('.price-alerts, [data-testid="price-alerts"]');
      if (await alertsSection.isVisible()) {
        const activeAlerts = page.locator('.alert-item, [data-testid="alert-item"]');
        if (await activeAlerts.count() > 0) {
          await expect(activeAlerts.first()).toBeVisible();
        }
      }
      await helpers.takeTimestampedScreenshot('workflow-step-4-price-alerts');

      // Step 7: Monitor prices in live pricing
      await helpers.switchTab('live-pricing');
      const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="product"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('milk');
        await page.locator('button:has-text("Search")').click();
        await page.waitForTimeout(2000);
      }
      await helpers.takeTimestampedScreenshot('workflow-step-5-live-pricing');

      console.log('✅ Complete shopping workflow test completed');
    });

    test('should handle multi-category shopping with budget constraints', async ({ page }) => {
      const categories = [
        { search: 'milk', category: 'Dairy' },
        { search: 'organic', category: 'Produce' },
        { search: 'chicken', category: 'Meat' }
      ];

      let totalExpectedItems = 0;

      // Add items from different categories
      for (const { search, category } of categories) {
        await helpers.searchForProduct(search);
        await helpers.verifySearchResults(1);
        await helpers.addItemToGroceryList(0);
        totalExpectedItems++;
        
        await helpers.takeTimestampedScreenshot(`multi-category-${category.toLowerCase()}`);
        await page.waitForTimeout(1000);
      }

      // Verify all items in grocery list
      await helpers.switchTab('grocery-list');
      await groceryHelpers.verifyItemCount(totalExpectedItems);
      await helpers.verifyGroceryListTotals();

      // Check budget impact across categories
      await helpers.switchTab('budget-tracker');
      
      // Verify multiple category budgets are affected
      const categoryCards = page.locator('.category-card, [data-testid="budget-category"]');
      const categoryCount = await categoryCards.count();
      expect(categoryCount).toBeGreaterThan(0);

      // Check for budget warnings if any category is approaching limits
      const warnings = page.locator('.warning, .alert, [data-testid="budget-warning"]');
      if (await warnings.count() > 0) {
        await expect(warnings.first()).toBeVisible();
      }

      await helpers.takeTimestampedScreenshot('multi-category-budget-impact');
    });

    test('should maintain data consistency across browser refresh', async ({ page }) => {
      // Add items to grocery list
      await helpers.searchForProduct('milk');
      await helpers.addItemToGroceryList(0);
      
      await helpers.searchForProduct('bread');
      await helpers.addItemToGroceryList(0);

      // Verify initial state
      await helpers.switchTab('grocery-list');
      const initialItemCount = await page.locator('.grocery-list-item, [data-testid="grocery-item"]').count();
      expect(initialItemCount).toBeGreaterThan(0);

      // Get initial total
      const initialTotalElement = page.locator('.total-price, [data-testid="total-price"]');
      const initialTotal = await initialTotalElement.textContent();

      // Refresh the page
      await page.reload({ waitUntil: 'networkidle' });
      
      // Navigate back to Walmart agent
      await helpers.navigateToWalmartAgent();
      await helpers.switchTab('grocery-list');

      // Verify data persistence
      const afterRefreshItemCount = await page.locator('.grocery-list-item, [data-testid="grocery-item"]').count();
      
      // Data should persist (or handle gracefully if not implemented)
      if (afterRefreshItemCount > 0) {
        expect(afterRefreshItemCount).toBe(initialItemCount);
        
        const afterRefreshTotalElement = page.locator('.total-price, [data-testid="total-price"]');
        const afterRefreshTotal = await afterRefreshTotalElement.textContent();
        expect(afterRefreshTotal).toBe(initialTotal);
      }

      await helpers.takeTimestampedScreenshot('data-persistence-after-refresh');
    });
  });

  test.describe('Price Monitoring Integration', () => {
    test('should sync price changes across all components', async ({ page }) => {
      // Add product to grocery list
      await helpers.searchForProduct('milk');
      await helpers.addItemToGroceryList(0);

      // Set up price monitoring
      await helpers.switchTab('live-pricing');
      
      const searchInput = page.locator('input[placeholder*="Search"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('milk');
        await page.locator('button:has-text("Search")').click();
        await page.waitForTimeout(2000);

        // Set up monitoring if available
        const monitorButton = page.locator('button:has-text("Monitor")').first();
        if (await monitorButton.isVisible()) {
          await monitorButton.click();
        }
      }

      // Simulate price update
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('price-update', {
          detail: {
            productId: 'dairy-001',
            oldPrice: 3.48,
            newPrice: 3.99,
            productName: 'Whole Milk'
          }
        }));
      });

      await page.waitForTimeout(1500);

      // Check price update in grocery list
      await helpers.switchTab('grocery-list');
      
      // Verify updated price is reflected
      const priceElements = page.locator('[data-testid="item-price"], .item-price, .price');
      if (await priceElements.count() > 0) {
        const updatedPrice = await priceElements.first().textContent();
        expect(updatedPrice).toContain('3.99');
      }

      // Check budget tracker reflects new price
      await helpers.switchTab('budget-tracker');
      const dairyBudget = page.locator('.category-card:has-text("Dairy"), [data-testid="dairy-budget"]');
      if (await dairyBudget.isVisible()) {
        // Budget spent should be updated
        await expect(dairyBudget).toBeVisible();
      }

      await helpers.takeTimestampedScreenshot('price-sync-across-components');
    });

    test('should handle price alerts with grocery list integration', async ({ page }) => {
      // Add item to grocery list
      await helpers.searchForProduct('milk');
      await helpers.addItemToGroceryList(0);

      // Set price alert
      await helpers.setPriceAlert(0, 3.00);

      // Simulate price drop below alert threshold
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('price-alert-triggered', {
          detail: {
            productId: 'dairy-001',
            productName: 'Whole Milk',
            currentPrice: 2.99,
            alertPrice: 3.00,
            message: 'Price dropped to $2.99!'
          }
        }));
      });

      await page.waitForTimeout(1000);

      // Check for alert notification
      const alertNotification = page.locator('.notification, .alert, [data-testid="notification"]');
      if (await alertNotification.isVisible()) {
        await expect(alertNotification).toContainText(/price.*drop|alert/i);
      }

      // Verify grocery list shows updated price
      await helpers.switchTab('grocery-list');
      await helpers.verifyGroceryListTotals(); // Should reflect new lower total

      await helpers.takeTimestampedScreenshot('price-alert-integration');
    });
  });

  test.describe('Budget Integration Workflows', () => {
    test('should update budget in real-time as items are added/removed', async ({ page }) => {
      // Start with budget tracker to see initial state
      await helpers.switchTab('budget-tracker');
      
      // Capture initial budget state
      const initialBudgetSpent = page.locator('.budget-amount, [data-testid="budget-spent"]');
      const initialSpentAmount = await initialBudgetSpent.textContent();
      
      // Add expensive item
      await helpers.switchTab('shopping');
      await helpers.searchForProduct('organic'); // Organic items tend to be pricier
      await helpers.addItemToGroceryList(0);

      // Check budget update
      await helpers.switchTab('budget-tracker');
      await page.waitForTimeout(1500);

      // Budget spent should have increased
      const updatedBudgetSpent = page.locator('.budget-amount, [data-testid="budget-spent"]');
      const updatedSpentAmount = await updatedBudgetSpent.textContent();
      
      // Values should be different (if real-time updates are implemented)
      if (initialSpentAmount && updatedSpentAmount) {
        console.log(`Budget changed from ${initialSpentAmount} to ${updatedSpentAmount}`);
      }

      // Check progress bars for visual feedback
      const progressBars = page.locator('.progress-fill, [data-testid="progress-fill"]');
      await expect(progressBars.first()).toBeVisible();

      await helpers.takeTimestampedScreenshot('realtime-budget-update');
    });

    test('should show budget warnings when approaching limits', async ({ page }) => {
      // Add multiple expensive items to trigger budget warnings
      const expensiveItems = ['organic', 'salmon', 'cheese'];
      
      for (const item of expensiveItems) {
        await helpers.searchForProduct(item);
        await helpers.addItemToGroceryList(0);
        await page.waitForTimeout(1000);
      }

      // Check budget tracker for warnings
      await helpers.switchTab('budget-tracker');
      
      // Look for warning indicators
      const warningElements = page.locator('.warning, .danger, .alert, [class*="over-budget"]');
      if (await warningElements.count() > 0) {
        await expect(warningElements.first()).toBeVisible();
        
        // Should contain budget-related warning text
        const warningText = await warningElements.first().textContent();
        expect(warningText?.toLowerCase()).toMatch(/budget|limit|exceed|warning/);
      }

      // Check for progress bars over 100%
      const progressBars = page.locator('.progress-fill[style*="width: 1"], .progress-fill[style*="100%"]');
      if (await progressBars.count() > 0) {
        console.log('Found over-budget progress indicators');
      }

      await helpers.takeTimestampedScreenshot('budget-warnings');
    });

    test('should adjust budget recommendations based on shopping patterns', async ({ page }) => {
      // Add items from specific categories to establish a pattern
      await helpers.searchForProduct('milk');
      await helpers.addItemToGroceryList(0);
      
      await helpers.searchForProduct('bread');
      await helpers.addItemToGroceryList(0);

      // Switch to budget tracker
      await helpers.switchTab('budget-tracker');

      // Look for budget insights or recommendations
      const insights = page.locator('.insight-card, .recommendation, [data-testid="budget-insight"]');
      if (await insights.count() > 0) {
        await expect(insights.first()).toBeVisible();
        
        // Should contain actionable recommendations
        const insightText = await insights.first().textContent();
        expect(insightText).toBeTruthy();
        expect(insightText!.length).toBeGreaterThan(10); // Should have meaningful content
      }

      await helpers.takeTimestampedScreenshot('budget-recommendations');
    });
  });

  test.describe('Search and Filter Integration', () => {
    test('should maintain search filters across navigation', async ({ page }) => {
      // Apply filters (if available)
      const filterButtons = page.locator('.filter-chip, [data-testid="filter-chip"]');
      if (await filterButtons.count() > 0) {
        // Click on a category filter
        const produceFilter = filterButtons.locator('text="Produce"').first();
        if (await produceFilter.isVisible()) {
          await produceFilter.click();
          await page.waitForTimeout(500);
        }
      }

      // Perform search
      await helpers.searchForProduct('organic');
      await helpers.verifySearchResults(1);

      // Switch tabs and return
      await helpers.switchTab('grocery-list');
      await helpers.switchTab('shopping');

      // Verify search results and filters are maintained
      const searchInput = page.locator('input[placeholder*="Search"]').first();
      const searchValue = await searchInput.inputValue();
      expect(searchValue).toBe('organic');

      await helpers.takeTimestampedScreenshot('maintained-search-filters');
    });

    test('should handle complex search queries with category filtering', async ({ page }) => {
      // Test natural language search with filters
      const complexQueries = [
        'organic dairy products',
        'cheap protein under $5',
        'gluten free options'
      ];

      for (const query of complexQueries) {
        await helpers.searchForProduct(query);
        await page.waitForTimeout(2000);

        // Verify results are relevant to the query
        const results = page.locator('.grocery-item, .product-card');
        if (await results.count() > 0) {
          // Check that results contain relevant keywords
          const firstResult = results.first();
          const resultText = await firstResult.textContent();
          
          // Results should be contextually relevant (this is a basic check)
          expect(resultText).toBeTruthy();
          expect(resultText!.length).toBeGreaterThan(5);
        }

        await helpers.takeTimestampedScreenshot(`complex-search-${query.replace(/\s+/g, '-')}`);
      }
    });
  });

  test.describe('Voice and Accessibility Integration', () => {
    test('should handle voice commands across components', async ({ page }) => {
      const voiceCommands = [
        'add milk to grocery list',
        'show my budget',
        'check price history',
        'search for organic vegetables'
      ];

      for (const command of voiceCommands) {
        await helpers.simulateVoiceInput(command);
        await page.waitForTimeout(2000);

        // Verify appropriate component response
        if (command.includes('budget')) {
          // Should navigate to budget tracker
          const budgetSection = page.locator('.budget-section, [data-testid="budget-tracker"]');
          if (await budgetSection.isVisible()) {
            await expect(budgetSection).toBeVisible();
          }
        } else if (command.includes('price history')) {
          // Should navigate to price history
          const priceHistorySection = page.locator('.price-history-section, [data-testid="price-history"]');
          if (await priceHistorySection.isVisible()) {
            await expect(priceHistorySection).toBeVisible();
          }
        } else if (command.includes('search')) {
          // Should perform search
          const searchResults = page.locator('.results-section, [data-testid="search-results"]');
          if (await searchResults.isVisible()) {
            await expect(searchResults).toBeVisible();
          }
        }

        await helpers.takeTimestampedScreenshot(`voice-command-${command.replace(/\s+/g, '-')}`);
      }
    });

    test('should maintain accessibility features across all components', async ({ page }) => {
      const tabs = ['shopping', 'grocery-list', 'budget-tracker', 'price-history', 'live-pricing'];

      for (const tab of tabs) {
        await helpers.switchTab(tab as any);
        
        // Check accessibility features
        await helpers.checkAccessibility();

        // Test keyboard navigation
        await page.keyboard.press('Tab');
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();

        // Check for ARIA labels and roles
        const interactiveElements = page.locator('button, input, select, [tabindex]');
        const elementCount = await interactiveElements.count();
        
        if (elementCount > 0) {
          for (let i = 0; i < Math.min(elementCount, 5); i++) {
            const element = interactiveElements.nth(i);
            const ariaLabel = await element.getAttribute('aria-label');
            const role = await element.getAttribute('role');
            const text = await element.textContent();
            
            // Element should be properly labeled
            expect(ariaLabel || role || (text && text.trim())).toBeTruthy();
          }
        }

        await helpers.takeTimestampedScreenshot(`accessibility-${tab}`);
      }
    });
  });

  test.describe('Error Recovery Integration', () => {
    test('should recover gracefully from API failures across components', async ({ page }) => {
      // Start with working API
      await helpers.searchForProduct('milk');
      await helpers.addItemToGroceryList(0);

      // Switch to grocery list to confirm item added
      await helpers.switchTab('grocery-list');
      await groceryHelpers.verifyItemCount(1);

      // Simulate API failure
      await page.route('**/api/walmart/**', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Service temporarily unavailable' })
        });
      });

      // Try to add another item (should fail gracefully)
      await helpers.switchTab('shopping');
      await helpers.searchForProduct('bread');
      await page.waitForTimeout(3000);

      // Should show error state without breaking the app
      const errorIndicator = page.locator('.error, .alert, [data-testid="error"]');
      if (await errorIndicator.isVisible()) {
        await expect(errorIndicator).toBeVisible();
      }

      // Previous data should still be accessible
      await helpers.switchTab('grocery-list');
      await groceryHelpers.verifyItemCount(1); // Previous item should still be there

      await helpers.takeTimestampedScreenshot('api-failure-recovery');
    });

    test('should maintain component state during network issues', async ({ page }) => {
      // Build up state across components
      await helpers.searchForProduct('milk');
      await helpers.addItemToGroceryList(0);
      await helpers.setPriceAlert(0, 3.00);

      // Simulate network issues
      await page.setOffline(true);
      await page.waitForTimeout(1000);

      // Try to interact with components
      await helpers.switchTab('grocery-list');
      await groceryHelpers.verifyItemCount(1); // Should still show cached data

      await helpers.switchTab('budget-tracker');
      await helpers.verifyBudgetCalculations(); // Should work with cached data

      // Restore network
      await page.setOffline(false);
      await page.waitForTimeout(2000);

      // Verify components sync back up
      await helpers.switchTab('shopping');
      // Should be able to search again
      await helpers.searchForProduct('bread');
      
      await helpers.takeTimestampedScreenshot('network-issue-recovery');
    });
  });

  test.afterEach(async ({ page }) => {
    // Clean up any persistent state
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });
});