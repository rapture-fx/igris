'use client';

import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/apiClient';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Types ─────────────────────────────────────────────────────────────────────

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
  status?: string;              // 'Idle' | 'Training' | 'Completed' | 'Failed'
  last_started_at?: number;     // unix seconds
  last_finished_at?: number;
  last_error?: string;
  total_examples?: number;
  request_counter?: number;
  should_trigger?: boolean;
  last_result?: LoRALastResult;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

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

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | undefined }) {
  if (!status || status === 'Idle') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium font-inter border bg-gray-50 text-gray-500 border-gray-200">
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
        <CheckCircle2 className="h-3 w-3" />
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-red-50 text-red-600 border-red-200">
      <AlertTriangle className="h-3 w-3" />
      {status}
    </span>
  );
}

function StatRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-medium text-gray-900 ${mono ? 'font-inter' : ''}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function QLoRATrainingPage() {
  const {
    data: loraStatus,
    isLoading,
    refetch,
    isFetching,
  } = useQuery<LoRAStatus>({
    queryKey: ['lora-status'],
    queryFn: () => api.get('/v1/lora/status'),
    retry: false,
    // Poll every 5s while training is active; stop otherwise to avoid noise
    refetchInterval: (query) =>
      query.state.data?.status === 'Training' ? 5_000 : 30_000,
    refetchIntervalInBackground: false,
  });

  const enabled = loraStatus?.enabled !== false && !loraStatus?.runtime_error;
  const status = loraStatus?.status;
  const lastResult = loraStatus?.last_result;

  const triggerThresholdReached = loraStatus?.should_trigger;
  const examplesUntilTrigger = loraStatus?.total_examples !== undefined
    ? `${loraStatus.total_examples} collected`
    : '—';

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-3xl">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Brain className="h-4 w-4 text-gray-400" />
              On-Device QLoRA Training
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              The runtime automatically fine-tunes a LoRA adapter from inference history.
              Adapters are AES-256-GCM encrypted at rest and hot-loaded without restart.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 flex-shrink-0"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* ── Runtime unavailable banner ───────────────────────────────────── */}
        {loraStatus?.runtime_error && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-yellow-50 border border-yellow-200 rounded-md">
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 flex-shrink-0" />
            <span className="text-xs text-yellow-700">
              Runtime unreachable — training status unavailable.{' '}
              <span className="font-mono text-[10px]">{loraStatus.runtime_error}</span>
            </span>
          </div>
        )}

        {/* ── Training Status Card ─────────────────────────────────────────── */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                <p className="text-xs font-medium text-gray-900">Training Status</p>
              </div>
              <div className="flex items-center gap-2">
                {isLoading ? (
                  <Skeleton className="h-5 w-16" />
                ) : (
                  <>
                    {enabled ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-green-50 text-green-700 border-green-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                        Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-gray-50 text-gray-400 border-gray-200">
                        Disabled
                      </span>
                    )}
                    <StatusBadge status={status} />
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="px-4 py-3">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : !enabled ? (
              <div className="py-4 text-center">
                <p className="text-xs text-gray-400">
                  QLoRA training is disabled on this runtime instance.
                </p>
                <p className="text-[11px] text-gray-400 mt-1">
                  Enable it in the runtime config:{' '}
                  <code className="font-mono bg-gray-100 px-1 rounded">lora_training.enabled = true</code>
                </p>
              </div>
            ) : (
              <div>
                <StatRow label="Status" value={<StatusBadge status={status} />} />
                <StatRow
                  label="Training examples collected"
                  value={examplesUntilTrigger}
                  mono
                />
                <StatRow
                  label="Inference requests processed"
                  value={loraStatus?.request_counter ?? '—'}
                  mono
                />
                <StatRow
                  label="Should trigger training"
                  value={
                    triggerThresholdReached ? (
                      <span className="text-amber-600 flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        Threshold reached — will train on next inference
                      </span>
                    ) : (
                      <span className="text-gray-400">Waiting for threshold</span>
                    )
                  }
                />
                <StatRow
                  label="Last training started"
                  value={formatUnixTs(loraStatus?.last_started_at)}
                  mono
                />
                <StatRow
                  label="Last training finished"
                  value={formatUnixTs(loraStatus?.last_finished_at)}
                  mono
                />
                {loraStatus?.last_error && (
                  <div className="mt-2 px-2 py-1.5 bg-red-50 border border-red-100 rounded text-[11px] text-red-600 font-mono">
                    {loraStatus.last_error}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Last Training Result ─────────────────────────────────────────── */}
        {lastResult && (
          <Card className="border border-gray-200 shadow-none">
            <CardHeader className="px-4 pt-4 pb-3">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" strokeWidth={1.5} />
                <p className="text-xs font-medium text-gray-900">Last Training Run</p>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="px-4 py-3">
              <StatRow
                label="Training samples used"
                value={lastResult.training_samples}
                mono
              />
              <StatRow
                label="Training duration"
                value={formatDuration(lastResult.training_time_secs)}
                mono
              />
              <StatRow
                label="Final loss"
                value={lastResult.final_loss != null ? lastResult.final_loss.toFixed(4) : '—'}
                mono
              />
              <StatRow
                label="Adapter size"
                value={formatBytes(lastResult.adapter_size_bytes)}
                mono
              />
              <StatRow
                label="Encrypted at rest"
                value={
                  lastResult.encrypted_adapter_path ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <Lock className="h-3 w-3" />
                      AES-256-GCM
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )
                }
              />
            </CardContent>
          </Card>
        )}

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
              <p className="text-xs font-medium text-gray-900">How On-Device Training Works</p>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="px-4 py-4">
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
                  desc: 'A LoRA adapter is trained on top of the base GGUF model using the collected examples. Backend: native Rust (Metal/CUDA) or llama.cpp — auto-detected.',
                },
                {
                  icon: Lock,
                  title: 'Encrypted adapter',
                  desc: 'The trained adapter is encrypted with AES-256-GCM before being written to disk. Key is derived from the runtime\'s tenant identity.',
                },
                {
                  icon: CheckCircle2,
                  title: 'Hot-load',
                  desc: 'The new adapter is loaded into the local LLM provider without restarting the runtime. All subsequent inferences use the fine-tuned model.',
                },
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-[10px] font-bold text-gray-500 mt-0.5">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-800 flex items-center gap-1.5">
                      <step.icon className="h-3 w-3 text-gray-400" />
                      {step.title}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* ── Config reference ─────────────────────────────────────────────── */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
              <p className="text-xs font-medium text-gray-900">Runtime Configuration Reference</p>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Set in your runtime <code className="font-mono bg-gray-100 px-0.5 rounded text-[10px]">igris.toml</code> config file.
            </p>
          </CardHeader>
          <Separator />
          <CardContent className="px-4 py-3">
            <pre className="text-[11px] font-mono text-gray-700 leading-relaxed bg-gray-50 rounded-md px-3 py-3 overflow-auto">
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
          </CardContent>
        </Card>

        {/* ── Federated link ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] text-gray-400">
            Adapters from multiple fleet devices can be aggregated via Federated Learning.
          </p>
          <a
            href="/models/routing"
            className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-900 transition-colors"
          >
            View Routing Engine
            <ChevronRight className="h-3 w-3" />
          </a>
        </div>

      </div>
    </DashboardLayout>
  );
}
