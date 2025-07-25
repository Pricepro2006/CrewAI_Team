#!/usr/bin/env tsx

// Test Stage 3 without any external dependencies
import axios from "axios";

const MODEL_CONFIG = {
  models: {
    critical: "doomgrave/phi-4:14b-tools-Q3_K_S",
    primary: "llama3.2:3b",
  },
  api: {
    ollamaUrl: "http://localhost:11434",
    endpoints: {
      generate: "/api/generate",
    },
  },
  timeouts: {
    critical: 180000,
    fallback: 45000,
  },
};

class SimpleStage3 {
  private primaryModel = MODEL_CONFIG.models.critical;
  private apiUrl = `${MODEL_CONFIG.api.ollamaUrl}${MODEL_CONFIG.api.endpoints.generate}`;
  private primaryTimeout = MODEL_CONFIG.timeouts.critical;

  async analyzeEmail(email: any) {
    console.log("Analyzing email:", email.id);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log("Request timeout");
      controller.abort();
    }, 60000); // 60 second timeout for test

    try {
      const prompt = `Analyze this email: ${email.subject}`;
      console.log("Sending request to Ollama...");

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.primaryModel,
          prompt,
          stream: false,
          options: {
            temperature: 0.2,
            num_predict: 100,
          },
        },
        {
          signal: controller.signal,
          timeout: 60000,
        },
      );

      clearTimeout(timeoutId);
      console.log(
        "Response received:",
        response.data.response.substring(0, 100) + "...",
      );
      return { success: true, response: response.data.response };
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error("Error:", error.message);
      return { success: false, error: error.message };
    }
  }
}

async function test() {
  const stage3 = new SimpleStage3();
  const result = await stage3.analyzeEmail({
    id: "test-1",
    subject: "Test Email Subject",
  });

  console.log("Test result:", result);
}

test()
  .then(() => {
    console.log("Test complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Test failed:", error);
    process.exit(1);
  });
