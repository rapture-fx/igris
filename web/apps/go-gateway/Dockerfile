# Multi-stage build for Go API Gateway with Rust FFI

# Stage 1: Build Rust kernel
FROM rust:1.74-slim as rust-builder

WORKDIR /rust
COPY rust_kernel/Cargo.toml rust_kernel/Cargo.lock ./
COPY rust_kernel/src ./src

# Build Rust library as shared object
RUN cargo build --release --lib

# Stage 2: Build Go application
FROM golang:1.21-alpine as go-builder

# Install build dependencies
RUN apk add --no-cache gcc musl-dev

WORKDIR /app

# Copy Rust library from previous stage
COPY --from=rust-builder /rust/target/release/libschlep_kernel.so /usr/local/lib/
RUN ldconfig || true

# Copy Go module files
COPY apps/go-gateway/go.mod apps/go-gateway/go.sum ./
RUN go mod download

# Copy Go source
COPY apps/go-gateway/ ./

# Build Go application
RUN CGO_ENABLED=1 GOOS=linux go build -o gateway ./cmd/api

# Stage 3: Runtime
FROM alpine:latest

# Install runtime dependencies
RUN apk add --no-cache ca-certificates libc6-compat

WORKDIR /app

# Copy Rust library
COPY --from=rust-builder /rust/target/release/libschlep_kernel.so /usr/local/lib/
RUN ldconfig || true

# Copy Go binary
COPY --from=go-builder /app/gateway .

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run
CMD ["./gateway"]
