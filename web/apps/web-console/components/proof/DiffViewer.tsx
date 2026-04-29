'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/helpers';

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

const KIND_STYLES: Record<DiffKind, { row: string; before: string; after: string; badge: string; label: string }> = {
  added:     { row: 'bg-green-50 dark:bg-green-950/10',  before: 'text-gray-300', after: 'text-green-700 dark:text-green-400 font-medium', badge: 'border-green-200 bg-green-100 text-green-700',  label: '+' },
  removed:   { row: 'bg-red-50 dark:bg-red-950/10',      before: 'text-red-700 dark:text-red-400 line-through', after: 'text-gray-300',   badge: 'border-red-200 bg-red-100 text-red-700',     label: '−' },
  changed:   { row: 'bg-amber-50 dark:bg-amber-950/10',  before: 'text-red-600 dark:text-red-400 line-through', after: 'text-green-700 dark:text-green-400 font-medium', badge: 'border-amber-200 bg-amber-100 text-amber-700', label: '~' },
  unchanged: { row: '',                                   before: 'text-gray-500', after: 'text-gray-500',       badge: 'border-gray-200 bg-gray-100 text-gray-400',   label: '=' },
};

interface DiffViewerProps {
  before: Record<string, unknown> | null | undefined;
  after:  Record<string, unknown> | null | undefined;
  beforeLabel?: string;
  afterLabel?:  string;
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
    <div className="border border-gray-200 dark:border-border rounded-md overflow-hidden text-[11px]">
      <div className="grid grid-cols-[18px_1fr_1fr_1fr] bg-gray-50 dark:bg-muted border-b border-gray-200 dark:border-border">
        <div className="px-2 py-1.5 text-gray-400" />
        <div className="px-2 py-1.5 text-gray-500 dark:text-muted-foreground font-medium">key</div>
        <div className="px-2 py-1.5 text-gray-400 dark:text-muted-foreground">{beforeLabel}</div>
        <div className="px-2 py-1.5 text-gray-400 dark:text-muted-foreground">{afterLabel}</div>
      </div>

      {visible.map((row) => {
        const s = KIND_STYLES[row.kind];
        return (
          <div
            key={row.key}
            className={cn('grid grid-cols-[18px_1fr_1fr_1fr] border-b border-gray-100 dark:border-border last:border-0', s.row)}
          >
            <div className="flex items-center justify-center py-1.5">
              <Badge variant="outline" className={cn('text-[9px] px-0.5 py-0 rounded h-auto font-medium', s.badge)}>
                {s.label}
              </Badge>
            </div>
            <div className="px-2 py-1.5 text-gray-700 dark:text-gray-300 truncate">{row.key}</div>
            <div className={cn('px-2 py-1.5 break-all leading-relaxed', s.before)}>
              {row.kind === 'added' ? <span className="text-gray-300">—</span> : fmt(row.before)}
            </div>
            <div className={cn('px-2 py-1.5 break-all leading-relaxed', s.after)}>
              {row.kind === 'removed' ? <span className="text-gray-300">—</span> : fmt(row.after)}
            </div>
          </div>
        );
      })}

      {hideUnchanged && unchangedCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowUnchanged((v) => !v)}
          className="w-full rounded-none h-auto px-3 py-2 text-[10px] text-gray-400 hover:text-gray-600 justify-start font-normal border-t border-gray-100 dark:border-border"
        >
          {showUnchanged ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {showUnchanged ? 'hide' : 'show'} {unchangedCount} unchanged field{unchangedCount !== 1 ? 's' : ''}
        </Button>
      )}
    </div>
  );
}
