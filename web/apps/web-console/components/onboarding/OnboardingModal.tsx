'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useGenerateApiKey } from '@/hooks/useApiKey';
import { useTenant } from '@/hooks/useTenant';
import { useOnboarding } from '@/hooks/useOnboarding';
import { api } from '@/lib/apiClient';
import {
  KeyRound,
  Copy,
  Check,
  AlertTriangle,
  Terminal,
  RefreshCw,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ChevronLeft,
  Wifi,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

interface Device {
  device_id: string;
  status: 'online' | 'offline';
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDots({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-1.5">
      {([1, 2, 3] as Step[]).map((n) => (
        <span
          key={n}
          className={[
            'rounded-full transition-all duration-200',
            n === current
              ? 'h-1.5 w-4 bg-gray-900 dark:bg-[#f6f6f4]'
              : n < current
              ? 'h-1.5 w-1.5 bg-gray-400 dark:bg-[#f6f6f4]/40'
              : 'h-1.5 w-1.5 bg-gray-200 dark:bg-[#f6f6f4]/15',
          ].join(' ')}
        />
      ))}
      <span className="ml-1 text-[11px] text-gray-400 dark:text-[#f6f6f4]/40 tabular-nums">
        {current} of 3
      </span>
    </div>
  );
}

// ─── Inline copy button ───────────────────────────────────────────────────────

function CopyBtn({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 text-xs gap-1.5 shrink-0"
      onClick={handleCopy}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-green-500" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          {label}
        </>
      )}
    </Button>
  );
}

// ─── Step 1 — Generate API Key ────────────────────────────────────────────────

function StepGenerateKey({
  onNext,
  onSkip,
  apiKey,
  setApiKey,
}: {
  onNext: () => void;
  onSkip: () => void;
  apiKey: string | null;
  setApiKey: (key: string) => void;
}) {
  const generateApiKey = useGenerateApiKey();

  const handleGenerate = () => {
    generateApiKey.mutate(undefined, {
      onSuccess: (data) => {
        setApiKey(data.api_key);
      },
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-1">
          <KeyRound className="h-3.5 w-3.5" />
          Generate your runtime API key
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          This key authenticates the igris-runtime installer with your account.
          You only need one key to connect unlimited runtime nodes on your plan.
        </p>
      </div>

      <Separator />

      {apiKey ? (
        <div className="space-y-3">
          {/* Warning banner */}
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Save this key now — it will not be shown again after you leave this step.
            </p>
          </div>

          {/* Key display */}
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 rounded-md border border-gray-200 dark:border-[#f6f6f4]/10 bg-gray-50 dark:bg-[#1b1912] px-3 py-2 text-xs font-mono text-gray-800 dark:text-gray-200 break-all">
              {apiKey}
            </code>
            <CopyBtn value={apiKey} />
          </div>

          <Button
            size="sm"
            className="h-8 text-xs gap-1.5 bg-gray-900 hover:bg-gray-800 text-white dark:bg-[#f6f6f4] dark:text-[#25231e] dark:hover:bg-[#e0e0d8]"
            onClick={onNext}
          >
            Next: Install Runtime
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 dark:text-gray-500">No API key generated yet.</p>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5 bg-gray-900 hover:bg-gray-800 text-white dark:bg-[#f6f6f4] dark:text-[#25231e] dark:hover:bg-[#e0e0d8]"
            onClick={handleGenerate}
            disabled={generateApiKey.isPending}
          >
            {generateApiKey.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <KeyRound className="h-3.5 w-3.5" />
                Generate API Key
              </>
            )}
          </Button>
          {generateApiKey.isError && (
            <p className="text-xs text-red-600">
              Failed to generate key. Please try again.
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <button
          onClick={onSkip}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

// ─── Step 2 — Install Runtime ─────────────────────────────────────────────────

function StepInstallRuntime({
  apiKey,
  onNext,
  onBack,
  onSkip,
}: {
  apiKey: string | null;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const keyPlaceholder = apiKey ?? 'igris_xxxxxxxxxxxx';
  const installCommand = `IGRIS_API_KEY=${keyPlaceholder} curl -fsSL https://igrisinertial.com/install | bash`;

  // Poll /devices every 5 seconds to detect a newly-registered runtime
  const { data: devices = [] } = useQuery<Device[]>({
    queryKey: ['onboarding-devices-poll'],
    queryFn: async () => {
      try {
        return await api.get<Device[]>('/devices');
      } catch {
        return [];
      }
    },
    refetchInterval: 5000,
    retry: false,
  });

  const hasRuntime = devices.length > 0;

  // Auto-advance when a device is detected
  useEffect(() => {
    if (hasRuntime) {
      // Brief pause so user can see the "detected" state before advancing
      const t = setTimeout(() => onNext(), 1200);
      return () => clearTimeout(t);
    }
  }, [hasRuntime, onNext]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-1">
          <Terminal className="h-3.5 w-3.5" />
          Install igris-runtime
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Run the command below on any machine where you want the runtime to operate.
          The installer sets up the daemon and registers it with your account automatically.
        </p>
      </div>

      <Separator />

      {/* Install command block */}
      <div className="space-y-2">
        <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Install command
        </p>
        <div className="rounded-md border border-gray-200 dark:border-[#f6f6f4]/10 bg-gray-50 dark:bg-[#1b1912] overflow-hidden">
          <div className="flex items-start justify-between gap-2 px-3 py-2.5">
            <code className="text-xs font-mono text-gray-800 dark:text-gray-200 break-all leading-relaxed">
              {installCommand}
            </code>
            <CopyBtn value={installCommand} label="Copy" />
          </div>
        </div>
        {!apiKey && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            Replace <code className="font-mono">igris_xxxxxxxxxxxx</code> with your actual API key.
            Go back to generate one first.
          </p>
        )}
      </div>

      {/* Detection status */}
      <div
        className={[
          'flex items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors duration-300',
          hasRuntime
            ? 'border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800'
            : 'border-gray-200 dark:border-[#f6f6f4]/10 bg-gray-50 dark:bg-[#1b1912]',
        ].join(' ')}
      >
        {hasRuntime ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
            <span className="text-green-700 dark:text-green-400 font-medium">
              Runtime detected — {devices.length} node{devices.length !== 1 ? 's' : ''} online
            </span>
          </>
        ) : (
          <>
            <Wifi className="h-3.5 w-3.5 text-gray-400 shrink-0 animate-pulse" />
            <span className="text-gray-500 dark:text-gray-400">
              Checking for runtime connection…
            </span>
          </>
        )}
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          onClick={onBack}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex items-center gap-1"
        >
          <ChevronLeft className="h-3 w-3" />
          Back
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={onSkip}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Skip for now
          </button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={onNext}
          >
            Skip this step
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 3 — Done ────────────────────────────────────────────────────────────

function StepDone({
  runtimeDetected,
  onBack,
  onFinish,
}: {
  runtimeDetected: boolean;
  onBack: () => void;
  onFinish: () => void;
}) {
  const { data: tenant } = useTenant();
  const displayName = tenant?.name ?? 'there';

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center text-center py-4 gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-[#2c2a22]">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-[#f6f6f4]">
            You&apos;re all set, {displayName.split(' ')[0]}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
            {runtimeDetected
              ? 'Your runtime is connected and ready to govern AI executions.'
              : 'Your API key is generated. Connect a runtime node any time from the Fleet page.'}
          </p>
        </div>
      </div>

      <Separator />

      {/* Quick links */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
          Get started
        </p>
        <div className="grid grid-cols-1 gap-1.5">
          {[
            { label: 'Open Executions', href: '/execution/tasks', sub: 'Inspect what ran, recovered, and proved' },
            { label: 'View your runtimes', href: '/runtimes', sub: 'Monitor connected runtime nodes' },
            { label: 'Manage API keys', href: '/settings/keys', sub: 'Add provider and vault keys' },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={onFinish}
              className="flex items-center justify-between gap-3 rounded-md border border-gray-200 dark:border-[#f6f6f4]/10 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-[#2c2a22] transition-colors group"
            >
              <div>
                <p className="text-xs font-medium text-gray-800 dark:text-[#f6f6f4]">{link.label}</p>
                <p className="text-[11px] text-gray-400">{link.sub}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 dark:group-hover:text-gray-300 transition-colors shrink-0" />
            </a>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          onClick={onBack}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex items-center gap-1"
        >
          <ChevronLeft className="h-3 w-3" />
          Back
        </button>

        <Button
          size="sm"
          className="h-8 text-xs gap-1.5 bg-gray-900 hover:bg-gray-800 text-white dark:bg-[#f6f6f4] dark:text-[#25231e] dark:hover:bg-[#e0e0d8]"
          onClick={onFinish}
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function OnboardingModal() {
  const { shouldShow, isReady, markComplete } = useOnboarding();
  const [step, setStep] = useState<Step>(1);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [runtimeDetected, setRuntimeDetected] = useState(false);

  // Not ready yet — don't render anything
  if (!isReady || !shouldShow) return null;

  const handleSkip = () => markComplete();

  const handleFinish = () => markComplete();

  const handleStep2Next = () => {
    // Check if runtime was detected by the poll in StepInstallRuntime
    // The auto-advance sets runtimeDetected=true before calling onNext
    setStep(3);
  };

  const handleRuntimeDetected = () => {
    setRuntimeDetected(true);
    setStep(3);
  };

  const STEP_TITLES: Record<Step, string> = {
    1: 'Generate API Key',
    2: 'Install Runtime',
    3: 'Ready to go',
  };

  return (
    <Dialog
      open
      // Prevent outside-click dismissal: onOpenChange fires for overlay clicks
      // but we only act on it when explicitly completing/skipping
      onOpenChange={() => {}}
    >
      <DialogContent
        className="max-w-md p-0 gap-0 border border-gray-200 dark:border-[#f6f6f4]/10 bg-white dark:bg-[#1b1912] shadow-lg"
        // Remove the default close button provided by shadcn DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-0">
          <div className="flex items-center justify-between mb-3">
            <StepDots current={step} />
            <button
              onClick={handleSkip}
              className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              Skip setup
            </button>
          </div>
          <DialogTitle className="text-sm font-semibold text-gray-900 dark:text-[#f6f6f4]">
            {STEP_TITLES[step]}
          </DialogTitle>
        </DialogHeader>

        {/* Body */}
        <div className="px-5 pb-5 pt-4">
          {step === 1 && (
            <StepGenerateKey
              onNext={() => setStep(2)}
              onSkip={handleSkip}
              apiKey={generatedKey}
              setApiKey={setGeneratedKey}
            />
          )}
          {step === 2 && (
            <StepInstallRuntime
              apiKey={generatedKey}
              onNext={handleStep2Next}
              onBack={() => setStep(1)}
              onSkip={handleSkip}
            />
          )}
          {step === 3 && (
            <StepDone
              runtimeDetected={runtimeDetected}
              onBack={() => setStep(2)}
              onFinish={handleFinish}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
