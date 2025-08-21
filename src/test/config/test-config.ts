/**
 * Centralized Test Configuration
 * Provides consistent configuration across all test files
 */

export const testConfig = {
  // Timeouts
  timeouts: {
    unit: 5000, // 5 seconds for unit tests
    integration: 30000, // 30 seconds for integration tests
    e2e: 60000, // 60 seconds for e2e tests
  },

  // Mock delays
  mockDelays: {
    llmResponse: 100, // Mock LLM response delay
    databaseQuery: 50, // Mock database query delay
    apiCall: 200, // Mock API call delay
  },

  // Test data
  testData: {
    defaultEmail: {
      id: 1,
      subject: "Test Email",
      sender: "test@example.com",
      status: "pending",
      created_at: new Date().toISOString(),
    },
    defaultUser: {
      id: "user123",
      email: "user@example.com",
      role: "user",
    },
    defaultAgent: {
      name: "TestAgent",
      type: "research",
    },
  },

  // Environment
  env: {
    NODE_ENV: "test",
    DATABASE_URL: ":memory:",
    LOG_LEVEL: "error",
    DISABLE_EXTERNAL_APIS: "true",
    JWT_SECRET: "test-secret-key",
    DATABASE_PATH: ":memory:",
    REDIS_URL: "redis://localhost:6379",
    OLLAMA_HOST: "http://localhost:8081",
  },
};

// Apply test environment variables
export const applyTestEnvironment = () => {
  Object.assign(process.env, testConfig.env);
};