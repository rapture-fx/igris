'use client';

import React, { useState } from 'react';
import { cn } from '@/utils/helpers';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Copy, Check, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { getRelativeTime } from '@/utils/helpers';

// ─── Copy Button ──────────────────────────────────────────────────────────────

export function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center text-gray-400 hover:text-gray-600 transition-colors',
        className,
      )}
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ─── Execution Status Badge (re-export) ──────────────────────────────────────

export { StatusBadge as ExecutionStatusBadge };

// ─── Violation Badge ──────────────────────────────────────────────────────────

export function ViolationBadge({
  hasViolation,
  count,
}: {
  hasViolation?: boolean;
  count?: number;
}) {
  const show = hasViolation || (count !== undefined && count > 0);
  if (!show) return <span className="text-xs text-gray-300">—</span>;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
      <span className="h-1.5 w-1.5 rounded-full bg-orange-500 flex-shrink-0" />
      {count !== undefined ? count : 'Violation'}
    </span>
  );
}

// ─── Key-Value Grid ───────────────────────────────────────────────────────────

export interface KVRow {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  copyable?: string;
}

export function KeyValueGrid({ rows }: { rows: KVRow[] }) {
  return (
    <dl className="grid grid-cols-[150px_1fr] gap-x-4 gap-y-2.5">
      {rows.map((row, i) => (
        <React.Fragment key={i}>
          <dt className="text-xs text-gray-500 flex items-start pt-0.5 shrink-0">
            {row.label}
          </dt>
          <dd
            className={cn(
              'text-xs text-gray-900 flex items-start gap-1',
              row.mono && 'font-mono break-all',
            )}
          >
            <span>
              {row.value !== undefined && row.value !== null && row.value !== '' ? (
                row.value
              ) : (
                <span className="text-gray-300">—</span>
              )}
            </span>
            {row.copyable && <CopyButton value={row.copyable} />}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

// ─── JSON Viewer ──────────────────────────────────────────────────────────────

export function JSONViewer({
  data,
  defaultOpen = false,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        {open ? 'Collapse' : 'Show'} raw JSON
      </button>
      {open && (
        <pre className="mt-2 text-[11px] text-gray-700 bg-gray-50 border border-gray-200 rounded-md p-3 overflow-auto max-h-80 font-mono leading-relaxed">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─── Lifecycle Timeline ───────────────────────────────────────────────────────

export interface TimelineEvent {
  state: string;
  timestamp: string;
  note?: string;
}

export function LifecycleTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-xs text-gray-400">No lifecycle events recorded.</p>;
  }

  const dotColor = (state: string) => {
    const s = state.toUpperCase();
    if (s === 'RUNNING' || s === 'ACTIVE') return 'bg-green-500 ring-green-200';
    if (s === 'ERROR' || s === 'VIOLATION') return 'bg-red-500 ring-red-200';
    if (s === 'RECOVERING') return 'bg-yellow-500 ring-yellow-200';
    if (s === 'SAFE_IDLE') return 'bg-blue-400 ring-blue-200';
    return 'bg-gray-400 ring-gray-200';
  };

  return (
    <div className="relative pl-5">
      <div className="absolute left-[7px] top-2 bottom-0 w-px bg-gray-200" />
      <div className="space-y-4">
        {events.map((event, i) => (
          <div key={i} className="relative flex items-start gap-3">
            <div
              className={cn(
                'absolute -left-[5px] top-[5px] h-2.5 w-2.5 rounded-full border-2 border-white ring-1',
                dotColor(event.state),
              )}
            />
            <div className="ml-2 flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <StatusBadge status={event.state} />
                <span className="text-xs text-gray-400">{getRelativeTime(event.timestamp)}</span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">{event.timestamp}</span>
              {event.note && <p className="text-[11px] text-gray-500 mt-0.5">{event.note}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Receipt Verification Panel ───────────────────────────────────────────────

export function ReceiptVerificationPanel({
  signature,
  hash,
  previousHash,
  receiptData,
}: {
  signature?: string;
  hash?: string;
  previousHash?: string;
  receiptData?: Record<string, unknown>;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyField = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {}
  };

  const downloadReceipt = () => {
    if (!receiptData) return;
    const blob = new Blob([JSON.stringify(receiptData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fields = [
    { key: 'signature', label: 'Signature', value: signature },
    { key: 'hash', label: 'Hash', value: hash },
    { key: 'prev_hash', label: 'Previous Hash', value: previousHash },
  ];

  return (
    <div className="space-y-3">
      {fields.map(({ key, label, value }) => (
        <div key={key}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-500">{label}</span>
            {value && (
              <button
                onClick={() => copyField(key, value)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
              >
                {copiedField === key ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copiedField === key ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
          <p className="text-[11px] font-mono text-gray-600 break-all bg-gray-50 border border-gray-100 rounded px-2.5 py-2 leading-relaxed">
            {value ?? <span className="text-gray-300">Not available</span>}
          </p>
        </div>
      ))}
      {receiptData && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5 mt-1"
          onClick={downloadReceipt}
        >
          <Download className="h-3 w-3" />
          Download Receipt JSON
        </Button>
      )}
    </div>
  );
}
