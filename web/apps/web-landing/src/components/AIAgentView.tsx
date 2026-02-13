'use client';

import React, { useState, useEffect } from 'react';

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
    <div className="min-h-screen bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200" style={{ fontFamily: 'SF Mono, Monaco, Inconsolata, Fira Code, monospace' }}>
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
                  <span className="text-[#85612c] dark:text-[#c5b0cd]">{step}</span>
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

      <div className={`flex flex-col h-screen ${visibleSections === 0 ? 'hidden' : ''}`}>
        {/* Machine Data Header */}
        {visibleSections >= 1 && (
          <div className="flex-shrink-0 animate-fadeInUp py-4 bg-[#f6f6f4] dark:bg-[#1b1912]/30">
            <div className="max-w-4xl mx-auto px-8 pb-4">
              <div className="pl-4 pb-4 border-l border-gray-300 dark:border-[#f6f6f4]/10">
              <p className="text-[#85612c] dark:text-[#c5b0cd] mb-3 text-sm font-mono">## MACHINE_READABLE_DATA</p>
              
              <div className="text-sm text-gray-700 dark:text-[#a8a898] font-mono space-y-1 mb-6">
                <p>name: Igris Inertial</p>
                <p>product: Nervous system for autonomous systems</p>
                <p>deployment: Servers, edge devices, or air-gapped environments</p>
                <p>models: BYOM (local GGUF) + BYOK (cloud APIs)</p>
                <p>offline: true (local execution when cloud fails)</p>
              </div>

              <p className="text-sm text-gray-600 dark:text-[#a8a898] mt-2">
                Full API reference: <a href="https://docs.igrisinertial.com/runtime/docs/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">docs.igrisinertial.com/runtime/docs/</a>
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
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-2"># The Nervous System for Autonomous Systems</p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-4">
                  A deterministic execution layer for AI that operates anywhere—even when connectivity fails.
                </p>
              </div>
            )}

            {/* Solve */}
            {visibleSections >= 2 && (
              <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
                <p className="text-[#85612c] dark:text-[#c5b0cd] mb-3">## THE CHALLENGE WE SOLVE</p>
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

            {/* Products */}
            {visibleSections >= 3 && (
              <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
                <p className="text-[#85612c] dark:text-[#c5b0cd] mb-3">## 01. PRODUCT</p>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-3">### Execution, intelligence, memory, and proof—as one system.</p>

                <p className="text-sm mb-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
                  Language models reason. Behavior trees enforce. Memory persists. Proof verifies. All running deterministically, whether on a single server or across thousands of instances.
                </p>

                <p className="text-sm mb-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
                  Your AI executes with structured, bounded behavior. Every decision is recorded and cryptographically verifiable. No uncontrolled execution. No silent failures.
                </p>

                <p className="text-sm mb-4 text-gray-600 dark:text-[#a8a898] leading-relaxed">
                  As scale increases, the dashboard makes execution state, decision routing, historical behavior, and verification data visible across the entire fleet.
                </p>
              </div>
            )}

            {/* WhatThisIs */}
            {visibleSections >= 4 && (
              <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
                <p className="text-[#85612c] dark:text-[#c5b0cd] mb-3">## WHAT THIS IS</p>
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

            {/* CoreCapabilities */}
            {visibleSections >= 5 && (
              <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
                <p className="text-[#85612c] dark:text-[#c5b0cd] mb-3">## 02. THE ARCHITECTURE</p>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-3">### Every layer working together</p>
                <p className="text-sm mb-6 text-gray-600 dark:text-[#a8a898]">From a single instance to thousands. From cloud to edge.</p>

                <div className="space-y-4">
                  <div>
                    <p className="text-[#000000] dark:text-[#f6f6f4] mb-2">#### Execution</p>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                      Execute AI with deterministic precision and sandboxed safety. Monitor in real time, deploy models instantly, and push configurations fleet-wide. From one agent to thousands, execution remains predictable and bounded.
                    </p>
                  </div>

                  <div>
                    <p className="text-[#000000] dark:text-[#f6f6f4] mb-2">#### Intelligence</p>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                      Route decisions across multiple LLM providers. Balance cost and performance. Test in shadow mode before production. The decision layer adapts while execution stays controlled.
                    </p>
                  </div>

                  <div>
                    <p className="text-[#000000] dark:text-[#f6f6f4] mb-2">#### Memory & Proof</p>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                      Track behavior across the fleet. Detect anomalies automatically. Inspect historical decisions end-to-end. Every action is cryptographically signed, creating an immutable audit trail—from debugging incidents to proving compliance.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* MultiTenancy - Proof */}
            {visibleSections >= 6 && (
              <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
                <p className="text-[#85612c] dark:text-[#c5b0cd] mb-3">## 03. PROOF</p>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-3">### Verifiable execution by design</p>
                <p className="text-sm mb-6 text-gray-600 dark:text-[#a8a898]">
                  Every decision is recorded. Every update is signed. Execution can be inspected after the fact—without relying on trust, assumptions, or continuous connectivity.
                </p>

                <div className="space-y-4">
                  <div>
                    <p className="text-[#000000] dark:text-[#f6f6f4] mb-2">#### Air-gapped operation</p>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                      Operate independently of network access. Deploy in secure facilities, remote environments, or fully offline locations. Execution continues when connectivity is unavailable or restricted.
                    </p>
                  </div>

                  <div>
                    <p className="text-[#000000] dark:text-[#f6f6f4] mb-2">#### Zero-trust enrollment</p>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                      Instances authenticate cryptographically before joining a fleet. Each verified individually. Untrusted systems rejected automatically. Nothing trusted implicitly.
                    </p>
                  </div>

                  <div>
                    <p className="text-[#000000] dark:text-[#f6f6f4] mb-2">#### Instance-bound encryption</p>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                      Models and execution data encrypted and bound to specific systems. If an instance is lost, data remains inaccessible. Keys generated and stored locally, never transmitted.
                    </p>
                  </div>

                  <div>
                    <p className="text-[#000000] dark:text-[#f6f6f4] mb-2">#### Verified updates</p>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                      Model updates and configuration changes require cryptographic signatures. Unsigned artifacts rejected before deployment. Only approved updates execute across the fleet.
                    </p>
                  </div>

                  <div>
                    <p className="text-[#000000] dark:text-[#f6f6f4] mb-2">#### Verified synchronization</p>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                      When connectivity is available, fleet state changes are verified before application. Only signed updates propagate. Execution guarantees remain unchanged regardless of network state.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* HowItWorks - Deployment */}
            {visibleSections >= 7 && (
              <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
                <p className="text-[#85612c] dark:text-[#c5b0cd] mb-3">## 04. DEPLOYMENT</p>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-3">### Deploy. Verify. Optimize.</p>
                <p className="text-sm mb-6 text-gray-600 dark:text-[#a8a898]">
                  From initial installation to fleet-level operation without changing how execution works.
                </p>

                <div className="space-y-4">
                  <div>
                    <p className="text-[#000000] dark:text-[#f6f6f4] mb-2">#### Deploy</p>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                      Install a single binary on any supported system. Execution, decision routing, memory, and proof included from the start. Operates independently of containers or external services.
                    </p>
                  </div>

                  <div>
                    <p className="text-[#000000] dark:text-[#f6f6f4] mb-2">#### Verify</p>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                      Execution follows defined constraints. Behavior trees execute predictably. Each decision recorded and cryptographically signed. Verification does not depend on network access.
                    </p>
                  </div>

                  <div>
                    <p className="text-[#000000] dark:text-[#f6f6f4] mb-2">#### Optimize</p>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                      As deployments expand, visibility increases. The dashboard provides insight into execution health, decision routing, and verification status across the fleet.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* WhyItExists */}
            {visibleSections >= 8 && (
              <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
                <p className="text-[#85612c] dark:text-[#c5b0cd] mb-3">## WHY IT EXISTS</p>
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-3">### Infrastructure for the autonomous era</p>
                <div className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed space-y-2">
                  <p>AI is becoming autonomous. The systems that run it must be trustworthy.</p>
                  <p>We believe every AI—whether software agent or physical robot—should run on a deterministic execution layer.</p>
                  <p>One that proves every decision. One that works when networks don&apos;t.</p>
                  <p>This is that layer. Built for the next era of computing.</p>
                </div>
              </div>
            )}

            {/* ClosingPosition */}
            {visibleSections >= 9 && (
              <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
                <p className="text-[#000000] dark:text-[#f6f6f4] mb-3">### One platform. Four layers. Complete control.</p>
                <p className="text-sm mb-2 text-gray-600 dark:text-[#a8a898]">Documentation: <a href="https://docs.igrisinertial.com/runtime/docs/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">docs.igrisinertial.com/runtime/docs/</a></p>
                <p className="text-sm mb-2 text-gray-600 dark:text-[#a8a898]">GitHub: <a href="https://github.com/igrisinertial" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">github.com/igrisinertial</a></p>
              </div>
            )}

            {/* Closing */}
            {visibleSections >= 10 && (
              <div className="animate-fadeInUp border-l border-gray-300 dark:border-[#f6f6f4]/10 pl-4">
                <p className="text-xs text-gray-600 dark:text-[#a8a898] mt-4">
                  ---
                </p>
                <p className="text-xs text-gray-600 dark:text-[#a8a898] mt-2">
                  This is a machine-readable version of the Igris website designed for AI agents and automated systems to accurately extract information. For the full visual experience, switch to HUMAN view.
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
