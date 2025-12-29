'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Play, Square, CheckCircle, XCircle } from 'lucide-react';

export default function OvertureShadowPage() {
  const [shadowMode, setShadowMode] = useState({
    enabled: true,
    primary_provider: 'OpenAI',
    shadow_provider: 'Anthropic',
    traffic_percentage: 10,
    requests_shadowed: 2847,
    discrepancies_found: 12,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="pb-4 border-b border-border-light">
            <h1 className="text-base font-medium text-gray-900 font-inter">Shadow Mode</h1>
            <p className="text-gray-600 mt-1 font-inter text-xs">
              Compare provider responses in real-time without affecting production
            </p>
          </div>
          <Button
            variant={shadowMode.enabled ? 'destructive' : 'default'}
            onClick={() => setShadowMode({ ...shadowMode, enabled: !shadowMode.enabled })}
          >
            {shadowMode.enabled ? (
              <>
                <Square className="h-4 w-4 mr-2" />
                Stop Shadow Mode
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Shadow Mode
              </>
            )}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Status</CardTitle>
              <Shield className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <Badge className={`${shadowMode.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700'} border`}>
                {shadowMode.enabled ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                {shadowMode.enabled ? 'Active' : 'Inactive'}
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Traffic</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{shadowMode.traffic_percentage}%</div>
              <p className="text-xs text-gray-600 mt-1">of requests shadowed</p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Discrepancies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{shadowMode.discrepancies_found}</div>
              <p className="text-xs text-gray-600 mt-1">found in {shadowMode.requests_shadowed} requests</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Primary and shadow provider settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-beige-primary border border-border-light rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-600 mb-2">Primary Provider</div>
                  <div className="text-lg font-medium text-gray-900">{shadowMode.primary_provider}</div>
                  <div className="text-xs text-gray-600 mt-1">Serves production traffic</div>
                </div>
                <div className="bg-beige-primary border border-border-light rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-600 mb-2">Shadow Provider</div>
                  <div className="text-lg font-medium text-gray-900">{shadowMode.shadow_provider}</div>
                  <div className="text-xs text-gray-600 mt-1">Receives duplicate requests</div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-yellow-900 mb-2">How Shadow Mode Works</h4>
                <ul className="text-xs text-yellow-800 space-y-1 list-disc list-inside">
                  <li>Duplicate requests sent to shadow provider</li>
                  <li>Primary responses returned to users (no impact on production)</li>
                  <li>Responses compared for quality and consistency</li>
                  <li>Discrepancies logged for analysis</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
