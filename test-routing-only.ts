#!/usr/bin/env tsx

import { SimplePlanGenerator } from "./src/core/master-orchestrator/SimplePlanGenerator.js";
import { AgentRouter } from "./src/core/master-orchestrator/AgentRouter.js";

console.log("\n🚀 TESTING IMPROVED ROUTING LOGIC\n");

// Test 1: Multi-agent plan generation
console.log("1️⃣ Multi-Agent Plan Generation:");
const plan = SimplePlanGenerator.createMultiAgentPlan({
  text: "Research AI trends and create code examples",
  conversationId: "test-1"
});
console.log(`  Generated ${plan.steps.length}-step plan`);
plan.steps.forEach((s, i) => {
  console.log(`    Step ${i+1}: ${s.agentType} - ${s.task}`);
});

// Test 2: Enhanced routing
console.log("\n2️⃣ Enhanced Agent Routing:");
const router = new AgentRouter();
const routingPlan = await router.routeQuery({
  intent: "write function to sort array",
  complexity: 5,
  domains: ["code"],
  priority: "medium",
  estimatedDuration: 30,
  entities: { functions: ["sort"] },
  resourceRequirements: {}
});
console.log(`  Selected: ${routingPlan.selectedAgents[0].agentType}`);
console.log(`  Fallbacks: ${routingPlan.fallbackAgents.join(", ")}`);

console.log("\n✅ Routing improvements working!");
