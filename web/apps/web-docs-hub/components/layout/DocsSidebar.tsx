'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Home,
  Layers,
  Zap,
  Box,
  Package,
  FileText,
  Search,
  Cpu,
  Shield,
  Globe,
  Bot,
  Wrench,
  Database,
  ChevronDown,
  Clock,
  BookOpen,
  Key,
  ArrowRight,
  DollarSign,
  Activity,
  Eye,
  Lock,
  Server,
  Network,
  Rocket,
  GitMerge,
  ShieldCheck,
  TreePine,
  Radio,
  Cloud,
  Blocks,
  ShieldAlert,
  BarChart3,
  Monitor,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getApiNavigationSections } from '@/lib/api-reference';

interface DocsSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

interface NavItem {
  name: string;
  href: string;
  external?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string;
  noActive?: boolean;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

type Section = 'docs' | 'api' | 'changelog' | 'articles';

function detectSection(pathname: string): Section {
  const p = pathname.replace(/\/$/, '');
  if (p.startsWith('/docs/articles')) return 'articles';
  if (p === '/docs/changelog') return 'changelog';
  if (p.startsWith('/docs/api-reference')) return 'api';
  return 'docs';
}

const sectionLabels: Record<Section, string> = {
  docs: 'Documentation',
  api: 'API Reference',
  changelog: 'Changelog',
  articles: 'Articles',
};

const sectionHrefs: Record<Section, string> = {
  docs: '/docs',
  api: '/docs/api-reference',
  changelog: '/docs/changelog',
  articles: '/docs/articles',
};

const methodColors: Record<string, string> = {
  GET:    'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  POST:   'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  DELETE: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  DEL:    'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  PATCH:  'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  PUT:    'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
};

const searchIndexStatic = [
  { title: 'Overview', path: '/docs', keywords: 'overview introduction what is igris execution system' },
  { title: 'Architecture', path: '/docs/architecture', keywords: 'architecture system design execution engine coordination layer' },
  { title: 'Quick Start', path: '/docs/quickstart', keywords: 'quick start getting started setup api key' },
  { title: 'Execution Model', path: '/docs/execution-model', keywords: 'execution model envelope bounds signing cloud local path' },
  { title: 'Safety & Containment', path: '/docs/safety', keywords: 'safety containment cgroup bounds violation handling secure defaults' },
  { title: 'Capabilities & Limits', path: '/docs/capability-model', keywords: 'capabilities limits capability model grants tool http shell filesystem max tokens steps' },
  { title: 'Execution Flow', path: '/docs/execution-flow', keywords: 'execution flow request lifecycle sdk overture runtime provider receipt' },
  { title: 'Execution Receipts', path: '/docs/execution-receipts', keywords: 'execution receipts signed audit record query export' },
  { title: 'Agent Lifecycle', path: '/docs/agent-lifecycle', keywords: 'agent lifecycle states init running idle degraded terminated' },
  { title: 'Durable Tasks', path: '/docs/durable-tasks', keywords: 'durable tasks wal write-ahead log crash recovery checkpoint resume token failover multi-step workflow robotics' },
  { title: 'Agents', path: '/docs/agents', keywords: 'agents reflection planning swarm tool-use' },
  { title: 'Behavior Trees', path: '/docs/behavior-trees', keywords: 'behavior trees deterministic llm nodes sequence selector condition action' },
  { title: 'Tools', path: '/docs/tools', keywords: 'tools http shell filesystem config security' },
  { title: 'Memory', path: '/docs/memory', keywords: 'memory vector store kv cache cross-instance context mcp swarm' },
  { title: 'Robotics', path: '/docs/robotics', keywords: 'robotics ros2 fleet mission execution safety' },
  { title: 'ROS2 Integration', path: '/docs/ros2-integration', keywords: 'ros2 integration robot humble iron topics services behavior trees' },
  { title: 'Cloud Coordination', path: '/docs/cloud-coordination', keywords: 'cloud routing failover cost provider health' },
  { title: 'Fleet Management', path: '/docs/fleet-management', keywords: 'fleet management instances ota update config push registration health' },
  { title: 'Policy', path: '/docs/policy', keywords: 'policy routing strategy budget limits provider selection fallback' },
  { title: 'Governance', path: '/docs/governance', keywords: 'governance receipts capability policy trust chain audit' },
  { title: 'Audit', path: '/docs/audit', keywords: 'audit lineage compliance receipt export' },
  { title: 'SDK', path: '/docs/sdk', keywords: 'sdk client libraries javascript python go rust' },
  { title: 'Deployment', path: '/docs/deployment', keywords: 'deployment cloud edge self-hosted fly kubernetes' },
  { title: 'Key Management', path: '/docs/key-management', keywords: 'key management provider api keys vault rotation byok encrypt' },
  { title: 'Pricing', path: '/docs/pricing-tiers', keywords: 'pricing tiers seed horizon infinite trial billing instances cost' },
  { title: 'API Reference', path: '/docs/api-reference', keywords: 'api reference endpoints inference management receipts fleet policy' },
  { title: 'API Introduction', path: '/docs/api-reference/introduction', keywords: 'api introduction base url surfaces endpoint pages reference guide' },
  { title: 'API Authentication', path: '/docs/api-reference/authentication', keywords: 'api authentication api key session cookie runtime auth authorization bearer' },
  { title: 'API Errors', path: '/docs/api-reference/errors', keywords: 'api errors error envelope unauthorized invalid request internal error' },
  { title: 'API Rate Limits', path: '/docs/api-reference/rate-limits', keywords: 'api rate limits throttle retry-after 429 requests per minute' },
  { title: 'Changelog', path: '/docs/changelog', keywords: 'changelog release notes version history changes updates fixes' },
  { title: 'Articles', path: '/docs/articles', keywords: 'articles engineering notes architecture deep dive' },
  { title: 'SLO Enforcer', path: '/docs/slo-enforcer', keywords: 'slo service level objective latency cost quality enforcement compliance target budget' },
  { title: 'Multi-Tenancy', path: '/docs/multi-tenancy', keywords: 'multi-tenant tenant isolation quota resource admin billing' },
  { title: 'Routing Engine', path: '/docs/escapevector', keywords: 'routing engine adaptive provider selection failover routing strategy' },
  { title: 'Circuit Breaker', path: '/docs/circuit-breaker', keywords: 'circuit breaker failure recovery open closed half-open provider health' },
  { title: 'Provider Health', path: '/docs/provider-health', keywords: 'provider health monitoring metrics latency success rate degraded unavailable' },
  { title: 'Shadow Mode', path: '/docs/shadow-mode', keywords: 'shadow mode parallel comparison divergence testing quality monitoring' },
  { title: 'Tamper-Evident Logs', path: '/docs/tamper-evident-logs', keywords: 'tamper evident logs immutable audit trail hash chain signature receipt verify export' },
  { title: 'Model Aggregation', path: '/docs/model-aggregation', keywords: 'model aggregation federated learning privacy differential noise round participant' },
  { title: 'Local LLM Fallback', path: '/docs/local-llm-fallback', keywords: 'local llm fallback gguf offline air-gapped on-device inference phi mistral llama' },
  { title: 'Data Privacy', path: '/docs/data-privacy', keywords: 'data privacy pii retention encryption gdpr compliance data handling' },
  { title: 'Error Codes', path: '/docs/error-codes', keywords: 'error codes http status errors troubleshooting api response codes' },
  { title: 'Rate Limiting', path: '/docs/rate-limiting', keywords: 'rate limiting throttle quota requests per minute headers retry' },
  { title: 'Security', path: '/docs/security', keywords: 'security authentication authorization tls encryption key signing' },
  { title: 'SLA', path: '/docs/sla', keywords: 'sla service level agreement uptime availability support response time' },
  { title: 'Upgrade & Migration', path: '/docs/upgrade-migration', keywords: 'upgrade migration version breaking changes schema compatibility guide' },
  { title: 'Webhooks', path: '/docs/webhooks', keywords: 'webhooks events notifications http callbacks subscription payload signing' },
];

// Merge static curated index with generated content index for best results
import searchIndexGenerated from '@/lib/search-index.json';
const searchIndex = [...searchIndexStatic, ...searchIndexGenerated.filter(
  gen => !searchIndexStatic.some(staticItem => staticItem.path === gen.path)
)];

const docsNavSections: NavSection[] = [
  {
    section: 'Getting Started',
    items: [
      { name: 'Overview', href: '/docs', icon: Home },
      { name: 'Architecture', href: '/docs/architecture', icon: Layers },
      { name: 'Quick Start', href: '/docs/quickstart', icon: Rocket },
    ],
  },
  {
    section: 'Execution',
    items: [
      { name: 'Execution Model', href: '/docs/execution-model', icon: Box },
      { name: 'Execution Flow', href: '/docs/execution-flow', icon: ArrowRight },
      { name: 'Safety & Containment', href: '/docs/safety', icon: Shield },
      { name: 'Capabilities & Limits', href: '/docs/capability-model', icon: ShieldCheck },
      { name: 'Execution Receipts', href: '/docs/execution-receipts', icon: FileText },
      { name: 'Durable Tasks', href: '/docs/durable-tasks', icon: RotateCcw },
      { name: 'Agent Lifecycle', href: '/docs/agent-lifecycle', icon: GitMerge },
    ],
  },
  {
    section: 'Agents',
    items: [
      { name: 'Agents', href: '/docs/agents', icon: Bot },
      { name: 'Behavior Trees', href: '/docs/behavior-trees', icon: TreePine },
      { name: 'Tools', href: '/docs/tools', icon: Wrench },
      { name: 'Memory', href: '/docs/memory', icon: Database },
    ],
  },
  {
    section: 'Robotics',
    items: [
      { name: 'Robotics', href: '/docs/robotics', icon: Cpu },
      { name: 'ROS2 Integration', href: '/docs/ros2-integration', icon: Radio },
    ],
  },
  {
    section: 'Cloud & Fleet',
    items: [
      { name: 'Cloud Coordination', href: '/docs/cloud-coordination', icon: Cloud },
      { name: 'Fleet Management', href: '/docs/fleet-management', icon: Server },
      { name: 'Policy', href: '/docs/policy', icon: ShieldAlert },
      { name: 'Audit', href: '/docs/audit', icon: FileText },
    ],
  },
  {
    section: 'Routing & Reliability',
    items: [
      { name: 'Routing Engine', href: '/docs/escapevector', icon: Zap },
      { name: 'SLO Enforcer', href: '/docs/slo-enforcer', icon: Activity },
      { name: 'Circuit Breaker', href: '/docs/circuit-breaker', icon: ShieldCheck },
      { name: 'Provider Health', href: '/docs/provider-health', icon: BarChart3 },
      { name: 'Shadow Mode', href: '/docs/shadow-mode', icon: Eye },
      { name: 'Local LLM Fallback', href: '/docs/local-llm-fallback', icon: Monitor },
    ],
  },
  {
    section: 'Privacy & Scale',
    items: [
      { name: 'Multi-Tenancy', href: '/docs/multi-tenancy', icon: Network },
      { name: 'Model Aggregation', href: '/docs/model-aggregation', icon: Blocks },
      { name: 'Tamper-Evident Logs', href: '/docs/tamper-evident-logs', icon: Lock },
    ],
  },
  {
    section: 'Reference',
    items: [
      { name: 'SDK', href: '/docs/sdk', icon: Package },
      { name: 'Deployment', href: '/docs/deployment', icon: Globe },
      { name: 'Key Management', href: '/docs/key-management', icon: Key },
      { name: 'Pricing', href: '/docs/pricing-tiers', icon: DollarSign },
    ],
  },
];

const apiNavSections: NavSection[] = getApiNavigationSections().map((section) => ({
  section: section.section,
  items: section.items,
}));

const changelogNavSections: NavSection[] = [
  {
    section: 'Release Notes',
    items: [
      { name: 'Changelog', href: '/docs/changelog', icon: Clock },
    ],
  },
];

const articlesNavSections: NavSection[] = [
  {
    section: 'Articles',
    items: [
      { name: 'All Articles',            href: '/docs/articles',                                  icon: BookOpen },
      { name: 'Edge Deployment',         href: '/docs/articles/edge-deployment-guide',            icon: FileText },
      { name: 'Safe Agents',             href: '/docs/articles/safe-agents-capability-gates',     icon: FileText },
      { name: 'Adaptive Routing',        href: '/docs/articles/thompson-sampling-routing',        icon: FileText },
    ],
  },
];

const navBySections: Record<Section, NavSection[]> = {
  docs:      docsNavSections,
  api:       apiNavSections,
  changelog: changelogNavSections,
  articles:  articlesNavSections,
};

export function DocsSidebar({ open = true, onClose }: DocsSidebarProps) {
  const pathname = usePathname();
  const activeSection = detectSection(pathname);

  const [sectionOpen, setSectionOpen] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [filteredResults, setFilteredResults] = useState<typeof searchIndex>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const modalInputRef = useRef<HTMLInputElement>(null);

  const navigationSections = navBySections[activeSection];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sectionRef.current && !sectionRef.current.contains(e.target as Node)) {
        setSectionOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase();
      const results = searchIndex.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.keywords.toLowerCase().includes(query)
      );
      setFilteredResults(results);
      setShowSearchResults(true);
      setSelectedIndex(0);
    } else {
      setFilteredResults([]);
      setShowSearchResults(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        setIsSearchModalOpen(true);
      }
      if (event.key === 'Escape' && isSearchModalOpen) {
        setIsSearchModalOpen(false);
        setSearchQuery('');
        setShowSearchResults(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchModalOpen]);

  useEffect(() => {
    if (isSearchModalOpen && modalInputRef.current) {
      modalInputRef.current.focus();
    }
  }, [isSearchModalOpen]);

  const renderNavItem = (item: NavItem, index: number) => {
    const isActive = !item.external && !item.noActive && (
      item.href === '/docs'
        ? pathname === '/docs' || pathname === '/docs/'
        : pathname === item.href || pathname === item.href + '/'
    );

    const sharedBase = 'flex items-center gap-2 rounded-lg px-3 py-1.5 text-[0.75rem] font-medium font-inter transition-colors';
    const inactiveStyle = 'text-gray-600 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] hover:bg-[#f5f5f5] dark:hover:bg-[#2c2a22]';

    const content = (
      <>
        {item.icon && (
          <item.icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-gray-700 dark:text-[#abb2bf]' : 'text-gray-400 dark:text-[#c8c8b8]')} />
        )}
        {item.badge && (
          <span className={cn('inline-flex items-center rounded px-1 py-0.5 text-[0.65rem] font-bold font-mono leading-none flex-shrink-0', methodColors[item.badge] ?? 'bg-gray-100 text-gray-600')}>
            {item.badge}
          </span>
        )}
        <span className="truncate">{item.name}</span>
      </>
    );

    if (item.external) {
      return (
        <li key={`${item.name}-${item.badge ?? ''}-${index}`}>
          <a href={item.href} className={cn(sharedBase, inactiveStyle)}>{content}</a>
        </li>
      );
    }

    return (
      <li key={`${item.name}-${item.badge ?? ''}-${index}`}>
        <Link
          href={item.href}
          className={cn(
            sharedBase,
            isActive
              ? 'bg-[#f5f5f5] dark:bg-[#282c34] text-gray-900 dark:text-[#f6f6f4] font-semibold'
              : item.noActive
                ? 'text-gray-500 dark:text-[#a8a89a] hover:text-gray-800 dark:hover:text-[#f6f6f4] hover:bg-[#f5f5f5] dark:hover:bg-[#2c2a22]'
                : inactiveStyle
          )}
          onClick={onClose}
        >
          {content}
        </Link>
      </li>
    );
  };

  const renderSection = (section: NavSection) => {
    if (activeSection !== 'api') {
      return (
        <div key={section.section}>
          <h3 className="px-3 mb-2 text-[0.8rem] font-medium text-gray-500 dark:text-gray-400">
            {section.section}
          </h3>
          <ul className="space-y-0.5">
            {section.items.map((item, i) => renderNavItem(item, i))}
          </ul>
        </div>
      );
    }

    const hasActiveItem = section.items.some((item) =>
      item.href === '/docs/api-reference'
        ? pathname === item.href || pathname === `${item.href}/`
        : pathname === item.href || pathname === `${item.href}/`
    );

    if (section.section === 'Overview') {
      return (
        <div key={section.section} className="space-y-2">
          <ul className="space-y-0.5">
            {section.items.map((item, i) => renderNavItem(item, i))}
          </ul>
        </div>
      );
    }

    return (
      <div key={section.section}>
        <div
          className={cn(
            'mb-2 px-3 text-[0.8rem] font-medium',
            hasActiveItem
              ? 'text-gray-900 dark:text-[#f6f6f4]'
              : 'text-gray-500 dark:text-gray-400'
          )}
        >
          <span>{section.section}</span>
        </div>
        <ul className="space-y-0.5">
          {section.items.map((item, i) => renderNavItem(item, i))}
        </ul>
      </div>
    );
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-screen w-64 transform transition-transform duration-200 ease-in-out md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col border-r-[0.5px] border-gray-200 dark:border-[#f6f6f4]/10 bg-white dark:bg-[#25231e]">

          {/* Logo */}
          <div className="h-12 flex items-center px-4">
            <a href="https://igrisinertial.com" className="flex items-center">
              <Image src="/inertia.png" alt="Igris Inertial" width={32} height={32} className="h-8 w-auto rounded-lg" />
            </a>
          </div>

          {/* Search */}
          <div className="px-4 pt-5 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder=""
                readOnly
                onClick={() => setIsSearchModalOpen(true)}
                className="w-full pl-9 pr-16 py-2 text-[0.75rem] border border-gray-200 dark:border-[#f6f6f4]/10 rounded-lg outline-none bg-white dark:bg-[#25231e] focus:border-gray-300 dark:focus:border-[#f6f6f4]/20 transition-colors cursor-pointer text-gray-900 dark:text-[#f6f6f4] shadow-sm"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                <span className="text-xs font-medium text-gray-400">⌘ F</span>
              </div>
            </div>
          </div>

          {/* Section switcher */}
          <div className="px-4 pb-4" ref={sectionRef}>
            <div className="relative">
              <button
                onClick={() => setSectionOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-[0.75rem] font-medium rounded-lg border border-gray-200 dark:border-[#f6f6f4]/10 bg-white dark:bg-[#25231e] text-gray-700 dark:text-[#c8c8b8] hover:bg-gray-50 dark:hover:bg-[#2c2a22] transition-colors shadow-sm"
              >
                <span>{sectionLabels[activeSection]}</span>
                <ChevronDown className={cn('h-3.5 w-3.5 text-gray-400 transition-transform duration-150', sectionOpen && 'rotate-180')} />
              </button>

              {sectionOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1b1912] border border-gray-200 dark:border-[#f6f6f4]/10 rounded-lg shadow-lg z-10 overflow-hidden">
                  {(Object.keys(sectionLabels) as Section[]).map((section) => (
                    <Link
                      key={section}
                      href={sectionHrefs[section]}
                      onClick={() => { setSectionOpen(false); onClose?.(); }}
                      className={cn(
                        'flex items-center px-3 py-2 text-[0.75rem] font-medium transition-colors',
                        activeSection === section
                          ? 'bg-gray-50 dark:bg-[#2c2a22] text-gray-900 dark:text-[#f6f6f4]'
                          : 'text-gray-600 dark:text-[#c8c8b8] hover:bg-gray-50 dark:hover:bg-[#2c2a22] hover:text-gray-900 dark:hover:text-[#f6f6f4]'
                      )}
                    >
                      {sectionLabels[section]}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
            <div className="space-y-6">
              {navigationSections.map((section) => renderSection(section))}
            </div>
          </nav>
        </div>
      </aside>

      {/* Search Modal */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
          <div
            className="absolute inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setIsSearchModalOpen(false);
              setSearchQuery('');
              setShowSearchResults(false);
            }}
          />
          <div className="relative w-full max-w-2xl mx-4">
            <div className="bg-white dark:bg-[#1b1912] rounded-xl shadow-2xl border border-gray-200 dark:border-[#f6f6f4]/10 overflow-hidden p-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  ref={modalInputRef}
                  type="text"
                  placeholder="Search documentation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((p) => Math.min(p + 1, filteredResults.length - 1)); }
                    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((p) => Math.max(p - 1, 0)); }
                    if (e.key === 'Enter' && filteredResults[selectedIndex]) {
                      window.location.href = filteredResults[selectedIndex].path;
                      setIsSearchModalOpen(false);
                    }
                  }}
                  className="w-full pl-10 pr-4 py-2 text-sm outline-none rounded-lg border border-gray-200 dark:border-[#f6f6f4]/10 focus:border-gray-300 dark:focus:border-[#f6f6f4]/20 bg-white dark:bg-[#25231e] text-gray-900 dark:text-[#f6f6f4]"
                />
              </div>

              {showSearchResults && filteredResults.length > 0 && (
                <div className="max-h-64 overflow-y-auto bg-gray-50 dark:bg-[#25231e] p-2 mt-2 rounded-lg">
                  {filteredResults.map((result, index) => (
                    <a
                      key={result.path}
                      href={result.path}
                      onClick={() => setIsSearchModalOpen(false)}
                      className={`w-full px-3 py-2 transition-colors text-left flex items-start gap-2.5 border-b border-gray-100 dark:border-[#f6f6f4]/10 last:border-b-0 block ${
                        index === selectedIndex ? 'bg-gray-100 dark:bg-[#1b1912]' : 'hover:bg-gray-50 dark:hover:bg-[#1b1912]'
                      }`}
                    >
                      <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-[#f6f6f4] mb-0.5">{result.title}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{result.path}</div>
                      </div>
                    </a>
                  ))}
                </div>
              )}

              {showSearchResults && searchQuery.length > 0 && filteredResults.length === 0 && (
                <div className="p-4 text-center mt-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No results found for &ldquo;{searchQuery}&rdquo;
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
