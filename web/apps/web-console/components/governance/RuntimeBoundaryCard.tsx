'use client';

/**
 * RuntimeBoundaryCard — shows the isolation boundary Overture expected for the
 * runtime action: environment, allowed/denied tools, network/file/API scope,
 * resource limits, and declared runtime capabilities.
 *
 * Boundary records are evidence and policy inputs — not proof that the runtime
 * actually enforced them. Enforcement depends on runtime support, so the card
 * says so explicitly.
 */

import { Boxes } from 'lucide-react';
import type { Task } from '@/hooks/useTasks';
import { KeyValueGrid } from '@/components/execution/shared';
import { GovernanceBadge } from './GovernanceBadge';

function ToolList({ tools, tone }: { tools?: string[]; tone: 'success' | 'danger' }) {
  if (!Array.isArray(tools) || tools.length === 0) {
    return <span className="text-xs text-muted-foreground/60">None</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {tools.map((tool) => (
        <GovernanceBadge key={tool} label={tool} tone={tone} showDot={false} />
      ))}
    </div>
  );
}

export function RuntimeBoundaryCard({ task }: { task: Task }) {
  const boundary = task.runtime_boundary;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Boxes className="h-4 w-4 text-muted-foreground" />
        Runtime boundary
      </div>

      {!boundary ? (
        <p className="text-xs text-muted-foreground">
          No runtime boundary was recorded for this task.
        </p>
      ) : (
        <>
          <KeyValueGrid
            rows={[
              {
                label: 'Runtime',
                value: boundary.runtime_id ?? task.runtime_id ?? '—',
                mono: Boolean(boundary.runtime_id ?? task.runtime_id),
              },
              { label: 'Environment', value: boundary.environment_label ?? '—' },
              { label: 'Network scope', value: boundary.network_scope ?? 'none' },
              { label: 'File scope', value: boundary.filesystem_scope ?? 'none' },
              { label: 'API scope', value: boundary.api_scope ?? 'none' },
              {
                label: 'Allowed tools',
                value: <ToolList tools={boundary.allowed_tools} tone="success" />,
              },
              {
                label: 'Denied tools',
                value: <ToolList tools={boundary.denied_tools} tone="danger" />,
              },
              {
                label: 'Boundary digest',
                value: boundary.boundary_digest ?? '—',
                mono: Boolean(boundary.boundary_digest),
                copyable: boundary.boundary_digest,
              },
            ]}
          />
          <p className="mt-3 text-[11px] text-muted-foreground">
            Boundary records are evidence and policy inputs. Actual enforcement depends
            on the runtime supporting the declared isolation capability.
          </p>
        </>
      )}
    </div>
  );
}
