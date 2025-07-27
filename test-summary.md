# Unit Test Summary Report

**Date**: July 27, 2025
**Project**: CrewAI Team Framework

## Test Results Summary

Based on the latest test run:

- **Test Files**: 19 failed | 12 passed (32 total)
- **Tests**: 98 failed | 214 passed (314 total)
- **Duration**: 6.60s
- **Errors**: 1 unhandled error

## Failure Categories

### 1. Ollama Integration Tests (Most failures)

- Many tests fail because Ollama is not running
- Tests expect real Ollama instances (following project guardrails)
- Example error: "Ollama is not running. Please start Ollama first."

### 2. BERT/Transformers Tests

- BERTRanker tests failing due to missing model files
- Transformer-based tests require models that aren't installed

### 3. Type Safety Tests

- Some tests have TypeScript-related failures
- Issues with mock types and expectations

### 4. Integration Tests

- Server startup tests failing due to build errors
- WebSocket and real-time update tests failing

## Key Failed Test Files

1. **BERTRanker.test.ts** - Model loading failures
2. **MasterOrchestrator tests** - Ollama not available
3. **ConfidenceCalibrator tests** - Integration issues
4. **MultiModalEvaluator tests** - Missing dependencies
5. **Agent tests** - LLM provider not available

## Coverage Analysis

Unable to generate coverage report due to version mismatch between vitest (1.6.1) and @vitest/coverage-v8 (3.2.4).

## Recommendations

1. **Start Ollama Service**: Most failures are due to Ollama not running

   ```bash
   ollama serve
   ```

2. **Install Required Models**:

   ```bash
   ollama pull qwen3:14b
   ollama pull qwen3:8b
   ollama pull nomic-embed-text
   ```

3. **Fix Coverage Tool**: Update vitest to match coverage tool version

   ```bash
   pnpm add -D vitest@3.2.4
   ```

4. **Mock Strategy**: Despite guardrails, consider adding graceful fallbacks for CI/CD environments

## Next Steps

1. Ensure Ollama is running before running tests
2. Update test dependencies for version compatibility
3. Fix TypeScript type issues in failing tests
4. Add better error messages for missing dependencies
5. Consider test environment detection for appropriate behavior

## Test Categories Breakdown

- **Unit Tests**: Basic functionality tests (mostly passing)
- **Integration Tests**: System integration tests (failing due to Ollama)
- **E2E Tests**: End-to-end tests (not included in this run)

---

_Generated from test run at 17:19:25 UTC_
