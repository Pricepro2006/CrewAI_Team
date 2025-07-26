# Test Setup Guide

This project includes comprehensive unit and integration tests. Some tests require external services to be running.

## Quick Test Run (Unit Tests Only)

```bash
pnpm test
```

## Full Test Run (Including ChromaDB Integration Tests)

### Prerequisites

1. **Docker & Docker Compose** - Required for ChromaDB test database
2. **Ollama** - Required for LLM integration tests

### Setup ChromaDB Test Environment

```bash
# Start test services
docker-compose -f docker-compose.test.yml up -d

# Wait for services to be ready (check health)
docker-compose -f docker-compose.test.yml ps

# Run tests
pnpm test

# Clean up test services
docker-compose -f docker-compose.test.yml down -v
```

### Test Environment Verification

Check that services are running:

```bash
# ChromaDB health check
curl http://localhost:8001/api/v1/heartbeat

# Ollama health check
curl http://localhost:11434/api/tags
```

## Test Categories

### Unit Tests

- **Location**: `src/**/*.test.ts`
- **Requirements**: None (all dependencies mocked)
- **Runtime**: Fast (~30 seconds)

### Integration Tests

- **Location**: `src/**/*.integration.test.ts`
- **Requirements**: ChromaDB + Ollama
- **Runtime**: Medium (~2-3 minutes)

### End-to-End Tests

- **Location**: `tests/e2e/**/*.test.ts`
- **Requirements**: Full system + UI
- **Runtime**: Slow (~5-10 minutes)

## Test Configuration

### ChromaDB Tests

Tests automatically detect if ChromaDB is available:

- **Available**: Run full integration tests
- **Unavailable**: Skip ChromaDB tests with warning

### Ollama Tests

Tests check for Ollama availability:

- **Available**: Run LLM integration tests
- **Unavailable**: Skip with mock responses

## Troubleshooting

### ChromaDB Connection Issues

```bash
# Check ChromaDB logs
docker-compose -f docker-compose.test.yml logs chromadb-test

# Restart ChromaDB service
docker-compose -f docker-compose.test.yml restart chromadb-test
```

### Port Conflicts

If ports 8001 or 8124 are in use:

```bash
# Check what's using the ports
lsof -i :8001
lsof -i :8124

# Stop conflicting services or modify docker-compose.test.yml
```

### Test Data Cleanup

```bash
# Remove test volumes
docker-compose -f docker-compose.test.yml down -v

# Clean Docker system (careful - removes all unused volumes)
docker system prune -v
```

## CI/CD Integration

For CI pipelines, set up services before tests:

```yaml
# GitHub Actions example
services:
  chromadb:
    image: chromadb/chroma:latest
    ports:
      - 8001:8000

steps:
  - name: Start test services
    run: docker-compose -f docker-compose.test.yml up -d

  - name: Wait for services
    run: |
      timeout 60 bash -c 'until curl -f http://localhost:8001/api/v1/heartbeat; do sleep 2; done'

  - name: Run tests
    run: pnpm test

  - name: Cleanup
    run: docker-compose -f docker-compose.test.yml down -v
```
