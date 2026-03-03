'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

type DiffKind = 'added' | 'removed' | 'changed' | 'unchanged';

interface DiffRow {
  key: string;
  before?: unknown;
  after?: unknown;
  kind: DiffKind;
}

function computeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): DiffRow[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const rows: DiffRow[] = [];

  for (const key of keys) {
    const inBefore = key in before;
    const inAfter  = key in after;

    if (!inBefore) {
      rows.push({ key, after: after[key], kind: 'added' });
    } else if (!inAfter) {
      rows.push({ key, before: before[key], kind: 'removed' });
    } else if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      rows.push({ key, before: before[key], after: after[key], kind: 'changed' });
    } else {
      rows.push({ key, before: before[key], after: after[key], kind: 'unchanged' });
    }
  }

  const order: Record<DiffKind, number> = { changed: 0, added: 1, removed: 2, unchanged: 3 };
  return rows.sort((a, b) => order[a.kind] - order[b.kind]);
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

const KIND_STYLES: Record<DiffKind, { row: string; before: string; after: string; pill: string; label: string }> = {
  added:     { row: 'bg-green-50',  before: 'text-gray-300', after:  'text-green-700 font-medium', pill: 'bg-green-100 text-green-700',  label: '+' },
  removed:   { row: 'bg-red-50',    before: 'text-red-700 line-through', after: 'text-gray-300',   pill: 'bg-red-100 text-red-700',     label: '−' },
  changed:   { row: 'bg-amber-50',  before: 'text-red-600 line-through', after: 'text-green-700 font-medium', pill: 'bg-amber-100 text-amber-700', label: '~' },
  unchanged: { row: '',             before: 'text-gray-500', after:  'text-gray-500',               pill: 'bg-gray-100 text-gray-400',   label: '=' },
};

interface DiffViewerProps {
  before: Record<string, unknown> | null | undefined;
  after:  Record<string, unknown> | null | undefined;
  beforeLabel?: string;
  afterLabel?:  string;
  /** Hide rows where nothing changed. Default true. */
  hideUnchanged?: boolean;
}

export function DiffViewer({
  before,
  after,
  beforeLabel = 'before',
  afterLabel  = 'after',
  hideUnchanged = true,
}: DiffViewerProps) {
  const [showUnchanged, setShowUnchanged] = useState(false);

  const rows = useMemo(() => {
    if (!before && !after) return [];
    return computeDiff(before ?? {}, after ?? {});
  }, [before, after]);

  const hasChanges = rows.some((r) => r.kind !== 'unchanged');
  const visible = hideUnchanged && !showUnchanged
    ? rows.filter((r) => r.kind !== 'unchanged')
    : rows;
  const unchangedCount = rows.filter((r) => r.kind === 'unchanged').length;

  if (!rows.length) {
    return <div className="text-xs text-gray-400 py-2">no data to diff</div>;
  }

  if (!hasChanges) {
    return (
      <div className="text-xs text-gray-400 py-2 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
        no changes detected
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden text-[11px]">
      {/* Column headers */}
      <div className="grid grid-cols-[18px_1fr_1fr_1fr] bg-gray-50 border-b border-gray-200">
        <div className="px-2 py-1.5 text-gray-400" />
        <div className="px-2 py-1.5 text-gray-500 font-medium">key</div>
        <div className="px-2 py-1.5 text-gray-400">{beforeLabel}</div>
        <div className="px-2 py-1.5 text-gray-400">{afterLabel}</div>
      </div>

      {visible.map((row) => {
        const s = KIND_STYLES[row.kind];
        return (
          <div
            key={row.key}
            className={`grid grid-cols-[18px_1fr_1fr_1fr] border-b border-gray-100 last:border-0 ${s.row}`}
          >
            {/* Kind indicator */}
            <div className="flex items-center justify-center py-1.5 text-[10px] select-none">
              <span className={`px-0.5 rounded text-[9px] ${s.pill}`}>{s.label}</span>
            </div>
            {/* Key */}
            <div className="px-2 py-1.5 text-gray-700 truncate">{row.key}</div>
            {/* Before */}
            <div className={`px-2 py-1.5 break-all leading-relaxed ${s.before}`}>
              {row.kind === 'added' ? <span className="text-gray-300">—</span> : fmt(row.before)}
            </div>
            {/* After */}
            <div className={`px-2 py-1.5 break-all leading-relaxed ${s.after}`}>
              {row.kind === 'removed' ? <span className="text-gray-300">—</span> : fmt(row.after)}
            </div>
          </div>
        );
      })}

      {/* Toggle unchanged rows */}
      {hideUnchanged && unchangedCount > 0 && (
        <button
          onClick={() => setShowUnchanged((v) => !v)}
          className="w-full flex items-center gap-1.5 px-3 py-2 text-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors border-t border-gray-100"
        >
          {showUnchanged
            ? <ChevronDown className="h-3 w-3" />
            : <ChevronRight className="h-3 w-3" />}
          {showUnchanged ? 'hide' : 'show'} {unchangedCount} unchanged field{unchangedCount !== 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}
