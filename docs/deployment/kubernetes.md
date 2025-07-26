# Kubernetes Deployment Guide

## Overview

This guide covers deploying CrewAI Team on Kubernetes, including configuration, scaling, monitoring, and best practices for production deployments.

## Prerequisites

- Kubernetes cluster (1.21+)
- kubectl configured
- Helm 3 (optional but recommended)
- Ingress controller (nginx-ingress recommended)
- cert-manager for TLS certificates
- Persistent volume provisioner

## Quick Start

```bash
# Create namespace
kubectl create namespace crewai

# Apply all manifests
kubectl apply -k k8s/

# Check deployment status
kubectl get pods -n crewai
kubectl get services -n crewai
```

## Kubernetes Manifests

### Namespace

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: crewai
  labels:
    name: crewai
    environment: production
```

### ConfigMap

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: crewai-config
  namespace: crewai
data:
  NODE_ENV: "production"
  API_PORT: "3000"
  WS_PORT: "3001"
  LOG_LEVEL: "info"
  ENABLE_BUSINESS_SEARCH: "true"
  ENABLE_RATE_LIMITING: "true"
  ENABLE_METRICS: "true"
  METRICS_PORT: "9090"
  # Database config
  DATABASE_TYPE: "postgresql"
  DATABASE_HOST: "postgres-service"
  DATABASE_PORT: "5432"
  DATABASE_NAME: "crewai"
  # Redis config
  REDIS_HOST: "redis-service"
  REDIS_PORT: "6379"
```

### Secret

```yaml
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: crewai-secrets
  namespace: crewai
type: Opaque
stringData:
  DATABASE_PASSWORD: "your-db-password"
  JWT_SECRET: "your-jwt-secret"
  SESSION_SECRET: "your-session-secret"
  WEBSEARCH_API_KEY: "your-websearch-api-key"
  OPENAI_API_KEY: "your-openai-api-key"
  REDIS_PASSWORD: "your-redis-password"
```

### Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crewai-app
  namespace: crewai
  labels:
    app: crewai
    component: api
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: crewai
      component: api
  template:
    metadata:
      labels:
        app: crewai
        component: api
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: crewai-sa
      securityContext:
        fsGroup: 1001
        runAsNonRoot: true
        runAsUser: 1001
      containers:
      - name: crewai
        image: crewai/team:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
          name: http
          protocol: TCP
        - containerPort: 3001
          name: websocket
          protocol: TCP
        - containerPort: 9090
          name: metrics
          protocol: TCP
        env:
        - name: DATABASE_URL
          value: "postgresql://$(DATABASE_USER):$(DATABASE_PASSWORD)@$(DATABASE_HOST):$(DATABASE_PORT)/$(DATABASE_NAME)"
        - name: REDIS_URL
          value: "redis://default:$(REDIS_PASSWORD)@$(REDIS_HOST):$(REDIS_PORT)"
        envFrom:
        - configMapRef:
            name: crewai-config
        - secretRef:
            name: crewai-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /api/ready
            port: http
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        volumeMounts:
        - name: data
          mountPath: /app/data
        - name: logs
          mountPath: /app/logs
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: crewai-data-pvc
      - name: logs
        emptyDir: {}
```

### Service

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: crewai-service
  namespace: crewai
  labels:
    app: crewai
spec:
  type: ClusterIP
  selector:
    app: crewai
    component: api
  ports:
  - name: http
    port: 80
    targetPort: 3000
    protocol: TCP
  - name: websocket
    port: 3001
    targetPort: 3001
    protocol: TCP
  - name: metrics
    port: 9090
    targetPort: 9090
    protocol: TCP
```

### Ingress

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: crewai-ingress
  namespace: crewai
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    # WebSocket support
    nginx.ingress.kubernetes.io/websocket-services: "crewai-service"
    nginx.ingress.kubernetes.io/upstream-hash-by: "$remote_addr"
spec:
  tls:
  - hosts:
    - api.crewai.com
    secretName: crewai-tls
  rules:
  - host: api.crewai.com
    http:
      paths:
      - path: /ws
        pathType: Prefix
        backend:
          service:
            name: crewai-service
            port:
              number: 3001
      - path: /
        pathType: Prefix
        backend:
          service:
            name: crewai-service
            port:
              number: 80
```

### Horizontal Pod Autoscaler

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: crewai-hpa
  namespace: crewai
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: crewai-app
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "1000"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 60
      - type: Pods
        value: 2
        periodSeconds: 60
```

### Persistent Volume Claim

```yaml
# k8s/pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: crewai-data-pvc
  namespace: crewai
spec:
  accessModes:
  - ReadWriteMany
  storageClassName: standard
  resources:
    requests:
      storage: 10Gi
```

### PostgreSQL StatefulSet

```yaml
# k8s/postgres.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: crewai
spec:
  serviceName: postgres-service
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:14-alpine
        ports:
        - containerPort: 5432
          name: postgres
        env:
        - name: POSTGRES_DB
          value: crewai
        - name: POSTGRES_USER
          value: crewai
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: crewai-secrets
              key: DATABASE_PASSWORD
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "1Gi"
            cpu: "500m"
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: standard
      resources:
        requests:
          storage: 20Gi
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: crewai
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
```

### Redis Deployment

```yaml
# k8s/redis.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: crewai
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        command:
        - redis-server
        - --requirepass
        - $(REDIS_PASSWORD)
        - --appendonly
        - "yes"
        ports:
        - containerPort: 6379
          name: redis
        env:
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: crewai-secrets
              key: REDIS_PASSWORD
        volumeMounts:
        - name: redis-data
          mountPath: /data
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
      volumes:
      - name: redis-data
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: redis-service
  namespace: crewai
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
```

## Helm Chart

### Chart.yaml

```yaml
# helm/crewai/Chart.yaml
apiVersion: v2
name: crewai
description: CrewAI Team - Multi-Agent Email Processing System
type: application
version: 2.1.0
appVersion: "2.1.0"
keywords:
  - crewai
  - email
  - agents
  - ai
maintainers:
  - name: CrewAI Team
    email: team@crewai.com
```

### values.yaml

```yaml
# helm/crewai/values.yaml
replicaCount: 3

image:
  repository: crewai/team
  pullPolicy: IfNotPresent
  tag: "latest"

serviceAccount:
  create: true
  annotations: {}
  name: ""

service:
  type: ClusterIP
  port: 80
  wsPort: 3001
  metricsPort: 9090

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: api.crewai.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: crewai-tls
      hosts:
        - api.crewai.com

resources:
  limits:
    cpu: 1000m
    memory: 2Gi
  requests:
    cpu: 250m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

persistence:
  enabled: true
  storageClass: "standard"
  accessMode: ReadWriteMany
  size: 10Gi

postgresql:
  enabled: true
  auth:
    database: crewai
    username: crewai
    existingSecret: crewai-secrets
    secretKeys:
      adminPasswordKey: DATABASE_PASSWORD
  persistence:
    enabled: true
    size: 20Gi

redis:
  enabled: true
  auth:
    enabled: true
    existingSecret: crewai-secrets
    existingSecretPasswordKey: REDIS_PASSWORD
  persistence:
    enabled: true
    size: 8Gi

config:
  nodeEnv: production
  logLevel: info
  features:
    businessSearch: true
    rateLimiting: true
    metrics: true

secrets:
  create: true
  jwtSecret: ""
  sessionSecret: ""
  websearchApiKey: ""
  openaiApiKey: ""
```

### Helm Installation

```bash
# Install with Helm
helm install crewai ./helm/crewai \
  --namespace crewai \
  --create-namespace \
  --set image.tag=v2.1.0 \
  --set ingress.hosts[0].host=api.crewai.com

# Upgrade
helm upgrade crewai ./helm/crewai \
  --namespace crewai \
  --set image.tag=v2.1.1

# Rollback
helm rollback crewai 1 --namespace crewai
```

## Monitoring with Prometheus

### ServiceMonitor

```yaml
# k8s/servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: crewai-metrics
  namespace: crewai
  labels:
    app: crewai
spec:
  selector:
    matchLabels:
      app: crewai
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "CrewAI Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(api_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Response Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, api_request_duration_seconds_bucket)"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(api_requests_total{status=~\"5..\"}[5m])"
          }
        ]
      },
      {
        "title": "Active WebSocket Connections",
        "targets": [
          {
            "expr": "websocket_connections_active"
          }
        ]
      }
    ]
  }
}
```

## Backup and Restore

### Backup CronJob

```yaml
# k8s/backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: crewai-backup
  namespace: crewai
spec:
  schedule: "0 2 * * *" # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:14-alpine
            command:
            - /bin/sh
            - -c
            - |
              TIMESTAMP=$(date +%Y%m%d_%H%M%S)
              pg_dump -h postgres-service -U crewai crewai > /backup/crewai_$TIMESTAMP.sql
              # Upload to S3
              aws s3 cp /backup/crewai_$TIMESTAMP.sql s3://crewai-backups/
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: crewai-secrets
                  key: DATABASE_PASSWORD
            volumeMounts:
            - name: backup
              mountPath: /backup
          restartPolicy: OnFailure
          volumes:
          - name: backup
            persistentVolumeClaim:
              claimName: backup-pvc
```

## Security Best Practices

### Network Policies

```yaml
# k8s/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: crewai-network-policy
  namespace: crewai
spec:
  podSelector:
    matchLabels:
      app: crewai
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    - podSelector:
        matchLabels:
          app: crewai
    ports:
    - protocol: TCP
      port: 3000
    - protocol: TCP
      port: 3001
    - protocol: TCP
      port: 9090
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443 # HTTPS for external APIs
    - protocol: TCP
      port: 53  # DNS
    - protocol: UDP
      port: 53  # DNS
```

### Pod Security Policy

```yaml
# k8s/pod-security-policy.yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: crewai-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  hostNetwork: false
  hostIPC: false
  hostPID: false
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
  readOnlyRootFilesystem: false
```

## Troubleshooting

### Common Issues

1. **Pods not starting**
   ```bash
   kubectl describe pod <pod-name> -n crewai
   kubectl logs <pod-name> -n crewai
   ```

2. **Database connection issues**
   ```bash
   kubectl exec -it <pod-name> -n crewai -- nc -zv postgres-service 5432
   ```

3. **Ingress not working**
   ```bash
   kubectl get ingress -n crewai
   kubectl describe ingress crewai-ingress -n crewai
   ```

4. **Storage issues**
   ```bash
   kubectl get pvc -n crewai
   kubectl describe pvc crewai-data-pvc -n crewai
   ```

### Debug Commands

```bash
# Get all resources
kubectl get all -n crewai

# Check events
kubectl get events -n crewai --sort-by=.lastTimestamp

# Port forward for debugging
kubectl port-forward -n crewai svc/crewai-service 3000:80

# Execute commands in pod
kubectl exec -it -n crewai deployment/crewai-app -- sh

# Check resource usage
kubectl top pods -n crewai
kubectl top nodes
```

## Best Practices

1. **Use namespaces**: Isolate environments
2. **Set resource limits**: Prevent resource exhaustion
3. **Use health checks**: Ensure pod readiness
4. **Enable autoscaling**: Handle traffic spikes
5. **Implement network policies**: Secure pod communication
6. **Use secrets management**: Never hardcode credentials
7. **Monitor everything**: Set up comprehensive monitoring
8. **Regular backups**: Automate database backups
9. **Rolling updates**: Zero-downtime deployments
10. **Security scanning**: Scan images for vulnerabilities

## Next Steps

1. Set up monitoring with Prometheus/Grafana
2. Configure backup automation
3. Implement disaster recovery procedures
4. Set up GitOps with ArgoCD/Flux
5. Configure service mesh (Istio/Linkerd)