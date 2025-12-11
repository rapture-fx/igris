# Igris Runtime v1.1 Field Manual

**Operational Guide for the Unkillable Runtime**

---

## Mission Brief

Igris Runtime v1.1 is designed to be **unkillable**. Even when all cloud LLM providers are down, unreachable, or timing out, it continues to serve real LLM responses using an on-device Phi-3 model. This field manual covers setup, configuration, troubleshooting, and operational best practices.

---

## Deployment Checklist

### Pre-Flight Checks

- [ ] Rust 1.75+ installed (`rustc --version`)
- [ ] At least 4 GB RAM available
- [ ] At least 3 GB disk space for model
- [ ] CMake installed (for llama.cpp compilation)

### Setup Steps

#### 1. Clone and Initialize

```bash
git clone https://github.com/your-org/schlep-engine.git
cd schlep-engine/runtime
git submodule update --init --recursive
```

#### 2. Download Local Model

```bash
./download-model.sh
```

This downloads the Phi-3-mini-4k-instruct-q4.gguf model (~2.3 GB) to `models/`.

**Verify download:**
```bash
ls -lh models/
# Should show ~2.3 GB file
```

#### 3. Configure Runtime

Create `config.json5`:

```json5
{
  // Server configuration
  server: {
    host: "0.0.0.0",
    port: 8080
  },

  // Storage configuration
  storage: {
    path: "igris.db"
  },

  // Local LLM fallback (THE KEY FEATURE)
  local_fallback: {
    enabled: true,
    model_path: "models/phi-3-mini-4k-instruct-q4.gguf",
    context_size: 4096,
    threads: 4,
    max_tokens: 512,
    temperature: 0.7,
    cost_per_1k_tokens: 0.0
  },

  // Cloud providers (optional)
  providers: [
    {
      id: "openai-gpt4",
      name: "OpenAI GPT-4",
      endpoint: "https://api.openai.com/v1",
      model: "gpt-4-turbo-preview",
      api_key_env: "OPENAI_API_KEY",
      cost_per_1k_input: 0.01,
      cost_per_1k_output: 0.03,
      capabilities: ["reasoning", "coding"]
    }
    // Add more providers as needed
  ],

  // Routing configuration
  routing: {
    thompson_sampling: {
      enabled: true,
      exploration_rate: 0.1
    },
    speculative: {
      enabled: true,
      max_providers: 3,
      first_token_timeout_ms: 5000
    },
    council: {
      enabled: true,
      chairman: "anthropic-sonnet"
    }
  },

  // Authentication
  auth: {
    api_key: "${IGRIS_API_KEY}"
  }
}
```

#### 4. Set Environment Variables

```bash
# Optional: Cloud provider API keys
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export GROQ_API_KEY="gsk_..."

# Optional: Igris API key for auth
export IGRIS_API_KEY="your-secret-key"
```

#### 5. Build and Run

**Development:**
```bash
cargo run
```

**Production:**
```bash
cargo build --release
./target/release/igris-runtime
```

---

## Operational Modes

### Mode 1: Cloud-First with Local Fallback (Recommended)

**Use case**: Normal operation with internet connectivity

**Configuration:**
- Cloud providers configured with API keys
- Local fallback enabled
- Speculative routing enabled

**Behavior:**
1. Request comes in
2. Top 3 cloud providers race (speculative execution)
3. First successful response wins
4. If all cloud providers fail → automatic fallback to local Phi-3
5. User gets response either way

**Startup logs:**
```
Igris Runtime v1.1 starting...
Loaded 3 cloud providers
Local fallback is ENABLED
Model path: models/phi-3-mini-4k-instruct-q4.gguf
Local LLM provider initialized successfully
Server listening on 0.0.0.0:8080
Local LLM fallback: ENABLED
```

### Mode 2: Local-Only (Air-Gapped Deployment)

**Use case**: Offline operation, secure environments, no cloud API access

**Configuration:**
- No cloud providers configured (empty array)
- Local fallback enabled

**Behavior:**
1. All requests served by local Phi-3 model
2. No external network calls
3. 100% offline operation

**Config snippet:**
```json5
{
  providers: [],  // No cloud providers
  local_fallback: {
    enabled: true,
    // ... rest of config
  }
}
```

### Mode 3: Cloud-Only (No Local Fallback)

**Use case**: Cloud-native deployment, minimal resource usage

**Configuration:**
- Cloud providers configured
- Local fallback disabled

**Behavior:**
- Only uses cloud providers
- Returns error if all providers fail
- Saves ~2.5 GB RAM (no model loaded)

**Config snippet:**
```json5
{
  local_fallback: {
    enabled: false
  }
}
```

---

## Performance Tuning

### Local Model Optimization

**CPU Threads:**
```json5
threads: 4  // Good starting point
threads: 2  // Low-resource systems
threads: 8  // High-performance servers
```

**Context Size:**
```json5
context_size: 4096  // Default, supports most prompts
context_size: 2048  // Faster, less memory
context_size: 8192  // Experimental, requires more RAM
```

**Max Tokens:**
```json5
max_tokens: 512   // Good for chat
max_tokens: 256   // Faster responses
max_tokens: 1024  // Longer outputs
```

### Cloud Provider Optimization

**Timeout Configuration:**
```json5
first_token_timeout_ms: 5000  // Default
first_token_timeout_ms: 3000  // Aggressive fallback
first_token_timeout_ms: 10000 // Patient, wait longer
```

**Speculative Execution:**
```json5
max_providers: 3  // Balance cost vs latency
max_providers: 1  // Minimize cost
max_providers: 5  // Minimize latency
```

---

## Monitoring and Observability

### Health Checks

```bash
# Basic health check
curl http://localhost:8080/v1/health

# Expected: "OK"
```

### Metrics Endpoints

Check logs for performance data:

```bash
# Watch logs in real-time
tail -f /var/log/igris-runtime.log

# Key metrics to monitor:
# - Cloud provider latency
# - Fallback activation rate
# - Local model inference time
# - Memory usage
```

### Log Levels

Set via environment variable:
```bash
RUST_LOG=info cargo run       # Standard
RUST_LOG=debug cargo run      # Verbose
RUST_LOG=warn cargo run       # Minimal
```

---

## Troubleshooting

### Issue: Model fails to load

**Symptom:**
```
Failed to initialize local LLM provider: Model file not found
```

**Solution:**
```bash
# Check if model exists
ls -lh models/phi-3-mini-4k-instruct-q4.gguf

# If missing, download it
./download-model.sh

# Verify file size (~2.3 GB)
du -h models/phi-3-mini-4k-instruct-q4.gguf
```

### Issue: Out of memory

**Symptom:**
```
thread 'main' panicked at 'out of memory'
```

**Solution:**
1. Reduce context size:
   ```json5
   context_size: 2048
   ```

2. Reduce threads:
   ```json5
   threads: 2
   ```

3. Check available RAM:
   ```bash
   free -h
   ```

### Issue: Slow inference

**Symptom:**
Local model takes >5 seconds per response

**Solutions:**

1. **Increase threads** (if you have CPU cores available):
   ```json5
   threads: 8
   ```

2. **Reduce max_tokens**:
   ```json5
   max_tokens: 256
   ```

3. **Use faster model** (download smaller quantization):
   - Q2_K: Fastest, lowest quality
   - Q4_K: Good balance (current)
   - Q8_0: Slower, higher quality

### Issue: Cloud providers timing out

**Symptom:**
All requests fall back to local model even with internet

**Solutions:**

1. **Check API keys:**
   ```bash
   echo $OPENAI_API_KEY
   echo $ANTHROPIC_API_KEY
   ```

2. **Increase timeout:**
   ```json5
   first_token_timeout_ms: 10000
   ```

3. **Test cloud provider manually:**
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```

### Issue: Binary size too large

**Symptom:**
Release binary is >15 MB

**Solution:**

1. **Strip symbols:**
   ```bash
   strip target/release/igris-runtime
   ```

2. **Use UPX compression:**
   ```bash
   upx --best --lzma target/release/igris-runtime
   ```

3. **Check profile settings in Cargo.toml:**
   ```toml
   [profile.release]
   opt-level = "z"
   lto = "fat"
   codegen-units = 1
   panic = "abort"
   strip = true
   ```

---

## Testing Procedures

### Basic Functionality Test

```bash
# 1. Start server
cargo run --release

# 2. In another terminal:
./test-local-fallback.sh
```

Expected output:
```
✓ Server is running
✓ Health check passed
✓ Chat completion test passed
All tests passed!
```

### Offline Fallback Test

```bash
# 1. Start server with local fallback enabled
cargo run --release

# 2. Disconnect from internet (airplane mode)

# 3. Test request:
curl http://localhost:8080/v1/chat/completions -d '{
  "model":"phi3",
  "messages":[{"role":"user","content":"What is 2+2?"}]
}'

# 4. Should get response from local model
```

### Load Test

```bash
# Install hey (HTTP load testing tool)
go install github.com/rakyll/hey@latest

# Run load test
hey -n 100 -c 10 -m POST \
  -H "Content-Type: application/json" \
  -d '{"model":"phi3","messages":[{"role":"user","content":"Hi"}]}' \
  http://localhost:8080/v1/chat/completions
```

---

## Security Considerations

### API Key Management

**DO:**
- ✅ Use environment variables for API keys
- ✅ Rotate keys regularly
- ✅ Use different keys per environment (dev/staging/prod)

**DON'T:**
- ❌ Hard-code API keys in config files
- ❌ Commit config files with keys to git
- ❌ Share API keys across services

### Network Security

**Recommended setup:**

1. **Use TLS termination** (nginx/caddy):
   ```nginx
   server {
       listen 443 ssl;
       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;

       location / {
           proxy_pass http://localhost:8080;
       }
   }
   ```

2. **Implement auth middleware**:
   Set `IGRIS_API_KEY` and require clients to send it:
   ```bash
   curl -H "Authorization: Bearer $IGRIS_API_KEY" ...
   ```

3. **Rate limiting** (built-in):
   Already configured in routing system.

---

## Production Deployment

### systemd Service (Linux)

Create `/etc/systemd/system/igris-runtime.service`:

```ini
[Unit]
Description=Igris Runtime v1.1
After=network.target

[Service]
Type=simple
User=igris
WorkingDirectory=/opt/igris-runtime
ExecStart=/opt/igris-runtime/igris-runtime
Restart=always
RestartSec=10

Environment="RUST_LOG=info"
Environment="OPENAI_API_KEY=sk-..."
Environment="IGRIS_API_KEY=your-secret"

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable igris-runtime
sudo systemctl start igris-runtime
sudo systemctl status igris-runtime
```

### Docker Deployment

```dockerfile
FROM rust:1.75 as builder
WORKDIR /build
COPY . .
RUN cargo build --release --target x86_64-unknown-linux-musl

FROM alpine:latest
RUN apk add --no-cache ca-certificates
COPY --from=builder /build/target/x86_64-unknown-linux-musl/release/igris-runtime /usr/local/bin/
COPY models/ /models/
WORKDIR /app
CMD ["igris-runtime"]
```

Build and run:
```bash
docker build -t igris-runtime:1.1 .
docker run -p 8080:8080 -v ./models:/models igris-runtime:1.1
```

---

## FAQ

### Q: Can I use a different model besides Phi-3?

**A:** Yes, any GGUF-format model compatible with llama.cpp. Examples:
- Mistral 7B
- Llama 3 8B
- Gemma 7B

Just download the GGUF file and update `model_path` in config.

### Q: Does local fallback work with Council Mode?

**A:** Currently, local fallback activates when all cloud providers fail in Speculative Mode. Council Mode integration is planned for v1.2.

### Q: How much does local inference cost?

**A:** $0. Free. Electricity costs only (negligible for small models).

### Q: Can I run multiple instances?

**A:** Yes, use different ports:
```json5
server: { port: 8081 }  // Instance 2
server: { port: 8082 }  // Instance 3
```

### Q: What's the maximum context window?

**A:** Phi-3 Mini supports 4K tokens by default. You can configure up to 8K experimentally, but memory usage increases.

---

## Support and Feedback

**Issues**: https://github.com/your-org/schlep-engine/issues
**Discussions**: https://github.com/your-org/schlep-engine/discussions
**Documentation**: https://docs.igris-runtime.dev

---

## Appendix: Complete Configuration Reference

```json5
{
  // Server settings
  server: {
    host: "0.0.0.0",              // Bind address
    port: 8080                     // Port number
  },

  // Storage settings
  storage: {
    path: "igris.db"               // Redb database path
  },

  // Local LLM fallback
  local_fallback: {
    enabled: true,                 // Enable/disable
    model_path: "models/...",      // GGUF model file
    context_size: 4096,            // Token context window
    threads: 4,                    // CPU threads
    max_tokens: 512,               // Max output tokens
    temperature: 0.7,              // Sampling temperature
    cost_per_1k_tokens: 0.0        // Cost (for tracking)
  },

  // Cloud provider list
  providers: [
    {
      id: "provider-id",
      name: "Provider Name",
      endpoint: "https://api.example.com/v1",
      model: "model-name",
      api_key_env: "ENV_VAR_NAME",
      cost_per_1k_input: 0.001,
      cost_per_1k_output: 0.002,
      capabilities: ["reasoning", "coding"]
    }
  ],

  // Routing configuration
  routing: {
    thompson_sampling: {
      enabled: true,
      exploration_rate: 0.1
    },
    speculative: {
      enabled: true,
      max_providers: 3,
      first_token_timeout_ms: 5000
    },
    council: {
      enabled: true,
      chairman: "provider-id"
    }
  },

  // Authentication
  auth: {
    api_key: "${IGRIS_API_KEY}"    // Env var substitution
  }
}
```

---

**End of Field Manual**
