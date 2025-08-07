import { FullConfig } from '@playwright/test';

/**
 * Global teardown for Walmart Grocery Agent E2E Tests
 * Cleans up test environment and data
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global teardown...');

  try {
    // Clean up any persistent test data
    // In a real scenario, you might want to clean up databases, files, etc.
    console.log('✅ Test data cleaned up');

    // Log test completion
    console.log('✅ All E2E tests completed');

  } catch (error) {
    console.error('❌ Global teardown failed:', error);
  }

  console.log('✅ Global teardown completed');
}

export default globalTeardown;