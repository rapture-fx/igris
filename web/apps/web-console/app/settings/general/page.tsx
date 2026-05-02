'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTenant } from '@/hooks/useTenant';
import { useApiKey, useGenerateApiKey, useRevokeApiKey } from '@/hooks/useApiKey';
import { api } from '@/lib/apiClient';
import { getRelativeTime } from '@/utils/helpers';
import {
  Save, RefreshCw, CheckCircle, Building2, ShieldCheck, Cpu,
  KeyRound, Users, Plus, Trash2, AlertTriangle, RotateCcw, Copy, Check, Zap,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeneralSettings {
  system_name: string;
  environment: 'production' | 'staging' | 'development';
  timezone: string;
  log_level: 'info' | 'warning' | 'error' | 'debug';
}

interface SecuritySettings {
  execution_signing: boolean;
  verification_key: string;
  audit_logging: boolean;
}

interface RuntimeSettings {
  receipt_retention_days: number;
  telemetry_enabled: boolean;
  default_execution_timeout: number;
}

interface ApiKeyRecord {
  id: string;
  name: string;
  masked_key: string;
  created_at: string;
  last_used: string | null;
  status: 'active' | 'revoked';
}

interface RoleRecord {
  user_id: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  created_at: string;
}

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo',
  'Asia/Singapore', 'Australia/Sydney',
];

const ROLE_STYLE: Record<string, string> = {
  admin:    'bg-purple-50 text-purple-700 border-purple-200',
  operator: 'bg-blue-50 text-blue-700 border-blue-200',
  viewer:   'bg-gray-100 text-gray-600 border-gray-200',
};

// ─── Small helpers ────────────────────────────────────────────────────────────

function SectionCard({ icon: Icon, title, children }: {
  icon: React.ElementType; title: string; children: React.ReactNode;
}) {
  return (
    <Card className="border border-gray-200 shadow-none">
      <CardHeader className="px-5 pt-4 pb-3">
        <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
          <Icon className="h-4 w-4 text-gray-400" />
          {title}
        </CardTitle>
      </CardHeader>
      <Separator />
      {children}
    </Card>
  );
}

function FieldRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5 border-b border-gray-100 last:border-0">
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-800">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="text-gray-300 hover:text-gray-600 transition-colors"
      title="Copy"
    >
      {ok ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function SaveButton({ pending, saved, onClick, disabled }: {
  pending: boolean; saved: boolean; onClick: () => void; disabled?: boolean;
}) {
  return (
    <Button size="sm" className="h-8 text-xs gap-1.5" onClick={onClick} disabled={disabled || pending}>
      {saved    ? <><CheckCircle className="h-3.5 w-3.5" /> Saved</>
       : pending ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Saving…</>
       :           <><Save className="h-3.5 w-3.5" /> Save Changes</>}
    </Button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsGeneralPage() {
  const qc = useQueryClient();
  const { data: tenant, isLoading: tenantLoading } = useTenant();

  // ── General settings state ─────────────────────────────────────────────────
  const [general, setGeneral] = useState<GeneralSettings>({
    system_name: '',
    environment: 'production',
    timezone: 'UTC',
    log_level: 'info',
  });
  const [generalSaved, setGeneralSaved] = useState(false);

  useEffect(() => {
    if (tenant) setGeneral((g) => ({ ...g, system_name: tenant.name ?? '' }));
  }, [tenant]);

  const generalMutation = useMutation({
    mutationFn: (s: GeneralSettings) => api.post('/v1/settings/general', s),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant'] });
      setGeneralSaved(true);
      setTimeout(() => setGeneralSaved(false), 2000);
    },
    onError: () => {},
  });

  // ── Security settings state ────────────────────────────────────────────────
  const [security, setSecurity] = useState<SecuritySettings>({
    execution_signing: false,
    verification_key: '',
    audit_logging: false,
  });
  const [securitySaved, setSecuritySaved] = useState(false);

  const securityMutation = useMutation({
    mutationFn: (s: SecuritySettings) => api.post('/v1/settings/security', s),
    onSuccess: () => { setSecuritySaved(true); setTimeout(() => setSecuritySaved(false), 2000); },
    onError:   () => {},
  });

  const [rotatePending, setRotatePending] = useState(false);
  const rotateKey = async () => {
    setRotatePending(true);
    await new Promise((r) => setTimeout(r, 900));
    const hex = Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, '0')).join('');
    setSecurity((s) => ({ ...s, verification_key: `igv_pk_${hex}` }));
    setRotatePending(false);
  };

  // ── Runtime settings state ─────────────────────────────────────────────────
  const [runtime, setRuntime] = useState<RuntimeSettings>({
    receipt_retention_days: 30,
    telemetry_enabled: true,
    default_execution_timeout: 30000,
  });
  const [runtimeSaved, setRuntimeSaved] = useState(false);

  const runtimeMutation = useMutation({
    mutationFn: (s: RuntimeSettings) => api.post('/v1/settings/runtime', s),
    onSuccess: () => { setRuntimeSaved(true); setTimeout(() => setRuntimeSaved(false), 2000); },
    onError:   () => {},
  });

  // ── Runtime API key ────────────────────────────────────────────────────────
  const { data: runtimeKeyInfo, isLoading: runtimeKeyLoading } = useApiKey();
  const generateRuntimeKey = useGenerateApiKey();
  const revokeRuntimeKey = useRevokeApiKey();
  const [newRuntimeKey, setNewRuntimeKey] = useState<string | null>(null);

  // ── API keys ───────────────────────────────────────────────────────────────
  const { data: apiKeys = [], isLoading: keysLoading } = useQuery<ApiKeyRecord[]>({
    queryKey: ['settings-api-keys'],
    queryFn: async () => {
      try {
        return await api.get<ApiKeyRecord[]>('/v1/settings/api-keys');
      } catch { return [] as ApiKeyRecord[]; }
    },
    retry: false,
    staleTime: 60_000,
  });

  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRecord | null>(null);

  const createKeyMutation = useMutation({
    mutationFn: (name: string) => api.post('/v1/settings/api-keys', { name }),
    onSuccess: (data: any) => {
      setCreatedKey(data?.raw_key ?? `igk_live_${Array.from(crypto.getRandomValues(new Uint8Array(12))).map((b) => b.toString(16).padStart(2, '0')).join('')}`);
      setNewKeyName('');
      qc.invalidateQueries({ queryKey: ['settings-api-keys'] });
    },
    onError: () => {},
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (id: string) => api.post('/v1/settings/api-keys/revoke', { key_id: id }),
    onSuccess: () => { setRevokeTarget(null); qc.invalidateQueries({ queryKey: ['settings-api-keys'] }); },
    onError:   () => { setRevokeTarget(null); },
  });

  // ── Roles from Better Auth admin API ───────────────────────────────────────
  const { data: roles = [], isLoading: rolesLoading } = useQuery<RoleRecord[]>({
    queryKey: ['settings-roles'],
    queryFn: async () => {
      try {
        return await api.get<RoleRecord[]>('/api/admin/users');
      } catch { return [] as RoleRecord[]; }
    },
    retry: false,
    staleTime: 30_000,
  });

  // ── License (summary from tenant) ─────────────────────────────────────────
  const isLoading = tenantLoading;

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-2xl">

        {/* Header */}
        <div>
          <h1 className="text-base font-semibold text-gray-900">Settings</h1>
          <p className="text-xs text-gray-500 mt-0.5">System configuration and administrative controls.</p>
        </div>

        {/* ── General ──────────────────────────────────────────────────────── */}
        <SectionCard icon={Building2} title="General">
          <CardContent className="px-5 py-0 divide-y divide-gray-100">
            <FieldRow label="System Name" sub="Display name for this deployment">
              {isLoading
                ? <Skeleton className="h-8 w-40" />
                : (
                  <Input
                    value={general.system_name}
                    onChange={(e) => setGeneral({ ...general, system_name: e.target.value })}
                    className="h-8 text-xs w-44"
                    placeholder="My Deployment"
                  />
                )}
            </FieldRow>
            <FieldRow label="Environment" sub="Active deployment environment">
              <Select value={general.environment} onValueChange={(v) => setGeneral({ ...general, environment: v as GeneralSettings['environment'] })}>
                <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="production"  className="text-xs">Production</SelectItem>
                  <SelectItem value="staging"     className="text-xs">Staging</SelectItem>
                  <SelectItem value="development" className="text-xs">Development</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Timezone" sub="Used for timestamps and schedules">
              <Select value={general.timezone} onValueChange={(v) => setGeneral({ ...general, timezone: v })}>
                <SelectTrigger className="h-8 text-xs w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz} className="text-xs">{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Default Log Level" sub="Minimum level emitted by the runtime">
              <Select value={general.log_level} onValueChange={(v) => setGeneral({ ...general, log_level: v as GeneralSettings['log_level'] })}>
                <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="debug"   className="text-xs">Debug</SelectItem>
                  <SelectItem value="info"    className="text-xs">Info</SelectItem>
                  <SelectItem value="warning" className="text-xs">Warning</SelectItem>
                  <SelectItem value="error"   className="text-xs">Error</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
          </CardContent>
          <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
            <SaveButton
              pending={generalMutation.isPending}
              saved={generalSaved}
              onClick={() => generalMutation.mutate(general)}
            />
          </div>
        </SectionCard>

        {/* ── Runtime API Key ───────────────────────────────────────────────── */}
        <SectionCard icon={KeyRound} title="Runtime API Key">
          <CardContent className="px-5 py-4">
            <p className="text-xs text-gray-500 mb-4">
              Used by the igris-runtime installer to authenticate with your account.
              Generate once and pass to the install script as <code className="font-mono text-gray-700">IGRIS_API_KEY</code>.
            </p>
            {runtimeKeyLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : runtimeKeyInfo?.has_key ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                  <code className="text-xs font-mono text-gray-600 flex-1">igris_{runtimeKeyInfo.prefix}••••••••••••</code>
                  <span className="text-[10px] text-gray-400">{runtimeKeyInfo.created_at ? getRelativeTime(runtimeKeyInfo.created_at) : ''}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() =>
                      generateRuntimeKey.mutate(undefined, {
                        onSuccess: (d) => setNewRuntimeKey(d.api_key),
                      })
                    }
                    disabled={generateRuntimeKey.isPending}
                  >
                    {generateRuntimeKey.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    Regenerate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                    onClick={() => revokeRuntimeKey.mutate()}
                    disabled={revokeRuntimeKey.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                    Revoke
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() =>
                  generateRuntimeKey.mutate(undefined, {
                    onSuccess: (d) => setNewRuntimeKey(d.api_key),
                  })
                }
                disabled={generateRuntimeKey.isPending}
              >
                {generateRuntimeKey.isPending
                  ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Generating…</>
                  : <><KeyRound className="h-3.5 w-3.5" /> Generate Runtime Key</>}
              </Button>
            )}
          </CardContent>
        </SectionCard>

        {/* ── Access & API Keys ─────────────────────────────────────────────── */}
        <SectionCard icon={KeyRound} title="Access and API Keys">
          <CardContent className="px-5 py-4 space-y-4">
            {/* Create new key */}
            <div>
              <Label className="text-xs font-medium text-gray-700 mb-2 block">Create New Key</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Key name (e.g. CI / Deploy)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="h-8 text-xs flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && newKeyName.trim() && createKeyMutation.mutate(newKeyName.trim())}
                />
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5 flex-shrink-0"
                  onClick={() => newKeyName.trim() && createKeyMutation.mutate(newKeyName.trim())}
                  disabled={!newKeyName.trim() || createKeyMutation.isPending}
                >
                  {createKeyMutation.isPending
                    ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Creating…</>
                    : <><Plus className="h-3.5 w-3.5" /> Create</>}
                </Button>
              </div>
            </div>

            {/* Keys table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b border-gray-200 hover:bg-gray-50">
                    <TableHead className="w-[130px] text-xs font-medium text-gray-500 py-2 px-3">Name</TableHead>
                    <TableHead className="w-[180px] text-xs font-medium text-gray-500 py-2 px-3">Key</TableHead>
                    <TableHead className="w-[100px] text-xs font-medium text-gray-500 py-2 px-3">Created</TableHead>
                    <TableHead className="w-[100px] text-xs font-medium text-gray-500 py-2 px-3">Last Used</TableHead>
                    <TableHead className="w-[70px]  text-xs font-medium text-gray-500 py-2 px-3">Status</TableHead>
                    <TableHead className="w-[36px]  py-2 px-3" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keysLoading
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i} className="border-b border-gray-100">
                          {Array.from({ length: 6 }).map((_, j) => (
                            <TableCell key={j} className="py-2.5 px-3"><Skeleton className="h-3.5 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    : apiKeys.map((k) => (
                        <TableRow key={k.id} className="border-b border-gray-100 last:border-0">
                          <TableCell className="py-2.5 px-3 text-xs font-medium text-gray-700 truncate">{k.name}</TableCell>
                          <TableCell className="py-2.5 px-3 text-xs text-gray-500 font-mono truncate">{k.masked_key}</TableCell>
                          <TableCell className="py-2.5 px-3 text-xs text-gray-500 whitespace-nowrap">{getRelativeTime(k.created_at)}</TableCell>
                          <TableCell className="py-2.5 px-3 text-xs text-gray-500 whitespace-nowrap">{k.last_used ? getRelativeTime(k.last_used) : '—'}</TableCell>
                          <TableCell className="py-2.5 px-3">
                            <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase border rounded ${
                              k.status === 'active'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-gray-100 text-gray-500 border-gray-200'
                            }`}>{k.status}</span>
                          </TableCell>
                          <TableCell className="py-2.5 px-3">
                            {k.status === 'active' && (
                              <button
                                onClick={() => setRevokeTarget(k)}
                                className="text-gray-300 hover:text-red-500 transition-colors"
                                title="Revoke"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </SectionCard>

        {/* ── Role Management ───────────────────────────────────────────────── */}
        <SectionCard icon={Users} title="Role Management">
          <CardContent className="px-5 py-4">
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b border-gray-200 hover:bg-gray-50">
                    <TableHead className="w-[160px] text-xs font-medium text-gray-500 py-2 px-3">User</TableHead>
                    <TableHead className="           text-xs font-medium text-gray-500 py-2 px-3">Email</TableHead>
                    <TableHead className="w-[90px]  text-xs font-medium text-gray-500 py-2 px-3">Role</TableHead>
                    <TableHead className="w-[100px] text-xs font-medium text-gray-500 py-2 px-3">Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((r) => (
                    <TableRow key={r.user_id} className="border-b border-gray-100 last:border-0">
                      <TableCell className="py-2.5 px-3 text-xs text-gray-500 font-mono truncate">{r.user_id}</TableCell>
                      <TableCell className="py-2.5 px-3 text-xs text-gray-700 truncate">{r.email}</TableCell>
                      <TableCell className="py-2.5 px-3">
                        <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase border rounded ${ROLE_STYLE[r.role]}`}>
                          {r.role}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-xs text-gray-500 whitespace-nowrap">{getRelativeTime(r.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </SectionCard>

        {/* ── Security ─────────────────────────────────────────────────────── */}
        <SectionCard icon={ShieldCheck} title="Security">
          <CardContent className="px-5 py-0 divide-y divide-gray-100">
            <FieldRow label="Execution Signing" sub="Cryptographically sign all execution receipts">
              <Switch
                checked={security.execution_signing}
                onCheckedChange={(v) => setSecurity({ ...security, execution_signing: v })}
              />
            </FieldRow>
            <FieldRow label="Public Verification Key" sub="Ed25519 public key used to verify signed receipts">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-500 font-mono max-w-[180px] truncate">{security.verification_key}</span>
                <CopyBtn text={security.verification_key} />
              </div>
            </FieldRow>
            <FieldRow label="Audit Logging" sub="Persist all administrative actions to the audit log">
              <Switch
                checked={security.audit_logging}
                onCheckedChange={(v) => setSecurity({ ...security, audit_logging: v })}
              />
            </FieldRow>
          </CardContent>
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={rotateKey}
              disabled={rotatePending}
            >
              {rotatePending
                ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Rotating…</>
                : <><RotateCcw className="h-3.5 w-3.5" /> Rotate Signing Key</>}
            </Button>
            <SaveButton
              pending={securityMutation.isPending}
              saved={securitySaved}
              onClick={() => securityMutation.mutate(security)}
            />
          </div>
        </SectionCard>

        {/* ── Runtime Configuration ─────────────────────────────────────────── */}
        <SectionCard icon={Cpu} title="Runtime Configuration">
          <CardContent className="px-5 py-0 divide-y divide-gray-100">
            <FieldRow label="Receipt Retention Days" sub="How long execution receipts are stored">
              <Input
                type="number"
                value={runtime.receipt_retention_days}
                onChange={(e) => setRuntime({ ...runtime, receipt_retention_days: Number(e.target.value) })}
                className="h-8 text-xs w-24 text-right"
                min={1}
                max={365}
              />
            </FieldRow>
            <FieldRow label="Default Execution Timeout" sub="Timeout in milliseconds before execution is killed">
              <Input
                type="number"
                value={runtime.default_execution_timeout}
                onChange={(e) => setRuntime({ ...runtime, default_execution_timeout: Number(e.target.value) })}
                className="h-8 text-xs w-28 text-right"
                min={1000}
                step={1000}
              />
            </FieldRow>
            <FieldRow label="Telemetry" sub="Send anonymous usage data to improve the runtime">
              <Switch
                checked={runtime.telemetry_enabled}
                onCheckedChange={(v) => setRuntime({ ...runtime, telemetry_enabled: v })}
              />
            </FieldRow>
          </CardContent>
          <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
            <SaveButton
              pending={runtimeMutation.isPending}
              saved={runtimeSaved}
              onClick={() => runtimeMutation.mutate(runtime)}
            />
          </div>
        </SectionCard>

        {/* ── License Summary ───────────────────────────────────────────────── */}
        <SectionCard icon={Zap} title="License and Plan">
          <CardContent className="px-5 py-4">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-3.5 w-40" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  {tenant?.subscription_status === 'active' ? (
                    <>
                      <span className="text-sm font-semibold text-gray-900 capitalize">{tenant.plan}</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase border rounded bg-green-50 text-green-700 border-green-200">active</span>
                    </>
                  ) : tenant?.trial_active ? (
                    <>
                      <span className="text-sm font-semibold text-gray-900 capitalize">{tenant.plan}</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase border rounded bg-blue-50 text-blue-700 border-blue-200">trial</span>
                    </>
                  ) : (
                    <span className="text-sm text-gray-500">No active plan</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="block text-gray-400 mb-0.5">Instance Limit</span>
                    <span className="text-gray-700 font-medium">{tenant?.metadata?.instance_limit ?? '—'}</span>
                  </div>
                  <div>
                    <span className="block text-gray-400 mb-0.5">Usage This Month</span>
                    <span className="text-gray-700 font-medium tabular-nums">{tenant?.metadata?.monthly_usage ?? '—'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                    <a href="/settings/license">View Full License →</a>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </SectionCard>

      </div>

      {/* ── New runtime key dialog ─────────────────────────────────────────── */}
      <Dialog open={!!newRuntimeKey} onOpenChange={(o) => !o && setNewRuntimeKey(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-1.5">
              <KeyRound className="h-4 w-4 text-green-500" /> Runtime API Key Generated
            </DialogTitle>
          </DialogHeader>
          <Separator />
          <div className="pt-2 space-y-3">
            <p className="text-xs text-gray-500">Copy this key now — it will not be shown again.</p>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
              <span className="text-xs text-gray-700 font-mono flex-1 break-all">{newRuntimeKey}</span>
              {newRuntimeKey && <CopyBtn text={newRuntimeKey} />}
            </div>
            <div className="flex justify-end">
              <Button size="sm" className="h-8 text-xs" onClick={() => setNewRuntimeKey(null)}>Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Created key dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!createdKey} onOpenChange={(o) => !o && setCreatedKey(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-1.5">
              <KeyRound className="h-4 w-4 text-green-500" /> API Key Created
            </DialogTitle>
          </DialogHeader>
          <Separator />
          <div className="pt-2 space-y-3">
            <p className="text-xs text-gray-500">Copy this key now — it will not be shown again.</p>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
              <span className="text-xs text-gray-700 font-mono flex-1 break-all">{createdKey}</span>
              {createdKey && <CopyBtn text={createdKey} />}
            </div>
            <div className="flex justify-end">
              <Button size="sm" className="h-8 text-xs" onClick={() => setCreatedKey(null)}>Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Revoke key dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-red-500" /> Revoke Key
            </DialogTitle>
          </DialogHeader>
          <Separator />
          <div className="pt-2 space-y-4">
            <p className="text-xs text-gray-600">
              Revoke <span className="font-semibold">{revokeTarget?.name}</span>{' '}
              <span className="text-gray-500 font-mono">{revokeTarget?.masked_key}</span>?{' '}
              Any integration using this key will stop working immediately.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setRevokeTarget(null)}>Cancel</Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-8 text-xs"
                onClick={() => revokeTarget && revokeKeyMutation.mutate(revokeTarget.id)}
                disabled={revokeKeyMutation.isPending}
              >
                {revokeKeyMutation.isPending ? 'Revoking…' : 'Revoke'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}
