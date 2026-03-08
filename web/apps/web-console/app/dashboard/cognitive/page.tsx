'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/apiClient';
import { Lightbulb, CheckCircle, XCircle, Clock, TrendingUp, AlertTriangle } from 'lucide-react';

interface CognitiveProposal {
  id: string;
  title: string;
  description: string;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  created_at: string;
  impact: 'high' | 'medium' | 'low';
  category: 'performance' | 'cost' | 'reliability' | 'quality';
  details: {
    current_value: string;
    proposed_value: string;
    estimated_improvement: string;
  };
}

export default function CognitiveAdvisorPage() {
  const { data: proposals = [], isLoading } = useQuery<CognitiveProposal[]>({
    queryKey: ['cognitive-proposals'],
    queryFn: () => api.get('/admin/cognitive/proposals'),
    retry: false,
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', 'performance', 'cost', 'reliability', 'quality'];

  const filteredProposals = selectedCategory === 'all'
    ? proposals
    : proposals.filter(p => p.category === selectedCategory);

  const pendingCount = proposals.filter(p => p.status === 'pending').length;
  const appliedCount = proposals.filter(p => p.status === 'applied').length;

  const getStatusColor = (status: string) => {
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const getImpactColor = (impact: string) => {
    return 'text-gray-600';
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'performance': return <TrendingUp className="h-4 w-4" />;
      case 'cost': return <AlertTriangle className="h-4 w-4" />;
      case 'reliability': return <CheckCircle className="h-4 w-4" />;
      case 'quality': return <Lightbulb className="h-4 w-4" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="pb-4 border-b border-border-light">
            <h1 className="text-base font-medium text-gray-900 font-inter">Cognitive Advisor</h1>
            <p className="text-gray-600 mt-1 font-inter text-xs">
              AI-powered optimization proposals based on usage patterns
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending Review</CardTitle>
              <Clock className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-7 w-12" /> : (
                <div className="text-lg font-bold text-gray-900">{pendingCount}</div>
              )}
              <p className="text-xs text-gray-600 mt-1">
                Awaiting approval
              </p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Applied</CardTitle>
              <CheckCircle className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-7 w-12" /> : (
                <div className="text-lg font-bold text-gray-900">{appliedCount}</div>
              )}
              <p className="text-xs text-gray-600 mt-1">
                Successfully implemented
              </p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Avg Confidence</CardTitle>
              <Lightbulb className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-7 w-12" /> : (
                <div className="text-lg font-bold text-gray-900">
                  {proposals.length > 0
                    ? (proposals.reduce((acc, p) => acc + p.confidence, 0) / proposals.length * 100).toFixed(0) + '%'
                    : '—'}
                </div>
              )}
              <p className="text-xs text-gray-600 mt-1">
                Model certainty
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2">
          {categories.map(category => (
            <Button
              key={category}
              variant="outline"
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className={`text-xs capitalize ${selectedCategory === category ? 'bg-gray-100' : ''}`}
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Proposals List */}
        <div className="space-y-4">
          {isLoading && (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="border-border-light shadow-sm">
                  <CardHeader>
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {!isLoading && filteredProposals.length === 0 && (
            <div className="text-center text-xs text-gray-500 py-8">No proposals found.</div>
          )}
          {!isLoading && filteredProposals.map((proposal) => (
            <Card key={proposal.id} className="border-border-light shadow-sm">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">
                      {getCategoryIcon(proposal.category)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-sm">{proposal.title}</CardTitle>
                        <Badge className={`${getStatusColor(proposal.status)} border text-xs`}>
                          {proposal.status}
                        </Badge>
                        <Badge className="bg-gray-50 text-gray-700 border border-gray-200 text-xs capitalize">
                          {proposal.category}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">
                        {proposal.description}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {(proposal.confidence * 100).toFixed(0)}% confidence
                    </div>
                    <div className={`text-xs font-medium ${getImpactColor(proposal.impact)} capitalize`}>
                      {proposal.impact} impact
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-beige-primary border border-border-light rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Current</div>
                      <div className="font-medium text-gray-900">{proposal.details.current_value}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Proposed</div>
                      <div className="font-medium text-gray-900">{proposal.details.proposed_value}</div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border-light">
                    <div className="text-xs text-gray-600 mb-1">Expected Improvement</div>
                    <div className="text-sm font-medium text-gray-900">{proposal.details.estimated_improvement}</div>
                  </div>
                </div>

                {proposal.status === 'pending' && (
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" className="bg-beige-primary">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve & Apply
                    </Button>
                    <Button variant="outline" size="sm" className="bg-beige-primary">
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                )}

                {proposal.status === 'applied' && (
                  <div className="mt-4 text-xs text-gray-600">
                    Applied on {new Date(proposal.created_at).toLocaleDateString()}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info Card */}
        <Card className="border-border-light shadow-sm bg-gray-50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100">
                  <Lightbulb className="h-4 w-4 text-gray-600" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900 font-inter mb-1">
                  How Cognitive Advisor Works
                </h3>
                <p className="text-xs text-gray-800 font-inter">
                  The Cognitive Advisor analyzes provider performance, cost patterns, and usage trends every 6 hours.
                  It generates optimization proposals with confidence scores based on historical data.
                  All proposals require manual approval before being applied to your configuration.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
