# Schlep-Engine API Dockerfile
# Multi-stage build for optimal image size

# Stage 1: Build Rust optimizer
FROM rust:1.75-slim as rust-builder

WORKDIR /build

# Copy Rust optimizer source
COPY internal/inference/optimizer/rust_optimizer /build/rust_optimizer

# Build Rust optimizer library
WORKDIR /build/rust_optimizer
RUN cargo build --release

# Stage 2: Build Go application
FROM golang:1.23-alpine as go-builder

# Install build dependencies
RUN apk add --no-cache git gcc musl-dev

WORKDIR /build

# Copy go mod files first (for layer caching)
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Copy Rust optimizer from previous stage
COPY --from=rust-builder /build/rust_optimizer/target/release/librust_optimizer.so /build/internal/inference/optimizer/rust_optimizer/target/release/

# Build Go application
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo \
    -ldflags="-s -w" \
    -o igris-overture \
    ./cmd/igris-overture

# Stage 3: Final runtime image
FROM alpine:latest

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata

# Create non-root user
RUN addgroup -g 1000 schlep && \
    adduser -D -u 1000 -G schlep schlep

WORKDIR /app

# Copy binary from builder
COPY --from=go-builder /build/igris-overture .

# Copy Rust library
COPY --from=rust-builder /build/rust_optimizer/target/release/librust_optimizer.so /usr/local/lib/

# Update library path
ENV LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH

# Change ownership
RUN chown -R schlep:schlep /app

# Switch to non-root user
USER schlep

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/v1/health || exit 1

# Run the application
CMD ["./igris-overture"]
