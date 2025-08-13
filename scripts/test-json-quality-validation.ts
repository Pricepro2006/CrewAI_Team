#!/usr/bin/env tsx

/**
 * Test JSON Quality Validation - Critical Pre-Deployment Check
 * This validates that successful JSON parsing doesn't degrade quality
 */

import chalk from "chalk";

interface Phase2Response {
  workflow_validation: string;
  missed_entities: {
    project_names?: string[];
    company_names?: string[];
  };
  action_items?: any[];
  sentiment?: string;
  confidence: number;
  risk_assessment?: string;
}

// Example of HIGH-QUALITY fallback response (current system)
const HIGH_QUALITY_FALLBACK: Phase2Response = {
  workflow_validation:
    "Confirmed: QUOTE_REQUEST - Customer requesting detailed pricing information",
  missed_entities: {
    project_names: ["Project Alpha", "Q4 Initiative"],
    company_names: ["Acme Corp", "Tech Solutions Ltd"],
  },
  action_items: [
    { action: "Send quote", priority: "high", deadline: "2025-02-03" },
  ],
  sentiment: "professional",
  confidence: 0.5,
  risk_assessment: "Medium - Quote deadline approaching",
};

// Examples of potentially LOW-QUALITY LLM responses that would now parse successfully
const LOW_QUALITY_LLM_RESPONSES = [
  {
    // Generic, low-value response
    workflow_validation: "yes",
    missed_entities: {},
    confidence: 0.9,
    risk_assessment: "normal",
  },
  {
    // Overconfident with minimal analysis
    workflow_validation: "This is a business email",
    missed_entities: { project_names: [], company_names: [] },
    confidence: 0.95,
    sentiment: "positive",
  },
  {
    // Technically valid but useless
    workflow_validation: "Email processed",
    missed_entities: {},
    action_items: [],
    confidence: 1.0,
  },
];

function calculateQualityScore(response: Phase2Response): number {
  let score = 0;

  // Workflow validation quality (0-3 points)
  if (
    response.workflow_validation.length > 20 &&
    response.workflow_validation.includes(":")
  ) {
    score += 3;
  } else if (response.workflow_validation.length > 10) {
    score += 1;
  }

  // Entity extraction (0-3 points)
  const totalEntities =
    (response.missed_entities.project_names?.length || 0) +
    (response.missed_entities.company_names?.length || 0);
  if (totalEntities >= 2) score += 3;
  else if (totalEntities >= 1) score += 1;

  // Confidence reasonableness (0-2 points)
  if (response.confidence >= 0.3 && response.confidence <= 0.7) {
    score += 2; // Reasonable confidence
  } else if (response.confidence > 0.9) {
    score -= 1; // Overconfident penalty
  }

  // Risk assessment quality (0-2 points)
  if (response.risk_assessment && response.risk_assessment.length > 15) {
    score += 2;
  }

  return score / 10; // Normalize to 0-1
}

console.log(chalk.blue.bold("\n🔍 JSON Quality Validation Test\n"));
console.log(
  chalk.yellow("Testing if JSON parsing fixes might LOWER quality...\n"),
);

// Test 1: Compare fallback quality
console.log(chalk.cyan("1. High-Quality Fallback (Current System):"));
const fallbackScore = calculateQualityScore(HIGH_QUALITY_FALLBACK);
console.log(
  `   Quality Score: ${chalk.green((fallbackScore * 10).toFixed(1))}/10`,
);
console.log(
  `   Details: ${HIGH_QUALITY_FALLBACK.workflow_validation.substring(0, 50)}...`,
);

// Test 2: Test low-quality LLM responses
console.log(chalk.cyan("\n2. Low-Quality LLM Responses (Would Now Parse):"));
let totalLowQualityScore = 0;
LOW_QUALITY_LLM_RESPONSES.forEach((response, i) => {
  const score = calculateQualityScore(response);
  totalLowQualityScore += score;
  console.log(
    `   Response ${i + 1} Score: ${chalk.red((score * 10).toFixed(1))}/10`,
  );
  console.log(`   - Validation: "${response.workflow_validation}"`);
  console.log(
    `   - Confidence: ${response.confidence} ${response.confidence > 0.9 ? chalk.red("(overconfident!)") : ""}`,
  );
});

const avgLowQualityScore =
  totalLowQualityScore / LOW_QUALITY_LLM_RESPONSES.length;

// Calculate impact
const qualityDegradation =
  ((fallbackScore - avgLowQualityScore) / fallbackScore) * 100;

console.log(chalk.blue.bold("\n📊 Quality Impact Analysis:\n"));
console.log(
  `Current Fallback Quality: ${chalk.green((fallbackScore * 10).toFixed(1))}/10`,
);
console.log(
  `Average LLM Response Quality: ${chalk.red((avgLowQualityScore * 10).toFixed(1))}/10`,
);
console.log(
  `Quality Degradation: ${chalk.red(qualityDegradation.toFixed(0) + "%")} WORSE`,
);

// Risk assessment
console.log(chalk.yellow.bold("\n⚠️  Risk Assessment:"));
if (qualityDegradation > 50) {
  console.log(
    chalk.red.bold(
      "CRITICAL RISK: JSON parsing fixes will significantly degrade quality!",
    ),
  );
  console.log(
    chalk.red(
      "- Low-quality LLM responses will replace high-quality fallbacks",
    ),
  );
  console.log(
    chalk.red("- System will appear to work better but actually perform worse"),
  );
  console.log(chalk.red("- Baseline scores will DROP, not improve"));
} else if (qualityDegradation > 20) {
  console.log(chalk.yellow("MODERATE RISK: Some quality degradation expected"));
} else {
  console.log(chalk.green("LOW RISK: Minimal quality impact"));
}

// Recommendations
console.log(chalk.blue.bold("\n🛡️  Mitigation Recommendations:"));
console.log("1. Add content quality validation BEFORE accepting parsed JSON");
console.log("2. Keep fallback logic for low-quality responses");
console.log("3. Set minimum thresholds for workflow validation length");
console.log("4. Penalize overconfident responses (>0.9 confidence)");
console.log("5. A/B test with and without JSON fixes to measure real impact");

console.log(chalk.yellow.bold("\n⚡ CRITICAL ACTION REQUIRED:"));
console.log(
  chalk.yellow("DO NOT deploy JSON parsing fixes without quality validation!"),
);
