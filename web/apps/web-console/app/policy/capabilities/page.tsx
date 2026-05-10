'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/apiClient';
import { getRelativeTime, formatDateTime, truncateText } from '@/utils/helpers';
import { CopyButton } from '@/components/execution/shared';
import {
  Save, RefreshCw, CheckCircle, RotateCcw, Globe, Terminal, HardDrive,
  Zap, History, Plus, Trash2, Shield, ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DomainEntry {
  domain: string;
  description: string;
}

interface Capabilities {
  allow_http: boolean;
  allow_shell: boolean;
  allow_fs_write: boolean;
  allow_external_api: boolean;
  domain_allowlist: DomainEntry[];
  domain_denylist: DomainEntry[];
  writable_paths: string[];
  readable_paths: string[];
  violation_behavior: 'terminate' | 'pause' | 'log_only';
  policy_hash: string;
  updated_at: string;
}

interface CapHistoryEntry {
  id: string;
  timestamp: string;
  policy_hash: string;
  change_type: string;
  changed_by: string;
}

// ─── Field Configs ────────────────────────────────────────────────────────────

const TOOL_PERMISSIONS: Array<{
  key: keyof Pick<Capabilities, 'allow_http' | 'allow_shell' | 'allow_fs_write' | 'allow_external_api'>;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  { key: 'allow_http', label: 'Allow HTTP Requests', description: 'Permit outbound HTTP requests from executions.', icon: Globe },
  { key: 'allow_shell', label: 'Allow Shell Execution', description: 'Permit shell command execution during runtime.', icon: Terminal },
  { key: 'allow_fs_write', label: 'Allow Filesystem Write', description: 'Permit write access to the filesystem.', icon: HardDrive },
  { key: 'allow_external_api', label: 'Allow External APIs', description: 'Permit connections to external API services.', icon: Zap },
];

const VIOLATION_OPTIONS = [
  { value: 'terminate', label: 'Terminate Execution' },
  { value: 'pause', label: 'Pause Execution' },
  { value: 'log_only', label: 'Log Only' },
];

// ─── Shared UI Primitives ─────────────────────────────────────────────────────

function SurfaceSection({
  icon: Icon, title, description, actions,
  bodyClassName = 'px-4 py-4', className = '', children,
}: {
  icon: LucideIcon; title: string; description?: ReactNode;
  actions?: ReactNode; bodyClassName?: string; className?: string; children: ReactNode;
}) {
  return (
    <div className={`border-[0.5px] border-black/[0.08] dark:border-white/[0.08] rounded-lg overflow-hidden bg-white ${className}`}>
      <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-xs font-medium text-foreground">{title}</p>
          </div>
          {description ? (
            <p className="text-[11px] text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      <div className={`bg-white ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border-[0.5px] border-black/[0.08] dark:border-white/[0.08] bg-white px-3 py-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-foreground mt-1 tabular-nums">{value}</p>
    </div>
  );
}

function KeyValueCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border-[0.5px] border-black/[0.08] dark:border-white/[0.08] bg-white px-3 py-3">
      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
      <div className="text-xs text-foreground break-words">{value}</div>
    </div>
  );
}

// ─── Path List Sub-component ──────────────────────────────────────────────────

function PathList({
  title,
  description,
  paths,
  onAdd,
  onRemove,
  placeholder,
}: {
  title: string;
  description: string;
  paths: string[];
  onAdd: (path: string) => void;
  onRemove: (path: string) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed || paths.includes(trimmed)) return;
    onAdd(trimmed);
    setInput('');
  };

  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{title}</p>
      <p className="text-[11px] text-muted-foreground mb-2">{description}</p>
      <div className="flex gap-2 mb-2">
        <Input
          placeholder={placeholder}
          className="h-8 text-xs font-mono flex-1 bg-background"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button size="sm" className="h-8 text-xs gap-1 flex-shrink-0" onClick={handleAdd}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
      {paths.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">No paths configured.</p>
      ) : (
        <div className="space-y-1">
          {paths.map((path) => (
            <div
              key={path}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border-[0.5px] border-black/[0.08] dark:border-white/[0.08] bg-white group"
            >
              <span className="text-xs font-mono text-muted-foreground">{path}</span>
              <button
                onClick={() => onRemove(path)}
                className="text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PolicyCapabilitiesPage() {
  const qc = useQueryClient();
  const EMPTY_CAPS: Capabilities = {
    allow_http: false,
    allow_shell: false,
    allow_fs_write: false,
    allow_external_api: false,
    domain_allowlist: [],
    domain_denylist: [],
    writable_paths: [],
    readable_paths: [],
    violation_behavior: 'terminate',
    policy_hash: '',
    updated_at: new Date().toISOString(),
  };
  const [form, setForm] = useState<Capabilities>(EMPTY_CAPS);
  const [savedIndicator, setSavedIndicator] = useState(false);

  // Add-form state for domain tables
  const [newAllowDomain, setNewAllowDomain] = useState('');
  const [newAllowDesc, setNewAllowDesc] = useState('');
  const [newDenyDomain, setNewDenyDomain] = useState('');
  const [newDenyReason, setNewDenyReason] = useState('');

  const { data: serverCaps, isLoading } = useQuery<Capabilities>({
    queryKey: ['policy-capabilities-v2'],
    queryFn: async () => {
      try { return await api.get<Capabilities>('/policy/capabilities'); }
      catch { return null as unknown as Capabilities; }
    },
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: history = [] } = useQuery<CapHistoryEntry[]>({
    queryKey: ['capability-history'],
    queryFn: async () => {
      try { return await api.get<CapHistoryEntry[]>('/policy/capabilities/history'); }
      catch { return [] as CapHistoryEntry[]; }
    },
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => { if (serverCaps) setForm(serverCaps); }, [serverCaps]);

  const mutation = useMutation({
    mutationFn: (data: Capabilities) => api.post('/policy/capabilities', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policy-capabilities-v2'] });
      qc.invalidateQueries({ queryKey: ['capability-history'] });
      setSavedIndicator(true);
      setTimeout(() => setSavedIndicator(false), 2000);
      toast({ title: 'Capabilities saved', description: 'Policy hash updated and agents will receive the new rules.' });
    },
    onError: () => {
      toast({ title: 'Save failed', description: 'Could not save capability changes. Try again.', variant: 'destructive' });
    },
  });

  const set = <K extends keyof Capabilities>(key: K, value: Capabilities[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const isDirty = useMemo(() => {
    if (!serverCaps) return false;
    const strip = ({ policy_hash: _, updated_at: __, ...r }: Capabilities) => r;
    return JSON.stringify(strip(form)) !== JSON.stringify(strip(serverCaps));
  }, [form, serverCaps]);

  // Domain helpers
  const addAllowDomain = () => {
    const d = newAllowDomain.trim();
    if (!d) return;
    set('domain_allowlist', [...form.domain_allowlist, { domain: d, description: newAllowDesc.trim() }]);
    setNewAllowDomain(''); setNewAllowDesc('');
  };

  const removeAllowDomain = (domain: string) =>
    set('domain_allowlist', form.domain_allowlist.filter((e) => e.domain !== domain));

  const addDenyDomain = () => {
    const d = newDenyDomain.trim();
    if (!d) return;
    set('domain_denylist', [...form.domain_denylist, { domain: d, description: newDenyReason.trim() }]);
    setNewDenyDomain(''); setNewDenyReason('');
  };

  const removeDenyDomain = (domain: string) =>
    set('domain_denylist', form.domain_denylist.filter((e) => e.domain !== domain));

  const displayCaps = serverCaps ?? form;

  return (
    <DashboardLayout>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Agent Capabilities</h1>
            <p className="text-xs text-black mt-0.5">Permissions controlling what agents are allowed to do.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isDirty && (
              <span className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded-md border border-yellow-200 whitespace-nowrap">
                Unsaved changes
              </span>
            )}
            <Button
              variant="outline" size="sm" className="h-8 text-xs gap-1.5"
              onClick={() => serverCaps && setForm(serverCaps)}
              disabled={!isDirty}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
            <Button
              size="sm" className="h-8 text-xs gap-1.5"
              onClick={() => mutation.mutate(form)}
              disabled={!isDirty || mutation.isPending}
            >
              {savedIndicator ? <><CheckCircle className="h-3.5 w-3.5" /> Saved</>
                : mutation.isPending ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                : <><Save className="h-3.5 w-3.5" /> Save Changes</>}
            </Button>
          </div>
        </div>

        {/* ── Tool Permissions ───────────────────────────────────────────────── */}
        <SurfaceSection
          icon={ShieldCheck}
          title="Tool Permissions"
          description="Permissions granted to agents during execution."
        >
          <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white divide-y divide-gray-100">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3.5">
                    <div className="space-y-1.5">
                      <Skeleton className="h-3 w-36" /><Skeleton className="h-3 w-52" />
                    </div>
                    <Skeleton className="h-5 w-9 rounded-full" />
                  </div>
                ))
              : TOOL_PERMISSIONS.map((ctrl) => (
                  <div key={ctrl.key} className="flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <ctrl.icon className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" strokeWidth={1.5} />
                      <div>
                        <p className="text-xs font-medium text-gray-800">{ctrl.label}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{ctrl.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={form[ctrl.key]}
                      onCheckedChange={(v) => set(ctrl.key, v)}
                    />
                  </div>
                ))}
          </div>
        </SurfaceSection>

        {/* ── Network Restrictions ───────────────────────────────────────────── */}
        <SurfaceSection
          icon={Globe}
          title="Network Restrictions"
          description="Control which domains agents may reach or are blocked from."
          bodyClassName="px-0 py-0"
        >
          <Tabs defaultValue="allowlist">
            {/* Tab bar */}
            <div className="px-4 border-b border-gray-200">
              <TabsList className="h-9 bg-transparent rounded-none p-0 gap-0">
                <TabsTrigger
                  value="allowlist"
                  className="h-9 text-xs px-3 rounded-none data-[state=active]:shadow-none data-[state=active]:bg-transparent"
                >
                  Allowlist
                  <span className="ml-1.5 text-[10px] text-gray-400 tabular-nums">
                    {form.domain_allowlist.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="denylist"
                  className="h-9 text-xs px-3 rounded-none data-[state=active]:shadow-none data-[state=active]:bg-transparent"
                >
                  Denylist
                  <span className="ml-1.5 text-[10px] text-gray-400 tabular-nums">
                    {form.domain_denylist.length}
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Allowlist */}
            <TabsContent value="allowlist" className="mt-0">
              {/* Add row */}
              <div className="flex gap-2 px-5 py-3 border-b border-gray-100">
                <Input
                  placeholder="api.example.com"
                  className="h-8 text-xs font-mono flex-1 bg-white"
                  value={newAllowDomain}
                  onChange={(e) => setNewAllowDomain(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addAllowDomain()}
                />
                <Input
                  placeholder="Description"
                  className="h-8 text-xs flex-1 bg-white"
                  value={newAllowDesc}
                  onChange={(e) => setNewAllowDesc(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addAllowDomain()}
                />
                <Button size="sm" className="h-8 text-xs gap-1 flex-shrink-0" onClick={addAllowDomain}>
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-gray-500 h-8 px-5 bg-gray-50">Domain</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500 h-8 px-5 bg-gray-50">Description</TableHead>
                    <TableHead className="w-10 bg-gray-50" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {form.domain_allowlist.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-xs text-gray-400 py-8">
                        No domains in allowlist.
                      </TableCell>
                    </TableRow>
                  ) : form.domain_allowlist.map((entry) => (
                    <TableRow key={entry.domain} className="border-b border-gray-100 hover:bg-gray-50 group">
                      <TableCell className="px-5 py-2.5 text-xs font-mono text-gray-700">{entry.domain}</TableCell>
                      <TableCell className="px-5 py-2.5 text-xs text-gray-500">{entry.description || '—'}</TableCell>
                      <TableCell className="px-3 py-2.5">
                        <button
                          onClick={() => removeAllowDomain(entry.domain)}
                          className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            {/* Denylist */}
            <TabsContent value="denylist" className="mt-0">
              <div className="flex gap-2 px-5 py-3 border-b border-gray-100">
                <Input
                  placeholder="*.blocked.com"
                  className="h-8 text-xs font-mono flex-1 bg-white"
                  value={newDenyDomain}
                  onChange={(e) => setNewDenyDomain(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addDenyDomain()}
                />
                <Input
                  placeholder="Reason"
                  className="h-8 text-xs flex-1 bg-white"
                  value={newDenyReason}
                  onChange={(e) => setNewDenyReason(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addDenyDomain()}
                />
                <Button size="sm" className="h-8 text-xs gap-1 flex-shrink-0" onClick={addDenyDomain}>
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-gray-500 h-8 px-5 bg-gray-50">Domain</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500 h-8 px-5 bg-gray-50">Reason</TableHead>
                    <TableHead className="w-10 bg-gray-50" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {form.domain_denylist.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-xs text-gray-400 py-8">
                        No domains in denylist.
                      </TableCell>
                    </TableRow>
                  ) : form.domain_denylist.map((entry) => (
                    <TableRow key={entry.domain} className="border-b border-gray-100 hover:bg-gray-50 group">
                      <TableCell className="px-5 py-2.5 text-xs font-mono text-gray-700">{entry.domain}</TableCell>
                      <TableCell className="px-5 py-2.5 text-xs text-gray-500">{entry.description || '—'}</TableCell>
                      <TableCell className="px-3 py-2.5">
                        <button
                          onClick={() => removeDenyDomain(entry.domain)}
                          className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </SurfaceSection>

        {/* ── Filesystem Restrictions ────────────────────────────────────────── */}
        <SurfaceSection
          icon={HardDrive}
          title="Filesystem Restrictions"
          description="Configure path-level read and write access for agents."
        >
          {isLoading ? (
            <div className="space-y-5">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-2xl border border-gray-200 bg-white px-4 py-4 space-y-2">
                  <Skeleton className="h-3 w-28" /><Skeleton className="h-3 w-44" />
                  <Skeleton className="h-8 w-full mt-1" />
                  <Skeleton className="h-7 w-full" /><Skeleton className="h-7 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <PathList
                title="Writable Paths"
                description="Directories agents may write to during execution."
                paths={form.writable_paths}
                onAdd={(p) => set('writable_paths', [...form.writable_paths, p])}
                onRemove={(p) => set('writable_paths', form.writable_paths.filter((x) => x !== p))}
                placeholder="/tmp/agents"
              />
              <div className="border-t border-gray-200 my-1" />
              <PathList
                title="Readable Paths"
                description="Directories agents may read from during execution."
                paths={form.readable_paths}
                onAdd={(p) => set('readable_paths', [...form.readable_paths, p])}
                onRemove={(p) => set('readable_paths', form.readable_paths.filter((x) => x !== p))}
                placeholder="/var/data/inputs"
              />
            </div>
          )}
        </SurfaceSection>

        {/* ── Capability Enforcement ─────────────────────────────────────────── */}
        <SurfaceSection
          icon={Shield}
          title="Capability Enforcement"
          description="Define runtime behavior when a capability violation occurs."
        >
          {isLoading ? (
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 space-y-2">
              <Skeleton className="h-3 w-36" /><Skeleton className="h-3 w-52" /><Skeleton className="h-8 w-full mt-1" />
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Violation Behavior</Label>
              <p className="text-[11px] text-gray-500 mt-0.5 mb-2">
                Action taken when an agent exceeds a permitted capability.
              </p>
              <Select
                value={form.violation_behavior}
                onValueChange={(v) => set('violation_behavior', v as Capabilities['violation_behavior'])}
              >
                <SelectTrigger className="h-8 text-xs w-56 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIOLATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </SurfaceSection>

        {/* ── Policy Version ─────────────────────────────────────────────────── */}
        <SurfaceSection
          icon={ShieldCheck}
          title="Policy Version"
          description="Current policy hash and the last time capabilities were committed."
        >
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 space-y-2">
                <Skeleton className="h-3 w-20" /><Skeleton className="h-5 w-36" />
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 space-y-2">
                <Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-28" />
              </div>
            </div>
          ) : displayCaps.policy_hash ? (
            <div className="grid grid-cols-2 gap-3">
              <KeyValueCard
                label="Policy Hash"
                value={
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono">{truncateText(displayCaps.policy_hash, 26)}</span>
                    <CopyButton value={displayCaps.policy_hash} />
                  </div>
                }
              />
              <KeyValueCard
                label="Last Updated"
                value={formatDateTime(displayCaps.updated_at)}
              />
            </div>
          ) : (
            <p className="text-xs text-gray-400">No policy saved yet. Configure capabilities above and save.</p>
          )}
        </SurfaceSection>

        {/* ── Capability History ─────────────────────────────────────────────── */}
        <SurfaceSection
          icon={History}
          title="Capability History"
          description="A log of all policy changes applied to this tenant."
          bodyClassName="px-0 py-0"
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {['Timestamp', 'Hash', 'Change', 'Changed By'].map((col) => (
                  <TableHead key={col} className="text-xs font-medium text-gray-500 h-9 px-5 bg-gray-50 hover:bg-gray-50">
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-xs text-gray-400 py-10">
                    No capability changes recorded.
                  </TableCell>
                </TableRow>
              ) : history.map((entry) => (
                <TableRow key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <TableCell className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {getRelativeTime(entry.timestamp)}
                  </TableCell>
                  <TableCell className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-gray-700">{truncateText(entry.policy_hash, 14)}</span>
                      <CopyButton value={entry.policy_hash} />
                    </div>
                  </TableCell>
                  <TableCell className="px-5 py-3 text-xs font-mono text-gray-600">
                    {entry.change_type}
                  </TableCell>
                  <TableCell className="px-5 py-3 text-xs text-gray-600 whitespace-nowrap">
                    {entry.changed_by}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SurfaceSection>

      </div>
    </DashboardLayout>
  );
}
