'use client';

export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Shield, Lock, Zap, Users, TrendingUp, Settings } from 'lucide-react';

export default function PolicyPage() {
  const [selectedPolicy, setSelectedPolicy] = useState<string>('balanced');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-medium text-gray-900 font-inter">
            Your Global Routing Policy
          </h1>
          <p className="text-gray-600 mt-1 font-inter">
            Schlep Engine runs Thompson Sampling Bayesian optimization under the hood — always.
          </p>
        </div>

        {/* Routing Mode Selection */}
        <Card className="border-border-light shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-medium">
              <Shield className="h-5 w-5 text-gray-900" />
              Routing Strategy
            </CardTitle>
            <CardDescription>
              Choose how Schlep Engine optimizes your requests
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Cost Mode */}
            <div
              className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all ${
                selectedPolicy === 'cost'
                  ? 'bg-beige-primary shadow-md border-border-light'
                  : 'border-border-light hover:bg-beige-primary'
              }`}
              onClick={() => setSelectedPolicy('cost')}
            >
              <input
                type="radio"
                name="policy"
                value="cost"
                checked={selectedPolicy === 'cost'}
                onChange={(e) => setSelectedPolicy(e.target.value)}
                className="mt-1 accent-gray-900"
              />
              <div className="flex-1">
                <Label className="text-base font-medium text-gray-900 cursor-pointer">
                  Cost
                </Label>
                <p className="text-sm text-gray-600 mt-1">
                  Minimize spend while maintaining acceptable quality
                </p>
              </div>
            </div>

            {/* Balanced Mode (Default) */}
            <div
              className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all ${
                selectedPolicy === 'balanced'
                  ? 'bg-beige-primary shadow-md border-border-light'
                  : 'border-border-light hover:bg-beige-primary'
              }`}
              onClick={() => setSelectedPolicy('balanced')}
            >
              <input
                type="radio"
                name="policy"
                value="balanced"
                checked={selectedPolicy === 'balanced'}
                onChange={(e) => setSelectedPolicy(e.target.value)}
                className="mt-1 accent-gray-900"
              />
              <div className="flex-1">
                <Label className="text-base font-medium text-gray-900 cursor-pointer">
                  Balanced <span className="text-xs text-gray-600">(recommended)</span>
                </Label>
                <p className="text-sm text-gray-600 mt-1">
                  Optimal mix of cost efficiency and response quality
                </p>
              </div>
            </div>

            {/* Quality Mode */}
            <div
              className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all ${
                selectedPolicy === 'quality'
                  ? 'bg-beige-primary shadow-md border-border-light'
                  : 'border-border-light hover:bg-beige-primary'
              }`}
              onClick={() => setSelectedPolicy('quality')}
            >
              <input
                type="radio"
                name="policy"
                value="quality"
                checked={selectedPolicy === 'quality'}
                onChange={(e) => setSelectedPolicy(e.target.value)}
                className="mt-1 accent-gray-900"
              />
              <div className="flex-1">
                <Label className="text-base font-medium text-gray-900 cursor-pointer">
                  Quality
                </Label>
                <p className="text-sm text-gray-600 mt-1">
                  Prioritize best possible output, cost is secondary
                </p>
              </div>
            </div>

            {/* Custom Mode (Coming Soon) */}
            <div
              className="flex items-start gap-4 p-4 rounded-lg border border-border-light bg-beige-primary opacity-60 cursor-not-allowed"
            >
              <input
                type="radio"
                name="policy"
                value="custom"
                disabled
                className="mt-1"
              />
              <div className="flex-1">
                <Label className="text-base font-medium text-gray-600 cursor-not-allowed">
                  Custom <span className="text-xs">(coming soon)</span>
                </Label>
                <p className="text-sm text-gray-500 mt-1">
                  Fine-tune parameters for your specific use case
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Advanced Features */}
        <Card className="border-border-light shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-medium">
              <Zap className="h-5 w-5 text-gray-900" />
              Advanced Features
            </CardTitle>
            <CardDescription>
              Unlock premium capabilities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Speculative Execution */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border-light bg-beige-primary">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-medium text-gray-900">
                    Speculative Execution
                  </Label>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  -60% time-to-first-token through parallel execution
                </p>
              </div>
              <Switch />
            </div>

            {/* Council Mode */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border-light bg-beige-primary">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-medium text-gray-900">
                    Council Mode
                  </Label>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  +15-20% answer quality through multi-model consensus
                </p>
              </div>
              <Switch />
            </div>

            {/* Cognitive Advisor */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border-light bg-beige-primary">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-medium text-gray-900">
                    Cognitive Advisor
                  </Label>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Auto-tuning ML layer for continuous optimization
                </p>
              </div>
              <Switch />
            </div>

            {/* Advanced Routing Rules */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border-light bg-beige-primary opacity-60">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-medium text-gray-600 cursor-not-allowed">
                    Advanced routing rules <span className="text-xs">(coming soon)</span>
                  </Label>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Custom routing logic and conditional forwarding
                </p>
              </div>
              <Switch disabled className="cursor-not-allowed" />
            </div>
          </CardContent>
        </Card>

        {/* EscapeVector Mode Notice */}
        <Card className="border-border-light shadow-md bg-green-50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <Shield className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium text-green-900 font-inter mb-1">
                  EscapeVector Mode Active
                </h3>
                <p className="text-sm text-green-700 font-inter">
                  Even if our control plane is down for 72+ hours, EscapeVector Mode keeps this exact policy running offline.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button variant="outline" className="shadow-md">
            Save Policy
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
