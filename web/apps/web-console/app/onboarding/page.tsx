'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowRight, Check, Building2, Zap, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const STEPS = ['workspace', 'usecase', 'done'] as const;
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

  const handleWorkspaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim()) return;
    setStep('usecase');
  };

  const handleUseCaseSubmit = async () => {
    setLoading(true);
    // Tenant is auto-provisioned by the Go backend on first authenticated request.
    await new Promise((r) => setTimeout(r, 600));
    setStep('done');
    setLoading(false);
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('workspace')}
                className="h-9 text-sm"
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={handleUseCaseSubmit}
                disabled={loading}
                className="flex-1 h-9 text-sm gap-1.5"
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 'done' && (
          <div className="bg-white dark:bg-[#1c1c1b] rounded-xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-black dark:bg-white rounded-full mb-5">
              <Check className="h-6 w-6 text-white dark:text-black" />
            </div>

            <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
              You're all set{workspaceName ? `, ${workspaceName}` : ''}
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
              Your workspace is ready. Head to the dashboard to get your API key and connect your first provider.
            </p>

            <div className="mt-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-left">
              <div className="flex items-start gap-3">
                <KeyRound className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Next: get your API key</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Go to Settings → API Keys to generate your first key and start sending inference requests.
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={() => router.replace('/dashboard')}
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
