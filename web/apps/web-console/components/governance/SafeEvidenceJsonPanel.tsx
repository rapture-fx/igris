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
    <div
      className={cn('rounded-lg border-[0.5px] border-white/[0.06]', className)}
      style={{ background: 'rgba(255,255,255,0.015)', boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.03)' }}
    >
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 text-[12.5px] text-[#c8c7be] hover:text-[#f0efe8]"
          style={{ letterSpacing: '-0.005em' }}
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-[#7a7a72]" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-[#7a7a72]" />
          )}
          {title}
        </button>
        {hasData && (
          <button
            type="button"
            onClick={download}
            className="inline-flex items-center gap-1 text-[11px] text-[#7a7a72] hover:text-[#e8e7df]"
          >
            <Download className="h-3 w-3" />
            Export safe JSON
          </button>
        )}
      </div>

      {!hasData ? (
        <p className="px-3.5 pb-3 text-[11.5px] text-[#6a6a62]">Evidence not available.</p>
      ) : (
        open && (
          <div className="px-3.5 pb-3">
            {redactedCount > 0 && (
              <p className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-amber-400/25 bg-amber-400/[0.08] px-2 py-1 text-[11px] text-amber-300">
                <ShieldOff className="h-3 w-3" />
                {redactedCount} sensitive field{redactedCount === 1 ? '' : 's'} redacted before display
              </p>
            )}
            <pre className="max-h-80 overflow-auto rounded-md border border-white/[0.05] bg-black/30 p-3 text-[11px] leading-normal text-[#d3d2c8]">
              {JSON.stringify(redacted, null, 2)}
            </pre>
          </div>
        )
      )}
    </div>
  );
}
