'use client';

/**
 * Inner run list rendered inside the Runs inspector pane. Ports the
 * canonical product design from the landing-page hero
 * (web-landing/.../Products.tsx ExecutionPreview): dark surface,
 * project-style groups with a status dot beside each group name, task rows
 * showing `[●dot] [STATUS] [title] [when]`.
 *
 * Interactive: search filters task titles; group headers collapse/expand.
 * Project grouping uses `runtime_boundary.environment_label` when available.
 * No fabricated grouping.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTasks, type Task, type TaskStatus } from '@/hooks/useTasks';
import { getRelativeTime } from '@/utils/helpers';
import { tokens } from '@/components/console/primitives';

interface ExecutionTaskSidebarProps {
  selectedTaskId: string;
}

type RowStatus = 'running' | 'completed' | 'failed';

function rowStatusFor(status: TaskStatus): RowStatus {
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  return 'running';
}

function statusLabel(s: RowStatus): string {
  return s === 'running' ? 'Running' : s === 'failed' ? 'Failed' : 'Completed';
}

function TaskRow({ task, selected }: { task: Task; selected: boolean }) {
  const rs = rowStatusFor(task.status);
  const dotStyle =
    rs === 'running' ? { background: tokens.emerald } :
    rs === 'failed'  ? { background: tokens.rose }    :
                       { background: tokens.textDeepest };
  const labelStyle =
    rs === 'running' ? { color: tokens.emerald } :
    rs === 'failed'  ? { color: tokens.rose }    :
                       { color: tokens.textDim };
  const title = task.policy?.action_name || task.task_type || task.task_id;
  return (
    <Link
      href={`/execution/tasks/${encodeURIComponent(task.task_id)}`}
      className="group flex items-center gap-2 pl-7 pr-2 py-1.5 rounded transition-colors hover:bg-[var(--ig-bg-surface)]"
      style={selected ? { background: 'var(--ig-rail-active-bg)' } : undefined}
    >
      <span className="flex items-center justify-center w-2.5">
        <span
          className={'block w-1.5 h-1.5 rounded-full ' + (rs === 'running' ? 'ic-live-dot' : '')}
          style={dotStyle}
        />
      </span>
      <span className="text-[10.5px] tracking-[0.04em] flex-shrink-0 w-[58px]" style={labelStyle}>
        {statusLabel(rs)}
      </span>
      <span
        className="text-[11.5px] truncate flex-1"
        style={{ letterSpacing: '-0.005em', color: selected ? tokens.textPrimary : tokens.textMuted }}
      >
        {title}
      </span>
      <span
        className="text-[10.5px] tabular-nums flex-shrink-0 hidden md:inline"
        style={{ color: tokens.textDimmer }}
      >
        {getRelativeTime(task.created_at)}
      </span>
    </Link>
  );
}

function Group({
  name, tasks, selectedTaskId, expanded, onToggle,
}: {
  name: string; tasks: Task[]; selectedTaskId: string;
  expanded: boolean; onToggle: () => void;
}) {
  const anyRunning = tasks.some((t) => rowStatusFor(t.status) === 'running');
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 w-full px-1.5 py-1 text-left text-[12px] hover:bg-[var(--ig-bg-surface)] rounded"
        style={{ color: tokens.textBody }}
      >
        <svg
          width="9" height="9" viewBox="0 0 24 24" fill="none"
          className={'transition-transform ' + (expanded ? 'rotate-90' : '')}
          style={{ color: tokens.textDim }}
        >
          <path d="M9 6 L15 12 L9 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="flex items-center justify-center w-3.5 h-3.5">
          <span
            className="block w-1.5 h-1.5 rounded-full"
            style={{ background: anyRunning ? tokens.emerald : tokens.textDeepest, opacity: anyRunning ? 0.8 : 1 }}
          />
        </span>
        <span className="truncate flex-1" style={{ letterSpacing: '-0.005em' }}>{name}</span>
        <span className="text-[10.5px] tabular-nums" style={{ color: tokens.textDimmer }}>{tasks.length}</span>
      </button>
      {expanded && (
        <div className="mt-px">
          {tasks.map((t) => (
            <TaskRow key={t.task_id} task={t} selected={t.task_id === selectedTaskId} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ExecutionTaskSidebar({ selectedTaskId }: ExecutionTaskSidebarProps) {
  const { data, isLoading: fetchedLoading } = useTasks({ limit: 60 });
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');

  const tasks = useMemo(() => data?.tasks ?? [], [data?.tasks]);
  const isLoading = fetchedLoading;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => {
      const title = (t.policy?.action_name || t.task_type || t.task_id).toLowerCase();
      const env = (t.runtime_boundary?.environment_label || '').toLowerCase();
      return title.includes(q) || env.includes(q);
    });
  }, [tasks, query]);

  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, Task[]>();
    for (const t of filtered) {
      const key = t.runtime_boundary?.environment_label || 'recent';
      if (!map.has(key)) {
        order.push(key);
        map.set(key, []);
      }
      map.get(key)!.push(t);
    }
    return order.map((k) => ({ name: k, tasks: map.get(k)! }));
  }, [filtered]);

  const toggleGroup = (name: string) => {
    setCollapsedGroups((s) => ({ ...s, [name]: !s[name] }));
  };

  return (
    <aside
      className="flex flex-col border-r flex-shrink-0"
      style={{ width: 236, background: tokens.bgRail, borderColor: tokens.borderSoft }}
    >
      {/* Search — ported from landing hero ExecutionPreview sidebar */}
      <div className="px-3 pt-3 pb-2">
        <div
          className="flex items-center gap-1.5 px-2 h-[22px] rounded-md border-[0.5px]"
          style={{ background: tokens.bg, borderColor: tokens.borderSoft }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" style={{ color: tokens.textDim }}>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="flex-1 bg-transparent outline-none text-[10.5px] placeholder:text-[var(--ig-text-dim)]"
            style={{ color: tokens.textBody }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-4 mt-1 mb-1">
        <span className="text-[11px]" style={{ color: tokens.textMuted }}>Runs</span>
        <span className="text-[10.5px] tabular-nums" style={{ color: tokens.textDimmer }}>{filtered.length}</span>
      </div>

      <div className="ic-scroll flex-1 overflow-y-auto px-2 pb-2">
        {isLoading ? (
          <div className="px-2 py-3 text-[11px]" style={{ color: tokens.textDim }}>Loading runs…</div>
        ) : filtered.length === 0 ? (
          <div className="px-2 py-3 text-[11px]" style={{ color: tokens.textDim }}>No runs yet.</div>
        ) : (
          groups.map((g) => (
            <Group
              key={g.name}
              name={g.name}
              tasks={g.tasks}
              selectedTaskId={selectedTaskId}
              expanded={!collapsedGroups[g.name]}
              onToggle={() => toggleGroup(g.name)}
            />
          ))
        )}
      </div>
    </aside>
  );
}
