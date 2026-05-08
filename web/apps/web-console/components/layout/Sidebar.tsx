'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth-client';
import {
  ChevronDown, Search, FileText,
  LayoutDashboard, PlayCircle, Network,
  ScrollText, BadgeCheck, CalendarClock, SlidersHorizontal,
  KeyRound, Settings, LogOut,
  BookOpen, ExternalLink, Mail, Activity,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useTenant } from '@/hooks/useTenant';
import { useSession } from '@/lib/auth-client';
import { getInitials } from '@/utils/helpers';
import { cn } from '@/utils/helpers';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

interface NavigationItem {
  name: string;
  href?: string;
  icon: any;
  children?: Array<{ name: string; href: string }>;
}

const navigation: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Execution',
    icon: PlayCircle,
    children: [
      { name: 'Runs', href: '/execution/runs' },
      { name: 'Tasks', href: '/execution/tasks' },
      { name: 'Approvals', href: '/execution/approvals' },
    ],
  },
  {
    name: 'Proof',
    icon: BadgeCheck,
    children: [
      { name: 'Receipts', href: '/proof/receipts' },
      { name: 'Violations', href: '/proof/violations' },
    ],
  },
  {
    name: 'Policy',
    icon: ScrollText,
    children: [
      { name: 'Bounds', href: '/policy/bounds' },
      { name: 'Capabilities', href: '/policy/capabilities' },
    ],
  },
  {
    name: 'Infrastructure',
    icon: Network,
    children: [
      { name: 'Providers', href: '/models/providers' },
      { name: 'Devices', href: '/fleet/devices' },
    ],
  },
  {
    name: 'History',
    icon: CalendarClock,
    children: [
      { name: 'Logs', href: '/history/logs' },
      { name: 'Metrics', href: '/history/metrics' },
    ],
  },
  {
    name: 'Settings',
    icon: SlidersHorizontal,
    children: [
      { name: 'General', href: '/settings/general' },
      { name: 'API Keys', href: '/settings/keys' },
      { name: 'License', href: '/settings/license' },
    ],
  },
];

const DEFAULT_EXPANDED: Record<string, boolean> = {
  Execution: false,
  Proof: false,
  Policy: false,
  Infrastructure: false,
  History: false,
  Settings: false,
};

export function Sidebar({ open = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: tenant } = useTenant();
  const { data: session } = useSession();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  // Prefer tenant name from API; fall back to Better Auth session name (always present for OAuth)
  const resolvedName = tenant?.name || session?.user?.name || session?.user?.email?.split('@')[0] || 'User';
  const initials = getInitials(resolvedName);
  const displayName = resolvedName;
  const email = tenant?.email || session?.user?.email || '';

  const handleLogout = async () => {
    await signOut({ fetchOptions: { onSuccess: () => { window.location.href = '/auth'; } } });
  };
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [filteredResults, setFilteredResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const modalInputRef = useRef<HTMLInputElement>(null);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(DEFAULT_EXPANDED);

  // Hydrate expanded state from localStorage after mount (avoids SSR/client mismatch)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar_expanded');
      if (saved) setExpandedSections((prev) => ({ ...prev, ...JSON.parse(saved) }));
    } catch {}
  }, []);

  // Always expand the section containing the active route (never collapses others)
  useEffect(() => {
    const activeSection = navigation.find((item) =>
      item.children?.some(
        (child) => pathname === child.href || pathname?.startsWith(child.href + '/')
      )
    );
    if (activeSection) {
      setExpandedSections((prev) => {
        if (prev[activeSection.name]) return prev; // already expanded, no update
        return { ...prev, [activeSection.name]: true };
      });
    }
  }, [pathname]);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar_expanded', JSON.stringify(expandedSections));
  }, [expandedSections]);

  const toggleSection = (name: string) => {
    setExpandedSections((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  // Build flat search index with rich keywords
  const searchIndex = [
    { title: 'Dashboard', path: '/dashboard', keywords: 'dashboard overview system stats home' },
    { title: 'Execution › Runs', path: '/execution/runs', keywords: 'execution runs receipts verification logs policy violations' },
    { title: 'Execution › Tasks', path: '/execution/tasks', keywords: 'execution durable tasks wal checkpoints signed envelope receipt' },
    { title: 'Execution › Approvals', path: '/execution/approvals', keywords: 'execution approvals human review pause resume reject' },
    { title: 'Proof › Receipts', path: '/proof/receipts', keywords: 'proof receipts verification signature hash chain' },
    { title: 'Proof › Violations', path: '/proof/violations', keywords: 'proof policy violations enforcement bounds alerts' },
    { title: 'Policy › Bounds', path: '/policy/bounds', keywords: 'policy bounds limits cpu memory execution steps' },
    { title: 'Policy › Capabilities', path: '/policy/capabilities', keywords: 'policy capabilities permissions http shell filesystem domains' },
    { title: 'Infrastructure › Providers', path: '/models/providers', keywords: 'infrastructure providers endpoints keys models health' },
    { title: 'Infrastructure › Devices', path: '/fleet/devices', keywords: 'infrastructure devices runtime nodes online policy sync' },
    { title: 'History › Logs', path: '/history/logs', keywords: 'history logs events runtime stream traces' },
    { title: 'History › Metrics', path: '/history/metrics', keywords: 'history metrics performance charts throughput latency' },
    { title: 'Settings › General', path: '/settings/general', keywords: 'settings general configuration security api keys roles' },
    { title: 'Settings › API Keys', path: '/settings/keys', keywords: 'settings keys vault api provider authentication' },
    { title: 'Settings › License', path: '/settings/license', keywords: 'settings license plan quota activation key' },
  ];

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length > 0) {
      setFilteredResults(searchIndex.filter((i) => i.title.toLowerCase().includes(q) || i.keywords.includes(q)));
      setShowSearchResults(true);
      setSelectedIndex(0);
    } else {
      setFilteredResults([]);
      setShowSearchResults(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
      if (e.key === 'Escape' && isSearchModalOpen) {
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

  const handleResultClick = (path: string) => {
    router.push(path);
    setSearchQuery('');
    setShowSearchResults(false);
    setIsSearchModalOpen(false);
    onClose?.();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!showSearchResults || filteredResults.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((p) => Math.min(p + 1, filteredResults.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((p) => Math.max(p - 1, 0)); }
    if (e.key === 'Enter' && filteredResults[selectedIndex]) { handleResultClick(filteredResults[selectedIndex].path); }
  };

  return (
    <>
      {/* Mobile overlay */}
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
        <div className="flex h-full flex-col bg-background border-r border-[#e4e4e4] dark:border-border">

          {/* Logo */}
          <div className="h-12 flex items-center px-5 pt-4">
            <Link href="/dashboard" className="flex items-center">
              <img src="/inertiadm.png" alt="Igris" className="h-8 w-auto rounded-lg hidden dark:block" />
              <img src="/inertia.png" alt="Igris" className="h-8 w-auto rounded-lg dark:hidden" />
            </Link>
          </div>

          {/* Search */}
          <div className="px-4 pt-5 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-[15px] w-[15px] text-gray-400 pointer-events-none" strokeWidth={1.5} />
              <input
                type="text"
                readOnly
                onClick={() => setIsSearchModalOpen(true)}
                className="w-full pl-9 pr-16 py-2 text-[0.75rem] border border-[#e4e4e4] dark:border-border rounded-lg outline-none bg-background cursor-pointer text-foreground transition-colors shadow-sm"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <span className="text-xs font-medium text-muted-foreground">⌘ F</span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-4 pt-2 pb-4 scrollbar-hide">
            <ul className="space-y-0.5">
              {navigation.map((item) => {
                if (item.children) {
                  const isExpanded = expandedSections[item.name];
                  return (
                    <li key={item.name}>
                      <button
                        onClick={() => toggleSection(item.name)}
                        className="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors text-foreground/75 hover:text-foreground hover:bg-muted/60"
                      >
                        <div className="flex items-center gap-2">
                          <item.icon className="h-[15px] w-[15px] flex-shrink-0 text-foreground/60" strokeWidth={1.5} />
                          {item.name}
                        </div>
                        <ChevronDown
                          className={cn(
                            'h-3.5 w-3.5 text-foreground/50 transition-transform duration-150',
                            isExpanded && 'rotate-180'
                          )}
                        />
                      </button>

                      {isExpanded && (
                        <ul className="mt-0.5 ml-5 space-y-0.5 pl-2">
                          {item.children.map((child) => {
                            const isActive =
                              pathname === child.href ||
                              pathname?.startsWith(child.href + '/');
                            return (
                              <li key={child.name}>
                                <Link
                                  href={child.href}
                                  onClick={onClose}
                                  className={cn(
                                    'flex items-center justify-between rounded-lg px-2 py-1.5 text-xs font-medium transition-colors',
                                    isActive
                                      ? 'bg-[#ebebeb] dark:bg-white/10 text-foreground font-semibold'
                                      : 'text-foreground/70 hover:text-foreground hover:bg-muted/60'
                                  )}
                                >
                                  {child.name}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                }

                if (!item.href) return null;
                const isActive = pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                        isActive
                          ? 'bg-[#ebebeb] dark:bg-white/10 text-foreground font-semibold'
                          : 'text-foreground/70 hover:text-foreground hover:bg-muted/60'
                      )}
                    >
                      <item.icon className={cn('h-[15px] w-[15px] flex-shrink-0', isActive ? 'text-foreground' : 'text-foreground/60')} strokeWidth={1.5} />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer — profile */}
          <div className="px-4 py-3 flex-shrink-0 flex items-center gap-2">

            {/* Profile dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-muted/80 transition-colors outline-none min-w-0 flex-1">
                  <div className="relative flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[0.6rem] font-semibold tracking-wide select-none">
                    {initials}
                    <span className="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full bg-green-500 border border-white dark:border-[#1b1912]" />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-xs font-medium text-foreground truncate leading-tight">{displayName}</p>
                    {tenant?.plan && <p className="text-[9px] text-muted-foreground truncate leading-tight">{tenant.plan}</p>}
                  </div>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                side="top"
                align="start"
                sideOffset={8}
                className="w-56 p-0 rounded-xl border border-border shadow-lg overflow-hidden"
              >
                {/* User info header */}
                <div className="px-3 py-3 bg-muted/70">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-white text-[0.65rem] font-semibold flex-shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
                      {tenant?.plan && <p className="text-[9px] text-muted-foreground truncate">{tenant.plan}</p>}
                    </div>
                  </div>
                </div>

                <div className="p-1">
                  <DropdownMenuItem
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs cursor-pointer"
                    onSelect={() => { router.push('/settings/license'); onClose?.(); }}
                  >
                    <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">License</p>
                      <p className="text-[10px] text-muted-foreground">Plan and quota</p>
                    </div>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs cursor-pointer"
                    onSelect={() => { router.push('/settings/keys'); onClose?.(); }}
                  >
                    <KeyRound className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">API Keys</p>
                      <p className="text-[10px] text-muted-foreground">Manage access keys</p>
                    </div>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs cursor-pointer"
                    onSelect={() => { router.push('/settings/general'); onClose?.(); }}
                  >
                    <Settings className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Settings</p>
                      <p className="text-[10px] text-muted-foreground">System configuration</p>
                    </div>
                  </DropdownMenuItem>
                </div>

                <Separator />

                <div className="p-1">
                  <DropdownMenuItem className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs cursor-pointer" asChild>
                    <a href="https://docs.igrisinertial.com" target="_blank" rel="noopener noreferrer">
                      <BookOpen className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-foreground">Documentation</p>
                        <p className="text-[10px] text-muted-foreground">Guides and API reference</p>
                      </div>
                      <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    </a>
                  </DropdownMenuItem>

                  <DropdownMenuItem className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs cursor-pointer" asChild>
                    <a href="mailto:support@igrisinertial.com">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Contact Support</p>
                        <p className="text-[10px] text-muted-foreground">support@igrisinertial.com</p>
                      </div>
                    </a>
                  </DropdownMenuItem>

                  <DropdownMenuItem className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs cursor-pointer" asChild>
                    <a href="https://status.igrisinertial.com" target="_blank" rel="noopener noreferrer">
                      <Activity className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-foreground">System Status</p>
                        <p className="text-[10px] text-muted-foreground">Uptime and incidents</p>
                      </div>
                      <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    </a>
                  </DropdownMenuItem>
                </div>

                <Separator />

                <div className="p-1">
                  <DropdownMenuItem
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30"
                    onSelect={() => setShowLogoutDialog(true)}
                  >
                    <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="font-medium">Log out</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <ThemeSwitcher />

          </div>
        </div>
      </aside>

      {/* Logout confirmation */}
      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Log out?</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              You will be signed out and redirected to the login page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowLogoutDialog(false)}>
              Cancel
            </Button>
            <Button size="sm" className="h-8 text-xs bg-gray-900 hover:bg-gray-800 text-white" onClick={handleLogout}>
              <LogOut className="h-3.5 w-3.5 mr-1.5" />
              Log out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search Modal */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
          <div
            className="absolute inset-0 bg-black/10 dark:bg-black/40"
            onClick={() => { setIsSearchModalOpen(false); setSearchQuery(''); setShowSearchResults(false); }}
          />
          <div className="relative w-full max-w-2xl mx-4">
            <div className="bg-card rounded-xl shadow-2xl border border-border overflow-hidden p-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  ref={modalInputRef}
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full pl-10 pr-4 py-1.5 text-sm outline-none rounded-lg border border-border focus:border-ring/30 bg-background text-foreground"
                />
              </div>
              {showSearchResults && filteredResults.length > 0 && (
                <div className="max-h-64 overflow-y-auto bg-muted/70 p-2 mt-2 rounded-lg">
                  {filteredResults.map((result, index) => (
                    <button
                      key={result.path}
                      onClick={() => handleResultClick(result.path)}
                      className={cn(
                        'w-full px-3 py-2 transition-colors text-left flex items-start gap-2.5 border-b border-border last:border-b-0',
                        index === selectedIndex
                          ? 'bg-background'
                          : 'hover:bg-background'
                      )}
                    >
                      <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground mb-0.5">{result.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{result.path}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showSearchResults && searchQuery.length > 0 && filteredResults.length === 0 && (
                <div className="p-4 text-center mt-2">
                  <p className="text-sm text-muted-foreground">No results for &ldquo;{searchQuery}&rdquo;</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
