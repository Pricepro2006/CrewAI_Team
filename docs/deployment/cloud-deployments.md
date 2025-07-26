# Cloud Platform Deployment Guide

## Overview

This guide covers deploying CrewAI Team on major cloud platforms including AWS, Google Cloud Platform, Microsoft Azure, and other cloud providers.

## Table of Contents

1. [AWS Deployment](#aws-deployment)
2. [Google Cloud Platform](#google-cloud-platform)
3. [Microsoft Azure](#microsoft-azure)
4. [DigitalOcean](#digitalocean)
5. [Heroku](#heroku)
6. [Render](#render)
7. [Cost Optimization](#cost-optimization)
8. [Multi-Cloud Strategy](#multi-cloud-strategy)

## AWS Deployment

### AWS ECS (Elastic Container Service)

#### Task Definition

```json
{
  "family": "crewai-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "crewai-app",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/crewai:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        },
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "DATABASE_HOST",
          "value": "crewai.cluster-abc123.us-east-1.rds.amazonaws.com"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:crewai/db-password"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:crewai/jwt-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/crewai",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    }
  ]
}
```

#### Service Definition

```yaml
# ecs-service.yaml
apiVersion: ecs/v1
kind: Service
metadata:
  name: crewai-service
spec:
  cluster: production
  taskDefinition: crewai-task:latest
  desiredCount: 3
  launchType: FARGATE
  networkConfiguration:
    awsvpcConfiguration:
      subnets:
        - subnet-abc123
        - subnet-def456
      securityGroups:
        - sg-crewai-app
      assignPublicIp: DISABLED
  loadBalancers:
    - targetGroupArn: arn:aws:elasticloadbalancing:us-east-1:123456789:targetgroup/crewai-tg
      containerName: crewai-app
      containerPort: 3000
  healthCheckGracePeriodSeconds: 60
  deploymentConfiguration:
    maximumPercent: 200
    minimumHealthyPercent: 100
    deploymentCircuitBreaker:
      enable: true
      rollback: true
```

#### Infrastructure as Code (Terraform)

```hcl
# main.tf
provider "aws" {
  region = var.aws_region
}

# VPC
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  
  name = "crewai-vpc"
  cidr = "10.0.0.0/16"
  
  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
  
  enable_nat_gateway = true
  enable_vpn_gateway = true
  
  tags = {
    Terraform   = "true"
    Environment = var.environment
  }
}

# RDS Instance
resource "aws_db_instance" "crewai" {
  identifier     = "crewai-db"
  engine         = "postgres"
  engine_version = "14.7"
  instance_class = "db.t3.medium"
  
  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_encrypted     = true
  
  db_name  = "crewai"
  username = "crewai"
  password = random_password.db_password.result
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.crewai.name
  
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  enabled_cloudwatch_logs_exports = ["postgresql"]
  
  tags = {
    Name        = "crewai-database"
    Environment = var.environment
  }
}

# ElastiCache Redis
resource "aws_elasticache_cluster" "crewai" {
  cluster_id           = "crewai-cache"
  engine              = "redis"
  node_type           = "cache.t3.micro"
  num_cache_nodes     = 1
  parameter_group_name = "default.redis7"
  engine_version      = "7.0"
  port                = 6379
  
  subnet_group_name = aws_elasticache_subnet_group.crewai.name
  security_group_ids = [aws_security_group.redis.id]
  
  tags = {
    Name        = "crewai-redis"
    Environment = var.environment
  }
}

# Application Load Balancer
resource "aws_lb" "crewai" {
  name               = "crewai-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets           = module.vpc.public_subnets
  
  enable_deletion_protection = true
  enable_http2              = true
  
  tags = {
    Name        = "crewai-alb"
    Environment = var.environment
  }
}

# Auto Scaling
resource "aws_appautoscaling_target" "ecs_target" {
  max_capacity       = 10
  min_capacity       = 3
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.crewai.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "ecs_policy_cpu" {
  name               = "crewai-cpu-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace
  
  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}
```

### AWS Lambda Deployment

For serverless deployment of specific functions:

```javascript
// lambda/emailProcessor.js
const { EmailAnalysisAgent } = require('./agents');

exports.handler = async (event) => {
  const agent = new EmailAnalysisAgent();
  
  try {
    const result = await agent.analyze(event.email);
    
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Error processing email:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

#### Serverless Framework Configuration

```yaml
# serverless.yml
service: crewai-functions

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  environment:
    DATABASE_URL: ${env:DATABASE_URL}
    REDIS_URL: ${env:REDIS_URL}
  iamRoleStatements:
    - Effect: Allow
      Action:
        - secretsmanager:GetSecretValue
      Resource: "arn:aws:secretsmanager:*:*:secret:crewai/*"

functions:
  emailProcessor:
    handler: lambda/emailProcessor.handler
    events:
      - sqs:
          arn:
            Fn::GetAtt:
              - EmailQueue
              - Arn
    timeout: 300
    memorySize: 1024

resources:
  Resources:
    EmailQueue:
      Type: AWS::SQS::Queue
      Properties:
        QueueName: crewai-email-queue
        VisibilityTimeout: 360
        MessageRetentionPeriod: 1209600
```

## Google Cloud Platform

### GKE Deployment

```bash
# Create GKE cluster
gcloud container clusters create crewai-cluster \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type n1-standard-2 \
  --enable-autoscaling \
  --min-nodes 3 \
  --max-nodes 10 \
  --enable-autorepair \
  --enable-autoupgrade

# Get credentials
gcloud container clusters get-credentials crewai-cluster --zone us-central1-a

# Deploy application
kubectl apply -k k8s/
```

### Cloud Run Deployment

```yaml
# cloudrun-service.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: crewai-app
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "1"
        autoscaling.knative.dev/maxScale: "100"
        run.googleapis.com/cloudsql-instances: PROJECT_ID:REGION:crewai-db
        run.googleapis.com/vpc-access-connector: crewai-connector
        run.googleapis.com/vpc-access-egress: private-ranges-only
    spec:
      containerConcurrency: 100
      timeoutSeconds: 300
      containers:
      - image: gcr.io/PROJECT_ID/crewai:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: production
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-url
              key: latest
        resources:
          limits:
            cpu: "2"
            memory: "2Gi"
        livenessProbe:
          httpGet:
            path: /api/health
          initialDelaySeconds: 10
          periodSeconds: 10
```

### Deployment Script

```bash
#!/bin/bash
# deploy-gcp.sh

PROJECT_ID="your-project-id"
REGION="us-central1"
SERVICE_NAME="crewai-app"

# Build and push image
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

# Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production" \
  --set-secrets="DATABASE_URL=database-url:latest" \
  --min-instances=1 \
  --max-instances=100 \
  --memory=2Gi \
  --cpu=2
```

## Microsoft Azure

### Azure Container Instances

```yaml
# aci-deployment.yaml
apiVersion: 2019-12-01
location: eastus
name: crewai-container-group
properties:
  containers:
  - name: crewai-app
    properties:
      image: crewairegistry.azurecr.io/crewai:latest
      resources:
        requests:
          cpu: 2
          memoryInGb: 4
      ports:
      - port: 3000
        protocol: TCP
      - port: 3001
        protocol: TCP
      environmentVariables:
      - name: NODE_ENV
        value: production
      - name: DATABASE_HOST
        value: crewai-server.database.windows.net
      - name: DATABASE_PASSWORD
        secureValue: ${DATABASE_PASSWORD}
      livenessProbe:
        httpGet:
          path: /api/health
          port: 3000
        periodSeconds: 30
  osType: Linux
  ipAddress:
    type: Public
    ports:
    - protocol: tcp
      port: 80
    - protocol: tcp
      port: 443
  imageRegistryCredentials:
  - server: crewairegistry.azurecr.io
    username: crewairegistry
    password: ${ACR_PASSWORD}
```

### Azure Kubernetes Service (AKS)

```bash
# Create AKS cluster
az aks create \
  --resource-group crewai-rg \
  --name crewai-aks \
  --node-count 3 \
  --enable-addons monitoring \
  --generate-ssh-keys \
  --node-vm-size Standard_B2s \
  --enable-cluster-autoscaler \
  --min-count 3 \
  --max-count 10

# Get credentials
az aks get-credentials --resource-group crewai-rg --name crewai-aks

# Deploy application
kubectl apply -k k8s/
```

### Azure Functions (Serverless)

```typescript
// azure-functions/EmailAnalyzer/index.ts
import { AzureFunction, Context, HttpRequest } from "@azure/functions"
import { EmailAnalysisAgent } from "../shared/agents"

const httpTrigger: AzureFunction = async function (
  context: Context, 
  req: HttpRequest
): Promise<void> {
  const agent = new EmailAnalysisAgent();
  
  try {
    const result = await agent.analyze(req.body);
    
    context.res = {
      status: 200,
      body: result
    };
  } catch (error) {
    context.log.error('Email analysis failed:', error);
    
    context.res = {
      status: 500,
      body: { error: error.message }
    };
  }
};

export default httpTrigger;
```

## DigitalOcean

### App Platform Deployment

```yaml
# .do/app.yaml
name: crewai-app
region: nyc
services:
- name: api
  github:
    repo: your-org/crewai-team
    branch: main
    deploy_on_push: true
  build_command: pnpm build
  run_command: pnpm start:prod
  environment_slug: node-js
  instance_size_slug: professional-xs
  instance_count: 3
  http_port: 3000
  envs:
  - key: NODE_ENV
    value: production
  - key: DATABASE_URL
    value: ${db.DATABASE_URL}
  - key: REDIS_URL
    value: ${redis.REDIS_URL}
  health_check:
    http_path: /api/health
    initial_delay_seconds: 10
    period_seconds: 10

databases:
- name: db
  engine: PG
  version: "14"
  size: db-s-1vcpu-1gb
  num_nodes: 1

- name: redis
  engine: REDIS
  version: "7"
  size: db-s-1vcpu-1gb
  num_nodes: 1
```

### Kubernetes Deployment

```bash
# Create DOKS cluster
doctl kubernetes cluster create crewai-k8s \
  --region nyc1 \
  --size s-2vcpu-4gb \
  --count 3 \
  --auto-upgrade \
  --surge-upgrade

# Deploy
kubectl apply -k k8s/
```

## Heroku

### Heroku Deployment

```json
// app.json
{
  "name": "CrewAI Team",
  "description": "Multi-agent email processing system",
  "repository": "https://github.com/your-org/crewai-team",
  "logo": "https://crewai.com/logo.png",
  "keywords": ["node", "express", "websocket", "ai"],
  "addons": [
    {
      "plan": "heroku-postgresql:standard-0"
    },
    {
      "plan": "heroku-redis:premium-0"
    }
  ],
  "env": {
    "NODE_ENV": {
      "value": "production"
    },
    "JWT_SECRET": {
      "description": "Secret for JWT tokens",
      "generator": "secret"
    },
    "SESSION_SECRET": {
      "description": "Secret for sessions",
      "generator": "secret"
    }
  },
  "formation": {
    "web": {
      "quantity": 1,
      "size": "standard-2x"
    },
    "worker": {
      "quantity": 2,
      "size": "standard-1x"
    }
  },
  "buildpacks": [
    {
      "url": "heroku/nodejs"
    }
  ]
}
```

### Procfile

```
web: node dist/index.js
worker: node dist/worker.js
release: node dist/migrate.js
```

## Render

### render.yaml

```yaml
services:
  - type: web
    name: crewai-api
    env: node
    region: oregon
    plan: standard
    buildCommand: pnpm install && pnpm build
    startCommand: pnpm start:prod
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: crewai-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: crewai-redis
          type: pserv
          property: connectionString
    autoDeploy: true

  - type: pserv
    name: crewai-redis
    env: docker
    region: oregon
    plan: standard
    dockerfilePath: ./docker/redis.Dockerfile
    disk:
      name: redis-data
      mountPath: /data
      sizeGB: 10

databases:
  - name: crewai-db
    databaseName: crewai
    user: crewai
    region: oregon
    plan: standard
```

## Cost Optimization

### Multi-Cloud Cost Comparison

```yaml
# cost-comparison.yaml
services:
  crewai-app:
    aws:
      service: ECS Fargate
      specs: 2 vCPU, 4GB RAM
      monthly_cost: $72.48
    gcp:
      service: Cloud Run
      specs: 2 vCPU, 4GB RAM
      monthly_cost: $49.68
    azure:
      service: Container Instances
      specs: 2 vCPU, 4GB RAM
      monthly_cost: $68.40
    
  database:
    aws:
      service: RDS PostgreSQL
      specs: db.t3.medium
      monthly_cost: $68.40
    gcp:
      service: Cloud SQL
      specs: db-n1-standard-1
      monthly_cost: $51.50
    azure:
      service: Database for PostgreSQL
      specs: B_Gen5_2
      monthly_cost: $62.78
    
  cache:
    aws:
      service: ElastiCache
      specs: cache.t3.micro
      monthly_cost: $12.41
    gcp:
      service: Memorystore
      specs: 1GB Basic
      monthly_cost: $35.04
    azure:
      service: Cache for Redis
      specs: C0 250MB
      monthly_cost: $16.06
```

### Cost Optimization Strategies

1. **Reserved Instances**: Save up to 75% with 1-3 year commitments
2. **Spot Instances**: Save up to 90% for fault-tolerant workloads
3. **Auto-scaling**: Scale down during low traffic periods
4. **Region Selection**: Choose cheaper regions when possible
5. **Storage Optimization**: Use lifecycle policies for old data
6. **Network Optimization**: Use CDN to reduce egress costs

## Multi-Cloud Strategy

### Terraform Multi-Cloud Module

```hcl
# modules/crewai/main.tf
variable "cloud_provider" {
  description = "Cloud provider to deploy to"
  type        = string
  validation {
    condition     = contains(["aws", "gcp", "azure"], var.cloud_provider)
    error_message = "Cloud provider must be aws, gcp, or azure."
  }
}

module "aws" {
  source = "./aws"
  count  = var.cloud_provider == "aws" ? 1 : 0
  
  app_name    = var.app_name
  environment = var.environment
}

module "gcp" {
  source = "./gcp"
  count  = var.cloud_provider == "gcp" ? 1 : 0
  
  app_name    = var.app_name
  environment = var.environment
}

module "azure" {
  source = "./azure"
  count  = var.cloud_provider == "azure" ? 1 : 0
  
  app_name    = var.app_name
  environment = var.environment
}

output "app_url" {
  value = coalesce(
    try(module.aws[0].app_url, ""),
    try(module.gcp[0].app_url, ""),
    try(module.azure[0].app_url, "")
  )
}
```

## Best Practices

1. **Use managed services**: Reduce operational overhead
2. **Implement proper tagging**: Track costs and resources
3. **Enable monitoring**: Use cloud-native monitoring tools
4. **Automate deployments**: Use CI/CD pipelines
5. **Regular backups**: Automate and test restore procedures
6. **Security scanning**: Use cloud security centers
7. **Cost alerts**: Set up budget alerts
8. **Documentation**: Keep deployment docs updated
9. **Disaster recovery**: Plan for region failures
10. **Compliance**: Ensure regulatory compliance

## Next Steps

1. Choose your cloud provider
2. Set up infrastructure as code
3. Configure CI/CD pipelines
4. Implement monitoring and alerting
5. Set up disaster recovery
6. Optimize costs
7. Document procedures