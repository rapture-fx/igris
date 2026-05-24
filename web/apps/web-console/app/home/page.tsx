'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function HomePage() {
  return (
    <DashboardLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[960px] px-6 py-8">
          <img src="/home.png" alt="Home" className="w-full h-auto rounded-lg" />
        </div>
      </div>
    </DashboardLayout>
  );
}
