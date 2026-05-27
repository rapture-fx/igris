'use client';

/**
 * Create action — guided 4-step flow (Identity → Target → Policy → Endpoint).
 * Layout mirrors the canonical execution-detail design: top bar, step strip,
 * section body, sticky bottom bar with Back / Continue.
 */

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useToast } from '@/components/ui/use-toast';
import {
  ActionPolicyPreset,
  ActionReplayClass,
  ActionTargetType,
  useCreateAction,
} from '@/hooks/useActions';
import { CodeBlock, tokensForCurl, tokensForTs } from '@/lib/codeHighlight';

const EXAMPLES = ['send_email', 'create_ticket', 'update_customer_record', 'fulfill_order'];
const POLICY_PRESETS: ActionPolicyPreset[] = ['Safe automation', 'Human-gated', 'Non-replayable', 'Read-only'];
const STEPS = ['Identity', 'Target', 'Policy', 'Endpoint'];

type TargetOption = {
  id: ActionTargetType;
  label: string;
  hint: string;
  disabled?: boolean;
  disabledReason?: string;
};

const TARGET_OPTIONS: TargetOption[] = [
  { id: 'mock_demo',       label: 'Mock demo',         hint: 'Persisted demo target. No credentials required.' },
  { id: 'webhook',         label: 'Hosted webhook',    hint: 'Call a webhook your hosted backend already exposes.' },
  { id: 'hosted_api',      label: 'Hosted API',        hint: 'Call a hosted API endpoint by URL.' },
  { id: 'local_runtime',   label: 'Local runtime',     hint: 'Use this when the action needs private files, internal APIs, or local databases.' },
  { id: 'hybrid_fallback', label: 'Hybrid / fallback', hint: 'Hosted with local fallback. Coming soon.', disabled: true, disabledReason: 'Coming soon' },
];

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

function presetHint(preset: ActionPolicyPreset): string {
  switch (preset) {
    case 'Safe automation': return 'Auto-allow this action. Igris records receipts.';
    case 'Human-gated':     return 'Require human approval before the action runs.';
    case 'Non-replayable':  return 'Block replay after a failure. Use for irreversible side effects.';
    case 'Read-only':       return 'Action does not mutate. Safe to replay freely.';
  }
}

function snippetTs(actionName: string) {
  return `await fetch('${endpointFor(actionName)}', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.IGRIS_API_KEY}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ input })
})`;
}

function snippetCurl(actionName: string) {
  return `curl -X POST '${endpointFor(actionName)}' \\
  -H 'Authorization: Bearer $IGRIS_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{"input":{"demo":true}}'`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] bg-[var(--ig-bg-chip)] text-[var(--ig-text-body)] border border-[var(--ig-border)] hover:bg-[var(--ig-bg-surface)]"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="text-[12.5px] text-[#c8c7be] mb-2" style={{ letterSpacing: '-0.005em' }}>
        {title}
      </div>
      <div
        className="rounded-lg border-[0.5px] border-[var(--ig-border)] px-4 py-3"
        style={{ background: 'var(--ig-bg-surface)' }}
      >
        {children}
      </div>
    </div>
  );
}

function NewActionInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = searchParams?.get('step');
  const { toast } = useToast();
  const [step, setStep] = useState(
    initial === 'target' ? 1 :
    initial === 'policy' ? 2 :
    initial === 'endpoint' ? 3 :
    0
  );
  const [name, setName] = useState('send_email');
  const [description, setDescription] = useState('Let the agent request an email send through Igris.');
  const [targetType, setTargetType] = useState<ActionTargetType>('mock_demo');
  const [targetUrl, setTargetUrl] = useState('');
  const [method, setMethod] = useState('POST');
  const [policyPreset, setPolicyPreset] = useState<ActionPolicyPreset>('Safe automation');
  const [replayClass, setReplayClass] = useState<ActionReplayClass>('retryable');
  const [approvalRequired, setApprovalRequired] = useState(false);

  const actionName = slugifyActionName(name);
  const snippetTsText = useMemo(() => snippetTs(actionName), [actionName]);
  const snippetCurlText = useMemo(() => snippetCurl(actionName), [actionName]);
  const mutation = useCreateAction();

  const canSave =
    Boolean(actionName) &&
    (targetType === 'mock_demo' || targetType === 'local_runtime' || targetUrl.trim());

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
        toast({
          title: 'Action created',
          description: 'Copy the endpoint or run a mock demo test from the action detail.',
        });
        router.push(`/actions/${encodeURIComponent(action.id)}?tab=endpoint`);
      },
      onError: (error: Error) => {
        toast({ variant: 'destructive', title: 'Action was not created', description: error.message });
      },
    });
  };

  const updatePreset = (preset: ActionPolicyPreset) => {
    setPolicyPreset(preset);
    setApprovalRequired(preset === 'Human-gated');
    setReplayClass(replayForPreset(preset));
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col min-h-0 h-full">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 h-11 px-5 border-b border-[var(--ig-border)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/actions"
              className="text-[11.5px] text-[#7a7a72] hover:text-[#d3d2c8]"
              title="Back to actions"
            >
              ←
            </Link>
            <span
              className="text-[13px] font-medium text-[#f0efe8] truncate"
              style={{ letterSpacing: '-0.01em' }}
            >
              Create action
            </span>
            <span className="ic-chip">step {step + 1} of {STEPS.length}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/actions"
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11.5px] bg-[var(--ig-bg-chip)] text-[var(--ig-text-body)] border border-[var(--ig-border)] hover:bg-[var(--ig-bg-surface)]"
            >
              Cancel
            </Link>
          </div>
        </div>

        {/* Step strip */}
        <div
          className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-[var(--ig-border-soft)]"
          style={{ background: 'var(--ig-bg-surface)' }}
        >
          {STEPS.map((label, index) => {
            const active = step === index;
            const done = step > index;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setStep(index)}
                className={
                  'inline-flex items-center gap-2 px-2.5 py-1 rounded-md border ' +
                  (active
                    ? 'bg-[var(--ig-rail-active-bg)] border-[var(--ig-border)] text-[#f0efe8]'
                    : 'bg-[var(--ig-bg-chip)] border-[var(--ig-border)] text-[#a8a89e] hover:text-[#e8e7df]')
                }
              >
                <span className={'block w-1.5 h-1.5 rounded-full ' + (done ? 'bg-emerald-400' : active ? 'bg-[#f0efe8]' : 'bg-[#3a3a32]')} />
                <span className="text-[10.5px] text-[#7a7a72] tracking-[0.02em]">{index + 1}</span>
                <span className="text-[11.5px]" style={{ letterSpacing: '-0.005em' }}>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="ic-scroll flex-1 overflow-y-auto px-7 pt-6 pb-2">
          {step === 0 && (
            <>
              <p className="text-[13px] text-[#c8c7be] leading-relaxed max-w-[60ch]">
                Name your action. Your agent will call this name through Igris instead of
                calling the tool directly.
              </p>
              <Section title="Identity">
                <label className="block mb-3">
                  <span className="mb-1.5 block text-[11.5px] text-[#a8a89e]">Action name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-8 w-full rounded-md border border-[var(--ig-border)] bg-[var(--ig-bg-chip)] px-3 text-[12px] text-[#e8e7df] outline-none focus:border-emerald-500/30"
                  />
                </label>
                <label className="block mb-3">
                  <span className="mb-1.5 block text-[11.5px] text-[#a8a89e]">Description</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-[74px] w-full rounded-md border border-[var(--ig-border)] bg-[var(--ig-bg-chip)] px-3 py-2 text-[12px] text-[#e8e7df] outline-none focus:border-emerald-500/30"
                  />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setName(example)}
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] bg-[var(--ig-bg-chip)] text-[#a8a89e] border border-[var(--ig-border)] hover:text-[#e8e7df]"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </Section>
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-[13px] text-[#c8c7be] leading-relaxed max-w-[60ch]">
                Where does this action run? Mock demo is the easiest first run — it requires
                no setup. Use a local runtime only when the action needs private/local access.
              </p>
              <Section title="Target">
                <div className="grid gap-2 md:grid-cols-2">
                  {TARGET_OPTIONS.map((opt) => {
                    const active = !opt.disabled && targetType === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => { if (!opt.disabled) setTargetType(opt.id as ActionTargetType); }}
                        disabled={opt.disabled}
                        className={
                          'text-left rounded-lg border px-3 py-3 transition-colors ' +
                          (opt.disabled
                            ? 'opacity-50 cursor-not-allowed border-[var(--ig-border)] bg-[var(--ig-bg-chip)]'
                            : active
                              ? 'border-emerald-500/30 bg-emerald-500/[0.08]'
                              : 'border-[var(--ig-border)] bg-[var(--ig-bg-chip)] hover:bg-[var(--ig-bg-surface)]')
                        }
                      >
                        <div className="flex items-center gap-2">
                          <span className={'block w-1.5 h-1.5 rounded-full ' + (active ? 'bg-emerald-400' : 'bg-[#3a3a32]')} />
                          <span className="text-[12.5px] text-[#e8e7df]">{opt.label}</span>
                          {opt.disabledReason && (
                            <span className="ml-auto text-[10.5px] text-[#7a7a72]">{opt.disabledReason}</span>
                          )}
                        </div>
                        <div className="mt-1.5 text-[11.5px] text-[#8a8a82] leading-relaxed">{opt.hint}</div>
                      </button>
                    );
                  })}
                </div>

                {(targetType === 'webhook' || targetType === 'hosted_api' || targetType === 'api') && (
                  <div className="grid gap-3 md:grid-cols-[1fr_120px] mt-4">
                    <label className="block">
                      <span className="mb-1.5 block text-[11.5px] text-[#a8a89e]">Target URL</span>
                      <input
                        value={targetUrl}
                        onChange={(e) => setTargetUrl(e.target.value)}
                        placeholder="https://api.example.com/send-email"
                        className="h-8 w-full rounded-md border border-[var(--ig-border)] bg-[var(--ig-bg-chip)] px-3 text-[12px] text-[#e8e7df] outline-none focus:border-emerald-500/30 placeholder:text-[#5a5a52]"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[11.5px] text-[#a8a89e]">Method</span>
                      <select
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                        className="h-8 w-full rounded-md border border-[var(--ig-border)] bg-[var(--ig-bg-chip)] px-3 text-[12px] text-[#e8e7df] outline-none"
                      >
                        {['POST', 'PUT', 'PATCH'].map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </label>
                  </div>
                )}
              </Section>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-[13px] text-[#c8c7be] leading-relaxed max-w-[60ch]">
                Choose how this action is gated. Policy and replay behavior are recorded on
                every run.
              </p>
              <Section title="Policy">
                <div className="grid gap-2 md:grid-cols-2">
                  {POLICY_PRESETS.map((preset) => {
                    const active = policyPreset === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => updatePreset(preset)}
                        className={
                          'text-left rounded-lg border px-3 py-3 transition-colors ' +
                          (active
                            ? 'border-emerald-500/30 bg-emerald-500/[0.08]'
                            : 'border-[var(--ig-border)] bg-[var(--ig-bg-chip)] hover:bg-[var(--ig-bg-surface)]')
                        }
                      >
                        <div className="flex items-center gap-2">
                          <span className={'block w-1.5 h-1.5 rounded-full ' + (active ? 'bg-emerald-400' : 'bg-[#3a3a32]')} />
                          <span className="text-[12.5px] text-[#e8e7df]">{preset}</span>
                        </div>
                        <div className="mt-1.5 text-[11.5px] text-[#8a8a82] leading-relaxed">{presetHint(preset)}</div>
                      </button>
                    );
                  })}
                </div>

                <label className="mt-4 flex items-center gap-2 text-[12px] text-[#c8c7be]">
                  <input
                    type="checkbox"
                    checked={approvalRequired}
                    onChange={(e) => setApprovalRequired(e.target.checked)}
                    className="accent-emerald-500"
                  />
                  Approval required before run
                </label>
              </Section>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-[13px] text-[#c8c7be] leading-relaxed max-w-[60ch]">
                This is the endpoint your agent calls. It replaces the direct tool call.
                Copy these snippets into your agent code.
              </p>
              <Section title="Endpoint">
                <div className="flex items-center gap-2 rounded-md border border-[var(--ig-border)] bg-[var(--ig-bg-chip)] px-3 py-2">
                  <span className="text-[10.5px] text-emerald-300 tracking-[0.02em] flex-shrink-0">POST</span>
                  <code className="flex-1 break-all text-[12px] text-[#d3d2c8]" style={{ fontFamily: 'inherit' }}>
                    {endpointFor(actionName)}
                  </code>
                  <CopyButton text={endpointFor(actionName)} />
                </div>
              </Section>
              <Section title="curl">
                <div className="relative">
                  <div className="absolute top-0 right-0 z-10">
                    <CopyButton text={snippetCurlText} />
                  </div>
                  <CodeBlock tokens={tokensForCurl(snippetCurlText)} />
                </div>
              </Section>
              <Section title="TypeScript fetch">
                <div className="relative">
                  <div className="absolute top-0 right-0 z-10">
                    <CopyButton text={snippetTsText} />
                  </div>
                  <CodeBlock tokens={tokensForTs(snippetTsText)} />
                </div>
              </Section>
            </>
          )}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[var(--ig-border)]">
          <div className="flex items-center gap-3 px-5 py-2.5">
            <button
              type="button"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11.5px] bg-[var(--ig-bg-chip)] text-[var(--ig-text-body)] border border-[var(--ig-border)] hover:bg-[var(--ig-bg-surface)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Back
            </button>
            <span className="text-[11.5px] text-[#7a7a72]">{STEPS[step]}</span>
            <div className="ml-auto flex items-center gap-2">
              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  disabled={!actionName}
                  className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-[11.5px] bg-emerald-500/[0.12] text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/[0.16] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continue →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={finishAction}
                  disabled={!canSave || mutation.isPending}
                  className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-[11.5px] bg-emerald-500/[0.12] text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/[0.16] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {mutation.isPending ? 'Creating…' : 'Create action'}
                </button>
              )}
            </div>
          </div>
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
