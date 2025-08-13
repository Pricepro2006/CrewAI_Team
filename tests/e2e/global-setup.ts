import { chromium, FullConfig } from '@playwright/test';

/**
 * Global setup for Walmart Grocery Agent E2E Tests
 * Initializes test environment and creates necessary data
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup for E2E tests...');

  const { baseURL } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Wait for the application to be ready
    console.log('⏳ Waiting for application to start...');
    await page.goto(baseURL || 'http://localhost:5173', { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });

    // Verify that the main application loads
    await page.waitForSelector('body', { timeout: 30000 });
    console.log('✅ Application is ready');

    // Check if backend API is available
    try {
      const response = await page.evaluate(async () => {
        const res = await fetch('http://localhost:3000/api/health');
        return { status: res.status, ok: res.ok };
      });
      
      if (response.ok) {
        console.log('✅ Backend API is available');
      } else {
        console.log('⚠️ Backend API returned non-200 status:', response.status);
      }
    } catch (error) {
      console.log('⚠️ Backend API check failed:', error);
    }

    // Setup test data and mock services
    await page.evaluate(() => {
      // Create mock localStorage data for tests
      localStorage.setItem('walmart-test-setup', 'true');
      localStorage.setItem('walmart-grocery-list', JSON.stringify({
        items: [
          { id: 'test-1', name: 'Test Milk', price: 3.99, category: 'Dairy', added: new Date().toISOString() },
          { id: 'test-2', name: 'Test Bread', price: 2.49, category: 'Bakery', added: new Date().toISOString() },
        ],
        total: 6.48
      }));
      
      // Mock user preferences
      localStorage.setItem('walmart-user-prefs', JSON.stringify({
        zipCode: '29301',
        store: 'Walmart Supercenter - Spartanburg',
        budgetLimit: 200,
        notifications: true
      }));
    });

    console.log('✅ Test data initialized');

  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }

  console.log('✅ Global setup completed successfully');
}

export default globalSetup;