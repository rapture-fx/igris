'use client';

import React from 'react';

export default function AIAgentView() {
  return (
    <div className="min-h-screen bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] p-8 pb-24 text-sm transition-colors duration-200" style={{ fontFamily: 'Roboto Mono, monospace' }}>
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <section>
          <h1 className="text-2xl font-bold mb-2 text-[#000000] dark:text-[#f6f6f4]">IGRIS - The Nervous System for Machines and AI Agents</h1>
          <p className="text-gray-600 dark:text-[#a8a898]">Official Website: https://igrisinertial.com</p>
        </section>

        {/* Overview */}
        <section>
          <h2 className="text-lg font-bold mb-4 text-[#c5b0cd]">OVERVIEW</h2>
          <p className="mb-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
            Igris provides a complete nervous system platform for deploying and managing AI agents at scale.
            The platform combines hybrid behavior trees with LLM reasoning to create deterministic, verifiable,
            and intelligent AI systems that operate anywhere—from edge devices to cloud infrastructure.
          </p>
        </section>

        {/* Challenges Solved */}
        <section>
          <h2 className="text-lg font-bold mb-4 text-[#c5b0cd]">CHALLENGES SOLVED</h2>
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

        {/* Product Architecture */}
        <section>
          <h2 className="text-lg font-bold mb-4 text-[#c5b0cd]">PRODUCT: THE COMPLETE NERVOUS SYSTEM</h2>
          <p className="mb-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
            Hybrid behavior trees meet LLM reasoning. The AI executes deterministically through structured
            decision paths while leveraging language models only when needed. No pure hallucination.
            No random behavior. Just predictable intelligence that proves every decision cryptographically.
          </p>
          <p className="mb-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
            Four layers—execution, intelligence, memory, proof—work as one nervous system. Deploy on any device.
            When you scale to hundreds, the dashboard reveals fleet health, routing decisions, behavior patterns,
            and cryptographic verification.
          </p>
        </section>

        {/* Four Layers */}
        <section>
          <h2 className="text-lg font-bold mb-4 text-[#c5b0cd]">THE FOUR LAYERS</h2>

          <h3 className="text-base font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">1. EXECUTION</h3>
          <p className="mb-4 pl-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
            Monitor every device in real-time. Deploy models instantly. Push configurations fleet-wide.
            From a single agent to thousands—the runtime layer executes with deterministic precision,
            sandboxed safety, and predictable latency.
          </p>

          <h3 className="text-base font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">2. INTELLIGENCE</h3>
          <p className="mb-4 pl-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
            Route decisions through multiple LLM providers. Balance cost and performance. Test in shadow
            mode before production. The decision layer adapts intelligently while maintaining complete
            control over every choice.
          </p>

          <h3 className="text-base font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">3. MEMORY</h3>
          <p className="mb-4 pl-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
            Track behavior trees across your fleet. Detect anomalies automatically. Replay historical decisions.
          </p>

          <h3 className="text-base font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">4. PROOF</h3>
          <p className="mb-4 pl-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
            Every action cryptographically signed. Immutable audit trail from debugging incidents to proving
            compliance. Cryptographic signatures on every decision. Complete verification from edge to cloud.
          </p>
        </section>

        {/* Deployment */}
        <section>
          <h2 className="text-lg font-bold mb-4 text-[#c5b0cd]">DEPLOYMENT</h2>

          <h3 className="text-base font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">Deploy</h3>
          <p className="mb-4 pl-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
            16MB binary. Complete nervous system in a single file. Behavior trees for structure, LLM reasoning
            for intelligence, cryptographic signing for proof. Deploy on Raspberry Pi or industrial edge device.
            No containers. No dependencies. No cloud required.
          </p>

          <h3 className="text-base font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">Verify</h3>
          <p className="mb-4 pl-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
            Behavior trees execute deterministically. LLMs reason when needed. Memory layer tracks every decision.
            Proof layer signs everything. Your AI operates predictably offline while the nervous system records
            what it does, why it did it, and proves it happened exactly as specified. Deterministic execution.
            Cryptographic proof. Zero hallucination risk.
          </p>

          <h3 className="text-base font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">Optimize</h3>
          <p className="mb-4 pl-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
            Deploy to hundreds of devices. The dashboard awakens—fleet health across execution layer, routing
            decisions from intelligence layer, behavior patterns in memory layer, cryptographic verification
            from proof layer. Performance heatmaps reveal bottlenecks. Anomaly detection catches failures
            before they cascade. A/B test behavior trees across your fleet. Complete observability.
            Advanced optimization. Full control.
          </p>
        </section>

        {/* Security/Proof */}
        <section>
          <h2 className="text-lg font-bold mb-4 text-[#c5b0cd]">SECURITY & PROOF</h2>

          <h3 className="text-base font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">Air-Gap Ready</h3>
          <p className="mb-4 pl-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
            Operates independently without internet connectivity. Deploy in secure facilities, remote locations,
            or offline environments. Your AI continues executing when network access is unavailable or prohibited.
          </p>

          <h3 className="text-base font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">Zero-Trust Architecture</h3>
          <p className="mb-4 pl-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
            Every device authenticates cryptographically before joining your fleet. Compromised hardware is
            automatically rejected. No implicit trust—only verified participants can communicate with your system.
          </p>

          <h3 className="text-base font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">Device-Bound Encryption</h3>
          <p className="mb-4 pl-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
            Models and data are encrypted to specific hardware. If a device is lost or stolen, the AI becomes
            inaccessible. Cryptographic keys remain on-device and never transmit over networks.
          </p>

          <h3 className="text-base font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">Verified Updates</h3>
          <p className="mb-4 pl-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
            Every model update and configuration change requires cryptographic signatures. Unsigned or tampered
            code is rejected before deployment. Only authorized changes reach your fleet.
          </p>
        </section>

        {/* Pricing */}
        <section>
          <h2 className="text-lg font-bold mb-4 text-[#c5b0cd]">PRICING</h2>

          <h3 className="text-base font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">The Seed - $0/forever</h3>
          <p className="mb-2 pl-4 text-gray-600 dark:text-[#a8a898]">Single device. Full platform. All four layers included.</p>
          <ul className="list-disc pl-10 mb-4 space-y-1 text-gray-600 dark:text-[#a8a898]">
            <li>Complete nervous system (all 4 layers)</li>
            <li>Execution: Deterministic runtime with hard limits</li>
            <li>Intelligence: Local decision routing</li>
            <li>Memory: Behavioral tracking</li>
            <li>Proof: Cryptographic signing (Ed25519)</li>
            <li>Offline operation (indefinite)</li>
            <li>Community support</li>
          </ul>

          <h3 className="text-base font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">The Horizon - $49/device/month</h3>
          <p className="mb-2 pl-4 text-gray-600 dark:text-[#a8a898]">Fleet awakens. Complete observability. Advanced control. Up to 100 devices.</p>
          <ul className="list-disc pl-10 mb-4 space-y-1 text-gray-600 dark:text-[#a8a898]">
            <li>Everything in The Seed</li>
            <li>Full dashboard access (all four layers visible)</li>
            <li>Fleet-wide monitoring and control</li>
            <li>Advanced routing and cost optimization</li>
            <li>Performance heatmaps and anomaly detection</li>
            <li>Immutable audit trails (7-day retention)</li>
            <li>Over-the-air verified updates</li>
            <li>Priority engineering support</li>
          </ul>

          <h3 className="text-base font-semibold mb-2 text-[#000000] dark:text-[#f6f6f4]">The Infinite - Custom Pricing</h3>
          <p className="mb-2 pl-4 text-gray-600 dark:text-[#a8a898]">Unbounded scale. On-premise deployment. SLA guarantees. Unlimited devices.</p>
          <ul className="list-disc pl-10 mb-4 space-y-1 text-gray-600 dark:text-[#a8a898]">
            <li>Everything in The Horizon</li>
            <li>On-premise platform deployment</li>
            <li>Custom SLA guarantees</li>
            <li>Extended audit retention (90+ days)</li>
            <li>Dedicated security review support</li>
            <li>24/7 engineering team access</li>
            <li>Compliance certification assistance</li>
            <li>Custom integration support</li>
          </ul>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-lg font-bold mb-4 text-[#c5b0cd]">CONTACT & DOCUMENTATION</h2>
          <p className="mb-2 text-gray-600 dark:text-[#a8a898]">Documentation: https://docs.igrisinertial.com/runtime/quickstart</p>
          <p className="mb-2 text-gray-600 dark:text-[#a8a898]">GitHub: https://github.com/igrisinertial</p>
          <p className="mb-2 text-gray-600 dark:text-[#a8a898]">For enterprise inquiries and custom deployments, contact through the website.</p>
        </section>

        {/* Footer */}
        <section className="pt-8">
          <p className="text-xs text-gray-600 dark:text-[#a8a898]">
            This is a machine-readable version of the Igris website designed for AI agents and automated systems
            to accurately extract information. For the full visual experience, switch to "Human" view.
          </p>
        </section>

      </div>
    </div>
  );
}
