'use client';

export const dynamic = 'force-dynamic';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUsageSummary } from '@/hooks/useUsage';
import { useVaultKeys } from '@/hooks/useVault';
import { formatCurrency, formatNumber } from '@/utils/helpers';
import { DollarSign, Activity, KeyRound, Shield } from 'lucide-react';

export default function DashboardPage() {
  const { data: summary, isLoading: summaryLoading } = useUsageSummary();
  const { data: providers, isLoading: providersLoading } = useVaultKeys();

  const isLoading = summaryLoading || providersLoading;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </DashboardLayout>
    );
  }

  const activeProviders = providers?.filter(p => p.status === 'active').length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-medium text-gray-900 font-inter">
            Dashboard
          </h1>
          <p className="text-gray-600 mt-1 font-inter">
            Overview of your AI inference infrastructure
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border-light shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Requests
              </CardTitle>
              <Activity className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {formatNumber(summary?.total_requests || 0)}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                All time
              </p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Spend
              </CardTitle>
              <DollarSign className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(summary?.monthly_spend || 0)}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                This month
              </p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Active Providers
              </CardTitle>
              <KeyRound className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{activeProviders}</div>
              <p className="text-xs text-gray-600 mt-1">
                {providers?.length || 0} total configured
              </p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Current Policy
              </CardTitle>
              <Shield className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">Balanced</div>
              <p className="text-xs text-gray-600 mt-1">
                Optimized routing
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
