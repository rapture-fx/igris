# Orchestration gRPC - Version Incompatibility

## Status: Active

The orchestration package provides gRPC services for distributed inference routing.
It is imported by `igris-overture/orchestration/grpc_server.go`,
`igris-overture/router/transaction_replay.go`, and
`igris-overture/router/state_checkpoint.go` — do not delete the generated files.

## Issue (resolved):

Generated proto files require grpc.SupportPackageIsVersion9 (gRPC-Go v1.64.0+).
`go.mod` already uses gRPC-Go v1.67.1, so the version condition is met.

## Required Fixes:
1. Update google.golang.org/grpc to v1.64.0 or later
2. Regenerate proto files with current protoc-gen-go-grpc version
3. Test gRPC service compatibility

## To Regenerate Proto Files:
```bash
cd /Users/wira/Desktop/igris-inertial
protoc --go_out=. --go_opt=paths=source_relative \
  --go-grpc_out=. --go-grpc_opt=paths=source_relative \
  labs/proto/orchestration/inference_router.proto
```

## Workaround:
The main igris-inertial API works without gRPC orchestration.
gRPC is only needed for distributed multi-node deployments.

