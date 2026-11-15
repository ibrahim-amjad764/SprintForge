// app/analytics/page.tsx
import { cookies } from 'next/headers';
import { connectDB } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { getAnalytics } from '@/services/analytics.service';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';

export default async function AnalyticsPage() {
  await connectDB();

  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  const payload = token ? await verifyToken(token) : null;

  // Middleware already gates this page; fall back to empty scope if absent
  const data = payload?.userId
    ? await getAnalytics(String(payload.userId))
    : { totalTasks: 0, completedTasks: 0, completionRate: 0, workload: [], velocity: [] };

  return (
    <div className="p-10">
      <h1 className="mb-8 text-3xl font-bold">Analytics</h1>

      <AnalyticsDashboard data={JSON.parse(JSON.stringify(data))} />
    </div>
  );
}
