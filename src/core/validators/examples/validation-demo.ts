import {
  IntegratedValidationService,
  BusinessResponseValidator,
  ContactPatterns,
} from "../index.js";

// Example 1: Basic validation without fallback
async function basicValidationExample() {
  console.log("=== Basic Validation Example ===\n");

  const validator = new BusinessResponseValidator();

  const response = `
    Welcome to Joe's Pizza! We're located at 123 Main Street, Suite 100, 
    New York, NY 10001. Call us at (555) 123-4567 or visit our website 
    at www?.joespizza?.com. We're open Monday-Friday 9am-10pm, 
    Saturday-Sunday 11am-11pm. Email: info@joespizza.com
  `;

  const result = validator.validateResponse(response);

  console.log("Validation Result:");
  console.log("- Valid:", result.isValid);
  console.log("- Has Actionable Info:", result.hasActionableInfo);
  console.log("- Confidence:", result?.confidence?.toFixed(2));
  console.log("\nExtracted Information:");
  console.log(
    "- Business Names:",
    result?.contactInfo?.businessNames?.map((b: any) => b.value),
  );
  console.log(
    "- Phones:",
    result?.contactInfo?.phones?.map((p: any) => p.value),
  );
  console.log("- Address:", result?.contactInfo?.addresses[0]?.value);
  console.log(
    "- Hours:",
    result?.contactInfo?.hours?.map((h: any) => h.value),
  );
  console.log("- Email:", result?.contactInfo?.emails[0]?.value);
  console.log("- Website:", result?.contactInfo?.websites[0]?.value);
}

// Example 2: Validation with privacy mode
async function privacyModeExample() {
  console.log("\n=== Privacy Mode Example ===\n");

  const validator = new BusinessResponseValidator({ privacyMode: true });

  const response = "Call us at 555-123-4567 for more information.";
  const result = validator.validateResponse(response);

  console.log("Original phone would be: 555-123-4567");
  console.log("Masked phone:", result?.contactInfo?.phones[0]?.value);
}

// Example 3: Integrated validation with fallback
async function integratedValidationExample() {
  console.log("\n=== Integrated Validation Example ===\n");

  const service = new IntegratedValidationService({
    enableFallback: true,
    enableFeedback: true,
    minConfidenceThreshold: 0.7,
  });

  // Poor quality response that would trigger fallback
  const poorResponse = `
    For more information about ABC Company, please contact us.
    We're here to help!
  `;

  const result = await service.validate(poorResponse, {
    query: "ABC Company contact information",
    location: "Seattle, WA",
    businessType: "restaurant",
  });

  console.log("Initial validation failed, fallback used:", result.fallbackUsed);
  console.log("Missing information:", result.missingInfo);
  console.log("Enhancement suggestions:", result.enhancementSuggestions);

  // Submit feedback
  if (result.hasActionableInfo) {
    const feedback = await service.submitFeedback({
      query: "ABC Company contact information",
      validationResult: {
        isValid: result.isValid,
        hasActionableInfo: result.hasActionableInfo,
        confidence: result.confidence,
      },
      userRating: 3,
      feedbackType: "missing_info",
      specificIssues: {
        missingHours: true,
        incorrectPhone: false,
      },
      additionalComments: "Phone number was found but hours were missing",
    });

    console.log("\nFeedback submitted:", feedback.id);
  }
}

// Example 4: Pattern matching demonstration
async function patternMatchingExample() {
  console.log("\n=== Pattern Matching Examples ===\n");

  const testCases = [
    {
      name: "US Phone Variations",
      text: "(555) 123-4567, 555.123.4567, 555-123-4567, +1 555 123 4567",
      pattern: ContactPatterns?.phone?.usStandard,
    },
    {
      name: "International Phones",
      text: "+44 20 7123 4567, +49 30 12345678, +61 2 9876 5432",
      pattern: ContactPatterns?.phone?.international,
    },
    {
      name: "Business Hours",
      text: "Open Mon-Fri 9am-5pm, Sat 10:00-15:00, Sun Closed",
      pattern: ContactPatterns?.hours?.fullHours,
    },
    {
      name: "Addresses",
      text: "123 Main St, Suite 100, Boston, MA 02101",
      pattern: ContactPatterns?.address?.fullAddress,
    },
  ];

  testCases.forEach((testCase: any) => {
    console.log(`\n${testCase.name}:`);
    console.log(`Input: "${testCase.text}"`);

    const matches = [];
    let match;
    testCase?.pattern?.lastIndex = 0;

    while ((match = testCase?.pattern?.exec(testCase.text)) !== null) {
      matches.push(match[0]);
    }

    console.log("Matches:", matches);
  });
}

// Example 5: Edge case handling
async function edgeCaseExample() {
  console.log("\n=== Edge Case Examples ===\n");

  const validator = new BusinessResponseValidator();

  const edgeCases = [
    {
      name: "No contact info",
      text: "Welcome to our company! We provide excellent service.",
    },
    {
      name: "Partial phone",
      text: "Call 123-4567 for local service",
    },
    {
      name: "Multiple businesses",
      text: "ABC Corp at 123 Main St, XYZ LLC at 456 Oak Ave",
    },
    {
      name: "Ambiguous hours",
      text: "Open most days from morning to evening",
    },
    {
      name: "International format",
      text: "Ring us on 020 7123 4567 (UK) or visit 10 Downing Street, London",
    },
  ];

  edgeCases.forEach((testCase: any) => {
    console.log(`\n${testCase.name}:`);
    const result = validator.validateResponse(testCase.text);
    console.log("- Valid:", result.isValid);
    console.log("- Confidence:", result?.confidence?.toFixed(2));
    console.log("- Has actionable info:", result.hasActionableInfo);

    if (!result.hasActionableInfo) {
      console.log("- Suggestions:", result.suggestions[0]);
    }
  });
}

// Example 6: Performance test
async function performanceTest() {
  console.log("\n=== Performance Test ===\n");

  const validator = new BusinessResponseValidator();

  // Generate large text with multiple occurrences
  const largeText = Array(100)
    .fill(
      `
    Contact ABC Corporation at 555-123-4567, located at 123 Main Street, 
    New York, NY 10001. Open Mon-Fri 9am-5pm. Email: info@abc.com
  `,
    )
    .join("\n");

  console.log("Text size:", largeText?.length || 0, "characters");

  const startTime = Date.now();
  const result = validator.validateResponse(largeText);
  const endTime = Date.now();

  console.log("Processing time:", endTime - startTime, "ms");
  console.log("Unique phones found:", result?.contactInfo?.phones?.length || 0);
  console.log("Unique addresses found:", result?.contactInfo?.addresses?.length || 0);
}

// Run all examples
async function runAllExamples() {
  await basicValidationExample();
  await privacyModeExample();
  await integratedValidationExample();
  await patternMatchingExample();
  await edgeCaseExample();
  await performanceTest();
}

// Export for use in other modules
export {
  basicValidationExample,
  privacyModeExample,
  integratedValidationExample,
  patternMatchingExample,
  edgeCaseExample,
  performanceTest,
  runAllExamples,
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples().catch(console.error);
}
