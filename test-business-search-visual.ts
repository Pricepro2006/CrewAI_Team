#!/usr/bin/env ts-node

import { MasterOrchestrator } from "./src/core/orchestration/MasterOrchestrator";
import type { TaskContext } from "./src/core/tasks/types";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Visual test for business search functionality with SearXNG
 * This test will show the entire flow of searching for irrigation specialists
 */
async function testBusinessSearch() {
  console.log("🔍 Starting Business Search Visual Test with SearXNG");
  console.log("=".repeat(80));

  // Initialize the orchestrator
  const orchestrator = new MasterOrchestrator();

  // The irrigation specialist query
  const query = `Find irrigation specialists to assist with a cracked, leaking sprinkler head from a root growing into the irrigation piping, for the area surrounding 278 Wycliff Dr. Spartanburg, SC 29301. They need to be able to travel to this location and if you can include initial visit costs, add that information as well.`;

  console.log("\n📝 Query:");
  console.log(query);
  console.log("\n" + "-".repeat(80));

  try {
    // Create context
    const context: TaskContext = {
      taskId: `test-${Date.now()}`,
      userId: "test-user",
      sessionId: "test-session",
      priority: "high",
      metadata: {
        testType: "business-search",
        searchProvider: "SearXNG",
      },
    };

    console.log("\n🚀 Executing search through MasterOrchestrator...");
    console.log("📡 Primary Search Provider: SearXNG (port 8888)");
    console.log("💾 Results will be saved to master_knowledge_base");
    console.log("\n" + "-".repeat(80));

    // Execute the query
    const startTime = Date.now();
    const result = await orchestrator.processUserQuery(query, context);
    const duration = (Date.now() - startTime) / 1000;

    console.log(`\n⏱️  Execution Time: ${duration.toFixed(1)}s`);
    console.log("\n" + "=".repeat(80));
    console.log("📊 RESULTS:");
    console.log("=".repeat(80));

    // Display the response
    console.log("\n📋 Response:");
    console.log(result.response);

    // Check if search results were saved
    console.log("\n" + "-".repeat(80));
    console.log("💾 Knowledge Base Integration:");

    try {
      const searchLogPath = path.join(
        __dirname,
        "master_knowledge_base",
        "search_log.jsonl",
      );
      const logExists = await fs
        .access(searchLogPath)
        .then(() => true)
        .catch(() => false);

      if (logExists) {
        const logContent = await fs.readFile(searchLogPath, "utf-8");
        const searches = logContent.split("\n").filter((line) => line.trim());
        console.log(`✅ Search log contains ${searches.length} searches`);

        // Show the most recent search
        if (searches.length > 0) {
          const lastSearch = JSON.parse(searches[searches.length - 1]);
          console.log(`\n📍 Latest search saved:`);
          console.log(`   Query: "${lastSearch.query}"`);
          console.log(`   Provider: ${lastSearch.provider}`);
          console.log(`   Results: ${lastSearch.results.length}`);
          console.log(`   Timestamp: ${lastSearch.timestamp}`);
        }
      } else {
        console.log(
          "⚠️  Search log not found - knowledge base may not be initialized",
        );
      }
    } catch (error) {
      console.log("⚠️  Could not read search log:", error);
    }

    // Analyze the response for business value
    console.log("\n" + "-".repeat(80));
    console.log("🎯 Business Value Analysis:");

    const responseText = result.response.toLowerCase();
    const checks = {
      "Location Specific": /spartanburg|29301|south carolina|\bsc\b/.test(
        responseText,
      ),
      "Problem Understanding": /root|crack|leak|sprinkler|irrigation/.test(
        responseText,
      ),
      "Business Names":
        /[A-Z][a-z]+\s+(Irrigation|Landscaping|Plumbing|Services?)/.test(
          result.response,
        ),
      "Contact Info":
        /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|call|phone|email|website/.test(
          responseText,
        ),
      "Cost Information": /\$\d+|cost|price|fee|charge|estimate|quote/.test(
        responseText,
      ),
      "Service Area": /travel|service area|mile|radius|serve/.test(
        responseText,
      ),
      Recommendations: /recommend|suggest|consider|best|top/.test(responseText),
    };

    let score = 0;
    for (const [criterion, passed] of Object.entries(checks)) {
      console.log(`${passed ? "✅" : "❌"} ${criterion}`);
      if (passed) score++;
    }

    console.log(`\n📊 Score: ${score}/${Object.keys(checks).length}`);

    // Show execution plan if available
    if (result.executionPlan) {
      console.log("\n" + "-".repeat(80));
      console.log("📋 Execution Plan:");
      result.executionPlan.steps.forEach((step, index) => {
        console.log(`${index + 1}. ${step.description} (${step.agent})`);
      });
    }

    // Save detailed results
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const resultFile = `business-search-test-${timestamp}.json`;
    await fs.writeFile(
      resultFile,
      JSON.stringify(
        {
          query,
          response: result.response,
          duration,
          score,
          checks,
          executionPlan: result.executionPlan,
          metadata: result.metadata,
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
    );

    console.log("\n" + "=".repeat(80));
    console.log(`✅ Test completed! Full results saved to: ${resultFile}`);
    console.log("=".repeat(80));
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    console.error(error);
  }
}

// Run the test
console.log("🚀 CrewAI Business Search Test with SearXNG Integration");
console.log(
  "📍 This test demonstrates the full search flow with knowledge base caching",
);
console.log("");

testBusinessSearch().catch(console.error);
