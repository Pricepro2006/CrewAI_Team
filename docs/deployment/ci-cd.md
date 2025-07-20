# CI/CD Pipeline Setup

## Overview

This guide covers setting up continuous integration and deployment pipelines for CrewAI Team using various CI/CD platforms.

## Table of Contents

1. [GitHub Actions](#github-actions)
2. [GitLab CI/CD](#gitlab-cicd)
3. [Jenkins](#jenkins)
4. [CircleCI](#circleci)
5. [Testing Strategy](#testing-strategy)
6. [Deployment Strategies](#deployment-strategies)
7. [Environment Management](#environment-management)
8. [Security Scanning](#security-scanning)

## GitHub Actions

### Basic CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'
  PNPM_VERSION: '8'

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3
      
      - uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}
          
      - name: Use Node.js ${{ env.NODE_VERSION }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
          
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        
      - name: Run linting
        run: pnpm lint
        
      - name: Run type checking
        run: pnpm typecheck
        
      - name: Run tests
        run: pnpm test:ci
        env:
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret
          
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          
  build:
    runs-on: ubuntu-latest
    needs: test
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}
          
      - name: Use Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
          
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        
      - name: Build application
        run: pnpm build
        
      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/
```

### CD Workflow - Docker

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
    tags:
      - 'v*'

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      
    steps:
      - uses: actions/checkout@v3
      
      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
          
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha
            
      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          
  deploy-staging:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    
    steps:
      - name: Deploy to Staging
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USER }}
          key: ${{ secrets.STAGING_SSH_KEY }}
          script: |
            cd /app/crewai-team
            docker-compose pull
            docker-compose up -d
            
  deploy-production:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/v')
    environment: production
    
    steps:
      - name: Deploy to Production
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /app/crewai-team
            ./deploy.sh ${{ github.ref_name }}
```

### Security Scanning Workflow

```yaml
# .github/workflows/security.yml
name: Security

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0' # Weekly

jobs:
  dependency-check:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
          
  code-scanning:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Initialize CodeQL
        uses: github/codeql-action/init@v2
        with:
          languages: javascript, typescript
          
      - name: Autobuild
        uses: github/codeql-action/autobuild@v2
        
      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v2
        
  docker-scan:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: docker build -t crewai-team:scan .
        
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'crewai-team:scan'
          format: 'sarif'
          output: 'trivy-results.sarif'
          
      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
```

## GitLab CI/CD

### .gitlab-ci.yml

```yaml
stages:
  - test
  - build
  - security
  - deploy

variables:
  NODE_VERSION: "18"
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"

# Cache configuration
.cache_config: &cache_config
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - node_modules/
      - .pnpm-store/

# Test stage
test:unit:
  stage: test
  image: node:${NODE_VERSION}-alpine
  <<: *cache_config
  services:
    - redis:7-alpine
  variables:
    REDIS_URL: redis://redis:6379
  before_script:
    - corepack enable
    - corepack prepare pnpm@latest --activate
    - pnpm config set store-dir .pnpm-store
  script:
    - pnpm install --frozen-lockfile
    - pnpm lint
    - pnpm typecheck
    - pnpm test:ci
  artifacts:
    reports:
      junit: junit.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'

# Build stage
build:docker:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker tag $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA $CI_REGISTRY_IMAGE:latest
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - docker push $CI_REGISTRY_IMAGE:latest
  only:
    - main
    - develop

# Security scanning
security:dependencies:
  stage: security
  image: node:${NODE_VERSION}-alpine
  <<: *cache_config
  script:
    - npm audit --production
  allow_failure: true

security:container:
  stage: security
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
        aquasec/trivy image $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
  allow_failure: true

# Deploy stages
deploy:staging:
  stage: deploy
  image: alpine:latest
  before_script:
    - apk add --no-cache openssh-client
    - eval $(ssh-agent -s)
    - echo "$STAGING_SSH_KEY" | ssh-add -
  script:
    - ssh -o StrictHostKeyChecking=no $STAGING_USER@$STAGING_HOST \
        "cd /app/crewai-team && ./deploy.sh staging $CI_COMMIT_SHA"
  environment:
    name: staging
    url: https://staging.crewai.com
  only:
    - develop

deploy:production:
  stage: deploy
  image: alpine:latest
  before_script:
    - apk add --no-cache openssh-client
    - eval $(ssh-agent -s)
    - echo "$PROD_SSH_KEY" | ssh-add -
  script:
    - ssh -o StrictHostKeyChecking=no $PROD_USER@$PROD_HOST \
        "cd /app/crewai-team && ./deploy.sh production $CI_COMMIT_TAG"
  environment:
    name: production
    url: https://app.crewai.com
  only:
    - tags
  when: manual
```

## Testing Strategy

### Test Configuration

```javascript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**'
      ]
    },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000
  }
});
```

### E2E Test Pipeline

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    
    services:
      app:
        image: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
        ports:
          - 3000:3000
          - 3001:3001
        env:
          NODE_ENV: test
          DATABASE_URL: sqlite:///:memory:
          REDIS_URL: redis://redis:6379
          
      redis:
        image: redis:7-alpine
        
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Playwright
        run: npx playwright install --with-deps
        
      - name: Run E2E tests
        run: pnpm test:e2e
        env:
          API_URL: http://localhost:3000
          WS_URL: ws://localhost:3001
          
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## Deployment Strategies

### Blue-Green Deployment

```bash
#!/bin/bash
# deploy-blue-green.sh

CURRENT_COLOR=$(docker ps --filter "name=crewai-app" --format "table {{.Names}}" | grep -o "blue\|green" | head -1)
NEW_COLOR=$([ "$CURRENT_COLOR" = "blue" ] && echo "green" || echo "blue")

echo "Current deployment: $CURRENT_COLOR"
echo "New deployment: $NEW_COLOR"

# Start new version
docker-compose -f docker-compose.yml -f docker-compose.$NEW_COLOR.yml up -d

# Health check
echo "Waiting for health check..."
for i in {1..30}; do
  if curl -f http://localhost:3000/api/health; then
    echo "Health check passed"
    break
  fi
  sleep 2
done

# Switch traffic
echo "Switching traffic to $NEW_COLOR"
sed -i "s/crewai-app-$CURRENT_COLOR/crewai-app-$NEW_COLOR/g" nginx/nginx.conf
docker-compose restart nginx

# Stop old version
echo "Stopping $CURRENT_COLOR deployment"
docker-compose -f docker-compose.yml -f docker-compose.$CURRENT_COLOR.yml stop
```

### Rolling Update with Kubernetes

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crewai-app
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    spec:
      containers:
      - name: app
        image: crewai/team:latest
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Environment Management

### Environment Configuration

```yaml
# environments/staging.yml
name: staging
url: https://staging.crewai.com
variables:
  NODE_ENV: staging
  LOG_LEVEL: debug
  ENABLE_DEBUG: true
  DATABASE_URL: $STAGING_DATABASE_URL
  REDIS_URL: $STAGING_REDIS_URL

# environments/production.yml  
name: production
url: https://app.crewai.com
variables:
  NODE_ENV: production
  LOG_LEVEL: warn
  ENABLE_DEBUG: false
  DATABASE_URL: $PROD_DATABASE_URL
  REDIS_URL: $PROD_REDIS_URL
```

### Secret Management

```yaml
# Using GitHub Secrets
- name: Deploy
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    JWT_SECRET: ${{ secrets.JWT_SECRET }}
    API_KEYS: ${{ secrets.API_KEYS }}

# Using HashiCorp Vault
- name: Import Secrets
  uses: hashicorp/vault-action@v2
  with:
    url: https://vault.crewai.com
    token: ${{ secrets.VAULT_TOKEN }}
    secrets: |
      secret/data/crewai/prod database_url | DATABASE_URL ;
      secret/data/crewai/prod jwt_secret | JWT_SECRET
```

## Monitoring Integration

### Deployment Notifications

```yaml
# Slack notification
- name: Notify deployment
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: |
      Deployment ${{ job.status }}
      Commit: ${{ github.sha }}
      Author: ${{ github.actor }}
      Environment: production
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
    
# Datadog event
- name: Send Datadog event
  run: |
    curl -X POST "https://api.datadoghq.com/api/v1/events" \
      -H "DD-API-KEY: ${{ secrets.DD_API_KEY }}" \
      -H "Content-Type: application/json" \
      -d '{
        "title": "Deployment to production",
        "text": "Version ${{ github.ref_name }} deployed",
        "tags": ["app:crewai", "env:production"],
        "alert_type": "info"
      }'
```

## Rollback Procedures

### Automated Rollback

```yaml
# .github/workflows/rollback.yml
name: Rollback

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to rollback to'
        required: true
        type: string

jobs:
  rollback:
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - name: Rollback deployment
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /app/crewai-team
            ./rollback.sh ${{ inputs.version }}
            
      - name: Verify rollback
        run: |
          sleep 30
          curl -f https://app.crewai.com/api/health || exit 1
```

### Manual Rollback Script

```bash
#!/bin/bash
# rollback.sh

VERSION=$1
if [ -z "$VERSION" ]; then
  echo "Usage: ./rollback.sh <version>"
  exit 1
fi

echo "Rolling back to version: $VERSION"

# Pull specific version
docker pull crewai/team:$VERSION

# Tag as latest
docker tag crewai/team:$VERSION crewai/team:latest

# Restart services
docker-compose down
docker-compose up -d

# Verify
sleep 10
curl -f http://localhost:3000/api/health || exit 1

echo "Rollback completed successfully"
```

## Best Practices

1. **Always test in staging first**
2. **Use semantic versioning for releases**
3. **Implement health checks at every stage**
4. **Keep deployment scripts idempotent**
5. **Monitor deployments with APM tools**
6. **Maintain rollback procedures**
7. **Document deployment processes**
8. **Use feature flags for gradual rollouts**
9. **Implement proper secret management**
10. **Automate as much as possible**

## Next Steps

1. Configure your CI/CD platform
2. Set up environment secrets
3. Create deployment scripts
4. Configure monitoring alerts
5. Test the entire pipeline
6. Document runbooks