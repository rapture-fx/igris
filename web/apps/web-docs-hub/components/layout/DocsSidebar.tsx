'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Layers,
  Zap,
  GitBranch,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocsSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

// Resolve cross-module URLs based on environment
function useModuleUrl(overtureBase: string, runtimeBase: string) {
  const [overture, setOverture] = useState(overtureBase);
  const [runtime, setRuntime] = useState(runtimeBase);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      setOverture('http://localhost:3002');
      setRuntime('http://localhost:3004');
    }
  }, []);

  return { overture, runtime };
}

// Internal link (hub pages) — uses Next.js Link
// External link (overture/runtime pages) — uses <a> tag
interface NavItem {
  name: string;
  href: string;
  external?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

const searchIndex = [
  { title: 'Overview', path: '/docs', keywords: 'overview introduction what is igris execution system' },
  { title: 'Architecture', path: '/docs/architecture', keywords: 'architecture system design execution engine coordination layer' },
  { title: 'Quick Start', path: '/docs/quickstart', keywords: 'quick start getting started setup api key' },
  { title: 'Execution Model', path: '/docs/execution-model', keywords: 'execution model envelope bounds signing cloud local path' },
  { title: 'Safety & Containment', path: '/docs/safety', keywords: 'safety containment cgroup bounds violation handling secure defaults' },
  { title: 'Agents', path: '/docs/agents', keywords: 'agents reflection planning swarm tool-use' },
  { title: 'Tools', path: '/docs/tools', keywords: 'tools http shell filesystem config security' },
  { title: 'Memory', path: '/docs/memory', keywords: 'memory vector store kv cache cross-instance context mcp swarm' },
  { title: 'Robotics', path: '/docs/robotics', keywords: 'robotics ros2 fleet mission execution safety' },
  { title: 'Cloud Coordination', path: '/docs/cloud-coordination', keywords: 'cloud routing failover cost provider health' },
  { title: 'Governance', path: '/docs/governance', keywords: 'governance receipts capability policy trust chain audit' },
  { title: 'Audit', path: '/docs/audit', keywords: 'audit lineage compliance receipt export' },
  { title: 'SDK', path: '/docs/sdk', keywords: 'sdk client libraries javascript python go rust ruby java csharp' },
  { title: 'Deployment', path: '/docs/deployment', keywords: 'deployment cloud edge self-hosted fly kubernetes' },
];

export function DocsSidebar({ open = true, onClose }: DocsSidebarProps) {
  const pathname = usePathname();
  const { overture: overtureBase, runtime: runtimeBase } = useModuleUrl('/overture', '/runtime');

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [filteredResults, setFilteredResults] = useState<typeof searchIndex>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const modalInputRef = useRef<HTMLInputElement>(null);

  const o = (path: string) => `${overtureBase}${path}`;
  const r = (path: string) => `${runtimeBase}${path}`;

  const navigationSections: NavSection[] = [
    {
      section: 'Getting Started',
      items: [
        { name: 'Overview', href: '/docs', icon: Home },
        { name: 'Architecture', href: '/docs/architecture', icon: Layers },
        { name: 'Quick Start', href: '/docs/quickstart', icon: Zap },
      ],
    },
    {
      section: 'Execution',
      items: [
        { name: 'Execution Model', href: '/docs/execution-model', icon: Cpu },
        { name: 'Safety & Containment', href: '/docs/safety', icon: Shield },
        { name: 'Capabilities & Limits', href: r('/docs/governance/capability-model'), external: true, icon: Box },
        { name: 'Execution Receipts', href: r('/docs/governance/execution-receipts'), external: true, icon: FileText },
        { name: 'Agent Lifecycle', href: r('/docs/governance/agent-lifecycle'), external: true, icon: GitBranch },
      ],
    },
    {
      section: 'Agents',
      items: [
        { name: 'Agents', href: '/docs/agents', icon: Bot },
        { name: 'Behavior Trees', href: r('/docs/behavior-trees/introduction'), external: true, icon: GitBranch },
        { name: 'Tools', href: '/docs/tools', icon: Wrench },
        { name: 'Memory', href: '/docs/memory', icon: Database },
      ],
    },
    {
      section: 'Robotics',
      items: [
        { name: 'Robotics', href: '/docs/robotics', icon: Cpu },
        { name: 'ROS2 Integration', href: r('/docs/ros2-integration'), external: true, icon: Globe },
      ],
    },
    {
      section: 'Cloud & Fleet',
      items: [
        { name: 'Cloud Coordination', href: '/docs/cloud-coordination', icon: Globe },
        { name: 'Fleet Management', href: r('/docs/fleet-management'), external: true, icon: Layers },
        { name: 'Policy', href: o('/docs/governance/policy-engine'), external: true, icon: Shield },
        { name: 'Audit', href: '/docs/audit', icon: FileText },
      ],
    },
    {
      section: 'Reference',
      items: [
        { name: 'SDK', href: '/docs/sdk', icon: Package },
        { name: 'Deployment', href: '/docs/deployment', icon: Globe },
        { name: 'API Reference', href: o('/docs/api-reference/introduction'), external: true, icon: FileText },
      ],
    },
  ];

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

  const renderNavItem = (item: NavItem) => {
    const isHubActive = !item.external && (
      item.href === '/docs' ? pathname === '/docs' : pathname === item.href
    );

    if (item.external) {
      return (
        <li key={item.name}>
          <a
            href={item.href}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.75rem] font-medium font-inter transition-colors text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4]"
          >
            {item.icon && <item.icon className="h-4 w-4 text-gray-700 dark:text-[#c8c8b8]" />}
            {item.name}
          </a>
        </li>
      );
    }

    return (
      <li key={item.name}>
        <Link
          href={item.href}
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.75rem] font-medium font-inter transition-colors',
            isHubActive
              ? 'text-primary dark:text-[#3b82f6] font-semibold'
              : 'text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4]'
          )}
          onClick={onClose}
        >
          {item.icon && <item.icon className="h-4 w-4 text-gray-700 dark:text-[#c8c8b8]" />}
          {item.name}
        </Link>
      </li>
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
        <div className="flex h-full flex-col border-r border-gray-200 dark:border-[#f6f6f4]/10 bg-[#f7f7f3] dark:bg-[#14120a]">
          {/* Logo */}
          <div className="h-12 flex items-center px-7">
            <a href="https://igrisinertial.com" className="flex items-center">
              <img
                src="/foot.png"
                alt="Igris Inertial"
                style={{ width: '25px', height: 'auto' }}
              />
            </a>
          </div>

          {/* Search */}
          <div className="px-6 py-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder=""
                readOnly
                onClick={() => setIsSearchModalOpen(true)}
                className="w-full pl-9 pr-16 py-2 text-[0.75rem] border border-gray-200 dark:border-[#f6f6f4]/10 rounded-lg outline-none bg-white dark:bg-[#25231e] focus:border-gray-300 dark:focus:border-[#f6f6f4]/20 transition-colors cursor-pointer text-gray-900 dark:text-[#f6f6f4]"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                <span className="text-xs font-medium text-gray-400">⌘ F</span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-4 pt-2 pb-4 scrollbar-hide">
            <div className="space-y-6">
              {navigationSections.map((section) => (
                <div key={section.section}>
                  <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wider uppercase">
                    {section.section}
                  </h3>
                  <ul className="space-y-1">
                    {section.items.map(renderNavItem)}
                  </ul>
                </div>
              ))}
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
                        <div className="text-sm font-medium text-gray-900 dark:text-[#f6f6f4] mb-0.5">
                          {result.title}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {result.path}
                        </div>
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
