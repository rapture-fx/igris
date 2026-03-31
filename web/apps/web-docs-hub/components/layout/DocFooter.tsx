'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, Github, Pencil } from 'lucide-react';

const docOrder = [
  { slug: 'overview', title: 'Overview', href: '/docs' },
  { slug: 'architecture', title: 'Architecture', href: '/docs/architecture' },
  { slug: 'quickstart', title: 'Quick Start', href: '/docs/quickstart' },
  { slug: 'execution-model', title: 'Execution Model', href: '/docs/execution-model' },
  { slug: 'execution-flow', title: 'Execution Flow', href: '/docs/execution-flow' },
  { slug: 'safety', title: 'Safety & Containment', href: '/docs/safety' },
  { slug: 'capability-model', title: 'Capabilities & Limits', href: '/docs/capability-model' },
  { slug: 'execution-receipts', title: 'Execution Receipts', href: '/docs/execution-receipts' },
  { slug: 'agent-lifecycle', title: 'Agent Lifecycle', href: '/docs/agent-lifecycle' },
  { slug: 'agents', title: 'Agents', href: '/docs/agents' },
  { slug: 'behavior-trees', title: 'Behavior Trees', href: '/docs/behavior-trees' },
  { slug: 'tools', title: 'Tools', href: '/docs/tools' },
  { slug: 'memory', title: 'Memory', href: '/docs/memory' },
  { slug: 'robotics', title: 'Robotics', href: '/docs/robotics' },
  { slug: 'ros2-integration', title: 'ROS2 Integration', href: '/docs/ros2-integration' },
  { slug: 'cloud-coordination', title: 'Cloud Coordination', href: '/docs/cloud-coordination' },
  { slug: 'fleet-management', title: 'Fleet Management', href: '/docs/fleet-management' },
  { slug: 'policy', title: 'Policy', href: '/docs/policy' },
  { slug: 'audit', title: 'Audit', href: '/docs/audit' },
  { slug: 'slo-enforcer', title: 'SLO Enforcer', href: '/docs/slo-enforcer' },
  { slug: 'escapevector', title: 'EscapeVector', href: '/docs/escapevector' },
  { slug: 'circuit-breaker', title: 'Circuit Breaker', href: '/docs/circuit-breaker' },
  { slug: 'provider-health', title: 'Provider Health', href: '/docs/provider-health' },
  { slug: 'shadow-mode', title: 'Shadow Mode', href: '/docs/shadow-mode' },
  { slug: 'local-llm-fallback', title: 'Local LLM Fallback', href: '/docs/local-llm-fallback' },
  { slug: 'multi-tenancy', title: 'Multi-Tenancy', href: '/docs/multi-tenancy' },
  { slug: 'model-aggregation', title: 'Model Aggregation', href: '/docs/model-aggregation' },
  { slug: 'tamper-evident-logs', title: 'Tamper-Evident Logs', href: '/docs/tamper-evident-logs' },
  { slug: 'sdk', title: 'SDK', href: '/docs/sdk' },
  { slug: 'deployment', title: 'Deployment', href: '/docs/deployment' },
  { slug: 'key-management', title: 'Key Management', href: '/docs/key-management' },
  { slug: 'pricing-tiers', title: 'Pricing', href: '/docs/pricing-tiers' },
  { slug: 'api-reference', title: 'API Reference', href: '/docs/api-reference' },
  { slug: 'changelog', title: 'Changelog', href: '/docs/changelog' },
];

const GITHUB_REPO = 'https://github.com/wiramahendra/Schlep-engine';

interface DocFooterProps {
  slug: string;
}

export function DocFooter({ slug }: DocFooterProps) {
  const currentIndex = docOrder.findIndex(d => d.slug === slug);
  const prev = currentIndex > 0 ? docOrder[currentIndex - 1] : null;
  const next = currentIndex < docOrder.length - 1 ? docOrder[currentIndex + 1] : null;
  const editUrl = `${GITHUB_REPO}/edit/main/web/apps/web-docs-hub/docs/${slug}.mdx`;

  return (
    <div className="mt-16 pt-8 border-t border-gray-200 dark:border-[#f6f6f4]/10">
      {/* Edit link */}
      <div className="flex items-center gap-2 mb-8">
        <a
          href={editUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-[#a8a89a] hover:text-gray-700 dark:hover:text-[#f6f6f4] transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit this page on GitHub
        </a>
      </div>

      {/* Prev/Next navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {prev ? (
          <Link
            href={prev.href}
            className="group flex flex-col items-start gap-1 p-4 rounded-lg border border-gray-200 dark:border-[#f6f6f4]/10 hover:border-gray-300 dark:hover:border-[#f6f6f4]/20 hover:bg-gray-50 dark:hover:bg-[#2c2a22] transition-colors"
          >
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-[#a8a89a]">
              <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
              Previous
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-[#f6f6f4]">
              {prev.title}
            </span>
          </Link>
        ) : (
          <div />
        )}

        {next ? (
          <Link
            href={next.href}
            className="group flex flex-col items-end gap-1 p-4 rounded-lg border border-gray-200 dark:border-[#f6f6f4]/10 hover:border-gray-300 dark:hover:border-[#f6f6f4]/20 hover:bg-gray-50 dark:hover:bg-[#2c2a22] transition-colors text-right sm:ml-auto"
          >
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-[#a8a89a]">
              Next
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-[#f6f6f4]">
              {next.title}
            </span>
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
