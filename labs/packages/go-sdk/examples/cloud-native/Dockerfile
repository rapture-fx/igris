# Multi-stage build for optimal image size
FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Set working directory
WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build \
    -a -installsuffix cgo \
    -ldflags '-w -s -extldflags "-static"' \
    -o main ./main.go

# Final stage: minimal runtime image
FROM scratch

# Copy timezone data
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

# Copy CA certificates
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy the binary
COPY --from=builder /app/main /app/main

# Create non-root user
USER 65534:65534

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD ["/app/main", "-healthcheck"] || exit 1

# Run the application
ENTRYPOINT ["/app/main"]

# Metadata labels
LABEL maintainer="Schlep-engine Team" \
      version="1.0.0" \
      description="Cloud-native microservice using Schlep-engine Go SDK" \
      org.opencontainers.image.source="https://github.com/igris-inertial/go-sdk" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.title="Schlep Cloud Native Service" \
      org.opencontainers.image.description="A cloud-native microservice demonstrating Schlep-engine Go SDK usage"