'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/apiClient';
import { toast } from '@/components/ui/use-toast';
import { getRelativeTime } from '@/utils/helpers';
import { Switch } from '@/components/ui/switch';
import {
  Radio, AlertTriangle, Trash2, RefreshCw, X, Info, Wifi, WifiOff,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopicMapping {
  id: string;
  bt_action: string;
  topic_name: string;
  message_type: string;
  direction: 'publish' | 'subscribe';
  created_at: string;
}

interface Device {
  device_id: string;
  status: 'online' | 'offline';
  runtime_version: string;
  last_seen: string;
  ros_node?: {
    node_name: string;
    lifecycle_state: string;
    air_gapped: boolean;
  } | null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FleetROSPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'mappings' | 'monitor' | 'lifecycle'>('mappings');
  const [airGapDismissed, setAirGapDismissed] = useState(false);
  const [localOnlyMode, setLocalOnlyMode] = useState(false);

  const [btAction, setBtAction] = useState('');
  const [topicName, setTopicName] = useState('');
  const [msgType, setMsgType] = useState('geometry_msgs/Twist');
  const [direction, setDirection] = useState<'publish' | 'subscribe'>('publish');

  const [shutdownTarget, setShutdownTarget] = useState<Device | null>(null);

  // ── Topic mappings ──
  const { data: mappings = [], isLoading: mappingsLoading } = useQuery<TopicMapping[]>({
    queryKey: ['ros-topics'],
    queryFn: async () => {
      try { return await api.get<TopicMapping[]>('/v1/ros/topics'); }
      catch { return []; }
    },
    staleTime: 30_000,
    retry: false,
  });

  const addMappingMutation = useMutation({
    mutationFn: () => api.post('/v1/ros/topics/map', {
      bt_action: btAction, topic_name: topicName, message_type: msgType, direction,
    }),
    onSuccess: () => {
      toast({ title: 'Topic mapping added' });
      qc.invalidateQueries({ queryKey: ['ros-topics'] });
      setBtAction(''); setTopicName(''); setMsgType('geometry_msgs/Twist');
    },
    onError: () => toast({ title: 'Failed to add mapping', variant: 'destructive' }),
  });

  const deleteMappingMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/v1/ros/topics/map/${id}`),
    onSuccess: () => {
      toast({ title: 'Mapping removed' });
      qc.invalidateQueries({ queryKey: ['ros-topics'] });
    },
    onError: () => toast({ title: 'Failed to remove mapping', variant: 'destructive' }),
  });

  // ── Devices for lifecycle ──
  const { data: devices = [], isLoading: devicesLoading, refetch: refetchDevices } = useQuery<Device[]>({
    queryKey: ['fleet-devices-ros'],
    queryFn: async () => {
      try { return await api.get<Device[]>('/devices'); }
      catch { return []; }
    },
    staleTime: 30_000,
    retry: false,
  });

  type RosLifecycleAction = 'configure' | 'activate' | 'deactivate' | 'reset' | 'shutdown';
  const [pendingActions, setPendingActions] = useState<Record<string, RosLifecycleAction | null>>({});

  const lifecycleMutation = useMutation({
    mutationFn: ({ runtimeId, action }: { runtimeId: string; action: RosLifecycleAction }) =>
      api.post('/v1/ros/lifecycle', { runtime_id: runtimeId, action }),
    onMutate: ({ runtimeId, action }) =>
      setPendingActions((p) => ({ ...p, [runtimeId]: action })),
    onSettled: (_data, _err, variables) =>
      setPendingActions((p) => ({ ...p, [variables.runtimeId]: null })),
    onSuccess: (_, { action }) => {
      toast({ title: 'Lifecycle command sent', description: `Action '${action}' dispatched.` });
      refetchDevices();
    },
    onError: () => toast({ title: 'Command failed', variant: 'destructive' }),
  });

  const sendLifecycle = (device: Device, action: RosLifecycleAction) => {
    if (action === 'shutdown') { setShutdownTarget(device); return; }
    lifecycleMutation.mutate({ runtimeId: device.device_id, action });
  };

  const confirmShutdown = () => {
    if (!shutdownTarget) return;
    lifecycleMutation.mutate({ runtimeId: shutdownTarget.device_id, action: 'shutdown' });
    setShutdownTarget(null);
  };

  const ACTION_STYLES: Record<RosLifecycleAction, string> = {
    configure:  'border-gray-200 text-gray-700 hover:bg-gray-50',
    activate:   'border-green-200 text-green-700 hover:bg-green-50',
    deactivate: 'border-yellow-200 text-yellow-700 hover:bg-yellow-50',
    reset:      'border-orange-200 text-orange-700 hover:bg-orange-50',
    shutdown:   'border-red-200 text-red-700 hover:bg-red-50',
  };

  const TAB_CLASS = (t: string) =>
    `px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
      activeTab === t
        ? 'border-gray-900 text-gray-900'
        : 'border-transparent text-gray-500 hover:text-gray-700'
    }`;

  return (
    <DashboardLayout>
      <div className="space-y-5">

        {/* ── Air-gap warning ──────────────────────────────────────────────── */}
        {!airGapDismissed && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-yellow-50 border border-yellow-200">
            <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-700 flex-1">
              Running in air-gapped mode — ROS master not detected. Topic monitor is unavailable.
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <Switch
                  checked={localOnlyMode}
                  onCheckedChange={setLocalOnlyMode}
                  className="h-4 w-7 data-[state=checked]:bg-yellow-600"
                />
                <span className="text-[11px] text-yellow-700 font-medium">Local-only</span>
              </div>
              <button onClick={() => setAirGapDismissed(true)} className="text-yellow-500 hover:text-yellow-700">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-base font-semibold text-gray-900">ROS 2 Integration</h1>
            <p className="text-xs text-black mt-0.5">Node mapping, topic monitoring, and lifecycle controls.</p>
          </div>
          <div className="flex items-center gap-2">
            {localOnlyMode && (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md font-medium">
                Local-Only Mode
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-50 border border-gray-200 px-2 py-1 rounded-md">
              <Radio className="h-3 w-3" />
              Not connected
            </span>
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="border-b border-gray-200 flex">
          <button className={TAB_CLASS('mappings')} onClick={() => setActiveTab('mappings')}>Topic Mappings</button>
          <button className={TAB_CLASS('monitor')} onClick={() => setActiveTab('monitor')}>Topic Monitor</button>
          <button className={TAB_CLASS('lifecycle')} onClick={() => setActiveTab('lifecycle')}>Lifecycle Controls</button>
        </div>

        {/* ── Tab: Topic Mappings ─────────────────────────────────────────── */}
        {activeTab === 'mappings' && (
          <div className="space-y-4">

            {/* Add mapping form card */}
            <div className="border border-gray-200 shadow rounded-3xl overflow-hidden bg-white">
              <div className="px-4 pt-4 pb-3">
                <span className="text-sm font-medium text-gray-900">Add Topic Mapping</span>
              </div>
              <div className="bg-gray-50 border-t border-gray-200 rounded-t-3xl px-4 py-4">
                <div className="flex items-end gap-2 flex-wrap">
                  <div className="flex flex-col gap-1 min-w-[140px]">
                    <label className="text-xs text-gray-500">BT Action</label>
                    <input
                      value={btAction}
                      onChange={(e) => setBtAction(e.target.value)}
                      placeholder="move_forward"
                      className="h-8 text-xs border border-gray-200 rounded-md px-2 outline-none focus:border-gray-400 bg-white"
                    />
                  </div>
                  <div className="flex flex-col gap-1 min-w-[150px]">
                    <label className="text-xs text-gray-500">Topic Name</label>
                    <input
                      value={topicName}
                      onChange={(e) => setTopicName(e.target.value)}
                      placeholder="/cmd_vel"
                      className="h-8 text-xs border border-gray-200 rounded-md px-2 outline-none focus:border-gray-400 bg-white"
                    />
                  </div>
                  <div className="flex flex-col gap-1 min-w-[180px]">
                    <label className="text-xs text-gray-500">Message Type</label>
                    <input
                      value={msgType}
                      onChange={(e) => setMsgType(e.target.value)}
                      placeholder="geometry_msgs/Twist"
                      className="h-8 text-xs border border-gray-200 rounded-md px-2 outline-none focus:border-gray-400 bg-white"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500">Direction</label>
                    <Select value={direction} onValueChange={(v) => setDirection(v as 'publish' | 'subscribe')}>
                      <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="publish" className="text-xs">Publish</SelectItem>
                        <SelectItem value="subscribe" className="text-xs">Subscribe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-gray-900 hover:bg-gray-800 text-white"
                    onClick={() => addMappingMutation.mutate()}
                    disabled={!btAction || !topicName || addMappingMutation.isPending}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>

            {/* Mappings table card */}
            <div className="border border-gray-200 shadow rounded-3xl overflow-hidden bg-white">
              <div className="px-4 pt-4 pb-3">
                <span className="text-sm font-medium text-gray-900">Mappings</span>
              </div>
              <div className="bg-gray-50 border-t border-gray-200 rounded-t-3xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {['BT Action', 'Topic', 'Message Type', 'Direction', 'Created', ''].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left font-medium text-black whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mappingsLoading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                          <tr key={i} className="border-b border-gray-100">
                            {Array.from({ length: 6 }).map((_, j) => (
                              <td key={j} className="px-4 py-2.5"><Skeleton className="h-3.5 w-16" /></td>
                            ))}
                          </tr>
                        ))
                      ) : mappings.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-14 text-center text-xs text-gray-400">
                            No topic mappings yet. Map BT actions to ROS topics to enable runtime communication.
                          </td>
                        </tr>
                      ) : (
                        mappings.map((m) => (
                          <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-100/50 transition-colors">
                            <td className="px-4 py-2.5 font-mono text-gray-700">{m.bt_action}</td>
                            <td className="px-4 py-2.5 font-mono text-blue-600">{m.topic_name}</td>
                            <td className="px-4 py-2.5 text-gray-500">{m.message_type}</td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border rounded ${
                                m.direction === 'publish'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-green-50 text-green-700 border-green-200'
                              }`}>
                                {m.direction}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-gray-400">{getRelativeTime(m.created_at)}</td>
                            <td className="px-4 py-2.5">
                              <Button
                                variant="ghost" size="sm"
                                className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                                onClick={() => deleteMappingMutation.mutate(m.id)}
                                disabled={deleteMappingMutation.isPending}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 border-t border-gray-200">
                  <span className="text-xs text-black">{mappings.length} mapping{mappings.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Topic Monitor ──────────────────────────────────────────── */}
        {activeTab === 'monitor' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
              <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                Connect your ROS 2 bridge to enable live topic monitoring.{' '}
                <a href="https://docs.igrisinertial.com/ros2" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                  See docs for setup.
                </a>
              </p>
            </div>

            <div className="border border-gray-200 shadow rounded-3xl overflow-hidden bg-white">
              <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-gray-900">Topic Activity</span>
                {mappings.length > 0 && (
                  <Button
                    variant="outline" size="sm" className="h-8 text-xs gap-1.5"
                    onClick={() => toast({ title: 'ROS Bridge', description: 'Install the ROS bridge package and run: igris-ros-bridge --connect' })}
                  >
                    <Wifi className="h-3.5 w-3.5" />
                    Connect ROS Bridge
                  </Button>
                )}
              </div>
              <div className="bg-gray-50 border-t border-gray-200 rounded-t-3xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {['Topic', 'Hz', 'Last Message', 'Status'].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left font-medium text-black whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mappings.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-14 text-center text-xs text-gray-400">
                            No topics to monitor. Add topic mappings first.
                          </td>
                        </tr>
                      ) : (
                        mappings.map((m) => (
                          <tr key={m.id} className="border-b border-gray-100 last:border-0">
                            <td className="px-4 py-2.5 font-mono text-blue-600">{m.topic_name}</td>
                            <td className="px-4 py-2.5 text-gray-300">—</td>
                            <td className="px-4 py-2.5 text-gray-300">—</td>
                            <td className="px-4 py-2.5">
                              <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 bg-white border border-gray-200 px-1.5 py-0.5 rounded">
                                <WifiOff className="h-2.5 w-2.5" />
                                Disconnected
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Lifecycle Controls ─────────────────────────────────────── */}
        {activeTab === 'lifecycle' && (
          <div className="space-y-4">

            {/* State machine diagram card */}
            <div className="border border-gray-200 shadow rounded-3xl overflow-hidden bg-white">
              <div className="px-4 pt-4 pb-3">
                <span className="text-sm font-medium text-gray-900">ROS 2 Lifecycle State Machine</span>
              </div>
              <div className="bg-gray-50 border-t border-gray-200 rounded-t-3xl px-4 py-4">
                <div className="overflow-x-auto">
                  <svg viewBox="0 0 640 180" className="w-full max-w-xl" style={{ minWidth: 420, height: 160 }}>
                    <rect x="10" y="60" width="110" height="32" rx="6" fill="#f3f4f6" stroke="#9ca3af" strokeWidth="1.5" />
                    <text x="65" y="81" textAnchor="middle" fontSize="10" fill="#374151" fontWeight="600">Unconfigured</text>
                    <rect x="180" y="60" width="90" height="32" rx="6" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5" />
                    <text x="225" y="81" textAnchor="middle" fontSize="10" fill="#1d4ed8" fontWeight="600">Inactive</text>
                    <rect x="340" y="60" width="80" height="32" rx="6" fill="#dcfce7" stroke="#22c55e" strokeWidth="1.5" />
                    <text x="380" y="81" textAnchor="middle" fontSize="10" fill="#15803d" fontWeight="600">Active</text>
                    <rect x="470" y="10" width="110" height="28" rx="6" fill="#fee2e2" stroke="#ef4444" strokeWidth="1.5" />
                    <text x="525" y="29" textAnchor="middle" fontSize="9" fill="#b91c1c" fontWeight="600">ErrorProcessing</text>
                    <rect x="470" y="130" width="80" height="28" rx="6" fill="#f9fafb" stroke="#6b7280" strokeWidth="1.5" />
                    <text x="510" y="149" textAnchor="middle" fontSize="9" fill="#6b7280" fontWeight="600">Finalized</text>
                    <line x1="120" y1="76" x2="178" y2="76" stroke="#6b7280" strokeWidth="1.2" markerEnd="url(#arr)" />
                    <text x="149" y="70" textAnchor="middle" fontSize="8" fill="#6b7280">configure</text>
                    <line x1="270" y1="72" x2="338" y2="72" stroke="#22c55e" strokeWidth="1.2" markerEnd="url(#arr)" />
                    <text x="304" y="66" textAnchor="middle" fontSize="8" fill="#15803d">activate</text>
                    <path d="M 380 92 Q 304 120 225 92" fill="none" stroke="#f97316" strokeWidth="1.2" markerEnd="url(#arr)" />
                    <text x="304" y="118" textAnchor="middle" fontSize="8" fill="#c2410c">deactivate</text>
                    <path d="M 180 88 Q 120 130 65 92" fill="none" stroke="#8b5cf6" strokeWidth="1.2" markerEnd="url(#arr)" />
                    <text x="110" y="130" textAnchor="middle" fontSize="8" fill="#7c3aed">reset</text>
                    <line x1="420" y1="65" x2="468" y2="35" stroke="#ef4444" strokeWidth="1" strokeDasharray="3 2" markerEnd="url(#arrerr)" />
                    <text x="457" y="50" textAnchor="middle" fontSize="7.5" fill="#ef4444">error</text>
                    <line x1="225" y1="92" x2="470" y2="144" stroke="#6b7280" strokeWidth="1" strokeDasharray="3 2" markerEnd="url(#arr)" />
                    <text x="355" y="135" textAnchor="middle" fontSize="7.5" fill="#6b7280">shutdown</text>
                    <defs>
                      <marker id="arr" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                        <path d="M 0 0 L 7 3.5 L 0 7 z" fill="#6b7280" />
                      </marker>
                      <marker id="arrerr" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                        <path d="M 0 0 L 7 3.5 L 0 7 z" fill="#ef4444" />
                      </marker>
                    </defs>
                  </svg>
                </div>
              </div>
            </div>

            {/* Runtime nodes table card */}
            <div className="border border-gray-200 shadow rounded-3xl overflow-hidden bg-white">
              <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-gray-900">Runtime Nodes</span>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetchDevices()}>
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
              </div>
              <div className="bg-gray-50 border-t border-gray-200 rounded-t-3xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {['Device', 'Status', 'ROS State', 'Actions'].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left font-medium text-black whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {devicesLoading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                          <tr key={i} className="border-b border-gray-100">
                            {Array.from({ length: 4 }).map((_, j) => (
                              <td key={j} className="px-4 py-2.5"><Skeleton className="h-3.5 w-20" /></td>
                            ))}
                          </tr>
                        ))
                      ) : devices.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-14 text-center text-xs text-gray-400">
                            No runtime nodes registered.
                          </td>
                        </tr>
                      ) : (
                        devices.map((device) => {
                          const isPending = !!pendingActions[device.device_id];
                          return (
                            <tr key={device.device_id} className="border-b border-gray-100 hover:bg-gray-100/50 transition-colors">
                              <td className="px-4 py-2.5 font-mono text-gray-700">{device.device_id}</td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border rounded ${
                                  device.status === 'online'
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : 'bg-gray-50 text-gray-500 border-gray-200'
                                }`}>
                                  {device.status}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-gray-500">
                                <span className="flex items-center gap-1.5">
                                  {device.ros_node?.lifecycle_state ?? <span className="text-gray-300">—</span>}
                                  {pendingActions[device.device_id] && (
                                    <span className="text-[10px] text-blue-500 font-medium flex items-center gap-0.5">
                                      <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                                      → {pendingActions[device.device_id]}
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-1 flex-wrap">
                                  {(['configure', 'activate', 'deactivate', 'reset', 'shutdown'] as RosLifecycleAction[]).map((action) => (
                                    <Button
                                      key={action}
                                      variant="outline" size="sm"
                                      className={`h-6 text-[10px] px-2 capitalize ${ACTION_STYLES[action]}`}
                                      disabled={isPending || device.status === 'offline'}
                                      onClick={() => sendLifecycle(device, action)}
                                    >
                                      {isPending && pendingActions[device.device_id] === action
                                        ? <RefreshCw className="h-2.5 w-2.5 animate-spin mr-0.5" />
                                        : null}
                                      {action}
                                    </Button>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 border-t border-gray-200">
                  <span className="text-xs text-black">{devices.length} node{devices.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Shutdown confirmation dialog */}
      <Dialog open={!!shutdownTarget} onOpenChange={(open) => !open && setShutdownTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Shutdown node?</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              This will send a shutdown command to{' '}
              <span className="font-mono font-medium text-gray-700">{shutdownTarget?.device_id}</span>.
              The node will stop executing and deregister.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShutdownTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmShutdown}
              disabled={lifecycleMutation.isPending}
            >
              Shutdown
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
