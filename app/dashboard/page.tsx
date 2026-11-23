// app/dashboard/page.tsx
import { Suspense } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { connectDB } from '@/lib/db';
import { getDashboardStats } from '@/services/dashboard.service';
import { requirePageUserId } from '@/lib/page-guards';
import Dashboard from '@/components/dashboard/Dashboard';
import CheckoutReturnNotice from '@/components/billing/CheckoutReturnNotice';

export default async function DashboardPage() {
  await connectDB();

  const userId = await requirePageUserId();
  const stats = await getDashboardStats(userId);

  return (
    <MainLayout>
      <div>
        <Suspense fallback={null}>
          <CheckoutReturnNotice />
        </Suspense>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
              Overview
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
          </div>
          <Link
            href="/workspace/new"
            className="btn-sheen rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow"
          >
            Create Workspace
          </Link>
        </div>
        <Dashboard stats={stats} />
      </div>
    </MainLayout>
  );
}
