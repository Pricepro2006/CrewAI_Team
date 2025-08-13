#!/usr/bin/env node

/**
 * Script to test security headers
 * Usage: tsx scripts/test-security-headers.ts
 */

import http from "http";

interface TestEndpoint {
  path: string;
  method: string;
  headers?: Record<string, string>;
}

const testEndpoints: TestEndpoint[] = [
  { path: "/health", method: "GET" },
  {
    path: "/api/test",
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
    },
  },
];

function testSecurityHeaders(endpoint: TestEndpoint): Promise<void> {
  const options = {
    hostname: "localhost",
    port: 3001,
    path: endpoint.path,
    method: endpoint.method,
    headers: endpoint.headers || {},
  };

  return new Promise<void>((resolve, reject) => {
    const req = http.request(options, (res) => {
      console.log(`\n=== Testing ${endpoint.method} ${endpoint.path} ===`);
      console.log(`Status: ${res.statusCode}`);
      console.log("\nSecurity Headers:");

      const securityHeaders: string[] = [
        "content-security-policy",
        "x-frame-options",
        "x-content-type-options",
        "x-xss-protection",
        "strict-transport-security",
        "referrer-policy",
        "permissions-policy",
        "access-control-allow-origin",
        "access-control-allow-credentials",
        "x-powered-by",
        "server",
      ];

      securityHeaders.forEach((header: string) => {
        const value = res.headers[header];
        if (value) {
          console.log(`✓ ${header}: ${value}`);
        } else if (header === "x-powered-by" || header === "server") {
          console.log(`✓ ${header}: [REMOVED - Good!]`);
        } else if (
          header === "strict-transport-security" &&
          process.env.NODE_ENV !== "production"
        ) {
          console.log(`- ${header}: [Not set in development]`);
        } else if (
          header.startsWith("access-control-") &&
          endpoint.method !== "OPTIONS" &&
          !endpoint.headers?.Origin
        ) {
          console.log(`- ${header}: [No CORS headers for non-CORS request]`);
        } else {
          console.log(`✗ ${header}: [MISSING]`);
        }
      });

      resolve();
    });

    req.on("error", (e) => {
      console.error(
        `Problem with request: ${e instanceof Error ? e.message : String(e)}`,
      );
      reject(e);
    });

    req.end();
  });
}

async function runTests(): Promise<void> {
  console.log("Testing Security Headers Implementation");
  console.log("======================================");
  console.log(`Server: http://localhost:3001`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

  try {
    for (const endpoint of testEndpoints) {
      await testSecurityHeaders(endpoint);
    }

    console.log("\n✅ Security headers test completed!");
    console.log("\nRecommendations:");
    console.log("- Ensure all required security headers are present");
    console.log("- Review CSP directives for your specific needs");
    console.log("- Enable HSTS in production environment");
    console.log("- Configure ALLOWED_ORIGINS for production domains");
  } catch (error) {
    console.error(
      "\n❌ Test failed:",
      error instanceof Error ? error.message : String(error),
    );
    console.error("Make sure the server is running on port 3001");
    process.exit(1);
  }
}

// Run the tests
runTests();
