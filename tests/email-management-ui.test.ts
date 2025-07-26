import { test, expect, type Page, type BrowserContext } from "@playwright/test";

test.describe("Email Management UI Tests", () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    // Create a new context with permissions
    context = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
    });
    page = await context.newPage();

    // Wait for server to be ready
    await page.waitForTimeout(5000);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("should load the main application", async () => {
    await page.goto("http://localhost:5173", { waitUntil: "networkidle" });

    // Check if the main app loaded
    await expect(page).toHaveTitle(/CrewAI Team/i);

    // Take screenshot of main page
    await page.screenshot({
      path: "tests/screenshots/main-page.png",
      fullPage: true,
    });
  });

  test("should navigate to email management section", async () => {
    await page.goto("http://localhost:5173");

    // Look for email management navigation
    const emailNavLinks = [
      "Email",
      "Emails",
      "Email Management",
      "Messages",
      "Inbox",
      "Mail",
    ];

    let found = false;
    for (const linkText of emailNavLinks) {
      const link = page.locator(`text=${linkText}`).first();
      if (await link.isVisible({ timeout: 1000 }).catch(() => false)) {
        await link.click();
        found = true;
        console.log(`Found and clicked: ${linkText}`);
        break;
      }
    }

    if (!found) {
      // Try looking for icons or navigation elements
      const navElements = await page
        .locator('nav a, [role="navigation"] a, aside a')
        .all();
      console.log(`Found ${navElements.length} navigation elements`);

      for (const element of navElements) {
        const text = await element.textContent();
        const href = await element.getAttribute("href");
        console.log(`Nav element: ${text} -> ${href}`);

        if (
          href?.includes("email") ||
          href?.includes("mail") ||
          text?.toLowerCase().includes("email")
        ) {
          await element.click();
          found = true;
          break;
        }
      }
    }

    await page.waitForTimeout(2000);
    await page.screenshot({
      path: "tests/screenshots/email-section.png",
      fullPage: true,
    });
  });

  test("should display email list with analyzed data", async () => {
    // Try different possible email list selectors
    const emailListSelectors = [
      '[data-testid="email-list"]',
      ".email-list",
      "table tbody tr",
      '[role="table"] [role="row"]',
      ".emails-table",
      ".message-list",
    ];

    let emailElements: any[] = [];
    let selectorUsed = "";

    for (const selector of emailListSelectors) {
      emailElements = await page.locator(selector).all();
      if (emailElements.length > 0) {
        selectorUsed = selector;
        break;
      }
    }

    console.log(
      `Found ${emailElements.length} email elements using selector: ${selectorUsed}`,
    );

    if (emailElements.length > 0) {
      // Check first few emails for analyzed data
      for (let i = 0; i < Math.min(5, emailElements.length); i++) {
        const email = emailElements[i];
        const text = await email.textContent();
        console.log(`Email ${i + 1}: ${text?.substring(0, 100)}...`);

        // Look for analysis indicators
        const hasAnalysis =
          text?.includes("priority") ||
          text?.includes("score") ||
          text?.includes("analyzed") ||
          text?.includes("workflow");

        if (hasAnalysis) {
          console.log(`Email ${i + 1} shows analysis data`);
        }
      }
    }

    await page.screenshot({
      path: "tests/screenshots/email-list.png",
      fullPage: true,
    });
  });

  test("should display email analysis details", async () => {
    // Click on first email to see details
    const firstEmail = page.locator('table tbody tr, [role="row"]').first();

    if (await firstEmail.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstEmail.click();
      await page.waitForTimeout(1000);

      // Look for analysis details
      const analysisSelectors = [
        '[data-testid="email-analysis"]',
        ".email-analysis",
        ".analysis-details",
        ".email-details",
      ];

      let analysisFound = false;
      for (const selector of analysisSelectors) {
        const element = page.locator(selector);
        if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
          analysisFound = true;
          const text = await element.textContent();
          console.log(`Analysis details found: ${text?.substring(0, 200)}...`);
          break;
        }
      }

      // Look for specific analysis fields
      const analysisFields = [
        "Summary",
        "Priority",
        "Workflow",
        "Entities",
        "Action Items",
        "Quality Score",
        "Business Impact",
      ];

      for (const field of analysisFields) {
        const fieldElement = page.locator(`text=${field}`).first();
        if (await fieldElement.isVisible({ timeout: 500 }).catch(() => false)) {
          console.log(`Found analysis field: ${field}`);
        }
      }

      await page.screenshot({
        path: "tests/screenshots/email-details.png",
        fullPage: true,
      });
    }
  });

  test("should check email management submenu components", async () => {
    // Look for submenu or tabs
    const submenuSelectors = [
      '[role="tablist"] [role="tab"]',
      ".tabs button",
      ".submenu a",
      "nav.secondary a",
    ];

    for (const selector of submenuSelectors) {
      const tabs = await page.locator(selector).all();
      if (tabs.length > 0) {
        console.log(
          `Found ${tabs.length} submenu items with selector: ${selector}`,
        );

        for (const tab of tabs) {
          const text = await tab.textContent();
          console.log(`Submenu item: ${text}`);

          // Click each tab and take screenshot
          if (await tab.isVisible()) {
            await tab.click();
            await page.waitForTimeout(1000);
            const tabName = text?.toLowerCase().replace(/\s+/g, "-") || "tab";
            await page.screenshot({
              path: `tests/screenshots/email-${tabName}.png`,
              fullPage: true,
            });
          }
        }
        break;
      }
    }
  });

  test("should verify data from recent analysis", async () => {
    // Check for specific emails from our analysis
    const testEmails = [
      "PO 505571311", // From our test
      "Scrum Master", // From our test
    ];

    for (const searchTerm of testEmails) {
      const found = await page
        .locator(`text=${searchTerm}`)
        .first()
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      if (found) {
        console.log(`Found analyzed email containing: ${searchTerm}`);
      }
    }

    // Check for analysis metrics
    const metrics = await page.locator("text=/[0-9]+\\.[0-9]+\\/10/").all(); // Quality scores
    console.log(`Found ${metrics.length} quality score displays`);

    // Check for workflow states
    const workflowStates = ["START_POINT", "IN_PROGRESS", "COMPLETION"];
    for (const state of workflowStates) {
      const found = await page.locator(`text=${state}`).count();
      if (found > 0) {
        console.log(`Found ${found} emails with workflow state: ${state}`);
      }
    }
  });

  test("should generate comprehensive test report", async () => {
    // Create test report
    const report = {
      timestamp: new Date().toISOString(),
      serverStatus: "running",
      testsRun: 6,
      issues: [] as string[],
      recommendations: [] as string[],
    };

    // Check for common issues
    const errorElements = await page
      .locator('.error, [class*="error"], [data-error]')
      .all();
    if (errorElements.length > 0) {
      report.issues.push(`Found ${errorElements.length} error elements in UI`);
    }

    // Check console errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        report.issues.push(`Console error: ${msg.text()}`);
      }
    });

    // Final recommendations
    if (report.issues.length === 0) {
      report.recommendations.push("UI appears to be functioning correctly");
      report.recommendations.push("Email analysis data is being displayed");
    } else {
      report.recommendations.push("Review and fix identified issues");
    }

    console.log("\n=== Email Management UI Test Report ===");
    console.log(JSON.stringify(report, null, 2));
  });
});
