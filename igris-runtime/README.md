# Igris Runtime v1.6 — Production Runtime (Offline + Streaming + Tools + Training)

**Status**: Production-ready core with local inference, SSE streaming, tool calling, on-device LoRA training, security hardening, and observability.

Pure Rust, offline-capable AI routing engine with automatic local LLM fallback. When cloud providers fail or are unreachable, Igris Runtime can continue serving **real** responses using on-device GGUF models via `llama.cpp` binaries.

---

## Critical Production Fixes (v1.6.1)

**Fixed 5 show-stopper bugs blocking production deployment:**

1. **Docker Build** - Updated Dockerfile to Rust 1.82 (was 1.75) to support edition2024 dependencies
2. **Anthropic Model** - Fixed invalid model name causing 404 errors (updated to claude-3-5-sonnet-20240620)
3. **Auth Config** - Fixed bug where `auth.enabled: false` was ignored. Chat endpoint now respects config properly
4. **Fallback Logic** - Automatic local LLM fallback already implemented and working (activates when cloud fails)
5. **API Keys** - Documentation updated with current provider model names

**Impact**: All critical blockers resolved. System now production-ready with working cloud routing and automatic offline fallback.

---

## What's New (v1.6 highlights)

### **Local inference (llama.cpp CLI)**

- **Streaming**: Server-Sent Events via `POST /v1/chat/completions` with `"stream": true`
- **GPU offload**: `n_gpu_layers` + `main_gpu` passed through to `llama-cli` when supported
- **Prompt/KV caching**: `prompt_cache_dir` + `--prompt-cache-all` (when supported) for reuse across growing chat prompts
- **Batch tuning**: optional `batch_size` passed as `--batch-size` when supported

### Architecture

```
                    ┌─────────────────────┐
                    │  User Request       │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Speculative Router  │
                    │  (Try top 3 cloud   │
                    │   providers in      │
                    │   parallel)         │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   All cloud         │
                    │   providers fail?   │
                    └──────────┬──────────┘
                               │ YES
                    ┌──────────▼──────────┐
                    │ LOCAL LLM FALLBACK  │
                    │ (Phi-3 Mini 4K Q4)  │
                    │  - No internet req  │
                    │  - Free inference   │
                    │  - ~100ms latency   │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Return Response     │
                    └─────────────────────┘
```

---

## Quick Start (4 steps)

### 0. Build llama.cpp CLI

**Required for local inference** - Initialize and build the llama.cpp submodule:

```bash
# Initialize submodule
git submodule update --init --recursive

# Install CMake (if not already installed)
# macOS:
brew install cmake

# Ubuntu/Debian:
sudo apt-get install cmake build-essential

# Build llama.cpp
cmake -S llama.cpp -B llama.cpp/build
cmake --build llama.cpp/build -j

# Verify binary exists
ls llama.cpp/build/bin/llama-cli
```

**GPU Support (Optional):**

For **Metal** (Apple Silicon):
```bash
cmake -S llama.cpp -B llama.cpp/build -DGGML_METAL=ON
cmake --build llama.cpp/build -j
```

For **CUDA** (NVIDIA):
```bash
cmake -S llama.cpp -B llama.cpp/build -DGGML_CUDA=ON
cmake --build llama.cpp/build -j
```

**Note:** If you skip this step, the server will fail to start with error:
```
llama.cpp CLI not found at llama.cpp/build/bin/llama-cli
```

### 1. Download the Model

```bash
cd igris-runtime
./download-model.sh
```

This downloads Phi-3-mini-4k-instruct Q4 (~2.3 GB) from Hugging Face.

### 2. Enable Local Fallback

Create or edit `config.json5`:

```json5
{
  server: {
    host: "0.0.0.0",
    port: 8080
  },

  // Enable local LLM fallback
  local_fallback: {
    enabled: true,
    model_path: "models/phi-3-mini-4k-instruct-q4.gguf",

    // GPU offload (optional)
    // 0 = CPU only (default, works everywhere)
    // 33 = offload all layers to GPU (Apple Silicon M1/M2/M3)
    // 99 = let llama.cpp auto-detect (for larger models)
    n_gpu_layers: 0,
    main_gpu: null,  // Set to 0 if you have multiple GPUs

    // Prompt/KV cache (optional, speeds up repeated prompts)
    prompt_cache_dir: "prompt_cache",

    // Batch tuning (optional, larger = faster but more VRAM)
    batch_size: null,  // null = llama.cpp default (512)

    context_size: 4096,
    threads: 4,
    max_tokens: 512,
    temperature: 0.7,
    cost_per_1k_tokens: 0.0  // Free!
  },

  // Cloud providers (optional - fallback works without them)
  providers: [
    // ... your cloud API configs ...
  ],

  routing: {
    speculative: {
      enabled: true,
      max_providers: 3,
      first_token_timeout_ms: 5000
    }
  }
}
```

### 3. Run the Server

```bash
cargo run --release
```

## Endpoints

- **health**: `GET /v1/health`
- **chat completions**: `POST /v1/chat/completions` (OpenAI-compatible, supports `"stream": true`)
- **metrics**: `GET /metrics` (Prometheus text format)
- **LoRA training status**: `GET /v1/lora/status`

## CLI (built into `igris-runtime`)

The binary includes a small CLI (powered by `clap`) for common operations:

```bash
./target/release/igris-runtime serve
./target/release/igris-runtime validate-config --config config.json5
./target/release/igris-runtime health --url http://localhost:8080
./target/release/igris-runtime metrics --url http://localhost:8080
./target/release/igris-runtime status --url http://localhost:8080
./target/release/igris-runtime chat "hello" --url http://localhost:8080 --model gpt-4
./target/release/igris-runtime chat "stream this" --url http://localhost:8080 --stream
./target/release/igris-runtime download-model
```

## Docker (scratch image)

Build:

```bash
docker build -f Dockerfile.runtime -t igris-runtime:runtime .
```

Run (mount config + models if you use local inference):

```bash
docker run --rm -p 8080:8080 \
  -e IGRIS_CONFIG=/app/config.json5 \
  -v "$PWD/config.json5:/app/config.json5:ro" \
  -v "$PWD/models:/app/models:ro" \
  igris-runtime:runtime
```

---

## Testing Offline Capability

### Test with Airplane Mode

```bash
# Start the server
cargo run --release

# In another terminal, turn on airplane mode, then:
curl http://localhost:8080/v1/chat/completions -d '{
  "model":"phi3",
  "messages":[{"role":"user","content":"What is 2+2?"}]
}'
```

**Expected result**: You get a real LLM response from the local Phi-3 model, even with no internet.

### Automated Test

```bash
./test-local-fallback.sh
```

### Test GPU Offloading

Enable GPU offload in `config.json5`:

```json5
local_fallback: {
  enabled: true,
  n_gpu_layers: 33,  // Offload all layers (Phi-3 has 32 layers)
  // ...
}
```

Then check logs for GPU confirmation:

```bash
cargo run --release 2>&1 | grep -i "gpu\|metal\|cuda"
```

You should see:
- **Metal (Apple)**: `ggml_metal_init: loaded Metal framework`
- **CUDA (NVIDIA)**: `CUDA device 0: ...`

### Test LoRA Adapter Loading

After training a LoRA adapter:

```bash
curl http://localhost:8080/v1/chat/completions -d '{
  "model":"phi3",
  "messages":[{"role":"user","content":"What is 2+2?"}],
  "lora_adapter_path": "path/to/your/adapter.gguf"
}'
```

Or configure it globally in `config.json5`:

```json5
local_fallback: {
  enabled: true,
  lora_adapter_path: "adapters/my-finetuned-adapter.gguf",
  // ...
}
```

---

## Core Features

### 🌐 MCP Swarm Mode (NEW in v1.2)

**Peer-to-peer AI swarm intelligence with zero configuration**

Turn multiple Igris Runtime instances into a distributed AI brain that shares context across all nodes:

- **Auto-discovery**: Peers find each other via mDNS + UDP multicast (zero config)
- **Context sync**: Full conversation history shared in real-time across all instances
- **Encrypted persistence**: All context encrypted at rest with AES-256-GCM
- **Offline-first**: Works in degraded networks where mDNS may be blocked
- **Fault-tolerant**: Any instance can pick up where another left off
- **Binary size**: Still < 12 MB after UPX compression

**Quick Start:**

```json5
// config.json5
{
  mcp: {
    enabled: true,       // Enable swarm mode
    mdns: true,          // Auto-discovery via mDNS
    multicast: true,     // UDP fallback for restricted networks
    persist: true,       // Encrypted context storage
    storage_path: "mcp_contexts.db",
  }
}
```

Start multiple instances on the same network - they'll discover each other automatically and begin sharing context within 5 seconds.

**Integration Test:**

```bash
./test-mcp-swarm.sh
```

See [MCP Swarm Mode Guide](#mcp-swarm-mode-guide) below for details.

---

### Core Routing Modes

1. **Thompson Sampling** - Bayesian multi-armed bandit optimization
   - Learns which providers are fastest/cheapest over time
   - Beta distribution sampling for exploration vs exploitation
   - Reuses production Rust kernel from schlep-engine

2. **Speculative Execution** - Race providers, first response wins
   - Launches top N providers in parallel
   - Cancels slower providers when first completes
   - Minimizes latency for time-critical requests

3. **Council Mode** - Multi-provider consensus
   - Runs request through multiple providers
   - Chairman model synthesizes best response
   - Higher quality for complex reasoning tasks

4. **Local LLM Fallback** (NEW in v1.1) - Zero-downtime operation
   - Automatic failover when all cloud providers unavailable
   - On-device Phi-3 Mini 4K Instruct (Q4 quantization)
   - No API keys required, works 100% offline

### Emergency Modules

- **Gold Code**: Ed25519-signed emergency code patches
- **EscapeVector**: 72-hour encrypted response cache (AES-256-GCM)
- **Circuit Breakers**: Prevent cascade failures
- **Rate Limiting**: Token bucket per-provider

### Storage & Config

- **Redb**: Embedded ACID database (no PostgreSQL needed)
- **JSON5 Config**: Human-friendly config with env var expansion

---

## Binary Size

| Build Type | Size | Notes |
|------------|------|-------|
| Debug | ~180 MB | Full symbols |
| Release | ~12 MB | Optimized (opt-level=z, LTO, strip) |
| Release + UPX | ~4 MB | LZMA compression |

**Note**: Model file (~2.3 GB) is external and NOT included in binary.

---

## Architecture

```
runtime/
├── Cargo.toml                  # Workspace root
├── download-model.sh           # Download Phi-3 model
├── test-local-fallback.sh      # Test offline capability
│
├── crates/
│   ├── igris-core/             # Config, storage, provider definitions
│   ├── igris-routing/          # Routing algorithms + cloud/local providers
│   ├── igris-local-llm/        # Local LLM engine (NEW in v1.1)
│   ├── igris-server/           # HTTP server (axum + OpenAPI)
│   └── igris-emergency/        # Gold Code + EscapeVector
│
├── models/                      # Downloaded model files (gitignored)
│   └── phi-3-mini-4k-instruct-q4.gguf
│
└── llama.cpp/                   # Git submodule (for static linking)
```

---

## API Endpoints

### Health Check

```bash
curl http://localhost:8080/v1/health
# => "OK"
```

### Chat Completions (OpenAI-compatible)

```bash
curl http://localhost:8080/v1/chat/completions -d '{
  "model": "gpt-4",
  "messages": [
    {"role": "user", "content": "Explain quantum computing"}
  ],
  "mode": "speculative"
}'
```

**Modes**:
- `speculative` - Race top 3 providers (default)
- `thompson` - Use Thompson Sampling to pick provider
- `council` - Multi-provider consensus

### Swagger UI

```
http://localhost:8080/swagger-ui
```

---

## Configuration Details

### Local Fallback Options

```json5
local_fallback: {
  enabled: true,              // Enable/disable local fallback
  model_path: "models/...",   // Path to GGUF model file
  context_size: 4096,         // Context window (tokens)
  threads: 4,                 // CPU threads for inference
  max_tokens: 512,            // Max tokens to generate
  temperature: 0.7,           // Sampling temperature
  cost_per_1k_tokens: 0.0     // Cost tracking (0 = free)
}
```

### Platform Support

- **x86_64** (Intel/AMD) - Fully tested
- **aarch64** (ARM64 - Raspberry Pi, Jetson) - Supported
- **macOS** (Intel/Apple Silicon) - Supported
- **Linux** (musl/glibc) - Fully tested

---

## Performance

### Local LLM (Phi-3 Mini Q4)

| Metric | Performance |
|--------|-------------|
| Model Load Time | 2-3 seconds |
| First Token Latency | ~50-100ms |
| Tokens/second | 15-30 (CPU) |
| Memory Usage | ~2.5 GB |
| Model Size | 2.3 GB |

### Cloud Provider Fallback

- **Timeout**: 5 seconds (configurable)
- **Retry**: Automatic via speculative routing
- **Fallback**: Instant switch to local model

---

## Building from Source

### Development Build

```bash
cd runtime
cargo build
./target/debug/igris-runtime
```

### Production Build

```bash
cargo build --release
./target/release/igris-runtime
```

### Static Linux Build (musl)

```bash
# Install musl target
rustup target add x86_64-unknown-linux-musl

# Build static binary
cargo build --release --target x86_64-unknown-linux-musl

# Compress with UPX (optional)
upx --best --lzma target/x86_64-unknown-linux-musl/release/igris-runtime
```

### Cross-compile for ARM64

```bash
# Install cross
cargo install cross

# Build for aarch64
cross build --release --target aarch64-unknown-linux-musl
```

---

## Dependencies

### Runtime (Zero External Services)

- **Database**: Redb (embedded)
- **Cache**: In-memory + Redb
- **LLM**: llama.cpp (statically linked)

### Build Dependencies

- Rust 1.75+
- llama.cpp (git submodule)
- Optional: UPX for compression

---

## Comparison: Cloud vs Local Fallback

| Aspect | Cloud Providers | Local Fallback |
|--------|----------------|----------------|
| **Availability** | Requires internet | Works offline |
| **Latency** | 500-2000ms | 50-200ms first token |
| **Cost** | $0.0001-0.03/1k tokens | Free |
| **Model Quality** | GPT-4, Claude Opus | Phi-3 Mini 4K |
| **Context Window** | 8k-200k tokens | 4k tokens |
| **Setup** | API keys required | Download model |

---

## Troubleshooting

### Model Not Found

```
Error: Model file not found: models/phi-3-mini-4k-instruct-q4.gguf
```

**Solution**: Run `./download-model.sh`

### Out of Memory

If you get OOM errors with the local model:

1. Reduce `context_size` to 2048
2. Reduce `threads` to 2
3. Ensure you have at least 3 GB free RAM

### llama.cpp CLI Not Found

```
Error: llama.cpp CLI not found at llama.cpp/build/bin/llama-cli
```

**Solution**: Follow [Step 0](#0-build-llamacpp-cli) in Quick Start to build llama.cpp

### Compilation Errors

If you encounter build errors:

1. Ensure llama.cpp submodule is built (see [Step 0](#0-build-llamacpp-cli))
2. Check Rust version: `rustup update` (requires 1.75+)
3. Install CMake: `apt-get install cmake` or `brew install cmake`

---

## License

MIT OR Apache-2.0

---

## Credits

- **Thompson Sampling**: Reused from schlep-kernel
- **llama.cpp**: Georgi Gerganov and contributors
- **Phi-3 Model**: Microsoft Research
- **Igris Runtime**: Schlep Engineering Team

---

## What's Next (v1.2)

- [ ] Streaming responses (SSE)
- [ ] Thompson Sampling for local vs cloud provider selection
- [ ] Model hot-swapping
- [ ] Multi-model support (Mistral, Llama 3, etc.)
- [ ] GPU acceleration (CUDA/Metal)
- [ ] Quantization options (Q2, Q3, Q5, Q8)
