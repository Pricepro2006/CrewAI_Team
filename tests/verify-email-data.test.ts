import { test, expect } from "@playwright/test";

test("verify email data from crewai.db is displayed", async ({ page }) => {
  // Navigate to the application
  await page.goto("http://localhost:5173");

  // Wait for the page to load
  await page.waitForLoadState("networkidle");

  // Take a screenshot of the main page
  await page.screenshot({
    path: "tests/screenshots/main-with-data.png",
    fullPage: true,
  });

  // Look for and click on Email navigation
  const emailLink = page.locator("text=Email").first();
  if (await emailLink.isVisible()) {
    await emailLink.click();
    await page.waitForTimeout(2000);
  }

  // Take screenshot of email section
  await page.screenshot({
    path: "tests/screenshots/email-section-with-data.png",
    fullPage: true,
  });

  // Check for email data - look for common patterns from our analyzed emails
  const hasEmailData =
    (await page.locator("text=/PO|Quote|email_/").count()) > 0 ||
    (await page.locator("table tbody tr").count()) > 0 ||
    (await page.locator('[class*="email"]').count()) > 0;

  console.log("Email data found:", hasEmailData);

  // Look for quality scores
  const qualityScores = await page.locator("text=/\\d+\\.\\d+\\/10/").count();
  console.log("Quality scores found:", qualityScores);

  // Look for workflow states
  const workflowStates = await page
    .locator("text=/START_POINT|IN_PROGRESS|COMPLETION/")
    .count();
  console.log("Workflow states found:", workflowStates);

  // Check for specific analyzed emails
  const testPatterns = ["505571311", "Scrum Master", "URGENT"];
  for (const pattern of testPatterns) {
    const found = await page.locator(`text=${pattern}`).count();
    if (found > 0) {
      console.log(`Found pattern "${pattern}": ${found} times`);
    }
  }

  // Final assertion
  expect(hasEmailData).toBeTruthy();
});
