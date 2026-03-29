'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { getRelativeTime } from '@/utils/helpers';
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronRight, Edit2, ExternalLink, GitBranch, Loader2, Sparkles, Wifi, WifiOff } from 'lucide-react';
import { CopyButton } from '@/components/execution/shared';

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
  llm_proposal?: string;
  envelope_status?: 'passed' | 'violated' | 'partial';
  enforced_action?: string;
  runtime_override?: boolean;
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

const ENVELOPE_DOT: Record<'passed' | 'violated' | 'partial', string> = {
  passed:   'bg-green-500',
  violated: 'bg-red-500',
  partial:  'bg-yellow-400',
};

const ENVELOPE_LABEL: Record<'passed' | 'violated' | 'partial', string> = {
  passed:   'Envelope: all resource limits satisfied',
  violated: 'Envelope VIOLATED: action exceeded policy bounds',
  partial:  'Envelope partial: one or more limits approaching threshold',
};

const NODE_TYPE_COLORS: Record<string, string> = {
  selector:  'bg-purple-50 border-purple-200 text-purple-700',
  sequence:  'bg-blue-50 border-blue-200 text-blue-700',
  action:    'bg-gray-50 border-gray-200 text-gray-700',
  condition: 'bg-teal-50 border-teal-200 text-teal-700',
};

interface BTTreeItem extends BTNode {
  children: BTTreeItem[];
}

function buildTree(nodes: BTNode[]): BTTreeItem[] {
  const roots: BTTreeItem[] = [];
  const stack: BTTreeItem[] = [];
  for (const node of nodes) {
    const item: BTTreeItem = { ...node, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].depth >= node.depth) {
      stack.pop();
    }
    if (stack.length === 0) {
      roots.push(item);
    } else {
      stack[stack.length - 1].children.push(item);
    }
    stack.push(item);
  }
  return roots;
}

function BTTreeNode({
  node,
  isLast,
  prefix,
  onSelect,
  collapsedIds,
  onToggleCollapse,
}: {
  node: BTTreeItem;
  isLast: boolean;
  prefix: string;
  onSelect: (n: BTNode) => void;
  collapsedIds: Set<string>;
  onToggleCollapse: (id: string) => void;
}) {
  const connector = isLast ? '└─' : '├─';
  const childPrefix = prefix + (isLast ? '  ' : '│ ');
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsedIds.has(node.id);

  return (
    <div>
      {/* Node row */}
      <div className="flex items-start">
        {/* Tree connector */}
        {prefix.length > 0 && (
          <span className="flex-shrink-0 font-mono text-[11px] text-gray-300 leading-[26px] select-none whitespace-pre">
            {prefix}{connector}{' '}
          </span>
        )}
        {/* Collapse toggle */}
        {hasChildren && (
          <button
            type="button"
            className="flex-shrink-0 h-[26px] w-5 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
            onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.id); }}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed
              ? <ChevronRight className="h-3 w-3" />
              : <ChevronDown className="h-3 w-3" />}
          </button>
        )}
        {!hasChildren && <span className="flex-shrink-0 w-5" />}
        {/* Clickable node card — pulse ring when actively running */}
        <button
          type="button"
          className={`flex-1 flex items-center justify-between gap-2 py-1 px-2 rounded-md hover:bg-gray-50 group transition-colors text-left min-w-0 mb-0.5 ${
            node.status === 'running' ? 'ring-1 ring-blue-300 ring-offset-1 animate-pulse' : ''
          }`}
          onClick={() => onSelect(node)}
        >
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Type chip */}
              <span className={`inline-flex items-center px-1 py-0 rounded border text-[9px] font-semibold uppercase tracking-wide ${NODE_TYPE_COLORS[node.type] ?? NODE_TYPE_COLORS.action}`}>
                {BT_TYPE_ICON[node.type] ?? '•'} {node.type}
              </span>
              <span className="text-xs font-medium text-gray-800 truncate">{node.name}</span>
              {node.execution_id && (
                <span className="text-[10px] text-gray-400 font-mono hidden group-hover:inline">
                  {node.execution_id.slice(0, 8)}
                </span>
              )}
            </div>
            {node.llm_proposal && (
              <div className="flex items-center gap-1 mt-0.5 pl-0.5">
                <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded bg-indigo-50 border border-indigo-200 text-[9px] font-semibold text-indigo-600 flex-shrink-0">
                  <Sparkles className="h-2 w-2" />
                  LLM Suggested
                </span>
                <p className="text-[10px] text-indigo-400 italic truncate">
                  {node.llm_proposal}
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {node.duration_ms != null && node.duration_ms > 0 && (
              <span className="text-[10px] text-gray-400 tabular-nums hidden group-hover:inline">
                {node.duration_ms < 1000 ? `${node.duration_ms}ms` : `${(node.duration_ms / 1000).toFixed(1)}s`}
              </span>
            )}
            {node.envelope_status && (
              <span
                className={`h-2 w-2 rounded-full flex-shrink-0 ${ENVELOPE_DOT[node.envelope_status]}`}
                title={ENVELOPE_LABEL[node.envelope_status]}
              />
            )}
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${BT_STATUS_STYLES[node.status] ?? BT_STATUS_STYLES.pending}`}>
              {node.status}
            </span>
          </div>
        </button>
      </div>
      {/* Children — skip when collapsed */}
      {!isCollapsed && node.children.map((child, i) => (
        <BTTreeNode
          key={child.id}
          node={child}
          isLast={i === node.children.length - 1}
          prefix={childPrefix}
          onSelect={onSelect}
          collapsedIds={collapsedIds}
          onToggleCollapse={onToggleCollapse}
        />
      ))}
    </div>
  );
}

type ConnectionStatus = 'connecting' | 'live' | 'stale' | 'error';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentLivePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [data, setData] = useState<BTState | null>(null);
  const [tickCount, setTickCount] = useState<number>(0);
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('connecting');
  const [lastEventAt, setLastEventAt] = useState<number>(0);

  // Drawer state
  const [drawerNode, setDrawerNode] = useState<BTNode | null>(null);

  // Collapse/expand state
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const onToggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

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
  const treeRoots = buildTree(nodes);

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

          {/* Edit BT button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => router.push('/execution/bt-editor')}
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit BT
          </Button>

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
          {nodes.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] px-2 text-gray-500 hover:text-gray-800"
              onClick={() => {
                const allInternalIds = treeRoots.flatMap(function collect(n: BTTreeItem): string[] {
                  return n.children.length > 0 ? [n.id, ...n.children.flatMap(collect)] : [];
                });
                if (collapsedIds.size > 0) {
                  setCollapsedIds(new Set());
                } else {
                  setCollapsedIds(new Set(allInternalIds));
                }
              }}
            >
              {collapsedIds.size > 0 ? 'Expand All' : 'Collapse All'}
            </Button>
          )}
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
            <div className="font-mono text-[11px]">
              {treeRoots.map((root, i) => (
                <BTTreeNode
                  key={root.id}
                  node={root}
                  isLast={i === treeRoots.length - 1}
                  prefix=""
                  onSelect={setDrawerNode}
                  collapsedIds={collapsedIds}
                  onToggleCollapse={onToggleCollapse}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Node Detail Drawer */}
      <Sheet open={!!drawerNode} onOpenChange={(open) => !open && setDrawerNode(null)}>
        <SheetContent className="w-[360px] sm:w-[400px]">
          {drawerNode && (
            <>
              <SheetHeader>
                <SheetTitle className="text-sm font-semibold text-gray-900 truncate">
                  {drawerNode.name}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4 text-xs">

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Type</p>
                    <span className="font-mono text-gray-700">{drawerNode.type}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Status</p>
                    <div className="flex items-center gap-1.5">
                      {drawerNode.envelope_status && (
                        <span
                          className={`h-2 w-2 rounded-full flex-shrink-0 ${ENVELOPE_DOT[drawerNode.envelope_status]}`}
                          title={`Envelope: ${drawerNode.envelope_status}`}
                        />
                      )}
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${
                          BT_STATUS_STYLES[drawerNode.status] ?? BT_STATUS_STYLES.pending
                        }`}
                      >
                        {drawerNode.status}
                      </span>
                    </div>
                  </div>
                </div>

                {drawerNode.execution_id && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Execution ID</p>
                      <div className="flex items-center gap-1.5">
                        <code className="font-mono text-gray-700 break-all text-[11px]">{drawerNode.execution_id}</code>
                        <CopyButton value={drawerNode.execution_id} />
                      </div>
                    </div>
                  </>
                )}

                {drawerNode.timestamp && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Timestamp</p>
                      <span className="text-gray-700">{getRelativeTime(drawerNode.timestamp)}</span>
                      <span className="text-gray-400 ml-2 font-mono text-[10px]">{drawerNode.timestamp}</span>
                    </div>
                  </>
                )}

                {drawerNode.duration_ms != null && drawerNode.duration_ms > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Duration</p>
                      <span className="font-mono text-gray-700">
                        {drawerNode.duration_ms < 1000
                          ? `${drawerNode.duration_ms}ms`
                          : `${(drawerNode.duration_ms / 1000).toFixed(1)}s`}
                      </span>
                    </div>
                  </>
                )}

                {drawerNode.llm_proposal && (
                  <>
                    <Separator />
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">LLM Proposal</p>
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-[9px] font-semibold text-indigo-600">
                          <Sparkles className="h-2.5 w-2.5" />
                          LLM Suggested
                        </span>
                      </div>
                      <p className="text-indigo-700 leading-relaxed italic text-xs bg-indigo-50 border border-indigo-100 rounded-md px-3 py-2">
                        {drawerNode.llm_proposal}
                      </p>
                    </div>
                  </>
                )}

                {(drawerNode.llm_proposal || drawerNode.enforced_action) && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">LLM → Runtime Diff</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className={`rounded-md border p-2.5 ${drawerNode.runtime_override ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                          <p className="text-[9px] font-bold uppercase tracking-wide text-blue-600 mb-1">LLM Proposed</p>
                          <p className="text-[11px] text-blue-800 leading-relaxed">
                            {drawerNode.llm_proposal ?? <span className="text-gray-400 italic">none</span>}
                          </p>
                        </div>
                        <div className={`rounded-md border p-2.5 ${drawerNode.runtime_override ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'}`}>
                          <p className={`text-[9px] font-bold uppercase tracking-wide mb-1 ${drawerNode.runtime_override ? 'text-red-600' : 'text-gray-500'}`}>
                            {drawerNode.runtime_override ? 'Runtime Override' : 'Runtime Enforced'}
                          </p>
                          <p className={`text-[11px] leading-relaxed ${drawerNode.runtime_override ? 'text-red-800' : 'text-gray-700'}`}>
                            {drawerNode.enforced_action ?? <span className="text-gray-400 italic">same as proposed</span>}
                          </p>
                        </div>
                      </div>
                      {drawerNode.runtime_override && (
                        <p className="text-[10px] text-red-600 mt-1.5 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                          Runtime enforcer rejected or modified the LLM proposal to satisfy policy bounds.
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* Envelope verdict detail */}
                {drawerNode.envelope_status && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Envelope Verdict</p>
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-medium ${
                        drawerNode.envelope_status === 'passed'
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : drawerNode.envelope_status === 'violated'
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                      }`}>
                        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${ENVELOPE_DOT[drawerNode.envelope_status]}`} />
                        {ENVELOPE_LABEL[drawerNode.envelope_status]}
                      </div>
                    </div>
                  </>
                )}

                {/* View signed receipts for this node */}
                {drawerNode.execution_id && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Signed Receipt</p>
                      <a
                        href={`/proof/traces?execution_id=${drawerNode.execution_id}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-gray-200 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View signed traces for this node
                      </a>
                    </div>
                  </>
                )}

              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

    </DashboardLayout>
  );
}
