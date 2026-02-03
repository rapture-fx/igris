'use client';

import React, { useState, useEffect } from 'react';

export default function AIAgentView() {
  const [visibleSections, setVisibleSections] = useState(0);
  const [loadingStep, setLoadingStep] = useState(0);
  const totalSections = 9; // Total number of sections

  const loadingSteps = [
    '$ igris-runtime --fetch-site-data',
    'Initializing runtime environment...',
    'Connecting to Igris platform...',
    'Fetching system data...',
    'Processing architecture layers...',
    'Loading configuration...',
    'Complete ✓'
  ];

  useEffect(() => {
    // Show loading steps progressively
    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev < loadingSteps.length - 1) {
          return prev + 1;
        } else {
          clearInterval(stepInterval);
          // After all loading steps, start showing content
          setTimeout(() => {
            let currentSection = 0;
            const contentInterval = setInterval(() => {
              currentSection++;
              setVisibleSections(currentSection);

              if (currentSection >= totalSections) {
                clearInterval(contentInterval);
              }
            }, 150);
          }, 500);
          return prev;
        }
      });
    }, 400); // 400ms delay between each loading step

    return () => clearInterval(stepInterval);
  }, []);

  return (
    <div className="min-h-screen bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200" style={{ fontFamily: 'Roboto Mono, monospace' }}>
      {visibleSections === 0 && (
        <div className="fixed inset-0 flex items-center justify-center bg-[#f6f6f4] dark:bg-dark-bg">
          <div className="flex flex-col items-start gap-1 text-sm">
            {loadingSteps.slice(0, loadingStep + 1).map((step, index) => (
              <div key={index} className="flex items-center gap-2">
                {index === 0 && <span className="text-gray-600 dark:text-[#a8a898]">{step}</span>}
                {index > 0 && index < loadingSteps.length - 1 && (
                  <span className="text-gray-600 dark:text-[#a8a898]">{step}</span>
                )}
                {index === loadingSteps.length - 1 && (
                  <span className="text-green-600 dark:text-green-400">{step}</span>
                )}
              </div>
            ))}
            {loadingStep < loadingSteps.length - 1 && (
              <div className="flex items-center gap-2">
                <span className="animate-pulse">_</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={`max-w-4xl mx-auto space-y-6 p-8 pb-24 ${visibleSections === 0 ? 'hidden' : ''}`}>

        {/* Machine Data - Structured for AI Parsing */}
        {visibleSections >= 1 && (
          <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4 bg-gray-50 dark:bg-[#1b1912]/30 py-4">
            <p className="text-[#c5b0cd] mb-3 text-sm font-mono">## MACHINE_READABLE_DATA</p>
            
            <div className="text-sm text-gray-700 dark:text-[#a8a898] font-mono space-y-1 mb-6">
              <p>product:          Deterministic AI runtime for edge devices</p>
              <p>name:             Igris Runtime</p>
              <p>binary_size:      ~16MB (single static binary)</p>
              <p>deployment:       Edge, cloud, or air-gapped environments</p>
              <p>inference:        BYOM via GGUF (llama.cpp integration)</p>
              <p>models_supported: Phi-3, Qwen3, DeepSeek, GLM-4, Llama</p>
              <p>offline:          true (local LLM fallback)</p>
              <p>gpu_support:      Metal (Apple Silicon), CUDA (NVIDIA)</p>
              <p>signing:          Ed25519 + AES-256-GCM encryption</p>
              <p>license:          MIT OR Apache-2.0</p>
            </div>

            <p className="text-[#c5b0cd] mb-2 text-sm font-mono">### API_ENDPOINTS</p>
            <pre className="text-sm text-gray-700 dark:text-[#a8a898] font-mono whitespace-pre overflow-x-auto">
{`+---------------------------+--------+--------------------------------+
| Endpoint                  | Method | Description                    |
+---------------------------+--------+--------------------------------+
| /v1/infer                 | POST   | Inference (OpenAI-compatible)  |
| /v1/chat/completions      | POST   | OpenAI-compatible alias        |
| /v1/health                | GET    | Health check                   |
+---------------------------+--------+--------------------------------+`}
            </pre>

            <p className="text-sm text-gray-600 dark:text-[#a8a898] mt-2">
              Full API reference: <a href="https://docs.igrisinertial.com/runtime/docs/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">docs.igrisinertial.com/runtime/docs/</a>
            </p>

            <p className="text-[#c5b0cd] mb-2 text-sm font-mono mt-6">### INSTALLATION</p>
            <div className="text-sm text-gray-700 dark:text-[#a8a898] font-mono space-y-2">
              <p className="text-[#c5b0cd]"># One-line install (16MB binary)</p>
              <p>curl -sSL https://raw.githubusercontent.com/igrisinertial/igris-runtime/main/install.sh | sh</p>
              <p>igris-runtime serve</p>
              
              <p className="text-[#c5b0cd] mt-2"># Or build from source (Rust 1.75+)</p>
              <p>git clone https://github.com/igrisinertial/igris-runtime.git</p>
              <p>cd igris-runtime && cargo build --release</p>
              <p>./target/release/igris-runtime serve</p>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-[#a8a898] mt-3">
              Requires: BYOM (GGUF model) or BYOK (cloud API keys in config.json5)
            </p>

            <p className="text-[#c5b0cd] mb-2 text-sm font-mono mt-6">### PRICING_TABLE</p>
            <pre className="text-sm text-gray-700 dark:text-[#a8a898] font-mono whitespace-pre overflow-x-auto">
{`+----------+----------------+-----------+----------------------------------+
| Tier     | Price          | Devices   | Support & Features               |
+----------+----------------+-----------+----------------------------------+
| Seed     | $0             | 1         | 4 layers, offline, community     |
| Horizon  | $49/device/mo  | 100       | 4 layers + dashboard, priority   |
| Infinite | Custom         | Unlimited | 4 layers + on-prem, 24/7, SLA    |
+----------+----------------+-----------+----------------------------------+`}
            </pre>
          </div>
        )}

        {/* Hero */}
        {visibleSections >= 1 && (
          <div className="sticky top-0 z-50 bg-[#f6f6f4] dark:bg-dark-bg animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4 pb-6">
            <p className="text-[#000000] dark:text-[#f6f6f4] mb-2"># The Nervous System for Machines and AI Agents</p>
            <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-4">
              A deterministic execution layer for AI that operates across cloud and devices, even when connectivity fails.
            </p>
          </div>
        )}

        {/* Solve */}
        {visibleSections >= 2 && (
          <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
            <p className="text-[#c5b0cd] mb-3">## THE CHALLENGE WE SOLVE</p>
            <div className="text-gray-600 dark:text-[#a8a898] text-sm space-y-1">
              <p>- Pure LLM hallucinations</p>
              <p>- Non-deterministic AI behavior</p>
              <p>- Unverifiable decisions</p>
              <p>- Cloud-dependent execution</p>
              <p>- No fleet visibility</p>
              <p>- Hidden performance bottlenecks</p>
              <p>- Undetected anomalies</p>
              <p>- Zero behavior history</p>
            </div>
          </div>
        )}

        {/* Products */}
        {visibleSections >= 3 && (
          <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
            <p className="text-[#c5b0cd] mb-3">## 01. PRODUCT</p>
            <p className="text-[#000000] dark:text-[#f6f6f4] mb-3">### The complete nervous system for your AI fleet.</p>

            <p className="text-sm mb-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
              Hybrid behavior trees meet LLM reasoning. Your AI executes deterministically through structured decision paths while leveraging language models only when needed. No pure hallucination. No random behavior. Just predictable intelligence that proves every decision cryptographically.
            </p>

            <p className="text-sm mb-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
              Four layers—execution, intelligence, memory, proof—work as one nervous system. Deploy on any device. When you scale to hundreds, the dashboard reveals fleet health, routing decisions, behavior patterns, and cryptographic verification. Everything you need to run AI you can actually trust.
            </p>

            <p className="text-[#000000] dark:text-[#f6f6f4] mb-3 mt-6">### Four layers. One nervous system.</p>
            <p className="text-sm mb-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
              See what's running. Know what's deciding. Understand what's learned. Prove what happened. The complete picture of your AI fleet in one place—not scattered across vendor dashboards, cloud consoles, and CSV exports.
            </p>
          </div>
        )}

        {/* Core Capabilities - The Architecture */}
        {visibleSections >= 4 && (
          <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
            <p className="text-[#c5b0cd] mb-3">## 02. THE ARCHITECTURE</p>
            <p className="text-[#000000] dark:text-[#f6f6f4] mb-3">### Every layer working in harmony</p>
            <p className="text-sm mb-6 text-gray-600 dark:text-[#a8a898]">From edge to cloud. From one to thousands.</p>

            <div className="space-y-4">
              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2">#### Execution</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                  Monitor every device in real-time. Deploy models instantly. Push configurations fleet-wide. From a single agent to thousands—your runtime layer executes with deterministic precision, sandboxed safety, and predictable latency.
                </p>
              </div>

              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2">#### Intelligence</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                  Route decisions through multiple LLM providers. Balance cost and performance. Test in shadow mode before production. Your decision layer adapts intelligently while maintaining complete control over every choice.
                </p>
              </div>

              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2">#### Memory & Proof</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                  Track behavior trees across your fleet. Detect anomalies automatically. Replay historical decisions. Every action cryptographically signed. Your audit trail is immutable—from debugging incidents to proving compliance.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Deployment */}
        {visibleSections >= 5 && (
          <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
            <p className="text-[#c5b0cd] mb-3">## 03. DEPLOYMENT</p>
            <p className="text-[#000000] dark:text-[#f6f6f4] mb-3">### Deploy. Verify. Optimize.</p>
            <p className="text-sm mb-6 text-gray-600 dark:text-[#a8a898]">Hybrid behavior trees meet LLM reasoning. Deterministic execution meets cryptographic proof.</p>

            <div className="space-y-4">
              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2">#### Deploy</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-2">
                  16MB binary. The complete nervous system in a single file. Behavior trees for structure, LLM reasoning for intelligence, cryptographic signing for proof. Deploy on a Raspberry Pi or industrial edge device. Hardware you already own becomes AI-capable in minutes.
                </p>
                <p className="text-xs text-gray-600 dark:text-[#a8a898] italic">
                  No containers. No dependencies. No cloud required.
                </p>
              </div>

              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2">#### Verify</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-2">
                  Behavior trees execute deterministically. LLMs reason when needed. Memory layer tracks every decision. Proof layer signs everything. Your AI operates predictably offline while the nervous system records what it does, why it did it, and proves it happened exactly as specified.
                </p>
                <p className="text-xs text-gray-600 dark:text-[#a8a898] italic">
                  Deterministic execution. Cryptographic proof. Zero hallucination risk.
                </p>
              </div>

              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2">#### Optimize</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-2">
                  Deploy to hundreds of devices. The dashboard awakens—fleet health across execution layer, routing decisions from intelligence layer, behavior patterns in memory layer, cryptographic verification from proof layer. Performance heatmaps reveal bottlenecks. Anomaly detection catches failures before they cascade. A/B test behavior trees across your fleet.
                </p>
                <p className="text-xs text-gray-600 dark:text-[#a8a898] italic">
                  Complete observability. Advanced optimization. Full control.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Proof - Security */}
        {visibleSections >= 6 && (
          <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
            <p className="text-[#c5b0cd] mb-3">## 04. PROOF</p>
            <p className="text-[#000000] dark:text-[#f6f6f4] mb-3">### Trust nothing. Verify everything.</p>
            <p className="text-sm mb-6 text-gray-600 dark:text-[#a8a898]">
              When your AI is running in a barn you visit twice a year, or on a device you shipped to a customer, you can't trust the environment. So we made the AI prove itself. Every decision leaves a trail. Every action carries a signature. Every claim can be verified.
            </p>

            <div className="space-y-4">
              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2">#### Air-Gap Ready</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                  Operates independently without internet connectivity. Deploy in secure facilities, remote locations, or offline environments. Your AI continues executing when network access is unavailable or prohibited.
                </p>
              </div>

              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2">#### Zero-Trust Architecture</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                  Every device authenticates cryptographically before joining your fleet. Compromised hardware is automatically rejected. No implicit trust—only verified participants can communicate with your system.
                </p>
              </div>

              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2">#### Device-Bound Encryption</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                  Models and data are encrypted to specific hardware. If a device is lost or stolen, the AI becomes inaccessible. Cryptographic keys remain on-device and never transmit over networks.
                </p>
              </div>

              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2">#### Verified Updates</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                  Every model update and configuration change requires cryptographic signatures. Unsigned or tampered code is rejected before deployment. Only authorized changes reach your fleet.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Manifesto */}
        {visibleSections >= 7 && (
          <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
            <p className="text-[#c5b0cd] mb-3">## MANIFESTO</p>
            <p className="text-[#000000] dark:text-[#f6f6f4] mb-3">### The nervous system for machines and AI agents.</p>

            <p className="text-sm mb-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
              As AI moves from assistance to autonomy, we need infrastructure that executes with precision, decides with intelligence, remembers every pattern, and proves every action. Four layers working as one unified system.
            </p>

            <p className="text-sm mb-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
              From a single device in a barn to thousands in production—this is the complete nervous system for the autonomous era. Deterministic execution. Intelligent routing. Continuous learning. Cryptographic proof. All integrated. All verifiable.
            </p>
          </div>
        )}

        {/* Pricing */}
        {visibleSections >= 8 && (
          <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
            <p className="text-[#c5b0cd] mb-3">## PRICING</p>
            <p className="text-[#000000] dark:text-[#f6f6f4] mb-3">### Pricing per device. Dashboard free.</p>
            <p className="text-sm mb-6 text-gray-600 dark:text-[#a8a898]">
              The complete nervous system—execution, intelligence, memory, and proof—included in every tier. Dashboard unlocks advanced features as you scale.
            </p>

            <div className="space-y-6">
              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2">#### The Seed - $0/forever</p>
                <p className="text-sm mb-2 text-gray-600 dark:text-[#a8a898]">Single device. Full platform. All four layers included.</p>
                <div className="text-gray-600 dark:text-[#a8a898] text-sm space-y-1">
                  <p>- Complete nervous system (all 4 layers)</p>
                  <p>- Execution: Deterministic runtime with hard limits</p>
                  <p>- Intelligence: Local decision routing</p>
                  <p>- Memory: Behavioral tracking</p>
                  <p>- Proof: Cryptographic signing (Ed25519)</p>
                  <p>- Offline operation (indefinite)</p>
                  <p>- Community support</p>
                </div>
              </div>

              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2">#### The Horizon - $49/device/month</p>
                <p className="text-sm mb-2 text-gray-600 dark:text-[#a8a898]">Fleet awakens. Complete observability. Advanced control. Up to 100 devices.</p>
                <div className="text-gray-600 dark:text-[#a8a898] text-sm space-y-1">
                  <p>- Everything in The Seed</p>
                  <p>- Full dashboard access (all four layers visible)</p>
                  <p>- Fleet-wide monitoring and control</p>
                  <p>- Advanced routing and cost optimization</p>
                  <p>- Performance heatmaps and anomaly detection</p>
                  <p>- Immutable audit trails (7-day retention)</p>
                  <p>- Over-the-air verified updates</p>
                  <p>- Priority engineering support</p>
                </div>
              </div>

              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2">#### The Infinite - Custom Pricing</p>
                <p className="text-sm mb-2 text-gray-600 dark:text-[#a8a898]">Unbounded scale. On-premise deployment. SLA guarantees. Unlimited devices.</p>
                <div className="text-gray-600 dark:text-[#a8a898] text-sm space-y-1">
                  <p>- Everything in The Horizon</p>
                  <p>- On-premise platform deployment</p>
                  <p>- Custom SLA guarantees</p>
                  <p>- Extended audit retention (90+ days)</p>
                  <p>- Dedicated security review support</p>
                  <p>- 24/7 engineering team access</p>
                  <p>- Compliance certification assistance</p>
                  <p>- Custom integration support</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* API Endpoints */}
        {visibleSections >= 9 && (
          <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
            <p className="text-[#c5b0cd] mb-3 text-sm font-mono">## API_ENDPOINTS</p>
            <p className="text-sm mb-4 text-gray-600 dark:text-[#a8a898]">OpenAI-compatible inference endpoints</p>
            <pre className="text-sm text-gray-700 dark:text-[#a8a898] font-mono whitespace-pre overflow-x-auto">
{`+-------------+--------+------------------------------------------+
| Endpoint    | Method | Description                              |
+-------------+--------+------------------------------------------+
| /v1/health  | GET    | Health check                             |
| /v1/chat    | POST   | Chat completions (OpenAI-compatible)     |
| /v1/plan    | POST   | Multi-step planning with tools           |
| /v1/reflect | POST   | Self-critique and response improvement   |
| /metrics    | GET    | Prometheus metrics                       |
+-------------+--------+------------------------------------------+`}
            </pre>
          </div>
        )}

        {/* Quick Installation */}
        {visibleSections >= 9 && (
          <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
            <p className="text-[#c5b0cd] mb-3 text-sm font-mono">## QUICK_INSTALL</p>
            <p className="text-sm mb-4 text-gray-600 dark:text-[#a8a898]">Download and run in one command</p>
            <div className="text-sm text-gray-700 dark:text-[#a8a898] font-mono space-y-2">
              <p className="text-[#c5b0cd]"># Download binary</p>
              <p>curl -sSL https://github.com/igrisinertial/igris-runtime/releases/latest/download/igris-runtime -o igris-runtime</p>
              <p className="text-[#c5b0cd] mt-2"># Make executable and run</p>
              <p>chmod +x igris-runtime && ./igris-runtime serve</p>
              <p className="text-[#c5b0cd] mt-2"># Or use Docker</p>
              <p>docker run -p 8080:8080 igris/inertial:latest</p>
            </div>
          </div>
        )}

        {/* Changelog */}
        {visibleSections >= 9 && (
          <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
            <p className="text-[#c5b0cd] mb-3 text-sm font-mono">## CHANGELOG</p>
            <div className="text-sm text-gray-700 dark:text-[#a8a898] font-mono space-y-1">
              <p>v1.6.1 (current) - Production-ready: local inference, SSE streaming, tool calling, security hardening</p>
              <p>v1.4.0 (Feb 2026) - Multi-model registry (6 models), reflection loops, benchmarking suite</p>
              <p>v1.3.0 (Dec 2025) - On-device QLoRA training, adapter hot-swap, encrypted adapters</p>
              <p>v1.2.0 - MCP Swarm Mode, Model Context Protocol, distributed context sync</p>
              <p>v1.1.0 - Local LLM fallback (Phi-3), speculative execution, GPU Metal support</p>
            </div>
          </div>
        )}

        {/* JSON-LD Schema for AI parsing */}
        {visibleSections >= 9 && (
          <div className="hidden" aria-hidden="true">
            <script type="application/ld+json">
              {JSON.stringify({
                "@context": "https://schema.org",
                "@type": "SoftwareApplication",
                "name": "Igris Inertial",
                "description": "Nervous system for autonomous machines and AI agents",
                "applicationCategory": "DeveloperApplication",
                "operatingSystem": "Linux, macOS, ARM64",
                "softwareVersion": "1.6.1",
                "offers": {
                  "@type": "Offer",
                  "price": "0",
                  "priceCurrency": "USD"
                },
                "featureList": [
                  "Deterministic execution",
                  "Local LLM inference",
                  "Offline capability",
                  "Cryptographic proof",
                  "Fleet management",
                  "BYOK and BYOM support"
                ]
              })}
            </script>
          </div>
        )}

        {/* Closing */}
        {visibleSections >= 9 && (
          <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
            <p className="text-[#c5b0cd] mb-3">## GET STARTED</p>
            <p className="text-[#000000] dark:text-[#f6f6f4] mb-4">### One platform. Four layers. Complete control from edge to cloud.</p>
            <p className="text-sm mb-2 text-gray-600 dark:text-[#a8a898]">Documentation: <a href="https://docs.igrisinertial.com/runtime/docs/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">https://docs.igrisinertial.com/runtime/docs/</a></p>
            <p className="text-sm mb-2 text-gray-600 dark:text-[#a8a898]">GitHub: <a href="https://github.com/igrisinertial" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">https://github.com/igrisinertial</a></p>
            <p className="text-sm mb-2 text-gray-600 dark:text-[#a8a898]">Twitter/X: <a href="https://x.com/igrisinertial" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">https://x.com/igrisinertial</a></p>
            <p className="text-sm mb-2 text-gray-600 dark:text-[#a8a898]">LinkedIn: <a href="https://www.linkedin.com/company/igrisinertial" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">https://www.linkedin.com/company/igrisinertial</a></p>
          </div>
        )}

        {/* Footer */}
        {visibleSections >= 9 && (
          <div className="pt-8 animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
            <p className="text-xs text-gray-600 dark:text-[#a8a898]">
              ---
            </p>
            <p className="text-xs text-gray-600 dark:text-[#a8a898] mt-2">
              This is a machine-readable version of the Igris website designed for AI agents and automated systems to accurately extract information. For the full visual experience, switch to "Human" view.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
