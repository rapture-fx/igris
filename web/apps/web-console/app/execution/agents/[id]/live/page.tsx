'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getRelativeTime } from '@/utils/helpers';
import { ArrowLeft, GitBranch, Loader2, Wifi, WifiOff } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BTNode {
  id: string;
  name: string;
  type: 'selector' | 'sequence' | 'action' | 'condition';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'violation';
  depth: number;
  duration_ms?: number;
  execution_id?: string;
  timestamp?: string;
}

interface BTState {
  agent_id: string;
  nodes: BTNode[];
  last_updated: string;
}

/** Shape emitted by the runtime per-tick and stored in bt_state. */
interface BtTickSnapshot {
  tick: number;
  status: string;
  tree?: unknown;
  // Overture may also wrap the full BTState shape here.
  nodes?: BTNode[];
  last_updated?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BT_STATUS_STYLES: Record<string, string> = {
  completed: 'bg-green-50 text-green-700 border-green-200',
  running:   'bg-yellow-50 text-yellow-700 border-yellow-200 animate-pulse',
  failed:    'bg-red-50 text-red-700 border-red-200',
  violation: 'bg-orange-50 text-orange-700 border-orange-200',
  pending:   'bg-gray-50 text-gray-500 border-gray-200',
  Success:   'bg-green-50 text-green-700 border-green-200',
  Failure:   'bg-red-50 text-red-700 border-red-200',
  Running:   'bg-yellow-50 text-yellow-700 border-yellow-200 animate-pulse',
};

const BT_TYPE_ICON: Record<string, string> = {
  selector:  '◇',
  sequence:  '→',
  action:    '▶',
  condition: '?',
};

type ConnectionStatus = 'connecting' | 'live' | 'stale' | 'error';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentLivePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [data, setData] = useState<BTState | null>(null);
  const [tickCount, setTickCount] = useState<number>(0);
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('connecting');
  const [lastEventAt, setLastEventAt] = useState<number>(0);
  const esRef = useRef<EventSource | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!id) return;

    const url = `/api/v1/agents/${id}/bt-state/stream`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('bt_tick', (e) => {
      try {
        const snap: BtTickSnapshot = JSON.parse(e.data);
        setTickCount(snap.tick ?? 0);
        setLastEventAt(Date.now());
        setConnStatus('live');

        // If overture forwards the full BTState shape, use it directly.
        if (snap.nodes) {
          setData({
            agent_id: id,
            nodes: snap.nodes,
            last_updated: snap.last_updated ?? new Date().toISOString(),
          });
        } else {
          // Minimal update: show tick count + top-level status as a synthetic node.
          setData(prev => ({
            agent_id: id,
            nodes: prev?.nodes ?? [],
            last_updated: new Date().toISOString(),
          }));
        }

        // Reset stale timer.
        if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
        staleTimerRef.current = setTimeout(() => setConnStatus('stale'), 30_000);
      } catch {
        // ignore malformed events
      }
    });

    es.addEventListener('error', () => {
      setConnStatus('error');
    });

    es.onopen = () => setConnStatus('live');

    return () => {
      es.close();
      esRef.current = null;
      if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
    };
  }, [id]);

  const nodes = data?.nodes ?? [];

  const statusCounts = nodes.reduce<Record<string, number>>((acc, n) => {
    acc[n.status] = (acc[n.status] ?? 0) + 1;
    return acc;
  }, {});

  const isLoading = connStatus === 'connecting' && nodes.length === 0;

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-3xl">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-gray-500 hover:text-gray-900 px-2"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-gray-400" />
              BT Live View
            </h1>
            <p className="text-xs text-gray-500 font-mono truncate mt-0.5">{id}</p>
          </div>
          {connStatus === 'live' && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
              <Wifi className="h-3 w-3" />
              Live {tickCount > 0 && <span className="font-mono">tick {tickCount}</span>}
            </span>
          )}
          {connStatus === 'stale' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
              Stale
            </span>
          )}
          {connStatus === 'connecting' && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200">
              <Loader2 className="h-3 w-3 animate-spin" />
              Connecting
            </span>
          )}
          {connStatus === 'error' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-600 border border-red-200">
              <WifiOff className="h-3 w-3" />
              Disconnected
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          {Object.entries(statusCounts).map(([status, count]) => (
            <span
              key={status}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-medium ${
                BT_STATUS_STYLES[status] ?? BT_STATUS_STYLES.pending
              }`}
            >
              {count} {status}
            </span>
          ))}
          {lastEventAt > 0 && (
            <span className="ml-auto text-gray-400">
              Updated {getRelativeTime(new Date(lastEventAt).toISOString())}
            </span>
          )}
        </div>

        {/* Tree */}
        <div className="border border-gray-200 rounded-lg bg-white p-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-full" style={{ marginLeft: `${(i % 3) * 16}px` }} />
              ))}
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
              <GitBranch className="h-8 w-8 opacity-30" />
              <p className="text-sm">
                {connStatus === 'error'
                  ? 'Stream disconnected — no execution data available.'
                  : 'Waiting for BT execution on this agent…'}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {nodes.map((node) => (
                <div
                  key={node.id}
                  className="flex items-start gap-2"
                  style={{ paddingLeft: `${node.depth * 20}px` }}
                >
                  {node.depth > 0 && (
                    <span className="mt-1 flex-shrink-0 text-gray-300 text-[10px] font-mono">└</span>
                  )}
                  <div className="flex-1 flex items-center justify-between gap-3 py-1.5 px-2.5 rounded-md hover:bg-gray-50 group transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-gray-400 font-mono flex-shrink-0 w-3 text-center">
                        {BT_TYPE_ICON[node.type] ?? '•'}
                      </span>
                      <span className="text-xs font-medium text-gray-800 truncate">{node.name}</span>
                      {node.execution_id && (
                        <span className="text-[10px] text-gray-400 font-mono hidden group-hover:inline">
                          {node.execution_id.slice(0, 8)}
                        </span>
                      )}
                      {node.timestamp && (
                        <span className="text-[10px] text-gray-400 hidden group-hover:inline">
                          {getRelativeTime(node.timestamp)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {node.duration_ms != null && node.duration_ms > 0 && (
                        <span className="text-[10px] text-gray-400 tabular-nums">
                          {node.duration_ms < 1000
                            ? `${node.duration_ms}ms`
                            : `${(node.duration_ms / 1000).toFixed(1)}s`}
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${
                          BT_STATUS_STYLES[node.status] ?? BT_STATUS_STYLES.pending
                        }`}
                      >
                        {node.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
