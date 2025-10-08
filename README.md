# Schlep Engine: A Polyglot Microservice Architecture

This repository contains the source code for the Schlep Engine, a high-performance backend system demonstrating a hybrid polyglot architecture. The system is composed of three core services working in concert: a Go API gateway, a Rust computational kernel, and a Python machine learning service.

## Architecture Overview

The system is designed to leverage the strengths of each language for its specific task:

-   **Go (`go_gateway`)** for high-concurrency network I/O and request handling.
-   **Rust (`rust_kernel`)** for CPU-intensive, safe, and fast computations.
-   **Python (`python_ml`)** for its rich machine learning ecosystem.

A client interacts with the Go gateway, which then orchestrates calls to the other two services as needed.

```
+--------+      HTTP Request      +--------------+
| Client | ---------------------> |  Go Gateway  |
+--------+                        +--------------+
                                   |          ^
                                   |          |
                   FFI Call (fast) |          | gRPC Call (ML)
                                   v          |
                              +-------------+ | +------------------+
                              | Rust Kernel | | | Python ML Service|
                              +-------------+ +------------------+
```

---

## Core Components

### 1. Go Gateway (`go_gateway/`)

The primary entry point for all API requests. It is a lightweight web server built with [Fiber](https://gofiber.io/) that routes requests to the appropriate backend service.

-   **Responsibilities:**
    -   Exposing a public REST API.
    -   Calling the Rust Kernel via FFI for high-performance tasks (e.g., calculations, data validation).
    -   Calling the Python ML Service via gRPC for machine learning predictions.

### 2. Python ML Service (`python_ml/`)

A gRPC service dedicated to serving machine learning models. This isolates the Python environment and its dependencies, allowing it to be scaled and managed independently.

-   **Responsibilities:**
    -   Loading and managing ML models (e.g., PyTorch, scikit-learn).
    -   Exposing a `Predict` endpoint via gRPC for running inference.
    -   Providing a health check endpoint.

### 3. Rust Kernel (`rust_kernel/`)

A compiled shared library that provides CPU-bound, performance-critical functions. It is loaded by the Go gateway using a C Foreign Function Interface (FFI).

-   **Responsibilities:**
    -   High-speed mathematical operations.
    -   Efficient and safe string manipulation.
    -   JSON parsing, validation, and transformation.

---

## Getting Started

### Prerequisites

-   Go (version 1.18+)
-   Rust (latest stable version)
-   Python (version 3.9+)
-   Docker and Docker Compose

### Build Instructions

The services can be built manually or using the provided `docker-compose.yml` file, which handles the build process automatically.

1.  **Build the Rust Kernel:**
    The Rust kernel must be compiled into a C-compatible shared library (`.so`, `.dylib`, or `.dll`).
    ```bash
    cd rust_kernel/
    ./build.sh
    # This creates the library in the `go_gateway/lib/` directory.
    cd ..
    ```

2.  **Generate gRPC Code:**
    The Python gRPC service relies on generated protobuf code.
    ```bash
    cd python_ml/
    ./generate_proto.sh
    # This generates the necessary *_pb2.py and *_pb2_grpc.py files.
    cd ..
    ```

3.  **Build the Go Gateway:**
    The Go gateway can be built from the `go_gateway` directory.
    ```bash
    cd go_gateway/
    go build ./cmd/api
    cd ..
    ```

### Running the System

The easiest way to run the entire system is with Docker Compose, which builds and orchestrates all the services.

```bash
# From the root of the repository
docker-compose up --build
```

The Go gateway will be available at `http://localhost:8080`.

---

## API Usage Examples

You can interact with the gateway using `curl` or any other HTTP client.

#### Health Check

Check if the Go gateway is running.

```bash
curl http://localhost:8080/health
```
Expected Response:
```json
{
  "status": "ok",
  "service": "go-gateway",
  "timestamp": 1678886400,
  "version": "0.1.0-prototype"
}
```

#### Rust FFI Call (Addition)

Test the FFI integration with the Rust kernel.

```bash
curl "http://localhost:8080/rust/add?x=40&y=2"
```
Expected Response:
```json
{
  "operation": "rust_add",
  "x": 40,
  "y": 2,
  "result": 42,
  "latency_us": 1,
  "note": "FFI call via cgo"
}
```

#### Python gRPC Call (ML Prediction)

Test the gRPC integration with the Python ML service.

```bash
curl -X POST http://localhost:8080/ml/predict \
  -H "Content-Type: application/json" \
  -d '{"features": [1.0, 2.5, 3.0]}'
```
Expected Response:
```json
{
  "prediction": 6.5,
  "confidence": 0.95,
  "model_id": "default-model",
  "latency_ms": 5,
  "note": "gRPC call to Python service"
}
```

#### Hybrid Test (Go -> Rust -> Python)

Test the full end-to-end flow.

```bash
curl http://localhost:8080/test/hybrid
```
Expected Response:
```json
{
  "test": "hybrid_architecture",
  "rust_result": 30,
  "ml_prediction": 38,
  "ml_confidence": 0.95,
  "timing": {
    "rust_ffi_us": 2,
    "python_grpc_ms": 10,
    "total_ms": 12
  },
  "architecture": "Go -> Rust (FFI) -> Python (gRPC)"
}
```
