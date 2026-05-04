import type { ExecutionRunEvent } from '@/lib/executionRuns';

export interface ExecutionTimelineItem {
  id: string;
  timestamp?: string;
  label: string;
  detail: string;
  kind?: string;
  severity?: 'success' | 'warning' | 'error' | 'neutral';
  source: 'event' | 'log';
  metadata?: Record<string, unknown>;
  order: number;
}

const KNOWN_EVENT_LABELS: Record<string, string> = {
  task_created: 'Request received',
  task_dispatched: 'Runtime selected',
  route_decision: 'Route decision recorded',
  capability_envelope: 'Capability envelope recorded',
  receipt_recorded: 'Receipt generated',
  runtime_execution: 'Run completed',
  task_completed: 'Run completed',
  task_canceled: 'Run cancelled',
  task_failed: 'Run failed',
};

function normalizeKind(kind?: string): string {
  return String(kind ?? '').trim().toLowerCase();
}

function eventLabel(kind?: string): string {
  const normalized = normalizeKind(kind);
  if (!normalized) return 'Execution event';
  return KNOWN_EVENT_LABELS[normalized] ?? normalized.replace(/[_-]+/g, ' ');
}

function eventSeverity(kind?: string, detail?: string): ExecutionTimelineItem['severity'] {
  const normalized = normalizeKind(kind);
  const message = String(detail ?? '').toLowerCase();
  if (
    normalized.includes('failed')
    || normalized.includes('error')
    || normalized.includes('violation')
    || message.includes('failed')
    || message.includes('error')
  ) {
    return 'error';
  }
  if (
    normalized.includes('cancel')
    || normalized.includes('violation')
    || message.includes('violation')
    || message.includes('timeout')
  ) {
    return 'warning';
  }
  if (
    normalized.includes('completed')
    || normalized.includes('receipt')
    || normalized.includes('verified')
    || message.includes('completed')
    || message.includes('matched')
  ) {
    return 'success';
  }
  return 'neutral';
}

function parseLogLine(line: string): { timestamp?: string; kind?: string; detail: string } {
  const trimmed = line.trim();
  if (!trimmed) {
    return { detail: '' };
  }

  const match = trimmed.match(/^(\S+)\s+([a-zA-Z0-9_.-]+):\s+(.*)$/);
  if (!match) {
    return { detail: trimmed };
  }

  const [, timestamp, kind, detail] = match;
  return { timestamp, kind, detail };
}

function eventKey(timestamp?: string, kind?: string, detail?: string): string {
  return [timestamp ?? '', normalizeKind(kind), String(detail ?? '').trim()].join('|');
}

export function buildExecutionTimeline(
  events: ExecutionRunEvent[] | null | undefined,
  logs: string[] | null | undefined,
): ExecutionTimelineItem[] {
  const timeline: ExecutionTimelineItem[] = [];
  const seen = new Set<string>();
  let order = 0;

  for (const event of events ?? []) {
    const detail = String(event.message ?? '').trim();
    const kind = String(event.kind ?? '').trim();
    const timestamp = String(event.timestamp ?? '').trim() || undefined;
    if (!detail && !kind && !timestamp) {
      continue;
    }
    const key = eventKey(timestamp, kind, detail);
    seen.add(key);
    timeline.push({
      id: `event-${order}`,
      timestamp,
      label: eventLabel(kind),
      detail: detail || 'No message recorded.',
      kind: kind || undefined,
      severity: eventSeverity(kind, detail),
      source: 'event',
      metadata: {
        timestamp,
        kind,
        message: detail,
      },
      order: order++,
    });
  }

  for (const line of logs ?? []) {
    const parsed = parseLogLine(line);
    if (!parsed.detail) {
      continue;
    }
    const key = eventKey(parsed.timestamp, parsed.kind, parsed.detail);
    if (seen.has(key)) {
      continue;
    }
    timeline.push({
      id: `log-${order}`,
      timestamp: parsed.timestamp,
      label: parsed.kind ? eventLabel(parsed.kind) : 'Log entry',
      detail: parsed.detail,
      kind: parsed.kind,
      severity: eventSeverity(parsed.kind, parsed.detail),
      source: 'log',
      metadata: {
        raw_log: line,
      },
      order: order++,
    });
  }

  return [...timeline].sort((left, right) => {
    const leftTime = left.timestamp ? Date.parse(left.timestamp) : Number.NaN;
    const rightTime = right.timestamp ? Date.parse(right.timestamp) : Number.NaN;
    const leftHasTime = !Number.isNaN(leftTime);
    const rightHasTime = !Number.isNaN(rightTime);

    if (leftHasTime && rightHasTime && leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return left.order - right.order;
  });
}
