'use client';

import { type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/apiClient';
import { toast } from '@/components/ui/use-toast';
import {
  Brain,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Database,
  Lock,
  Zap,
  Activity,
  ChevronRight,
  Play,
  type LucideIcon,
} from 'lucide-react';

interface LoRALastResult {
  status: string;
  training_samples: number;
  training_time_secs: number;
  final_loss: number | null;
  adapter_size_bytes: number | null;
  encrypted_adapter_path: string | null;
}

interface LoRAStatus {
  enabled: boolean;
  runtime_error?: string;
  status?: string;
  last_started_at?: number;
  last_finished_at?: number;
  last_error?: string;
  total_examples?: number;
  request_counter?: number;
  should_trigger?: boolean;
  last_result?: LoRALastResult;
}

function formatUnixTs(ts: number | undefined): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString();
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs.toFixed(1)}s`;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}m ${s}s`;
}

function StatusBadge({ status }: { status: string | undefined }) {
  if (!status || status === 'Idle') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border bg-gray-50 text-gray-600 border-gray-200">
        Idle
      </span>
    );
  }
  if (status === 'Training') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-blue-50 text-blue-700 border-blue-200">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 inline-block animate-pulse" />
        Training
      </span>
    );
  }
  if (status === 'Completed') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-green-50 text-green-700 border-green-200">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-red-50 text-red-600 border-red-200">
      <AlertTriangle className="h-2.5 w-2.5" />
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

export default function QLoRATrainingPage() {
  const qc = useQueryClient();

  const {
    data: loraStatus,
    isLoading,
    refetch,
    isFetching,
  } = useQuery<LoRAStatus>({
    queryKey: ['lora-status'],
    queryFn: () => api.get('/v1/lora/status'),
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status === 'Training' ? 5_000 : 30_000,
    refetchIntervalInBackground: false,
  });

  const triggerMutation = useMutation({
    mutationFn: () => api.post('/v1/lora/trigger', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lora-status'] });
      toast({ title: 'Training triggered', description: 'A training run has been queued.' });
    },
    onError: () => {
      toast({
        title: 'Trigger failed',
        description: 'Could not start training. Check the runtime is connected.',
        variant: 'destructive',
      });
    },
  });

  const enabled = loraStatus?.enabled !== false && !loraStatus?.runtime_error;
  const status = loraStatus?.status;
  const lastResult = loraStatus?.last_result;
  const triggerThresholdReached = loraStatus?.should_trigger;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-gray-900">On-Device QLoRA Training</h1>
            <p className="text-xs text-black mt-0.5">
              The runtime automatically fine-tunes a LoRA adapter from inference history. Adapters are AES-256-GCM encrypted at rest and hot-loaded without restart.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => triggerMutation.mutate()}
              disabled={!enabled || status === 'Training' || triggerMutation.isPending}
              title={status === 'Training' ? 'Training already in progress' : 'Trigger a training run now'}
            >
              {triggerMutation.isPending ? (
                <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Starting…</>
              ) : (
                <><Play className="h-3.5 w-3.5" /> Trigger Training</>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {loraStatus?.runtime_error && (
          <div className="border border-amber-200 bg-amber-50 rounded-3xl px-4 py-3 text-xs text-amber-800 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            Runtime unreachable — training status unavailable. {loraStatus.runtime_error}
          </div>
        )}

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <OverviewCard
            icon={Database}
            label="Examples Collected"
            value={loraStatus?.total_examples ?? 0}
            sub="Training examples in local store."
            loading={isLoading}
          />
          <OverviewCard
            icon={Zap}
            label="Requests Processed"
            value={loraStatus?.request_counter ?? 0}
            sub="Inference requests observed."
            loading={isLoading}
          />
          <OverviewCard
            icon={Brain}
            label="Last Run Loss"
            value={lastResult?.final_loss != null ? lastResult.final_loss.toFixed(4) : '—'}
            sub={lastResult ? `${formatDuration(lastResult.training_time_secs)} duration` : 'No completed run yet.'}
            loading={isLoading}
          />
          <OverviewCard
            icon={Lock}
            label="Adapter Size"
            value={formatBytes(lastResult?.adapter_size_bytes)}
            sub={lastResult?.encrypted_adapter_path ? 'Encrypted AES-256-GCM at rest.' : 'No adapter stored yet.'}
            loading={isLoading}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <SurfaceSection
            icon={Activity}
            title="Training Status"
            description="Live state reported by the connected runtime instance."
            className="h-full"
            actions={
              isLoading ? <Skeleton className="h-5 w-16" /> : <StatusBadge status={status} />
            }
          >
            {!enabled ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center">
                <p className="text-xs text-gray-500">QLoRA training is disabled on this runtime instance.</p>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Enable it in the runtime config:{' '}
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-[10px]">lora_training.enabled = true</code>
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat
                    label="Enabled"
                    value={
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-green-50 text-green-700 border-green-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                        Enabled
                      </span>
                    }
                  />
                  <MiniStat label="Should trigger" value={triggerThresholdReached ? 'Yes' : 'No'} />
                  <MiniStat label="Last started" value={formatUnixTs(loraStatus?.last_started_at)} />
                  <MiniStat label="Last finished" value={formatUnixTs(loraStatus?.last_finished_at)} />
                </div>

                {triggerThresholdReached && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700 flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 flex-shrink-0" />
                    Threshold reached — will train on next inference
                  </div>
                )}

                {loraStatus?.last_error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-600">
                    {loraStatus.last_error}
                  </div>
                )}
              </div>
            )}
          </SurfaceSection>

          <SurfaceSection
            icon={CheckCircle2}
            title="Last Training Run"
            description="Results from the most recently completed adapter training cycle."
            className="h-full"
          >
            {!lastResult ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center">
                <p className="text-xs text-gray-500">No training runs completed yet.</p>
                <p className="text-[11px] text-gray-400 mt-1">Trigger a run or wait for the threshold to be reached.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label="Samples used" value={lastResult.training_samples} />
                  <MiniStat label="Duration" value={formatDuration(lastResult.training_time_secs)} />
                  <MiniStat label="Final loss" value={lastResult.final_loss != null ? lastResult.final_loss.toFixed(4) : '—'} />
                  <MiniStat label="Adapter size" value={formatBytes(lastResult.adapter_size_bytes)} />
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">Encrypted at rest</p>
                  {lastResult.encrypted_adapter_path ? (
                    <p className="text-xs text-green-700 flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" />
                      AES-256-GCM
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400">—</p>
                  )}
                </div>
              </div>
            )}
          </SurfaceSection>
        </div>

        <SurfaceSection
          icon={Database}
          title="How On-Device Training Works"
          description="The full pipeline from inference collection to hot-loaded adapter."
        >
          <ol className="space-y-3">
            {[
              {
                icon: Activity,
                title: 'Inference collection',
                desc: 'Every inference call records a (prompt, completion) training example to a local SQLite store on the runtime device.',
              },
              {
                icon: Zap,
                title: 'Threshold trigger',
                desc: 'After N requests (configurable, default 100), the runtime spawns a background training job — one at a time, with a semaphore lock.',
              },
              {
                icon: Brain,
                title: 'QLoRA fine-tuning',
                desc: "A LoRA adapter is trained on top of the base GGUF model using the collected examples. Backend: native Rust (Metal/CUDA) or llama.cpp — auto-detected.",
              },
              {
                icon: Lock,
                title: 'Encrypted adapter',
                desc: "The trained adapter is encrypted with AES-256-GCM before being written to disk. Key is derived from the runtime's tenant identity.",
              },
              {
                icon: CheckCircle2,
                title: 'Hot-load',
                desc: 'The new adapter is loaded into the local LLM provider without restarting the runtime. All subsequent inferences use the fine-tuned model.',
              },
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-[10px] font-semibold text-gray-600 mt-0.5">
                  {i + 1}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-900 flex items-center gap-1.5">
                    <step.icon className="h-3.5 w-3.5 text-gray-500" />
                    {step.title}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </SurfaceSection>

        <SurfaceSection
          icon={Clock}
          title="Runtime Configuration Reference"
          description="Set in your igris.toml runtime config file."
        >
          <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
            <pre className="text-xs font-mono text-gray-700 px-4 py-4 overflow-auto leading-relaxed">
{`[lora_training]
enabled = true
backend = "auto"          # auto | native_rust | llama_cpp
trigger_threshold = 100   # train after N inferences
lora_rank = 8             # LoRA rank (4–64)
lora_alpha = 16.0         # scaling factor
epochs = 1
batch_size = 4
learning_rate = 0.0001
adapter_dir = "lora_adapters"
encrypt_adapters = true   # AES-256-GCM at rest
auto_load_adapter = true  # hot-load after training
max_training_time_secs = 1800  # 30 min timeout
training_threads = 4`}
            </pre>
          </div>
        </SurfaceSection>

        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] text-gray-400">
            Adapters from multiple fleet devices can be aggregated via Federated Learning.
          </p>
          <a
            href="/models/routing"
            className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-900 transition-colors"
          >
            View Routing Engine
            <ChevronRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </DashboardLayout>
  );
}
