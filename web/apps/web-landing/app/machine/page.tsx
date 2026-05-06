import { JsonLd } from '../../src/components/JsonLd';
import { FLEET_GATING_COPY } from '../../src/lib/pricing';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export default function MachinePage() {
  return (
    <>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Igris Runtime',
        description: 'A governed execution surface for AI tasks with bounded execution, signed records, and verification-ready receipts.',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Linux, macOS, Windows, ARM',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        author: { '@type': 'Organization', name: 'Igris Inertial', url: 'https://igrisinertial.com' },
        url: 'https://igrisinertial.com/machine/',
        featureList: [
          'Bounded execution with resource limits',
          'Signed records and execution receipts',
          'Local execution where configured',
          'Hosted, local, and hybrid deployment modes',
          'Execution environment visibility',
          'OS-level sandboxed containment',
        ],
      }} />
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-[#f6f6f4]" style={{ fontFamily: FONT }}>
        <div className="max-w-4xl mx-auto p-8 pb-24">
          {/* Machine Data Header */}
          <div className="pb-4">
            <div className="pl-4 pb-4 border-l border-gray-300 dark:border-[#f6f6f4]/10">
              <p className="text-[#4c1d95] dark:text-[#a78bfa] mb-3 text-sm">## MACHINE_READABLE_DATA</p>
              <div className="text-sm text-gray-700 dark:text-[#a8a898] space-y-1 mb-6">
                <p>name: Igris Inertial</p>
                <p>product: One execution system for AI tasks you can verify</p>
                <p>deployment: Hosted, local, or hybrid execution surfaces</p>
                <p>models: Configured provider-backed or local execution paths</p>
                <p>offline: deployment-dependent; see proof status for local fallback claims</p>
              </div>
              <p className="text-sm text-gray-600 dark:text-[#a8a898]">
                Full API reference: <a href="https://docs.igrisinertial.com/docs/api-reference/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">docs.igrisinertial.com/docs/api-reference/</a>
              </p>
            </div>
          </div>

          {/* Hero */}
          <div className="border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4 pb-6">
            <p className="text-[#000000] dark:text-[#f6f6f4] mb-2 text-lg font-medium"># Run AI that survives failure<br />and proves what it did.</p>
            <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
              Governed execution. Hosted, local, or hybrid deployment. OS-level containment with signed records and reviewable outcomes.
            </p>
          </div>

          {/* Challenge */}
          <div className="border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
            <p className="text-[#4c1d95] dark:text-[#a78bfa] mb-3 text-sm">## THE CHALLENGE WE SOLVE</p>
            <div className="text-gray-600 dark:text-[#a8a898] text-sm space-y-1">
              <p>- AI output that starts doing real work without enough control</p>
              <p>- Unverifiable decisions</p>
              <p>- Limited visibility into execution paths</p>
              <p>- Cloud-only assumptions where local execution may be needed</p>
              <p>- No environment visibility</p>
              <p>- Hidden performance bottlenecks</p>
              <p>- Undetected anomalies</p>
              <p>- Zero behavior history</p>
            </div>
          </div>

          {/* Product */}
          <div className="border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
            <p className="text-[#4c1d95] dark:text-[#a78bfa] mb-3 text-sm">## 01. PRODUCT</p>
            <p className="text-[#000000] dark:text-[#f6f6f4] mb-3 font-medium">### The execution layer beneath intelligence.</p>
            <p className="text-sm mb-3 text-gray-600 dark:text-[#a8a898] leading-relaxed">
              Where AI models meet real-world execution. Your systems need more than raw intelligence. They need execution that survives failure and proves every decision.
            </p>
            <p className="text-sm mb-3 text-gray-600 dark:text-[#a8a898] leading-relaxed">
              Igris governs how language model reasoning becomes action. Structured paths keep behavior bounded. Hard limits prevent runaway processes. Signed records help prove what happened.
            </p>
            <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
              One execution system runs across hosted, local, and hybrid environments. Observe decisions in real time. Inspect actions. Verify outcomes after the run.
            </p>
          </div>

          {/* What This Is */}
          <div className="border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
            <p className="text-[#4c1d95] dark:text-[#a78bfa] mb-3 text-sm">## WHAT THIS IS</p>
            <div className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed space-y-2">
              <p>This is the execution layer beneath intelligence.</p>
              <p>It doesn&apos;t decide what AI thinks.</p>
              <p>It enforces how AI runs.</p>
              <p>Behavior is bounded, reviewable, and verifiable by design.</p>
              <p>For systems where AI must respect boundaries, surface failure paths, and prove what happened.</p>
              <p>It is the execution system that sits between model output and real work.</p>
            </div>
          </div>

          {/* Architecture */}
          <div className="border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
            <p className="text-[#4c1d95] dark:text-[#a78bfa] mb-3 text-sm">## 02. THE ARCHITECTURE</p>
            <p className="text-[#000000] dark:text-[#f6f6f4] mb-3 font-medium">### Hybrid behavior trees meet LLM reasoning.</p>
            <p className="text-sm mb-6 text-gray-600 dark:text-[#a8a898]">From a single instance to thousands. From cloud to edge.</p>
            <div className="space-y-4">
              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2 font-medium">#### Execution</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                  Execute AI with bounded execution and sandboxed safety. Monitor events in real time and inspect runs across configured environments. From one agent to many environments, execution stays governed and reviewable.
                </p>
              </div>
              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2 font-medium">#### Intelligence</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                  Choose between configured providers or execution paths when needed. Advanced path selection and shadow workflows stay subordinate to governed execution rather than becoming the product identity.
                </p>
              </div>
              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2 font-medium">#### Memory & Proof</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                  Track runs across configured environments. Inspect historical decisions end-to-end. Signed records and receipts create an auditable trail after the run.
                </p>
              </div>
            </div>
          </div>

          {/* Proof */}
          <div className="border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
            <p className="text-[#4c1d95] dark:text-[#a78bfa] mb-3 text-sm">## 03. PROOF</p>
            <p className="text-[#000000] dark:text-[#f6f6f4] mb-3 font-medium">### Verifiable execution by design.</p>
            <p className="text-sm mb-6 text-gray-600 dark:text-[#a8a898]">
              Every decision is recorded. Every update is signed. Execution can be inspected after the fact—without relying on trust, assumptions, or continuous connectivity.
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2 font-medium">#### Air-gapped operation</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">Operate independently of network access. Execution continues when connectivity is unavailable or restricted.</p>
              </div>
              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2 font-medium">#### Zero-trust enrollment</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">Instances authenticate cryptographically before joining a fleet. Untrusted systems rejected automatically. Nothing trusted implicitly.</p>
              </div>
              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2 font-medium">#### Instance-bound encryption</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">Models and execution data encrypted and bound to specific systems. Keys generated and stored locally, never transmitted.</p>
              </div>
              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2 font-medium">#### Verified updates</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">When coordinated update workflows are enabled, operators can require cryptographic signatures before approved changes are applied.</p>
              </div>
            </div>
          </div>

          {/* Deployment */}
          <div className="border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
            <p className="text-[#4c1d95] dark:text-[#a78bfa] mb-3 text-sm">## 04. DEPLOYMENT</p>
            <p className="text-[#000000] dark:text-[#f6f6f4] mb-3 font-medium">### Deploy. Verify. Optimize.</p>
            <p className="text-sm mb-6 text-gray-600 dark:text-[#a8a898]">
              From initial installation to multi-environment operation without changing how execution works.
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2 font-medium">#### Deploy</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">Install a runtime where work needs to happen. Execution, event capture, and proof-oriented surfaces stay consistent from the start.</p>
              </div>
              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2 font-medium">#### Verify</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">Execution follows defined constraints. Each run returns reviewable metadata, and verification follows the signed-record and receipt path you configure.</p>
              </div>
              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2 font-medium">#### Optimize</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">As deployments expand, visibility increases. Inspect execution health, path selection, and verification status across configured environments.</p>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
            <p className="text-[#4c1d95] dark:text-[#a78bfa] mb-3 text-sm">## 05. PRICING</p>
            <p className="text-[#000000] dark:text-[#f6f6f4] mb-3 font-medium">### Three tiers. Same governed execution.</p>
            <div className="space-y-4">
              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-1 font-medium">Seed — $19/month</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898]">For builders validating verified AI execution. 1 project. 1 execution environment. 2,500 verified runs per month. Signed execution records. Execution events. Basic receipt verification. 7-day retention.</p>
              </div>
              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-1 font-medium">Horizon — $79/month</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898]">For teams running governed AI tasks. 5 projects. 10 execution environments. 50,000 verified runs per month. Everything in Seed plus failure-path configuration, tool and permission controls, team access, advanced event search, 60-day retention, and priority email support.</p>
              </div>
              <div>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-1 font-medium">Infinite — Custom</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898]">For private deployment and advanced governance. Custom execution volume. Custom execution environments. Everything in Horizon plus private deployment options, custom retention policy, advanced audit exports, dedicated onboarding, and security review support.</p>
              </div>
            </div>
            <p className="text-sm mt-3 text-gray-600 dark:text-[#a8a898]">
              Full pricing: <a href="https://igrisinertial.com/pricing/" className="text-blue-600 dark:text-blue-400 hover:underline">igrisinertial.com/pricing/</a>
            </p>
            <p className="text-sm mt-3 text-gray-600 dark:text-[#a8a898]">
              Fleet and operator access scale with the same plan model: {FLEET_GATING_COPY}
            </p>
          </div>

          {/* Why It Exists */}
          <div className="border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
            <p className="text-[#4c1d95] dark:text-[#a78bfa] mb-3 text-sm">## WHY IT EXISTS</p>
            <p className="text-[#000000] dark:text-[#f6f6f4] mb-3 font-medium">### Infrastructure for the autonomous era.</p>
            <div className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed space-y-2">
              <p>AI is becoming autonomous. The systems that run it must be trustworthy.</p>
              <p>We believe AI systems that do work need a governed execution layer.</p>
              <p>One that records what happened, surfaces failure paths, and supports verification after the run.</p>
              <p>This is that layer. Built for the next era of computing.</p>
            </div>
          </div>

          {/* Closing */}
          <div className="border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
            <p className="text-[#000000] dark:text-[#f6f6f4] mb-3 font-medium text-base">### Governed execution across hosted and local environments.</p>
            <p className="text-sm mb-2 text-gray-600 dark:text-[#a8a898]">Documentation: <a href="https://docs.igrisinertial.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">docs.igrisinertial.com</a></p>
            <p className="text-sm mb-2 text-gray-600 dark:text-[#a8a898]">GitHub: <a href="https://github.com/Igris-inertial" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">github.com/Igris-inertial</a></p>
            <p className="text-sm mb-2 text-gray-600 dark:text-[#a8a898]">Get started: <a href="https://console.igrisinertial.com/auth?mode=signup" className="text-blue-600 dark:text-blue-400 hover:underline">console.igrisinertial.com/auth?mode=signup</a></p>
          </div>

          {/* Footer note */}
          <div className="border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
            <p className="text-xs text-gray-400 dark:text-[#a8a898] mt-4">---</p>
            <p className="text-xs text-gray-400 dark:text-[#a8a898] mt-2">
              Machine-readable version of igrisinertial.com. For the full visual experience, visit <a href="https://igrisinertial.com" className="text-blue-600 dark:text-blue-400 hover:underline">igrisinertial.com</a>.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
