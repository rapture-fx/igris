'use client';

/**
 * Inner task list rendered inside the Executions inspector pane. Ports the
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
import { useSearchParams } from 'next/navigation';
import { useTasks, type Task, type TaskStatus } from '@/hooks/useTasks';
import { mockTaskListForSidebar } from '@/lib/mockExecution';
import { getRelativeTime } from '@/utils/helpers';

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

function TaskRow({ task, selected, mock }: { task: Task; selected: boolean; mock: boolean }) {
  const rs = rowStatusFor(task.status);
  const dotColor =
    rs === 'running' ? 'bg-emerald-400' :
    rs === 'failed'  ? 'bg-rose-500'    :
                       'bg-[#3a3a32]';
  const labelColor =
    rs === 'running' ? 'text-emerald-400' :
    rs === 'failed'  ? 'text-rose-400'    :
                       'text-[#6a6a62]';
  const title = task.policy?.action_name || task.task_type || task.task_id;
  return (
    <Link
      href={`/execution/tasks/${encodeURIComponent(task.task_id)}${mock ? '?mock=1' : ''}`}
      className={
        'group flex items-center gap-2 pl-7 pr-2 py-1.5 rounded transition-colors ' +
        (selected ? 'bg-white/[0.045]' : 'hover:bg-white/[0.02]')
      }
    >
      <span className="flex items-center justify-center w-2.5">
        <span className={'block w-1.5 h-1.5 rounded-full ' + dotColor + (rs === 'running' ? ' ic-live-dot' : '')} />
      </span>
      <span className={'text-[10.5px] tracking-[0.04em] flex-shrink-0 w-[58px] ' + labelColor}>
        {statusLabel(rs)}
      </span>
      <span
        className={'text-[11.5px] truncate flex-1 ' + (selected ? 'text-[#f0efe8]' : 'text-[#a8a89e]')}
        style={{ letterSpacing: '-0.005em' }}
      >
        {title}
      </span>
      <span className="text-[10.5px] text-[#5a5a52] tabular-nums flex-shrink-0 hidden md:inline">
        {getRelativeTime(task.created_at)}
      </span>
    </Link>
  );
}

function Group({
  name, tasks, selectedTaskId, mock, expanded, onToggle,
}: {
  name: string; tasks: Task[]; selectedTaskId: string; mock: boolean;
  expanded: boolean; onToggle: () => void;
}) {
  const anyRunning = tasks.some((t) => rowStatusFor(t.status) === 'running');
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 w-full px-1.5 py-1 text-left text-[12px] text-[#c8c7be] hover:bg-white/[0.025] rounded"
      >
        <svg
          width="9" height="9" viewBox="0 0 24 24" fill="none"
          className={'text-[#6a6a62] transition-transform ' + (expanded ? 'rotate-90' : '')}
        >
          <path d="M9 6 L15 12 L9 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="flex items-center justify-center w-3.5 h-3.5">
          <span className={'block w-1.5 h-1.5 rounded-full ' + (anyRunning ? 'bg-emerald-500/80' : 'bg-[#3a3a32]')} />
        </span>
        <span className="truncate flex-1" style={{ letterSpacing: '-0.005em' }}>{name}</span>
        <span className="text-[10.5px] text-[#5a5a52] tabular-nums">{tasks.length}</span>
      </button>
      {expanded && (
        <div className="mt-px">
          {tasks.map((t) => (
            <TaskRow key={t.task_id} task={t} selected={t.task_id === selectedTaskId} mock={mock} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ExecutionTaskSidebar({ selectedTaskId }: ExecutionTaskSidebarProps) {
  const searchParams = useSearchParams();
  const isMock = searchParams?.get('mock') === '1';
  const { data, isLoading: fetchedLoading } = useTasks({ limit: 60 });
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const tasks = useMemo(() => (isMock ? mockTaskListForSidebar() : (data?.tasks ?? [])), [isMock, data?.tasks]);
  const isLoading = isMock ? false : fetchedLoading;
  const filtered = tasks;

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
      className="flex flex-col border-r border-white/[0.05] flex-shrink-0"
      style={{ width: 236, background: '#070707' }}
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <span className="text-[11px] text-[#7a7a72]">Tasks</span>
        <span className="text-[10.5px] text-[#5a5a52] tabular-nums">{filtered.length}</span>
      </div>

      <div className="ic-scroll flex-1 overflow-y-auto px-2 pb-2">
        {isLoading ? (
          <div className="px-2 py-3 text-[11px] text-[#6a6a62]">Loading tasks…</div>
        ) : filtered.length === 0 ? (
          <div className="px-2 py-3 text-[11px] text-[#6a6a62]">No tasks yet.</div>
        ) : (
          groups.map((g) => (
            <Group
              key={g.name}
              name={g.name}
              tasks={g.tasks}
              selectedTaskId={selectedTaskId}
              mock={isMock}
              expanded={!collapsedGroups[g.name]}
              onToggle={() => toggleGroup(g.name)}
            />
          ))
        )}
      </div>
    </aside>
  );
}
