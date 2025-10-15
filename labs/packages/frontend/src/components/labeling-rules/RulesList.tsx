'use client';

import React from 'react';
import useSWR from 'swr';
import { LabelingRule } from './types';
import { RuleCard } from './RuleCard';
import { Skeleton } from "@/components/ui/skeleton";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const LoadingSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <Skeleton className="h-48 w-full" />
    <Skeleton className="h-48 w-full" />
    <Skeleton className="h-48 w-full" />
  </div>
);

export const RulesList = () => {
  const { data: rules, error, isLoading } = useSWR<LabelingRule[]>('/api/proxy/dashboard/rules', fetcher);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
        <h2 className="text-xl font-semibold text-red-500">Failed to load rules</h2>
        <p className="text-gray-500 mt-2">Please try again later.</p>
      </div>
    );
  }

  if (!rules || rules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
        <h2 className="text-xl font-semibold">No Rules Found</h2>
        <p className="text-gray-500 mt-2">Get started by creating a new labeling rule.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {rules.map((rule) => (
        <RuleCard key={rule.id} rule={rule} />
      ))}
    </div>
  );
}; 