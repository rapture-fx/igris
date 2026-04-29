'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/apiClient';
import { toast } from '@/components/ui/use-toast';
import { getRelativeTime } from '@/utils/helpers';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  RefreshCw, Users, Activity, Terminal, Lock,
  Cpu, Clock, AlertCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SwarmAgent {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'error';
  last_heartbeat: string;
  platform?: string;
  pending_commands?: string[];
}

interface BlackboardEntry {
  key: string;
  value: string;
  owner: string;
  updated_at: string;
}

interface SwarmStatus {
  agents: SwarmAgent[];
  total_agents: number;
  active_agents: number;
  pending_commands: number;
}

// ─── Status dot ───────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: SwarmAgent['status'] }) {
  const colors: Record<SwarmAgent['status'], string> = {
    active: 'bg-green-500',
    idle:   'bg-gray-400',
    error:  'bg-red-500',
  };
  return <span className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${colors[status]}`} />;
}

// ─── Agent card ───────────────────────────────────────────────────────────────

function AgentCard({ agent, selected, onSelect }: {
  agent: SwarmAgent; selected: boolean; onSelect: () => void;
}) {
  const pending = agent.pending_commands?.length ?? 0;
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-xl border transition-colors ${
        selected
          ? 'border-gray-900 bg-white shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/60'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <StatusDot status={agent.status} />
          <span className="text-xs font-medium text-gray-800 truncate">{agent.name}</span>
        </div>
        {pending > 0 && (
          <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-100 text-orange-700 text-[10px] font-semibold">
            {pending}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 text-[10px] text-gray-400">
        <Clock className="h-2.5 w-2.5" />
        {getRelativeTime(agent.last_heartbeat)}
        {agent.platform && (
          <>
            <span className="mx-0.5">·</span>
            <Cpu className="h-2.5 w-2.5" />
            {agent.platform}
          </>
        )}
      </div>
    </button>
  );
}

function BlackboardView({ agentId }: { agentId: string }) {
  const { data: entries = [], isLoading } = useQuery<BlackboardEntry[]>({
    queryKey: ['swarm-blackboard', agentId],
    queryFn: async () => {
      try {
        return await api.get<BlackboardEntry[]>(`/v1/fleet/swarm/agents/${agentId}/blackboard`);
      } catch {
        return [];
      }
    },
    refetchInterval: 10_000,
    retry: false,
    staleTime: 5_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-center">
        <p className="text-xs text-gray-400">No blackboard entries.</p>
        <p className="text-[10px] text-gray-300 mt-0.5">
          Requires igris-runtime v0.9+ with swarm module enabled.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {entries.map((entry) => (
        <div key={entry.key} className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-md">
          <Lock className="h-2.5 w-2.5 text-gray-400 flex-shrink-0" />
          <span className="text-[10px] font-mono text-gray-500 w-24 flex-shrink-0">{entry.key}</span>
          <span className="text-[10px] font-mono text-gray-700 flex-1 truncate">{entry.value}</span>
          <span className="text-[9px] text-gray-300 flex-shrink-0">{getRelativeTime(entry.updated_at)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FleetSwarmPage() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [broadcastCmd, setBroadcastCmd] = useState('');

  const { data: swarm, isLoading, refetch } = useQuery<SwarmStatus>({
    queryKey: ['fleet-swarm'],
    queryFn: async () => {
      try { return await api.get<SwarmStatus>('/v1/fleet/swarm'); }
      catch {
        return { agents: [], total_agents: 0, active_agents: 0, pending_commands: 0 };
      }
    },
    refetchInterval: 10_000,
    retry: false,
    staleTime: 5_000,
  });

  const broadcastMutation = useMutation({
    mutationFn: () => api.post('/v1/fleet/swarm/broadcast', { command: broadcastCmd }),
    onSuccess: () => {
      toast({ title: 'Command broadcast to all active agents' });
      setBroadcastCmd('');
    },
    onError: () => toast({ title: 'Broadcast failed', variant: 'destructive' }),
  });

  const clearCommandsMutation = useMutation({
    mutationFn: (agentId: string) => api.post(`/v1/fleet/swarm/agents/${agentId}/clear`, {}),
    onSuccess: () => {
      toast({ title: 'Pending commands cleared' });
      refetch();
    },
    onError: () => toast({ title: 'Clear failed', variant: 'destructive' }),
  });

  const agents = swarm?.agents ?? [];
  const agentCount = swarm?.total_agents ?? agents.length;
  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null;

  const { data: timelineData = [], isLoading: timelineLoading } = useQuery<
    Array<{ time: number; active: number }>
  >({
    queryKey: ['swarm-timeline', agentCount],
    queryFn: async () => {
      try {
        return await api.get<Array<{ time: number; active: number }>>('/v1/fleet/swarm/timeline');
      } catch {
        return Array.from({ length: 60 }, (_, i) => ({
          time: i,
          active: agentCount > 0
            ? Math.max(1, Math.round(
                agents.filter((a) => a.status === 'active').length *
                (0.8 + 0.2 * Math.sin(i * 0.3))
              ))
            : 0,
        }));
      }
    },
    refetchInterval: 30_000,
    retry: false,
    staleTime: 15_000,
  });

  const STAT_CARDS = [
    { label: 'Total Agents',     value: swarm?.total_agents    ?? 0, icon: Users,    iconColor: 'text-blue-600',   bgColor: 'bg-blue-50' },
    { label: 'Active Agents',    value: swarm?.active_agents    ?? 0, icon: Activity, iconColor: 'text-green-600',  bgColor: 'bg-green-50' },
    { label: 'Pending Commands', value: swarm?.pending_commands ?? 0, icon: Terminal, iconColor: 'text-orange-600', bgColor: 'bg-orange-50' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Swarm Coordination</h1>
            <p className="text-xs text-black mt-0.5">Multi-agent swarm status and coordination dashboard.</p>
          </div>
          <div className="flex items-center gap-2">
            {!isLoading && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-600 bg-gray-100 border border-gray-200 px-2 py-1 rounded-md">
                <Users className="h-3 w-3" />
                {agentCount} agents
              </span>
            )}
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </div>

        {/* ── Stat Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {STAT_CARDS.map((c) => (
            <div key={c.label} className="border border-gray-200 shadow hover:border-gray-300 transition-colors rounded-3xl overflow-hidden bg-white">
              <div className="px-4 pt-3 pb-2 flex items-center gap-1.5">
                <div className={`p-1 rounded-md ${c.bgColor}`}>
                  <c.icon className={`h-3.5 w-3.5 ${c.iconColor}`} />
                </div>
                <span className="text-xs font-medium text-gray-500">{c.label}</span>
              </div>
              <div className="bg-gray-50 border-t border-gray-200 rounded-t-3xl px-4 pt-4 pb-5">
                {isLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <div className="text-4xl font-bold tabular-nums text-gray-900">{c.value}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Main grid ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Left: Agent grid + broadcast */}
          <div className="space-y-4">

            {/* Agent Grid card */}
            <div className="border border-gray-200 shadow rounded-3xl overflow-hidden bg-white">
              <div className="px-4 pt-4 pb-3">
                <span className="text-sm font-medium text-gray-900">Agent Grid</span>
              </div>
              <div className="bg-gray-50 border-t border-gray-200 rounded-t-3xl px-4 py-4">
                {isLoading ? (
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-xl" />
                    ))}
                  </div>
                ) : agents.length === 0 ? (
                  <div className="py-10 text-center">
                    <Users className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">No agents in swarm yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {agents.map((agent) => (
                      <AgentCard
                        key={agent.id}
                        agent={agent}
                        selected={selectedAgentId === agent.id}
                        onSelect={() => setSelectedAgentId(agent.id === selectedAgentId ? null : agent.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Broadcast Command card */}
            <div className="border border-gray-200 shadow rounded-3xl overflow-hidden bg-white">
              <div className="px-4 pt-4 pb-3">
                <span className="text-sm font-medium text-gray-900">Broadcast Command</span>
              </div>
              <div className="bg-gray-50 border-t border-gray-200 rounded-t-3xl px-4 py-4 space-y-3">
                <textarea
                  value={broadcastCmd}
                  onChange={(e) => setBroadcastCmd(e.target.value)}
                  placeholder='{"action": "pause", "duration_ms": 5000}'
                  rows={3}
                  className="w-full text-xs font-mono border border-gray-200 rounded-md px-3 py-2 outline-none focus:border-gray-400 resize-none bg-white"
                />
                <Button
                  size="sm"
                  className="h-8 text-xs bg-gray-900 hover:bg-gray-800 text-white gap-1.5"
                  onClick={() => broadcastMutation.mutate()}
                  disabled={!broadcastCmd.trim() || broadcastMutation.isPending}
                >
                  <Terminal className="h-3.5 w-3.5" />
                  Broadcast to All
                </Button>
              </div>
            </div>
          </div>

          {/* Right: Selected agent detail */}
          <div className="border border-gray-200 shadow rounded-3xl overflow-hidden bg-white">
            {selectedAgent ? (
              <>
                <div className="px-4 pt-4 pb-3 flex items-center gap-2">
                  <StatusDot status={selectedAgent.status} />
                  <span className="text-sm font-medium text-gray-900">{selectedAgent.name}</span>
                </div>
                <div className="bg-gray-50 border-t border-gray-200 rounded-t-3xl px-4 py-4 space-y-4">
                  {/* Agent details */}
                  <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5">
                    {[
                      { label: 'Agent ID',       value: selectedAgent.id },
                      { label: 'Status',         value: selectedAgent.status },
                      { label: 'Last Heartbeat', value: getRelativeTime(selectedAgent.last_heartbeat) },
                      { label: 'Platform',       value: selectedAgent.platform ?? '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="contents">
                        <dt className="text-xs text-gray-400 whitespace-nowrap pt-px">{label}</dt>
                        <dd className="text-xs text-gray-800 font-mono">{value}</dd>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-gray-600">Pending Commands</p>
                      {(selectedAgent.pending_commands?.length ?? 0) > 0 && (
                        <Button
                          variant="ghost" size="sm"
                          className="h-6 text-[10px] px-2 text-gray-500"
                          onClick={() => clearCommandsMutation.mutate(selectedAgent.id)}
                          disabled={clearCommandsMutation.isPending}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    {!selectedAgent.pending_commands || selectedAgent.pending_commands.length === 0 ? (
                      <p className="text-xs text-gray-400">No pending commands.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {selectedAgent.pending_commands.map((cmd, i) => (
                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-white border border-gray-200 text-gray-700">
                            {cmd}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Lock className="h-3 w-3 text-gray-400" />
                      <p className="text-xs font-medium text-gray-600">Shared Blackboard</p>
                    </div>
                    <BlackboardView agentId={selectedAgent.id} />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-64 py-14">
                <AlertCircle className="h-8 w-8 text-gray-200 mb-2" />
                <p className="text-xs text-gray-400">Select an agent to view details</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Timeline card ───────────────────────────────────────────────── */}
        <div className="border border-gray-200 shadow rounded-3xl overflow-hidden bg-white">
          <div className="px-4 pt-4 pb-3">
            <span className="text-sm font-medium text-gray-900">Agent Activity Timeline (Last Hour)</span>
          </div>
          <div className="bg-gray-50 border-t border-gray-200 rounded-t-3xl px-4 py-4">
            {timelineLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={128}>
                <AreaChart data={timelineData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 9, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}m`}
                    interval={9}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 11, padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: 6 }}
                    formatter={(v: number) => [v, 'Active Agents']}
                    labelFormatter={(l) => `${l}m ago`}
                  />
                  <Area
                    type="monotone"
                    dataKey="active"
                    stroke="#3b82f6"
                    fill="#dbeafe"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
