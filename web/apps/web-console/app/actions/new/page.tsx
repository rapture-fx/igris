'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useToast } from '@/components/ui/use-toast';
import { ActionPolicyPreset, ActionReplayClass, ActionTargetType, useCreateAction } from '@/hooks/useActions';

const EXAMPLES = ['send_email', 'create_ticket', 'update_customer_record', 'fulfill_order'];
const TARGET_TYPES: ActionTargetType[] = ['mock_demo', 'webhook', 'api', 'local_runtime'];
const POLICY_PRESETS: ActionPolicyPreset[] = ['Safe automation', 'Human-gated', 'Non-replayable', 'Read-only'];
const STEPS = ['Name', 'Target', 'Policy', 'Endpoint'];

function endpointFor(name: string) {
  return `https://api.igrisinertial.com/v1/actions/${encodeURIComponent(name || 'send_email')}/run`;
}

function slugifyActionName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_ -]/g, '').replace(/[-\s]+/g, '_');
}

function replayForPreset(preset: ActionPolicyPreset): ActionReplayClass {
  if (preset === 'Human-gated' || preset === 'Non-replayable') return 'non_retryable';
  if (preset === 'Read-only') return 'read_only';
  return 'retryable';
}

function currentSnippet(actionName: string) {
  return `await fetch('${endpointFor(actionName)}', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.IGRIS_API_KEY}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ input })
})`;
}

function NewActionInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = searchParams?.get('step');
  const { toast } = useToast();
  const [step, setStep] = useState(initial === 'target' ? 1 : initial === 'policy' ? 2 : 0);
  const [name, setName] = useState('send_email');
  const [description, setDescription] = useState('Let the agent request an email send through Igris.');
  const [targetType, setTargetType] = useState<ActionTargetType>('mock_demo');
  const [targetUrl, setTargetUrl] = useState('');
  const [method, setMethod] = useState('POST');
  const [policyPreset, setPolicyPreset] = useState<ActionPolicyPreset>('Safe automation');
  const [replayClass, setReplayClass] = useState<ActionReplayClass>('retryable');
  const [approvalRequired, setApprovalRequired] = useState(false);
  const actionName = slugifyActionName(name);
  const snippet = useMemo(() => currentSnippet(actionName), [actionName]);
  const mutation = useCreateAction();

  const finishAction = () => {
    mutation.mutate({
      name: actionName,
      display_name: actionName,
      description,
      target_type: targetType,
      target_url: targetUrl,
      method,
      policy_preset: policyPreset,
      replay_class: replayClass,
      approval_required: approvalRequired,
      irreversible: policyPreset === 'Non-replayable',
    }, {
      onSuccess: (action) => {
        toast({ title: 'Action created', description: 'Copy the endpoint or run a mock demo test from the action detail.' });
        router.push(`/actions/${encodeURIComponent(action.id)}?tab=endpoint`);
      },
      onError: (error: Error) => {
        toast({ variant: 'destructive', title: 'Action was not created', description: error.message });
      },
    });
  };

  const canSave = Boolean(actionName) && (targetType === 'mock_demo' || targetType === 'local_runtime' || targetUrl.trim());

  const updatePreset = (preset: ActionPolicyPreset) => {
    setPolicyPreset(preset);
    setApprovalRequired(preset === 'Human-gated');
    setReplayClass(replayForPreset(preset));
  };

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[940px] px-8 py-10">
          <Link href="/actions" className="mb-4 inline-flex text-[11.5px] text-[#7a7a72] hover:text-[#d3d2c8]">← Actions</Link>
          <div className="mb-5">
            <h1 className="text-[15px] text-[#f0efe8]" style={{ letterSpacing: '-0.01em' }}>Create action</h1>
            <p className="mt-1 text-[12px] text-[#7a7a72]">Define the action, connect a target, choose policy, then copy the endpoint your agent will call.</p>
          </div>

          <div className="mb-4 flex gap-1">
            {STEPS.map((label, index) => (
              <button key={label} type="button" onClick={() => setStep(index)} className={'h-7 rounded-md px-3 text-[11.5px] ' + (step === index ? 'bg-white/[0.08] text-[#f0efe8]' : 'text-[#8a8a82] hover:bg-white/[0.035]')}>
                {index + 1}. {label}
              </button>
            ))}
          </div>

          <section className="rounded-lg border-[0.5px] border-white/[0.06] bg-white/[0.015] p-4">
            {step === 0 && (
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-[11.5px] text-[#a8a89e]">Action name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="h-8 w-full rounded-md border border-white/[0.06] bg-white/[0.04] px-3 text-[12px] text-[#e8e7df] outline-none" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[11.5px] text-[#a8a89e]">Description</span>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[74px] w-full rounded-md border border-white/[0.06] bg-white/[0.04] px-3 py-2 text-[12px] text-[#e8e7df] outline-none" />
                </label>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((example) => <button key={example} type="button" onClick={() => setName(example)} className="rounded-md border border-white/[0.06] px-2 py-1 text-[11px] text-[#8a8a82] hover:bg-white/[0.04]">{example}</button>)}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div className="grid gap-2 md:grid-cols-4">
                  {TARGET_TYPES.map((type) => (
                    <button key={type} type="button" onClick={() => setTargetType(type)} className={'rounded-lg border px-3 py-3 text-left ' + (targetType === type ? 'border-emerald-500/25 bg-emerald-500/[0.08]' : 'border-white/[0.06] bg-white/[0.015]')}>
                      <div className="text-[12px] text-[#e8e7df]">{type.replace(/_/g, ' ')}</div>
                    </button>
                  ))}
                </div>
                {(targetType === 'webhook' || targetType === 'api') && (
                  <div className="grid gap-3 md:grid-cols-[1fr_120px]">
                    <label className="block">
                      <span className="mb-1.5 block text-[11.5px] text-[#a8a89e]">Target URL</span>
                      <input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://api.example.com/send-email" className="h-8 w-full rounded-md border border-white/[0.06] bg-white/[0.04] px-3 text-[12px] text-[#e8e7df] outline-none placeholder:text-[#5a5a52]" />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[11.5px] text-[#a8a89e]">Method</span>
                      <select value={method} onChange={(e) => setMethod(e.target.value)} className="h-8 w-full rounded-md border border-white/[0.06] bg-[#10100f] px-3 text-[12px] text-[#e8e7df] outline-none">
                        {['POST', 'PUT', 'PATCH'].map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </label>
                  </div>
                )}
                {targetType === 'mock_demo' && <p className="text-[12px] text-[#8a8a82]">Mock demo is persisted and can be tested without credentials. It produces demo run evidence without calling an external API.</p>}
                {targetType === 'local_runtime' && <p className="text-[12px] text-[#8a8a82]">Use a runtime when actions need to run near private files, internal APIs, or customer infrastructure.</p>}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="grid gap-2 md:grid-cols-4">
                  {POLICY_PRESETS.map((preset) => (
                    <button key={preset} type="button" onClick={() => updatePreset(preset)} className={'rounded-lg border px-3 py-3 text-left ' + (policyPreset === preset ? 'border-emerald-500/25 bg-emerald-500/[0.08]' : 'border-white/[0.06] bg-white/[0.015]')}>
                      <div className="text-[12px] text-[#e8e7df]">{preset}</div>
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-[12px] text-[#c8c7be]">
                  <input type="checkbox" checked={approvalRequired} onChange={(e) => setApprovalRequired(e.target.checked)} />
                  Approval required
                </label>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="rounded-md border border-white/[0.06] bg-white/[0.025] px-3 py-2">
                  <div className="text-[11px] text-[#7a7a72]">POST endpoint</div>
                  <code className="mt-1 block break-all text-[12px] text-[#d3d2c8]">{endpointFor(actionName)}</code>
                </div>
                <div className="rounded-md border border-white/[0.06] bg-[#090908] p-3">
                  <div className="mb-2 text-[11px] text-[#7a7a72]">TypeScript fetch</div>
                  <pre className="whitespace-pre-wrap text-[11.5px] leading-relaxed text-[#c8c7be]">{snippet}</pre>
                </div>
                <p className="text-[11.5px] text-[#7a7a72]">This replaces the direct tool call in your agent. Igris resolves the action name to the target and policy you configured.</p>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between border-t border-white/[0.05] pt-4">
              <button type="button" onClick={() => setStep(Math.max(0, step - 1))} className="h-8 rounded-md border border-white/[0.06] px-3 text-[11.5px] text-[#c8c7be] disabled:opacity-40" disabled={step === 0}>Back</button>
              <div className="flex gap-2">
                {step < 3 ? (
                  <button type="button" onClick={() => setStep(step + 1)} disabled={!actionName} className="h-8 rounded-md border border-emerald-500/20 bg-emerald-500/[0.12] px-3 text-[11.5px] text-emerald-300 disabled:opacity-40">Continue</button>
                ) : (
                  <button type="button" onClick={finishAction} disabled={!canSave || mutation.isPending} className="h-8 rounded-md border border-emerald-500/20 bg-emerald-500/[0.12] px-3 text-[11.5px] text-emerald-300 disabled:opacity-40">
                    {mutation.isPending ? 'Creating action...' : 'Create action'}
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function NewActionPage() {
  return (
    <Suspense fallback={<DashboardLayout><div className="flex-1" /></DashboardLayout>}>
      <NewActionInner />
    </Suspense>
  );
}
