'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/apiClient';
import { toast } from '@/components/ui/use-toast';
import {
  Save, Trash2, Download, ZoomIn, ZoomOut, GitBranch,
  CheckCircle2, XCircle, ChevronDown, ChevronRight, Plus,
  LayoutGrid, Shield, AlertOctagon,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeType = 'Sequence' | 'Selector' | 'Parallel' | 'Decorator' | 'Action' | 'Condition' | 'RosTopicPublish' | 'RosTopicSubscribe' | 'RosServiceCall';

interface BTNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  rosConfig?: { topic: string; msgType: string; serviceType?: string };
}

interface BTEdge {
  id: string;
  source: string;
  target: string;
}

interface BTTemplate {
  id: string;
  name: string;
  description?: string;
  nodes: BTNode[];
  edges: BTEdge[];
}

interface BTDefinition {
  id: string;
  name: string;
}

interface TopicMapping {
  topic: string;
  msg_type: string;
  direction: 'publish' | 'subscribe';
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_WIDTH  = 120;
const NODE_HEIGHT = 40;

const NODE_COLORS: Record<NodeType, { bg: string; border: string; text: string }> = {
  Sequence:         { bg: '#dbeafe', border: '#3b82f6', text: '#1d4ed8' },
  Selector:         { bg: '#ffedd5', border: '#f97316', text: '#c2410c' },
  Parallel:         { bg: '#ede9fe', border: '#8b5cf6', text: '#6d28d9' },
  Decorator:        { bg: '#f3f4f6', border: '#6b7280', text: '#374151' },
  Action:           { bg: '#dcfce7', border: '#22c55e', text: '#15803d' },
  Condition:        { bg: '#fef9c3', border: '#eab308', text: '#854d0e' },
  // ROS2 nodes — teal palette for easy visual identification
  RosTopicPublish:  { bg: '#ccfbf1', border: '#0d9488', text: '#0f766e' },
  RosTopicSubscribe:{ bg: '#cffafe', border: '#0891b2', text: '#0e7490' },
  RosServiceCall:   { bg: '#e0f2fe', border: '#0284c7', text: '#0369a1' },
};

const PALETTE_NODES: { type: NodeType; desc: string; group?: string }[] = [
  { type: 'Sequence',          desc: 'Children run in order until one fails' },
  { type: 'Selector',          desc: 'Tries children until one succeeds' },
  { type: 'Parallel',          desc: 'Runs all children simultaneously' },
  { type: 'Decorator',         desc: 'Wraps a single child with logic' },
  { type: 'Action',            desc: 'Leaf node that performs an action' },
  { type: 'Condition',         desc: 'Leaf node that checks a condition' },
  // ROS2 nodes
  { type: 'RosTopicPublish',   desc: 'Publish JSON payload to a ROS2 topic',       group: 'ros2' },
  { type: 'RosTopicSubscribe', desc: 'Wait for a message on a ROS2 topic',         group: 'ros2' },
  { type: 'RosServiceCall',    desc: 'Call a ROS2 service and store response',     group: 'ros2' },
];

let _idCounter = 0;
function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${++_idCounter}`;
}

const TYPE_MAP: Record<string, NodeType> = {
  sequence: 'Sequence', selector: 'Selector', parallel: 'Parallel',
  decorator: 'Decorator', action: 'Action', condition: 'Condition',
  rostopicpublish: 'RosTopicPublish', rostopicsubscribe: 'RosTopicSubscribe',
  rosservicecall: 'RosServiceCall',
};
function normalizeType(t: string): NodeType {
  return TYPE_MAP[t?.toLowerCase()] ?? 'Action';
}

// ROS2 node types for visual indicator
const ROS_NODE_TYPES = new Set<NodeType>(['RosTopicPublish', 'RosTopicSubscribe', 'RosServiceCall']);

// ─── Predefined Templates ─────────────────────────────────────────────────────

const PREDEFINED_TEMPLATES: BTTemplate[] = [
  {
    id: 'builtin-patrol',
    name: 'Patrol Route',
    description: 'Sequentially patrol waypoints, check obstacles, return to base',
    nodes: [
      { id: 'p_root', type: 'Sequence', label: 'Patrol Root', x: 180, y: 30 },
      { id: 'p_wp1', type: 'Action', label: 'Goto WP1', x: 40, y: 130 },
      { id: 'p_obs', type: 'Condition', label: 'Clear Path?', x: 180, y: 130 },
      { id: 'p_wp2', type: 'Action', label: 'Goto WP2', x: 320, y: 130 },
      { id: 'p_base', type: 'Action', label: 'Return Base', x: 460, y: 130 },
    ],
    edges: [
      { id: 'pe1', source: 'p_root', target: 'p_wp1' },
      { id: 'pe2', source: 'p_root', target: 'p_obs' },
      { id: 'pe3', source: 'p_root', target: 'p_wp2' },
      { id: 'pe4', source: 'p_root', target: 'p_base' },
    ],
  },
  {
    id: 'builtin-grasp',
    name: 'Grasp Object',
    description: 'Detect object, approach, verify grasp conditions, execute grasp',
    nodes: [
      { id: 'g_sel', type: 'Selector', label: 'Grasp Plan', x: 200, y: 30 },
      { id: 'g_seq', type: 'Sequence', label: 'Grasp Seq', x: 120, y: 130 },
      { id: 'g_fail', type: 'Action', label: 'Fallback', x: 320, y: 130 },
      { id: 'g_det', type: 'Condition', label: 'Obj Detected?', x: 30, y: 230 },
      { id: 'g_app', type: 'Action', label: 'Approach', x: 160, y: 230 },
      { id: 'g_gsp', type: 'Action', label: 'Execute Grasp', x: 290, y: 230 },
    ],
    edges: [
      { id: 'ge1', source: 'g_sel', target: 'g_seq' },
      { id: 'ge2', source: 'g_sel', target: 'g_fail' },
      { id: 'ge3', source: 'g_seq', target: 'g_det' },
      { id: 'ge4', source: 'g_seq', target: 'g_app' },
      { id: 'ge5', source: 'g_seq', target: 'g_gsp' },
    ],
  },
  {
    id: 'builtin-estop',
    name: 'Emergency Stop',
    description: 'Monitor safety conditions, trigger immediate halt on violation',
    nodes: [
      { id: 'es_sel', type: 'Selector', label: 'Safety Monitor', x: 200, y: 30 },
      { id: 'es_ok', type: 'Condition', label: 'All Clear?', x: 80, y: 130 },
      { id: 'es_stop', type: 'Action', label: 'EMERGENCY STOP', x: 290, y: 130 },
    ],
    edges: [
      { id: 'ese1', source: 'es_sel', target: 'es_ok' },
      { id: 'ese2', source: 'es_sel', target: 'es_stop' },
    ],
  },
  {
    id: 'builtin-ros-nav',
    name: 'ROS2 Navigation',
    description: 'Publish goal pose via ROS2 topic, wait for nav completion',
    nodes: [
      { id: 'rn_seq', type: 'Sequence', label: 'Nav Sequence', x: 180, y: 30 },
      { id: 'rn_pub', type: 'RosTopicPublish', label: 'Publish Goal', x: 60, y: 130, rosConfig: { topic: '/goal_pose', msgType: 'geometry_msgs/PoseStamped' } },
      { id: 'rn_sub', type: 'RosTopicSubscribe', label: 'Wait Result', x: 220, y: 130, rosConfig: { topic: '/nav/result', msgType: 'nav2_msgs/NavigateToPoseAction' } },
      { id: 'rn_ok', type: 'Condition', label: 'Nav Success?', x: 380, y: 130 },
    ],
    edges: [
      { id: 'rne1', source: 'rn_seq', target: 'rn_pub' },
      { id: 'rne2', source: 'rn_seq', target: 'rn_sub' },
      { id: 'rne3', source: 'rn_seq', target: 'rn_ok' },
    ],
  },
];

// ─── Validation ───────────────────────────────────────────────────────────────

function validateGraph(nodes: BTNode[], edges: BTEdge[]) {
  const rootCandidates = nodes.filter((n) => !edges.some((e) => e.target === n.id));
  const rootOk = rootCandidates.length > 0 && ['Sequence', 'Selector'].includes(rootCandidates[0]?.type);

  const leafTypes: NodeType[] = ['Action', 'Condition'];
  const actionLeafOk = nodes
    .filter((n) => leafTypes.includes(n.type))
    .every((n) => !edges.some((e) => e.source === n.id));

  // Cycle detection via DFS
  const adj: Record<string, string[]> = {};
  nodes.forEach((n) => { adj[n.id] = []; });
  edges.forEach((e) => { adj[e.source]?.push(e.target); });
  const visited = new Set<string>();
  const stack = new Set<string>();
  let hasCycle = false;
  function dfs(id: string) {
    if (stack.has(id)) { hasCycle = true; return; }
    if (visited.has(id)) return;
    visited.add(id); stack.add(id);
    adj[id]?.forEach(dfs);
    stack.delete(id);
  }
  nodes.forEach((n) => dfs(n.id));

  const isConnected = nodes.length === 0 || visited.size === nodes.length;

  return [
    { label: 'Root must be Sequence or Selector', ok: rootOk },
    { label: 'Action/Condition nodes must be leaves', ok: actionLeafOk },
    { label: 'No cycles detected', ok: !hasCycle },
    { label: 'Graph is connected', ok: isConnected },
  ];
}

function validateEnvelope(
  nodes: BTNode[],
  edges: BTEdge[],
  policies: { max_action_nodes?: number; max_depth?: number; allowed_node_types?: string[] } | null | undefined,
) {
  if (!policies) return [];
  const results: { label: string; ok: boolean }[] = [];
  if (policies.max_depth != null) {
    // compute actual max depth via BFS from root nodes
    const childMap: Record<string, string[]> = {};
    nodes.forEach((n) => { childMap[n.id] = []; });
    edges.forEach((e) => { childMap[e.source]?.push(e.target); });
    const roots = nodes.filter((n) => !edges.some((e) => e.target === n.id));
    let maxObservedDepth = 0;
    const queue: { id: string; depth: number }[] = roots.map((r) => ({ id: r.id, depth: 0 }));
    while (queue.length) {
      const { id, depth } = queue.shift()!;
      if (depth > maxObservedDepth) maxObservedDepth = depth;
      (childMap[id] ?? []).forEach((cid) => queue.push({ id: cid, depth: depth + 1 }));
    }
    results.push({
      label: `Tree depth \u2264 ${policies.max_depth} (current: ${maxObservedDepth})`,
      ok: maxObservedDepth <= policies.max_depth,
    });
  }
  if (policies.max_action_nodes != null) {
    const count = nodes.filter((n) => n.type === 'Action').length;
    results.push({ label: `Action nodes \u2264 ${policies.max_action_nodes} (current: ${count})`, ok: count <= policies.max_action_nodes });
  }
  if (policies.allowed_node_types?.length) {
    const forbidden = nodes.filter((n) => !policies.allowed_node_types!.includes(n.type));
    results.push({ label: 'Only allowed node types used', ok: forbidden.length === 0 });
  }
  return results;
}

// ─── Node Box ─────────────────────────────────────────────────────────────────

function NodeBox({
  node,
  selected,
  onSelect,
  onDragStart,
}: {
  node: BTNode;
  selected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.MouseEvent) => void;
}) {
  const colors = NODE_COLORS[node.type] ?? NODE_COLORS['Action'];
  return (
    <div
      onMouseDown={(e) => { e.stopPropagation(); onDragStart(e); onSelect(); }}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        height: node.rosConfig?.topic ? NODE_HEIGHT + 14 : NODE_HEIGHT,
        background: colors.bg,
        border: `2px solid ${selected ? '#111' : colors.border}`,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'grab',
        userSelect: 'none',
        boxShadow: selected ? '0 0 0 2px rgba(0,0,0,0.15)' : 'none',
        zIndex: selected ? 10 : 1,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: colors.text, letterSpacing: '0.04em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
          {ROS_NODE_TYPES.has(node.type) && (
            <span style={{ background: '#0d9488', color: '#fff', fontSize: 7, fontWeight: 700, padding: '0 3px', borderRadius: 3 }}>ROS</span>
          )}
          {node.type}
        </div>
        <div style={{ fontSize: 10, color: '#374151', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.label}
        </div>
        {node.rosConfig?.topic && (
          <div style={{ fontSize: 8, color: '#0f766e', maxWidth: 108, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', marginTop: 1, opacity: 0.85 }}>
            {node.rosConfig.topic}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SVG Edges ────────────────────────────────────────────────────────────────

function EdgeLayer({ nodes, edges }: { nodes: BTNode[]; edges: BTEdge[] }) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return (
    <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
      {edges.map((e) => {
        const src = nodeMap.get(e.source);
        const tgt = nodeMap.get(e.target);
        if (!src || !tgt) return null;
        const x1 = src.x + NODE_WIDTH / 2;
        const y1 = src.y + NODE_HEIGHT;
        const x2 = tgt.x + NODE_WIDTH / 2;
        const y2 = tgt.y;
        const cy = (y1 + y2) / 2;
        const d = `M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`;
        return (
          <path key={e.id} d={d} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="none" />
        );
      })}
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BTEditorPage() {
  const [nodes, setNodes] = useState<BTNode[]>([
    { id: 'root_1', type: 'Sequence', label: 'Root', x: 220, y: 40 },
    { id: 'act_1',  type: 'Action',   label: 'Action 1', x: 80,  y: 160 },
    { id: 'act_2',  type: 'Action',   label: 'Action 2', x: 250, y: 160 },
    { id: 'cond_1', type: 'Condition', label: 'Check 1', x: 420, y: 160 },
  ]);
  const [edges, setEdges] = useState<BTEdge[]>([
    { id: 'e1', source: 'root_1', target: 'act_1' },
    { id: 'e2', source: 'root_1', target: 'act_2' },
    { id: 'e3', source: 'root_1', target: 'cond_1' },
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectSource, setConnectSource] = useState<string | null>(null);
  const [btName, setBtName] = useState('Untitled BT');
  const [zoom, setZoom] = useState(1);
  const [validationOpen, setValidationOpen] = useState(true);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ id: string; startX: number; startY: number; nodeX: number; nodeY: number } | null>(null);

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  // ── Drag ──
  const handleDragStart = useCallback((e: React.MouseEvent, nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    dragging.current = { id: nodeId, startX: e.clientX, startY: e.clientY, nodeX: node.x, nodeY: node.y };
  }, [nodes]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragging.current;
      if (!d) return;
      const dx = (e.clientX - d.startX) / zoom;
      const dy = (e.clientY - d.startY) / zoom;
      setNodes((prev) => prev.map((n) =>
        n.id === d.id
          ? { ...n, x: Math.max(0, d.nodeX + dx), y: Math.max(0, d.nodeY + dy) }
          : n,
      ));
    };
    const onUp = () => { dragging.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [zoom]);

  // ── Double-click canvas to add node ──
  const handleCanvasDblClick = useCallback((e: React.MouseEvent) => {
    if (e.target !== canvasRef.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom - NODE_WIDTH / 2;
    const y = (e.clientY - rect.top) / zoom - NODE_HEIGHT / 2;
    const id = genId('action');
    setNodes((prev) => [...prev, { id, type: 'Action', label: 'New Action', x: Math.max(0, x), y: Math.max(0, y) }]);
    setSelectedId(id);
  }, [zoom]);

  // ── Palette drop ──
  const addFromPalette = (type: NodeType) => {
    const id = genId(type.toLowerCase());
    setNodes((prev) => [...prev, { id, type, label: type, x: 100 + Math.random() * 200, y: 80 + Math.random() * 100 }]);
    setSelectedId(id);
  };

  // ── Connect ──
  const handleNodeClickForConnect = (nodeId: string) => {
    if (!connecting) return;
    if (!connectSource) { setConnectSource(nodeId); return; }
    if (connectSource !== nodeId) {
      const id = genId('edge');
      setEdges((prev) => [...prev, { id, source: connectSource, target: nodeId }]);
    }
    setConnecting(false);
    setConnectSource(null);
  };

  // ── Delete node ──
  const deleteSelected = () => {
    if (!selectedId) return;
    setNodes((prev) => prev.filter((n) => n.id !== selectedId));
    setEdges((prev) => prev.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  };

  // ── Update selected node prop ──
  const updateSelected = (patch: Partial<BTNode>) => {
    if (!selectedId) return;
    setNodes((prev) => prev.map((n) => n.id === selectedId ? { ...n, ...patch } : n));
  };

  // ── Templates ──
  const { data: templates = [] } = useQuery<BTTemplate[]>({
    queryKey: ['bt-templates'],
    queryFn: async () => {
      try { return await api.get<BTTemplate[]>('/v1/bt/templates'); }
      catch { return []; }
    },
    staleTime: 60_000,
    retry: false,
  });

  const allTemplates = [...PREDEFINED_TEMPLATES, ...templates];

  const loadTemplate = (t: BTTemplate) => {
    setNodes((t.nodes ?? []).map((n) => ({ ...n, type: normalizeType(n.type) })));
    setEdges(t.edges ?? []);
    setBtName(t.name);
    setSelectedId(null);
  };

  // ── Saved definitions ──
  const { data: definitions = [] } = useQuery<BTDefinition[]>({
    queryKey: ['bt-definitions'],
    queryFn: async () => {
      try { return await api.get<BTDefinition[]>('/v1/bt/definitions'); }
      catch { return []; }
    },
    staleTime: 30_000,
    retry: false,
  });

  // ── Policies (envelope validation) ──
  const { data: policies } = useQuery({
    queryKey: ['bt-policies'],
    queryFn: async () => {
      try { return await api.get<{ max_action_nodes?: number; max_depth?: number; allowed_node_types?: string[] }>('/v1/policies'); }
      catch { return null; }
    },
    staleTime: 60_000,
    retry: false,
  });

  // ── ROS topics ──
  const { data: rosTopics = [] } = useQuery<TopicMapping[]>({
    queryKey: ['ros-topics'],
    queryFn: async () => {
      try { return await api.get<TopicMapping[]>('/v1/ros/topics'); }
      catch { return []; }
    },
    staleTime: 30_000,
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const envelopeRules = validateEnvelope(nodes, edges, policies);
      const failing = envelopeRules.filter((r) => !r.ok);
      if (failing.length > 0) {
        throw new Error(`Policy violation: ${failing.map((r) => r.label).join('; ')}`);
      }
      return api.post('/v1/bt/definitions', { name: btName, description: '', nodes, edges });
    },
    onSuccess: () => toast({ title: 'BT saved successfully' }),
    onError: (err: Error) => toast({ title: err.message ?? 'Save failed', variant: 'destructive' }),
  });

  const loadDefinition = async (id: string) => {
    try {
      const def = await api.get<{ name: string; nodes: BTNode[]; edges: BTEdge[] }>(`/v1/bt/definitions/${id}`);
      setNodes(def.nodes ?? []);
      setEdges(def.edges ?? []);
      setBtName(def.name);
      setSelectedId(null);
    } catch {
      toast({ title: 'Load failed', variant: 'destructive' });
    }
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ name: btName, nodes, edges }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${btName.replace(/\s+/g, '-').toLowerCase()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const validationRules = validateGraph(nodes, edges);
  const envelopeRules = validateEnvelope(nodes, edges, policies);
  const hasEnvelopeViolation = envelopeRules.some((r) => !r.ok);

  // ── ROS topic dropdown helpers ──
  const currentTopicIsKnown = rosTopics.some((t) => t.topic === (selectedNode?.rosConfig?.topic ?? ''));
  const rosTopicSelectValue = rosTopics.length > 0
    ? (currentTopicIsKnown ? (selectedNode?.rosConfig?.topic ?? '') : (selectedNode?.rosConfig?.topic ? 'custom' : ''))
    : 'custom';

  return (
    <DashboardLayout fullWidth>
      <div className="flex flex-col h-[calc(100vh-4rem)] gap-0">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 pb-4">
          <h1 className="text-base font-semibold text-gray-900">BT Editor</h1>
          <p className="text-xs text-black mt-0.5">
            Visual behavior tree designer. Double-click the canvas to add nodes, drag to reposition.
          </p>
        </div>

        {/* ── Editor Card ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 border border-gray-200 shadow rounded-3xl overflow-hidden flex flex-col">

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white flex-shrink-0">
          <input
            value={btName}
            onChange={(e) => setBtName(e.target.value)}
            className="h-8 text-xs border border-gray-200 rounded-md px-2 w-48 outline-none focus:border-gray-400"
            placeholder="BT name…"
          />
          {definitions.length > 0 && (
            <select
              className="h-8 text-xs border border-gray-200 rounded-md px-2 outline-none focus:border-gray-400 bg-white"
              defaultValue=""
              onChange={(e) => { if (e.target.value) loadDefinition(e.target.value); }}
            >
              <option value="" disabled>Load saved…</option>
              {definitions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
          <div className="relative">
            <Button
              size="sm"
              className={`h-8 text-xs gap-1.5 ${hasEnvelopeViolation ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-900 hover:bg-gray-800 text-white'}`}
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              title={hasEnvelopeViolation ? `Policy violation: ${envelopeRules.filter((r) => !r.ok).map((r) => r.label).join('; ')}` : undefined}
            >
              {hasEnvelopeViolation
                ? <AlertOctagon className="h-3.5 w-3.5" />
                : <Save className="h-3.5 w-3.5" />}
              {hasEnvelopeViolation ? 'Policy violation' : 'Save'}
            </Button>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={exportJSON}>
            <Download className="h-3.5 w-3.5" /> Export JSON
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"
            onClick={() => { setNodes([]); setEdges([]); setSelectedId(null); }}>
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </Button>
          <div className="flex items-center gap-1 ml-auto">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0"
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}>
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-gray-500 tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0"
              onClick={() => setZoom((z) => Math.min(2, z + 0.1))}>
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Main area */}
        <div className="flex flex-1 min-h-0">

          {/* Left panel */}
          <div className="w-60 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-y-auto">
            <div className="px-3 py-3 border-b border-gray-200">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Node Palette</p>
              <div className="space-y-1">
                {/* Standard nodes */}
                {PALETTE_NODES.filter((p) => !p.group).map(({ type, desc }) => {
                  const colors = NODE_COLORS[type];
                  return (
                    <button
                      key={type}
                      onClick={() => addFromPalette(type)}
                      className="w-full flex items-start gap-2 px-2 py-2 rounded-md hover:bg-white border border-transparent hover:border-gray-200 transition-colors text-left"
                    >
                      <span
                        style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}
                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                      >
                        {type.slice(0, 3).toUpperCase()}
                      </span>
                      <div>
                        <p className="text-xs font-medium text-gray-700">{type}</p>
                        <p className="text-[9px] text-gray-400 leading-tight">{desc}</p>
                      </div>
                    </button>
                  );
                })}
                {/* ROS2 nodes */}
                <div className="pt-2 pb-1">
                  <p className="text-[9px] font-semibold text-teal-600 uppercase tracking-wide flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-500" />
                    ROS2
                  </p>
                </div>
                {PALETTE_NODES.filter((p) => p.group === 'ros2').map(({ type, desc }) => {
                  const colors = NODE_COLORS[type];
                  return (
                    <button
                      key={type}
                      onClick={() => addFromPalette(type)}
                      className="w-full flex items-start gap-2 px-2 py-2 rounded-md hover:bg-white border border-transparent hover:border-teal-200 transition-colors text-left"
                    >
                      <span
                        style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}
                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                      >
                        ROS
                      </span>
                      <div>
                        <p className="text-xs font-medium text-gray-700">{type}</p>
                        <p className="text-[9px] text-gray-400 leading-tight">{desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Templates section — always visible */}
            <div className="px-3 py-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                <LayoutGrid className="h-3 w-3" />
                Templates
              </p>
              <div className="space-y-1">
                {allTemplates.map((t) => {
                  const isBuiltin = PREDEFINED_TEMPLATES.some((p) => p.id === t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => loadTemplate(t)}
                      className="w-full px-2 py-2 text-left rounded-md hover:bg-white border border-transparent hover:border-gray-200 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-medium text-gray-700 flex-1 truncate">{t.name}</p>
                        {isBuiltin && (
                          <span className="text-[8px] font-semibold px-1 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200 flex-shrink-0">
                            Built-in
                          </span>
                        )}
                      </div>
                      {t.description && (
                        <p className="text-[9px] text-gray-400 mt-0.5 leading-tight line-clamp-2">{t.description}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 relative bg-gray-50 overflow-hidden" style={{ cursor: connecting ? 'crosshair' : 'default' }}>
            <div
              ref={canvasRef}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', position: 'relative', width: '100%', height: '100%', minHeight: 600 }}
              onDoubleClick={handleCanvasDblClick}
            >
              {/* Dot grid background */}
              <svg
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
              >
                <defs>
                  <pattern id="dotgrid" width="24" height="24" patternUnits="userSpaceOnUse">
                    <circle cx="0.5" cy="0.5" r="1" fill="#d1d5db" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dotgrid)" />
              </svg>

              <EdgeLayer nodes={nodes} edges={edges} />

              {nodes.map((node) => (
                <div
                  key={node.id}
                  onClick={() => handleNodeClickForConnect(node.id)}
                >
                  <NodeBox
                    node={node}
                    selected={selectedId === node.id}
                    onSelect={() => setSelectedId(node.id)}
                    onDragStart={(e) => handleDragStart(e, node.id)}
                  />
                </div>
              ))}

              {nodes.length === 0 && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <GitBranch className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">Double-click to add a node, or drag from the palette</p>
                </div>
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className="w-[280px] flex-shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-y-auto">
            {selectedNode ? (
              <div className="p-4 space-y-4">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Node Properties</p>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Label</label>
                  <input
                    value={selectedNode.label}
                    onChange={(e) => updateSelected({ label: e.target.value })}
                    className="w-full h-8 text-xs border border-gray-200 rounded-md px-2 outline-none focus:border-gray-400"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Type</label>
                  <div
                    style={{ background: NODE_COLORS[selectedNode.type].bg, color: NODE_COLORS[selectedNode.type].text, border: `1px solid ${NODE_COLORS[selectedNode.type].border}` }}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                  >
                    {selectedNode.type}
                  </div>
                  {policies?.allowed_node_types && !policies.allowed_node_types.includes(selectedNode.type) && (
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-red-50 border border-red-200 text-[10px] text-red-700 mt-1">
                      <AlertOctagon className="h-3 w-3 flex-shrink-0" />
                      This node type is forbidden by current policy
                    </div>
                  )}
                </div>

                {ROS_NODE_TYPES.has(selectedNode.type) && (
                  <div className="space-y-2 p-2 rounded-md bg-teal-50 border border-teal-100">
                    <p className="text-[10px] font-semibold text-teal-700 uppercase tracking-wide">ROS Config</p>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Topic / Service Name</label>
                      {rosTopics.length > 0 ? (
                        <div className="space-y-1.5">
                          <select
                            value={rosTopicSelectValue}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || val === 'custom') {
                                // keep existing topic text, don't overwrite
                                updateSelected({
                                  rosConfig: {
                                    ...selectedNode.rosConfig,
                                    topic: val === 'custom' ? (selectedNode.rosConfig?.topic ?? '') : '',
                                    msgType: selectedNode.rosConfig?.msgType ?? '',
                                  },
                                });
                              } else {
                                const match = rosTopics.find((t) => t.topic === val);
                                updateSelected({
                                  rosConfig: {
                                    ...selectedNode.rosConfig,
                                    topic: val,
                                    msgType: match?.msg_type ?? selectedNode.rosConfig?.msgType ?? '',
                                  },
                                });
                              }
                            }}
                            className="w-full h-8 text-xs border border-teal-200 rounded-md px-2 outline-none focus:border-teal-400 bg-white font-mono"
                          >
                            <option value="">Select topic…</option>
                            {rosTopics.map((t) => (
                              <option key={t.topic} value={t.topic}>
                                {t.topic} ({t.direction})
                              </option>
                            ))}
                            <option value="custom">Custom…</option>
                          </select>
                          {(rosTopicSelectValue === 'custom' || (!currentTopicIsKnown && (selectedNode.rosConfig?.topic ?? '') !== '')) && (
                            <input
                              value={selectedNode.rosConfig?.topic ?? ''}
                              onChange={(e) => updateSelected({ rosConfig: { ...selectedNode.rosConfig, topic: e.target.value, msgType: selectedNode.rosConfig?.msgType ?? '' } })}
                              placeholder="/cmd_vel or /robot/navigate"
                              className="w-full h-8 text-xs border border-teal-200 rounded-md px-2 outline-none focus:border-teal-400 font-mono"
                            />
                          )}
                        </div>
                      ) : (
                        <input
                          value={selectedNode.rosConfig?.topic ?? ''}
                          onChange={(e) => updateSelected({ rosConfig: { ...selectedNode.rosConfig, topic: e.target.value, msgType: selectedNode.rosConfig?.msgType ?? '' } })}
                          placeholder="/cmd_vel or /robot/navigate"
                          className="w-full h-8 text-xs border border-teal-200 rounded-md px-2 outline-none focus:border-teal-400 font-mono"
                        />
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Message Type</label>
                      <input
                        value={selectedNode.rosConfig?.msgType ?? ''}
                        onChange={(e) => updateSelected({ rosConfig: { ...selectedNode.rosConfig, topic: selectedNode.rosConfig?.topic ?? '', msgType: e.target.value } })}
                        placeholder="geometry_msgs/Twist"
                        className="w-full h-8 text-xs border border-teal-200 rounded-md px-2 outline-none focus:border-teal-400 font-mono"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">X</label>
                    <input
                      type="number"
                      value={Math.round(selectedNode.x)}
                      onChange={(e) => updateSelected({ x: Number(e.target.value) })}
                      className="w-full h-8 text-xs border border-gray-200 rounded-md px-2 outline-none focus:border-gray-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Y</label>
                    <input
                      type="number"
                      value={Math.round(selectedNode.y)}
                      onChange={(e) => updateSelected({ y: Number(e.target.value) })}
                      className="w-full h-8 text-xs border border-gray-200 rounded-md px-2 outline-none focus:border-gray-400"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Button
                    variant="outline" size="sm"
                    className={`w-full h-8 text-xs gap-1.5 ${connecting && connectSource === selectedId ? 'border-blue-400 text-blue-700 bg-blue-50' : ''}`}
                    onClick={() => {
                      if (connecting && connectSource === selectedId) {
                        setConnecting(false); setConnectSource(null);
                      } else {
                        setConnecting(true); setConnectSource(selectedId);
                      }
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {connecting && connectSource === selectedId ? 'Click target node…' : 'Connect to…'}
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="w-full h-8 text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={deleteSelected}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete Node
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center">
                <p className="text-xs text-gray-400 mt-8">Click a node to see its properties</p>
              </div>
            )}
          </div>
        </div>

        {/* Validation panel */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-white">
          <button
            onClick={() => setValidationOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <span className="font-medium flex items-center gap-1.5">
              Validation
              {hasEnvelopeViolation && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-600 border border-red-200">
                  <Shield className="h-2.5 w-2.5" /> Policy
                </span>
              )}
            </span>
            {validationOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          {validationOpen && (
            <div className="px-4 py-2 border-t border-gray-100 space-y-2">
              {/* Graph Rules */}
              <div>
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Graph Rules</p>
                <div className="flex items-center gap-4 flex-wrap">
                  {validationRules.map((rule) => (
                    <div key={rule.label} className="flex items-center gap-1.5">
                      {rule.ok
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                        : <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                      <span className={`text-xs ${rule.ok ? 'text-gray-600' : 'text-red-600'}`}>{rule.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {envelopeRules.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <Shield className="h-2.5 w-2.5" /> Policy Envelope
                    </p>
                    <div className="flex items-center gap-4 flex-wrap">
                      {envelopeRules.map((rule) => (
                        <div key={rule.label} className="flex items-center gap-1.5">
                          {rule.ok
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                            : <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                          <span className={`text-xs ${rule.ok ? 'text-gray-600' : 'text-red-600'}`}>{rule.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        </div>{/* end editor card */}
      </div>
    </DashboardLayout>
  );
}
