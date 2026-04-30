'use client';

import { type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
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
  type LucideIcon,
} from 'lucide-react';

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
  status: string;
  updates_count: number;
  last_seen: string;
  model_version: string;
}

interface FederatedRound {
  id: number;
  started_at: string;
  completed_at: string | null;
  status: string;
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
  running:   { bg: 'bg-blue-50',  text: 'text-blue-700',  border: 'border-blue-200' },
  completed: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  failed:    { bg: 'bg-red-50',   text: 'text-red-700',   border: 'border-red-200' },
};

function RoundBadge({ status }: { status: string }) {
  const s = ROUND_STATUS[status] ?? ROUND_STATUS.completed;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${s.bg} ${s.text} ${s.border}`}>
      {status}
    </span>
  );
}

function OverviewCard({
  icon: Icon,
  label,
  value,
  sub,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sub: string;
  loading?: boolean;
}) {
  return (
    <div className="border border-gray-200 shadow rounded-3xl overflow-hidden bg-white">
      <div className="px-4 pt-4 pb-2 text-xs font-medium text-black flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-gray-700" strokeWidth={1.5} />
        {label}
      </div>
      <div className="bg-gray-50 border-t border-gray-200 rounded-t-3xl px-4 pt-4 pb-5">
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-3xl font-bold text-gray-900 tabular-nums">{value}</div>
        )}
        <p className="text-xs text-black mt-1">{sub}</p>
      </div>
    </div>
  );
}

function SurfaceSection({
  icon: Icon,
  title,
  description,
  actions,
  bodyClassName = 'px-4 py-4',
  className = '',
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: ReactNode;
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`border border-gray-200 shadow rounded-3xl overflow-hidden bg-white ${className}`}>
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 text-gray-700" strokeWidth={1.5} />
            <p className="text-xs font-medium text-black">{title}</p>
          </div>
          <p className="text-[11px] text-black mt-0.5">{description}</p>
        </div>
        {actions}
      </div>
      <div className={`bg-gray-50 border-t border-gray-200 rounded-t-3xl ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-1 tabular-nums">{value}</p>
    </div>
  );
}

export default function FederatedLearningPage() {
  const qc = useQueryClient();

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
  const completedRounds = rounds
    .filter((r) => r.status === 'completed' && r.aggregation_loss != null)
    .slice(0, 4)
    .reverse();
  const lossImproving = completedRounds.length >= 2
    ? completedRounds[completedRounds.length - 1].aggregation_loss! < completedRounds[0].aggregation_loss!
    : null;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Federated Learning</h1>
            <p className="text-xs text-black mt-0.5">
              Privacy-preserving model aggregation across fleet devices. Updates never leave devices raw — differential privacy applied before aggregation.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
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
              className="h-8 text-xs gap-1.5"
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

        {hasActiveRound && (
          <div className="border border-blue-200 bg-blue-50 rounded-3xl px-4 py-3 text-xs text-blue-700 flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" />
            <span className="font-medium">Round {status!.active_round} in progress</span>
            <span className="text-blue-600">— collecting model updates from participants</span>
            {status?.participants != null && (
              <span className="ml-auto font-mono text-[11px] text-blue-600">
                {activeParticipants}/{status.participants} devices active
              </span>
            )}
          </div>
        )}

        <div className="border border-indigo-200 bg-indigo-50 rounded-3xl px-4 py-3 text-xs text-indigo-700 flex items-start gap-2">
          <Lock className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>
            <span className="font-semibold">Differential privacy active.</span>{' '}
            Laplacian noise (σ={status?.noise_scale?.toFixed(2) ?? '—'}) is applied to all model updates before aggregation.
            Privacy budget ε={status?.privacy_budget?.toFixed(2) ?? '—'}.
            Raw gradient data never leaves the originating device.
          </span>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <OverviewCard
            icon={Hash}
            label="Total Rounds"
            value={status?.total_rounds ?? 0}
            sub="Aggregation rounds completed."
            loading={statusLoading}
          />
          <OverviewCard
            icon={Users}
            label="Participants"
            value={status?.participants ?? 0}
            sub={`${activeParticipants} currently active.`}
            loading={statusLoading}
          />
          <OverviewCard
            icon={Shield}
            label="Privacy Budget (ε)"
            value={status?.privacy_budget?.toFixed(2) ?? '—'}
            sub={`Noise scale σ=${status?.noise_scale?.toFixed(2) ?? '—'}`}
            loading={statusLoading}
          />
          <OverviewCard
            icon={BarChart3}
            label="Last Round Loss"
            value={formatLoss(lastCompletedRound?.aggregation_loss ?? null)}
            sub={lossImproving === true ? 'Loss improving over last 4 rounds.' : lossImproving === false ? 'Loss not improving.' : 'No completed rounds yet.'}
            loading={statusLoading}
          />
        </div>

        <SurfaceSection
          icon={Users}
          title="Participants"
          description="Fleet devices enrolled in federated aggregation."
          actions={
            participants.length > 0 ? (
              <span className="text-[11px] text-gray-500">{participants.length} devices enrolled</span>
            ) : undefined
          }
          bodyClassName="px-4 py-4"
        >
          <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {['Hostname', 'Device ID', 'Status', 'Updates', 'Model Version', 'Last Seen'].map((h) => (
                      <TableHead key={h} className="text-xs font-medium text-gray-500 h-9 px-4 bg-gray-50 hover:bg-gray-50">
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
                      <TableCell colSpan={6} className="px-4 py-10 text-center text-xs text-gray-500">
                        No participants enrolled. Devices running the Igris runtime with{' '}
                        <code className="font-mono text-[10px] bg-gray-100 px-1 rounded">federated.enabled = true</code>{' '}
                        will appear here.
                      </TableCell>
                    </TableRow>
                  ) : (
                    participants.map((p) => (
                      <TableRow key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <TableCell className="px-4 py-2.5 text-xs font-medium text-gray-900">{p.hostname}</TableCell>
                        <TableCell className="px-4 py-2.5 text-xs font-mono text-gray-500">{p.device_id.slice(0, 12)}</TableCell>
                        <TableCell className="px-4 py-2.5"><ParticipantBadge status={p.status} /></TableCell>
                        <TableCell className="px-4 py-2.5 text-xs tabular-nums text-gray-700">{p.updates_count}</TableCell>
                        <TableCell className="px-4 py-2.5">
                          <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                            {p.model_version}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-xs tabular-nums text-gray-500">{getRelativeTime(p.last_seen)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </SurfaceSection>

        <SurfaceSection
          icon={Activity}
          title="Aggregation Rounds"
          description="History of federated aggregation rounds and their outcomes."
          actions={
            lossImproving === true ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-green-50 text-green-700 border-green-200">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Loss improving
              </span>
            ) : lossImproving === false ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-yellow-50 text-yellow-700 border-yellow-200">
                <AlertTriangle className="h-2.5 w-2.5" />
                Loss not improving
              </span>
            ) : undefined
          }
          bodyClassName="px-4 py-4"
        >
          <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {['Round', 'Status', 'Participants', 'Updates', 'Agg. Loss', 'Duration', 'Model', 'Started'].map((h) => (
                      <TableHead key={h} className="text-xs font-medium text-gray-500 h-9 px-4 bg-gray-50 hover:bg-gray-50">
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
                      <TableCell colSpan={8} className="px-4 py-10 text-center text-xs text-gray-500">
                        No aggregation rounds yet. Start a round to begin federated aggregation.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rounds.map((r) => (
                      <TableRow key={r.id} className={`border-b border-gray-100 hover:bg-gray-50 ${r.status === 'running' ? 'bg-blue-50/40' : ''}`}>
                        <TableCell className="px-4 py-2.5 text-xs font-mono font-medium text-gray-800">#{r.id}</TableCell>
                        <TableCell className="px-4 py-2.5"><RoundBadge status={r.status} /></TableCell>
                        <TableCell className="px-4 py-2.5 text-xs tabular-nums text-gray-700">{r.participant_count}</TableCell>
                        <TableCell className="px-4 py-2.5 text-xs tabular-nums text-gray-700">{r.updates_received}/{r.participant_count}</TableCell>
                        <TableCell className="px-4 py-2.5 text-xs font-mono tabular-nums text-gray-800">
                          {r.aggregation_loss != null ? r.aggregation_loss.toFixed(4) : <span className="text-gray-300">—</span>}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-xs tabular-nums text-gray-500">{formatDuration(r.started_at, r.completed_at)}</TableCell>
                        <TableCell className="px-4 py-2.5">
                          <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                            {r.model_version}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-xs tabular-nums text-gray-500">{getRelativeTime(r.started_at)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </SurfaceSection>

        <SurfaceSection
          icon={Cpu}
          title="Configuration"
          description="Active federated learning settings. Update via PUT /v1/federated/config or igris.toml [federated] block."
        >
          {!config ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MiniStat label="Enabled" value={config.enabled ? 'Yes' : 'No'} />
              <MiniStat label="Min Participants" value={config.min_participants} />
              <MiniStat label="Privacy Budget (ε)" value={config.privacy_budget.toFixed(2)} />
              <MiniStat label="Noise Scale (σ)" value={config.noise_scale.toFixed(3)} />
              <MiniStat label="Round Interval" value={`${config.round_interval_mins}m`} />
              <MiniStat label="Max Rounds / Day" value={config.max_rounds_per_day} />
            </div>
          )}
        </SurfaceSection>
      </div>
    </DashboardLayout>
  );
}
