## Igris Runtime on Kubernetes

### Build an image

From `igris-runtime/`:

```bash
docker build -t igris-runtime:local -f Dockerfile .
```

### Apply manifests

```bash
kubectl apply -f k8s/
```

### Notes

- **Config**: edit `k8s/configmap.yaml` (mounted to `/app/config.json5`).
- **Data**: `k8s/pvc.yaml` provides `/app/data` persistent storage.
- **Models**: for local inference, mount models into `/app/models` (see `k8s/deployment.yaml`).


