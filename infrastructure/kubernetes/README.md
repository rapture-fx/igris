# Kubernetes Deployment for Schlep-engine

This directory contains reference manifests for running the Schlep-engine stack on Kubernetes. These files are **minimal starting points**— customise them to fit your cluster standards (namespaces, resource limits, ingress, secrets, etc.).

## Prerequisites

* Kubernetes v1.24+
* A container registry (e.g. GitHub Container Registry) where the CI pipeline pushes images `ghcr.io/your-org/Schlep-engine-*`.
* `kubectl` configured to talk to your cluster.
* A `Schlep-engine-secrets` Secret containing `DATABASE_URL`, `REDIS_URL` and any other sensitive values required by the backend.

```bash
kubectl create secret generic Schlep-engine-secrets \
  --from-literal=DATABASE_URL=postgresql://user:pass@db/Schlep-engine \
  --from-literal=REDIS_URL=redis://redis:6379/0
```

## Deploy

```bash
# Backend
kubectl apply -f backend-deployment.yaml

# Frontend
kubectl apply -f frontend-deployment.yaml
```

## Next steps

1. Add an Ingress or LoadBalancer Service to expose the frontend & API publicly.
2. Configure Horizontal Pod Autoscalers (HPA) based on CPU / custom metrics.
3. Attach Prometheus scraping annotations or OpenTelemetry sidecars for metrics/tracing.
4. Move hard-coded image tags to an automated release process (e.g. GitHub Actions environment variables). 