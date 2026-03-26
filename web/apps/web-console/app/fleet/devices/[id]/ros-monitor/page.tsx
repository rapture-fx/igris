'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/apiClient';
import { toast } from '@/components/ui/use-toast';
import { getRelativeTime } from '@/utils/helpers';
import { ArrowLeft, Radio, Send, RefreshCw, Wifi, WifiOff } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiscoveredTopic {
  name: string;
  kind: 'topic' | 'service';
  msg_type: string;
  direction: 'pub' | 'sub' | 'srv' | 'unknown';
  last_seen_at?: string;
}

interface DiscoveryResponse {
  machine_id: string;
  topics: DiscoveredTopic[];
  count: number;
}

interface PublishForm {
  topic: string;
  msg_type: string;
  payload: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RosMonitorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [publishForm, setPublishForm] = useState<PublishForm>({
    topic: '/cmd_vel',
    msg_type: 'geometry_msgs/Twist',
    payload: JSON.stringify({ linear: { x: 0, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0 } }, null, 2),
  });
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  // ── Discovery query ──
  const { data: discovery, isLoading, dataUpdatedAt } = useQuery<DiscoveryResponse>({
    queryKey: ['ros-discovery', id],
    queryFn: async () => {
      try {
        return await api.get<DiscoveryResponse>(`/v1/ros/discovery?machine_id=${encodeURIComponent(id ?? '')}`);
      } catch {
        return { machine_id: id ?? '', topics: [], count: 0 };
      }
    },
    refetchInterval: 10_000,
    retry: false,
    enabled: !!id,
  });

  const isStale = dataUpdatedAt > 0 && Date.now() - dataUpdatedAt > 30_000;
  const topics = discovery?.topics ?? [];
  const topicEntries = topics.filter((t) => t.kind === 'topic');
  const serviceEntries = topics.filter((t) => t.kind === 'service');

  // ── Publish mutation ──
  const publishMutation = useMutation({
    mutationFn: async (form: PublishForm) => {
      let payload: unknown;
      try { payload = JSON.parse(form.payload); } catch {
        throw new Error('Payload is not valid JSON');
      }
      return api.post('/v1/ros/publish', {
        device_id: id,
        topic: form.topic,
        message_type: form.msg_type,
        payload,
      });
    },
    onSuccess: () => {
      toast({ title: 'Message queued', description: `Will be sent to ${publishForm.topic} on next heartbeat` });
    },
    onError: (e: Error) => {
      toast({ title: 'Publish failed', description: e.message, variant: 'destructive' });
    },
  });

  // Populate publish form from selected topic
  const selectTopic = (t: DiscoveredTopic) => {
    setSelectedTopic(t.name);
    setPublishForm((prev) => ({
      ...prev,
      topic: t.name,
      msg_type: t.msg_type,
      payload: getDefaultPayload(t.msg_type),
    }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-4xl">

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
              <Radio className="h-4 w-4 text-teal-600" />
              ROS2 Monitor
            </h1>
            <p className="text-xs text-gray-500 font-mono truncate mt-0.5">{id}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => qc.invalidateQueries({ queryKey: ['ros-discovery', id] })}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          {isStale ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
              <WifiOff className="h-3 w-3" /> Stale
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
              <Wifi className="h-3 w-3" /> Live
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Topics list */}
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-800">Discovered Topics</h2>
              <span className="text-xs text-gray-400">{topicEntries.length} topics</span>
            </div>
            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-4 py-3">
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ))
              ) : topicEntries.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-gray-400">
                  No topics discovered yet. Topics appear after the runtime reports them.
                </div>
              ) : (
                topicEntries.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => selectTopic(t)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                      selectedTopic === t.name ? 'bg-teal-50 border-l-2 border-teal-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono text-gray-800 truncate">{t.name}</span>
                      <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                        t.direction === 'pub'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {t.direction === 'pub' ? 'PUB' : 'SUB'}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">{t.msg_type}</p>
                    {t.last_seen_at && (
                      <p className="text-[10px] text-gray-300 mt-0.5">{getRelativeTime(t.last_seen_at)}</p>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Services section */}
            {serviceEntries.length > 0 && (
              <>
                <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Services</p>
                </div>
                <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {serviceEntries.map((s) => (
                    <div key={s.name} className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-800">{s.name}</span>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">{s.msg_type}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Publish test panel */}
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-medium text-gray-800 flex items-center gap-2">
                <Send className="h-4 w-4 text-teal-600" />
                Publish Test Message
              </h2>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Message is queued and delivered on the runtime's next heartbeat.
              </p>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Topic</label>
                <input
                  value={publishForm.topic}
                  onChange={(e) => setPublishForm((p) => ({ ...p, topic: e.target.value }))}
                  className="w-full h-8 text-xs font-mono border border-gray-200 rounded-md px-2 outline-none focus:border-teal-400"
                  placeholder="/cmd_vel"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Message Type</label>
                <input
                  value={publishForm.msg_type}
                  onChange={(e) => setPublishForm((p) => ({ ...p, msg_type: e.target.value }))}
                  className="w-full h-8 text-xs font-mono border border-gray-200 rounded-md px-2 outline-none focus:border-teal-400"
                  placeholder="geometry_msgs/Twist"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Payload (JSON)</label>
                <textarea
                  value={publishForm.payload}
                  onChange={(e) => setPublishForm((p) => ({ ...p, payload: e.target.value }))}
                  rows={8}
                  className="w-full text-xs font-mono border border-gray-200 rounded-md p-2 outline-none focus:border-teal-400 resize-none"
                  placeholder='{"linear": {"x": 0.5}}'
                />
              </div>

              {/* Payload size envelope indicator */}
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-mono ${
                  publishForm.payload.length > 60000 ? 'text-red-500' : 'text-gray-400'
                }`}>
                  {publishForm.payload.length.toLocaleString()} / 65,536 bytes
                </span>
                {publishForm.payload.length > 65536 && (
                  <span className="text-[10px] text-red-500 font-medium">Exceeds 64 KiB limit</span>
                )}
              </div>

              <Button
                className="w-full h-9 text-sm gap-2 bg-teal-600 hover:bg-teal-700 text-white"
                onClick={() => publishMutation.mutate(publishForm)}
                disabled={publishMutation.isPending || publishForm.topic === '' || publishForm.payload.length > 65536}
              >
                <Send className="h-4 w-4" />
                {publishMutation.isPending ? 'Queuing…' : 'Send Message'}
              </Button>

              {/* Quick presets */}
              <div className="pt-2 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 mb-2 font-semibold uppercase tracking-wide">Quick presets</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setPublishForm({ topic: preset.topic, msg_type: preset.msg_type, payload: JSON.stringify(preset.payload, null, 2) })}
                      className="text-[10px] px-2 py-1 rounded border border-teal-200 text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors font-medium"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDefaultPayload(msgType: string): string {
  const defaults: Record<string, unknown> = {
    'geometry_msgs/Twist': { linear: { x: 0, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0 } },
    'geometry_msgs/msg/Twist': { linear: { x: 0, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0 } },
    'std_msgs/String': { data: '' },
    'std_msgs/msg/String': { data: '' },
    'std_msgs/Bool': { data: false },
    'std_msgs/Int32': { data: 0 },
  };
  const payload = defaults[msgType] ?? {};
  return JSON.stringify(payload, null, 2);
}

const QUICK_PRESETS = [
  {
    label: 'Move Forward',
    topic: '/cmd_vel',
    msg_type: 'geometry_msgs/Twist',
    payload: { linear: { x: 0.5, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0 } },
  },
  {
    label: 'Stop',
    topic: '/cmd_vel',
    msg_type: 'geometry_msgs/Twist',
    payload: { linear: { x: 0, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0 } },
  },
  {
    label: 'Turn Left',
    topic: '/cmd_vel',
    msg_type: 'geometry_msgs/Twist',
    payload: { linear: { x: 0, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0.5 } },
  },
  {
    label: 'Turn Right',
    topic: '/cmd_vel',
    msg_type: 'geometry_msgs/Twist',
    payload: { linear: { x: 0, y: 0, z: 0 }, angular: { x: 0, y: 0, z: -0.5 } },
  },
];
