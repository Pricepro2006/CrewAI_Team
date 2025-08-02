#!/usr/bin/env tsx

import { Ollama } from "ollama";
import chalk from "chalk";

async function testJsonFormat() {
  const ollama = new Ollama({ host: "http://localhost:11434" });

  console.log(chalk.cyan("\n🧪 Testing Ollama JSON Format\n"));

  const testCases = [
    {
      name: "Simple Math",
      prompt: 'What is 2+2? Respond with JSON: {"answer": <number>}',
    },
    {
      name: "Email Analysis",
      prompt: `Analyze this email and respond in JSON format:
Subject: Quote Request for 100 units
Body: Please provide pricing for 100 units of product ABC.

Provide: {"topic": "string", "priority": "high/medium/low", "action": "string"}`,
    },
  ];

  for (const test of testCases) {
    console.log(chalk.yellow(`\nTest: ${test.name}`));
    console.log(`Prompt: ${test.prompt.substring(0, 50)}...`);

    try {
      const startTime = Date.now();

      // Test without format parameter
      console.log(chalk.gray('\nWithout format="json":'));
      const response1 = await ollama.generate({
        model: "llama3.2:3b",
        prompt: test.prompt,
        stream: false,
        options: {
          temperature: 0.1,
          max_tokens: 100,
        },
      });

      console.log("Response:", response1.response.substring(0, 100));
      try {
        const parsed1 = JSON.parse(response1.response);
        console.log(chalk.green("✓ Valid JSON"));
      } catch {
        console.log(chalk.red("✗ Invalid JSON"));
      }

      // Test with format parameter
      console.log(chalk.gray('\nWith format="json":'));
      const response2 = await ollama.generate({
        model: "llama3.2:3b",
        prompt: test.prompt,
        stream: false,
        format: "json",
        options: {
          temperature: 0.1,
          max_tokens: 100,
        },
      });

      console.log("Response:", response2.response.substring(0, 100));
      try {
        const parsed2 = JSON.parse(response2.response);
        console.log(chalk.green("✓ Valid JSON"));
        console.log("Parsed:", parsed2);
      } catch {
        console.log(chalk.red("✗ Invalid JSON"));
      }

      const elapsed = Date.now() - startTime;
      console.log(chalk.dim(`Time: ${elapsed}ms`));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
  }

  console.log(chalk.green("\n✅ Test complete!\n"));
}

testJsonFormat().catch(console.error);
