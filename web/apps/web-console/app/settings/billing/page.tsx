'use client';

import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/apiClient';
import { Zap, ExternalLink, ArrowUpRight } from 'lucide-react';

interface SubscriptionStatus {
  tier: string;
  tier_name: string;
  monthly_price_cents: number;
  subscription_status: string;
  runtimes: {
    used: number;
    limit: number;
    percent: number;
  };
  upgrade_tier: string;
  current_period_end: string;
}

interface Plan {
  tier_id: string;
  name: string;
  monthly_price_usd: number;
  runtime_limit: number;
  checkout_url: string;
}

const TIER_ORDER = ['seed', 'horizon', 'infinite'];

function statusColor(status: string) {
  if (status === 'active') return 'bg-green-100 text-green-700 border-green-200';
  if (status === 'past_due') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  if (status === 'canceled') return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

export default function BillingPage() {
  const { data: status, isLoading: statusLoading } = useQuery<SubscriptionStatus>({
    queryKey: ['subscription-status'],
    queryFn: () => api.get('/api/subscription/status'),
    retry: false,
  });

  const { data: plansData, isLoading: plansLoading } = useQuery<{ plans: Plan[] }>({
    queryKey: ['subscription-plans'],
    queryFn: () => api.get('/api/subscription/plans'),
    retry: false,
  });

  const plans = plansData?.plans ?? [];
  const currentTierIndex = TIER_ORDER.indexOf(status?.tier ?? '');

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">

        {/* Page Header */}
        <div>
          <h1 className="text-base font-semibold text-gray-900">Billing</h1>
          <p className="text-xs text-gray-500 mt-0.5">Subscription plan and runtime usage.</p>
        </div>

        {/* Current Plan Card */}
        <Card className="border border-gray-200">
          <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-gray-700" />
              Current Plan
            </CardTitle>
            {status && (
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded border ${statusColor(status.subscription_status)}`}
              >
                {status.subscription_status}
              </span>
            )}
          </CardHeader>
          <Separator />
          <CardContent className="px-4 py-4 space-y-4">
            {statusLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-2 w-full" />
              </div>
            ) : status ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-semibold text-gray-900 capitalize">
                    {status.tier_name}
                  </span>
                  <span className="text-sm text-gray-500">
                    ${Math.round(status.monthly_price_cents / 100)} / month
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-gray-500 font-medium">Runtime instances</span>
                    <span className="tabular-nums font-medium text-gray-900">
                      {status.runtimes.used} / {status.runtimes.limit}
                    </span>
                  </div>
                  <Progress value={status.runtimes.percent} className="h-2" />
                  {status.runtimes.percent >= 80 && status.runtimes.percent < 100 && (
                    <p className="text-[11px] text-yellow-700 mt-1.5">
                      Approaching runtime limit. Consider upgrading soon.
                    </p>
                  )}
                  {status.runtimes.percent >= 100 && (
                    <p className="text-[11px] text-red-600 mt-1.5">
                      Runtime limit reached. Upgrade to register additional instances.
                    </p>
                  )}
                </div>

                {status.current_period_end && (
                  <p className="text-[11px] text-gray-400">
                    Current period ends {status.current_period_end}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">No active subscription found.</p>
            )}
          </CardContent>
        </Card>

        {/* Upgrade Plans */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Available Plans
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {plansLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="border border-gray-200">
                    <CardContent className="px-4 py-4 space-y-3">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-8 w-full" />
                    </CardContent>
                  </Card>
                ))
              : plans.map((plan, i) => {
                  const isCurrent = plan.tier_id === status?.tier;
                  const isDowngrade = i < currentTierIndex;

                  return (
                    <Card
                      key={plan.tier_id}
                      className={`border ${isCurrent ? 'border-gray-900' : 'border-gray-200'}`}
                    >
                      <CardContent className="px-4 py-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-900 capitalize">
                            {plan.name}
                          </span>
                          {isCurrent && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                              Current
                            </Badge>
                          )}
                        </div>

                        <div>
                          <span className="text-lg font-bold text-gray-900">
                            ${plan.monthly_price_usd}
                          </span>
                          <span className="text-xs text-gray-500"> / mo</span>
                        </div>

                        <p className="text-xs text-gray-500">
                          {plan.runtime_limit} runtime{plan.runtime_limit !== 1 ? 's' : ''}
                        </p>

                        {isCurrent ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-8 text-xs"
                            onClick={() =>
                              window.open(
                                'https://polar.sh/igris-inertial/portal',
                                '_blank',
                                'noopener,noreferrer',
                              )
                            }
                          >
                            Manage
                            <ExternalLink className="ml-1.5 h-3 w-3" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="w-full h-8 text-xs"
                            variant={isDowngrade ? 'outline' : 'default'}
                            onClick={() =>
                              window.open(plan.checkout_url, '_blank', 'noopener,noreferrer')
                            }
                          >
                            {isDowngrade ? 'Downgrade' : 'Upgrade'}
                            <ArrowUpRight className="ml-1.5 h-3 w-3" />
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
          </div>
        </div>

        {/* Polar Portal Link */}
        <p className="text-[11px] text-gray-400">
          Manage invoices, payment methods, and cancellation via the{' '}
          <a
            href="https://polar.sh/igris-inertial/portal"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 underline"
          >
            Polar billing portal
          </a>
          .
        </p>
      </div>
    </DashboardLayout>
  );
}
