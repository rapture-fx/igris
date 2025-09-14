# Schlep Engine Kubernetes Production Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Schlep Engine platform on Kubernetes in a production environment with blue-green deployment capabilities, comprehensive monitoring, and enterprise security.

## Prerequisites

### Infrastructure Requirements
- Kubernetes cluster v1.24+
- NGINX Ingress Controller
- Cert-Manager for TLS certificates
- External DNS (optional but recommended)
- Container Registry (GitHub Container Registry configured)

### Tools Required
```bash
kubectl v1.24+
helm v3.0+
docker v20.10+
git v2.30+
```

### Cluster Specifications
- **Minimum Nodes**: 6 nodes (3 compute, 2 memory-optimized, 1 storage-optimized)
- **Node Resources**: 8 vCPU, 16GB RAM per compute node
- **Storage Classes**: fast-ssd, balanced-ssd
- **Network**: CNI with network policy support

## Deployment Steps

### Phase 1: Cluster Preparation

#### 1.1 Create Namespaces
```bash
kubectl apply -f infrastructure/kubernetes/base/namespace.yaml
```

#### 1.2 Configure Storage Classes
```bash
# Create fast SSD storage class for databases
cat <<EOF | kubectl apply -f -
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
provisioner: ebs.csi.aws.com
volumeBindingMode: WaitForFirstConsumer
reclaimPolicy: Retain
EOF
```

#### 1.3 Install Required Operators
```bash
# Install NGINX Ingress Controller
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace

# Install Cert-Manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.12.0/cert-manager.yaml

# Install Prometheus Operator (optional, if not using our manifests)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
```

### Phase 2: Security Configuration

#### 2.1 Apply Pod Security Policies
```bash
kubectl apply -f infrastructure/kubernetes/security/pod-security-policies.yaml
```

#### 2.2 Configure Network Policies
```bash
kubectl apply -f infrastructure/kubernetes/security/network-policies.yaml
```

#### 2.3 Validate Security Configuration
```bash
# Test network policies
kubectl run test-pod --image=nicolaka/netshoot --rm -it -- /bin/bash
```

### Phase 3: Secrets and Configuration

#### 3.1 Create Environment Variables File
```bash
# Create .env file with production values
cat > .env.production << EOF
# Database Configuration
POSTGRES_PASSWORD=<secure_password>
POSTGRES_ROOT_PASSWORD=<secure_root_password>

# Redis Configuration
REDIS_PASSWORD=<secure_redis_password>

# Application Secrets
SECRET_KEY=<generated_secret_key>
JWT_SECRET_KEY=<generated_jwt_secret>
API_KEY_SECRET=<generated_api_key_secret>

# OAuth Configuration
GOOGLE_CLIENT_ID=<google_oauth_client_id>
GOOGLE_CLIENT_SECRET=<google_oauth_client_secret>
GITHUB_CLIENT_ID=<github_oauth_client_id>
GITHUB_CLIENT_SECRET=<github_oauth_client_secret>

# SMTP Configuration
SMTP_USERNAME=<smtp_username>
SMTP_PASSWORD=<smtp_password>

# Cloud Storage
GCS_CREDENTIALS=<base64_encoded_gcs_credentials>
GCS_PROJECT_ID=<gcs_project_id>
AWS_ACCESS_KEY_ID=<aws_access_key>
AWS_SECRET_ACCESS_KEY=<aws_secret_access_key>

# Monitoring
GRAFANA_ADMIN_PASSWORD=<grafana_admin_password>
GRAFANA_SECRET_KEY=<grafana_secret_key>
GRAFANA_DB_PASSWORD=<grafana_db_password>
EOF
```

#### 3.2 Generate Base64 Encoded Secrets
```bash
# Helper script to generate base64 encoded secrets
./tools/scripts/generate-secrets.sh .env.production
```

#### 3.3 Apply Secrets and ConfigMaps
```bash
# Replace placeholders in secrets file
envsubst < infrastructure/kubernetes/base/secrets.yaml | kubectl apply -f -

# Apply ConfigMaps
kubectl apply -f infrastructure/kubernetes/base/configmap.yaml
```

### Phase 4: Database Layer Deployment

#### 4.1 Deploy PostgreSQL
```bash
kubectl apply -f infrastructure/kubernetes/base/postgres-deployment.yaml

# Wait for PostgreSQL to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=postgres --timeout=300s -n schlep-engine
```

#### 4.2 Initialize Database
```bash
# Run database migrations
kubectl exec -it postgres-0 -n schlep-engine -- psql -U schlep_user -d schlep_engine -c "SELECT version();"
```

#### 4.3 Verify PostgreSQL High Availability
```bash
# Check primary and replica status
kubectl get pods -l app.kubernetes.io/name=postgres -n schlep-engine
kubectl logs postgres-replica-0 -n schlep-engine | grep -i replica
```

### Phase 5: Cache Layer Deployment

#### 5.1 Deploy Redis Cluster
```bash
kubectl apply -f infrastructure/kubernetes/base/redis-deployment.yaml

# Wait for Redis to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=redis --timeout=300s -n schlep-engine
```

#### 5.2 Verify Redis Streams
```bash
# Check Redis stream initialization
kubectl exec -it redis-master-0 -n schlep-engine -- redis-cli -a $REDIS_PASSWORD XINFO GROUPS iot_sensors
```

### Phase 6: Application Services Deployment

#### 6.1 Deploy API Backend
```bash
# Build and push container images
docker build -t ghcr.io/schlep-engine/api:v1.0.0 ./apps/api
docker push ghcr.io/schlep-engine/api:v1.0.0

# Deploy API services
kubectl apply -f infrastructure/kubernetes/base/api-deployment.yaml

# Wait for API to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=api --timeout=300s -n schlep-engine
```

#### 6.2 Deploy Frontend Applications
```bash
# Build frontend images
docker build -t ghcr.io/schlep-engine/landing:v1.0.0 ./apps/web-landing
docker build -t ghcr.io/schlep-engine/admin:v1.0.0 ./apps/web-admin
docker build -t ghcr.io/schlep-engine/docs:v1.0.0 ./apps/web-docs
docker build -t ghcr.io/schlep-engine/console:v1.0.0 ./apps/web-console

# Push images
docker push ghcr.io/schlep-engine/landing:v1.0.0
docker push ghcr.io/schlep-engine/admin:v1.0.0
docker push ghcr.io/schlep-engine/docs:v1.0.0
docker push ghcr.io/schlep-engine/console:v1.0.0

# Deploy frontend services
kubectl apply -f infrastructure/kubernetes/base/frontend-deployments.yaml
```

### Phase 7: Load Balancing and Ingress

#### 7.1 Configure SSL Certificates
```bash
kubectl apply -f infrastructure/kubernetes/base/scaling-and-ingress.yaml

# Wait for certificate issuance
kubectl get certificate schlep-engine-tls -n schlep-engine -w
```

#### 7.2 Configure DNS
```bash
# Update DNS records to point to load balancer
kubectl get ingress schlep-engine-ingress -n schlep-engine -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

### Phase 8: Monitoring and Observability

#### 8.1 Deploy Prometheus Stack
```bash
kubectl apply -f infrastructure/kubernetes/monitoring/prometheus/prometheus-stack.yaml

# Wait for Prometheus to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=prometheus --timeout=300s -n schlep-engine-monitoring
```

#### 8.2 Deploy Grafana
```bash
kubectl apply -f infrastructure/kubernetes/monitoring/grafana/grafana-stack.yaml

# Get Grafana admin password
kubectl get secret grafana-secrets -n schlep-engine-monitoring -o jsonpath='{.data.admin_password}' | base64 -d
```

#### 8.3 Configure Monitoring Ingress
```bash
# Update DNS for monitoring endpoints
# https://grafana.schlep-engine.com
# https://prometheus.schlep-engine.com
```

### Phase 9: Autoscaling Configuration

#### 9.1 Enable Horizontal Pod Autoscaling
```bash
# HPA configurations are included in scaling-and-ingress.yaml
kubectl get hpa -n schlep-engine
```

#### 9.2 Configure Vertical Pod Autoscaling (Optional)
```bash
# Install VPA if not present
kubectl apply -f https://github.com/kubernetes/autoscaler/releases/latest/download/vpa-release.yaml

# Apply VPA configurations
kubectl apply -f - <<EOF
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: api-vpa
  namespace: schlep-engine
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-deployment
  updatePolicy:
    updateMode: "Auto"
EOF
```

### Phase 10: Blue-Green Deployment Setup

#### 10.1 Prepare Blue-Green Infrastructure
```bash
# Apply blue-green deployment configurations
kubectl apply -f infrastructure/kubernetes/blue-green/blue-green-strategy.yaml
```

#### 10.2 Test Blue-Green Deployment
```bash
# Test deployment script
cd infrastructure/kubernetes/blue-green
./deploy.sh api v1.0.1 --dry-run
```

### Phase 11: Health Checks and Validation

#### 11.1 Service Health Validation
```bash
# API Health Check
curl -f https://api.schlep-engine.com/health

# Database Connectivity
kubectl exec -it postgres-0 -n schlep-engine -- pg_isready -U schlep_user

# Redis Connectivity
kubectl exec -it redis-master-0 -n schlep-engine -- redis-cli -a $REDIS_PASSWORD ping

# Stream Processing
kubectl exec -it redis-master-0 -n schlep-engine -- redis-cli -a $REDIS_PASSWORD XINFO GROUPS iot_sensors
```

#### 11.2 Performance Validation
```bash
# Load testing (example with k6)
k6 run --vus 100 --duration 5m tests/load-test.js

# Monitor metrics during load test
kubectl top pods -n schlep-engine
```

#### 11.3 Security Validation
```bash
# Network policy testing
kubectl run security-test --image=nicolaka/netshoot --rm -it -n schlep-engine -- /bin/bash

# Try to access services that should be blocked
curl -m 5 postgres-service.schlep-engine.svc.cluster.local:5432  # Should timeout
```

## Post-Deployment Configuration

### Backup Configuration

#### Database Backups
```bash
# Configure automated PostgreSQL backups
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: schlep-engine
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: postgres-backup
            image: postgres:15-alpine
            command:
            - /bin/bash
            - -c
            - |
              pg_dump -h postgres-service -U schlep_user -d schlep_engine | \
              gzip > /backup/backup-\$(date +%Y%m%d-%H%M%S).sql.gz
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: schlep-engine-secrets
                  key: POSTGRES_PASSWORD
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: postgres-backup-pvc
          restartPolicy: OnFailure
EOF
```

### Monitoring Alerts Configuration

#### Critical Alerts
```bash
# Configure Slack webhook for alerts
kubectl create secret generic alertmanager-slack-webhook \
  --from-literal=url="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK" \
  -n schlep-engine-monitoring
```

## Rollback Procedures

### Application Rollback
```bash
# Quick rollback using blue-green deployment
cd infrastructure/kubernetes/blue-green
./deploy.sh api --rollback

# Standard Kubernetes rollback
kubectl rollout undo deployment/api-deployment -n schlep-engine
```

### Database Rollback
```bash
# Restore from backup
kubectl exec -it postgres-0 -n schlep-engine -- psql -U schlep_user -d schlep_engine < backup.sql
```

## Troubleshooting

### Common Issues

#### Pod Not Starting
```bash
# Check pod status and events
kubectl describe pod <pod-name> -n schlep-engine
kubectl logs <pod-name> -n schlep-engine --previous

# Check resource constraints
kubectl top pod <pod-name> -n schlep-engine
```

#### Network Connectivity Issues
```bash
# Test network policies
kubectl exec -it <pod-name> -n schlep-engine -- nslookup <service-name>
kubectl exec -it <pod-name> -n schlep-engine -- nc -zv <service-name> <port>
```

#### Performance Issues
```bash
# Check HPA status
kubectl get hpa -n schlep-engine

# Check resource utilization
kubectl top pods -n schlep-engine
kubectl describe nodes

# Check for resource contention
kubectl get events --sort-by='.lastTimestamp' -n schlep-engine
```

#### Blue-Green Deployment Issues
```bash
# Check deployment validation
kubectl logs -l app.kubernetes.io/name=deployment-validator -n schlep-engine

# Manual traffic switching
kubectl patch service api-service -n schlep-engine -p '{"spec":{"selector":{"deployment":"green"}}}'
```

## Maintenance Procedures

### Regular Maintenance Tasks

#### Weekly
- Review resource utilization and adjust requests/limits
- Check backup integrity
- Review security alerts and logs
- Update container images (security patches)

#### Monthly
- Kubernetes cluster updates
- Certificate renewal (automated with cert-manager)
- Storage cleanup and optimization
- Performance baseline review

#### Quarterly
- Disaster recovery testing
- Security audit and penetration testing
- Resource optimization review
- Cost optimization analysis

### Scaling Operations

#### Manual Scaling
```bash
# Scale API deployment
kubectl scale deployment api-deployment --replicas=10 -n schlep-engine

# Scale database read replicas
kubectl scale statefulset postgres-replica --replicas=3 -n schlep-engine
```

#### Cluster Scaling
```bash
# AWS EKS cluster scaling
eksctl scale nodegroup --cluster=schlep-engine --nodes=10 --nodes-max=20 compute-nodes

# GKE cluster scaling
gcloud container clusters resize schlep-engine --num-nodes=10
```

## Security Maintenance

### Certificate Management
```bash
# Check certificate expiration
kubectl get certificates -n schlep-engine

# Force certificate renewal
kubectl delete secret schlep-engine-tls -n schlep-engine
```

### Secret Rotation
```bash
# Rotate database password
kubectl create secret generic schlep-engine-secrets-new --from-literal=POSTGRES_PASSWORD=<new_password> -n schlep-engine
kubectl patch deployment api-deployment -n schlep-engine -p '{"spec":{"template":{"spec":{"containers":[{"name":"api","env":[{"name":"SECRET_ROTATION_TRIGGER","value":"'$(date +%s)'"}]}]}}}}'
```

## Performance Optimization

### Database Optimization
```bash
# Analyze slow queries
kubectl exec -it postgres-0 -n schlep-engine -- psql -U schlep_user -d schlep_engine -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Optimize vacuum and analyze
kubectl exec -it postgres-0 -n schlep-engine -- psql -U schlep_user -d schlep_engine -c "VACUUM ANALYZE;"
```

### Cache Optimization
```bash
# Monitor Redis performance
kubectl exec -it redis-master-0 -n schlep-engine -- redis-cli -a $REDIS_PASSWORD INFO stats

# Optimize memory usage
kubectl exec -it redis-master-0 -n schlep-engine -- redis-cli -a $REDIS_PASSWORD CONFIG SET maxmemory-policy allkeys-lru
```

This production deployment guide ensures a robust, scalable, and secure deployment of the Schlep Engine platform on Kubernetes with comprehensive monitoring, backup, and recovery procedures.