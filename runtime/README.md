# Igris Runtime v1.1 - The Unkillable Edition

**Status**: Production Ready + Local LLM Fallback

Pure Rust, offline-capable AI routing engine with automatic local LLM fallback. When ALL cloud providers fail or are unreachable, Igris Runtime continues serving real LLM responses using an on-device Phi-3 model.

---

## What's New in v1.1

### 🚀 Local LLM Fallback (NEW!)

**The feature that makes Igris Runtime truly unkillable:**

- **Automatic failover**: When all cloud providers timeout or fail, seamlessly switches to local Phi-3 model
- **Zero external dependencies**: Model runs 100% on-device using llama.cpp (statically linked)
- **Works offline**: Full LLM capabilities even with airplane mode on
- **Free inference**: No API costs for fallback responses
- **Small footprint**: Phi-3 Mini Q4 model is only ~2.3 GB
- **Fast startup**: Model loads in 2-3 seconds on modern hardware

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

## Quick Start (3 Steps)

### 1. Download the Model

```bash
cd runtime
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

### Compilation Errors

If llama-cpp-rs fails to compile:

1. Ensure git submodules are initialized: `git submodule update --init`
2. Install CMake: `apt-get install cmake` or `brew install cmake`
3. Check Rust version: `rustup update`

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
