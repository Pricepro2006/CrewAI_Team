#!/usr/bin/env tsx

/**
 * Minimal test of Stage 3 - bypass all the complex logic
 */

import axios from "axios";

async function testMinimal() {
  console.log("Testing Phi-4 directly with axios...");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await axios.post(
      "http://localhost:11434/api/generate",
      {
        model: "doomgrave/phi-4:14b-tools-Q3_K_S",
        prompt: "Test prompt",
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 50,
        },
      },
      {
        signal: controller.signal,
        timeout: 10000,
      },
    );

    clearTimeout(timeoutId);
    console.log("Response:", response.data.response);
    process.exit(0);
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("Error:", error.message);
    if (error.code === "ECONNABORTED") {
      console.error("Request timed out");
    }
    process.exit(1);
  }
}

testMinimal();
