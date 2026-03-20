'use client';

import React, { useState, useEffect } from 'react';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export default function AIAgentView() {
  const [visibleSections, setVisibleSections] = useState(0);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const totalSections = 10;

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
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev < loadingSteps.length - 1) {
          return prev + 1;
        } else {
          clearInterval(stepInterval);
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
    }, 400);

    return () => clearInterval(stepInterval);
  }, [isMounted]);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200" style={{ fontFamily: FONT }}>
      {visibleSections === 0 && (
        <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-[#0A0A0A]">
          <div className="flex flex-col items-start gap-1 text-sm" style={{ fontFamily: FONT }}>
            {loadingSteps.slice(0, loadingStep + 1).map((step, index) => (
              <div key={index} className="flex items-center gap-2">
                {index === loadingSteps.length - 1 ? (
                  <span className="text-[#4c1d95] dark:text-[#a78bfa]">{step}</span>
                ) : (
                  <span className="text-gray-600 dark:text-[#a8a898]">{step}</span>
                )}
              </div>
            ))}
            {loadingStep < loadingSteps.length - 1 && (
              <div className="flex items-center gap-2">
                <span className="animate-pulse text-gray-600 dark:text-[#a8a898]">_</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={`flex flex-col h-screen ${visibleSections === 0 ? 'hidden' : ''}`}>
        {/* Machine Data Header */}
        {visibleSections >= 1 && (
          <div className="flex-shrink-0 animate-fadeInUp py-4 bg-white dark:bg-[#0A0A0A]">
            <div className="max-w-4xl mx-auto px-8 pb-4">
              <div className="pl-4 pb-4 border-l border-gray-300 dark:border-[#f6f6f4]/10">
                <p className="text-[#4c1d95] dark:text-[#a78bfa] mb-3 text-sm">## MACHINE_READABLE_DATA</p>
                <div className="text-sm text-gray-700 dark:text-[#a8a898] space-y-1 mb-6">
                  <p>name: Igris Inertial</p>
                  <p>product: The execution layer beneath intelligence</p>
                  <p>deployment: Servers, edge devices, or air-gapped environments</p>
                  <p>models: BYOM (local GGUF) + BYOK (cloud APIs)</p>
                  <p>offline: true (local execution when cloud fails)</p>
                </div>
                <p className="text-sm text-gray-600 dark:text-[#a8a898]">
                  Full API reference: <a href="https://docs.igrisinertial.com/docs/api-reference/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">docs.igrisinertial.com/docs/api-reference/</a>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-6 p-8 pb-24">

            {/* Hero */}
            {visibleSections >= 1 && (
              <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4 pb-6">
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2 text-lg font-medium"># Run AI that survives failure<br />and proves what it did.</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                  Deterministic runtime. Cloud + local fallback. OS-level containment with signed violation logs. Deploy anywhere.
                </p>
              </div>
            )}

            {/* Challenge */}
            {visibleSections >= 2 && (
              <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
                <p className="text-[#4c1d95] dark:text-[#a78bfa] mb-3 text-sm">## THE CHALLENGE WE SOLVE</p>
                <div className="text-gray-600 dark:text-[#a8a898] text-sm space-y-1">
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

            {/* Product */}
            {visibleSections >= 3 && (
              <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
                <p className="text-[#4c1d95] dark:text-[#a78bfa] mb-3 text-sm">## 01. PRODUCT</p>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-3 font-medium">### The execution layer beneath intelligence.</p>
                <p className="text-sm mb-3 text-gray-600 dark:text-[#a8a898] leading-relaxed">
                  Where AI models meet real-world execution. Your systems need more than raw intelligence. They need execution that survives failure and proves every decision.
                </p>
                <p className="text-sm mb-3 text-gray-600 dark:text-[#a8a898] leading-relaxed">
                  The Nervous System governs how language model reasoning becomes action. Structured paths keep behavior bounded. Hard limits prevent runaway processes. Cryptographic signatures prove what happened.
                </p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                  One binary runs on servers, robots, and edge devices. Same guarantees anywhere. Observe decisions in real time. Inspect actions. Verify outcomes. Trust what happened.
                </p>
              </div>
            )}

            {/* What This Is */}
            {visibleSections >= 4 && (
              <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
                <p className="text-[#4c1d95] dark:text-[#a78bfa] mb-3 text-sm">## WHAT THIS IS</p>
                <div className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed space-y-2">
                  <p>This is the execution layer beneath intelligence.</p>
                  <p>It doesn&apos;t decide what AI thinks.</p>
                  <p>It enforces how AI runs.</p>
                  <p>Behavior is bounded, repeatable, and verifiable by design.</p>
                  <p>For systems where AI must survive failure, operate offline, and prove every decision.</p>
                  <p>If AI is the brain, this is the nervous system.</p>
                </div>
              </div>
            )}

            {/* Architecture */}
            {visibleSections >= 5 && (
              <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
                <p className="text-[#4c1d95] dark:text-[#a78bfa] mb-3 text-sm">## 02. THE ARCHITECTURE</p>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-3 font-medium">### Hybrid behavior trees meet LLM reasoning.</p>
                <p className="text-sm mb-6 text-gray-600 dark:text-[#a8a898]">From a single instance to thousands. From cloud to edge.</p>
                <div className="space-y-4">
                  <div>
                    <p className="text-[#000000] dark:text-[#f6f6f4] mb-2 font-medium">#### Execution</p>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                      Execute AI with deterministic precision and sandboxed safety. Monitor in real time, deploy models instantly, and push configurations fleet-wide. From one agent to thousands, execution remains predictable and bounded.
                    </p>
                  </div>
                  <div>
                    <p className="text-[#000000] dark:text-[#f6f6f4] mb-2 font-medium">#### Intelligence</p>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                      Route decisions across multiple LLM providers. Balance cost and performance. Test in shadow mode before production. The decision layer adapts while execution stays controlled.
                    </p>
                  </div>
                  <div>
                    <p className="text-[#000000] dark:text-[#f6f6f4] mb-2 font-medium">#### Memory & Proof</p>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                      Track behavior across the fleet. Detect anomalies automatically. Inspect historical decisions end-to-end. Every action is cryptographically signed, creating an immutable audit trail.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Proof */}
            {visibleSections >= 6 && (
              <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
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
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">Model updates and configuration changes require cryptographic signatures. Only approved updates execute across the fleet.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Deployment */}
            {visibleSections >= 7 && (
              <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
                <p className="text-[#4c1d95] dark:text-[#a78bfa] mb-3 text-sm">## 04. DEPLOYMENT</p>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-3 font-medium">### Deploy. Verify. Optimize.</p>
                <p className="text-sm mb-6 text-gray-600 dark:text-[#a8a898]">
                  From initial installation to fleet-level operation without changing how execution works.
                </p>
                <div className="space-y-4">
                  <div>
                    <p className="text-[#000000] dark:text-[#f6f6f4] mb-2 font-medium">#### Deploy</p>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">Install a single binary on any supported system. Execution, decision routing, memory, and proof included from the start.</p>
                  </div>
                  <div>
                    <p className="text-[#000000] dark:text-[#f6f6f4] mb-2 font-medium">#### Verify</p>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">Execution follows defined constraints. Each decision recorded and cryptographically signed. Verification does not depend on network access.</p>
                  </div>
                  <div>
                    <p className="text-[#000000] dark:text-[#f6f6f4] mb-2 font-medium">#### Optimize</p>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">As deployments expand, visibility increases. Insight into execution health, decision routing, and verification status across the fleet.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Why It Exists */}
            {visibleSections >= 8 && (
              <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
                <p className="text-[#4c1d95] dark:text-[#a78bfa] mb-3 text-sm">## WHY IT EXISTS</p>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-3 font-medium">### Infrastructure for the autonomous era.</p>
                <div className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed space-y-2">
                  <p>AI is becoming autonomous. The systems that run it must be trustworthy.</p>
                  <p>We believe every AI—whether software agent or physical robot—should run on a deterministic execution layer.</p>
                  <p>One that proves every decision. One that works when networks don&apos;t.</p>
                  <p>This is that layer. Built for the next era of computing.</p>
                </div>
              </div>
            )}

            {/* Closing */}
            {visibleSections >= 9 && (
              <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-3 font-medium text-base">### Complete control from edge to cloud.</p>
                <p className="text-sm mb-2 text-gray-600 dark:text-[#a8a898]">Documentation: <a href="https://docs.igrisinertial.com/runtime/docs/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">docs.igrisinertial.com/runtime/docs/</a></p>
                <p className="text-sm mb-2 text-gray-600 dark:text-[#a8a898]">GitHub: <a href="https://github.com/igrisinertial" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">github.com/igrisinertial</a></p>
              </div>
            )}

            {/* Footer note */}
            {visibleSections >= 10 && (
              <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
                <p className="text-xs text-gray-400 dark:text-[#a8a898] mt-4">---</p>
                <p className="text-xs text-gray-400 dark:text-[#a8a898] mt-2">
                  Machine-readable version of igrisinertial.com, designed for AI agents and automated systems. For the full visual experience, switch to HUMAN view.
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
