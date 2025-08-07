# Microservices Integration Tests

This directory contains comprehensive integration tests for the Walmart Grocery Agent microservices architecture. These tests validate the entire system under real-world conditions, ensuring that all services work together correctly and meet performance requirements.

## Test Structure

### Test Categories

#### 1. **Core Integration Tests** (`microservices-integration.test.ts`)
- **Complete Grocery Shopping Workflow**: End-to-end testing of the full shopping experience
- **Multi-user Family Shopping**: Concurrent shopping sessions with shared family carts
- **Cross-service Interactions**: Validation of service-to-service communication
- **Real-time Updates**: WebSocket integration across services
- **Service Discovery**: Load balancing and failover scenarios
- **Data Consistency**: Transaction integrity and cache coherence

#### 2. **Edge Cases & Error Scenarios** (`edge-cases-error-scenarios.test.ts`)
- **Partial Service Failures**: Graceful degradation when services are unavailable
- **Network Partitions**: Split-brain scenarios and eventual consistency
- **Resource Exhaustion**: Memory pressure and queue overflow handling
- **Security Edge Cases**: Authentication failures and abuse detection
- **Data Corruption**: Recovery from corrupted cache and database states

#### 3. **Performance Benchmarks** (`performance-benchmarks.test.ts`)
- **Single Service Performance**: Response time and throughput validation
- **End-to-end Pipeline Performance**: Complete workflow timing
- **Concurrent User Scenarios**: Peak load and scaling validation
- **Cache Performance**: Cache effectiveness and optimization
- **WebSocket Performance**: Real-time communication under load

#### 4. **WebSocket Integration** (`websocket-integration.test.ts`)
- **Connection Management**: Authentication and subscription handling
- **Message Routing**: Event filtering and delivery
- **Real-time Broadcasting**: Multi-client message distribution
- **Performance Monitoring**: Connection metrics and health checks

## Real-World Scenarios Tested

### Shopping Workflows
1. **Basic Shopping Session**: User creates session, searches products, adds to cart, checks out
2. **Budget-Conscious Shopping**: Price comparison, coupon optimization, budget tracking
3. **Dietary Restrictions**: Gluten-free, vegan, allergen filtering
4. **Family Shopping**: Multiple users sharing carts, preference synchronization
5. **Bulk Buying**: Quantity discounts, inventory management
6. **Emergency Restocking**: High-priority ordering, express delivery

### Technical Scenarios
1. **Service Mesh Operations**: Discovery, load balancing, circuit breaking
2. **Cache Strategies**: Warming, invalidation, consistency
3. **Queue Management**: Priority handling, overflow protection
4. **Database Operations**: Connection pooling, transaction integrity
5. **Real-time Communications**: WebSocket scaling, message delivery
6. **Security Validation**: Authentication, authorization, rate limiting

## Performance Requirements

### Response Time Targets
- **API Server**: < 200ms (95th percentile)
- **NLP Processing**: < 2000ms (95th percentile)
- **Pricing Service**: < 500ms (95th percentile)
- **Cache Operations**: < 100ms (95th percentile)
- **End-to-end Workflow**: < 8000ms (95th percentile)

### Throughput Targets
- **Session Creation**: > 100 requests/second
- **NLP Processing**: > 10 requests/second
- **Price Lookups**: > 50 requests/second
- **Cache Operations**: > 200 requests/second
- **WebSocket Connections**: > 500 concurrent

### Error Rate Limits
- **Critical Operations**: < 1% error rate
- **NLP Processing**: < 2% error rate
- **Peak Load**: < 10% error rate
- **Cache Operations**: < 0.5% error rate

## Running the Tests

### Prerequisites
```bash
# Ensure all services are running
npm run start:services

# Redis should be available
redis-server

# Node.js 18+ required
node --version
```

### Environment Setup
```bash
# Copy environment configuration
cp .env.example .env.test

# Set test-specific variables
export NODE_ENV=test
export REDIS_HOST=localhost
export REDIS_PORT=6379
```

### Running Individual Test Suites

```bash
# Core integration tests
npm run test:integration:core

# Edge cases and error scenarios
npm run test:integration:edge-cases

# Performance benchmarks
npm run test:integration:performance

# WebSocket integration
npm run test:integration:websocket
```

### Running All Tests

```bash
# Run all integration tests
npm run test:integration

# Run with detailed reporting
npm run test:integration:report

# Run only critical path tests
npm run test:integration:critical

# Run tests in parallel (faster)
npm run test:integration:parallel
```

### Advanced Test Execution

```bash
# Run with comprehensive test runner
npx ts-node tests/integration/run-integration-tests.ts

# Options:
npx ts-node tests/integration/run-integration-tests.ts --parallel --critical-only
```

### Continuous Integration

```bash
# CI pipeline command
npm run test:integration:ci

# This runs:
# 1. Environment validation
# 2. Service health checks
# 3. Critical path tests
# 4. Performance validation
# 5. Report generation
```

## Test Configuration

### Load Test Configuration
```typescript
interface LoadTestConfig {
  duration: number;        // Test duration in ms
  rampUpTime: number;     // Time to reach peak load
  maxConcurrentUsers: number; // Peak concurrent users
  requestsPerUser: number; // Requests per user
  thinkTime: number;      // Delay between requests
}
```

### Performance Baselines
```typescript
interface PerformanceBaseline {
  service: string;        // Service name
  operation: string;      // Operation type
  maxResponseTime: number; // Max acceptable response time
  minThroughput: number;  // Minimum throughput requirement
  maxErrorRate: number;   // Maximum acceptable error rate
}
```

## Test Data Management

### Mock Data Generation
- **Product Catalogs**: Real Walmart product structures
- **User Sessions**: Realistic shopping patterns
- **Pricing Data**: Geographic and seasonal variations
- **Shopping Carts**: Various item combinations and quantities

### Test Isolation
- **Separate Redis Databases**: Each test suite uses isolated DB
- **Unique Session IDs**: Prevent cross-test interference
- **Cleanup Procedures**: Automatic resource cleanup after tests
- **State Reset**: Fresh state for each test run

## Monitoring and Reporting

### Metrics Collected
- **Response Times**: Min, max, average, percentiles
- **Throughput**: Requests per second, concurrent users
- **Error Rates**: By type and service
- **Resource Usage**: Memory, CPU, network I/O
- **Service Health**: Availability and response status

### Report Formats
- **JSON Reports**: Machine-readable test results
- **HTML Reports**: Human-readable dashboards
- **Performance Graphs**: Visual trend analysis
- **Failure Analysis**: Detailed error breakdowns

### Alert Thresholds
- **Performance Degradation**: > 20% slower than baseline
- **High Error Rate**: > 5% for critical operations
- **Service Unavailability**: Any critical service down
- **Resource Exhaustion**: Memory usage > 90%

## Troubleshooting

### Common Issues

#### Service Connection Failures
```bash
# Check service health
curl http://localhost:3000/health
curl http://localhost:3008/nlp/health
curl http://localhost:3007/pricing/health

# Verify Redis connectivity
redis-cli ping
```

#### Performance Test Failures
```bash
# Check system resources
top
free -h
df -h

# Monitor service logs
tail -f logs/walmart-*.log
```

#### WebSocket Test Issues
```bash
# Test WebSocket endpoint directly
wscat -c ws://localhost:8080/grocery

# Check for port conflicts
netstat -tulpn | grep 8080
```

### Debug Mode
```bash
# Run tests with debug logging
DEBUG=* npm run test:integration

# Specific component debugging
DEBUG=INTEGRATION_TEST,PERF_TEST npm run test:integration
```

### Test Data Inspection
```bash
# Check Redis test databases
redis-cli -n 12 keys "*"  # Performance tests
redis-cli -n 13 keys "*"  # Edge case tests
redis-cli -n 14 keys "*"  # Integration tests
redis-cli -n 15 keys "*"  # WebSocket tests
```

## Contributing

### Adding New Tests
1. **Identify Scenario**: Define real-world use case
2. **Create Test Suite**: Follow existing patterns
3. **Set Performance Baselines**: Define acceptable limits
4. **Add Documentation**: Update this README
5. **Validate CI Integration**: Ensure tests run in pipeline

### Test Best Practices
- **Isolation**: Each test should be independent
- **Cleanup**: Always clean up resources
- **Timeouts**: Set reasonable timeouts for operations
- **Assertions**: Use specific, meaningful assertions
- **Logging**: Include context in error messages

### Performance Test Guidelines
- **Realistic Load**: Use production-like traffic patterns
- **Gradual Ramp-up**: Don't overwhelm services immediately
- **Resource Monitoring**: Track system resources during tests
- **Baseline Comparison**: Always compare against established baselines
- **Environment Consistency**: Use consistent test environments

## Architecture Integration

These integration tests validate the complete microservices architecture:

```
Frontend (React) → tRPC API → Backend Services → Direct Service Calls
                                                → WebSocket Updates
                                                → Cache Management
                                                → Queue Processing
```

### Service Dependencies Validated
- **API Server** ← Core orchestration
- **NLP Service** ← Natural language processing
- **Pricing Service** ← Product pricing and comparison
- **Cache Warmer** ← Performance optimization
- **WebSocket Gateway** ← Real-time updates
- **Memory Monitor** ← Resource management

### Data Flow Validation
1. **Request Processing**: HTTP → Service Mesh → Individual Services
2. **Event Broadcasting**: Service Events → WebSocket → Client Updates  
3. **Cache Management**: Data Updates → Cache Invalidation → Refresh
4. **Queue Processing**: Async Tasks → Priority Handling → Completion

## Success Criteria

Tests are considered successful when:
- **All Integration Workflows Complete**: End-to-end scenarios pass
- **Performance Targets Met**: All response times within limits
- **Error Rates Acceptable**: Below defined thresholds
- **Resource Usage Stable**: No memory leaks or excessive consumption
- **Service Health Maintained**: All critical services remain available

## Next Steps

After successful integration testing:
1. **Production Deployment**: Deploy validated architecture
2. **Performance Monitoring**: Set up production monitoring
3. **Load Testing**: Run periodic load tests
4. **Capacity Planning**: Plan for traffic growth
5. **Continuous Improvement**: Iterate based on real usage patterns