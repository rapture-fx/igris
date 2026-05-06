import sdkSupport from '@/lib/generated/sdk-support.json';

type SdkRow = {
  language: string;
  status: string;
  package: string;
  install: string;
  import: string;
  notes: string;
};

const STATUS_META: Record<string, { label: string; badgeClass: string }> = {
  'first-class': {
    label: 'First-class',
    badgeClass:
      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/25',
  },
  preview: {
    label: 'Preview',
    badgeClass:
      'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-500/25',
  },
  'openai-compatible': {
    label: 'OpenAI-compatible',
    badgeClass:
      'bg-sky-500/10 text-sky-700 dark:text-sky-400 ring-1 ring-inset ring-sky-500/25',
  },
};

function Badge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    badgeClass: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.66rem] font-semibold leading-none tracking-wide ${meta.badgeClass}`}
    >
      {meta.label}
    </span>
  );
}

function SdkCard({ row }: { row: SdkRow }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-fd-border bg-fd-card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[0.82rem] font-semibold text-fd-foreground leading-snug">
          {row.language}
        </span>
        <Badge status={row.status} />
      </div>

      {row.package !== 'n/a' && (
        <div className="space-y-1.5">
          <div className="rounded-md bg-fd-muted px-2.5 py-1.5">
            <code className="font-mono text-[0.72rem] text-fd-foreground break-all">
              {row.install}
            </code>
          </div>
          <div className="rounded-md bg-fd-muted px-2.5 py-1.5">
            <code className="font-mono text-[0.72rem] text-fd-muted-foreground break-all">
              {row.import}
            </code>
          </div>
        </div>
      )}

      <p className="text-[0.82rem] leading-relaxed text-fd-muted-foreground m-0">{row.notes}</p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-fd-muted-foreground m-0 mb-2.5">
      {children}
    </p>
  );
}

export function SdkSupportMatrix() {
  const rows = sdkSupport.rows as SdkRow[];

  const firstClass = rows.filter((r) => r.status === 'first-class');
  const preview = rows.filter((r) => r.status === 'preview');
  const compatible = rows.filter((r) => r.status === 'openai-compatible');

  return (
    <div className="space-y-6 not-prose sdk-matrix">
      {/* First-class */}
      <div>
        <SectionLabel>First-class</SectionLabel>
        <div className="flex flex-col gap-3">
          {firstClass.map((row) => (
            <SdkCard key={row.language} row={row} />
          ))}
        </div>
      </div>

      {/* Preview */}
      <div>
        <SectionLabel>Preview</SectionLabel>
        <div className="flex flex-col gap-3">
          {preview.map((row) => (
            <SdkCard key={row.language} row={row} />
          ))}
        </div>
      </div>

      {/* OpenAI-compatible */}
      <div>
        <SectionLabel>OpenAI-compatible only</SectionLabel>
        <div className="rounded-xl border border-fd-border bg-fd-muted/40 p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {compatible.map((row) => (
              <span
                key={row.language}
                className="inline-flex items-center rounded-lg border border-fd-border bg-fd-card px-3 py-1.5 text-[0.75rem] font-medium text-fd-foreground"
              >
                {row.language}
              </span>
            ))}
          </div>
          <p className="text-[0.82rem] leading-relaxed text-fd-muted-foreground m-0">
            Point any OpenAI-compatible client at{' '}
            <code className="font-mono text-[0.72rem] bg-fd-muted rounded px-1 py-0.5">
              https://overture.igrisinertial.com/v1
            </code>{' '}
            as the base URL. Native SDKs for these languages are not yet available.
          </p>
        </div>
      </div>
    </div>
  );
}
