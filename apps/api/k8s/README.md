# Schlep Engine Kubernetes Manifests

Cloud-agnostic Kubernetes deployment for Schlep Engine v2.0.0.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Ingress/LB    │    │   Prometheus    │    │    Grafana      │
│                 │    │   Monitoring    │    │ Visualization   │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
    ┌─────▼──────────────────────▼──────────────────────▼─────┐
    │                Schlep Engine API                        │
    │              (3-20 replicas, HPA)                      │
    └─────┬───────────────────────┬───────────────────────────┘
          │                       │
    ┌─────▼─────┐           ┌─────▼─────┐
    │PostgreSQL │           │   Redis   │
    │ Database  │           │   Cache   │
    └───────────┘           └───────────┘
```

## Quick Start

1. **Apply all manifests:**
   ```bash
   kubectl apply -f k8s/
   ```

2. **Check deployment status:**
   ```bash
   kubectl get pods -n schlep-engine -w
   ```

3. **Access the application:**
   ```bash
   # Port forward for local access
   kubectl port-forward -n schlep-engine service/schlep-engine-service 8000:80

   # Or configure ingress with your domain
   # Edit ingress.yaml to set your domain name
   ```

## Deployment Options

### Minimal Deployment (25 dependencies)
```bash
# Build minimal image
docker build -f Dockerfile.minimal -t schlep-engine:2.0.0-minimal .

# Update deployment.yaml image reference
# image: schlep-engine:2.0.0-minimal
```

### ML-Enhanced Deployment (65 dependencies)
```bash
# Build ML image with PyTorch
docker build -f Dockerfile.ml --build-arg ENABLE_TORCH=true -t schlep-engine:2.0.0-ml .

# Update deployment.yaml image reference
# image: schlep-engine:2.0.0-ml

# Enable ML features in configmap.yaml
# ENABLE_TORCH: "true"
```

## Configuration

### Environment Variables
All configuration is managed through:
- `configmap.yaml` - Non-sensitive configuration
- `secrets.yaml` - Sensitive data (passwords, keys)

### Storage Options

#### Local Filesystem (Default)
```yaml
STORAGE_BACKEND: "filesystem"
STORAGE_PATH: "/data"
```

#### S3-Compatible (MinIO/Ceph)
```yaml
STORAGE_BACKEND: "s3-compatible"
S3_ENDPOINT_URL: "http://minio-service:9000"
S3_BUCKET: "schlep-data"
```

#### NFS Storage
```yaml
STORAGE_BACKEND: "nfs"
NFS_SERVER: "nfs-server"
NFS_PATH: "/exports/schlep"
```

## Scaling Configuration

### Horizontal Pod Autoscaler (HPA)
- **Min replicas:** 3
- **Max replicas:** 20
- **CPU target:** 70%
- **Memory target:** 80%
- **Custom metric:** 100 requests/second per pod

### Vertical Pod Autoscaler (VPA)
- **Update mode:** Auto
- **Min resources:** 512Mi RAM, 100m CPU
- **Max resources:** 8Gi RAM, 4000m CPU

### Resource Allocation

#### Per Pod Resources
```yaml
requests:
  memory: "1Gi"
  cpu: "500m"
limits:
  memory: "4Gi"
  cpu: "2000m"
```

#### Total Cluster Resources (20 pods max)
- **Memory:** 20-80Gi
- **CPU:** 10-40 cores
- **Storage:** 170Gi (data + logs + databases)

## Monitoring Stack

### Prometheus Metrics
- **Application metrics:** `/metrics` endpoint
- **System metrics:** CPU, memory, disk, network
- **Custom metrics:** CSV processing, API performance
- **Alert rules:** 4 predefined alerts

### Grafana Dashboards
- **Default login:** admin/admin (change in production)
- **Preconfigured dashboards:** API overview, system resources
- **Real-time monitoring:** 5-second refresh

### AlertManager (Optional)
Configure alerting destinations in monitoring.yaml.

## High Availability Features

### Pod Disruption Budget
- **Min available:** 2 pods during updates
- **Rolling updates:** 1 pod max unavailable

### Health Checks
- **Liveness:** `/health` every 30s
- **Readiness:** `/health` every 10s
- **Startup:** `/health` with 30 retries

### Database Persistence
- **PostgreSQL:** 50Gi persistent volume
- **Redis:** 10Gi persistent volume (optional)

## Security Configuration

### RBAC (Role-Based Access Control)
```bash
# Create service account with minimal permissions
kubectl create serviceaccount schlep-engine -n schlep-engine
```

### Network Policies
```yaml
# Restrict pod-to-pod communication
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: schlep-engine-network-policy
  namespace: schlep-engine
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: schlep-engine
  policyTypes:
  - Ingress
  - Egress
```

### Secrets Management
1. **Update all default passwords in secrets.yaml**
2. **Use external secret management (Vault, etc.)**
3. **Enable TLS for ingress with cert-manager**

## Production Checklist

- [ ] Update all default passwords in `secrets.yaml`
- [ ] Configure your domain name in `ingress.yaml`
- [ ] Set appropriate resource limits based on your cluster
- [ ] Configure persistent storage classes
- [ ] Set up backup strategy for PostgreSQL
- [ ] Configure alerting destinations
- [ ] Enable TLS/SSL certificates
- [ ] Review and apply security policies
- [ ] Configure monitoring retention policies
- [ ] Set up log aggregation (ELK, Loki, etc.)

## Troubleshooting

### Check Pod Status
```bash
kubectl get pods -n schlep-engine
kubectl describe pod <pod-name> -n schlep-engine
kubectl logs <pod-name> -n schlep-engine
```

### Check Service Connectivity
```bash
kubectl get svc -n schlep-engine
kubectl exec -it <pod-name> -n schlep-engine -- curl http://postgresql-service:5432
```

### Check Ingress
```bash
kubectl get ingress -n schlep-engine
kubectl describe ingress schlep-engine-ingress -n schlep-engine
```

### Resource Usage
```bash
kubectl top pods -n schlep-engine
kubectl top nodes
```

## File Reference

| File | Purpose | Cloud-Agnostic |
|------|---------|----------------|
| `namespace.yaml` | Kubernetes namespace | ✅ |
| `configmap.yaml` | Application configuration | ✅ |
| `secrets.yaml` | Sensitive configuration | ✅ |
| `pvc.yaml` | Persistent volume claims | ✅ |
| `deployment.yaml` | Main application deployment | ✅ |
| `service.yaml` | Service definitions | ✅ |
| `ingress.yaml` | External access configuration | ✅ |
| `hpa.yaml` | Auto-scaling configuration | ✅ |
| `postgresql.yaml` | Database deployment | ✅ |
| `redis.yaml` | Cache deployment | ✅ |
| `monitoring.yaml` | Prometheus + Grafana | ✅ |

All manifests are designed to work with any compliant Kubernetes cluster without cloud provider dependencies.