#!/usr/bin/env node

/**
 * Configuration Script for Quality Validation Framework
 *
 * This script demonstrates how to configure and monitor the quality validation
 * framework in production environments.
 */

import { emailAnalysisService } from "../src/core/services/EmailThreePhaseAnalysisService.js";
import { Logger } from "../src/utils/logger.js";

const logger = new Logger("QualityFrameworkConfig");

interface QualityProfile {
  name: string;
  description: string;
  config: {
    minimumQualityThreshold: number;
    confidenceThreshold: number;
    workflowValidationMinLength: number;
    entityExtractionMinCount: number;
    suspiciousConfidenceThreshold: number;
    enableHybridByDefault: boolean;
    enableQualityLogging: boolean;
  };
  useCase: string;
}

/**
 * Predefined quality profiles for different environments and use cases
 */
const QUALITY_PROFILES: QualityProfile[] = [
  {
    name: "production_strict",
    description: "Strict quality requirements for production environment",
    config: {
      minimumQualityThreshold: 7.0,
      confidenceThreshold: 0.7,
      workflowValidationMinLength: 30,
      entityExtractionMinCount: 1,
      suspiciousConfidenceThreshold: 0.9,
      enableHybridByDefault: true,
      enableQualityLogging: false, // Reduce logging overhead in production
    },
    useCase:
      "High-volume production environment with strict quality requirements",
  },

  {
    name: "production_balanced",
    description: "Balanced quality and performance for production",
    config: {
      minimumQualityThreshold: 6.0,
      confidenceThreshold: 0.65,
      workflowValidationMinLength: 20,
      entityExtractionMinCount: 1,
      suspiciousConfidenceThreshold: 0.95,
      enableHybridByDefault: true,
      enableQualityLogging: false,
    },
    useCase:
      "Standard production environment balancing quality and performance",
  },

  {
    name: "development_verbose",
    description: "Verbose logging and moderate thresholds for development",
    config: {
      minimumQualityThreshold: 5.0,
      confidenceThreshold: 0.6,
      workflowValidationMinLength: 15,
      entityExtractionMinCount: 0,
      suspiciousConfidenceThreshold: 0.98,
      enableHybridByDefault: true,
      enableQualityLogging: true, // Full logging for development
    },
    useCase: "Development environment with detailed logging for debugging",
  },

  {
    name: "testing_permissive",
    description: "Permissive settings for testing and evaluation",
    config: {
      minimumQualityThreshold: 4.0,
      confidenceThreshold: 0.5,
      workflowValidationMinLength: 10,
      entityExtractionMinCount: 0,
      suspiciousConfidenceThreshold: 0.99,
      enableHybridByDefault: false, // Test pure LLM vs fallback
      enableQualityLogging: true,
    },
    useCase: "Testing environment for evaluating LLM performance",
  },

  {
    name: "critical_systems",
    description: "Ultra-strict requirements for critical business systems",
    config: {
      minimumQualityThreshold: 8.0,
      confidenceThreshold: 0.8,
      workflowValidationMinLength: 40,
      entityExtractionMinCount: 2,
      suspiciousConfidenceThreshold: 0.85,
      enableHybridByDefault: true,
      enableQualityLogging: true,
    },
    useCase: "Critical business systems requiring highest quality analysis",
  },
];

/**
 * Apply a quality profile to the email analysis service
 */
function applyQualityProfile(profileName: string): void {
  const profile = QUALITY_PROFILES.find((p) => p.name === profileName);

  if (!profile) {
    logger.error(`Quality profile '${profileName}' not found`);
    logger.info("Available profiles:");
    QUALITY_PROFILES.forEach((p) => {
      logger.info(`  - ${p.name}: ${p.description}`);
    });
    process.exit(1);
  }

  logger.info(`Applying quality profile: ${profile.name}`);
  logger.info(`Description: ${profile.description}`);
  logger.info(`Use case: ${profile.useCase}`);

  emailAnalysisService.updateQualityConfig(profile.config);

  logger.info("Quality configuration updated successfully!");

  // Log the applied configuration
  logger.info("\nApplied Configuration:");
  Object.entries(profile.config).forEach(([key, value]) => {
    logger.info(`  ${key}: ${value}`);
  });
}

/**
 * Monitor quality metrics and provide recommendations
 */
async function monitorQualityMetrics(): Promise<void> {
  logger.info("\n=== Quality Metrics Monitor ===");

  const metrics = emailAnalysisService.getQualityMetrics();

  logger.info("Current Quality Metrics:");
  logger.info(`  Total Responses: ${metrics.totalResponses}`);
  logger.info(`  High Quality Rate: ${metrics.highQualityRate.toFixed(1)}%`);
  logger.info(
    `  Average Quality Score: ${metrics.averageQualityScore.toFixed(2)}/10`,
  );
  logger.info(`  Fallback Usage: ${metrics.fallbackRate.toFixed(1)}%`);
  logger.info(`  Hybrid Usage: ${metrics.hybridRate.toFixed(1)}%`);
  logger.info(`  Quality Threshold Misses: ${metrics.qualityThresholdMisses}`);

  // Provide recommendations based on metrics
  logger.info("\n=== Recommendations ===");

  if (metrics.totalResponses === 0) {
    logger.info(
      "💡 No responses processed yet. Start processing emails to see metrics.",
    );
    return;
  }

  if (metrics.highQualityRate < 60) {
    logger.warn("⚠️  Low high-quality response rate. Consider:");
    logger.warn("   - Lowering quality threshold");
    logger.warn("   - Enabling hybrid approach");
    logger.warn("   - Reviewing LLM prompt quality");
  }

  if (metrics.fallbackRate > 40) {
    logger.warn("⚠️  High fallback usage. Consider:");
    logger.warn("   - Lowering quality threshold");
    logger.warn("   - Improving LLM prompts");
    logger.warn("   - Enabling hybrid approach");
  }

  if (metrics.hybridRate > 60) {
    logger.info(
      "💡 High hybrid usage indicates quality framework is working well",
    );
  }

  if (metrics.averageQualityScore < 5.0) {
    logger.error(
      "🚨 Very low average quality score. Immediate attention needed:",
    );
    logger.error("   - Review LLM model performance");
    logger.error("   - Check prompt engineering");
    logger.error("   - Validate input data quality");
  } else if (metrics.averageQualityScore > 8.0) {
    logger.info("✅ Excellent average quality score!");
  }
}

/**
 * Run A/B test comparison between different quality configurations
 */
async function runABTest(): Promise<void> {
  logger.info("\n=== A/B Test Configuration ===");
  logger.info(
    "This demonstrates how to set up A/B testing for quality configurations",
  );

  // Example A/B test configuration
  const configA = {
    minimumQualityThreshold: 6.0,
    enableHybridByDefault: true,
  };

  const configB = {
    minimumQualityThreshold: 7.0,
    enableHybridByDefault: false,
  };

  logger.info("\nConfiguration A (Control):");
  Object.entries(configA).forEach(([key, value]) => {
    logger.info(`  ${key}: ${value}`);
  });

  logger.info("\nConfiguration B (Treatment):");
  Object.entries(configB).forEach(([key, value]) => {
    logger.info(`  ${key}: ${value}`);
  });

  logger.info("\nTo implement A/B testing:");
  logger.info("1. Route 50% of traffic to each configuration");
  logger.info("2. Track quality metrics for each group");
  logger.info("3. Compare performance after statistical significance");
  logger.info("4. Implement winning configuration");

  // Example of switching configurations
  logger.info("\nApplying Configuration A for demonstration...");
  emailAnalysisService.updateQualityConfig(configA);
  logger.info("Configuration A applied!");
}

/**
 * Show usage examples for different analysis options
 */
function showUsageExamples(): void {
  logger.info("\n=== Usage Examples ===");

  logger.info("\n1. Standard Production Usage:");
  logger.info(`
const options = {
  qualityThreshold: 6.0,
  useHybridApproach: true,
  enableQualityLogging: false
};

const result = await emailAnalysisService.analyzeEmail(email, options);
  `);

  logger.info("\n2. Development with Verbose Logging:");
  logger.info(`
const options = {
  qualityThreshold: 5.0,
  useHybridApproach: true,
  enableQualityLogging: true
};

const result = await emailAnalysisService.analyzeEmail(email, options);
  `);

  logger.info("\n3. Critical System (Strict Quality):");
  logger.info(`
const options = {
  qualityThreshold: 8.0,
  useHybridApproach: true,
  enableQualityLogging: true
};

const result = await emailAnalysisService.analyzeEmail(email, options);
  `);

  logger.info("\n4. A/B Testing (Control Group):");
  logger.info(`
const options = {
  qualityThreshold: 6.0,
  useHybridApproach: false, // Disable hybrid for pure comparison
  enableQualityLogging: true
};

const result = await emailAnalysisService.analyzeEmail(email, options);
  `);
}

/**
 * Main function to handle command line arguments
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "profile":
      const profileName = args[1];
      if (!profileName) {
        logger.error("Please specify a profile name");
        logger.info("Usage: npm run configure-quality profile <profile_name>");
        logger.info(
          "Available profiles: " +
            QUALITY_PROFILES.map((p) => p.name).join(", "),
        );
        process.exit(1);
      }
      applyQualityProfile(profileName);
      break;

    case "monitor":
      await monitorQualityMetrics();
      break;

    case "ab-test":
      await runABTest();
      break;

    case "examples":
      showUsageExamples();
      break;

    case "list-profiles":
      logger.info("Available Quality Profiles:");
      QUALITY_PROFILES.forEach((profile) => {
        logger.info(`\n${profile.name}:`);
        logger.info(`  Description: ${profile.description}`);
        logger.info(`  Use Case: ${profile.useCase}`);
        logger.info(
          `  Quality Threshold: ${profile.config.minimumQualityThreshold}`,
        );
        logger.info(
          `  Hybrid Enabled: ${profile.config.enableHybridByDefault}`,
        );
      });
      break;

    default:
      logger.info("Quality Validation Framework Configuration Tool");
      logger.info("\nAvailable commands:");
      logger.info("  profile <name>     - Apply a quality profile");
      logger.info("  monitor           - Monitor current quality metrics");
      logger.info("  ab-test           - Show A/B test configuration");
      logger.info("  examples          - Show usage examples");
      logger.info("  list-profiles     - List all available profiles");
      logger.info("\nExamples:");
      logger.info("  npm run configure-quality profile production_strict");
      logger.info("  npm run configure-quality monitor");
      logger.info("  npm run configure-quality list-profiles");
      break;
  }
}

// Run the main function
main().catch((error) => {
  logger.error("Configuration script failed:", error);
  process.exit(1);
});
