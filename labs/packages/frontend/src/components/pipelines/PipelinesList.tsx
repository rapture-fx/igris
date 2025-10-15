'use client';

import React from 'react';
import useSWR from 'swr';
import { Pipeline } from './types';
import { PipelineCard } from './PipelineCard';
import { Skeleton } from "@/components/ui/skeleton";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const LoadingSkeleton = () => (
    <div className="space-y-2">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
);

export const PipelinesList = () => {
  const { data: pipelines, error, isLoading } = useSWR<Pipeline[]>('/api/proxy/dashboard/pipelines', fetcher);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
        <h2 className="text-xl font-semibold text-red-500">Failed to load pipelines</h2>
        <p className="text-gray-500 mt-2">Please try again later.</p>
      </div>
    );
  }

  if (!pipelines || pipelines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
        <h2 className="text-xl font-semibold">No Pipelines Found</h2>
        <p className="text-gray-500 mt-2">Get started by creating a new data pipeline.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {pipelines.map((pipeline) => (
        <PipelineCard key={pipeline.id} pipeline={pipeline} />
      ))}
    </div>
  );
}; 