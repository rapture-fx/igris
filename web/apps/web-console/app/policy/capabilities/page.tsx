'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
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
} from 'lucide-react';

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

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_CAPS: Capabilities = {
  allow_http: true,
  allow_shell: false,
  allow_fs_write: false,
  allow_external_api: true,
  domain_allowlist: [
    { domain: 'api.openai.com', description: 'OpenAI API endpoint' },
    { domain: 'api.anthropic.com', description: 'Anthropic API endpoint' },
    { domain: 'hooks.slack.com', description: 'Slack webhooks' },
  ],
  domain_denylist: [
    { domain: '*.torrent.com', description: 'P2P file sharing' },
    { domain: 'raw.githubusercontent.com', description: 'Unreviewed code execution risk' },
  ],
  writable_paths: ['/tmp/agents', '/var/data/outputs'],
  readable_paths: ['/etc/config', '/var/data/inputs', '/usr/share/models'],
  violation_behavior: 'terminate',
  policy_hash: 'sha256:d5b3e2a1f9c8e7d6b5a4c3f2e1d0c9b8',
  updated_at: new Date(Date.now() - 86_400_000).toISOString(),
};

const MOCK_HISTORY: CapHistoryEntry[] = [
  {
    id: '3',
    timestamp: new Date(Date.now() - 86_400_000).toISOString(),
    policy_hash: 'sha256:d5b3e2a1f9c8e7d6b5a4c3f2e1d0c9b8',
    change_type: 'domain_allowlist_updated',
    changed_by: 'admin@acme.io',
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    policy_hash: 'sha256:c4a2d1e0f8b7a6c5d4e3f2a1b0c9d8e7',
    change_type: 'allow_shell: true → false',
    changed_by: 'admin@acme.io',
  },
  {
    id: '1',
    timestamp: new Date(Date.now() - 14 * 86_400_000).toISOString(),
    policy_hash: 'sha256:b3a1c0d9e8f7a6b5c4d3e2f1a0b9c8d7',
    change_type: 'initial_policy',
    changed_by: 'system',
  },
];

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
      <p className="text-xs font-medium text-gray-700 mb-0.5">{title}</p>
      <p className="text-xs text-gray-400 mb-2">{description}</p>
      <div className="flex gap-2 mb-2">
        <Input
          placeholder={placeholder}
          className="h-8 text-xs font-mono flex-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button size="sm" className="h-8 text-xs gap-1 flex-shrink-0" onClick={handleAdd}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
      {paths.length === 0 ? (
        <p className="text-xs text-gray-300 py-1">No paths configured.</p>
      ) : (
        <div className="space-y-1">
          {paths.map((path) => (
            <div
              key={path}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-100 group"
            >
              <span className="text-xs font-mono text-gray-700">{path}</span>
              <button
                onClick={() => onRemove(path)}
                className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
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
  const [form, setForm] = useState<Capabilities>(MOCK_CAPS);
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
      catch { return MOCK_CAPS; }
    },
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: history = [] } = useQuery<CapHistoryEntry[]>({
    queryKey: ['capability-history'],
    queryFn: async () => {
      try { return await api.get<CapHistoryEntry[]>('/policy/capabilities/history'); }
      catch { return MOCK_HISTORY; }
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

  const displayCaps = serverCaps ?? MOCK_CAPS;

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-2xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Agent Capabilities</h1>
            <p className="text-xs text-gray-500 mt-0.5">Permissions controlling what agents are allowed to do.</p>
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
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-5 pt-4 pb-2">
            <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-gray-400" /> Tool Permissions
            </CardTitle>
            <p className="text-xs text-gray-400 mt-1">Permissions granted to agents during execution.</p>
          </CardHeader>
          <Separator />
          <CardContent className="px-5 py-0 divide-y divide-gray-100">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-3.5">
                    <div className="space-y-1.5">
                      <Skeleton className="h-3 w-36" /><Skeleton className="h-3 w-52" />
                    </div>
                    <Skeleton className="h-5 w-9 rounded-full" />
                  </div>
                ))
              : TOOL_PERMISSIONS.map((ctrl) => (
                  <div key={ctrl.key} className="flex items-center justify-between py-3.5">
                    <div className="flex items-center gap-3">
                      <ctrl.icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-gray-800">{ctrl.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{ctrl.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={form[ctrl.key]}
                      onCheckedChange={(v) => set(ctrl.key, v)}
                    />
                  </div>
                ))}
          </CardContent>
        </Card>

        {/* ── Network Restrictions ───────────────────────────────────────────── */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-5 pt-4 pb-2">
            <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-gray-400" /> Network Restrictions
            </CardTitle>
            <p className="text-xs text-gray-400 mt-1">Control which domains agents may reach or are blocked from.</p>
          </CardHeader>
          <Separator />

          <Tabs defaultValue="allowlist">
            {/* Tab bar */}
            <div className="px-5 border-b border-gray-100">
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
                  className="h-8 text-xs font-mono flex-1"
                  value={newAllowDomain}
                  onChange={(e) => setNewAllowDomain(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addAllowDomain()}
                />
                <Input
                  placeholder="Description"
                  className="h-8 text-xs flex-1"
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
                  className="h-8 text-xs font-mono flex-1"
                  value={newDenyDomain}
                  onChange={(e) => setNewDenyDomain(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addDenyDomain()}
                />
                <Input
                  placeholder="Reason"
                  className="h-8 text-xs flex-1"
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
        </Card>

        {/* ── Filesystem Restrictions ────────────────────────────────────────── */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-5 pt-4 pb-2">
            <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
              <HardDrive className="h-4 w-4 text-gray-400" /> Filesystem Restrictions
            </CardTitle>
            <p className="text-xs text-gray-400 mt-1">Configure path-level read and write access for agents.</p>
          </CardHeader>
          <Separator />
          <CardContent className="px-5 py-5 space-y-5">
            {isLoading ? (
              <div className="space-y-5">
                {[0, 1].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-28" /><Skeleton className="h-3 w-44" />
                    <Skeleton className="h-8 w-full mt-1" />
                    <Skeleton className="h-7 w-full" /><Skeleton className="h-7 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <PathList
                  title="Writable Paths"
                  description="Directories agents may write to during execution."
                  paths={form.writable_paths}
                  onAdd={(p) => set('writable_paths', [...form.writable_paths, p])}
                  onRemove={(p) => set('writable_paths', form.writable_paths.filter((x) => x !== p))}
                  placeholder="/tmp/agents"
                />
                <Separator />
                <PathList
                  title="Readable Paths"
                  description="Directories agents may read from during execution."
                  paths={form.readable_paths}
                  onAdd={(p) => set('readable_paths', [...form.readable_paths, p])}
                  onRemove={(p) => set('readable_paths', form.readable_paths.filter((x) => x !== p))}
                  placeholder="/var/data/inputs"
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Capability Enforcement ─────────────────────────────────────────── */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-5 pt-4 pb-2">
            <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-gray-400" /> Capability Enforcement
            </CardTitle>
            <p className="text-xs text-gray-400 mt-1">Define runtime behavior when a capability violation occurs.</p>
          </CardHeader>
          <Separator />
          <CardContent className="px-5 py-5">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-3 w-36" /><Skeleton className="h-3 w-52" /><Skeleton className="h-8 w-full mt-1" />
              </div>
            ) : (
              <div>
                <Label className="text-xs font-medium text-gray-700">Violation Behavior</Label>
                <p className="text-xs text-gray-400 mt-0.5 mb-2">
                  Action taken when an agent exceeds a permitted capability.
                </p>
                <Select
                  value={form.violation_behavior}
                  onValueChange={(v) => set('violation_behavior', v as Capabilities['violation_behavior'])}
                >
                  <SelectTrigger className="h-8 text-xs w-56">
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
          </CardContent>
        </Card>

        {/* ── Policy Version ─────────────────────────────────────────────────── */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-5 pt-4 pb-2">
            <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-gray-400" /> Policy Version
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="px-5 py-4">
            {isLoading ? (
              <dl className="grid grid-cols-[140px_1fr] gap-x-6 gap-y-3">
                <Skeleton className="h-3 w-20" /><Skeleton className="h-5 w-56" />
                <Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-36" />
              </dl>
            ) : (
              <dl className="grid grid-cols-[140px_1fr] gap-x-6 gap-y-3">
                <dt className="text-xs text-gray-500 flex items-start pt-0.5">Policy Hash</dt>
                <dd className="flex items-center gap-1.5">
                  <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 tracking-tight border-gray-200">
                    {truncateText(displayCaps.policy_hash, 26)}
                  </Badge>
                  <CopyButton value={displayCaps.policy_hash} />
                </dd>
                <dt className="text-xs text-gray-500 flex items-start pt-0.5">Last Updated</dt>
                <dd className="text-xs text-gray-700">{formatDateTime(displayCaps.updated_at)}</dd>
              </dl>
            )}
          </CardContent>
        </Card>

        {/* ── Capability History ─────────────────────────────────────────────── */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-5 pt-4 pb-2">
            <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
              <History className="h-4 w-4 text-gray-400" /> Capability History
            </CardTitle>
          </CardHeader>
          <Separator />
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
                      <Badge variant="outline" className="font-mono text-xs px-2 py-0 border-gray-200">
                        {truncateText(entry.policy_hash, 14)}
                      </Badge>
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
        </Card>

        {mutation.isError && (
          <p className="text-xs text-red-600">Failed to save capability changes. Try again.</p>
        )}
      </div>
    </DashboardLayout>
  );
}
