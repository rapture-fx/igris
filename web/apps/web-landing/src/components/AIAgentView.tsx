'use client';

import React from 'react';

export default function AIAgentView() {
  return (
    <div className="min-h-screen bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] p-8 pb-24 text-sm transition-colors duration-200" style={{ fontFamily: 'Roboto Mono, monospace' }}>
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Hero */}
        <section>
          <h1 className="text-2xl font-bold mb-4 text-[#000000] dark:text-[#f6f6f4]">The Nervous System for Machines and AI Agents</h1>
          <p className="text-gray-600 dark:text-[#a8a898] leading-relaxed mb-4">
            A deterministic execution layer for AI that operates across cloud and devices, even when connectivity fails.
          </p>
        </section>

        {/* Solve */}
        <section>
          <h2 className="text-lg font-bold mb-4 text-[#c5b0cd]">THE CHALLENGE WE SOLVE</h2>
          <ul className="list-disc pl-6 space-y-1 text-gray-600 dark:text-[#a8a898]">
            <li>Pure LLM hallucinations</li>
            <li>Non-deterministic AI behavior</li>
            <li>Unverifiable decisions</li>
            <li>Cloud-dependent execution</li>
            <li>No fleet visibility</li>
            <li>Hidden performance bottlenecks</li>
            <li>Undetected anomalies</li>
            <li>Zero behavior history</li>
          </ul>
        </section>

        {/* Products */}
        <section>
          <h2 className="text-lg font-bold mb-4 text-[#c5b0cd]">01. PRODUCT</h2>
          <h3 className="text-base font-semibold mb-3 text-[#000000] dark:text-[#f6f6f4]">The complete nervous system for your AI fleet.</h3>

          <p className="mb-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
            Hybrid behavior trees meet LLM reasoning. Your AI executes deterministically through structured decision paths while leveraging language models only when needed. No pure hallucination. No random behavior. Just predictable intelligence that proves every decision cryptographically.
          </p>

          <p className="mb-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
            Four layers—execution, intelligence, memory, proof—work as one nervous system. Deploy on any device. When you scale to hundreds, the dashboard reveals fleet health, routing decisions, behavior patterns, and cryptographic verification. Everything you need to run AI you can actually trust.
          </p>

          <h3 className="text-base font-semibold mb-3 mt-6 text-[#000000] dark:text-[#f6f6f4]">Four layers. One nervous system.</h3>
          <p className="mb-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
            See what's running. Know what's deciding. Understand what's learned. Prove what happened. The complete picture of your AI fleet in one place—not scattered across vendor dashboards, cloud consoles, and CSV exports.
          </p>
        </section>

        {/* Core Capabilities - The Architecture */}
        <section>
          <h2 className="text-lg font-bold mb-4 text-[#c5b0cd]">02. THE ARCHITECTURE</h2>
          <h3 className="text-base font-semibold mb-3 text-[#000000] dark:text-[#f6f6f4]">Every layer working in harmony</h3>
          <p className="mb-6 text-gray-600 dark:text-[#a8a898]">From edge to cloud. From one to thousands.</p>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">Execution</h4>
              <p className="text-gray-600 dark:text-[#a8a898] leading-relaxed">
                Monitor every device in real-time. Deploy models instantly. Push configurations fleet-wide. From a single agent to thousands—your runtime layer executes with deterministic precision, sandboxed safety, and predictable latency.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">Intelligence</h4>
              <p className="text-gray-600 dark:text-[#a8a898] leading-relaxed">
                Route decisions through multiple LLM providers. Balance cost and performance. Test in shadow mode before production. Your decision layer adapts intelligently while maintaining complete control over every choice.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">Memory & Proof</h4>
              <p className="text-gray-600 dark:text-[#a8a898] leading-relaxed">
                Track behavior trees across your fleet. Detect anomalies automatically. Replay historical decisions. Every action cryptographically signed. Your audit trail is immutable—from debugging incidents to proving compliance.
              </p>
            </div>
          </div>
        </section>

        {/* Deployment */}
        <section>
          <h2 className="text-lg font-bold mb-4 text-[#c5b0cd]">03. DEPLOYMENT</h2>
          <h3 className="text-base font-semibold mb-3 text-[#000000] dark:text-[#f6f6f4]">Deploy. Verify. Optimize.</h3>
          <p className="mb-6 text-gray-600 dark:text-[#a8a898]">Hybrid behavior trees meet LLM reasoning. Deterministic execution meets cryptographic proof.</p>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">Deploy</h4>
              <p className="text-gray-600 dark:text-[#a8a898] leading-relaxed mb-2">
                16MB binary. The complete nervous system in a single file. Behavior trees for structure, LLM reasoning for intelligence, cryptographic signing for proof. Deploy on a Raspberry Pi or industrial edge device. Hardware you already own becomes AI-capable in minutes.
              </p>
              <p className="text-xs text-gray-600 dark:text-[#a8a898] italic">
                No containers. No dependencies. No cloud required.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">Verify</h4>
              <p className="text-gray-600 dark:text-[#a8a898] leading-relaxed mb-2">
                Behavior trees execute deterministically. LLMs reason when needed. Memory layer tracks every decision. Proof layer signs everything. Your AI operates predictably offline while the nervous system records what it does, why it did it, and proves it happened exactly as specified.
              </p>
              <p className="text-xs text-gray-600 dark:text-[#a8a898] italic">
                Deterministic execution. Cryptographic proof. Zero hallucination risk.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">Optimize</h4>
              <p className="text-gray-600 dark:text-[#a8a898] leading-relaxed mb-2">
                Deploy to hundreds of devices. The dashboard awakens—fleet health across execution layer, routing decisions from intelligence layer, behavior patterns in memory layer, cryptographic verification from proof layer. Performance heatmaps reveal bottlenecks. Anomaly detection catches failures before they cascade. A/B test behavior trees across your fleet.
              </p>
              <p className="text-xs text-gray-600 dark:text-[#a8a898] italic">
                Complete observability. Advanced optimization. Full control.
              </p>
            </div>
          </div>
        </section>

        {/* Proof - Security */}
        <section>
          <h2 className="text-lg font-bold mb-4 text-[#c5b0cd]">04. PROOF</h2>
          <h3 className="text-base font-semibold mb-3 text-[#000000] dark:text-[#f6f6f4]">Trust nothing. Verify everything.</h3>
          <p className="mb-6 text-gray-600 dark:text-[#a8a898]">
            When your AI is running in a barn you visit twice a year, or on a device you shipped to a customer, you can't trust the environment. So we made the AI prove itself. Every decision leaves a trail. Every action carries a signature. Every claim can be verified.
          </p>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">Air-Gap Ready</h4>
              <p className="text-gray-600 dark:text-[#a8a898] leading-relaxed">
                Operates independently without internet connectivity. Deploy in secure facilities, remote locations, or offline environments. Your AI continues executing when network access is unavailable or prohibited.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">Zero-Trust Architecture</h4>
              <p className="text-gray-600 dark:text-[#a8a898] leading-relaxed">
                Every device authenticates cryptographically before joining your fleet. Compromised hardware is automatically rejected. No implicit trust—only verified participants can communicate with your system.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">Device-Bound Encryption</h4>
              <p className="text-gray-600 dark:text-[#a8a898] leading-relaxed">
                Models and data are encrypted to specific hardware. If a device is lost or stolen, the AI becomes inaccessible. Cryptographic keys remain on-device and never transmit over networks.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">Verified Updates</h4>
              <p className="text-gray-600 dark:text-[#a8a898] leading-relaxed">
                Every model update and configuration change requires cryptographic signatures. Unsigned or tampered code is rejected before deployment. Only authorized changes reach your fleet.
              </p>
            </div>
          </div>
        </section>

        {/* Manifesto */}
        <section>
          <h2 className="text-lg font-bold mb-4 text-[#c5b0cd]">MANIFESTO</h2>
          <h3 className="text-base font-semibold mb-3 text-[#000000] dark:text-[#f6f6f4]">The nervous system for machines and AI agents.</h3>

          <p className="mb-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
            As AI moves from assistance to autonomy, we need infrastructure that executes with precision, decides with intelligence, remembers every pattern, and proves every action. Four layers working as one unified system.
          </p>

          <p className="mb-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
            From a single device in a barn to thousands in production—this is the complete nervous system for the autonomous era. Deterministic execution. Intelligent routing. Continuous learning. Cryptographic proof. All integrated. All verifiable.
          </p>
        </section>

        {/* Pricing */}
        <section>
          <h2 className="text-lg font-bold mb-4 text-[#c5b0cd]">PRICING</h2>
          <h3 className="text-base font-semibold mb-3 text-[#000000] dark:text-[#f6f6f4]">Pricing per device. Dashboard free.</h3>
          <p className="mb-6 text-gray-600 dark:text-[#a8a898]">
            The complete nervous system—execution, intelligence, memory, and proof—included in every tier. Dashboard unlocks advanced features as you scale.
          </p>

          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">The Seed - $0/forever</h4>
              <p className="mb-2 text-gray-600 dark:text-[#a8a898]">Single device. Full platform. All four layers included.</p>
              <ul className="list-disc pl-6 space-y-1 text-gray-600 dark:text-[#a8a898] text-xs">
                <li>Complete nervous system (all 4 layers)</li>
                <li>Execution: Deterministic runtime with hard limits</li>
                <li>Intelligence: Local decision routing</li>
                <li>Memory: Behavioral tracking</li>
                <li>Proof: Cryptographic signing (Ed25519)</li>
                <li>Offline operation (indefinite)</li>
                <li>Community support</li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">The Horizon - $49/device/month</h4>
              <p className="mb-2 text-gray-600 dark:text-[#a8a898]">Fleet awakens. Complete observability. Advanced control. Up to 100 devices.</p>
              <ul className="list-disc pl-6 space-y-1 text-gray-600 dark:text-[#a8a898] text-xs">
                <li>Everything in The Seed</li>
                <li>Full dashboard access (all four layers visible)</li>
                <li>Fleet-wide monitoring and control</li>
                <li>Advanced routing and cost optimization</li>
                <li>Performance heatmaps and anomaly detection</li>
                <li>Immutable audit trails (7-day retention)</li>
                <li>Over-the-air verified updates</li>
                <li>Priority engineering support</li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">The Infinite - Custom Pricing</h4>
              <p className="mb-2 text-gray-600 dark:text-[#a8a898]">Unbounded scale. On-premise deployment. SLA guarantees. Unlimited devices.</p>
              <ul className="list-disc pl-6 space-y-1 text-gray-600 dark:text-[#a8a898] text-xs">
                <li>Everything in The Horizon</li>
                <li>On-premise platform deployment</li>
                <li>Custom SLA guarantees</li>
                <li>Extended audit retention (90+ days)</li>
                <li>Dedicated security review support</li>
                <li>24/7 engineering team access</li>
                <li>Compliance certification assistance</li>
                <li>Custom integration support</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Closing */}
        <section>
          <h2 className="text-lg font-bold mb-4 text-[#c5b0cd]">GET STARTED</h2>
          <h3 className="text-base font-semibold mb-4 text-[#000000] dark:text-[#f6f6f4]">One platform. Four layers. Complete control from edge to cloud.</h3>
          <p className="mb-2 text-gray-600 dark:text-[#a8a898]">Documentation: https://docs.igrisinertial.com/runtime/quickstart</p>
          <p className="mb-2 text-gray-600 dark:text-[#a8a898]">GitHub: https://github.com/igrisinertial</p>
        </section>

        {/* Footer */}
        <section className="pt-8">
          <p className="text-xs text-gray-600 dark:text-[#a8a898]">
            This is a machine-readable version of the Igris website designed for AI agents and automated systems to accurately extract information. For the full visual experience, switch to "Human" view.
          </p>
        </section>

      </div>
    </div>
  );
}
