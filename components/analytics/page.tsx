// app/analytics/page.tsx
import { connectDB } from '@/lib/db';
import { getAnalytics } from '@/services/analytics.service';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';

export default async function AnalyticsPage() {
  await connectDB();

  const data = await getAnalytics();

  return (
    <div className="p-10">
      <h1 className="mb-8 text-3xl font-bold">Analytics</h1>

      <AnalyticsDashboard data={JSON.parse(JSON.stringify(data))} />
    </div>
  );
}
