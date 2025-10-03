# Multi-stage build for Go API Gateway with Rust FFI

# Stage 1: Build Rust kernel
FROM rust:1.74-alpine AS rust-builder

WORKDIR /build

# Install build dependencies
RUN apk add --no-cache musl-dev

# Copy Rust kernel source
COPY rust_kernel/Cargo.toml rust_kernel/Cargo.lock* ./
COPY rust_kernel/src ./src

# Build Rust library in release mode
RUN cargo build --release

# Stage 2: Build Go application
FROM golang:1.21-alpine AS go-builder

WORKDIR /build

# Install build dependencies
RUN apk add --no-cache gcc musl-dev

# Copy Go modules first for caching
COPY go_gateway/go.mod go_gateway/go.sum ./
RUN go mod download

# Copy Rust library from previous stage
COPY --from=rust-builder /build/target/release/libschlep_kernel.so /usr/local/lib/
COPY --from=rust-builder /build/target/release/libschlep_kernel.a /usr/local/lib/

# Set library path
ENV LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH

# Copy Go source code
COPY go_gateway/ ./

# Build Go application with CGO enabled
RUN CGO_ENABLED=1 GOOS=linux go build \
    -ldflags="-w -s -linkmode external -extldflags '-static'" \
    -o api-gateway \
    ./cmd/api

# Stage 3: Runtime image
FROM alpine:latest

# Install runtime dependencies
RUN apk add --no-cache ca-certificates libc6-compat

WORKDIR /app

# Copy binary from builder
COPY --from=go-builder /build/api-gateway ./
COPY --from=rust-builder /build/target/release/libschlep_kernel.so /usr/local/lib/

# Set library path
ENV LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run as non-root
RUN addgroup -g 1000 appuser && \
    adduser -D -u 1000 -G appuser appuser && \
    chown -R appuser:appuser /app

USER appuser

CMD ["./api-gateway"]
