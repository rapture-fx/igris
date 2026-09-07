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
git clone https://github.com/rapture-fx/system.git
cd system/igris-runtime
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

**Issues**: https://github.com/rapture-fx/system/issues
**Discussions**: https://github.com/rapture-fx/system/discussions
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

## On-Device QLoRA Fine-Tuning (v1.3)

**The Feature That Turns a $1M Contract into a $30M Contract**

### What is QLoRA Training?

Starting in v1.3, Igris Runtime can automatically fine-tune its local Phi-3 model based on actual usage patterns. This creates a **domain-specialized AI** that gets smarter the more you use it—without sending any data off-device.

**Key Benefits:**
- **Zero data exfiltration**: All training happens locally
- **Automatic specialization**: After N requests, the model trains itself
- **Hot-swappable**: Load new adapters without restarting
- **Encrypted at rest**: All adapters protected with AES-256-GCM
- **Resource efficient**: Trains in < 30 minutes on a Raspberry Pi 5

### How It Works

1. **Conversation logging**: Every local LLM request is stored (prompt + response)
2. **Automatic trigger**: After N requests (default: 100), training starts automatically
3. **QLoRA training**: Creates a small LoRA adapter (< 64 MB) specialized to your domain
4. **Encryption**: Adapter is encrypted at rest using device-specific keys
5. **Hot-swap**: New adapter is loaded automatically, improving future responses

```
Request 1 → Base Phi-3 model → Response
Request 2 → Base Phi-3 model → Response
...
Request 100 → Base Phi-3 model → Response
   ↓
[Automatic Training Triggered]
   ↓
Request 101 → Phi-3 + Domain LoRA → Better Response!
```

### Configuration

Add this to your `config.json5`:

```json5
{
  // On-Device QLoRA Fine-Tuning (v1.3)
  lora_training: {
    enabled: true,  // Enable automatic training
    trigger_threshold: 100,  // Train after 100 requests
    max_adapter_size_mb: 64,  // Max adapter size
    lora_rank: 8,  // LoRA rank (8 = good balance)
    lora_alpha: 16.0,  // Alpha scaling
    epochs: 1,  // Training epochs
    batch_size: 4,  // Batch size
    learning_rate: 0.0001,  // Learning rate
    adapter_dir: "lora_adapters",  // Storage directory
    encrypt_adapters: true,  // Encrypt adapters (recommended)
    auto_load_adapter: true,  // Auto-load latest adapter
    max_training_time_secs: 1800,  // 30 minute timeout
    training_threads: 4  // CPU threads for training
  }
}
```

### Setup: Building llama.cpp with Training Support

For training to work, you need to build llama.cpp with training capabilities:

```bash
cd llama.cpp
mkdir build
cd build
cmake .. -DBUILD_SHARED_LIBS=OFF
make -j$(nproc) llama-finetune
```

This creates `build/bin/llama-finetune`, which Igris uses for training.

### Usage

#### Enable Auto-Training

```json5
lora_training: {
  enabled: true,
  trigger_threshold: 100
}
```

That's it! After 100 requests, training happens automatically in the background.

#### Manual Trigger (Future)

```bash
# Trigger training manually via API
curl -X POST http://localhost:8080/v1/lora/train
```

#### Check Training Status

```bash
# Check if an adapter is loaded
curl http://localhost:8080/v1/lora/status
```

#### Load a Specific Adapter

```bash
# Load a specific adapter
curl -X POST http://localhost:8080/v1/lora/load \
  -d '{"adapter_path": "lora_adapters/lora_adapter_1234567890.gguf"}'
```

### Performance Tuning

#### Faster Training (Lower Quality)

```json5
lora_rank: 4,  // Smaller adapter
epochs: 1,
batch_size: 8
```

#### Better Quality (Slower Training)

```json5
lora_rank: 16,  // Larger adapter
epochs: 2,
batch_size: 2
```

#### Resource-Constrained Devices

```json5
lora_rank: 4,
batch_size: 1,
training_threads: 2,
trigger_threshold: 50  // Train sooner with less data
```

### Security Features

#### Encryption at Rest

All adapters are encrypted using AES-256-GCM with device-specific keys:

```
Device Hostname → SHA-256 → Encryption Key
```

This means adapters are tied to the device they were trained on.

#### No Data Exfiltration

- Training data never leaves the device
- No network calls during training
- All computation is local
- Can run in air-gapped environments

### Monitoring

#### Check Adapter Directory

```bash
ls -lh lora_adapters/
# Should show .gguf files (plain adapters) and .enc files (encrypted)
```

#### View Training Logs

```bash
RUST_LOG=info cargo run

# Look for log lines like:
# Training threshold reached: 100 >= 100
# Starting LoRA training with base model: models/phi-3-mini-4k-instruct-q4.gguf
# Training completed in 845.23s
# LoRA adapter hot-swap completed
```

### Troubleshooting

#### Issue: Training never triggers

**Symptom**: After 100+ requests, no training happens

**Solutions**:
1. Check if `lora_training.enabled` is `true`
2. Verify llama-finetune binary exists:
   ```bash
   ls llama.cpp/build/bin/llama-finetune
   ```
3. Check logs for training errors:
   ```bash
   RUST_LOG=debug cargo run
   ```

#### Issue: Training times out

**Symptom**: Training fails after 30 minutes

**Solutions**:
1. Reduce training data:
   ```json5
   trigger_threshold: 50  // Train with less data
   ```
2. Increase timeout:
   ```json5
   max_training_time_secs: 3600  // 1 hour
   ```
3. Use fewer epochs:
   ```json5
   epochs: 1
   ```

#### Issue: Adapter too large

**Symptom**: Adapter exceeds 64 MB limit

**Solutions**:
1. Reduce LoRA rank:
   ```json5
   lora_rank: 4  // Smaller adapter
   ```
2. Increase size limit (if you have space):
   ```json5
   max_adapter_size_mb: 128
   ```

#### Issue: Decryption fails

**Symptom**: Can't load encrypted adapter

**Cause**: Adapter was created on a different device

**Solution**:
- Adapters are device-specific by design
- To share adapters, disable encryption:
  ```json5
  encrypt_adapters: false
  ```

### Advanced: Training Data Management

#### Clear Training History

```bash
# Remove old training data (careful!)
rm igris.db
```

#### Export Training Data (Future)

```bash
# Export training examples for analysis
curl http://localhost:8080/v1/lora/export-data > training_data.jsonl
```

### Performance Expectations

| Device | Training Time (100 samples) | Adapter Size | Memory Usage |
|--------|----------------------------|--------------|--------------|
| Raspberry Pi 5 | ~25 minutes | ~32 MB | ~2 GB |
| Desktop (16 cores) | ~8 minutes | ~32 MB | ~4 GB |
| MacBook Pro M1 | ~5 minutes | ~32 MB | ~3 GB |

### Success Criteria

After 150 requests, your fine-tuned Phi-3 + LoRA should:
- Respond faster to domain-specific questions
- Use your preferred terminology
- Adapt to your conversation style
- Outperform base model on your specific use cases

### Example: Domain Specialization

**Before training (base Phi-3):**
```
User: "What's the SLA for P1 incidents?"
Phi-3: "I don't have specific SLA information..."
```

**After training (100+ support desk conversations):**
```
User: "What's the SLA for P1 incidents?"
Phi-3+LoRA: "P1 incidents have a 1-hour response time SLA and
4-hour resolution target based on your support tier..."
```

The model learned from actual support desk conversations!

### FAQ

**Q: How much disk space do I need?**
A: ~200 MB per adapter. With default settings, you'll accumulate a few adapters over time.

**Q: Can I use multiple adapters?**
A: Currently, only one adapter can be active at a time. Adapter merging is planned for v1.4.

**Q: What happens if training fails?**
A: The system continues using the current adapter (or base model). Failed training is logged but doesn't crash the runtime.

**Q: Can I disable training temporarily?**
A: Yes, set `lora_training.enabled: false` and restart.

**Q: Does this work with models other than Phi-3?**
A: Yes! Any GGUF model supported by llama.cpp can be fine-tuned.

**Q: How do I reset to the base model?**
A: Remove the adapter path from config:
```json5
local_fallback: {
  lora_adapter_path: null  // Use base model only
}
```

---

**End of Field Manual**
