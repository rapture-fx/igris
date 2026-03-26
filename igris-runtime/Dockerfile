# Multi-stage build for Igris Runtime v1.1
FROM rust:latest as builder

WORKDIR /build

# Copy workspace files
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates

# Build release binary
RUN cargo build --release --bin igris-runtime

# Production stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -m -u 1000 igris

# Copy binary
COPY --from=builder /build/target/release/igris-runtime /usr/local/bin/

# Create directories
RUN mkdir -p /app/models /app/data && \
    chown -R igris:igris /app

# Switch to app user
USER igris
WORKDIR /app

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/v1/health || exit 1

# Run
CMD ["igris-runtime"]
