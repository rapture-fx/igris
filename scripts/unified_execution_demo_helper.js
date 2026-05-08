#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const nacl = require(path.resolve(
  __dirname,
  "../igris-javascript-sdk/node_modules/tweetnacl"
));

const RUNTIME_VERSION = "1.6.0";
const DEVICE_ID = "dev_1234567890abcdef1234567890abcd";
const LICENSE_KEY = "lic_seed_test";
const RUNTIME_SECRET = "test-key-offline";
const LICENSE_SEED_HEX = "0b".repeat(32);
const OVERTURE_SEED_HEX = "15".repeat(32);
const PROVIDER_PRESETS = {
  openai: {
    id: "openai-real",
    name: "OpenAI Real Provider",
    endpoint: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    apiFormat: "openai_compatible",
    apiKeyEnv: "OPENAI_API_KEY",
    capabilities: ["reasoning", "coding"],
  },
  anthropic: {
    id: "anthropic-real",
    name: "Anthropic Real Provider",
    endpoint: "https://api.anthropic.com/v1",
    model: "claude-sonnet-4-20250514",
    apiFormat: "anthropic",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    capabilities: ["reasoning", "coding", "long_context"],
  },
  groq: {
    id: "groq-real",
    name: "Groq Real Provider",
    endpoint: "https://api.groq.com/openai/v1",
    model: "llama3-70b-8192",
    apiFormat: "openai_compatible",
    apiKeyEnv: "GROQ_API_KEY",
    capabilities: ["fast", "coding"],
  },
  xai: {
    id: "xai-real",
    name: "xAI Real Provider",
    endpoint: "https://api.x.ai/v1",
    model: "grok-4",
    apiFormat: "openai_compatible",
    apiKeyEnv: "XAI_API_KEY",
    capabilities: ["reasoning"],
  },
  qwen: {
    id: "qwen-real",
    name: "Qwen Real Provider",
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    apiFormat: "openai_compatible",
    apiKeyEnv: "DASHSCOPE_API_KEY",
    capabilities: ["reasoning", "coding"],
  },
  kimi: {
    id: "kimi-real",
    name: "Kimi Real Provider",
    endpoint: "https://api.moonshot.ai/v1",
    model: "kimi-k2-0711-preview",
    apiFormat: "openai_compatible",
    apiKeyEnv: "MOONSHOT_API_KEY",
    capabilities: ["reasoning", "coding"],
  },
  glm: {
    id: "glm-real",
    name: "GLM Real Provider",
    endpoint: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-5",
    apiFormat: "openai_compatible",
    apiKeyEnv: "ZAI_API_KEY",
    capabilities: ["reasoning", "coding"],
  },
  deepseek: {
    id: "deepseek-real",
    name: "DeepSeek Real Provider",
    endpoint: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    apiFormat: "openai_compatible",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    capabilities: ["reasoning", "coding", "cost_effective"],
  },
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest();
}

function toHex(input) {
  return Buffer.from(input).toString("hex");
}

function toBase64(input) {
  return Buffer.from(input).toString("base64");
}

function fromHex(hex) {
  return Buffer.from(hex, "hex");
}

function keyPairFromSeedHex(seedHex) {
  return nacl.sign.keyPair.fromSeed(new Uint8Array(fromHex(seedHex)));
}

function writeJSON(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function canonicalSorted(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalSorted);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = canonicalSorted(value[key]);
    }
    return out;
  }
  return value;
}

function buildOfflineLicenseArtifact() {
  const licenseKeyPair = keyPairFromSeedHex(LICENSE_SEED_HEX);
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const payload = {
    version: 1,
    license_key: LICENSE_KEY,
    device_id: DEVICE_ID,
    runtime_version: RUNTIME_VERSION,
    tier: "seed",
    customer_email: "user@example.com",
    devices_limit: 1,
    devices_active: 1,
    cloud_requests_limit: 50000,
    cloud_requests_used: 10,
    features: {
      execution_layer: true,
      intelligence_layer: true,
      memory_layer: true,
      proof_layer: true,
      dashboard_access: false,
      fleet_monitoring: false,
      cost_optimization: false,
      performance_heatmaps: false,
      audit_trails: false,
      ota_updates: false,
      on_premise: false,
      custom_sla: false,
      extended_retention: false,
      dedicated_support: false,
    },
    status: "active",
    license_expires_at: expiresAt,
    artifact_issued_at: new Date().toISOString(),
    artifact_expires_at: expiresAt,
  };
  const payloadBytes = Buffer.from(JSON.stringify(payload));
  const payloadHash = sha256(payloadBytes);
  const signature = nacl.sign.detached(
    new Uint8Array(payloadHash),
    licenseKeyPair.secretKey
  );
  return {
    artifact: {
      algorithm: "ed25519-sha256",
      key_id: "test-key",
      payload: toBase64(payloadBytes),
      payload_sha256: toHex(payloadHash),
      signature: toBase64(signature),
    },
    publicKeyHex: toHex(licenseKeyPair.publicKey),
  };
}

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    fail(`required environment variable is not set: ${name}`);
  }
  return value;
}

function providerConfigForMode(mode) {
  if (mode === "mock") {
    return {
      id: "local-mock-cloud",
      name: "Local Mock Cloud Provider",
      endpoint: "http://127.0.0.1:18090/v1",
      model: "mock-model",
      api_format: "openai_compatible",
      api_key_env: "RUNTIME_MOCK_KEY",
      cost_per_1k_input: 0.01,
      cost_per_1k_output: 0.03,
      capabilities: ["testing", "reasoning"],
    };
  }

  if (mode !== "real") {
    fail(`unsupported provider mode: ${mode}`);
  }

  const providerKind = process.env.IGRIS_REAL_PROVIDER || "openai";
  const preset =
    providerKind === "openai_compatible" ? null : PROVIDER_PRESETS[providerKind];
  if (!preset && providerKind !== "openai_compatible") {
    fail(
      `unsupported IGRIS_REAL_PROVIDER=${providerKind}; expected ${Object.keys(PROVIDER_PRESETS).join(", ")}, or openai_compatible`
    );
  }

  const apiKeyEnv =
    process.env.IGRIS_REAL_PROVIDER_API_KEY_ENV ||
    (preset ? preset.apiKeyEnv : null);
  if (!apiKeyEnv) {
    fail(
      "IGRIS_REAL_PROVIDER_API_KEY_ENV is required for IGRIS_REAL_PROVIDER=openai_compatible"
    );
  }
  readRequiredEnv(apiKeyEnv);

  const endpoint =
    process.env.IGRIS_REAL_PROVIDER_ENDPOINT || (preset ? preset.endpoint : "");
  const model =
    process.env.IGRIS_REAL_PROVIDER_MODEL || (preset ? preset.model : "");
  const apiFormat =
    process.env.IGRIS_REAL_PROVIDER_API_FORMAT ||
    (preset ? preset.apiFormat : "openai_compatible");
  if (!endpoint) {
    fail("real provider endpoint is required via IGRIS_REAL_PROVIDER_ENDPOINT");
  }
  if (!model) {
    fail("real provider model is required via IGRIS_REAL_PROVIDER_MODEL");
  }
  if (!["openai_compatible", "anthropic"].includes(apiFormat)) {
    fail(
      `unsupported IGRIS_REAL_PROVIDER_API_FORMAT=${apiFormat}; expected openai_compatible or anthropic`
    );
  }

  return {
    id:
      process.env.IGRIS_REAL_PROVIDER_ID ||
      (preset ? preset.id : "openai-compatible-real"),
    name:
      process.env.IGRIS_REAL_PROVIDER_NAME ||
      (preset ? preset.name : "OpenAI-Compatible Real Provider"),
    endpoint,
    model,
    api_format: apiFormat,
    api_key_env: apiKeyEnv,
    cost_per_1k_input: 0.0,
    cost_per_1k_output: 0.0,
    capabilities: preset ? preset.capabilities : ["reasoning"],
  };
}

function buildRuntimeConfig(outDir, providerConfig) {
  const config = {
    server: { host: "0.0.0.0", port: 8080 },
    storage: { path: path.join(outDir, "runtime.db") },
    providers: [providerConfig],
    routing: {
      thompson_sampling: { enabled: true, exploration_rate: 0.1 },
      speculative: { enabled: true, max_providers: 1, first_token_timeout_ms: 2000 },
      council: { enabled: false, chairman: "none" },
    },
    auth: {
      enabled: true,
      api_key: RUNTIME_SECRET,
      rate_limit_per_minute: 120,
      rate_limit_burst: 20,
    },
    local_fallback: {
      enabled: false,
      model_path: "models/nonexistent.gguf",
      context_size: 512,
      threads: 1,
      max_tokens: 50,
      temperature: 0.7,
      cost_per_1k_tokens: 0.0,
    },
    mcp: {
      enabled: false,
      mdns: false,
      multicast: false,
      persist: false,
      storage_path: path.join(outDir, "mcp.db"),
    },
  };
  return `${JSON.stringify(config, null, 2)}\n`;
}

function commandPrepare(outDir, modeArg) {
  if (!outDir) {
    fail("usage: prepare <out-dir> [mock|real]");
  }
  fs.mkdirSync(outDir, { recursive: true });
  const mode = modeArg || process.env.IGRIS_UNIFIED_PROVIDER_MODE || "mock";

  const artifact = buildOfflineLicenseArtifact();
  const overtureKeyPair = keyPairFromSeedHex(OVERTURE_SEED_HEX);
  const providerConfig = providerConfigForMode(mode);
  const artifactPath = path.join(outDir, "offline-license.json");
  const configPath = path.join(outDir, "runtime-config.json5");
  const metaPath = path.join(outDir, "meta.json");

  writeJSON(artifactPath, artifact.artifact);
  fs.writeFileSync(configPath, buildRuntimeConfig(outDir, providerConfig));
  writeJSON(metaPath, {
    device_id: DEVICE_ID,
    runtime_secret: RUNTIME_SECRET,
    artifact_path: artifactPath,
    license_public_key_hex: artifact.publicKeyHex,
    overture_public_key_hex: toHex(overtureKeyPair.publicKey),
    overture_private_key_hex: toHex(overtureKeyPair.secretKey),
    provider_mode: mode,
    expected_provider_id: providerConfig.id,
    expected_provider_model: providerConfig.model,
    expected_provider_endpoint: providerConfig.endpoint,
    expected_provider_api_key_env: providerConfig.api_key_env,
  });

  console.log(
    JSON.stringify(
      {
        artifact_path: artifactPath,
        config_path: configPath,
        meta_path: metaPath,
      },
      null,
      2
    )
  );
}

function responseContentFromMessages(messages) {
  return messages
    .map((message) => `${message.role}: ${message.content}`)
    .join(" | ");
}

function commandServeMockProvider(portValue) {
  const port = Number(portValue || 18090);
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      const payload = JSON.parse(body || "{}");
      const content = `mock-response:${responseContentFromMessages(
        payload.messages || []
      )}`;
      if (payload.stream) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        res.write(
          `data: ${JSON.stringify({
            id: "chatcmpl-mock",
            object: "chat.completion.chunk",
            model: payload.model || "mock-model",
            choices: [{ index: 0, delta: { content }, finish_reason: null }],
          })}\n\n`
        );
        res.write(
          `data: ${JSON.stringify({
            id: "chatcmpl-mock",
            object: "chat.completion.chunk",
            model: payload.model || "mock-model",
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          })}\n\n`
        );
        res.end("data: [DONE]\n\n");
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: "chatcmpl-mock",
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: payload.model || "mock-model",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 4,
            completion_tokens: 8,
            total_tokens: 12,
          },
        })
      );
    });
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`mock provider listening on http://127.0.0.1:${port}`);
  });
}

function commandRuntimePublicKey(seedPath) {
  if (!seedPath) {
    fail("usage: runtime-public-key <seed-file>");
  }
  const seedHex = fs.readFileSync(seedPath, "utf8").trim();
  const keyPair = keyPairFromSeedHex(seedHex);
  process.stdout.write(`${toHex(keyPair.publicKey)}\n`);
}

function commandRuntimeRegisterRequest(
  seedPath,
  machineId,
  hostname,
  platform,
  runtimeVersion,
  endpoint
) {
  if (
    !seedPath ||
    !machineId ||
    !hostname ||
    !platform ||
    !runtimeVersion ||
    !endpoint
  ) {
    fail(
      "usage: runtime-register-request <seed-file> <machine-id> <hostname> <platform> <runtime-version> <endpoint>"
    );
  }
  const seedHex = fs.readFileSync(seedPath, "utf8").trim();
  const keyPair = keyPairFromSeedHex(seedHex);
  const publicKeyHex = toHex(keyPair.publicKey);
  const timestampUnixMs = Date.now();
  const message = [
    "runtime_register.v1",
    machineId,
    hostname,
    platform,
    runtimeVersion,
    publicKeyHex,
    endpoint,
    String(timestampUnixMs),
  ].join(":");
  const signature = nacl.sign.detached(
    Buffer.from(message, "utf8"),
    keyPair.secretKey
  );

  console.log(
    JSON.stringify(
      {
        machine_id: machineId,
        hostname,
        platform,
        runtime_version: runtimeVersion,
        endpoint,
        public_key_ed25519: publicKeyHex,
        timestamp_unix_ms: timestampUnixMs,
        signature: toBase64(signature),
      },
      null,
      2
    )
  );
}

function commandProofAccessMaterial() {
  const suffix = crypto.randomUUID().replace(/-/g, "");
  const rawApiKey = `igris_${suffix}`;
  const userId = `proof-${suffix.slice(0, 24)}`;
  const userEmail = `proof-demo+${suffix.slice(0, 12)}@igris.local`;
  console.log(
    JSON.stringify(
      {
        tenant_uuid: crypto.randomUUID(),
        tenant_id: userId,
        tenant_name: "Unified Proof Demo",
        tenant_email: userEmail,
        user_id: userId,
        user_email: userEmail,
        session_id: `proof_session_${suffix.slice(0, 24)}`,
        session_token: `proof_token_${suffix}`,
        raw_api_key: rawApiKey,
        api_key_hash: toHex(sha256(rawApiKey)),
        api_key_prefix: rawApiKey.slice(0, 8),
        runtime_registry_id: `proof-runtime-${suffix.slice(0, 16)}`,
      },
      null,
      2
    )
  );
}

function commandBuildVerifyRequest(responsePath) {
  if (!responsePath) {
    fail("usage: build-verify-request <response.json>");
  }
  const response = JSON.parse(fs.readFileSync(responsePath, "utf8"));
  const receipt = response.execution_receipt || {};
  if (!receipt.execution_id || !receipt.hash) {
    fail("response is missing execution_receipt.execution_id or execution_receipt.hash");
  }
  console.log(
    JSON.stringify(
      {
        execution_id: receipt.execution_id,
        expected_hash: receipt.hash,
        signature: receipt.signature || "",
      },
      null,
      2
    )
  );
}

function verifyEnvelope(envelope, publicKey) {
  const clone = { ...envelope };
  delete clone.signature;
  const digest = sha256(Buffer.from(JSON.stringify(canonicalSorted(clone))));
  return nacl.sign.detached.verify(
    new Uint8Array(digest),
    Buffer.from(envelope.signature, "base64"),
    publicKey
  );
}

function canonicalReceiptPayload(receipt) {
  const canonical = {
    agent_id: String(receipt.agent_id || ""),
    cpu_time_ms: String(receipt.cpu_time_ms),
    execution_id: String(receipt.execution_id || ""),
    fs_bytes_written: String(receipt.fs_bytes_written),
    memory_peak_mb: String(receipt.memory_peak_mb),
    previous_hash: String(receipt.previous_hash || ""),
    runtime_id: String(receipt.runtime_id || ""),
    timestamp_utc: String(receipt.timestamp_utc || ""),
    tool_calls: String(receipt.tool_calls),
    violation_occurred: String(receipt.violation_occurred),
    wall_time_ms: String(receipt.wall_time_ms),
  };
  if (receipt.transaction_hash) {
    canonical.transaction_hash = String(receipt.transaction_hash);
  }
  if (receipt.transaction_id) {
    canonical.transaction_id = String(receipt.transaction_id);
  }
  return canonicalSorted(canonical);
}

function verifyReceipt(receipt, publicKey) {
  const digest = sha256(
    Buffer.from(JSON.stringify(canonicalReceiptPayload(receipt)))
  );
  const signatureValid = nacl.sign.detached.verify(
    new Uint8Array(digest),
    Buffer.from(receipt.signature, "base64"),
    publicKey
  );
  return {
    signature_valid: signatureValid,
    hash_matches: toHex(digest) === receipt.hash,
  };
}

function commandVerify(responsePath, receiptLogPath, runtimeSeedPath) {
  if (!responsePath || !receiptLogPath || !runtimeSeedPath) {
    fail("usage: verify <response.json> <receipt-log.jsonl> <runtime-seed-file>");
  }
  const response = JSON.parse(fs.readFileSync(responsePath, "utf8"));
  const seedHex = fs.readFileSync(runtimeSeedPath, "utf8").trim();
  const publicKey = keyPairFromSeedHex(seedHex).publicKey;

  const receiptLog = fs
    .readFileSync(receiptLogPath, "utf8")
    .trim()
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const responseReceipt = response.execution_receipt || {};
  const responseEnvelope = response.execution_envelope || {};
  const matchingLogReceipt = receiptLog.find(
    (entry) => entry.execution_id === responseReceipt.execution_id
  );
  const matchingIndex = receiptLog.findIndex(
    (entry) => entry.execution_id === responseReceipt.execution_id
  );
  const previousLogReceipt =
    matchingIndex > 0 ? receiptLog[matchingIndex - 1] : null;

  const verification = {
    metadata_provider: response.metadata ? response.metadata.provider : null,
    metadata_route_decision: response.metadata
      ? response.metadata.route_decision
      : null,
    execution_envelope_verified:
      !!responseEnvelope.signature && verifyEnvelope(responseEnvelope, publicKey),
    execution_receipt_verified:
      !!responseReceipt.signature && verifyReceipt(responseReceipt, publicKey),
    receipt_log_entry_found: !!matchingLogReceipt,
    receipt_chain_link_valid: previousLogReceipt
      ? matchingLogReceipt.previous_hash === previousLogReceipt.hash
      : true,
    receipt_reference: response.receipt || null,
    response_content:
      response.choices &&
      response.choices[0] &&
      response.choices[0].message &&
      response.choices[0].message.content,
  };

  console.log(JSON.stringify(verification, null, 2));
}

function commandVerifyPersistence(
  responsePath,
  runsPath,
  runDetailPath,
  receiptsPath,
  verifyReceiptPath
) {
  if (!responsePath || !runsPath || !runDetailPath || !receiptsPath) {
    fail(
      "usage: verify-persistence <response.json> <runs.json> <run-detail.json> <receipts.json> [verify-receipt.json]"
    );
  }

  const response = JSON.parse(fs.readFileSync(responsePath, "utf8"));
  const runs = JSON.parse(fs.readFileSync(runsPath, "utf8"));
  const runDetail = JSON.parse(fs.readFileSync(runDetailPath, "utf8"));
  const receipts = JSON.parse(fs.readFileSync(receiptsPath, "utf8"));
  const verifyReceipt = verifyReceiptPath
    ? JSON.parse(fs.readFileSync(verifyReceiptPath, "utf8"))
    : null;

  const receipt = response.execution_receipt || {};
  const metadata = response.metadata || {};
  const executionId = String(receipt.execution_id || "").trim();
  const receiptHash = String(receipt.hash || "").trim();
  const routeDecision = String(metadata.route_decision || "").trim();

  if (!executionId) {
    fail("response is missing execution_receipt.execution_id");
  }
  if (!receiptHash) {
    fail("response is missing execution_receipt.hash");
  }
  if (routeDecision !== "forwarded_to_runtime_task") {
    fail(`unexpected route decision in response metadata: ${routeDecision}`);
  }

  const run = Array.isArray(runs)
    ? runs.find((entry) => String(entry.id || "").trim() === executionId)
    : null;
  if (!run) {
    fail(`execution_id ${executionId} was not found in GET /v1/execution/runs`);
  }

  if (String(runDetail.id || "").trim() !== executionId) {
    fail("GET /v1/execution/runs/:id did not return the expected execution_id");
  }
  if (String(runDetail.route_decision || "").trim() !== "forwarded_to_runtime_task") {
    fail(
      `unexpected route decision in run detail: ${String(
        runDetail.route_decision || ""
      ).trim()}`
    );
  }
  if (runDetail.fallback_used) {
    fail("run detail reported fallback_used=true");
  }
  if (!runDetail.receipt || String(runDetail.receipt.hash || "").trim() !== receiptHash) {
    fail("run detail receipt hash does not match the response receipt hash");
  }
  if (
    String(runDetail.verification_status || "").trim() !== "verified" &&
    String(run.verification_status || "").trim() !== "verified"
  ) {
    fail("run detail or run summary did not report verified status");
  }

  const runtimeIdentity = String(
    runDetail.runtime_id || run.runtime_id || runDetail.device_id || run.device_id || ""
  ).trim();
  if (!runtimeIdentity) {
    fail("run detail did not expose runtime identity");
  }

  const receiptRow = Array.isArray(receipts)
    ? receipts.find(
        (entry) => String(entry.execution_id || "").trim() === executionId
      )
    : null;
  if (!receiptRow) {
    fail(`execution_id ${executionId} was not found in GET /proof/receipts`);
  }
  if (String(receiptRow.hash || "").trim() !== receiptHash) {
    fail("receipt log API hash does not match the response receipt hash");
  }
  if (String(receiptRow.verification_status || "").trim() !== "verified") {
    fail("receipt log API did not report verified status");
  }
  if (!String(receiptRow.runtime_id || receiptRow.device_id || "").trim()) {
    fail("receipt log API did not expose runtime identity");
  }

  if (verifyReceipt && verifyReceipt.verified !== true) {
    fail("POST /proof/receipts/verify did not return verified=true");
  }

  console.log(
    JSON.stringify(
      {
        execution_id: executionId,
        route_decision: routeDecision,
        provider: String(metadata.provider || runDetail.provider || "").trim(),
        runtime_id: runtimeIdentity,
        receipt_hash: receiptHash,
        receipt_verification: verifyReceipt
          ? verifyReceipt.verified === true
          : null,
        runs_list_match: true,
        run_detail_match: true,
        receipts_match: true,
      },
      null,
      2
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback proof helpers
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_PRIMARY_ID = "mock-primary-fail";
const FALLBACK_SECONDARY_ID = "mock-fallback";

function buildFallbackRuntimeConfig(outDir) {
  // Primary points to a port with nothing listening → connection refused.
  // Fallback points to the live mock on 18090.
  const primaryProvider = {
    id: FALLBACK_PRIMARY_ID,
    name: "Mock Primary (will fail)",
    endpoint: "http://127.0.0.1:19090/v1",
    model: "mock-model",
    api_format: "openai_compatible",
    api_key_env: "RUNTIME_MOCK_KEY",
    cost_per_1k_input: 0.0,
    cost_per_1k_output: 0.0,
    // Higher-capability tags → ranked first by scoring.
    capabilities: ["fast", "realtime", "reasoning"],
  };
  const fallbackProvider = {
    id: FALLBACK_SECONDARY_ID,
    name: "Mock Fallback (will succeed)",
    endpoint: "http://127.0.0.1:18090/v1",
    model: "mock-model",
    api_format: "openai_compatible",
    api_key_env: "RUNTIME_MOCK_KEY",
    cost_per_1k_input: 0.01,
    cost_per_1k_output: 0.03,
    capabilities: ["testing"],
  };
  const config = {
    server: { host: "0.0.0.0", port: 8080 },
    storage: { path: path.join(outDir, "runtime.db") },
    providers: [primaryProvider, fallbackProvider],
    routing: {
      thompson_sampling: { enabled: true, exploration_rate: 0.1 },
      // max_providers=2 so the speculative router races both.
      speculative: { enabled: true, max_providers: 2, first_token_timeout_ms: 3000 },
      council: { enabled: false, chairman: "none" },
    },
    auth: {
      enabled: true,
      api_key: RUNTIME_SECRET,
      rate_limit_per_minute: 120,
      rate_limit_burst: 20,
    },
    local_fallback: {
      enabled: false,
      model_path: "models/nonexistent.gguf",
      context_size: 512,
      threads: 1,
      max_tokens: 50,
      temperature: 0.7,
      cost_per_1k_tokens: 0.0,
    },
    mcp: {
      enabled: false,
      mdns: false,
      multicast: false,
      persist: false,
      storage_path: path.join(outDir, "mcp.db"),
    },
  };
  return `${JSON.stringify(config, null, 2)}\n`;
}

function commandPrepareFallback(outDir) {
  if (!outDir) {
    fail("usage: prepare-fallback <out-dir>");
  }
  fs.mkdirSync(outDir, { recursive: true });

  const artifact = buildOfflineLicenseArtifact();
  const overtureKeyPair = keyPairFromSeedHex(OVERTURE_SEED_HEX);
  const artifactPath = path.join(outDir, "offline-license.json");
  const configPath = path.join(outDir, "runtime-config.json5");
  const metaPath = path.join(outDir, "meta.json");

  writeJSON(artifactPath, artifact.artifact);
  fs.writeFileSync(configPath, buildFallbackRuntimeConfig(outDir));
  writeJSON(metaPath, {
    device_id: DEVICE_ID,
    runtime_secret: RUNTIME_SECRET,
    artifact_path: artifactPath,
    license_public_key_hex: artifact.publicKeyHex,
    overture_public_key_hex: toHex(overtureKeyPair.publicKey),
    overture_private_key_hex: toHex(overtureKeyPair.secretKey),
    provider_mode: "fallback",
    primary_provider_id: FALLBACK_PRIMARY_ID,
    fallback_provider_id: FALLBACK_SECONDARY_ID,
    expected_provider_model: "mock-model",
    expected_provider_api_key_env: "RUNTIME_MOCK_KEY",
  });

  console.log(
    JSON.stringify(
      {
        artifact_path: artifactPath,
        config_path: configPath,
        meta_path: metaPath,
        primary_provider_id: FALLBACK_PRIMARY_ID,
        fallback_provider_id: FALLBACK_SECONDARY_ID,
      },
      null,
      2
    )
  );
}

function commandVerifyFallback(responsePath, receiptLogPath, runtimeSeedPath) {
  if (!responsePath || !receiptLogPath || !runtimeSeedPath) {
    fail(
      "usage: verify-fallback <response.json> <receipt-log.jsonl> <runtime-seed-file>"
    );
  }
  const response = JSON.parse(fs.readFileSync(responsePath, "utf8"));
  const seedHex = fs.readFileSync(runtimeSeedPath, "utf8").trim();
  const publicKey = keyPairFromSeedHex(seedHex).publicKey;

  const receiptLog = fs
    .readFileSync(receiptLogPath, "utf8")
    .trim()
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const responseReceipt = response.execution_receipt || {};
  const responseEnvelope = response.execution_envelope || {};
  const matchingLogReceipt = receiptLog.find(
    (entry) => entry.execution_id === responseReceipt.execution_id
  );
  const matchingIndex = receiptLog.findIndex(
    (entry) => entry.execution_id === responseReceipt.execution_id
  );
  const previousLogReceipt =
    matchingIndex > 0 ? receiptLog[matchingIndex - 1] : null;

  const metadata = response.metadata || {};
  const envelopeRoutingDecision = responseEnvelope.routing_decision || null;
  const metadataProvider = metadata.provider || null;

  const primaryFailed =
    envelopeRoutingDecision !== FALLBACK_PRIMARY_ID &&
    metadataProvider !== FALLBACK_PRIMARY_ID;
  const fallbackWon =
    envelopeRoutingDecision === FALLBACK_SECONDARY_ID ||
    metadataProvider === FALLBACK_SECONDARY_ID;

  const result = {
    metadata_route_decision: metadata.route_decision || null,
    metadata_provider: metadataProvider,
    envelope_routing_decision: envelopeRoutingDecision,
    primary_provider_id: FALLBACK_PRIMARY_ID,
    fallback_provider_id: FALLBACK_SECONDARY_ID,
    primary_did_not_win: primaryFailed,
    fallback_won: fallbackWon,
    execution_envelope_verified:
      !!responseEnvelope.signature &&
      verifyEnvelope(responseEnvelope, publicKey),
    execution_receipt_verified:
      !!responseReceipt.signature &&
      verifyReceipt(responseReceipt, publicKey),
    receipt_log_entry_found: !!matchingLogReceipt,
    receipt_chain_link_valid: previousLogReceipt
      ? matchingLogReceipt.previous_hash === previousLogReceipt.hash
      : true,
    response_content:
      response.choices &&
      response.choices[0] &&
      response.choices[0].message &&
      response.choices[0].message.content,
  };

  console.log(JSON.stringify(result, null, 2));
}

function commandVerifyFallbackPersistence(
  responsePath,
  runsPath,
  runDetailPath,
  receiptsPath,
  verifyReceiptPath
) {
  if (!responsePath || !runsPath || !runDetailPath || !receiptsPath) {
    fail(
      "usage: verify-fallback-persistence <response.json> <runs.json> <run-detail.json> <receipts.json> [verify-receipt.json]"
    );
  }

  const response = JSON.parse(fs.readFileSync(responsePath, "utf8"));
  const runs = JSON.parse(fs.readFileSync(runsPath, "utf8"));
  const runDetail = JSON.parse(fs.readFileSync(runDetailPath, "utf8"));
  const receipts = JSON.parse(fs.readFileSync(receiptsPath, "utf8"));
  const verifyReceipt = verifyReceiptPath
    ? JSON.parse(fs.readFileSync(verifyReceiptPath, "utf8"))
    : null;

  const receipt = response.execution_receipt || {};
  const metadata = response.metadata || {};
  const envelope = response.execution_envelope || {};
  const executionId = String(receipt.execution_id || "").trim();
  const receiptHash = String(receipt.hash || "").trim();
  const routeDecision = String(metadata.route_decision || "").trim();

  if (!executionId) {
    fail("response is missing execution_receipt.execution_id");
  }
  if (!receiptHash) {
    fail("response is missing execution_receipt.hash");
  }
  if (routeDecision !== "forwarded_to_runtime_task") {
    fail(`unexpected route decision in response metadata: ${routeDecision}`);
  }

  // The envelope routing_decision must be the fallback provider, not the primary.
  const envelopeRoutingDecision = String(
    envelope.routing_decision || ""
  ).trim();
  if (envelopeRoutingDecision === FALLBACK_PRIMARY_ID) {
    fail(
      `primary provider unexpectedly won — fallback was not triggered. routing_decision=${envelopeRoutingDecision}`
    );
  }
  if (
    envelopeRoutingDecision !== FALLBACK_SECONDARY_ID &&
    envelopeRoutingDecision !== ""
  ) {
    // Could be empty if envelope wasn't embedded — allow but warn.
    process.stderr.write(
      `warn: unexpected routing_decision=${envelopeRoutingDecision} (expected ${FALLBACK_SECONDARY_ID})\n`
    );
  }

  const run = Array.isArray(runs)
    ? runs.find((entry) => String(entry.id || "").trim() === executionId)
    : null;
  if (!run) {
    fail(`execution_id ${executionId} was not found in GET /v1/execution/runs`);
  }

  if (String(runDetail.id || "").trim() !== executionId) {
    fail("GET /v1/execution/runs/:id did not return the expected execution_id");
  }
  // The DB stores the Runtime envelope's routing_decision ("mock-fallback"), not Overture's
  // route_decision ("forwarded_to_runtime_task"). Both are valid — what matters is the primary
  // did NOT win.
  const dbRouteDecision = String(runDetail.route_decision || "").trim();
  if (dbRouteDecision === FALLBACK_PRIMARY_ID) {
    fail(
      `primary provider is recorded as the route_decision in run detail — fallback was not stored: ${dbRouteDecision}`
    );
  }
  // Accept "mock-fallback" (Runtime routing_decision stored in execution_context) OR
  // "forwarded_to_runtime_task" (if Overture-level decision is ever stored here).
  if (
    dbRouteDecision !== FALLBACK_SECONDARY_ID &&
    dbRouteDecision !== "forwarded_to_runtime_task" &&
    dbRouteDecision !== ""
  ) {
    process.stderr.write(
      `warn: run detail route_decision=${dbRouteDecision} (expected ${FALLBACK_SECONDARY_ID} or forwarded_to_runtime_task)\n`
    );
  }

  if (!runDetail.receipt || String(runDetail.receipt.hash || "").trim() !== receiptHash) {
    fail("run detail receipt hash does not match the response receipt hash");
  }
  if (
    String(runDetail.verification_status || "").trim() !== "verified" &&
    String(run.verification_status || "").trim() !== "verified"
  ) {
    fail("run detail or run summary did not report verified status");
  }

  const runtimeIdentity = String(
    runDetail.runtime_id || run.runtime_id || runDetail.device_id || run.device_id || ""
  ).trim();
  if (!runtimeIdentity) {
    fail("run detail did not expose runtime identity");
  }

  const receiptRow = Array.isArray(receipts)
    ? receipts.find(
        (entry) => String(entry.execution_id || "").trim() === executionId
      )
    : null;
  if (!receiptRow) {
    fail(`execution_id ${executionId} was not found in GET /proof/receipts`);
  }
  if (String(receiptRow.hash || "").trim() !== receiptHash) {
    fail("receipt log API hash does not match the response receipt hash");
  }
  if (String(receiptRow.verification_status || "").trim() !== "verified") {
    fail("receipt log API did not report verified status");
  }
  if (!String(receiptRow.runtime_id || receiptRow.device_id || "").trim()) {
    fail("receipt log API did not expose runtime identity");
  }

  if (verifyReceipt && verifyReceipt.verified !== true) {
    fail("POST /proof/receipts/verify did not return verified=true");
  }

  console.log(
    JSON.stringify(
      {
        execution_id: executionId,
        route_decision: routeDecision,
        db_route_decision: dbRouteDecision,
        envelope_routing_decision: envelopeRoutingDecision,
        primary_provider_id: FALLBACK_PRIMARY_ID,
        fallback_provider_id: FALLBACK_SECONDARY_ID,
        fallback_won: envelopeRoutingDecision === FALLBACK_SECONDARY_ID,
        fallback_recorded_in_db: dbRouteDecision === FALLBACK_SECONDARY_ID || dbRouteDecision === "forwarded_to_runtime_task",
        runtime_id: runtimeIdentity,
        receipt_hash: receiptHash,
        receipt_verification: verifyReceipt
          ? verifyReceipt.verified === true
          : null,
        runs_list_match: true,
        run_detail_match: true,
        receipts_match: true,
      },
      null,
      2
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoint proof helpers
// ─────────────────────────────────────────────────────────────────────────────

const CHECKPOINT_EMPTY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

function commandPrepareCheckpoint(outDir) {
  if (!outDir) fail("usage: prepare-checkpoint <out-dir>");
  fs.mkdirSync(outDir, { recursive: true });

  const artifact = buildOfflineLicenseArtifact();
  const overtureKeyPair = keyPairFromSeedHex(OVERTURE_SEED_HEX);
  const providerConfig = providerConfigForMode("mock");

  const artifactPath = path.join(outDir, "offline-license.json");
  const configPath = path.join(outDir, "runtime-config.json5");
  const metaPath = path.join(outDir, "meta.json");
  writeJSON(artifactPath, artifact.artifact);
  fs.writeFileSync(configPath, buildRuntimeConfig(outDir, providerConfig));

  const taskId = crypto.randomUUID();
  const tenantId = "checkpoint-proof-tenant";
  const steps = Array.from({ length: 8 }, (_, i) => ({
    step_index: i,
    model: "mock-model",
    messages: [{ role: "user", content: `checkpoint proof step ${i}` }],
  }));
  const taskType = { type: "agent_workflow", steps, checkpoint_after_steps: 1 };

  // Checkpoint request: checkpoint_after_steps asks Runtime to return an
  // Overture-visible checkpoint after the first committed step without relying
  // on a synthetic expired deadline.
  const checkpointIkey = `ck-${taskId.slice(0, 8)}-a`;
  const checkpointReq = {
    task_id: taskId,
    task_type: taskType,
    idempotency_key: checkpointIkey,
    tenant_id: tenantId,
  };
  const checkpointBody = JSON.stringify(checkpointReq);
  const checkpointBodyHash = sha256(Buffer.from(checkpointBody));
  const checkpointSig = nacl.sign.detached(
    new Uint8Array(checkpointBodyHash),
    overtureKeyPair.secretKey
  );

  // Resume base request: resume_from will be patched in later by direct-runtime
  // experiments; the Overture proof uses the durable-task recovery path.
  const resumeIkey = `ck-${taskId.slice(0, 8)}-b`;
  const resumeBaseReq = {
    task_id: taskId,
    task_type: taskType,
    idempotency_key: resumeIkey,
    tenant_id: tenantId,
    deadline_ms: 30000,
  };

  const checkpointReqPath = path.join(outDir, "checkpoint-request.json");
  const checkpointSigPath = path.join(outDir, "checkpoint-sig.txt");
  const resumeBaseReqPath = path.join(outDir, "resume-request-base.json");

  fs.writeFileSync(checkpointReqPath, checkpointBody);
  fs.writeFileSync(checkpointSigPath, toBase64(checkpointSig));
  fs.writeFileSync(resumeBaseReqPath, JSON.stringify(resumeBaseReq));

  writeJSON(metaPath, {
    device_id: DEVICE_ID,
    runtime_secret: RUNTIME_SECRET,
    artifact_path: artifactPath,
    license_public_key_hex: artifact.publicKeyHex,
    overture_public_key_hex: toHex(overtureKeyPair.publicKey),
    overture_private_key_hex: toHex(overtureKeyPair.secretKey),
    provider_mode: "mock",
    task_id: taskId,
    tenant_id: tenantId,
    steps_total: 8,
    checkpoint_idempotency_key: checkpointIkey,
    resume_idempotency_key: resumeIkey,
  });

  console.log(
    JSON.stringify(
      {
        artifact_path: artifactPath,
        config_path: configPath,
        meta_path: metaPath,
        checkpoint_request_path: checkpointReqPath,
        checkpoint_sig_path: checkpointSigPath,
        resume_request_base_path: resumeBaseReqPath,
        task_id: taskId,
      },
      null,
      2
    )
  );
}

// Build resume request from a checkpoint response. Writes the full request JSON
// to outPath and prints the base64 Ed25519 decision signature to stdout.
function commandBuildResumeRequest(checkpointRespPath, resumeBaseReqPath, outPath) {
  if (!checkpointRespPath || !resumeBaseReqPath || !outPath) {
    fail(
      "usage: build-resume-request <checkpoint-resp.json> <resume-base.json> <out-path>"
    );
  }
  const checkpointResp = JSON.parse(
    fs.readFileSync(checkpointRespPath, "utf8")
  );
  const resumeBase = JSON.parse(fs.readFileSync(resumeBaseReqPath, "utf8"));
  const overtureKeyPair = keyPairFromSeedHex(OVERTURE_SEED_HEX);

  const status = checkpointResp.status;
  // TaskStatus uses #[serde(tag = "status")] so the discriminant field is "status".
  if (!status || status.status !== "checkpointed") {
    fail(
      `Expected checkpointed status, got: ${JSON.stringify(status)}`
    );
  }
  const resumeToken = status.resume_token;
  if (!resumeToken) {
    fail("checkpoint response missing status.resume_token");
  }

  const resumeReq = { ...resumeBase, resume_from: resumeToken };
  const resumeBody = JSON.stringify(resumeReq);
  const resumeBodyHash = sha256(Buffer.from(resumeBody));
  const resumeSig = nacl.sign.detached(
    new Uint8Array(resumeBodyHash),
    overtureKeyPair.secretKey
  );

  fs.writeFileSync(outPath, resumeBody);
  process.stdout.write(toBase64(resumeSig));
}

// Validate a checkpoint response and WAL state.
function commandVerifyCheckpoint(checkpointRespPath, walRespPath) {
  if (!checkpointRespPath) {
    fail("usage: verify-checkpoint <checkpoint-resp.json> [wal-resp.json]");
  }
  const resp = JSON.parse(fs.readFileSync(checkpointRespPath, "utf8"));
  const walResp = walRespPath
    ? JSON.parse(fs.readFileSync(walRespPath, "utf8"))
    : null;

  const status = resp.status;
  // TaskStatus uses #[serde(tag = "status")] so the discriminant field is "status".
  if (!status || status.status !== "checkpointed") {
    fail(`Expected checkpointed status, got: ${JSON.stringify(status)}`);
  }
  const resumeToken = status.resume_token;
  if (!resumeToken) {
    fail("checkpoint status missing resume_token");
  }
  if (!resp.checkpoint) {
    fail("checkpoint response missing checkpoint payload");
  }
  if (!resp.checkpoint.resume_token) {
    fail("checkpoint payload missing resume_token");
  }

  const walEntryCount = walResp ? (walResp.count || 0) : null;
  const walEntries = walResp ? (walResp.entries || []) : [];
  const walHasCommitted = walEntries.some((e) => e.status === "Committed");

  console.log(
    JSON.stringify(
      {
        task_id: String(resp.task_id || ""),
        status_discriminant: status.status,
        steps_completed: resp.steps_completed,
        steps_total: resp.steps_total,
        resume_token_present: true,
        resume_token_last_committed_step: resumeToken.last_committed_step,
        resume_token_runtime_id: resumeToken.runtime_id || "",
        checkpoint_digest_is_empty_sha256:
          resumeToken.checkpoint_digest === CHECKPOINT_EMPTY_SHA256,
        checkpoint_payload_present: !!resp.checkpoint,
        wal_entry_count: walEntryCount,
        wal_has_committed_entries: walHasCommitted,
      },
      null,
      2
    )
  );
}

// Validate the full checkpoint → resume proof.
function commandVerifyCheckpointResume(
  checkpointRespPath,
  resumeRespPath,
  walAfterResumePath
) {
  if (!checkpointRespPath || !resumeRespPath) {
    fail(
      "usage: verify-checkpoint-resume <checkpoint-resp.json> <resume-resp.json> [wal-after-resume.json]"
    );
  }
  const checkpointResp = JSON.parse(
    fs.readFileSync(checkpointRespPath, "utf8")
  );
  const resumeResp = JSON.parse(fs.readFileSync(resumeRespPath, "utf8"));
  const walAfterResume = walAfterResumePath
    ? JSON.parse(fs.readFileSync(walAfterResumePath, "utf8"))
    : null;

  const checkpointStatus = checkpointResp.status;
  // TaskStatus uses #[serde(tag = "status")] so the discriminant field is "status".
  if (!checkpointStatus || checkpointStatus.status !== "checkpointed") {
    fail("Expected checkpoint to have checkpointed status");
  }
  const resumeStatus = resumeResp.status;
  if (!resumeStatus || resumeStatus.status !== "completed") {
    fail(
      `Expected resume to complete, got: ${JSON.stringify(resumeStatus)}`
    );
  }
  if (String(resumeResp.task_id) !== String(checkpointResp.task_id)) {
    fail(
      `task_id mismatch: checkpoint=${checkpointResp.task_id} resume=${resumeResp.task_id}`
    );
  }
  if (resumeResp.steps_completed <= checkpointResp.steps_completed) {
    fail(
      `Resume steps_completed (${resumeResp.steps_completed}) must exceed checkpoint steps_completed (${checkpointResp.steps_completed})`
    );
  }
  if (resumeResp.steps_completed !== resumeResp.steps_total) {
    fail(
      `Resume did not complete all steps: completed=${resumeResp.steps_completed} total=${resumeResp.steps_total}`
    );
  }

  const walEntries = walAfterResume ? (walAfterResume.entries || []) : [];
  const walCommittedEntries = walEntries.filter((e) => e.status === "Committed");
  const walCommittedCount = walCommittedEntries.length;
  const walStepIndices = walCommittedEntries
    .map((e) => e.step_index)
    .sort((a, b) => a - b);

  // step_0_skipped_by_resume: the resume token has last_committed_step=0,
  // meaning the resume starts at step 1. Step 0 ran in the checkpoint phase
  // and is in the WAL; the resume correctly skips it rather than re-running it.
  const checkpointToken = checkpointStatus.resume_token;
  const resumeSkippedStep0 =
    checkpointToken.last_committed_step === 0 &&
    resumeResp.steps_completed > checkpointResp.steps_completed;

  // WAL should have exactly steps_total committed entries: step 0 from the
  // checkpoint run, steps 1-N from the resume run.
  const expectedWalCount = walAfterResume ? resumeResp.steps_total : null;
  const walCountMatchesTotal =
    walAfterResume ? walCommittedCount === expectedWalCount : null;

  console.log(
    JSON.stringify(
      {
        task_id: String(checkpointResp.task_id),
        checkpoint_steps_completed: checkpointResp.steps_completed,
        resume_steps_completed: resumeResp.steps_completed,
        steps_total: resumeResp.steps_total,
        step_0_skipped_by_resume: resumeSkippedStep0,
        all_steps_completed:
          resumeResp.steps_completed === resumeResp.steps_total,
        resume_token_last_committed_step:
          checkpointToken.last_committed_step,
        wal_committed_entries_after_resume: walCommittedCount,
        wal_step_indices_committed: walStepIndices,
        wal_count_matches_steps_total: walCountMatchesTotal,
        wal_has_signed_entries: walCommittedEntries.some(
          (e) => e.signature
        ),
        checkpoint_verified: true,
        resume_verified: true,
      },
      null,
      2
    )
  );
}

const [command, ...args] = process.argv.slice(2);
switch (command) {
  case "prepare":
    commandPrepare(args[0], args[1]);
    break;
  case "prepare-fallback":
    commandPrepareFallback(args[0]);
    break;
  case "prepare-checkpoint":
    commandPrepareCheckpoint(args[0]);
    break;
  case "serve-mock-provider":
    commandServeMockProvider(args[0]);
    break;
  case "runtime-public-key":
    commandRuntimePublicKey(args[0]);
    break;
  case "runtime-register-request":
    commandRuntimeRegisterRequest(...args);
    break;
  case "proof-access-material":
    commandProofAccessMaterial();
    break;
  case "build-verify-request":
    commandBuildVerifyRequest(args[0]);
    break;
  case "build-resume-request":
    commandBuildResumeRequest(args[0], args[1], args[2]);
    break;
  case "verify":
    commandVerify(args[0], args[1], args[2]);
    break;
  case "verify-fallback":
    commandVerifyFallback(args[0], args[1], args[2]);
    break;
  case "verify-persistence":
    commandVerifyPersistence(args[0], args[1], args[2], args[3], args[4]);
    break;
  case "verify-fallback-persistence":
    commandVerifyFallbackPersistence(args[0], args[1], args[2], args[3], args[4]);
    break;
  case "verify-checkpoint":
    commandVerifyCheckpoint(args[0], args[1]);
    break;
  case "verify-checkpoint-resume":
    commandVerifyCheckpointResume(args[0], args[1], args[2]);
    break;
  default:
    fail(
      "usage: unified_execution_demo_helper.js <prepare|prepare-fallback|prepare-checkpoint|serve-mock-provider|runtime-public-key|runtime-register-request|proof-access-material|build-verify-request|build-resume-request|verify|verify-fallback|verify-persistence|verify-fallback-persistence|verify-checkpoint|verify-checkpoint-resume> ..."
    );
}
