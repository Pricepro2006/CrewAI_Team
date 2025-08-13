#!/usr/bin/env npx tsx

/**
 * Test email dashboard after schema fixes
 * Uses Playwright to verify the dashboard loads without message_id errors
 */

import { chromium } from "@playwright/test";

async function testEmailDashboard() {
  console.log("🧪 Testing Email Dashboard after schema fixes...\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console errors
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  // Capture network errors
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log(`❌ HTTP ${response.status()} - ${response.url()}`);
    }
  });

  try {
    console.log("1. Loading email dashboard...");
    await page.goto("http://localhost:5173/email-dashboard", {
      waitUntil: "networkidle",
      timeout: 30000
    });

    // Wait for the dashboard to render
    await page.waitForTimeout(3000);

    // Check for schema-related errors
    const schemaErrors = errors.filter(err => 
      err.includes("message_id") || 
      err.includes("no column") ||
      err.includes("500")
    );

    if (schemaErrors.length > 0) {
      console.log("❌ Schema-related errors found:");
      schemaErrors.forEach(err => console.log(`   - ${err}`));
      return false;
    }

    console.log("✅ No schema errors detected");

    // Check if email data loads
    console.log("\n2. Checking if email data loads...");
    
    // Look for email rows or no-data message
    const hasEmails = await page.locator('[data-testid="email-row"], .email-row, tr[role="row"]').count() > 0;
    const hasNoDataMessage = await page.locator('text=/no emails/i').count() > 0;
    const hasLoadingIndicator = await page.locator('[data-testid="loading"], .loading-spinner').count() > 0;

    if (hasEmails) {
      const emailCount = await page.locator('[data-testid="email-row"], .email-row, tr[role="row"]').count();
      console.log(`✅ Email data loaded successfully! Found ${emailCount} emails`);
    } else if (hasNoDataMessage) {
      console.log("✅ Dashboard loaded with 'no emails' message (data query worked)");
    } else if (hasLoadingIndicator) {
      console.log("⚠️  Dashboard still loading after 3 seconds");
    } else {
      console.log("⚠️  Could not determine if emails loaded");
    }

    // Check for specific elements
    console.log("\n3. Checking dashboard elements...");
    
    const elements = [
      { selector: '[data-testid="email-stats"], .email-stats, .dashboard-stats', name: 'Email stats' },
      { selector: '[data-testid="filter-panel"], .filter-panel, .email-filters', name: 'Filter panel' },
      { selector: 'table, [role="table"], .email-list', name: 'Email table/list' }
    ];

    for (const element of elements) {
      const exists = await page.locator(element.selector).count() > 0;
      console.log(`   ${element.name}: ${exists ? '✅' : '❌'}`);
    }

    // Take a screenshot for reference
    await page.screenshot({ 
      path: 'email-dashboard-after-fix.png',
      fullPage: true 
    });
    console.log("\n📸 Screenshot saved: email-dashboard-after-fix.png");

    return schemaErrors.length === 0;

  } catch (error) {
    console.error("\n❌ Test failed:", error);
    return false;
  } finally {
    await browser.close();
  }
}

// Start the test
console.log("Starting email dashboard test...");
console.log("Make sure the development server is running (npm run dev)\n");

testEmailDashboard().then(success => {
  if (success) {
    console.log("\n✨ Email dashboard is working after schema fixes!");
    process.exit(0);
  } else {
    console.log("\n❌ Email dashboard still has issues");
    process.exit(1);
  }
});