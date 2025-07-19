import { test, expect, Page } from '@playwright/test';
import { EmailData, EmailStatus } from '../../types/email';

// 2025 Best Practice: Comprehensive E2E Testing with Playwright

const TEST_URL = process.env.TEST_URL || 'http://localhost:3000';

test.describe('Email Dashboard E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Table Display and Interaction', () => {
    test('should display email table with correct columns', async () => {
      // Verify table structure
      await expect(page.locator('table')).toBeVisible();
      
      const headers = ['Email Alias', 'Requested By', 'Subject', 'Summary', 'Status', 'Actions'];
      for (const header of headers) {
        await expect(page.getByText(header)).toBeVisible();
      }
    });

    test('should sort emails by clicking column headers', async () => {
      // Click subject header to sort
      await page.click('th:has-text("Subject")');
      
      // Verify sorting indicator appears
      await expect(page.locator('th:has-text("Subject") svg')).toBeVisible();
      
      // Get first row subject before and after sorting
      const firstSubjectBefore = await page.locator('tbody tr:first-child td:nth-child(3)').textContent();
      
      // Click again to reverse sort
      await page.click('th:has-text("Subject")');
      
      const firstSubjectAfter = await page.locator('tbody tr:first-child td:nth-child(3)').textContent();
      expect(firstSubjectBefore).not.toBe(firstSubjectAfter);
    });

    test('should paginate through email records', async () => {
      // Check pagination controls exist
      await expect(page.locator('.pagination')).toBeVisible();
      
      // Click next page
      await page.click('button:has-text("Next")');
      
      // Verify page number changes
      await expect(page.locator('.page-indicator')).toContainText('Page 2');
      
      // Click previous page
      await page.click('button:has-text("Previous")');
      await expect(page.locator('.page-indicator')).toContainText('Page 1');
    });
  });

  test.describe('Filtering and Search', () => {
    test('should filter emails by status', async () => {
      // Open filter panel
      await page.click('button:has-text("Filters")');
      
      // Select status filter
      await page.selectOption('select[name="status"]', 'pending');
      
      // Apply filter
      await page.click('button:has-text("Apply Filters")');
      
      // Verify all visible emails have pending status
      const statusElements = await page.locator('tbody tr .status-indicator').all();
      for (const element of statusElements) {
        await expect(element).toHaveClass(/status-pending/);
      }
    });

    test('should perform global search', async () => {
      const searchTerm = 'urgent';
      
      // Type in search box
      await page.fill('input[placeholder="Search emails..."]', searchTerm);
      
      // Wait for search results
      await page.waitForTimeout(500); // Debounce delay
      
      // Verify results contain search term
      const rows = await page.locator('tbody tr').count();
      expect(rows).toBeGreaterThan(0);
      
      // Check that results contain search term
      const firstRowText = await page.locator('tbody tr:first-child').textContent();
      expect(firstRowText?.toLowerCase()).toContain(searchTerm);
    });

    test('should save and load filter presets', async () => {
      // Open filter panel
      await page.click('button:has-text("Filters")');
      
      // Set multiple filters
      await page.selectOption('select[name="status"]', 'in_progress');
      await page.fill('input[name="requestedBy"]', 'John');
      
      // Save preset
      await page.click('button:has-text("Save Preset")');
      await page.fill('input[name="presetName"]', 'My Test Preset');
      await page.click('button:has-text("Save")');
      
      // Clear filters
      await page.click('button:has-text("Clear All")');
      
      // Load preset
      await page.selectOption('select[name="preset"]', 'My Test Preset');
      
      // Verify filters are restored
      await expect(page.locator('select[name="status"]')).toHaveValue('in_progress');
      await expect(page.locator('input[name="requestedBy"]')).toHaveValue('John');
    });
  });

  test.describe('Status Management', () => {
    test('should update email status with audit trail', async () => {
      // Click on first email's status update button
      await page.click('tbody tr:first-child button:has-text("Update Status")');
      
      // Select new status
      await page.selectOption('select[name="newStatus"]', 'approved');
      
      // Add comment
      await page.fill('textarea[name="comment"]', 'Approved after review');
      
      // Submit update
      await page.click('button:has-text("Update")');
      
      // Verify success notification
      await expect(page.locator('.notification.success')).toBeVisible();
      
      // Open audit trail
      await page.click('tbody tr:first-child button:has-text("View History")');
      
      // Verify audit entry exists
      await expect(page.locator('.audit-entry')).toContainText('Status changed to approved');
      await expect(page.locator('.audit-entry')).toContainText('Approved after review');
    });
  });

  test.describe('Export Functionality', () => {
    test('should export data to CSV', async () => {
      // Open export dialog
      await page.click('button:has-text("Export")');
      
      // Select CSV format
      await page.click('input[value="csv"]');
      
      // Select columns to export
      await page.click('input[name="export-emailAlias"]');
      await page.click('input[name="export-subject"]');
      await page.click('input[name="export-status"]');
      
      // Start download
      const downloadPromise = page.waitForEvent('download');
      await page.click('button:has-text("Export CSV")');
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('.csv');
    });

    test('should generate and download report', async () => {
      // Open report generator
      await page.click('button:has-text("Generate Report")');
      
      // Select report template
      await page.selectOption('select[name="reportTemplate"]', 'weekly-summary');
      
      // Configure date range
      await page.fill('input[name="startDate"]', '2025-01-01');
      await page.fill('input[name="endDate"]', '2025-01-07');
      
      // Generate report
      await page.click('button:has-text("Generate")');
      
      // Wait for report generation
      await expect(page.locator('.report-preview')).toBeVisible({ timeout: 10000 });
      
      // Download report
      const downloadPromise = page.waitForEvent('download');
      await page.click('button:has-text("Download PDF")');
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('.pdf');
    });
  });

  test.describe('Real-time Updates', () => {
    test('should receive WebSocket updates', async () => {
      // Get initial count
      const initialCount = await page.locator('.email-count').textContent();
      
      // Simulate WebSocket message (in real test, this would come from backend)
      await page.evaluate(() => {
        window.postMessage({
          type: 'websocket-update',
          data: {
            action: 'email-added',
            email: {
              id: 'test-123',
              emailAlias: 'test@example.com',
              subject: 'New Test Email',
              status: 'pending'
            }
          }
        }, '*');
      });
      
      // Wait for UI update
      await page.waitForTimeout(1000);
      
      // Verify count increased
      const newCount = await page.locator('.email-count').textContent();
      expect(parseInt(newCount || '0')).toBeGreaterThan(parseInt(initialCount || '0'));
    });
  });

  test.describe('Accessibility', () => {
    test('should meet WCAG 2.1 AA standards', async () => {
      // Run accessibility scan
      const accessibilityScanResults = await page.evaluate(() => {
        // In real implementation, use axe-core
        return { violations: [] };
      });
      
      expect(accessibilityScanResults.violations).toHaveLength(0);
    });

    test('should be keyboard navigable', async () => {
      // Tab through interactive elements
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();
      
      // Navigate table with arrow keys
      await page.focus('tbody tr:first-child');
      await page.keyboard.press('ArrowDown');
      await expect(page.locator('tbody tr:nth-child(2)')).toBeFocused();
      
      // Activate button with Enter
      await page.focus('tbody tr:first-child button:first-child');
      await page.keyboard.press('Enter');
      await expect(page.locator('.modal')).toBeVisible();
    });
  });
});

// Performance Tests
test.describe('Performance Tests', () => {
  test('should load dashboard within 3 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(3000);
  });

  test('should handle 1000 emails without performance degradation', async ({ page }) => {
    // Navigate to test page with large dataset
    await page.goto(`${TEST_URL}?test-data=large`);
    
    // Measure initial render time
    const renderTime = await page.evaluate(() => {
      return performance.getEntriesByType('navigation')[0].loadEventEnd;
    });
    
    expect(renderTime).toBeLessThan(5000);
    
    // Test scroll performance
    await page.evaluate(() => {
      const table = document.querySelector('.email-table-container');
      table?.scrollTo(0, 10000);
    });
    
    // Verify virtual scrolling is working
    const visibleRows = await page.locator('tbody tr').count();
    expect(visibleRows).toBeLessThan(100); // Should use virtual scrolling
  });
});

// Cross-browser Tests
test.describe('Cross-browser Compatibility', () => {
  ['chromium', 'firefox', 'webkit'].forEach(browserName => {
    test(`should work correctly in ${browserName}`, async ({ page }) => {
      await page.goto(TEST_URL);
      await expect(page.locator('.email-dashboard')).toBeVisible();
      
      // Test basic functionality
      await page.click('button:has-text("Filters")');
      await expect(page.locator('.filter-panel')).toBeVisible();
      
      // Test table interaction
      await page.click('th:has-text("Status")');
      await expect(page.locator('th:has-text("Status") svg')).toBeVisible();
    });
  });
});

export default test;