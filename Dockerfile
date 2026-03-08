# Igris Inertial — Overture API Dockerfile
# Multi-stage build: Rust libs → Go binary → minimal runtime

# Stage 1: Build Rust FFI libraries
FROM rust:1.75-slim AS rust-builder

RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy Rust kernel source
COPY rust-core/rust_kernel /build/rust_kernel
WORKDIR /build/rust_kernel
RUN cargo build --release

# Copy SLO enforcer source
COPY rust-core/production_slo_enforcer /build/slo_enforcer
WORKDIR /build/slo_enforcer
RUN cargo build --release

# Stage 2: Build Go application (with CGO for Rust FFI)
FROM golang:1.24-alpine AS go-builder

# Install build dependencies (CGO needs gcc + musl)
RUN apk add --no-cache git gcc musl-dev

WORKDIR /build

# Copy go mod files first (layer caching)
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY cmd/ ./cmd/
COPY igris-overture/ ./igris-overture/
COPY config/ ./config/

# Copy Rust static libraries from rust-builder
COPY --from=rust-builder /build/rust_kernel/target/release/libigris_kernel.a /build/rust-core/rust_kernel/target/release/
COPY --from=rust-builder /build/slo_enforcer/target/release/libigris_slo_enforcer.a /build/rust-core/production_slo_enforcer/target/release/

# Build Go binary
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo \
    -ldflags="-s -w" \
    -o igris-overture \
    ./cmd/igris-overture

# Stage 3: Minimal runtime image
FROM alpine:3.19

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata

# Create non-root user
RUN addgroup -g 1000 igris && \
    adduser -D -u 1000 -G igris igris

WORKDIR /app

# Copy binary from builder
COPY --from=go-builder /build/igris-overture .

# Copy database migrations
COPY igris-overture/database/migrations/ /app/migrations/

# Change ownership
RUN chown -R igris:igris /app

# Switch to non-root user
USER igris

# Expose API port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/v1/health || exit 1

# Run the application
CMD ["./igris-overture"]
