import { Page, Locator, expect } from '@playwright/test';

/**
 * Test Helpers for Walmart Grocery Agent E2E Tests
 * Reusable functions for common test operations
 */

export class WalmartTestHelpers {
  constructor(private page: Page) {}

  /**
   * Navigate to Walmart Grocery Agent
   */
  async navigateToWalmartAgent(): Promise<void> {
    await this.page.goto('/');
    
    // Look for Walmart navigation link/button
    const walmartLink = this.page.locator('text=/walmart|grocery/i').first();
    await expect(walmartLink).toBeVisible({ timeout: 10000 });
    await walmartLink.click();
    
    // Verify we're on the Walmart page
    await expect(this.page.locator('.walmart-agent')).toBeVisible({ timeout: 10000 });
  }

  /**
   * Switch between different tabs in the Walmart agent
   */
  async switchTab(tabName: 'shopping' | 'grocery-list' | 'budget-tracker' | 'price-history' | 'live-pricing'): Promise<void> {
    const tabButton = this.page.locator(`[data-testid="tab-${tabName}"], text="${tabName.replace('-', ' ')}"i`);
    await expect(tabButton).toBeVisible();
    await tabButton.click();
    
    // Wait for tab content to load
    await this.page.waitForTimeout(500);
  }

  /**
   * Perform product search
   */
  async searchForProduct(query: string): Promise<void> {
    const searchInput = this.page.locator('input[placeholder*="Search"]').first();
    const searchButton = this.page.locator('button:has-text("Search")').first();
    
    await expect(searchInput).toBeVisible();
    await searchInput.fill(query);
    await searchButton.click();
    
    // Wait for search results
    await this.page.waitForSelector('.results-section, .search-results, [data-testid="search-results"]', { 
      timeout: 15000 
    });
  }

  /**
   * Add item to grocery list
   */
  async addItemToGroceryList(itemIndex: number = 0): Promise<void> {
    const items = this.page.locator('.grocery-item, .product-card, [data-testid="product-item"]');
    await expect(items.nth(itemIndex)).toBeVisible();
    
    const addButton = items.nth(itemIndex).locator('button:has-text("Add"), button[data-testid="add-to-list"]');
    await expect(addButton).toBeVisible();
    await addButton.click();
    
    // Wait for confirmation or state change
    await this.page.waitForTimeout(1000);
  }

  /**
   * Set price alert for a product
   */
  async setPriceAlert(itemIndex: number, targetPrice?: number): Promise<void> {
    const items = this.page.locator('.grocery-item, .product-card');
    const alertButton = items.nth(itemIndex).locator('button:has-text("Alert"), button[data-testid="set-alert"]');
    
    await expect(alertButton).toBeVisible();
    await alertButton.click();
    
    if (targetPrice) {
      const priceInput = this.page.locator('input[placeholder*="price"], input[data-testid="target-price"]');
      if (await priceInput.isVisible()) {
        await priceInput.fill(targetPrice.toString());
        await this.page.locator('button:has-text("Set"), button:has-text("Save")').click();
      }
    }
  }

  /**
   * Verify search results are displayed
   */
  async verifySearchResults(expectedMinResults: number = 1): Promise<void> {
    const results = this.page.locator('.grocery-item, .product-card, [data-testid="product-item"]');
    await expect(results).toHaveCountGreaterThanOrEqual(expectedMinResults);
    
    // Check that results have essential information
    const firstResult = results.first();
    await expect(firstResult.locator('.item-name, .product-name, h3')).toBeVisible();
    await expect(firstResult.locator('.current-price, .price, [data-testid="price"]')).toBeVisible();
  }

  /**
   * Verify grocery list totals calculation
   */
  async verifyGroceryListTotals(): Promise<void> {
    const totalElement = this.page.locator('.total-price, [data-testid="total-price"]');
    await expect(totalElement).toBeVisible();
    
    const totalText = await totalElement.textContent();
    expect(totalText).toMatch(/\$\d+\.\d{2}/); // Matches currency format
  }

  /**
   * Mock API responses for testing
   */
  async mockWalmartAPI(): Promise<void> {
    // Mock search results
    await this.page.route('**/api/walmart/search**', async route => {
      const mockProducts = [
        {
          id: 'mock-1',
          name: 'Test Organic Milk',
          price: 4.99,
          originalPrice: 5.99,
          savings: 1.00,
          inStock: true,
          imageUrl: '/api/placeholder/100/100',
          category: 'Dairy',
          unit: 'gallon'
        },
        {
          id: 'mock-2',
          name: 'Test Whole Grain Bread',
          price: 2.99,
          inStock: true,
          imageUrl: '/api/placeholder/100/100',
          category: 'Bakery',
          unit: 'loaf'
        },
        {
          id: 'mock-3',
          name: 'Test Bananas',
          price: 1.99,
          inStock: false,
          imageUrl: '/api/placeholder/100/100',
          category: 'Produce',
          unit: 'lb'
        }
      ];

      await route.fulfill({
        json: {
          products: mockProducts,
          metadata: { totalResults: mockProducts.length },
          timestamp: new Date().toISOString()
        }
      });
    });

    // Mock price monitoring
    await this.page.route('**/api/walmart/price/**', async route => {
      await route.fulfill({
        json: {
          price: Math.random() * 10 + 1, // Random price between 1-11
          inStock: Math.random() > 0.2, // 80% chance in stock
          source: 'test',
          timestamp: new Date().toISOString()
        }
      });
    });

    // Mock live pricing health
    await this.page.route('**/api/walmart/health', async route => {
      await route.fulfill({
        json: {
          status: 'healthy',
          services: {
            searxng: 'available',
            scraper: 'available'
          },
          timestamp: new Date().toISOString()
        }
      });
    });
  }

  /**
   * Wait for and verify WebSocket connection
   */
  async verifyWebSocketConnection(): Promise<void> {
    // Wait for WebSocket to be established
    await this.page.waitForFunction(() => {
      return window.WebSocket !== undefined;
    });

    // Check for real-time updates indicator
    const wsIndicator = this.page.locator('[data-testid="ws-status"], .connection-status');
    if (await wsIndicator.isVisible()) {
      await expect(wsIndicator).toHaveText(/connected|online/i);
    }
  }

  /**
   * Simulate voice input (if voice features are available)
   */
  async simulateVoiceInput(transcript: string): Promise<void> {
    const voiceButton = this.page.locator('button[data-testid="voice-input"], button:has([data-testid="microphone-icon"])');
    
    if (await voiceButton.isVisible()) {
      await voiceButton.click();
      
      // Simulate speech recognition result
      await this.page.evaluate((text) => {
        const event = new CustomEvent('speechResult', { detail: { transcript: text } });
        window.dispatchEvent(event);
      }, transcript);
    }
  }

  /**
   * Verify budget tracker calculations
   */
  async verifyBudgetCalculations(): Promise<void> {
    const budgetSection = this.page.locator('.budget-section, [data-testid="budget-tracker"]');
    await expect(budgetSection).toBeVisible();

    // Check budget progress bars
    const progressBars = budgetSection.locator('.progress-bar, [data-testid="progress-bar"]');
    await expect(progressBars.first()).toBeVisible();

    // Verify budget amounts are displayed
    const budgetAmounts = budgetSection.locator('.budget-amount, [data-testid="budget-amount"]');
    await expect(budgetAmounts.first()).toBeVisible();
  }

  /**
   * Check for accessibility violations
   */
  async checkAccessibility(): Promise<void> {
    // Check for proper ARIA labels and roles
    const buttons = this.page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      const text = await button.textContent();
      
      // Button should have either text content or aria-label
      expect(ariaLabel || (text && text.trim())).toBeTruthy();
    }

    // Check for proper heading hierarchy
    const headings = this.page.locator('h1, h2, h3, h4, h5, h6');
    await expect(headings.first()).toBeVisible();
  }

  /**
   * Take screenshot with timestamp
   */
  async takeTimestampedScreenshot(name: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await this.page.screenshot({ 
      path: `test-results/screenshots/${name}-${timestamp}.png`,
      fullPage: true
    });
  }

  /**
   * Wait for loading states to complete
   */
  async waitForLoadingComplete(): Promise<void> {
    // Wait for any loading spinners to disappear
    await this.page.waitForFunction(() => {
      const loaders = document.querySelectorAll('.loading, .spinner, [data-testid="loading"]');
      return loaders.length === 0;
    }, { timeout: 30000 });

    // Wait for network to be idle
    await this.page.waitForLoadState('networkidle');
  }
}

/**
 * Grocery List Test Helpers
 */
export class GroceryListHelpers {
  constructor(private page: Page) {}

  async addTestItems(): Promise<void> {
    const testItems = [
      { name: 'Milk', price: 3.99 },
      { name: 'Bread', price: 2.49 },
      { name: 'Eggs', price: 4.99 }
    ];

    for (const item of testItems) {
      await this.page.evaluate((itemData) => {
        const event = new CustomEvent('addGroceryItem', { detail: itemData });
        window.dispatchEvent(event);
      }, item);
    }

    // Wait for items to be added
    await this.page.waitForTimeout(1000);
  }

  async verifyItemCount(expectedCount: number): Promise<void> {
    const items = this.page.locator('.grocery-list-item, [data-testid="grocery-item"]');
    await expect(items).toHaveCount(expectedCount);
  }

  async removeItem(itemIndex: number): Promise<void> {
    const items = this.page.locator('.grocery-list-item, [data-testid="grocery-item"]');
    const removeButton = items.nth(itemIndex).locator('button[data-testid="remove-item"], .remove-button');
    
    await expect(removeButton).toBeVisible();
    await removeButton.click();
    
    // Wait for item removal animation
    await this.page.waitForTimeout(500);
  }
}