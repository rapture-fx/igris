'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api } from '@/lib/apiClient';
import { useToast } from '@/components/ui/use-toast';

const TARGETS = ['http_request', 'filesystem', 'database_write'];

export default function NewActionPage() {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('http_request');
  const [url, setUrl] = useState('');
  const [path, setPath] = useState('');
  const [table, setTable] = useState('');
  const [runId, setRunId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const input =
        target === 'http_request' ? { url, method: 'POST' } :
        target === 'filesystem' ? { path } :
        { table };
      return api.post<{ run_id?: string; task_id?: string; id?: string }>('/v1/actions/run', {
        action: name.trim(),
        runtime_target: target,
        input,
      });
    },
    onSuccess: (result) => {
      const id = result.run_id || result.task_id || result.id || null;
      setRunId(id);
      toast({ title: 'Action test started', description: id ? 'Open the run to inspect policy, recovery, and proof.' : 'The action request was accepted.' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Action was not created', description: error.message });
    },
  });

  const disabled =
    !name.trim() ||
    (target === 'http_request' && !url.trim()) ||
    (target === 'filesystem' && !path.trim()) ||
    (target === 'database_write' && !table.trim());

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[760px] px-8 py-10">
          <Link href="/actions" className="mb-4 inline-flex text-[11.5px] text-[#7a7a72] hover:text-[#d3d2c8]">← Actions</Link>
          <h1 className="text-[15px] text-[#f0efe8]" style={{ letterSpacing: '-0.01em' }}>Create action</h1>
          <p className="mt-1 text-[12px] text-[#7a7a72]">Start with a test run. Once it exists, the action detail page exposes the endpoint, policy, secrets, and run history.</p>

          <div className="mt-6 space-y-4 rounded-lg border-[0.5px] border-white/[0.06] bg-white/[0.015] p-4">
            <label className="block">
              <span className="mb-1.5 block text-[11.5px] text-[#a8a89e]">Action name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fulfill order" className="h-8 w-full rounded-md border border-white/[0.06] bg-white/[0.04] px-3 text-[12px] text-[#e8e7df] outline-none placeholder:text-[#5a5a52]" />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11.5px] text-[#a8a89e]">Target</span>
              <select value={target} onChange={(e) => setTarget(e.target.value)} className="h-8 w-full rounded-md border border-white/[0.06] bg-[#10100f] px-3 text-[12px] text-[#e8e7df] outline-none">
                {TARGETS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>

            {target === 'http_request' && (
              <label className="block">
                <span className="mb-1.5 block text-[11.5px] text-[#a8a89e]">Target URL</span>
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.example.com/action" className="h-8 w-full rounded-md border border-white/[0.06] bg-white/[0.04] px-3 text-[12px] text-[#e8e7df] outline-none placeholder:text-[#5a5a52]" />
              </label>
            )}
            {target === 'filesystem' && (
              <label className="block">
                <span className="mb-1.5 block text-[11.5px] text-[#a8a89e]">Path</span>
                <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/data/input.json" className="h-8 w-full rounded-md border border-white/[0.06] bg-white/[0.04] px-3 text-[12px] text-[#e8e7df] outline-none placeholder:text-[#5a5a52]" />
              </label>
            )}
            {target === 'database_write' && (
              <label className="block">
                <span className="mb-1.5 block text-[11.5px] text-[#a8a89e]">Table</span>
                <input value={table} onChange={(e) => setTable(e.target.value)} placeholder="orders" className="h-8 w-full rounded-md border border-white/[0.06] bg-white/[0.04] px-3 text-[12px] text-[#e8e7df] outline-none placeholder:text-[#5a5a52]" />
              </label>
            )}

            <button
              type="button"
              disabled={disabled || mutation.isPending}
              onClick={() => mutation.mutate()}
              className="inline-flex h-8 items-center rounded-md border border-emerald-500/20 bg-emerald-500/[0.12] px-3 text-[11.5px] text-emerald-300 hover:bg-emerald-500/[0.16] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mutation.isPending ? 'Starting test...' : 'Create and run test'}
            </button>
          </div>

          {runId && (
            <Link href={`/runs/${encodeURIComponent(runId)}`} className="mt-4 inline-flex text-[11.5px] text-[#c8c7be] hover:text-[#f0efe8]">
              Open test run →
            </Link>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
