'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/apiClient';
import { toast } from '@/components/ui/use-toast';
import { getRelativeTime } from '@/utils/helpers';
import {
  Network,
  Shield,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Activity,
  Users,
  Hash,
  Lock,
  Cpu,
  BarChart3,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FederatedStatus {
  enabled: boolean;
  active_round: number | null;
  total_rounds: number;
  participants: number;
  last_aggregated: string | null;
  privacy_budget: number;
  noise_scale: number;
  updated_at: string;
}

interface FederatedParticipant {
  id: string;
  device_id: string;
  hostname: string;
  status: string; // "active" | "idle" | "uploading" | "aggregating"
  updates_count: number;
  last_seen: string;
  model_version: string;
}

interface FederatedRound {
  id: number;
  started_at: string;
  completed_at: string | null;
  status: string; // "running" | "completed" | "failed"
  participant_count: number;
  updates_received: number;
  aggregation_loss: number | null;
  model_version: string;
}

interface FederatedConfig {
  enabled: boolean;
  min_participants: number;
  privacy_budget: number;
  noise_scale: number;
  round_interval_mins: number;
  max_rounds_per_day: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLoss(loss: number | null): string {
  if (loss == null) return '—';
  return loss.toFixed(4);
}

function formatDuration(started: string, completed: string | null): string {
  if (!completed) return '—';
  const ms = new Date(completed).getTime() - new Date(started).getTime();
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const PARTICIPANT_STATUS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  active:      { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  dot: 'bg-green-500' },
  uploading:   { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500' },
  aggregating: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500 animate-pulse' },
  idle:        { bg: 'bg-gray-50',   text: 'text-gray-500',   border: 'border-gray-200',   dot: 'bg-gray-400' },
};

function ParticipantBadge({ status }: { status: string }) {
  const s = PARTICIPANT_STATUS[status] ?? PARTICIPANT_STATUS.idle;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${s.bg} ${s.text} ${s.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {status}
    </span>
  );
}

const ROUND_STATUS: Record<string, { bg: string; text: string; border: string }> = {
  running:   { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  completed: { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
  failed:    { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
};

function RoundBadge({ status }: { status: string }) {
  const s = ROUND_STATUS[status] ?? ROUND_STATUS.completed;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${s.bg} ${s.text} ${s.border}`}>
      {status}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FederatedLearningPage() {
  const qc = useQueryClient();
  const [showConfig, setShowConfig] = useState(false);

  const { data: status, isLoading: statusLoading } = useQuery<FederatedStatus>({
    queryKey: ['federated-status'],
    queryFn: () => api.get('/v1/federated/status'),
    refetchInterval: 15_000,
    retry: false,
  });

  const { data: participants = [], isLoading: participantsLoading, refetch: refetchParticipants } = useQuery<FederatedParticipant[]>({
    queryKey: ['federated-participants'],
    queryFn: () => api.get('/v1/federated/participants'),
    refetchInterval: 15_000,
    retry: false,
  });

  const { data: rounds = [], isLoading: roundsLoading, refetch: refetchRounds } = useQuery<FederatedRound[]>({
    queryKey: ['federated-rounds'],
    queryFn: () => api.get('/v1/federated/rounds'),
    refetchInterval: 15_000,
    retry: false,
  });

  const { data: config } = useQuery<FederatedConfig>({
    queryKey: ['federated-config'],
    queryFn: () => api.get('/v1/federated/config'),
    staleTime: 30_000,
    retry: false,
  });

  const startRoundMutation = useMutation({
    mutationFn: () => api.post('/v1/federated/rounds/start', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['federated-status'] });
      qc.invalidateQueries({ queryKey: ['federated-rounds'] });
      toast({ title: 'Aggregation round started', description: 'Collecting updates from participants.' });
    },
    onError: () => toast({ title: 'Failed to start round', variant: 'destructive' }),
  });

  const hasActiveRound = status?.active_round != null;
  const activeParticipants = participants.filter((p) => p.status !== 'idle').length;
  const lastCompletedRound = rounds.find((r) => r.status === 'completed');

  // Loss trend (last 4 completed rounds, oldest first)
  const completedRounds = rounds.filter((r) => r.status === 'completed' && r.aggregation_loss != null).slice(0, 4).reverse();
  const lossImproving = completedRounds.length >= 2
    ? completedRounds[completedRounds.length - 1].aggregation_loss! < completedRounds[0].aggregation_loss!
    : null;

  const STAT_CARDS = [
    {
      label: 'Total Rounds',
      value: statusLoading ? null : (status?.total_rounds ?? 0),
      icon: Hash,
      iconColor: 'text-gray-400',
      valueColor: 'text-gray-900',
    },
    {
      label: 'Active Participants',
      value: statusLoading ? null : (status?.participants ?? 0),
      icon: Users,
      iconColor: status?.participants ? 'text-green-500' : 'text-gray-400',
      valueColor: status?.participants ? 'text-green-700' : 'text-gray-900',
    },
    {
      label: 'Privacy Budget (ε)',
      value: statusLoading ? null : (status?.privacy_budget?.toFixed(2) ?? '—'),
      icon: Shield,
      iconColor: 'text-indigo-500',
      valueColor: 'text-indigo-700',
      isString: true,
    },
    {
      label: 'Last Loss',
      value: statusLoading ? null : formatLoss(lastCompletedRound?.aggregation_loss ?? null),
      icon: BarChart3,
      iconColor: lossImproving === true ? 'text-green-500' : lossImproving === false ? 'text-orange-500' : 'text-gray-400',
      valueColor: lossImproving === true ? 'text-green-700' : 'text-gray-900',
      isString: true,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-5xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Network className="h-4 w-4 text-indigo-500" />
              Federated Learning
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Privacy-preserving model aggregation across fleet devices. Updates never leave devices raw — differential privacy applied before aggregation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => { refetchParticipants(); refetchRounds(); }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => startRoundMutation.mutate()}
              disabled={startRoundMutation.isPending || hasActiveRound}
              title={hasActiveRound ? 'A round is already running' : 'Trigger aggregation round now'}
            >
              {startRoundMutation.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Play className="h-3.5 w-3.5" />}
              {hasActiveRound ? 'Round running…' : 'Start Round'}
            </Button>
          </div>
        </div>

        {/* Active round banner */}
        {hasActiveRound && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-md">
            <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin flex-shrink-0" />
            <span className="text-xs text-blue-700 font-medium">
              Round {status!.active_round} in progress — collecting model updates from participants
            </span>
            {status?.participants != null && (
              <span className="ml-auto text-[11px] text-blue-600 font-mono">
                {activeParticipants}/{status.participants} devices active
              </span>
            )}
          </div>
        )}

        {/* Privacy notice */}
        <div className="flex items-start gap-2 px-3 py-2.5 bg-indigo-50 border border-indigo-200 rounded-md">
          <Lock className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-indigo-700 leading-relaxed">
            <span className="font-semibold">Differential privacy active.</span>{' '}
            Laplacian noise (σ={status?.noise_scale?.toFixed(2) ?? '—'}) is applied to all model updates before aggregation.
            Privacy budget ε={status?.privacy_budget?.toFixed(2) ?? '—'}.
            Raw gradient data never leaves the originating device.
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STAT_CARDS.map((c) => (
            <Card key={c.label} className="border border-gray-200 shadow-none">
              <CardHeader className="px-4 pt-3 pb-1">
                <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <c.icon className={`h-3.5 w-3.5 ${c.iconColor}`} />
                  {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                {c.value === null ? (
                  <Skeleton className="h-5 w-12 mt-0.5" />
                ) : c.isString ? (
                  <span className={`text-sm font-semibold tabular-nums ${c.valueColor}`}>{c.value}</span>
                ) : (
                  <span className={`text-xl font-semibold tabular-nums ${c.valueColor}`}>{c.value}</span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Participants table */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Participants
            {participants.length > 0 && (
              <span className="ml-1 text-[10px] font-normal text-gray-400 normal-case tracking-normal">
                ({participants.length} devices enrolled)
              </span>
            )}
          </h2>
          <Card className="border border-gray-200 shadow-none overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {['Hostname', 'Device ID', 'Status', 'Updates', 'Model Version', 'Last Seen'].map((h) => (
                    <TableHead key={h} className="text-xs font-medium text-gray-500 h-9 px-4 bg-gray-50">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {participantsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j} className="px-4 py-3">
                          <Skeleton className="h-3.5 w-20" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : participants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center">
                      <Users className="h-7 w-7 text-gray-200 mx-auto mb-2" />
                      <p className="text-xs text-gray-400">No participants enrolled.</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Devices running the Igris runtime with{' '}
                        <code className="font-mono text-[10px] bg-gray-100 px-1 rounded">federated.enabled = true</code>{' '}
                        will appear here.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  participants.map((p) => (
                    <TableRow key={p.id} className="border-b border-gray-100">
                      <TableCell className="px-4 py-3 text-xs font-medium text-gray-800">
                        {p.hostname}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs font-mono text-gray-500">
                        {p.device_id.slice(0, 12)}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <ParticipantBadge status={p.status} />
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs tabular-nums text-gray-700">
                        {p.updates_count}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                          {p.model_version}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-gray-500 tabular-nums">
                        {getRelativeTime(p.last_seen)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </section>

        {/* Rounds history */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Aggregation Rounds
            {lossImproving === true && (
              <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-normal text-green-600 normal-case tracking-normal">
                <CheckCircle2 className="h-2.5 w-2.5" />
                loss improving
              </span>
            )}
            {lossImproving === false && (
              <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-normal text-orange-500 normal-case tracking-normal">
                <AlertTriangle className="h-2.5 w-2.5" />
                loss not improving
              </span>
            )}
          </h2>
          <Card className="border border-gray-200 shadow-none overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {['Round', 'Status', 'Participants', 'Updates', 'Agg. Loss', 'Duration', 'Model', 'Started'].map((h) => (
                    <TableHead key={h} className="text-xs font-medium text-gray-500 h-9 px-4 bg-gray-50">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {roundsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j} className="px-4 py-3">
                          <Skeleton className="h-3.5 w-16" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : rounds.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center">
                      <Hash className="h-7 w-7 text-gray-200 mx-auto mb-2" />
                      <p className="text-xs text-gray-400">No aggregation rounds yet.</p>
                      <p className="text-[11px] text-gray-400 mt-1">Start a round to begin federated aggregation.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  rounds.map((r) => (
                    <TableRow key={r.id} className={`border-b border-gray-100 ${r.status === 'running' ? 'bg-blue-50/40' : ''}`}>
                      <TableCell className="px-4 py-3 text-xs font-mono font-medium text-gray-800">
                        #{r.id}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <RoundBadge status={r.status} />
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs tabular-nums text-gray-700">
                        {r.participant_count}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs tabular-nums text-gray-700">
                        {r.updates_received}/{r.participant_count}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {r.aggregation_loss != null ? (
                          <span className="text-xs font-mono text-gray-800 tabular-nums">
                            {r.aggregation_loss.toFixed(4)}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-gray-500 tabular-nums">
                        {formatDuration(r.started_at, r.completed_at)}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                          {r.model_version}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-gray-500 tabular-nums">
                        {getRelativeTime(r.started_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </section>

        {/* Config panel */}
        <section>
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 mb-2"
            onClick={() => setShowConfig((v) => !v)}
          >
            <Cpu className="h-3.5 w-3.5" />
            Configuration
            <span className="text-gray-300 ml-1">{showConfig ? '▲' : '▼'}</span>
          </button>
          {showConfig && config && (
            <Card className="border border-gray-200 shadow-none">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3">
                  {[
                    { label: 'Min Participants', value: config.min_participants },
                    { label: 'Privacy Budget (ε)', value: config.privacy_budget.toFixed(2) },
                    { label: 'Noise Scale (σ)', value: config.noise_scale.toFixed(3) },
                    { label: 'Round Interval', value: `${config.round_interval_mins}m` },
                    { label: 'Max Rounds / Day', value: config.max_rounds_per_day },
                    { label: 'Enabled', value: config.enabled ? 'Yes' : 'No' },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                      <p className="text-xs font-mono text-gray-700 mt-0.5">{String(value)}</p>
                    </div>
                  ))}
                </div>
                <Separator className="my-3" />
                <p className="text-[11px] text-gray-400">
                  Update via{' '}
                  <code className="font-mono text-[10px] bg-gray-100 px-1 rounded">PUT /v1/federated/config</code>
                  {' '}or in the runtime config file under{' '}
                  <code className="font-mono text-[10px] bg-gray-100 px-1 rounded">[federated]</code>.
                </p>
              </CardContent>
            </Card>
          )}
        </section>

      </div>
    </DashboardLayout>
  );
}
