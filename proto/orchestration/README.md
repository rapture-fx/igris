# Orchestration gRPC - Version Incompatibility

## Status: Temporarily Disabled  

The orchestration package provides gRPC services for distributed inference routing.
Currently disabled due to gRPC version incompatibility.

## Issue:
Generated proto files require grpc.SupportPackageIsVersion9 (gRPC-Go v1.64.0+)
Current project uses an older gRPC version.

## Required Fixes:
1. Update google.golang.org/grpc to v1.64.0 or later
2. Regenerate proto files with current protoc-gen-go-grpc version
3. Test gRPC service compatibility

## To Regenerate Proto Files:
```bash
cd /Users/wira/Desktop/schlep-engine
protoc --go_out=. --go_opt=paths=source_relative \
  --go-grpc_out=. --go-grpc_opt=paths=source_relative \
  labs/proto/orchestration/inference_router.proto
```

## Workaround:
The main schlep-engine API works without gRPC orchestration.
gRPC is only needed for distributed multi-node deployments.

