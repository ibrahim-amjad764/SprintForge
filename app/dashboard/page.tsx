// app/dashboard/page.tsx
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { connectDB } from '@/lib/db';
import { getDashboardStats } from '@/services/dashboard.service';
import Dashboard from '@/components/dashboard/Dashboard';

export default async function DashboardPage() {
  await connectDB();

  const stats = await getDashboardStats();

  return (
    <MainLayout>
      <div>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Link
            href="/workspace/new"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create Workspace
          </Link>
        </div>
        <Dashboard stats={stats} />
      </div>
    </MainLayout>
  );
}
