'use client';

/**
 * SafeEvidenceJsonPanel — renders raw JSON evidence with sensitive fields
 * redacted before display. The redacted copy is also what gets exported, so an
 * operator can never accidentally download a secret. When evidence is missing
 * the panel says so plainly rather than rendering an empty object.
 */

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download, ShieldOff } from 'lucide-react';
import { cn } from '@/utils/helpers';
import { countRedactedFields, redactEvidence } from '@/lib/evidenceRedaction';

export function SafeEvidenceJsonPanel({
  title,
  data,
  defaultOpen = false,
  exportName,
  className,
}: {
  title: string;
  data: unknown;
  defaultOpen?: boolean;
  exportName?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const hasData =
    data !== undefined &&
    data !== null &&
    !(typeof data === 'object' && data !== null && Object.keys(data as object).length === 0);

  const redacted = useMemo(() => (hasData ? redactEvidence(data) : null), [data, hasData]);
  const redactedCount = useMemo(() => (hasData ? countRedactedFields(data) : 0), [data, hasData]);

  const download = () => {
    if (!redacted) return;
    const blob = new Blob([JSON.stringify(redacted, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportName ?? title.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white', className)}>
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 text-xs font-medium text-foreground"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          {title}
        </button>
        {hasData && (
          <button
            type="button"
            onClick={download}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Download className="h-3 w-3" />
            Export safe JSON
          </button>
        )}
      </div>

      {!hasData ? (
        <p className="px-3.5 pb-3 text-xs text-muted-foreground">Evidence not available.</p>
      ) : (
        open && (
          <div className="px-3.5 pb-3">
            {redactedCount > 0 && (
              <p className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                <ShieldOff className="h-3 w-3" />
                {redactedCount} sensitive field{redactedCount === 1 ? '' : 's'} redacted before display
              </p>
            )}
            <pre className="max-h-80 overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3 text-[11px] leading-normal text-foreground">
              {JSON.stringify(redacted, null, 2)}
            </pre>
          </div>
        )
      )}
    </div>
  );
}
