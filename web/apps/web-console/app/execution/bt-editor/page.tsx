'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/apiClient';
import { toast } from '@/components/ui/use-toast';
import {
  Save, Trash2, Download, ZoomIn, ZoomOut, GitBranch,
  CheckCircle2, XCircle, ChevronDown, ChevronRight, Plus,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeType = 'Sequence' | 'Selector' | 'Parallel' | 'Decorator' | 'Action' | 'Condition';

interface BTNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
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

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_WIDTH  = 120;
const NODE_HEIGHT = 40;

const NODE_COLORS: Record<NodeType, { bg: string; border: string; text: string }> = {
  Sequence:  { bg: '#dbeafe', border: '#3b82f6', text: '#1d4ed8' },
  Selector:  { bg: '#ffedd5', border: '#f97316', text: '#c2410c' },
  Parallel:  { bg: '#ede9fe', border: '#8b5cf6', text: '#6d28d9' },
  Decorator: { bg: '#f3f4f6', border: '#6b7280', text: '#374151' },
  Action:    { bg: '#dcfce7', border: '#22c55e', text: '#15803d' },
  Condition: { bg: '#fef9c3', border: '#eab308', text: '#854d0e' },
};

const PALETTE_NODES: { type: NodeType; desc: string }[] = [
  { type: 'Sequence',  desc: 'Children run in order until one fails' },
  { type: 'Selector',  desc: 'Tries children until one succeeds' },
  { type: 'Parallel',  desc: 'Runs all children simultaneously' },
  { type: 'Decorator', desc: 'Wraps a single child with logic' },
  { type: 'Action',    desc: 'Leaf node that performs an action' },
  { type: 'Condition', desc: 'Leaf node that checks a condition' },
];

let _idCounter = 0;
function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${++_idCounter}`;
}

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
  const colors = NODE_COLORS[node.type];
  return (
    <div
      onMouseDown={(e) => { e.stopPropagation(); onDragStart(e); onSelect(); }}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
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
        <div style={{ fontSize: 9, fontWeight: 600, color: colors.text, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {node.type}
        </div>
        <div style={{ fontSize: 10, color: '#374151', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.label}
        </div>
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
      if (!dragging.current) return;
      const dx = (e.clientX - dragging.current.startX) / zoom;
      const dy = (e.clientY - dragging.current.startY) / zoom;
      setNodes((prev) => prev.map((n) =>
        n.id === dragging.current!.id
          ? { ...n, x: Math.max(0, dragging.current!.nodeX + dx), y: Math.max(0, dragging.current!.nodeY + dy) }
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

  const saveMutation = useMutation({
    mutationFn: () => api.post('/v1/bt/definitions', { name: btName, description: '', nodes, edges }),
    onSuccess: () => toast({ title: 'BT saved successfully' }),
    onError: () => toast({ title: 'Save failed', variant: 'destructive' }),
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

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] gap-0">

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
          <Button size="sm" className="h-8 text-xs gap-1.5 bg-gray-900 hover:bg-gray-800 text-white"
            onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
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
          <div className="w-60 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col overflow-y-auto">
            <div className="px-3 py-3 border-b border-gray-200">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Node Palette</p>
              <div className="space-y-1">
                {PALETTE_NODES.map(({ type, desc }) => {
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
              </div>
            </div>

            {templates.length > 0 && (
              <div className="px-3 py-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Templates</p>
                <div className="space-y-1">
                  {templates.slice(0, 4).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setNodes(t.nodes ?? []); setEdges(t.edges ?? []); setBtName(t.name); setSelectedId(null); }}
                      className="w-full px-2 py-2 text-left text-xs rounded-md hover:bg-white border border-transparent hover:border-gray-200 transition-colors"
                    >
                      <p className="font-medium text-gray-700">{t.name}</p>
                      {t.description && <p className="text-[9px] text-gray-400 mt-0.5">{t.description}</p>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Canvas */}
          <div className="flex-1 relative bg-[#fafafa] overflow-hidden" style={{ cursor: connecting ? 'crosshair' : 'default' }}>
            <div
              ref={canvasRef}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', position: 'relative', width: '100%', height: '100%', minHeight: 600 }}
              onDoubleClick={handleCanvasDblClick}
            >
              {/* Grid background */}
              <svg
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
              >
                <defs>
                  <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
                    <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
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
                </div>

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
            <span className="font-medium">Validation</span>
            {validationOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          {validationOpen && (
            <div className="px-4 py-2 flex items-center gap-4 flex-wrap border-t border-gray-100">
              {validationRules.map((rule) => (
                <div key={rule.label} className="flex items-center gap-1.5">
                  {rule.ok
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                    : <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                  <span className={`text-xs ${rule.ok ? 'text-gray-600' : 'text-red-600'}`}>{rule.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
