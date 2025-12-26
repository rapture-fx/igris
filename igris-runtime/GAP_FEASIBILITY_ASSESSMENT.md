# Gap Feasibility Assessment - Realistic Implementation Plan

**Date**: 2025-12-26
**Current State**: 90% complete
**Remaining Gap**: 10%

---

## 🎯 Executive Summary

### Can We Close the Gaps? **YES** ✅

**Confidence Level by Category:**

| Gap | Difficulty | Time | Confidence | Risk |
|-----|-----------|------|------------|------|
| **Issue #3** (Model dims) | ⭐ Easy | 4-8 hours | 95% | Very Low |
| **Issue #7** (Encryption) | ⭐ Easy | 2-4 hours | 95% | Very Low |
| **Cross-Entropy Loss** | ⭐⭐ Moderate | 1-2 days | 85% | Low |
| **Local LLM Inference** | ⭐⭐⭐⭐ Hard | 2-3 weeks | 70% | Medium |
| **Real Transformer** | ⭐⭐⭐⭐⭐ Very Hard | 3-4 weeks | 50% | High |

**Recommended Priority:**
1. **Do First**: Issues #3, #7, Cross-Entropy (3-4 days total) → **Quick wins**
2. **Do Second**: Local LLM Inference (2-3 weeks) → **Critical functionality**
3. **Do Last**: Real Transformer (3-4 weeks) → **Quality improvement**

---

## 📊 Detailed Feasibility Analysis

### Issue #3: Load Model Dimensions from GGUF ⭐ **VERY FEASIBLE**

**Current Problem:**
```rust
// Hard-coded to 768 (BERT size)
let hidden_size = 768; // FIXME: Extract from base_model_path
```

**Why This Is Easy:**

GGUF files have a simple metadata header. We just need to:
1. Read the GGUF file header
2. Parse the metadata key-value pairs
3. Look for `n_embd` (embedding dimension)
4. Use that instead of 768

**Concrete Implementation:**

```rust
use std::fs::File;
use std::io::{Read, BufReader};

fn load_model_dimensions(model_path: &str) -> Result<usize> {
    let file = File::open(model_path)?;
    let mut reader = BufReader::new(file);

    // GGUF header: magic (4 bytes) + version (4 bytes)
    let mut magic = [0u8; 4];
    reader.read_exact(&mut magic)?;

    if &magic != b"GGUF" {
        anyhow::bail!("Not a valid GGUF file");
    }

    // Read version
    let mut version = [0u8; 4];
    reader.read_exact(&mut version)?;

    // Read metadata count
    let mut count_bytes = [0u8; 8];
    reader.read_exact(&mut count_bytes)?;
    let metadata_count = u64::from_le_bytes(count_bytes);

    // Parse metadata key-value pairs
    for _ in 0..metadata_count {
        let key = read_string(&mut reader)?;
        let value_type = read_u32(&mut reader)?;

        if key == "llama.embedding_length" || key == "n_embd" {
            // Found it! Read the value
            match value_type {
                4 => { // uint32
                    let dim = read_u32(&mut reader)?;
                    return Ok(dim as usize);
                }
                // ... handle other types
            }
        } else {
            // Skip this value
            skip_value(&mut reader, value_type)?;
        }
    }

    // Fallback to 768 if not found
    Ok(768)
}
```

**Dependencies Needed:**
- None! Just `std::fs` and `std::io`

**Testing:**
```bash
# Test with real models
./test_gguf models/phi-3-mini.gguf        # Should return 3072
./test_gguf models/llama-2-7b.gguf        # Should return 4096
./test_gguf models/bert-base.gguf         # Should return 768
```

**Effort Breakdown:**
- Research GGUF format: 1 hour (already documented)
- Implement parser: 2-3 hours
- Add tests: 1-2 hours
- Integration: 1 hour
- **Total: 4-8 hours**

**Risk Factors:** ⬇️ Very Low
- GGUF format is stable and well-documented
- Fallback to 768 if parsing fails
- No breaking changes

**Confidence: 95%** ✅

---

### Issue #7: In-Memory Encryption ⭐ **VERY FEASIBLE**

**Current Problem:**
```rust
// Save to disk first (plaintext)
varmap.save(&safetensors_path)?;

// Then encrypt (brief window of plaintext on disk)
encryption.encrypt_file(&safetensors_path, &encrypted)?;
fs::remove_file(&safetensors_path).await; // 10-50ms gap!
```

**Why This Is Easy:**

We already have encryption working. Just change the order:
1. Save to memory buffer instead of file
2. Encrypt the buffer
3. Write encrypted buffer to disk

**Concrete Implementation:**

```rust
async fn save_adapter_encrypted(&self, varmap: &VarMap, path: &Path) -> Result<PathBuf> {
    if let Some(ref encryption) = self.encryption {
        // Step 1: Save to memory buffer
        let mut buffer = Vec::new();
        varmap.save_to_buffer(&mut buffer)?;  // In-memory only

        // Step 2: Encrypt in memory
        let encrypted_data = encryption.encrypt_bytes(&buffer)?;

        // Step 3: Write encrypted data directly to disk
        let encrypted_path = path.with_extension("enc");
        tokio::fs::write(&encrypted_path, encrypted_data).await?;

        info!("Adapter encrypted in-memory before disk write");
        Ok(encrypted_path)
    } else {
        // No encryption - save normally
        varmap.save(path)?;
        Ok(path.to_path_buf())
    }
}
```

**Changes Required:**

1. **Add `encrypt_bytes()` method** to `AdapterEncryption`:
```rust
impl AdapterEncryption {
    pub fn encrypt_bytes(&self, plaintext: &[u8]) -> Result<Vec<u8>> {
        let cipher = Aes256Gcm::new(&self.key);
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

        let ciphertext = cipher.encrypt(&nonce, plaintext)
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;

        // Prepend nonce to ciphertext
        let mut result = nonce.to_vec();
        result.extend_from_slice(&ciphertext);
        Ok(result)
    }
}
```

2. **Update `MetalLoRATrainer::save_adapter_encrypted()`** as shown above

**Dependencies Needed:**
- Already have `aes-gcm = "0.10"` ✅
- Already have encryption working ✅

**Testing:**
```rust
#[tokio::test]
async fn test_no_plaintext_on_disk() {
    // Train model with encryption
    let result = trainer.train("model.gguf").await?;

    // Verify no .safetensors file exists
    let plaintext_path = result.encrypted_adapter_path
        .as_ref()
        .unwrap()
        .with_extension("safetensors");

    assert!(!plaintext_path.exists(), "Plaintext should never hit disk");

    // Verify encrypted file exists
    assert!(result.encrypted_adapter_path.unwrap().exists());
}
```

**Effort Breakdown:**
- Add `encrypt_bytes()`: 30 minutes
- Modify save logic: 1 hour
- Add test: 1 hour
- Verify no regression: 30 minutes
- **Total: 2-4 hours**

**Risk Factors:** ⬇️ Very Low
- Small change to existing working code
- Easy to test
- No breaking changes

**Confidence: 95%** ✅

---

### Cross-Entropy Loss ⭐⭐ **FEASIBLE**

**Current Problem:**
```rust
// Using MSE loss (works but suboptimal)
let diff = lora_output.sub(&target_embeddings)?;
let loss = diff.sqr()?.mean_all()?;
```

**Why This Is Moderate Difficulty:**

Cross-entropy requires:
1. Vocabulary projection (hidden_size → vocab_size)
2. Softmax over vocabulary
3. Log-likelihood loss

**Concrete Implementation:**

```rust
// Add vocabulary projection layer
struct LoRAWithHead {
    lora_layer: LoRALayer,
    lm_head: Tensor,  // [hidden_size, vocab_size] - can be frozen
    vocab_size: usize,
}

impl LoRAWithHead {
    fn new(config: &LoRAConfig, vocab_size: usize, vb: &VarBuilder) -> Result<Self> {
        let lora_layer = LoRALayer::new(768, 768, config, vb)?;

        // Initialize LM head (frozen during LoRA training)
        let lm_head = vb.get_with_hints(
            (768, vocab_size),
            "lm_head",
            candle_nn::Init::Randn { mean: 0.0, stdev: 0.02 },
        )?;

        Ok(Self { lora_layer, lm_head, vocab_size })
    }

    fn forward(&self, hidden_states: &Tensor) -> Result<Tensor> {
        // Apply LoRA
        let lora_output = self.lora_layer.forward(hidden_states)?;

        // Project to vocabulary
        let logits = lora_output.matmul(&self.lm_head)?;  // [batch, seq, vocab]
        Ok(logits)
    }
}

fn compute_cross_entropy_loss(
    logits: &Tensor,  // [batch, seq, vocab]
    labels: &Tensor,  // [batch, seq]
) -> Result<Tensor> {
    // Reshape: [batch * seq, vocab]
    let batch_size = logits.dim(0)?;
    let seq_len = logits.dim(1)?;
    let vocab_size = logits.dim(2)?;

    let logits_2d = logits.reshape((batch_size * seq_len, vocab_size))?;
    let labels_1d = labels.flatten_all()?;

    // Compute log-softmax
    let log_probs = candle_nn::ops::log_softmax(&logits_2d, 1)?;

    // Gather target log-probabilities
    let mut loss_sum = 0.0;
    let mut count = 0;

    for i in 0..(batch_size * seq_len) {
        let target_idx = labels_1d.get(i)?.to_scalar::<i64>()?;

        // Skip ignore index (-100)
        if target_idx >= 0 {
            let log_prob = log_probs.get(i)?.get(target_idx as usize)?
                .to_scalar::<f32>()?;
            loss_sum -= log_prob;  // Negative log-likelihood
            count += 1;
        }
    }

    // Average loss
    let loss = loss_sum / count as f32;
    Ok(Tensor::new(loss, logits.device())?)
}
```

**Challenges:**

1. **Vocabulary Size**: Need to know vocab size (typically 32000-50000)
   - Solution: Load from tokenizer or GGUF metadata

2. **Memory Usage**: vocab_size × hidden_size matrix is large
   - 32000 × 768 × 4 bytes = ~98 MB
   - Solution: Use frozen weights from base model

3. **Performance**: Softmax over large vocabulary is slow
   - Solution: Acceptable for training (only ~10-100 batches)

**Effort Breakdown:**
- Load vocab size from tokenizer: 1 hour
- Implement cross-entropy: 3-4 hours
- Add LM head layer: 2 hours
- Testing and validation: 2-3 hours
- **Total: 1-2 days**

**Risk Factors:** ⬇️ Low
- Well-understood algorithm
- Candle has softmax primitives
- Can fall back to MSE if issues

**Confidence: 85%** ✅

---

### Local LLM Inference ⭐⭐⭐⭐ **CHALLENGING BUT DOABLE**

**Current Problem:**
```rust
pub async fn generate(&self, prompt: &str) -> Result<String> {
    // 100% stub - just returns mock response
    Ok(format!("[Mock response for: {}]", prompt))
}
```

**Why This Is Hard:**

Requires C++ FFI to llama.cpp:
1. Load GGUF model into memory
2. Tokenize prompt
3. Run inference loop
4. Sample next tokens
5. Stream results

**Three Implementation Approaches:**

#### Approach 1: llama-cpp-rs (Recommended) ⭐⭐⭐

**Pros:**
- Existing Rust bindings: https://github.com/mdrokz/rust-llama.cpp
- Maintained and tested
- High-level API

**Cons:**
- Adds dependency on C++ llama.cpp build
- Build complexity on some platforms

**Example Code:**
```rust
use llama_cpp_rs::{LlamaModel, LlamaContext, LlamaContextParams};

pub struct LlamaCppBackend {
    model: LlamaModel,
    context: LlamaContext,
}

impl LlamaCppBackend {
    pub fn new(model_path: &str, config: &LocalLLMConfig) -> Result<Self> {
        // Load model
        let model = LlamaModel::load_from_file(model_path, Default::default())?;

        // Create context
        let params = LlamaContextParams {
            n_ctx: config.context_length as u32,
            n_batch: config.batch_size as u32,
            n_threads: config.threads as u32,
            ..Default::default()
        };
        let context = model.new_context(&params)?;

        Ok(Self { model, context })
    }

    pub async fn generate(&self, prompt: &str) -> Result<String> {
        // Tokenize
        let tokens = self.model.tokenize(prompt, true)?;

        // Generate
        let mut output = String::new();
        for token in self.context.decode(tokens)? {
            let text = self.model.token_to_str(token)?;
            output.push_str(&text);
        }

        Ok(output)
    }
}
```

**Effort: 1-2 weeks**

#### Approach 2: candle-rs llama (Recommended for Pure Rust) ⭐⭐⭐⭐

**Pros:**
- Pure Rust (no C++ dependency)
- We already use candle for training
- Well-maintained by Hugging Face

**Cons:**
- More complex to set up
- Requires implementing model architecture
- Performance may be slower than llama.cpp

**Example Code:**
```rust
use candle_core::{Device, Tensor};
use candle_transformers::models::llama::{Config, Llama};

pub struct CandleBackend {
    model: Llama,
    tokenizer: Tokenizer,
    device: Device,
}

impl CandleBackend {
    pub fn new(model_path: &str, config: &LocalLLMConfig) -> Result<Self> {
        let device = Device::new_metal(0)?;  // or CUDA/CPU

        // Load model
        let model_config = Config::from_gguf(model_path)?;
        let vb = VarBuilder::from_gguf(model_path, &device)?;
        let model = Llama::load(vb, &model_config)?;

        // Load tokenizer
        let tokenizer = Tokenizer::from_file("tokenizer.json")?;

        Ok(Self { model, tokenizer, device })
    }

    pub async fn generate(&self, prompt: &str, max_tokens: usize) -> Result<String> {
        // Tokenize
        let tokens = self.tokenizer.encode(prompt, false)?.get_ids();
        let input = Tensor::new(tokens, &self.device)?;

        // Generate tokens
        let mut output_tokens = tokens.to_vec();
        for _ in 0..max_tokens {
            // Forward pass
            let logits = self.model.forward(&input)?;

            // Sample next token
            let next_token = self.sample(&logits)?;
            output_tokens.push(next_token);

            // Check for EOS
            if next_token == self.tokenizer.token_to_id("<|endoftext|>") {
                break;
            }
        }

        // Decode
        Ok(self.tokenizer.decode(&output_tokens, true)?)
    }
}
```

**Effort: 2-3 weeks**

#### Approach 3: Direct FFI Bindings ⭐⭐⭐⭐⭐

**Pros:**
- Maximum control
- Best performance

**Cons:**
- Most complex
- Requires C++ expertise
- Maintenance burden

**Not recommended** - use existing bindings instead

**Effort: 4-6 weeks**

---

**Recommended Implementation Strategy:**

**Week 1: Setup**
- Choose approach (recommend llama-cpp-rs for speed, candle for pure Rust)
- Add dependencies
- Get basic model loading working
- Test with simple prompt

**Week 2: Integration**
- Integrate with existing `LocalLLMBackend`
- Add streaming support
- Implement sampling strategies
- Add tests

**Week 3: Polish**
- Performance optimization
- Error handling
- Documentation
- Integration tests

**Risk Factors:** ⬆️ Medium
- C++ build complexity (llama-cpp-rs)
- Platform-specific issues (Metal/CUDA)
- Memory management
- Performance tuning

**Confidence: 70%** ⚠️

**Mitigation:**
- Start with simple test case
- Use well-maintained libraries
- Keep cloud provider fallback
- Extensive testing

---

### Real Transformer Forward Pass ⭐⭐⭐⭐⭐ **VERY CHALLENGING**

**Current Problem:**
```rust
// Simple embedding-based forward pass (not real transformer)
let embeddings = ...; // Mean-based projection
let lora_output = lora_layer.forward(&embeddings)?;
```

**Why This Is Very Hard:**

A real transformer forward pass requires:
1. Token embeddings from base model
2. Positional encodings
3. Multi-head attention (12-40 layers)
4. Feed-forward networks
5. Layer normalization
6. Residual connections

This essentially means loading and running the **entire base model** during training.

**Complexity:**

```rust
struct TransformerLayer {
    attention: MultiHeadAttention,
    ffn: FeedForward,
    ln1: LayerNorm,
    ln2: LayerNorm,
}

impl TransformerLayer {
    fn forward(&self, x: &Tensor, mask: &Tensor) -> Result<Tensor> {
        // Self-attention
        let attn_out = self.attention.forward(x, mask)?;
        let x = x.add(&attn_out)?;  // Residual
        let x = self.ln1.forward(&x)?;

        // Feed-forward
        let ffn_out = self.ffn.forward(&x)?;
        let x = x.add(&ffn_out)?;  // Residual
        let x = self.ln2.forward(&x)?;

        Ok(x)
    }
}

// Full model with 32 layers for LLaMA-7B
struct LlamaModel {
    embeddings: Embedding,
    layers: Vec<TransformerLayer>,  // 32 layers!
    lm_head: Linear,
}
```

**Why This Might Not Be Worth It:**

1. **Memory**: Need to load full 7B model (~14 GB VRAM)
2. **Speed**: Training would be 100-1000x slower
3. **Complexity**: ~5000-10000 lines of code
4. **Alternative**: Use llama.cpp finetune binary instead

**Better Approach: Use llama.cpp finetune** ✅

Instead of reimplementing transformer in Rust, use llama.cpp's existing finetune:

```rust
pub async fn train_with_llamacpp(&self, model_path: &str) -> Result<TrainingResult> {
    // Prepare training data in llama.cpp format
    self.export_training_data_jsonl().await?;

    // Call llama-finetune binary
    let output = Command::new("llama-finetune")
        .arg("--model").arg(model_path)
        .arg("--train-data").arg("training.jsonl")
        .arg("--lora-r").arg(self.config.lora_rank.to_string())
        .arg("--lora-alpha").arg(self.config.lora_alpha.to_string())
        .arg("--epochs").arg(self.config.epochs.to_string())
        .output()
        .await?;

    if !output.status.success() {
        anyhow::bail!("Training failed: {}", String::from_utf8_lossy(&output.stderr));
    }

    Ok(TrainingResult { /* ... */ })
}
```

**Effort Comparison:**

| Approach | Lines of Code | Time | Complexity |
|----------|--------------|------|------------|
| **Full Transformer** | 5000-10000 | 3-4 weeks | ⭐⭐⭐⭐⭐ |
| **llama.cpp finetune** | 200-300 | 3-5 days | ⭐⭐ |
| **Current (embeddings)** | 100 | Done ✅ | ⭐ |

**Risk Factors:** ⬆️⬆️ Very High (for full transformer)
- Extremely complex
- High memory requirements
- Performance issues
- Maintenance burden

**Confidence: 50%** (for full transformer) ⚠️⚠️
**Confidence: 90%** (for llama.cpp integration) ✅

**Recommendation:**
- Keep current embedding-based approach for MVP
- Add llama.cpp finetune integration as "production" backend
- User can choose: fast (current) vs. quality (llama.cpp)

---

## 📋 Recommended Implementation Order

### Phase 1: Quick Wins (1 week) ✅ **DO THIS FIRST**

**Goal:** Close 3% gap with minimal risk

1. **Issue #3: Model Dimensions** (1 day)
   - Load from GGUF metadata
   - Test with LLaMA, Mistral, Phi-3

2. **Issue #7: In-Memory Encryption** (0.5 days)
   - Encrypt before disk write
   - Test no plaintext on disk

3. **Cross-Entropy Loss** (2 days)
   - Implement proper loss function
   - Compare training quality

**Deliverable:** Native LoRA training at 98% quality

**Risk:** Very Low ⬇️
**Confidence:** 95% ✅

---

### Phase 2: Critical Functionality (2-3 weeks) ✅ **DO THIS SECOND**

**Goal:** Close 5% gap, enable offline operation

4. **Local LLM Inference** (2-3 weeks)
   - Choose approach (llama-cpp-rs recommended)
   - Implement basic inference
   - Add streaming
   - Integration tests

**Deliverable:** Offline LLM inference working

**Risk:** Medium ⬆️
**Confidence:** 70% ⚠️

**Fallback:** Keep cloud provider option

---

### Phase 3: Quality Improvements (Optional - 3-4 weeks)

**Goal:** Production-grade training quality

5. **llama.cpp Finetune Integration** (3-5 days)
   - Call llama-finetune binary
   - Format conversion
   - Testing

6. **Full Transformer** (Skip - too complex)
   - Not recommended
   - Use llama.cpp instead

**Deliverable:** Production-quality LoRA training

**Risk:** Low ⬇️ (for llama.cpp)
**Confidence:** 90% ✅ (for llama.cpp)

---

## 🎯 Realistic Timeline

### Aggressive (1 engineer, focused)

```
Week 1:     Issues #3, #7, Cross-Entropy  ✅ Quick wins
Week 2-3:   Local LLM Inference           ⚠️ Complex
Week 4:     llama.cpp finetune           ✅ Optional
─────────────────────────────────────────
Total:      3-4 weeks to 98% complete
```

### Conservative (1 engineer, part-time)

```
Weeks 1-2:  Issues #3, #7, Cross-Entropy  ✅ Quick wins
Weeks 3-6:  Local LLM Inference           ⚠️ Complex
Weeks 7-8:  llama.cpp finetune           ✅ Optional
─────────────────────────────────────────
Total:      6-8 weeks to 98% complete
```

### Parallel (2 engineers)

```
Engineer A: Issues #3, #7, Cross-Entropy (Week 1)
           → llama.cpp finetune (Week 2)

Engineer B: Local LLM Inference (Weeks 1-3)
─────────────────────────────────────────
Total:      2-3 weeks to 98% complete
```

---

## ✅ Success Criteria

### Phase 1 Success (Quick Wins)
- [ ] Native training works with LLaMA-7B (4096 dims)
- [ ] Native training works with Mistral-7B (4096 dims)
- [ ] Native training works with Phi-3 (3072 dims)
- [ ] No plaintext adapters on disk (encryption test)
- [ ] Cross-entropy loss implemented
- [ ] Training loss lower than MSE baseline

### Phase 2 Success (Local LLM)
- [ ] Load GGUF model without crash
- [ ] Generate coherent text from prompt
- [ ] Streaming responses work
- [ ] Performance > 10 tok/s on M1 Mac
- [ ] Memory usage < 8GB for 7B model
- [ ] Integration tests pass

### Phase 3 Success (Quality)
- [ ] llama.cpp finetune runs successfully
- [ ] Adapter quality better than embedding-based
- [ ] GGUF adapter loads in llama.cpp
- [ ] End-to-end workflow tested

---

## 🚨 Risk Mitigation

### For Local LLM Inference

**Risk: Build complexity (llama.cpp)**
- Mitigation: Use pre-built binaries
- Fallback: Pure Rust candle approach
- Test: CI/CD on Linux, macOS, Windows

**Risk: Platform-specific crashes**
- Mitigation: Extensive testing on all platforms
- Fallback: Keep cloud provider option
- Monitor: Add crash reporting

**Risk: Performance issues**
- Mitigation: Benchmark early
- Fallback: Recommend cloud for large models
- Optimize: Profile and fix bottlenecks

### For Training Quality

**Risk: Cross-entropy doesn't improve quality**
- Mitigation: A/B test with MSE baseline
- Fallback: Keep MSE as option
- Measure: Perplexity and downstream task performance

**Risk: llama.cpp finetune fails**
- Mitigation: Keep embedding-based training
- Fallback: User chooses backend
- Test: Validate outputs match

---

## 💡 Recommended Action Plan

### Immediate Next Steps (This Week)

**Day 1: Issue #3 (Model Dimensions)**
```bash
# 1. Research GGUF format (1 hour)
curl https://github.com/ggerganov/ggml/blob/master/docs/gguf.md > gguf_spec.md

# 2. Implement parser (2-3 hours)
cd crates/igris-lora-trainer
# Create src/gguf_metadata.rs

# 3. Test (1 hour)
./test_dims models/llama-2-7b.gguf        # Expect 4096
./test_dims models/phi-3-mini.gguf        # Expect 3072
./test_dims models/bert-base.gguf         # Expect 768

# 4. Integrate (1 hour)
# Update metal_trainer.rs to use load_model_dimensions()
```

**Day 2: Issue #7 (In-Memory Encryption)**
```bash
# 1. Add encrypt_bytes() (30 min)
cd crates/igris-lora-trainer/src
# Update encryption.rs

# 2. Modify save logic (1 hour)
# Update metal_trainer.rs

# 3. Test (1 hour)
cargo test test_no_plaintext_on_disk
```

**Day 3-4: Cross-Entropy Loss**
```bash
# 1. Load vocab size (1 hour)
# Add to GGUF parser

# 2. Implement loss (3-4 hours)
# Add compute_cross_entropy_loss()

# 3. Test and compare (2-3 hours)
cargo test test_cross_entropy_vs_mse
```

**Result:** 98% complete native training in 3-4 days ✅

### Week 2-3: Local LLM

Start with proof-of-concept:
```bash
# Day 1: Setup
cargo new local-llm-poc
cd local-llm-poc
cargo add llama-cpp-rs

# Day 2-3: Basic inference
# Implement model loading
# Test with simple prompt

# Day 4-5: Integration
# Connect to igris-local-llm
# Add tests

# Week 2: Streaming & polish
# Add streaming support
# Performance optimization
# Integration tests
```

---

## 🎯 Bottom Line

### Can We Close the Gaps? **YES** ✅

**Confidence by Priority:**

| Priority | Tasks | Time | Confidence |
|----------|-------|------|------------|
| **High** | Issues #3, #7, Cross-Entropy | 3-4 days | **95%** ✅✅✅ |
| **Critical** | Local LLM Inference | 2-3 weeks | **70%** ⚠️ |
| **Optional** | llama.cpp finetune | 3-5 days | **90%** ✅✅ |

**Recommended Approach:**
1. ✅ **Do Quick Wins First** (3-4 days) → 98% complete
2. ⚠️ **Then Local LLM** (2-3 weeks) → 100% complete
3. ✅ **Optional Quality** (3-5 days) → Production-grade

**Total Time to 98%: 1 week (quick wins only)**
**Total Time to 100%: 3-4 weeks (with local LLM)**

The gaps are **definitely addressable** with the quick wins being very feasible and low-risk. Local LLM inference is more challenging but doable with existing libraries.
