import sdkSupport from '@/lib/generated/sdk-support.json';

type SdkRow = {
  language: string;
  status: string;
  package: string;
  install: string;
  import: string;
  notes: string;
};

const statusClasses: Record<string, string> = {
  'first-class': 'bg-emerald-100 text-emerald-800',
  preview: 'bg-amber-100 text-amber-800',
  'openai-compatible': 'bg-blue-100 text-blue-800',
};

export function SdkSupportMatrix() {
  const rows = sdkSupport.rows as SdkRow[];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="mt-0 text-lg font-semibold text-slate-900">Support Status</h2>
        <p className="mb-0 text-sm text-slate-700">{sdkSupport.native_sdk_note}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-900">Language</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-900">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-900">Package</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-900">Install</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-900">Import</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-900">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.language} className="border-t border-slate-200 align-top">
                <td className="px-4 py-3 font-semibold text-slate-900">{row.language}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusClasses[row.status] || 'bg-slate-100 text-slate-700'}`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-800">{row.package}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-800">{row.install}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-800">{row.import}</td>
                <td className="px-4 py-3 text-slate-700">{row.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
