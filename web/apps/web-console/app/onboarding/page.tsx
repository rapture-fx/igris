'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowRight, Check, Building2, Zap, KeyRound, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/apiClient';

const STEPS = ['workspace', 'usecase', 'apikey', 'done'] as const;
type Step = typeof STEPS[number];

const USE_CASES = [
  { id: 'inference', label: 'AI inference routing', description: 'Route requests across multiple LLM providers' },
  { id: 'cost', label: 'Cost optimization', description: 'Reduce spend with intelligent model selection' },
  { id: 'reliability', label: 'High reliability', description: 'Failover and circuit-breaker for uptime' },
  { id: 'observability', label: 'Observability', description: 'Traces, metrics, and audit logs' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('workspace');
  const [workspaceName, setWorkspaceName] = useState('');
  const [selectedUseCase, setSelectedUseCase] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [keyError, setKeyError] = useState('');

  const handleWorkspaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim()) return;
    setStep('usecase');
  };

  const handleUseCaseSubmit = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    setStep('apikey');
    setLoading(false);
  };

  const handleGenerateKey = async () => {
    setLoading(true);
    setKeyError('');
    try {
      const data = await api.post<{ api_key: string }>('/v1/account/api-key');
      setGeneratedKey(data.api_key);
    } catch (err: any) {
      setKeyError(err.message || 'Failed to generate API key. You can do this later in Settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="min-h-screen bg-[#f6f6f4] dark:bg-[#111110] flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mb-10">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i <= stepIndex
                  ? 'bg-black dark:bg-white w-6'
                  : 'bg-gray-200 dark:bg-gray-700 w-1.5'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Workspace name */}
        {step === 'workspace' && (
          <div className="bg-white dark:bg-[#1c1c1b] rounded-xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg mb-4">
                <Building2 className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                Name your workspace
              </h1>
              <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                This is how your team and projects will be identified.
              </p>
            </div>

            <form onSubmit={handleWorkspaceSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="workspace" className="text-xs text-gray-600 dark:text-gray-400">
                  Workspace name
                </Label>
                <Input
                  id="workspace"
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  required
                  placeholder="Acme AI, my-project…"
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full h-9 text-sm gap-1.5">
                Continue
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>
        )}

        {/* Step 2: Use case */}
        {step === 'usecase' && (
          <div className="bg-white dark:bg-[#1c1c1b] rounded-xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg mb-4">
                <Zap className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                What's your primary use case?
              </h1>
              <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                We'll tailor your setup. You can change this later.
              </p>
            </div>

            <div className="space-y-2 mb-6">
              {USE_CASES.map((uc) => (
                <button
                  key={uc.id}
                  type="button"
                  onClick={() => setSelectedUseCase(uc.id)}
                  className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${
                    selectedUseCase === uc.id
                      ? 'border-black dark:border-white bg-black/[0.03] dark:bg-white/[0.05]'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{uc.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{uc.description}</p>
                    </div>
                    {selectedUseCase === uc.id && (
                      <div className="flex-shrink-0 w-4 h-4 rounded-full bg-black dark:bg-white flex items-center justify-center ml-3">
                        <Check className="h-2.5 w-2.5 text-white dark:text-black" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep('workspace')} className="h-9 text-sm">
                Back
              </Button>
              <Button
                type="button"
                onClick={handleUseCaseSubmit}
                disabled={loading}
                className="flex-1 h-9 text-sm gap-1.5"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Continue <ArrowRight className="h-3.5 w-3.5" /></>}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: API Key */}
        {step === 'apikey' && (
          <div className="bg-white dark:bg-[#1c1c1b] rounded-xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg mb-4">
                <KeyRound className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                Get your API key
              </h1>
              <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                Your runtime uses this key to authenticate with Igris. Copy it — it's shown only once.
              </p>
            </div>

            {!generatedKey ? (
              <div className="space-y-4">
                {keyError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {keyError}
                  </p>
                )}
                <Button
                  type="button"
                  onClick={handleGenerateKey}
                  disabled={loading}
                  className="w-full h-9 text-sm gap-1.5"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Generate API Key <KeyRound className="h-3.5 w-3.5" /></>}
                </Button>
                <button
                  type="button"
                  onClick={() => setStep('done')}
                  className="w-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 py-1"
                >
                  Skip for now
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900/40 p-4">
                  <p className="text-xs font-medium text-green-800 dark:text-green-300 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Key generated
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-gray-800 dark:text-gray-200 flex-1 break-all bg-white dark:bg-black/20 rounded px-2 py-1.5 border border-green-100 dark:border-green-900/30">
                      {generatedKey}
                    </code>
                    <button
                      onClick={handleCopy}
                      className="flex-shrink-0 p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                      title="Copy"
                    >
                      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-green-600" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-green-700 dark:text-green-400 mt-2">
                    Save this key securely. You won't be able to see it again.
                  </p>
                </div>
                <Button type="button" onClick={() => setStep('done')} className="w-full h-9 text-sm gap-1.5">
                  {copied ? <><Check className="h-3.5 w-3.5" /> Copied — Continue</> : <>I've saved it — Continue <ArrowRight className="h-3.5 w-3.5" /></>}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Done */}
        {step === 'done' && (
          <div className="bg-white dark:bg-[#1c1c1b] rounded-xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-black dark:bg-white rounded-full mb-5">
              <Check className="h-6 w-6 text-white dark:text-black" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
              You're all set{workspaceName ? `, ${workspaceName}` : ''}
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
              Your workspace is ready. Head to the dashboard to connect your first provider.
            </p>
            <Button
              onClick={() => {
                try { localStorage.setItem('igris_onboarding_complete', '1'); } catch {}
                router.replace('/home');
              }}
              className="mt-6 w-full h-9 text-sm gap-1.5"
            >
              Open dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
