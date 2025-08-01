#!/usr/bin/env node

/**
 * Test script to verify frontend functionality with security headers
 * Tests CORS, CSP, and other security configurations
 */

import fetch from "node-fetch";
import WebSocket from "ws";
import { spawn } from "child_process";

const API_URL = "http://localhost:3001";
const WS_URL = "ws://localhost:3002/trpc-ws";
const FRONTEND_URL = "http://localhost:5173";

type ColorKey = "green" | "red" | "yellow" | "blue" | "reset";

const colors: Record<ColorKey, string> = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
};

function log(message: string, color: ColorKey = "reset"): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testCORS(): Promise<void> {
  log("\n🔍 Testing CORS Configuration...", "blue");

  try {
    // Test preflight request
    const preflightResponse = await fetch(`${API_URL}/trpc`, {
      method: "OPTIONS",
      headers: {
        Origin: FRONTEND_URL,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,x-csrf-token",
      },
    });

    const corsHeaders = {
      "access-control-allow-origin": preflightResponse.headers.get(
        "access-control-allow-origin",
      ),
      "access-control-allow-credentials": preflightResponse.headers.get(
        "access-control-allow-credentials",
      ),
      "access-control-allow-methods": preflightResponse.headers.get(
        "access-control-allow-methods",
      ),
      "access-control-allow-headers": preflightResponse.headers.get(
        "access-control-allow-headers",
      ),
    };

    log("✅ CORS Preflight Response:", "green");
    Object.entries(corsHeaders).forEach(([key, value]) => {
      log(`  ${key}: ${value}`);
    });

    // Test actual request
    const actualResponse = await fetch(`${API_URL}/health`, {
      headers: {
        Origin: FRONTEND_URL,
      },
    });

    if (actualResponse.headers.get("access-control-allow-origin")) {
      log("✅ CORS headers present on actual request", "green");
    } else {
      log("❌ CORS headers missing on actual request", "red");
    }
  } catch (error) {
    log(
      `❌ CORS test failed: ${error instanceof Error ? error.message : String(error)}`,
      "red",
    );
  }
}

async function testCSP(): Promise<void> {
  log("\n🔍 Testing CSP Configuration...", "blue");

  try {
    const response = await fetch(`${API_URL}/health`);
    const cspHeader = response.headers.get("content-security-policy");

    if (cspHeader) {
      log("✅ CSP Header Present:", "green");

      // Parse and display CSP directives
      const directives = cspHeader.split(";").map((d) => d.trim());
      directives.forEach((directive) => {
        if (directive) {
          const [name, ...values] = directive.split(" ");
          log(`  ${name}`, "yellow");

          // Check for important sources
          if (name === "connect-src" && values.includes("ws://localhost:*")) {
            log("    ✅ WebSocket sources allowed", "green");
          }
          if (
            name === "script-src" &&
            process.env.NODE_ENV === "development" &&
            values.includes("'unsafe-inline'")
          ) {
            log("    ✅ Development mode scripts allowed", "green");
          }
        }
      });
    } else {
      log("❌ CSP header missing", "red");
    }
  } catch (error) {
    log(
      `❌ CSP test failed: ${error instanceof Error ? error.message : String(error)}`,
      "red",
    );
  }
}

async function testWebSocket(): Promise<void> {
  log("\n🔍 Testing WebSocket Connection...", "blue");

  return new Promise<void>((resolve) => {
    const ws = new WebSocket(WS_URL, {
      headers: {
        Origin: FRONTEND_URL,
      },
    });

    ws.on("open", () => {
      log("✅ WebSocket connection established", "green");
      ws.close();
      resolve();
    });

    ws.on("error", (error) => {
      log(`❌ WebSocket connection failed: ${error.message}`, "red");
      resolve();
    });

    ws.on("unexpected-response", (request, response) => {
      log(
        `❌ WebSocket unexpected response: ${response.statusCode} ${response.statusMessage}`,
        "red",
      );
      resolve();
    });

    setTimeout(() => {
      ws.close();
      resolve();
    }, 5000);
  });
}

async function testSecurityHeaders(): Promise<void> {
  log("\n🔍 Testing Security Headers...", "blue");

  try {
    const response = await fetch(`${API_URL}/health`);

    const securityHeaders = {
      "X-Frame-Options": response.headers.get("x-frame-options"),
      "X-Content-Type-Options": response.headers.get("x-content-type-options"),
      "X-XSS-Protection": response.headers.get("x-xss-protection"),
      "Referrer-Policy": response.headers.get("referrer-policy"),
      "Permissions-Policy": response.headers.get("permissions-policy"),
      "Strict-Transport-Security": response.headers.get(
        "strict-transport-security",
      ),
    };

    Object.entries(securityHeaders).forEach(([header, value]) => {
      if (value) {
        log(`✅ ${header}: ${value}`, "green");
      } else {
        log(`⚠️  ${header}: not set`, "yellow");
      }
    });

    // Check for headers that should be removed
    const dangerousHeaders = ["X-Powered-By", "Server"];
    dangerousHeaders.forEach((header) => {
      if (response.headers.get(header.toLowerCase())) {
        log(`❌ ${header} should be removed`, "red");
      } else {
        log(`✅ ${header} removed`, "green");
      }
    });
  } catch (error) {
    log(
      `❌ Security headers test failed: ${error instanceof Error ? error.message : String(error)}`,
      "red",
    );
  }
}

async function testCSRFIntegration(): Promise<void> {
  log("\n🔍 Testing CSRF Integration...", "blue");

  try {
    // First get CSRF token
    const tokenResponse = await fetch(`${API_URL}/api/csrf/token`, {
      headers: {
        Origin: FRONTEND_URL,
        Cookie: "",
      },
    });

    if (tokenResponse.ok) {
      const data = (await tokenResponse.json()) as { token: string };
      const { token } = data;
      log(`✅ CSRF token obtained: ${token.substring(0, 10)}...`, "green");

      // Test API call with CSRF token
      const apiResponse = await fetch(`${API_URL}/trpc/health.check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
          Origin: FRONTEND_URL,
          Cookie: "",
        },
        body: JSON.stringify({}),
      });

      if (apiResponse.ok) {
        log("✅ API call with CSRF token successful", "green");
      } else {
        log(`⚠️  API call returned ${apiResponse.status}`, "yellow");
      }
    } else {
      log("❌ Failed to obtain CSRF token", "red");
    }
  } catch (error) {
    log(
      `❌ CSRF test failed: ${error instanceof Error ? error.message : String(error)}`,
      "red",
    );
  }
}

async function runAllTests(): Promise<void> {
  log("🚀 Starting Frontend Security Tests...", "blue");
  log("================================", "blue");

  // Check if server is running
  try {
    await fetch(`${API_URL}/health`);
  } catch (error) {
    log("❌ Server is not running. Please start the server first.", "red");
    process.exit(1);
  }

  await testCORS();
  await testCSP();
  await testSecurityHeaders();
  await testWebSocket();
  await testCSRFIntegration();

  log("\n================================", "blue");
  log("✅ Frontend Security Tests Complete!", "green");
}

// Run tests
runAllTests().catch(console.error);
