# Testing Strategy for AI Agent Team Framework

## Overview

This document outlines the comprehensive testing strategy for the AI Agent Team Framework, with special focus on testing AI/LLM components that depend on Ollama.

## Test Categories

### 1. Unit Tests
- **Scope**: Individual functions, classes, and components
- **Dependencies**: Mocked external services
- **Location**: `src/**/*.test.ts`
- **Command**: `pnpm test:unit`

### 2. Integration Tests
- **Scope**: Component interactions, API endpoints, database operations
- **Dependencies**: Real Ollama, ChromaDB (optional)
- **Location**: `src/**/*.integration.test.ts`
- **Command**: `pnpm test:integration`

### 3. E2E Tests
- **Scope**: Complete user workflows
- **Dependencies**: Full system with Ollama
- **Location**: `e2e/**/*.spec.ts`
- **Command**: `pnpm test:e2e`

## Ollama Testing Strategy

### Environment Detection

The testing framework automatically detects the environment and adapts accordingly:

```typescript
// CI Environment
if (process.env['CI']) {
  // Use smaller, faster models
  process.env['OLLAMA_MODEL'] = 'qwen2.5:0.5b';
  process.env['OLLAMA_EMBED_MODEL'] = 'nomic-embed-text';
  // Shorter timeouts
  process.env['TEST_TIMEOUT'] = '30000';
}

// Local Development
else {
  // Use full models for better accuracy
  process.env['OLLAMA_MODEL'] = 'qwen3:8b';
  process.env['OLLAMA_EMBED_MODEL'] = 'nomic-embed-text';
  // Longer timeouts
  process.env['TEST_TIMEOUT'] = '60000';
}
```

### Graceful Degradation

Tests handle Ollama unavailability gracefully:

1. **Availability Check**: Tests check if Ollama is available before executing
2. **Conditional Skipping**: Tests skip gracefully when Ollama is unavailable
3. **Mock Fallback**: Critical tests use mock providers when needed

### Test Patterns

#### Pattern 1: Skip If Unavailable
```typescript
import { skipIfOllamaUnavailable } from '../test/utils/test-helpers';

describe('Agent Integration Tests', () => {
  it('should execute research task', async () => {
    if (await skipIfOllamaUnavailable('Research Agent Test')) {
      return; // Skip test
    }
    
    // Test implementation
  });
});
```

#### Pattern 2: Mock Fallback
```typescript
import { ollamaTestHelper, MockLLMProvider } from '../test/utils/test-helpers';

describe('Critical Core Tests', () => {
  let llmProvider: any;
  
  beforeEach(async () => {
    const isOllamaAvailable = await ollamaTestHelper.checkAvailability();
    if (isOllamaAvailable) {
      llmProvider = new OllamaProvider();
    } else {
      llmProvider = new MockLLMProvider();
    }
  });
  
  it('should process requests', async () => {
    const response = await llmProvider.generate('test prompt');
    expect(response).toBeDefined();
  });
});
```

#### Pattern 3: Environment-Specific Tests
```typescript
import { getTestEnvironment } from '../test/utils/test-helpers';

describe('Performance Tests', () => {
  it('should meet performance requirements', async () => {
    const environment = getTestEnvironment();
    const expectedTime = environment === 'ci' ? 5000 : 10000;
    
    // Run test with appropriate expectations
  });
});
```

## CI/CD Integration

### Pipeline Configuration

The CI pipeline includes proper Ollama setup:

```yaml
- name: Install and setup Ollama for testing
  run: |
    # Install Ollama
    curl -fsSL https://ollama.com/install.sh | sh
    
    # Start Ollama server
    ollama serve &
    
    # Wait for readiness
    for i in {1..30}; do
      if curl -s -f http://localhost:11434/api/version; then
        echo "Ollama is ready!"
        break
      fi
      sleep 2
    done
    
    # Pull test models
    ollama pull qwen2.5:0.5b
    ollama pull nomic-embed-text
    
    # Verify setup
    ollama list
```

### Test Environment Variables

CI sets appropriate environment variables:

```bash
export OLLAMA_URL=http://localhost:11434
export TEST_TIMEOUT=30000
export OLLAMA_MODEL=qwen2.5:0.5b
export OLLAMA_EMBED_MODEL=nomic-embed-text
export CI=true
```

## Test Data Management

### Test Fixtures

Tests use consistent fixtures for reproducible results:

```typescript
// Test fixtures for different scenarios
export const testPrompts = {
  research: "Research the latest developments in AI",
  code: "Generate a Python function to sort a list",
  analysis: "Analyze the following data: [1,2,3,4,5]",
  error: "This should trigger an error response"
};

export const expectedResponses = {
  research: /research|developments|AI|artificial intelligence/i,
  code: /def|function|sort|list|python/i,
  analysis: /data|analyze|statistics|results/i
};
```

### Database Testing

Tests use in-memory databases for speed:

```typescript
// Test setup
process.env['DATABASE_PATH'] = ':memory:';

// Test database helper
export function createTestDatabase(): Database {
  const db = new Database(':memory:');
  // Initialize schema
  return db;
}
```

## Performance Testing

### Timeout Configuration

Tests use environment-appropriate timeouts:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: process.env['CI'] ? 30000 : 60000,
    // ...
  }
});
```

### Performance Monitoring

Tests include performance monitoring:

```typescript
import { measurePerformance } from '../test/utils/test-helpers';

it('should complete task within time limit', async () => {
  const result = await measurePerformance('Agent Task', async () => {
    return await agent.execute(task);
  });
  
  expect(result).toBeDefined();
});
```

## Test Coverage Requirements

### Coverage Thresholds

Different thresholds for different environments:

```typescript
// vitest.config.ts
thresholds: {
  lines: process.env['CI'] ? 70 : 80,
  functions: process.env['CI'] ? 70 : 80,
  branches: process.env['CI'] ? 60 : 80,
  statements: process.env['CI'] ? 70 : 80,
}
```

### Exclusions

Certain files are excluded from coverage:

- Test files themselves
- UI components (tested separately)
- Configuration files
- Mock implementations

## Development Workflow

### Local Development

1. **Start Services**: `pnpm start:dev-services`
2. **Run Tests**: `pnpm test`
3. **Watch Mode**: `pnpm test:watch`

### CI/CD Pipeline

1. **Lint & Type Check**: Ensures code quality
2. **Unit Tests**: Fast, isolated tests
3. **Integration Tests**: Tests with real Ollama
4. **E2E Tests**: Full system tests
5. **Build**: Verifies production build

## Troubleshooting

### Common Issues

#### Ollama Not Available
```bash
# Check if Ollama is running
curl http://localhost:11434/api/version

# Start Ollama
ollama serve

# Pull required models
ollama pull qwen2.5:0.5b
ollama pull nomic-embed-text
```

#### Test Timeouts
```bash
# Increase timeout for slow environments
export TEST_TIMEOUT=60000

# Use smaller models for CI
export OLLAMA_MODEL=qwen2.5:0.5b
```

#### Memory Issues
```bash
# Use in-memory database
export DATABASE_PATH=:memory:

# Skip heavy tests
export SKIP_HEAVY_TESTS=true
```

## Best Practices

1. **Always Check Availability**: Use `skipIfOllamaUnavailable` for Ollama-dependent tests
2. **Use Appropriate Models**: Smaller models for CI, full models for local development
3. **Set Realistic Timeouts**: Account for model loading and inference time
4. **Mock When Necessary**: Use mocks for unit tests, real services for integration tests
5. **Monitor Performance**: Use performance helpers to track test execution time
6. **Clean Up Resources**: Ensure proper cleanup after tests
7. **Document Assumptions**: Clearly document test requirements and expectations

## Future Enhancements

1. **Parallel Testing**: Run tests in parallel when possible
2. **Test Sharding**: Split tests across multiple CI runners
3. **Snapshot Testing**: Add snapshot tests for consistent outputs
4. **Performance Baselines**: Establish performance baselines and regression detection
5. **Integration with Metrics**: Track test metrics and trends over time