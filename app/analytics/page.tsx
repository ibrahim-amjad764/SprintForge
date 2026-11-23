// app/analytics/page.tsx
import MainLayout from '@/components/layout/MainLayout';
import { connectDB } from '@/lib/db';
import { getAnalytics } from '@/services/analytics.service';
import { requirePageUserId } from '@/lib/page-guards';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';

export default async function AnalyticsPage() {
  await connectDB();

  const userId = await requirePageUserId();
  const data = await getAnalytics(userId);

  return (
    <MainLayout>
      <div>
        <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
          Insights
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Analytics</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Track completion, velocity, and workload across your work.
        </p>
        <div className="mt-6">
          <AnalyticsDashboard data={JSON.parse(JSON.stringify(data))} />
        </div>
      </div>
    </MainLayout>
  );
}
