# DevOps & Monitoring Implementation

This document outlines the comprehensive DevOps & Monitoring implementation for the Schlep-engine platform, including CI/CD pipelines, automated testing, deployment automation, and monitoring solutions.

## Table of Contents

1. [CI/CD Pipeline](#cicd-pipeline)
2. [Automated Testing Suite](#automated-testing-suite)
3. [Deployment Automation](#deployment-automation)
4. [Monitoring & Observability](#monitoring--observability)
5. [Security & Compliance](#security--compliance)
6. [Performance & Load Testing](#performance--load-testing)
7. [Disaster Recovery](#disaster-recovery)
8. [Usage Examples](#usage-examples)

## CI/CD Pipeline

### Enhanced GitHub Actions Workflow

The enhanced CI/CD pipeline (`enhanced-ci-cd.yml`) provides comprehensive automation:

#### Pipeline Stages

1. **Code Quality & Security**
   - SonarQube analysis
   - Semgrep security scanning
   - Code coverage reporting

2. **Backend Testing Suite**
   - Unit tests (Python 3.11, 3.12)
   - Integration tests
   - End-to-end tests
   - Security vulnerability scanning
   - Dependency analysis

3. **Frontend Testing Suite**
   - Unit tests (Node.js 18.x, 20.x)
   - Integration tests
   - End-to-end tests with Playwright
   - TypeScript type checking
   - ESLint and Prettier formatting

4. **Performance & Load Testing**
   - Load testing with Locust
   - Performance benchmarks
   - Concurrent user simulation

5. **Container Security & Build**
   - Multi-architecture Docker builds
   - Trivy vulnerability scanning
   - SBOM generation with Syft
   - Cosign image signing

6. **Deployment Stages**
   - Staging deployment (develop branch)
   - Production deployment (main branch)
   - Automated rollback capabilities

7. **Monitoring Setup**
   - Prometheus deployment
   - Grafana configuration
   - Alert management

### Pipeline Features

- **Multi-environment support**: Staging and production environments
- **Parallel execution**: Tests run in parallel for faster feedback
- **Caching**: Docker layer caching and dependency caching
- **Security scanning**: Multiple security tools integrated
- **Automated rollback**: Built-in rollback mechanisms
- **Performance monitoring**: Continuous performance tracking

## Automated Testing Suite

### Backend Testing

#### Unit Tests (`test_auth.py`)

```python
# Comprehensive authentication testing
class TestAuthentication:
    def test_user_registration_success(self, mock_db):
        """Test successful user registration"""
        
    def test_user_login_success(self, mock_db, sample_user):
        """Test successful user login"""
        
    def test_password_reset_request(self, mock_db, sample_user):
        """Test password reset request"""
        
    def test_api_key_creation(self, mock_db, sample_user):
        """Test API key creation"""
```

#### Integration Tests (`test_api_integration.py`)

```python
# End-to-end API testing
class TestAPIIntegration:
    def test_complete_data_processing_workflow(self, client, auth_headers):
        """Test complete data processing workflow"""
        
    def test_ml_pipeline_workflow(self, client, auth_headers):
        """Test complete ML pipeline workflow"""
        
    def test_concurrent_user_workflows(self, client):
        """Test multiple users working concurrently"""
```

#### End-to-End Tests (`test_end_to_end.py`)

```python
# Complete workflow testing
class TestCompleteUserWorkflow:
    def test_complete_data_processing_workflow(self, client, auth_headers):
        """Test complete data processing workflow from upload to results"""
        
    def test_large_file_processing(self, client, auth_headers):
        """Test processing of large files"""
        
    def test_api_response_times(self, client, auth_headers):
        """Test API response times under load"""
```

### Frontend Testing

#### Unit Tests (`FileUpload.test.tsx`)

```typescript
// Component testing with React Testing Library
describe('FileUpload Component', () => {
  it('handles file selection via click', async () => {
    // Test file upload functionality
  });
  
  it('shows upload progress', async () => {
    // Test progress indicators
  });
  
  it('handles file type validation', async () => {
    // Test validation logic
  });
});
```

#### Integration Tests (`auth-flow.test.tsx`)

```typescript
// Authentication flow testing
describe('Authentication Flow Integration Tests', () => {
  it('successfully signs in a user', async () => {
    // Test complete sign-in flow
  });
  
  it('handles 2FA setup flow', async () => {
    // Test two-factor authentication
  });
});
```

#### E2E Tests (`auth.spec.ts`)

```typescript
// Playwright end-to-end tests
test.describe('Authentication E2E Tests', () => {
  test('successful sign in', async ({ page }) => {
    // Complete browser-based testing
  });
  
  test('performance under load', async ({ page }) => {
    // Performance testing
  });
});
```

### Testing Configuration

#### Jest Configuration (`package.json`)

```json
{
  "jest": {
    "testEnvironment": "jsdom",
    "setupFilesAfterEnv": ["<rootDir>/jest.setup.js"],
    "moduleNameMapping": {
      "^@/(.*)$": "<rootDir>/src/$1"
    },
    "collectCoverageFrom": [
      "src/**/*.{js,jsx,ts,tsx}"
    ],
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

#### Test Setup (`jest.setup.js`)

```javascript
// Comprehensive test environment setup
import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      // ... other router methods
    };
  },
}));

// Mock browser APIs
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};
```

## Deployment Automation

### Kubernetes Deployment

#### Complete Deployment Configuration (`deployment.yaml`)

```yaml
# Comprehensive Kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: schlep-engine-backend
  namespace: schlep-engine
spec:
  replicas: 3
  selector:
    matchLabels:
      app: schlep-engine-backend
  template:
    metadata:
      labels:
        app: schlep-engine-backend
    spec:
      containers:
      - name: backend
        image: ghcr.io/schlep-engine/backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            configMapKeyRef:
              name: schlep-engine-config
              key: DATABASE_URL
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
```

#### Auto-scaling Configuration

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: schlep-engine-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: schlep-engine-backend
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
```

### Automated Deployment Script

#### Deployment Script (`deploy.sh`)

```bash
#!/bin/bash

# Comprehensive deployment automation
main() {
    log "Starting deployment to $DEPLOYMENT_ENV environment"
    
    # Execute deployment steps
    check_prerequisites
    run_tests
    build_images
    push_images
    create_namespace
    create_secrets
    deploy_database
    deploy_redis
    deploy_application
    deploy_monitoring
    configure_ingress
    health_check
    performance_test
    cleanup
    
    success "Deployment to $DEPLOYMENT_ENV completed successfully!"
}

# Health check function
health_check() {
    log "Performing health check..."
    
    # Check backend health
    BACKEND_URL="https://$API_DOMAIN/health"
    for i in {1..10}; do
        if curl -f -s "$BACKEND_URL" > /dev/null; then
            success "Backend health check passed"
            break
        else
            warning "Backend health check failed, attempt $i/10"
            sleep 10
        fi
    done
}
```

## Monitoring & Observability

### Prometheus Configuration

#### Custom Metrics

```python
# Backend metrics collection
from prometheus_client import Counter, Histogram, Gauge

# Request metrics
REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
REQUEST_DURATION = Histogram('http_request_duration_seconds', 'HTTP request duration')

# Business metrics
ACTIVE_USERS = Gauge('active_users_total', 'Total active users')
PROCESSED_FILES = Counter('processed_files_total', 'Total files processed')
ML_JOBS_COMPLETED = Counter('ml_jobs_completed_total', 'Total ML jobs completed')
```

#### Grafana Dashboards

```json
{
  "dashboard": {
    "title": "Schlep-engine Overview",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{endpoint}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      }
    ]
  }
}
```

### Alerting Rules

```yaml
# Prometheus alerting rules
groups:
- name: schlep-engine-alerts
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }} errors per second"
  
  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High response time detected"
      description: "95th percentile response time is {{ $value }} seconds"
```

## Security & Compliance

### Security Scanning

#### Container Security

```yaml
# Trivy vulnerability scanning
- name: Scan API image with Trivy
  uses: aquasecurity/trivy-action@0.12.0
  with:
    scan-type: image
    image-ref: ghcr.io/${{ github.repository }}-backend:${{ github.sha }}
    format: table
    exit-code: 0
```

#### Code Security

```yaml
# Semgrep security scanning
- name: Run Semgrep Security Scan
  uses: returntocorp/semgrep-action@v1
  with:
    config: >-
      p/security-audit
      p/secrets
      p/owasp-top-ten
    outputFormat: sarif
    outputFile: semgrep-results.sarif
```

### Compliance Monitoring

```python
# Audit logging
import logging
from datetime import datetime

class AuditLogger:
    def __init__(self):
        self.logger = logging.getLogger('audit')
    
    def log_user_action(self, user_id: int, action: str, resource: str, details: dict):
        """Log user actions for compliance"""
        self.logger.info({
            'timestamp': datetime.utcnow().isoformat(),
            'user_id': user_id,
            'action': action,
            'resource': resource,
            'details': details,
            'ip_address': self.get_client_ip(),
            'user_agent': self.get_user_agent()
        })
```

## Performance & Load Testing

### Load Testing Configuration

```python
# Locust load testing
from locust import HttpUser, task, between

class SchlepEngineUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        """Login at the start of each user session"""
        self.client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
    
    @task(3)
    def upload_file(self):
        """Upload file task"""
        with open("test_data.csv", "rb") as f:
            self.client.post("/api/v1/data/upload", files={"file": f})
    
    @task(2)
    def get_dashboard(self):
        """Get dashboard task"""
        self.client.get("/api/v1/dashboard")
    
    @task(1)
    def process_data(self):
        """Process data task"""
        self.client.post("/api/v1/jobs/create", json={
            "job_type": "data_cleaning",
            "parameters": {"file_id": "test_file"}
        })
```

### Performance Benchmarks

```bash
# Performance testing script
#!/bin/bash

echo "Running performance benchmarks..."

# API response time test
echo "Testing API response times..."
ab -n 1000 -c 10 https://api.schlep-engine.com/health

# File upload performance
echo "Testing file upload performance..."
curl -X POST -F "file=@large_file.csv" https://api.schlep-engine.com/upload

# Database performance
echo "Testing database performance..."
python -m pytest tests/performance/test_database_performance.py
```

## Disaster Recovery

### Backup Strategy

```bash
# Automated backup script
#!/bin/bash

# Database backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# File storage backup
gsutil -m rsync -r gs://schlep-engine-storage gs://schlep-engine-backup

# Configuration backup
kubectl get all -n schlep-engine -o yaml > k8s_backup_$(date +%Y%m%d_%H%M%S).yaml
```

### Recovery Procedures

```bash
# Disaster recovery script
#!/bin/bash

echo "Starting disaster recovery..."

# Restore database
psql $DATABASE_URL < backup_latest.sql

# Restore file storage
gsutil -m rsync -r gs://schlep-engine-backup gs://schlep-engine-storage

# Restore Kubernetes resources
kubectl apply -f k8s_backup_latest.yaml

echo "Disaster recovery completed"
```

## Usage Examples

### Running the CI/CD Pipeline

```bash
# Trigger pipeline manually
gh workflow run enhanced-ci-cd.yml

# Check pipeline status
gh run list --workflow=enhanced-ci-cd.yml

# View pipeline logs
gh run view --log
```

### Deploying to Different Environments

```bash
# Deploy to staging
./scripts/deploy.sh staging

# Deploy to production
./scripts/deploy.sh production

# Check deployment status
kubectl get pods -n schlep-engine
kubectl get services -n schlep-engine
```

### Running Tests

```bash
# Run all backend tests
cd packages/backend
python -m pytest tests/ -v --cov=app

# Run frontend tests
cd packages/frontend
pnpm test --coverage

# Run E2E tests
pnpm test:e2e

# Run performance tests
python -m pytest tests/load_test.py -v
```

### Monitoring the Application

```bash
# Check application health
curl https://api.schlep-engine.com/health

# View Prometheus metrics
curl https://api.schlep-engine.com/metrics

# Access Grafana dashboard
open https://grafana.schlep-engine.com

# Check logs
kubectl logs -f deployment/schlep-engine-backend -n schlep-engine
```

### Scaling the Application

```bash
# Scale backend pods
kubectl scale deployment schlep-engine-backend --replicas=5 -n schlep-engine

# Check HPA status
kubectl get hpa -n schlep-engine

# Monitor scaling events
kubectl describe hpa schlep-engine-backend-hpa -n schlep-engine
```

## Best Practices

### CI/CD Best Practices

1. **Automated Testing**: All code changes must pass comprehensive tests
2. **Security Scanning**: Every build is scanned for vulnerabilities
3. **Immutable Deployments**: Use specific image tags, not 'latest'
4. **Rollback Strategy**: Automated rollback on deployment failures
5. **Environment Parity**: Staging environment mirrors production

### Monitoring Best Practices

1. **Comprehensive Metrics**: Monitor application, infrastructure, and business metrics
2. **Alerting Strategy**: Set up meaningful alerts with appropriate thresholds
3. **Log Aggregation**: Centralize logs for analysis and debugging
4. **Performance Baselines**: Establish performance baselines and track deviations
5. **Capacity Planning**: Monitor resource usage and plan for growth

### Security Best Practices

1. **Secret Management**: Use Kubernetes secrets and external secret managers
2. **Network Policies**: Implement network policies to restrict pod communication
3. **RBAC**: Use role-based access control for Kubernetes resources
4. **Image Scanning**: Scan all container images for vulnerabilities
5. **Audit Logging**: Log all security-relevant events

### Performance Best Practices

1. **Load Testing**: Regular load testing to identify bottlenecks
2. **Resource Limits**: Set appropriate resource requests and limits
3. **Auto-scaling**: Use HPA for automatic scaling based on demand
4. **Caching**: Implement caching strategies for frequently accessed data
5. **Database Optimization**: Regular database performance analysis and optimization

## Troubleshooting

### Common Issues

1. **Pipeline Failures**
   - Check test failures in the logs
   - Verify environment variables are set
   - Check for dependency issues

2. **Deployment Failures**
   - Check pod status and logs
   - Verify resource availability
   - Check configuration errors

3. **Performance Issues**
   - Monitor resource usage
   - Check for bottlenecks in logs
   - Analyze Prometheus metrics

4. **Security Issues**
   - Review security scan results
   - Check for exposed secrets
   - Verify network policies

### Debugging Commands

```bash
# Debug pod issues
kubectl describe pod <pod-name> -n schlep-engine
kubectl logs <pod-name> -n schlep-engine

# Debug service issues
kubectl get endpoints -n schlep-engine
kubectl describe service <service-name> -n schlep-engine

# Debug ingress issues
kubectl describe ingress -n schlep-engine
kubectl get events -n schlep-engine

# Debug HPA issues
kubectl describe hpa -n schlep-engine
kubectl top pods -n schlep-engine
```

This comprehensive DevOps & Monitoring implementation provides a robust foundation for the Schlep-engine platform, ensuring reliable deployments, comprehensive testing, and effective monitoring of the application in production environments. 