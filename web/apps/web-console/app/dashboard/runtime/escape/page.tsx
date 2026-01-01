'use client';

export const dynamic = 'force-dynamic';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, RefreshCw, TrendingUp, Database, Shield } from 'lucide-react';

export default function RuntimeEscapePage() {
  const cacheStats = {
    total_entries: 12847,
    hit_rate: 78.5,
    avg_response_time: 12,
    cache_size_mb: 234.5,
    requests_today: 15432,
    cache_hits_today: 12114,
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="pb-4 border-b border-border-light">
            <h1 className="text-base font-medium text-gray-900 font-inter">EscapeVector Cache</h1>
            <p className="text-gray-600 mt-1 font-inter text-xs">
              Emergency cache for graceful degradation during edge failures
            </p>
          </div>
          <Button variant="outline" size="sm" className="flex items-center gap-1 text-xs px-2 py-1">
            <RefreshCw className="h-3 w-3" />
            Clear Cache
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Cache Hit Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900">{cacheStats.hit_rate}%</div>
              <p className="text-xs text-gray-600 mt-1">Excellent performance</p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Avg Response</CardTitle>
              <Zap className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900">{cacheStats.avg_response_time}ms</div>
              <p className="text-xs text-gray-600 mt-1">From cache</p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Total Entries</CardTitle>
              <Database className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900">
                {(cacheStats.total_entries / 1000).toFixed(1)}K
              </div>
              <p className="text-xs text-gray-600 mt-1">{cacheStats.cache_size_mb} MB</p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Cache Hits Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900">
                {(cacheStats.cache_hits_today / 1000).toFixed(1)}K
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {((cacheStats.cache_hits_today / cacheStats.requests_today) * 100).toFixed(1)}% of requests
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <CardTitle className="text-xs">How EscapeVector Works</CardTitle>
            <CardDescription className="text-xs">AES-256-GCM encrypted emergency cache for Runtime</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-beige-primary border border-border-light rounded-lg p-4">
                <h4 className="text-xs font-medium text-gray-900 mb-3">Key Features</h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="mb-1">
                      <span className="font-medium text-gray-900">Encrypted Storage</span>
                    </div>
                    <p className="text-xs text-gray-600">AES-256-GCM encryption for cached responses</p>
                  </div>
                  <div>
                    <div className="mb-1">
                      <span className="font-medium text-gray-900">Graceful Degradation</span>
                    </div>
                    <p className="text-xs text-gray-600">Serves cached responses during edge failures</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="text-xs font-medium text-gray-900 mb-2">Emergency Failover Impact</h4>
                <ul className="text-xs text-gray-800 space-y-1 list-disc list-inside">
                  <li>78.5% of requests can be served during edge outages</li>
                  <li>Prevents complete service disruption during failures</li>
                  <li>Encrypted cache ensures data security even during degraded mode</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
