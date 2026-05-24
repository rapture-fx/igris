'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function HomePage() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <img src="/home.png" alt="Home" className="w-full h-auto rounded-lg" />
      </div>
    </DashboardLayout>
  );
}
