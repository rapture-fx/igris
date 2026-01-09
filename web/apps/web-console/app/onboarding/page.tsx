'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Cloud, Cpu, Globe, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';
import HeroInertial from '@/components/ui/HeroInertial';

type Intent = 'cloud' | 'edge' | 'hybrid';

interface IntentOption {
  id: Intent;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  features: string[];
}

const intentOptions: IntentOption[] = [
  {
    id: 'cloud',
    title: 'Cloud (Overture)',
    description: 'Building an AI app',
    icon: Cloud,
    features: [
      'Multi-provider routing',
      'Automatic failover',
      'Cost optimization',
      'Usage analytics',
    ],
  },
  {
    id: 'edge',
    title: 'Edge (Runtime)',
    description: 'Deploying AI in the real world',
    icon: Cpu,
    features: [
      'Local model execution',
      'Fleet management',
      'Low-latency inference',
      'Training & fine-tuning',
    ],
  },
  {
    id: 'hybrid',
    title: 'Hybrid (Cloud + Edge)',
    description: 'Best of both worlds for complex deployments',
    icon: Globe,
    features: [
      'Cloud + Edge routing',
      'Unified observability',
      'Flexible deployment',
      'Advanced orchestration',
    ],
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [step, setStep] = useState(1);
  const [selectedIntent, setSelectedIntent] = useState<Intent | null>(null);
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState({
    providerApiKey: '',
    edgeToken: '',
  });
  const [copied, setCopied] = useState(false);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/auth');
    }
  }, [isLoaded, user, router]);

  const handleIntentSelect = (intent: Intent) => {
    setSelectedIntent(intent);
  };

  const handleContinueFromIntent = () => {
    if (!selectedIntent) {
      toast({
        title: 'Please select an option',
        description: 'Choose what you want to build to continue',
        variant: 'destructive',
      });
      return;
    }
    setStep(2);
  };

  const handleCompleteOnboarding = async () => {
    if (!user || !selectedIntent) return;

    setLoading(true);

    try {
      // Update metadata
      await user.update({
        unsafeMetadata: {
          intent: selectedIntent,
          onboardingCompleted: true,
          setupData: selectedIntent === 'cloud' || selectedIntent === 'hybrid' ? {
            hasProviderKey: !!setupData.providerApiKey,
          } : selectedIntent === 'edge' || selectedIntent === 'hybrid' ? {
            hasEdgeToken: !!setupData.edgeToken,
          } : {},
        },
      });

      // Force reload user to refresh session claims
      await user.reload();

      // Small delay to ensure session is updated
      await new Promise(resolve => setTimeout(resolve, 500));

      // Redirect with bypass parameter
      window.location.href = '/dashboard?onboarding=complete';
    } catch (error: any) {
      console.error('Onboarding error:', error);
      alert('Error completing onboarding: ' + error.message);
      setLoading(false);
    }
  };

  const handleSkipSetup = async () => {
    if (!user || !selectedIntent) return;

    setLoading(true);

    try {
      // Update metadata
      await user.update({
        unsafeMetadata: {
          intent: selectedIntent,
          onboardingCompleted: true,
        },
      });

      // Force reload user to refresh session claims
      await user.reload();

      // Small delay to ensure session is updated
      await new Promise(resolve => setTimeout(resolve, 500));

      // Redirect with bypass parameter
      window.location.href = '/dashboard?onboarding=complete';
    } catch (error: any) {
      console.error('Onboarding error:', error);
      alert('Error completing onboarding: ' + error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative" style={{
      backgroundImage: 'linear-gradient(rgba(246, 246, 244, 0.3), rgba(246, 246, 244, 0.3)), url(/cloudbg.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center top -100px',
      backgroundRepeat: 'no-repeat',
      backgroundColor: '#f6f6f4'
    }}>
      {/* Logo */}
      <div className="absolute top-6 left-8 z-10">
        <img
          src="/footers.png"
          alt="Igris Logo"
          style={{ width: '25px', height: 'auto' }}
        />
      </div>

      {/* Three.js Animation Background */}
      <div className="absolute inset-0 pointer-events-none" style={{ height: '100vh', width: '100%', opacity: 0.3 }}>
        <HeroInertial />
      </div>

      {/* Main Content */}
      <div className="w-full flex items-center justify-center px-8 py-12 relative z-10">
        <div className="w-full max-w-4xl">
          {/* Step 1: Intent Selection */}
          {step === 1 && (
            <div>
              <div className="mb-8 text-center">
                <h1 className="text-base font-medium text-gray-900 font-inter">
                  Welcome to Igris Inertial!
                </h1>
                <p className="text-sm text-gray-600 font-inter">
                  Let's get you set up. What are you building?
                </p>
              </div>

              <div className="grid gap-2 mb-8 max-w-xs mx-auto">
                {intentOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = selectedIntent === option.id;

                  return (
                    <button
                      key={option.id}
                      onClick={() => handleIntentSelect(option.id)}
                      className={`p-3 rounded-md border transition-all duration-200 text-left max-w-xs ${
                        isSelected
                          ? 'border-gray-300 shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_0_rgba(0,0,0,0.06)]'
                          : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: '#f6f6f4' }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xs font-medium text-gray-900 font-inter mb-1 truncate">
                            {option.title}
                          </h3>
                          <p className="text-[9px] text-gray-600 font-inter truncate">
                            {option.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-center">
                <Button
                  onClick={handleContinueFromIntent}
                  disabled={!selectedIntent}
                  size="sm"
                  className="px-4 rounded-lg text-xs font-medium"
                  style={{ backgroundColor: '#000000' }}
                >
                  Continue
                  <ArrowRight className="ml-2 h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Quick Setup */}
          {step === 2 && selectedIntent && (
            <div>
              <div className="mb-8 text-center">
                <h2 className="text-xl font-medium text-gray-900 font-inter mb-2">
                  Quick Start
                </h2>
                <p className="text-sm text-gray-600 font-inter">
                  {selectedIntent === 'cloud' && 'Add your first AI provider to get started'}
                  {selectedIntent === 'edge' && 'Download the Runtime binary to deploy at the edge'}
                  {selectedIntent === 'hybrid' && 'Set up both cloud and edge components'}
                </p>
              </div>

              <div className="max-w-md mx-auto">
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-900">
                    {selectedIntent === 'cloud' && 'Add Provider API Key'}
                    {selectedIntent === 'edge' && 'Configure Runtime Token'}
                    {selectedIntent === 'hybrid' && 'Initial Setup'}
                  </h3>
                  <p className="text-xs text-gray-600 mt-1">
                    {selectedIntent === 'cloud' && 'Connect to OpenAI, Anthropic, Google, or other providers'}
                    {selectedIntent === 'edge' && 'Set up your edge device for local inference'}
                    {selectedIntent === 'hybrid' && 'Configure both cloud and edge components'}
                  </p>
                </div>
                <div className="space-y-4">
                  {(selectedIntent === 'cloud' || selectedIntent === 'hybrid') && (
                    <div>
                      <label
                        htmlFor="providerApiKey"
                        className="block text-xs mb-1.5 font-inter text-gray-900"
                      >
                        Provider API Key (Optional)
                      </label>
                      <input
                        type="password"
                        id="providerApiKey"
                        value={setupData.providerApiKey}
                        onChange={(e) =>
                          setSetupData({ ...setupData, providerApiKey: e.target.value })
                        }
                        placeholder="sk-..."
                        className="w-full px-3 py-2 rounded-lg border font-inter focus:outline-none text-xs"
                        style={{
                          borderColor: 'rgba(156, 163, 175, 0.3)',
                          backgroundColor: '#f6f6f4',
                        }}
                      />
                      <p className="text-[8px] text-gray-600 font-inter mt-1">
                        You can add this later in Settings → Providers
                      </p>
                    </div>
                  )}

                  {(selectedIntent === 'edge' || selectedIntent === 'hybrid') && (
                    <div className="mt-8">
                      <label
                        htmlFor="edgeToken"
                        className="block text-xs mb-1.5 font-inter text-gray-900"
                      >
                        Runtime Configuration (Optional)
                      </label>
                      <p className="text-xs text-gray-700 font-inter mb-2">
                          Download the Runtime binary:
                        </p>
                        <div className="relative">
                          <input
                        type="text"
                        readOnly
                        value="curl -sSL https://install.igris.dev | sh"
                        className="block w-full p-2 pr-10 rounded bg-[#f6f6f4] border border-border-light text-xs text-gray-900 font-mono focus:outline-none focus:ring-0"
                      />
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText('curl -sSL https://install.igris.dev | sh');
                          setCopied(true);
                          setTimeout(() => {
                            setCopied(false);
                          }, 2000);
                        }}
                        className="absolute right-2 top-2 p-1.5 text-gray-600 hover:text-gray-800 transition-colors"
                        title="Copy to clipboard"
                      >
                        {copied ? (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"></path>
                          </svg>
                        ) : (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                        </div>
                        <p className="text-[8px] text-gray-600 font-inter">
                          Full setup guide available in Dashboard → Runtime → Fleet
                        </p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4 justify-center">
                    <Button
                      variant="outline"
                      onClick={handleSkipSetup}
                      disabled={loading}
                      className="w-24 h-8 text-xs shadow-sm rounded-md"
                    >
                      Skip
                    </Button>
                    <Button
                      onClick={handleCompleteOnboarding}
                      disabled={loading}
                      className="w-24 h-8 text-xs shadow-sm rounded-md"
                      style={{ backgroundColor: '#000000' }}
                    >
                      {loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                      {loading ? '...' : 'Continue'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
