# Production Testing Suite for Email Pipeline

This directory contains comprehensive production testing for the CrewAI Team email pipeline deployment, including integration tests, load testing, and deployment validation.

## Test Suite Overview

### 1. Integration Tests (`email-pipeline-integration.test.ts`)

Comprehensive end-to-end testing covering:

- **Pipeline Flow Testing**: Complete three-stage pipeline execution
- **Database Persistence**: Pipeline execution records and email analysis updates
- **Duplicate Handling**: Concurrent execution and data integrity
- **Error Recovery**: Transaction failures and rollback mechanisms
- **Concurrent Processing**: ACID properties and high-volume processing
- **Workflow Management**: Chain creation and updates

**Key Features:**
- Real database operations with cleanup
- Transaction integrity validation
- Concurrent operation testing
- Performance benchmarking
- Memory constraint validation

**Usage:**
```bash
npm run test:production:integration
# or
npx vitest run tests/production/email-pipeline-integration.test.ts
```

### 2. Load Testing Suite (`load-test-email-pipeline.ts`)

Performance testing for production-scale email processing:

- **High-Volume Processing**: 100+ emails/sec capacity testing
- **Memory Monitoring**: Resource usage tracking and leak detection
- **Database Performance**: Query performance under load
- **Pipeline Optimization**: Priority-based processing and resource scaling
- **Concurrent Operations**: Multiple pipeline instances

**Performance Targets:**
- Process 1000 emails in under 10 seconds (100+ emails/sec)
- Memory usage under 500MB during processing
- Database queries under 100ms average
- 90%+ success rate under concurrent load

**Usage:**
```bash
npm run test:production:load
# or
npx vitest run tests/production/load-test-email-pipeline.ts
```

### 3. Deployment Validation Script (`../scripts/test-production-deployment.sh`)

Automated deployment testing including:

- **Prerequisites Validation**: Node.js, npm, SystemD availability
- **Database Connectivity**: Connection testing and migration validation
- **Service Dependencies**: Redis, Ollama, ChromaDB connectivity
- **Build Process**: Production build verification
- **SystemD Lifecycle**: Service start/stop/restart testing
- **API Health Checks**: Endpoint availability and response validation
- **Security Configuration**: User permissions and security headers
- **Performance Validation**: Response times and concurrent handling

**Usage:**
```bash
./scripts/test-production-deployment.sh
```

## Running the Complete Test Suite

### Prerequisites

1. **Environment Setup**:
   ```bash
   # Ensure all services are running
   sudo systemctl start redis
   systemctl --user start ollama
   # Start ChromaDB if not already running
   docker run -p 8000:8000 chromadb/chroma
   ```

2. **Database Setup**:
   ```bash
   npm run db:migrate:production
   ```

3. **Dependencies**:
   ```bash
   npm ci --production
   npm run build:production
   ```

### Test Execution

#### Individual Test Suites

```bash
# Integration tests only
npm run test:production:integration

# Load tests only  
npm run test:production:load

# Deployment validation only
./scripts/test-production-deployment.sh
```

#### Complete Production Test Suite

```bash
# Run all production tests
npm run test:production:all

# With coverage reporting
npm run test:production:coverage
```

#### CI/CD Integration

```bash
# Automated deployment pipeline test
npm run test:production:ci
```

## Test Configuration

### Environment Variables

```bash
# Database configuration
DATABASE_PATH=./data/crewai.db

# Service endpoints
REDIS_URL=redis://localhost:6379
OLLAMA_HOST=http://localhost:11434
CHROMADB_URL=http://localhost:8000

# Test configuration
NODE_ENV=test
LOG_LEVEL=info
TEST_TIMEOUT=300000
```

### Vitest Configuration

Tests use the main Vitest configuration with production-specific overrides:

```typescript
// vitest.production.config.ts
export default defineConfig({
  test: {
    timeout: 300000, // 5 minutes for load tests
    maxConcurrency: 1, // Sequential execution for stability
    setupFiles: ['./tests/production/setup.ts'],
    teardownTimeout: 60000,
    env: {
      NODE_ENV: 'test',
      DATABASE_PATH: './data/test-crewai.db'
    }
  }
});
```

## Test Data Management

### Test Isolation

- All test data uses prefixes (`test-`, `load-test-`) for identification
- Automatic cleanup after each test suite
- Separate test database instances when possible
- Transaction-based isolation for concurrent tests

### Performance Monitoring

The load testing suite includes comprehensive performance monitoring:

```typescript
// Performance metrics collected
interface PerformanceMetrics {
  processingRate: number;        // emails/second
  avgResponseTime: number;       // milliseconds
  memoryUsage: MemoryUsage;     // heap, RSS, external
  databaseQueryTime: number;     // milliseconds
  concurrentCapacity: number;   // simultaneous operations
}
```

## Troubleshooting

### Common Issues

1. **Database Connection Failures**:
   ```bash
   # Check database file exists and permissions
   ls -la ./data/crewai.db
   
   # Run database migrations
   npm run db:migrate:production
   ```

2. **Service Dependencies Not Available**:
   ```bash
   # Check service status
   sudo systemctl status redis
   curl http://localhost:11434/api/version  # Ollama
   curl http://localhost:8000/api/v1/version  # ChromaDB
   ```

3. **Memory Issues During Load Tests**:
   ```bash
   # Run with garbage collection enabled
   node --expose-gc node_modules/.bin/vitest run tests/production/load-test-email-pipeline.ts
   ```

4. **Test Timeouts**:
   ```bash
   # Increase timeout for slow systems
   VITEST_TIMEOUT=600000 npm run test:production:load
   ```

### Performance Optimization

1. **Database Performance**:
   - Ensure indexes are created: `npm run db:optimize`
   - Monitor query performance during tests
   - Use connection pooling for concurrent tests

2. **Memory Management**:
   - Enable garbage collection: `--expose-gc`
   - Monitor heap growth during load tests
   - Use streaming for large datasets

3. **Concurrent Processing**:
   - Adjust batch sizes based on CPU cores
   - Use worker threads for CPU-intensive tasks
   - Implement backpressure for high-volume processing

## Continuous Integration

### GitHub Actions Integration

```yaml
# .github/workflows/production-tests.yml
name: Production Tests
on:
  push:
    branches: [main, production]
  pull_request:
    branches: [main]

jobs:
  production-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20.11'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Setup test services
        run: |
          sudo systemctl start redis
          docker run -d -p 8000:8000 chromadb/chroma
      
      - name: Run production tests
        run: npm run test:production:ci
        timeout-minutes: 30
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: production-test-results
          path: tests/production/results/
```

### Deployment Pipeline Integration

The deployment validation script can be integrated into deployment pipelines:

```bash
# Pre-deployment validation
./scripts/test-production-deployment.sh

# Post-deployment verification
curl -f http://localhost:3001/api/health
./scripts/test-production-deployment.sh --post-deploy
```

## Monitoring and Alerting

### Test Result Monitoring

- Test execution logs: `./logs/deployment-test-*.log`
- Performance metrics: Exported to monitoring systems
- Failure alerts: Integration with notification systems

### Production Monitoring Integration

The test suite validates monitoring endpoints:

- Health checks: `/api/health`
- Metrics: `/api/metrics`
- Pipeline status: `/api/pipeline/status`
- System info: `/api/system/info`

## Support and Maintenance

### Regular Maintenance

1. **Weekly**: Run complete test suite
2. **Before releases**: Full deployment validation
3. **Performance baseline**: Monthly load test comparisons
4. **Database maintenance**: Cleanup test data, optimize indexes

### Test Suite Updates

When adding new features:

1. Add integration tests for new pipeline stages
2. Update load tests for new processing patterns
3. Extend deployment validation for new services
4. Update performance benchmarks and targets

For questions or issues with the production testing suite, refer to the main project documentation or create an issue in the project repository.